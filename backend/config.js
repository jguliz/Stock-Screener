require("dotenv").config();

module.exports = {
  tickers: process.env.TICKERS
    ? process.env.TICKERS.split(",").map((s) => s.trim().toUpperCase())
    : [
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
        "AMD",
        "INTC",
        "CRM",
        "NFLX",
        "PYPL",
      ],
};
