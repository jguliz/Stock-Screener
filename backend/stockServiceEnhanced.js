/**
 * Enhanced Stock Service
 * Provides reliable stock data with multiple fallback sources,
 * caching, and error handling.
 */

// External dependencies
const axios = require("axios");
const NodeCache = require("node-cache");
const fs = require("fs");
const path = require("path");

// Internal dependencies
const polygonService = require("./services/polygonService");

// ===== CONFIGURATION =====
const CACHE_TTL = 300; // 5 minutes
const FALLBACK_DATA_PATH = path.join(__dirname, "fallback-stocks.json");
const DEFAULT_TIMEOUT = 5000; // 5 seconds
const MAX_RETRIES = 3;
const CONCURRENCY_LIMIT = 3;

const POLYGON_BASE_URL = "https://api.polygon.io";
const POLYGON_API_KEY = process.env.POLYGON_API_KEY

// Backoff strategy for retries
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff

// Default symbols to track
const DEFAULT_SYMBOLS = [
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "NVDA",
  "JPM",
  "V",
  "JNJ",
];

// Sector mapping for common symbols
const SECTOR_MAP = {
  AAPL: "Technology",
  MSFT: "Technology",
  AMZN: "Consumer Cyclical",
  GOOGL: "Technology",
  META: "Technology",
  TSLA: "Automotive",
  NVDA: "Technology",
  JPM: "Financial Services",
  V: "Financial Services",
  JNJ: "Healthcare",
};

// Initialize cache
const stockCache = new NodeCache({ stdTTL: CACHE_TTL });

// ===== CACHE & FALLBACK DATA MANAGEMENT =====

/**
 * Save stock data to disk for fallback use
 * @param {Array} stocks - Array of stock data objects
 * @returns {boolean} Success status
 */
function saveFallbackData(stocks) {
  if (!stocks || stocks.length === 0) return false;

  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(FALLBACK_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write data to file
    fs.writeFileSync(FALLBACK_DATA_PATH, JSON.stringify(stocks, null, 2));
    console.log(`Saved fallback data for ${stocks.length} stocks`);
    return true;
  } catch (error) {
    console.error("Error saving fallback data:", error);
    return false;
  }
}

/**
 * Load fallback stock data from disk
 * @returns {Array} Array of stock data objects
 */
function loadFallbackData() {
  try {
    if (fs.existsSync(FALLBACK_DATA_PATH)) {
      const data = fs.readFileSync(FALLBACK_DATA_PATH, "utf8");
      const stocks = JSON.parse(data);
      console.log(`Loaded fallback data for ${stocks.length} stocks`);
      return stocks;
    }
  } catch (error) {
    console.error("Error loading fallback data:", error);
  }
  return [];
}

// ===== HELPER FUNCTIONS =====

/**
 * Get sector for a stock symbol
 * @param {string} symbol - Stock symbol
 * @returns {string} Sector name
 */
function getSectorForSymbol(symbol) {
  return SECTOR_MAP[symbol] || "Unknown";
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Function to execute
 * @param {string} operationName - Name for logging
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise} Result of the function
 */
