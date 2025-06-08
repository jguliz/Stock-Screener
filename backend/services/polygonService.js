const axios = require("axios");
const NodeCache = require("node-cache");

class PolygonDataService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = "https://api.polygon.io";
    this.cache = new NodeCache({
      stdTTL: 3600, // 1-hour cache for less volatile data
      checkperiod: 3720,
    });
  }

  /**
   * Make an API request with simplified error handling
   */
  async makeRequest(endpoint, params = {}, timeoutMs = 10000) {
    // Generate cache key
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cachedResponse = this.cache.get(cacheKey);

    // Return cached response if available
    if (cachedResponse) {
      return cachedResponse;
    }

    // Check if API key is available
    if (!this.apiKey) {
      throw new Error(
        "Polygon API key not configured. Set POLYGON_API_KEY in .env file."
      );
    }

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params: {
          ...params,
          apiKey: this.apiKey,
        },
        timeout: timeoutMs,
      });

      // Cache successful response
      this.cache.set(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error(
        `Polygon API Error (${endpoint}):`,
        error.response ? error.response.data : error.message
      );
      throw error;
    }
  }

    /* Get real-time stock quote
   */
  async getStockQuote(symbol) {
    try {
      const data = await this.makeRequest(`/v2/aggs/ticker/${symbol}/prev`, {
        unadjusted: false,
      });
      return {
        symbol: data.ticker,
        last_price: data.results[0].c,
        change_amount: data.results[0].c - data.results[0].o,
        change_percent: ((data.results[0].c - data.results[0].o) / data.results[0].o) * 100,
        volume: data.results[0].v,
      };
    } catch (error) {
      console.error(`Error fetching stock quote for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get company details
   */
  async getCompanyDetails(symbol) {
    try {
      const data = await this.makeRequest(`/v3/reference/tickers/${symbol}`);
      return {
        name: data.results.name,
        sector: data.results.sic_description,
        marketCap: data.results.market_cap,
      };
    } catch (error) {
      console.error(`Error fetching company details for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalData(symbol, from, to, timespan = "day") {
    try {
      const data = await this.makeRequest(`/v2/aggs/ticker/${symbol}/range/1/${timespan}/${from}/${to}`, {
        unadjusted: false,
        sort: "asc",
        limit: 5000,
      });
      return data.results.map((item) => ({
        date: item.t,
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v,
      }));
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Consolidated “reliable” data for polling collector
   */
  async getReliableStockData(symbol) {
    // real‐time quote + company details
    const quote   = await this.getStockQuote(symbol);
    const details = await this.getCompanyDetails(symbol);    
    return {
      symbol,
      name:           details.name,
      sector:         details.sector,
      last_price:     quote.last_price,
     change_amount:  quote.change_amount,
      change_percent: quote.change_percent,
      volume:         quote.volume,
      market_cap:     details.marketCap,

      // stub out the rest so your collector’s calls won’t blow up
 pe_ratio:       0,
 dividend_yield: 0,
 high_52week:    0,
 low_52week:     0,
 open_price:     quote.last_price,
 high_price:     quote.last_price,
 low_price:      quote.last_price,
 vwap:           quote.last_price,
    };
  }
  // stubbed out so your collector’s fundamentals/ratios/tech‐indicator code is safe
  async getCompanyFinancials(symbol) { return null; }
  async getStockRatios(symbol)       { return null; }
  async getTechnicalIndicators(symbol){ return null; }
 }
// Create instance with API key from environment variables
const polygonService = new PolygonDataService(process.env.POLYGON_API_KEY);

// Export the service instance
module.exports = polygonService;
