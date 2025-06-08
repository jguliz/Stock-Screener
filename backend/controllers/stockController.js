// backend/controllers/stockController.js
const pool = require('../database').pool;

/**
 * Get all stocks with current prices
 */
exports.getAllStocks = async (req, res) => {
  try {
    // Get user ID for favorites
    const userId = req.user.id;
    
    // Get favorite stocks for this user
    const [favorites] = await pool.query(
      'SELECT stock_id FROM favorites WHERE user_id = ?',
      [userId]
    );
    
    const favoriteIds = favorites.map(fav => fav.stock_id);
    
    // Get all stocks from the view
    const [stocks] = await pool.query('SELECT * FROM current_stock_prices');
    
    // Add favorite information
    const stocksWithFavorites = stocks.map(stock => ({
      ...stock,
      isFavorite: favoriteIds.includes(stock.id)
    }));
    
    res.status(200).json({ 
      stocks: stocksWithFavorites,
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get stock details by ID
 */
exports.getStockById = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get user ID for favorites
    const userId = req.user.id;
    
    // Check if stock is favorite
    const [favoriteResult] = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id = ? AND stock_id = ?',
      [userId, id]
    );
    
    const isFavorite = favoriteResult.length > 0;
    
    // Get stock from view
    const [stocks] = await pool.query(
      'SELECT * FROM current_stock_prices WHERE id = ?', 
      [id]
    );
    
    if (stocks.length === 0) {
      return res.status(404).json({ message: 'Stock not found' });
    }
    
    const stock = stocks[0];
    
    // Add statistics from the statistics view
    const [statistics] = await pool.query(
      'SELECT * FROM stock_price_statistics WHERE id = ?',
      [id]
    );
    
    const fullStock = {
      ...stock,
      isFavorite,
      statistics: statistics.length > 0 ? statistics[0] : null
    };
    
    res.status(200).json({ stock: fullStock });
  } catch (error) {
    console.error('Error fetching stock by ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get stock price history
 */
// Enhanced getStockHistory function with better timeframe support
exports.getStockHistory = async (req, res) => {
  const { id } = req.params;
  const minutes = parseInt(req.query.minutes) || 60;
  const interval = req.query.interval || "auto";
  const timeframe = req.query.timeframe || "1d"; // New parameter

  try {
    // Map timeframe to appropriate query parameters if not explicitly provided
    let queryMinutes = minutes;
    let queryInterval = interval;
    
    if (interval === "auto") {
      // Determine appropriate interval based on timeframe
      switch(timeframe) {
        case "5m":
          queryMinutes = 5;
          queryInterval = "1m";
          break;
        case "15m":
          queryMinutes = 15;
          queryInterval = "1m";
          break;
        case "1h":
          queryMinutes = 60;
          queryInterval = "5m";
          break;
        case "1d":
          queryMinutes = 60 * 24;
          queryInterval = "5m";
          break;
        case "1w":
          queryMinutes = 60 * 24 * 7;
          queryInterval = "15m";
          break;
        case "1mo":
          queryMinutes = 60 * 24 * 30;
          queryInterval = "1h";
          break;
        case "1y":
          queryMinutes = 60 * 24 * 365;
          queryInterval = "1d";
          break;
        default:
          queryMinutes = 60;
          queryInterval = "5m";
      }
    }

    // Build the SQL query with appropriate sampling
    let query = `
      SELECT timestamp as time, price, volume
      FROM price_history 
      WHERE stock_id = ? 
      AND timestamp >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `;

    // Determine data point interval based on requested timeframe
    let samplingInterval = 1; // Default: use all data points

    // For longer timeframes, sample data to reduce points
    if (queryMinutes > 60 * 24 * 30) {
      // Month+ timeframe: sample daily
      samplingInterval = 1440; // minutes in a day
      query += ` AND MINUTE(timestamp) = 0 AND HOUR(timestamp) = 0`;
    } else if (queryMinutes > 60 * 24) {
      // Day+ timeframe: sample hourly
      samplingInterval = 60;
      query += ` AND MINUTE(timestamp) = 0`;
    } else if (queryMinutes > 60 * 4) {
      // 4+ hours: sample every 15 minutes
      samplingInterval = 15;
      query += ` AND MINUTE(timestamp) % 15 = 0`;
    } else if (queryMinutes > 60) {
      // 1+ hour: sample every 5 minutes
      samplingInterval = 5;
      query += ` AND MINUTE(timestamp) % 5 = 0`;
    }

    // Add ordering
    query += ` ORDER BY timestamp`;

    // Add a reasonable limit to prevent massive data returns
    const maxDataPoints = 300;

    // Execute the query
    const [historyData] = await pool.query(query, [id, queryMinutes]);

    // If we have too many data points, sample them further
    let history = historyData;
    if (history.length > maxDataPoints) {
      const sampleRate = Math.ceil(history.length / maxDataPoints);
      history = history.filter((_, index) => index % sampleRate === 0);
    }

    // Ensure first and last points are always included
    if (history.length > 0 && history[0] !== historyData[0]) {
      history.unshift(historyData[0]);
    }
    if (
      history.length > 0 &&
      history[history.length - 1] !== historyData[historyData.length - 1]
    ) {
      history.push(historyData[historyData.length - 1]);
    }

    // Format the data - ensuring numeric values
    const formattedHistory = history.map((item) => ({
      time: new Date(item.time).toISOString(),
      price: parseFloat(item.price).toFixed(2),
      volume: parseInt(item.volume) || 0,
    }));

    // Check if we have enough data points
    if (formattedHistory.length < 10) {
      // Not enough database data points, try fetching from API
      console.log(
        `Not enough price history data points (${formattedHistory.length}) for stock ${id}, trying external API...`
      );

      try {
        const [stockResult] = await pool.query(
          "SELECT symbol FROM stocks WHERE id = ?",
          [id]
        );
        if (stockResult && stockResult.length > 0) {
          const symbol = stockResult[0].symbol;

          // Use enhanced stock service with timeframe support
          const stockService = require("../stockServiceEnhanced");
          
          // Map our timeframe to Yahoo/Polygon compatible format
          const apiTimeframe = timeframe === "1mo" ? "1m" : timeframe;
          const apiInterval = queryInterval;
          
          const apiHistory = await stockService.getHistoricalData(symbol, apiTimeframe, apiInterval);

          if (apiHistory && apiHistory.length > 0) {
            console.log(
              `Retrieved ${apiHistory.length} data points from API for ${symbol}`
            );

            // Save API data to database for future use
            const connection = await pool.getConnection();
            try {
              await connection.beginTransaction();

              for (const point of apiHistory) {
                const price =
                  typeof point.price === "number"
                    ? point.price
                    : parseFloat(point.price);
                const timestamp = new Date(point.time);

                // Check if this timestamp already exists
                const [existing] = await connection.query(
                  "SELECT 1 FROM price_history WHERE stock_id = ? AND timestamp = ?",
                  [id, timestamp]
                );

                if (existing.length === 0) {
                  await connection.query(
                    "INSERT INTO price_history (stock_id, price, volume, timestamp) VALUES (?, ?, ?, ?)",
                    [id, price, point.volume || 0, timestamp]
                  );
                }
              }

              await connection.commit();
              console.log(`Saved API history data for ${symbol} to database`);

              // Use the API data for the response
              return res.status(200).json({
                history: apiHistory,
                source: "api",
                dataPoints: apiHistory.length,
                timeframe: timeframe
              });
            } catch (saveErr) {
              await connection.rollback();
              console.error(
                `Failed to save API history data for ${symbol}:`,
                saveErr
              );
              // Continue with response using API data even if saving failed
              return res.status(200).json({
                history: apiHistory,
                source: "api",
                dataPoints: apiHistory.length,
                timeframe: timeframe
              });
            } finally {
              connection.release();
            }
          }
        }
      } catch (apiError) {
        console.error(`Error fetching from API for stock ${id}:`, apiError);
        // We'll fall back to mock data or limited database data
      }

      // If we're here, API failed or had no data
      if (formattedHistory.length === 0) {
        // Generate mock data as a last resort
        console.log(`Generating mock data for stock ${id}`);
        const mockHistory = generateMockPriceHistory(id, queryMinutes);
        return res.status(200).json({
          history: mockHistory,
          source: "mock",
          dataPoints: mockHistory.length,
          timeframe: timeframe
        });
      }
    }

    // Return database history data
    return res.status(200).json({
      history: formattedHistory,
      source: "database",
      dataPoints: formattedHistory.length,
      timeframe: timeframe
    });
  } catch (error) {
    console.error("Error fetching stock history:", error);

    // In case of any error, fall back to mock data
    const mockHistory = generateMockPriceHistory(id, minutes);

    return res.status(200).json({
      history: mockHistory,
      source: "mock",
      error: "Failed to retrieve history from database: " + error.message,
      timeframe: timeframe
    });
  }
};

/**
 * Generate mock price history data with more realistic patterns
 */
function generateMockPriceHistory(stockId, minutes) {
  // Map stock IDs to symbols and base prices
  const stockMap = {
    1: { symbol: "AAPL", price: 180.95, volatility: 0.02 },
    2: { symbol: "MSFT", price: 380.75, volatility: 0.015 },
    3: { symbol: "AMZN", price: 185.88, volatility: 0.025 },
    4: { symbol: "GOOGL", price: 176.44, volatility: 0.018 },
    5: { symbol: "META", price: 504.22, volatility: 0.022 },
    6: { symbol: "TSLA", price: 172.63, volatility: 0.03 },
    7: { symbol: "NVDA", price: 874.5, volatility: 0.028 },
    8: { symbol: "JPM", price: 192.82, volatility: 0.012 },
    9: { symbol: "V", price: 267.88, volatility: 0.01 },
    10: { symbol: "JNJ", price: 156.67, volatility: 0.008 },
  };

  const stock = stockMap[stockId] || {
    symbol: "UNKNOWN",
    price: 100,
    volatility: 0.02,
  };
  const basePrice = stock.price;
  const volatility = stock.volatility;

  // Generate data points for the requested time period
  const now = new Date();
  const data = [];

  // Use a random walk with mean reversion for more realistic price movement
  let currentPrice = basePrice;
  let trend = (Math.random() - 0.5) * 0.01; // Slight random trend direction

  for (let i = 0; i < minutes; i++) {
    // Calculate time point (going backward from now)
    const time = new Date(now.getTime() - (minutes - i) * 60000);

    // Add some randomness to price (random walk)
    const randomChange = (Math.random() - 0.5) * volatility;

    // Add mean reversion (tendency to return to base price)
    const meanReversion = (basePrice - currentPrice) * 0.01;

    // Update current price with random change, trend, and mean reversion
    currentPrice = currentPrice * (1 + randomChange + trend + meanReversion);

    // Ensure price doesn't go negative or too far from base
    currentPrice = Math.max(currentPrice, basePrice * 0.7);
    currentPrice = Math.min(currentPrice, basePrice * 1.3);

    // Generate mock volume (higher near price changes)
    const volumeBase = Math.abs(randomChange) * 100000;
    const volume = Math.round(volumeBase + Math.random() * 50000);

    data.push({
      time: time.toLocaleTimeString(),
      price: parseFloat(currentPrice.toFixed(2)),
      volume: volume,
    });

    // Slightly adjust trend for the next iteration
    trend = trend * 0.95 + (Math.random() - 0.5) * 0.002;
  }

  return data;
}

/**
 * Get top gainers
 */
exports.getTopGainers = async (req, res) => {
  try {
    const [gainers] = await pool.query('SELECT * FROM top_gainers');
    res.status(200).json({ stocks: gainers });
  } catch (error) {
    console.error('Error fetching top gainers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get top losers
 */
exports.getTopLosers = async (req, res) => {
  try {
    const [losers] = await pool.query('SELECT * FROM top_losers');
    res.status(200).json({ stocks: losers });
  } catch (error) {
    console.error('Error fetching top losers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get sector performance
 */
exports.getSectorPerformance = async (req, res) => {
  try {
    const [sectors] = await pool.query('SELECT * FROM sector_performance');
    res.status(200).json({ sectors });
  } catch (error) {
    console.error('Error fetching sector performance:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get user favorites with full stock data
 */
exports.getUserFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [favorites] = await pool.query(
      'SELECT * FROM user_favorites WHERE user_id = ?',
      [userId]
    );
    
    // Add isFavorite flag (true for all since this is favorites list)
    const favoritesWithFlag = favorites.map(stock => ({
      ...stock,
      isFavorite: true
    }));
    
    res.status(200).json({ favorites: favoritesWithFlag });
  } catch (error) {
    console.error('Error fetching user favorites:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Toggle stock favorite status
 */
exports.toggleFavorite = async (req, res) => {
  const { stockId } = req.body;
  const userId = req.user.id;
  
  try {
    // Check if stock exists
    const [stockResult] = await pool.query(
      'SELECT 1 FROM stocks WHERE id = ?',
      [stockId]
    );
    
    if (stockResult.length === 0) {
      return res.status(404).json({ message: 'Stock not found' });
    }
    
    // Check if favorite already exists
    const [favoriteResult] = await pool.query(
      'SELECT 1 FROM favorites WHERE user_id = ? AND stock_id = ?',
      [userId, stockId]
    );
    
    const isFavorite = favoriteResult.length > 0;
    
    // Toggle the favorite status
    if (isFavorite) {
      // Remove favorite
      await pool.query(
        'DELETE FROM favorites WHERE user_id = ? AND stock_id = ?',
        [userId, stockId]
      );
      
      // Log action
      await pool.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id)
         VALUES (?, 'favorite_removed', 'stock', ?)`,
        [userId, stockId]
      );
    } else {
      // Check max favorites limit
      const [configResult] = await pool.query(
        'SELECT config_value FROM system_config WHERE config_key = ?',
        ['max_favorites_per_user']
      );
      
      const maxFavorites = configResult.length > 0 
        ? parseInt(configResult[0].config_value, 10) 
        : 50;
      
      // Count current favorites
      const [countResult] = await pool.query(
        'SELECT COUNT(*) as count FROM favorites WHERE user_id = ?',
        [userId]
      );
      
      if (countResult[0].count >= maxFavorites) {
        return res.status(400).json({ 
          message: `You have reached the maximum of ${maxFavorites} favorites` 
        });
      }
      
      // Add favorite
      await pool.query(
        'INSERT INTO favorites (user_id, stock_id) VALUES (?, ?)',
        [userId, stockId]
      );
      
      // Log action
      await pool.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id)
         VALUES (?, 'favorite_added', 'stock', ?)`,
        [userId, stockId]
      );
    }
    
    res.status(200).json({ 
      success: true,
      isFavorite: !isFavorite,
      message: !isFavorite 
        ? `Stock added to favorites` 
        : `Stock removed from favorites` 
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get all user alerts
 */
exports.getUserAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [alerts] = await pool.query(
      'SELECT * FROM user_alerts WHERE user_id = ?',
      [userId]
    );
    
    res.status(200).json({ alerts });
  } catch (error) {
    console.error('Error fetching user alerts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Set an alert for a stock
 */
exports.setAlert = async (req, res) => {
  const { stockId, threshold, direction, type, timeInterval, basePrice } = req.body;
  const userId = req.user.id;
  
  try {
    // Check if stock exists
    const [stockResult] = await pool.query(
      'SELECT 1 FROM stocks WHERE id = ?',
      [stockId]
    );
    
    if (stockResult.length === 0) {
      return res.status(404).json({ message: 'Stock not found' });
    }
    
    // Check max alerts limit
    const [configResult] = await pool.query(
      'SELECT config_value FROM system_config WHERE config_key = ?',
      ['max_alerts_per_user']
    );
    
    const maxAlerts = configResult.length > 0 
      ? parseInt(configResult[0].config_value, 10) 
      : 20;
    
    // Count current alerts
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as count FROM alerts WHERE user_id = ?',
      [userId]
    );
    
    if (countResult[0].count >= maxAlerts) {
      return res.status(400).json({ 
        message: `You have reached the maximum of ${maxAlerts} alerts` 
      });
    }
    
    // Check if alert for this stock already exists
    const [alertResult] = await pool.query(
      'SELECT id FROM alerts WHERE user_id = ? AND stock_id = ?',
      [userId, stockId]
    );
    
    if (alertResult.length > 0) {
      // Update existing alert
      await pool.query(
        `UPDATE alerts 
         SET threshold = ?, direction = ?, is_triggered = 0
         WHERE id = ?`,
        [threshold, direction, alertResult[0].id]
      );
      
      // Log action
      await pool.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'alert_updated', 'stock', ?, ?)`,
        [
          userId, 
          stockId,
          JSON.stringify({ threshold, direction, type, timeInterval, basePrice })
        ]
      );
    } else {
      // Create new alert
      await pool.query(
        `INSERT INTO alerts (user_id, stock_id, threshold, direction)
         VALUES (?, ?, ?, ?)`,
        [userId, stockId, threshold, direction]
      );
      
      // Log action
      await pool.query(
        `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'alert_created', 'stock', ?, ?)`,
        [
          userId, 
          stockId,
          JSON.stringify({ threshold, direction, type, timeInterval, basePrice })
        ]
      );
    }
    
    res.status(200).json({ 
      success: true,
      message: `Alert set successfully` 
    });
  } catch (error) {
    console.error('Error setting alert:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Delete an alert
 */
exports.deleteAlert = async (req, res) => {
  const { alertId } = req.params;
  const userId = req.user.id;
  
  try {
    // Check if alert exists and belongs to user
    const [alertResult] = await pool.query(
      'SELECT stock_id FROM alerts WHERE id = ? AND user_id = ?',
      [alertId, userId]
    );
    
    if (alertResult.length === 0) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    // Delete the alert
    await pool.query(
      'DELETE FROM alerts WHERE id = ?',
      [alertId]
    );
    
    // Log action
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id)
       VALUES (?, 'alert_deleted', 'alert', ?)`,
      [userId, alertId]
    );
    
    res.status(200).json({ 
      success: true,
      message: 'Alert deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Get markets overview stats
 */
exports.getMarketOverview = async (req, res) => {
  try {
    // Get market stats
    const [marketStats] = await pool.query(`
      SELECT
        COUNT(*) as total_stocks,
        SUM(CASE WHEN change_percent > 0 THEN 1 ELSE 0 END) as gainers,
        SUM(CASE WHEN change_percent < 0 THEN 1 ELSE 0 END) as losers,
        SUM(CASE WHEN change_percent = 0 THEN 1 ELSE 0 END) as unchanged,
        AVG(change_percent) as avg_change_percent,
        MAX(change_percent) as max_gain,
        MIN(change_percent) as max_loss,
        SUM(volume) as total_volume,
        SUM(market_cap) as total_market_cap
      FROM stocks
    `);
    
    // Get sector performance
    const [sectorPerformance] = await pool.query('SELECT * FROM sector_performance');
    
    // Get top 5 gainers and losers
    const [topGainers] = await pool.query('SELECT * FROM top_gainers LIMIT 5');
    const [topLosers] = await pool.query('SELECT * FROM top_losers LIMIT 5');
    
    res.status(200).json({
      marketStats: marketStats[0],
      sectorPerformance,
      topGainers,
      topLosers,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching market overview:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};