async function withRetry(fn, operationName, maxRetries = MAX_RETRIES) {
  let retries = 0;
  let lastError = null;

  while (retries <= maxRetries) {
    try {
      const result = await fn();
      if (retries > 0) {
        console.log(`${operationName} succeeded after ${retries} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;
      retries++;

      if (retries > maxRetries) {
        console.error(`${operationName} failed after ${maxRetries} retries`);
        break;
      }

      const delay =
        BACKOFF_DELAYS[Math.min(retries - 1, BACKOFF_DELAYS.length - 1)];
      console.log(
        `Retrying ${operationName} in ${delay}ms (${retries}/${maxRetries})`
      );
      await sleep(delay);
    }
  }

  throw lastError || new Error(`${operationName} failed with unknown error`);
}

/**
 * Create an abortable fetch with timeout
 * @param {Function} fetchFn - Function that performs the fetch
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Result of the fetch
 */
async function fetchWithTimeout(fetchFn, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await fetchFn(controller.signal);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ===== DATA FETCHING FUNCTIONS =====

/**
 * Get stock quote from Polygon API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Stock data
 */
async function fetchPolygonQuote(symbol) {
  try {
    const data = await polygonService.getStockQuote(symbol);
    return {
      ...data,
      sector: getSectorForSymbol(symbol),
      updated_at: new Date().toISOString(),
      source: "polygon",
    };
  } catch (error) {
    console.error(`Polygon API error for ${symbol}:`, error.message);
    throw new Error(`Polygon API error: ${error.message}`);
  }
}

/**
 * Get company details from Polygon API
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Company details
 */
async function fetchPolygonCompanyDetails(symbol) {
  try {
    return await polygonService.getCompanyDetails(symbol);
  } catch (error) {
    console.error(
      `Polygon API error fetching company details for ${symbol}:`,
      error.message
    );
    throw new Error(`Polygon company details error: ${error.message}`);
  }
}

/**
 * Get cached stock data
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Stock data
 */
async function getCachedQuote(symbol) {
  const cacheKey = `quote:${symbol}`;
  const cachedData = stockCache.get(cacheKey);

  if (cachedData) {
    // Check if cache is older than 1 minute and refresh in background if needed
    const now = Date.now();
    if (now - cachedData._timestamp > 60000) {
      // Refresh cache in the background
      getReliableStockData(symbol)
        .then((freshData) => {
          freshData._timestamp = Date.now();
          stockCache.set(cacheKey, freshData);
        })
        .catch((err) =>
          console.error(
            `Background cache refresh failed for ${symbol}:`,
            err.message
          )
        );
    }

    return { ...cachedData, source: "cache" };
  }

  throw new Error(`No cached data for ${symbol}`);
}

/**
 * Get last known data for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Stock data
 */
async function getLastKnownData(symbol) {
  // Try to get from persistent storage
  const fallbackData = loadFallbackData();
  const stockData = fallbackData.find((stock) => stock.symbol === symbol);

  if (stockData) {
    return { ...stockData, source: "historical" };
  }

  // If we don't have any previous data, return a basic placeholder
  return {
    symbol,
    name: `${symbol} (Data Unavailable)`,
    last_price: 0,
    change_amount: 0,
    change_percent: 0,
    volume: 0,
    market_cap: 0,
    sector: getSectorForSymbol(symbol),
    pe_ratio: 0,
    dividend_yield: 0,
    high_52week: 0,
    low_52week: 0,
    updated_at: new Date().toISOString(),
    dataStatus: "unavailable",
    source: "fallback",
  };
}

/**
 * Get historical price data for a stock
 * @param {string} symbol - Stock symbol
 * @param {string} timespan - Timespan (minute, hour, day, week, month, quarter, year)
 * @param {number} multiplier - Timespan multiplier (1, 2, 3, etc.)
 * @param {Date} from - Start date
 * @param {Date} to - End date
 * @returns {Promise<Object>} Historical price data
 * 
 */



function formatDateForPolygon(date) {
  // Check if date is valid before formatting
  if (!date || isNaN(new Date(date).getTime())) {
    // Use a default date or throw an error
    const today = new Date();
    // Go back 30 days for a default range
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    date = thirtyDaysAgo;
  }

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function getHistoricalData(
  symbol,
  timespan = "day",
  multiplier = 1,
  from = null,
  to = null
) {
  try {
    // Set default dates if not provided
    let fromFormatted, toFormatted;

    if (!from) {
      // Default to 30 days ago
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      fromFormatted = formatDateForAPI(fromDate);
    } else if (from instanceof Date) {
      fromFormatted = formatDateForAPI(from);
    } else {
      fromFormatted = from; // Assume it's already formatted correctly
    }

    if (!to) {
      // Default to today
      toFormatted = formatDateForAPI(new Date());
    } else if (to instanceof Date) {
      toFormatted = formatDateForAPI(to);
    } else {
      toFormatted = to; // Assume it's already formatted correctly
    }

    // Log the formatted dates for debugging
    console.log(`Formatted dates: from=${fromFormatted}, to=${toFormatted}`);

    const cacheKey = `history:${symbol}:${timespan}:${multiplier}:${fromFormatted}:${toFormatted}`;
    const cachedData = stockCache.get(cacheKey);

    if (cachedData) {
      console.log(`Using cached historical data for ${symbol}`);
      return { data: cachedData, source: "cache" };
    }

    // Validate timespan - must be one of the supported values
    if (
      !["minute", "hour", "day", "week", "month", "quarter", "year"].includes(
        timespan
      )
    ) {
      console.warn(`Invalid timespan: ${timespan}. Defaulting to 'day'`);
      timespan = "day";
    }

    // Construct the API URL with proper parameters
    const apiUrl = `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${fromFormatted}/${toFormatted}`;

    console.log(`Fetching historical data from Polygon: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
      params: {
        adjusted: true,
        sort: "asc",
        limit: 5000,
        apiKey: POLYGON_API_KEY,
      },
      timeout: 15000, // 15 second timeout
    });

    if (
      response.status === 200 &&
      response.data.results &&
      response.data.results.length > 0
    ) {
      const formattedData = response.data.results.map((item) => ({
        time: new Date(item.t).toISOString(),
        price: parseFloat(item.c),
        open: parseFloat(item.o),
        high: parseFloat(item.h),
        low: parseFloat(item.l),
        volume: parseInt(item.v) || 0,
      }));

      // Cache the results
      stockCache.set(cacheKey, formattedData);

      console.log(
        `Retrieved ${formattedData.length} historical data points for ${symbol}`
      );
      return { data: formattedData, source: "polygon" };
    } else {
      console.warn(`No historical data found for ${symbol}`);
      return { data: [], source: "polygon" };
    }
  } catch (error) {
    console.error(
      `Polygon historical data error for ${symbol}:`,
      error.message
    );

    // Handle common API errors and provide useful error messages
    if (error.response && error.response.data) {
      console.error("Polygon API Error:", error.response.data);
    }

    throw new Error(`Polygon historical data error: ${error.message}`);
  }
}

/**
 * Format date for API use
 * @param {Date} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format
 */
function formatDateForAPI(date) {
  // Ensure it's a Date object
  const d = new Date(date);

  // Check if the date is valid
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${date}`);
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ===== PUBLIC API METHODS =====

/**
 * Get reliable stock data with multiple fallbacks
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Stock data
 */
async function getReliableStockData(symbol) {
  // Define data sources in order of preference
  const dataSources = [
    { name: "cache", method: () => getCachedQuote(symbol) },
    { name: "polygon", method: () => fetchPolygonQuote(symbol) },
    { name: "historical", method: () => getLastKnownData(symbol) },
  ];

  // Try each source in order
  for (const source of dataSources) {
    try {
      const data = await source.method();

      // Cache successful non-cache results
      if (source.name !== "cache" && source.name !== "historical") {
        const cacheKey = `quote:${symbol}`;
        data._timestamp = Date.now();
        stockCache.set(cacheKey, data);
      }

      console.log(`Successfully retrieved ${symbol} data via ${source.name}`);
      return data;
    } catch (error) {
      console.error(
        `${source.name} attempt failed for ${symbol}:`,
        error.message
      );
      // Continue to next source
    }
  }

  // If we get here, all methods failed (shouldn't happen due to historical fallback)
  throw new Error(`All data sources failed for ${symbol}`);
}

/**
 * Get enriched stock data with company details
 * @param {string} symbol - Stock symbol
 * @returns {Promise<Object>} Enriched stock data
 */
async function getEnrichedStockData(symbol) {
  try {
    // Get base stock data
    const baseData = await getReliableStockData(symbol);

    // Try to enrich with additional data
    try {
      const companyDetails = await fetchPolygonCompanyDetails(symbol);

      return {
        ...baseData,
        companyDetails,
      };
    } catch (enrichError) {
      console.error(`Error enriching data for ${symbol}:`, enrichError.message);
      return baseData;
    }
  } catch (error) {
    console.error(`Failed to get enriched data for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get data for multiple stocks with concurrency control
 * @param {Array} symbols - Array of stock symbols
 * @param {number} concurrency - Maximum concurrent requests
 * @returns {Promise<Array>} Array of stock data
 */
async function getMultipleStocks(
  symbols = DEFAULT_SYMBOLS,
  concurrency = CONCURRENCY_LIMIT
) {
  // Use default symbols if none provided
  if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
    symbols = DEFAULT_SYMBOLS;
  }

  const results = [];
  const queue = [...symbols];
  const activePromises = new Map();
  let hasSuccessfulData = false;

  // Process queue with limited concurrency
  const processQueue = async () => {
    while (queue.length > 0 || activePromises.size > 0) {
      // Fill up to concurrency limit
      while (queue.length > 0 && activePromises.size < concurrency) {
        const symbol = queue.shift();
        const promise = getReliableStockData(symbol)
          .then((stockData) => {
            results.push(stockData);
            activePromises.delete(symbol);
            if (
              stockData.source !== "historical" &&
              stockData.source !== "fallback"
            ) {
              hasSuccessfulData = true;
            }
            return processQueue();
          })
          .catch((error) => {
            console.error(`Failed to get data for ${symbol}:`, error.message);
            activePromises.delete(symbol);
            return processQueue();
          });

        activePromises.set(symbol, promise);
      }

      // Wait for any promise to complete
      if (activePromises.size > 0) {
        await Promise.race(activePromises.values());
      }
    }
  };

  // Start processing
  await processQueue();

  // Add ID and sort results
  const processedResults = results
    .map((stock, index) => ({
      id: index + 1,
      ...stock,
      isFavorite: false,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  // Save to disk for future fallback if we have good data
  if (hasSuccessfulData) {
    saveFallbackData(processedResults);
  }

  return processedResults;
}

/**
 * Get default symbols to track
 * @returns {Array} Array of stock symbols
 */
function getDefaultSymbols() {
  return [...DEFAULT_SYMBOLS];
}

// Export public API
module.exports = {
  getHistoricalData,
  getCachedQuote,
  getReliableStockData,
  getEnrichedStockData,
  getMultipleStocks,
  loadFallbackData,
  saveFallbackData,
  getDefaultSymbols,
};