// backfill-service.js - ROBUST VERSION
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

// In-memory storage for job status
const backfillJobs = new Map();

// Database pool
let pool = null;

/**
 * Initialize the database connection pool
 * @param {Object} externalPool - MySQL/MySQL2 connection pool
 * @returns {boolean} Success status
 */
async function initializePool(externalPool) {
  if (externalPool) {
    pool = externalPool;
    console.log("Using external database pool for backfill service");
    return true;
  }

  if (!pool) {
    console.log(
      "No pool provided, backfill service will wait for pool to be set"
    );
    return false;
  }
  return true;
}

/**
 * Set the database pool for the service
 * @param {Object} databasePool - MySQL/MySQL2 connection pool
 * @returns {boolean} Success status
 */
function setPool(databasePool) {
  pool = databasePool;
  return pool !== null;
}

/**
 * Execute a database query with promise wrapping and retries
 * @param {string} query - SQL query
 * @param {Array} params - Query parameters
 * @param {number} retries - Number of retries on connection errors
 * @returns {Promise<Array>} Query results
 */
async function executeQuery(query, params = [], retries = 3) {
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  try {
    // Check which query method to use
    if (typeof pool.query === "function") {
      // Standard MySQL query method with promise wrapping
      return new Promise((resolve, reject) => {
        pool.query(query, params, (err, results) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(results);
        });
      });
    } else if (typeof pool.execute === "function") {
      // MySQL2 execute method
      const [results] = await pool.execute(query, params);
      return results;
    } else {
      throw new Error("Unsupported database pool interface");
    }
  } catch (error) {
    // Retry on common connection errors
    if (
      retries > 0 &&
      (error.code === "ECONNRESET" ||
        error.code === "PROTOCOL_CONNECTION_LOST" ||
        error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR")
    ) {
      console.log(`Retrying query (${retries} attempts left)...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return executeQuery(query, params, retries - 1);
    }
    throw error;
  }
}

/**
 * Get a database connection from the pool with proper promise wrapping
 * @returns {Promise<Object>} Database connection
 */
async function getConnection() {
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  if (typeof pool.getConnection === "function") {
    return new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(connection);
      });
    });
  }
  return pool; // If getConnection is not available, use the pool directly
}

/**
 * Begin a database transaction with proper promise wrapping
 * @param {Object} connection - Database connection
 * @returns {Promise<void>}
 */
async function beginTransaction(connection) {
  if (!connection) return;

  if (typeof connection.beginTransaction === "function") {
    return new Promise((resolve, reject) => {
      connection.beginTransaction((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

/**
 * Commit a database transaction with proper promise wrapping
 * @param {Object} connection - Database connection
 * @returns {Promise<void>}
 */
async function commitTransaction(connection) {
  if (!connection) return;

  if (typeof connection.commit === "function") {
    return new Promise((resolve, reject) => {
      connection.commit((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

/**
 * Rollback a database transaction with proper promise wrapping
 * @param {Object} connection - Database connection
 * @returns {Promise<void>}
 */
async function rollbackTransaction(connection) {
  if (!connection) return;

  if (typeof connection.rollback === "function") {
    return new Promise((resolve) => {
      connection.rollback(() => resolve());
    });
  }
}

/**
 * Update job status in the in-memory store
 * @param {string} jobId - Job ID
 * @param {Object} update - Status update
 * @returns {Object} Updated job status
 */
async function updateJobStatus(jobId, update) {
  const currentStatus = backfillJobs.get(jobId) || {};
  backfillJobs.set(jobId, { ...currentStatus, ...update });
  return backfillJobs.get(jobId);
}

/**
 * Get job status by ID
 * @param {string} jobId - Job ID
 * @returns {Object} Job status
 */
async function getBackfillStatus(jobId) {
  return backfillJobs.get(jobId) || { error: "Job not found" };
}

/**
 * Format date for Polygon API
 * @param {Date} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
function formatDateForPolygon(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Determine appropriate timeframe based on date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {string} Timeframe (minute, hour, day, week, month)
 */
function determineTimeframe(startDate, endDate) {
  const diffMs = Math.abs(endDate - startDate);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 1) return "minute";
  if (diffDays < 7) return "hour";
  if (diffDays < 30) return "day";
  if (diffDays < 365) return "week";
  return "month";
}

/**
 * Identify time periods with missing data for stocks
 * @param {Object} options - Options for identifying missing periods
 * @returns {Promise<Array>} Array of missing periods
 */
async function identifyMissingPeriods(options = {}) {
  try {
    // Get stocks to analyze (filter by symbols if provided)
    let stocksQuery = "SELECT id, symbol FROM stocks";
    let params = [];

    if (options.symbols && options.symbols.length > 0) {
      if (options.symbols.length === 1) {
        stocksQuery += " WHERE symbol = ?";
        params = [options.symbols[0]];
      } else {
        const placeholders = options.symbols.map(() => "?").join(",");
        stocksQuery += ` WHERE symbol IN (${placeholders})`;
        params = options.symbols;
      }
    }

    const stocks = await executeQuery(stocksQuery, params);
    if (!stocks || stocks.length === 0) {
      console.log("No stocks found for backfill analysis");
      return [];
    }

    const missingPeriods = [];
    const now = new Date();
    const defaultStartTime = new Date(now);
    defaultStartTime.setDate(defaultStartTime.getDate() - 7); // Default to 7 days

    // Override time range if provided
    const startTime = options.startTime || defaultStartTime;
    const endTime = options.endTime || now;

    for (const stock of stocks) {
      // Find gaps in price_history
      let query = `
        SELECT timestamp
        FROM price_history
        WHERE stock_id = ?
          AND timestamp BETWEEN ? AND ?
        ORDER BY timestamp ASC
      `;

      const priceHistory = await executeQuery(query, [
        stock.id,
        startTime,
        endTime,
      ]);

      // If no data points exist in range, create one missing period for the whole range
      if (priceHistory.length === 0) {
        missingPeriods.push({
          stockId: stock.id,
          symbol: stock.symbol,
          startTime,
          endTime,
        });
        continue;
      }

      // Check for gaps between data points
      const gapThresholdMinutes = options.gapThreshold || 15;

      for (let i = 1; i < priceHistory.length; i++) {
        const prevTimestamp = new Date(priceHistory[i - 1].timestamp);
        const currTimestamp = new Date(priceHistory[i].timestamp);

        // Calculate time difference in minutes
        const timeDiffMinutes = (currTimestamp - prevTimestamp) / (1000 * 60);

        // If gap exceeds threshold, add missing period
        if (timeDiffMinutes > gapThresholdMinutes) {
          missingPeriods.push({
            stockId: stock.id,
            symbol: stock.symbol,
            startTime: new Date(prevTimestamp.getTime() + 60000),
            endTime: new Date(currTimestamp.getTime() - 60000),
          });
        }
      }

      // Check for gap between first data point and start time
      const firstTimestamp = new Date(priceHistory[0].timestamp);
      const firstTimeDiffMinutes = (firstTimestamp - startTime) / (1000 * 60);

      if (firstTimeDiffMinutes > gapThresholdMinutes) {
        missingPeriods.push({
          stockId: stock.id,
          symbol: stock.symbol,
          startTime,
          endTime: new Date(firstTimestamp.getTime() - 60000),
        });
      }

      // Check for gap between last data point and end time
      const lastTimestamp = new Date(
        priceHistory[priceHistory.length - 1].timestamp
      );
      const lastTimeDiffMinutes = (endTime - lastTimestamp) / (1000 * 60);

      if (lastTimeDiffMinutes > gapThresholdMinutes) {
        missingPeriods.push({
          stockId: stock.id,
          symbol: stock.symbol,
          startTime: new Date(lastTimestamp.getTime() + 60000),
          endTime,
        });
      }
    }

    return missingPeriods;
  } catch (error) {
    console.error("Error identifying missing periods:", error);
    throw error;
  }
}

/**
 * Fetch and store data for a specific missing period
 * @param {number} stockId - Stock ID
 * @param {string} symbol - Stock symbol
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @returns {Promise<Array>} Backfilled data points
 */
async function backfillPeriod(stockId, symbol, startTime, endTime) {
  console.log(
    `Backfilling ${symbol} (ID: ${stockId}) from ${startTime.toISOString()} to ${endTime.toISOString()}`
  );

  // Verify the pool exists
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  try {
    // Get stock service
    const stockService = require("./stockServiceEnhanced");

    // Format dates and determine timeframe
    const timeframe = determineTimeframe(startTime, endTime);
    const formattedStartDate = formatDateForPolygon(startTime);
    const formattedEndDate = formatDateForPolygon(endTime);

    console.log(
      `Using timeframe: ${timeframe}, dates: ${formattedStartDate} to ${formattedEndDate}`
    );

    // Fetch historical data
    const response = await stockService.getHistoricalData(
      symbol,
      timeframe,
      1,
      formattedStartDate,
      formattedEndDate
    );

    if (!response || !response.data || response.data.length === 0) {
      console.log(`No data available for ${symbol} in the specified period`);
      return [];
    }

    const dataPoints = response.data;
    console.log(`Retrieved ${dataPoints.length} data points for ${symbol}`);

    // Database operations with proper error handling
    let connection;
    let needToRelease = false;

    try {
      // Get connection from pool
      connection = await getConnection();

      // Check if we need to release the connection later
      needToRelease = typeof connection.release === "function";

      // Begin transaction
      await beginTransaction(connection);

      let insertedCount = 0;

      // Process each data point
      for (const point of dataPoints) {
        const timestamp = new Date(point.time);

        // Insert price history using the right connection method
        if (typeof connection.execute === "function") {
          await connection.execute(
            `INSERT INTO price_history (stock_id, price, volume, timestamp, source) 
             VALUES (?, ?, ?, ?, 'rest')
             ON DUPLICATE KEY UPDATE price = VALUES(price), volume = VALUES(volume)`,
            [stockId, point.price, point.volume || 0, timestamp]
          );
        } else {
          await new Promise((resolve, reject) => {
            connection.query(
              `INSERT INTO price_history (stock_id, price, volume, timestamp, source) 
               VALUES (?, ?, ?, ?, 'rest')
               ON DUPLICATE KEY UPDATE price = VALUES(price), volume = VALUES(volume)`,
              [stockId, point.price, point.volume || 0, timestamp],
              (err, result) => {
                if (err) reject(err);
                else resolve(result);
              }
            );
          });
        }

        // For aggregate data, ensure we have OHLC values
        const openPrice = point.open || point.price;
        const highPrice = point.high || point.price;
        const lowPrice = point.low || point.price;
        const closePrice = point.price;

        // Insert into aggregate_history (for hourly or larger timeframes)
        if (timeframe !== "minute" && timeframe !== "1m") {
          if (typeof connection.execute === "function") {
            await connection.execute(
              `INSERT INTO aggregate_history 
               (stock_id, open_price, high_price, low_price, close_price, volume, timestamp, source) 
               VALUES (?, ?, ?, ?, ?, ?, ?, 'rest')
               ON DUPLICATE KEY UPDATE 
                 open_price = VALUES(open_price),
                 high_price = VALUES(high_price),
                 low_price = VALUES(low_price),
                 close_price = VALUES(close_price),
                 volume = VALUES(volume)`,
              [
                stockId,
                openPrice,
                highPrice,
                lowPrice,
                closePrice,
                point.volume || 0,
                timestamp,
              ]
            );
          } else {
            await new Promise((resolve, reject) => {
              connection.query(
                `INSERT INTO aggregate_history 
                 (stock_id, open_price, high_price, low_price, close_price, volume, timestamp, source) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'rest')
                 ON DUPLICATE KEY UPDATE 
                   open_price = VALUES(open_price),
                   high_price = VALUES(high_price),
                   low_price = VALUES(low_price),
                   close_price = VALUES(close_price),
                   volume = VALUES(volume)`,
                [
                  stockId,
                  openPrice,
                  highPrice,
                  lowPrice,
                  closePrice,
                  point.volume || 0,
                  timestamp,
                ],
                (err, result) => {
                  if (err) reject(err);
                  else resolve(result);
                }
              );
            });
          }
        }

        insertedCount++;
      }

      // Commit the transaction
      await commitTransaction(connection);

      console.log(
        `Successfully backfilled ${insertedCount} data points for ${symbol}`
      );
      return dataPoints;
    } catch (error) {
      // Rollback transaction on error
      await rollbackTransaction(connection);
      throw error;
    } finally {
      // Release connection if needed
      if (needToRelease && connection) {
        connection.release();
      }
    }
  } catch (error) {
    console.error(`Error backfilling data for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Main backfill function that runs when service starts or on demand
 * @param {Object} options - Backfill options
 * @returns {Promise<String>} Job ID for tracking
 */
async function performBackfill(options = {}) {
  const jobId = options.jobId || uuidv4();
  const isForced = options.force || false;

  // Initialize job status
  backfillJobs.set(jobId, {
    id: jobId,
    startedAt: new Date(),
    status: "running",
    progress: 0,
    missingPeriods: [],
    processedPeriods: 0,
    errors: [],
    completed: false,
  });

  try {
    // Verify database pool is initialized
    if (!pool) {
      throw new Error("Database pool not initialized");
    }

    await updateJobStatus(jobId, { status: "identifying_gaps" });

    // 1. Identify missing periods
    const missingPeriods = await identifyMissingPeriods(options);
    console.log(`Found ${missingPeriods.length} periods with missing data`);

    await updateJobStatus(jobId, {
      missingPeriods,
      status: "processing",
      totalPeriods: missingPeriods.length,
    });

    if (missingPeriods.length === 0) {
      await updateJobStatus(jobId, {
        status: "completed",
        progress: 100,
        completed: true,
        completedAt: new Date(),
        message: "No data gaps found that require backfilling",
      });
      return jobId;
    }

    // 2. Process each missing period
    for (let i = 0; i < missingPeriods.length; i++) {
      const period = missingPeriods[i];
      try {
        await backfillPeriod(
          period.stockId,
          period.symbol,
          period.startTime,
          period.endTime
        );

        // Update progress
        await updateJobStatus(jobId, {
          processedPeriods: i + 1,
          progress: Math.round(((i + 1) / missingPeriods.length) * 100),
        });
      } catch (periodError) {
        const errors = backfillJobs.get(jobId).errors || [];
        errors.push({
          symbol: period.symbol,
          startTime: period.startTime,
          endTime: period.endTime,
          error: periodError.message,
        });

        await updateJobStatus(jobId, {
          errors,
          processedPeriods: i + 1,
          progress: Math.round(((i + 1) / missingPeriods.length) * 100),
        });
      }

      // Add delay to respect API rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Mark job as completed
    await updateJobStatus(jobId, {
      status: "completed",
      completed: true,
      completedAt: new Date(),
    });

    console.log(`Backfill operation completed successfully (Job ID: ${jobId})`);
    return jobId;
  } catch (error) {
    console.error("Error during backfill operation:", error);

    await updateJobStatus(jobId, {
      status: "failed",
      error: error.message,
      completed: true,
      completedAt: new Date(),
    });

    throw error;
  }
}

/**
 * Get all active jobs
 * @returns {Array} Active jobs
 */
function getActiveJobs() {
  const activeJobs = [];
  for (const [id, job] of backfillJobs.entries()) {
    if (!job.completed) {
      activeJobs.push(job);
    }
  }
  return activeJobs;
}

/**
 * Schedule regular backfill checks
 * @param {number} intervalMinutes - Interval in minutes
 */
function scheduleBackfills(intervalMinutes = 60) {
  // Run initial backfill when service starts
  setTimeout(() => {
    performBackfill({ force: false }).catch((err) =>
      console.error("Initial backfill error:", err)
    );
  }, 10000); // Delay start by 10 seconds to let system initialize

  // Schedule regular checks
  const intervalMs = intervalMinutes * 60 * 1000;
  setInterval(() => {
    performBackfill({ force: false }).catch((err) =>
      console.error("Scheduled backfill error:", err)
    );
  }, intervalMs);

  console.log(`Scheduled backfill checks every ${intervalMinutes} minutes`);
}

/**
 * Expose for manual triggering via API
 * @param {Object} options - Backfill options
 * @returns {Promise<String>} Job ID
 */
async function triggerBackfill(options = {}) {
  try {
    return await performBackfill(options);
  } catch (error) {
    console.error("Error triggering backfill:", error);
    throw error;
  }
}

// Export public API
module.exports = {
  initializePool,
  setPool,
  scheduleBackfills,
  triggerBackfill,
  performBackfill,
  getBackfillStatus,
  getActiveJobs,
};
