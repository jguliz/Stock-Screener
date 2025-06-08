/**
 * Polygon Real-time Stock Data Collector
 * Optimized for performance and stock screening
 */
const polygonService = require("./polygonService");
const database = require("../database");
const cron = require("node-cron");

// Configuration
const COLLECTION_INTERVAL = 30; // Collect every 30 seconds
const COLLECTION_TIMEOUT = 300000; // 5 minutes max collection time
const MAX_SYMBOLS_PER_BATCH = 20; // Polygon-friendly batch size

class PolygonDataCollector {
  constructor() {
    this.pool = null;
    this.task = null;
    this.isCollecting = false;
    this.collectionStart = null;
    // pull from config
    const { tickers } = require("../config");
    this.symbols = tickers;
  }

  async initialize() {
    try {
      if (!this.pool) {
        this.pool = await database.createConnectionPool();
        console.log("Polygon real-time data collector initialized");
      }
      return true;
    } catch (error) {
      console.error("Polygon data collector initialization failed:", error);
      return false;
    }
  }

  async executeQuery(query, params, retries = 3) {
    try {
      return new Promise((resolve, reject) => {
        this.pool.query(query, params, (err, results) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(results);
        });
      });
    } catch (error) {
      const isConnectionError =
        error.code === "PROTOCOL_CONNECTION_LOST" ||
        error.message?.includes("reading 'slice'") ||
        error.message?.includes("Connection lost");

      if (isConnectionError && retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        try {
          this.pool = await database.createConnectionPool();
          return await this.executeQuery(query, params, retries - 1);
        } catch (reconnectError) {
          throw reconnectError;
        }
      }
      throw error;
    }
  }

  async processSymbol(symbol) {
    try {
      // Get stock details from Polygon API
      const stockData = await polygonService.getReliableStockData(symbol);

      // Check if stock exists in the stocks table
      const [existingStock] = await this.executeQuery(
        "SELECT id FROM stocks WHERE symbol = ?",
        [symbol]
      );

      if (existingStock) {
        // Update existing stock
        await this.executeQuery(
          `UPDATE stocks SET 
            name = ?, sector = ?, last_price = ?, change_amount = ?, change_percent = ?,
            volume = ?, market_cap = ?, pe_ratio = ?, dividend_yield = ?,
            high_52week = ?, low_52week = ?, updated_at = NOW()
          WHERE id = ?`,
          [
            stockData.name,
            stockData.sector,
            stockData.last_price,
            stockData.change_amount,
            stockData.change_percent,
            stockData.volume,
            stockData.market_cap,
            stockData.pe_ratio,
            stockData.dividend_yield,
            stockData.high_52week,
            stockData.low_52week,
            existingStock.id,
          ]
        );
      } else {
        // Insert new stock
        const [result] = await this.executeQuery(
          `INSERT INTO stocks 
            (symbol, name, sector, last_price, change_amount, change_percent, 
            volume, market_cap, pe_ratio, dividend_yield, high_52week, low_52week)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            symbol,
            stockData.name,
            stockData.sector,
            stockData.last_price,
            stockData.change_amount,
            stockData.change_percent,
            stockData.volume,
            stockData.market_cap,
            stockData.pe_ratio,
            stockData.dividend_yield,
            stockData.high_52week,
            stockData.low_52week,
          ]
        );
        existingStock = { id: result.insertId };
      }

      // Insert price history
      await this.executeQuery(
        `INSERT INTO price_history (stock_id, price, volume, timestamp) 
        VALUES (?, ?, ?, NOW())`,
        [existingStock.id, stockData.last_price, stockData.volume]
      );

      // Insert aggregate history
await this.executeQuery(`INSERT INTO aggregate_history
            (stock_id, open_price, close_price, high_price, low_price,
             volume, volume_weighted_avg, timestamp, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'collector')`,
  [
    existingStock.id,
    stockData.open_price,
    stockData.last_price,
    stockData.high_price,
    stockData.low_price,
    stockData.volume,
    stockData.vwap,
  ]
);

      // Insert or update fundamentals
      const fundamentals = await polygonService.getCompanyFinancials(symbol);
      if (fundamentals) {
        // Check if fundamentals exist for the stock
        const [existingFundamentals] = await this.executeQuery(
          `SELECT id FROM stock_fundamentals 
          WHERE stock_id = ? AND report_date = ? AND report_type = ?`,
          [existingStock.id, fundamentals.report_date, fundamentals.report_type]
        );

        if (existingFundamentals) {
          // Update existing fundamentals
          await this.executeQuery(
            `UPDATE stock_fundamentals SET
              revenue = ?, gross_profit = ?, net_income = ?, eps = ?, diluted_eps = ?,
              dividend = ?, assets = ?, liabilities = ?, equity = ?, cash = ?, debt = ?,
              operating_cashflow = ?, investing_cashflow = ?, financing_cashflow = ?,
              free_cashflow = ?, updated_at = NOW()
            WHERE id = ?`,
            [
              fundamentals.revenue,
              fundamentals.gross_profit,
              fundamentals.net_income,
              fundamentals.eps,
              fundamentals.diluted_eps,
              fundamentals.dividend,
              fundamentals.assets,
              fundamentals.liabilities,
              fundamentals.equity,
              fundamentals.cash,
              fundamentals.debt,
              fundamentals.operating_cashflow,
              fundamentals.investing_cashflow,
              fundamentals.financing_cashflow,
              fundamentals.free_cashflow,
              existingFundamentals.id,
            ]
          );
        } else {
          // Insert new fundamentals
          await this.executeQuery(
            `INSERT INTO stock_fundamentals
              (stock_id, report_date, report_type, revenue, gross_profit, net_income,
              eps, diluted_eps, dividend, assets, liabilities, equity, cash, debt,
              operating_cashflow, investing_cashflow, financing_cashflow, free_cashflow)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              existingStock.id,
              fundamentals.report_date,
              fundamentals.report_type,
              fundamentals.revenue,
              fundamentals.gross_profit,
              fundamentals.net_income,
              fundamentals.eps,
              fundamentals.diluted_eps,
              fundamentals.dividend,
              fundamentals.assets,
              fundamentals.liabilities,
              fundamentals.equity,
              fundamentals.cash,
              fundamentals.debt,
              fundamentals.operating_cashflow,
              fundamentals.investing_cashflow,
              fundamentals.financing_cashflow,
              fundamentals.free_cashflow,
            ]
          );
        }
      }

      // Insert or update ratios
      const ratios = await polygonService.getStockRatios(symbol);
      if (ratios) {
        // Check if ratios exist for the stock
        const [existingRatios] = await this.executeQuery(
          `SELECT id FROM stock_ratios 
          WHERE stock_id = ? AND calculation_date = ?`,
          [existingStock.id, ratios.calculation_date]
        );

        if (existingRatios) {
          // Update existing ratios
          await this.executeQuery(
            `UPDATE stock_ratios SET
              pe_ratio = ?, pb_ratio = ?, ps_ratio = ?, peg_ratio = ?, dividend_yield = ?,
              dividend_payout_ratio = ?, debt_to_equity = ?, current_ratio = ?, quick_ratio = ?,
              roa = ?, roe = ?, gross_margin = ?, operating_margin = ?, net_margin = ?,
              fcf_yield = ?, updated_at = NOW()
            WHERE id = ?`,
            [
              ratios.pe_ratio,
              ratios.pb_ratio,
              ratios.ps_ratio,
              ratios.peg_ratio,
              ratios.dividend_yield,
              ratios.dividend_payout_ratio,
              ratios.debt_to_equity,
              ratios.current_ratio,
              ratios.quick_ratio,
              ratios.roa,
              ratios.roe,
              ratios.gross_margin,
              ratios.operating_margin,
              ratios.net_margin,
              ratios.fcf_yield,
              existingRatios.id,
            ]
          );
        } else {
          // Insert new ratios
          await this.executeQuery(
            `INSERT INTO stock_ratios
              (stock_id, calculation_date, pe_ratio, pb_ratio, ps_ratio, peg_ratio, dividend_yield,
              dividend_payout_ratio, debt_to_equity, current_ratio, quick_ratio, roa, roe,
              gross_margin, operating_margin, net_margin, fcf_yield)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              existingStock.id,
              ratios.calculation_date,
              ratios.pe_ratio,
              ratios.pb_ratio,
              ratios.ps_ratio,
              ratios.peg_ratio,
              ratios.dividend_yield,
              ratios.dividend_payout_ratio,
              ratios.debt_to_equity,
              ratios.current_ratio,
              ratios.quick_ratio,
              ratios.roa,
              ratios.roe,
              ratios.gross_margin,
              ratios.operating_margin,
              ratios.net_margin,
              ratios.fcf_yield,
            ]
          );
        }
      }

      // Insert or update technical indicators
      const technicals = await polygonService.getTechnicalIndicators(symbol);
      if (technicals) {
        // Check if technicals exist for the stock
        const [existingTechnicals] = await this.executeQuery(
          `SELECT id FROM technical_indicators 
          WHERE stock_id = ? AND calculation_date = ?`,
          [existingStock.id, technicals.calculation_date]
        );

        if (existingTechnicals) {
          // Update existing technicals
          await this.executeQuery(
            `UPDATE technical_indicators SET
              sma_20 = ?, sma_50 = ?, sma_200 = ?, ema_12 = ?, ema_26 = ?, macd = ?,
              macd_signal = ?, macd_histogram = ?, rsi_14 = ?, bollinger_upper = ?,
              bollinger_middle = ?, bollinger_lower = ?, atr_14 = ?, stochastic_k = ?,
              stochastic_d = ?, obv = ?, updated_at = NOW()
            WHERE id = ?`,
            [
              technicals.sma_20,
              technicals.sma_50,
              technicals.sma_200,
              technicals.ema_12,
              technicals.ema_26,
              technicals.macd,
              technicals.macd_signal,
              technicals.macd_histogram,
              technicals.rsi_14,
              technicals.bollinger_upper,
              technicals.bollinger_middle,
              technicals.bollinger_lower,
              technicals.atr_14,
              technicals.stochastic_k,
              technicals.stochastic_d,
              technicals.obv,
              existingTechnicals.id,
            ]
          );
        } else {
          // Insert new technicals
          await this.executeQuery(
            `INSERT INTO technical_indicators
              (stock_id, calculation_date, sma_20, sma_50, sma_200, ema_12, ema_26, macd,
              macd_signal, macd_histogram, rsi_14, bollinger_upper, bollinger_middle,
              bollinger_lower, atr_14, stochastic_k, stochastic_d, obv)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              existingStock.id,
              technicals.calculation_date,
              technicals.sma_20,
              technicals.sma_50,
              technicals.sma_200,
              technicals.ema_12,
              technicals.ema_26,
              technicals.macd,
              technicals.macd_signal,
              technicals.macd_histogram,
              technicals.rsi_14,
              technicals.bollinger_upper,
              technicals.bollinger_middle,
              technicals.bollinger_lower,
              technicals.atr_14,
              technicals.stochastic_k,
              technicals.stochastic_d,
              technicals.obv,
            ]
          );
        }
      }

      return {
        stockId: existingStock.id,
        symbol,
        data: stockData,
      };
    } catch (error) {
      console.error(`Error processing ${symbol}:`, error.message);
      return null;
    }
  }

  async collectRealtimeData() {
    if (this.isCollecting) {
      const elapsedTime = Date.now() - this.collectionStart;
      if (elapsedTime > COLLECTION_TIMEOUT) {
        console.log(
          "Force resetting collection flag - previous collection timed out"
        );
        this.isCollecting = false;
      } else {
        return;
      }
    }

    this.isCollecting = true;
    this.collectionStart = Date.now();

    try {
      if (!this.pool) {
        console.warn("Database not connected");
        return;
      }

      console.log(
        `Starting data collection for ${this.symbols.length} symbols...`
      );

      // Create batches to prevent overwhelming the API
      const batches = [];
      for (let i = 0; i < this.symbols.length; i += MAX_SYMBOLS_PER_BATCH) {
        batches.push(this.symbols.slice(i, i + MAX_SYMBOLS_PER_BATCH));
      }

      const results = [];
      for (const batch of batches) {
        const batchPromises = batch.map((symbol) => this.processSymbol(symbol));
        const batchResults = await Promise.allSettled(batchPromises);

        const processedResults = batchResults
          .filter(
            (result) => result.status === "fulfilled" && result.value !== null
          )
          .map((result) => result.value);

        results.push(...processedResults);

        // Small delay between batches
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`Collected data for ${results.length} symbols`);
    } catch (error) {
      console.error("Collection error:", error.message);
    } finally {
      this.isCollecting = false;
    }
  }

  startCollector(intervalSeconds = COLLECTION_INTERVAL) {
    if (this.task) {
      console.warn("Collector already running");
      return;
    }

    console.log(
      `Starting Polygon data collection every ${intervalSeconds} seconds`
    );

    const cronExpression = `*/${intervalSeconds} * * * * *`;
    this.task = cron.schedule(cronExpression, () => {
      this.collectRealtimeData().catch((err) => {
        console.error("Unhandled error:", err.message);
      });
    });

    // Run immediately on start
    this.collectRealtimeData().catch((err) => {
      console.error("Initial collection error:", err.message);
    });

    return this.task;
  }

  stopCollector() {
    if (this.task) {
      this.task.stop();
      console.log("Polygon data collector stopped");
      this.task = null;
    }

    if (this.pool) {
      this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = new PolygonDataCollector();
