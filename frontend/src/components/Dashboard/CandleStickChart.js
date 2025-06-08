import React, { useState, useEffect } from "react";
import {
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Line,
  Bar,
  ReferenceLine,
} from "recharts";

const formatTimeframe = (timeframe) => {
  switch (timeframe) {
    case "5m":
      return "5 Minutes";
    case "15m":
      return "15 Minutes";
    case "1h":
      return "1 Hour";
    case "1d":
      return "1 Day";
    case "1w":
      return "1 Week";
    case "1mo":
      return "1 Month";
    case "1y":
      return "1 Year";
    default:
      return timeframe;
  }
};

const CandlestickChart = ({ stockId, stockSymbol }) => {
  const [ohlcData, setOhlcData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeframe, setTimeframe] = useState("1d");
  const [showSMA, setShowSMA] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [error, setError] = useState(null);

  // Process data to create OHLC format
  const processOhlcData = (timeseriesData) => {
    if (!timeseriesData || timeseriesData.length < 2) return [];

    // For candlestick charts, we need to group the data into OHLC bars
    // The grouping depends on the timeframe
    let groupingInterval;

    switch (timeframe) {
      case "5m":
        groupingInterval = 5 * 60 * 1000;
        break; // 5 minutes in ms
      case "15m":
        groupingInterval = 15 * 60 * 1000;
        break; // 15 minutes
      case "1h":
        groupingInterval = 60 * 60 * 1000;
        break; // 1 hour
      case "1d":
        groupingInterval = 24 * 60 * 60 * 1000;
        break; // 1 day
      case "1w":
        groupingInterval = 7 * 24 * 60 * 60 * 1000;
        break; // 1 week
      case "1mo":
        groupingInterval = 30 * 24 * 60 * 60 * 1000;
        break; // ~1 month
      default:
        groupingInterval = 24 * 60 * 60 * 1000; // default to 1 day
    }

    // Group the data
    const groups = {};

    timeseriesData.forEach((dataPoint) => {
      const timestamp = new Date(dataPoint.time).getTime();
      const groupId =
        Math.floor(timestamp / groupingInterval) * groupingInterval;

      if (!groups[groupId]) {
        groups[groupId] = {
          time: new Date(groupId).toISOString(),
          prices: [],
          volumes: [],
        };
      }

      groups[groupId].prices.push(parseFloat(dataPoint.price));
      groups[groupId].volumes.push(parseInt(dataPoint.volume) || 0);
    });

    // Convert groups to OHLC format
    return Object.values(groups)
      .map((group) => {
        const prices = group.prices;

        return {
          time: group.time,
          open: prices[0],
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: prices[prices.length - 1],
          volume: group.volumes.reduce((sum, vol) => sum + vol, 0),
          // Calculate if bar is up or down
          isUp: prices[prices.length - 1] >= prices[0],
        };
      })
      .sort((a, b) => new Date(a.time) - new Date(b.time));
  };

  // Fetch data when timeframe changes
  useEffect(() => {
    const fetchOhlcData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Determine interval based on timeframe
        let interval = "1m";
        if (["1mo", "1y"].includes(timeframe)) {
          interval = "1d";
        } else if (timeframe === "1w") {
          interval = "1h";
        }

        // Mock API call to /api/stocks/:id/history
        // In a real application, use fetch or another HTTP client
        // For this example, we'll simulate a response with mock data
        setTimeout(() => {
          const mockHistory = generateMockData(timeframe);
          const processedData = processOhlcData(mockHistory);

          // Calculate simple moving averages
          if (processedData.length > 0) {
            // 20-period SMA
            processedData.forEach((dataPoint, index, array) => {
              if (index >= 19) {
                const last20 = array.slice(index - 19, index + 1);
                const sma20 =
                  last20.reduce((sum, dp) => sum + dp.close, 0) / 20;
                dataPoint.sma20 = sma20;
              }

              // 50-period SMA
              if (index >= 49) {
                const last50 = array.slice(index - 49, index + 1);
                const sma50 =
                  last50.reduce((sum, dp) => sum + dp.close, 0) / 50;
                dataPoint.sma50 = sma50;
              }
            });
          }

          setOhlcData(processedData);
          setIsLoading(false);
        }, 800); // Simulate loading delay
      } catch (err) {
        console.error("Error fetching OHLC data:", err);
        setError("Failed to load OHLC data");
        setIsLoading(false);
      }
    };

    fetchOhlcData();
  }, [stockId, timeframe]);

  // Generate mock price history data
  const generateMockData = (timeframe) => {
    const mockData = [];
    const now = new Date();
    let basePrice = 150; // For example, starting price
    let volatility;

    // Set number of data points and volatility based on timeframe
    let dataPoints;
    switch (timeframe) {
      case "5m":
        dataPoints = 30;
        volatility = 0.001;
        break;
      case "15m":
        dataPoints = 40;
        volatility = 0.002;
        break;
      case "1h":
        dataPoints = 48;
        volatility = 0.004;
        break;
      case "1d":
        dataPoints = 100;
        volatility = 0.008;
        break;
      case "1w":
        dataPoints = 140;
        volatility = 0.012;
        break;
      case "1mo":
        dataPoints = 180;
        volatility = 0.02;
        break;
      case "1y":
        dataPoints = 250;
        volatility = 0.03;
        break;
      default:
        dataPoints = 100;
        volatility = 0.008;
    }

    // Determine time increment based on timeframe
    let timeIncrement;
    switch (timeframe) {
      case "5m":
        timeIncrement = 10 * 1000;
        break; // 10 seconds
      case "15m":
        timeIncrement = 30 * 1000;
        break; // 30 seconds
      case "1h":
        timeIncrement = 75 * 1000;
        break; // 1.25 minutes
      case "1d":
        timeIncrement = 15 * 60 * 1000;
        break; // 15 minutes
      case "1w":
        timeIncrement = 2 * 60 * 60 * 1000;
        break; // 2 hours
      case "1mo":
        timeIncrement = 4 * 60 * 60 * 1000;
        break; // 4 hours
      case "1y":
        timeIncrement = 35 * 60 * 60 * 1000;
        break; // 35 hours (~1.5 days)
      default:
        timeIncrement = 15 * 60 * 1000; // 15 minutes
    }

    // Generate prices with a random walk
    let lastPrice = basePrice;
    let trend = 0;

    for (let i = 0; i < dataPoints; i++) {
      // Calculate time for this data point
      const time = new Date(now.getTime() - (dataPoints - i) * timeIncrement);

      // Add small random changes with momentum
      const randomChange = (Math.random() - 0.5) * volatility * basePrice;
      const momentum = 0.7; // How much previous trend affects current price

      // Update trend with some mean reversion
      trend = trend * momentum + randomChange;

      // Add slight mean reversion
      const meanReversion = (basePrice - lastPrice) * 0.01;

      // Calculate new price
      lastPrice = lastPrice + trend + meanReversion;

      // Ensure price doesn't go negative
      if (lastPrice <= 0) lastPrice = 0.01;

      // Calculate mock volume
      const volume = Math.floor(
        50000 +
          Math.random() *
            200000 *
            (1 + Math.abs(trend) / (volatility * basePrice))
      );

      mockData.push({
        time: time.toISOString(),
        price: lastPrice.toFixed(2),
        volume,
      });
    }

    return mockData;
  };

  // Format time based on timeframe
  const formatXAxis = (time) => {
    const date = new Date(time);

    if (["5m", "15m", "1h"].includes(timeframe)) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (["1d", "1w"].includes(timeframe)) {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  // Calculate price range for chart
  const calculatePriceRange = () => {
    if (ohlcData.length === 0) return [0, 1];

    const allPrices = ohlcData.flatMap((d) => [d.high, d.low]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const padding = (maxPrice - minPrice) * 0.1;

    return [minPrice - padding, maxPrice + padding];
  };

  return (
    <div className="candlestick-chart-container">
      <div className="chart-header">
        <div className="title-section">
          <h3>{stockSymbol} Price Chart</h3>
          <div className="timeframe-label">{formatTimeframe(timeframe)}</div>
        </div>

        {/* Timeframe selector */}
        <div className="timeframe-selector">
          <button
            className={timeframe === "5m" ? "active" : ""}
            onClick={() => setTimeframe("5m")}
          >
            5m
          </button>
          <button
            className={timeframe === "15m" ? "active" : ""}
            onClick={() => setTimeframe("15m")}
          >
            15m
          </button>
          <button
            className={timeframe === "1h" ? "active" : ""}
            onClick={() => setTimeframe("1h")}
          >
            1h
          </button>
          <button
            className={timeframe === "1d" ? "active" : ""}
            onClick={() => setTimeframe("1d")}
          >
            1D
          </button>
          <button
            className={timeframe === "1w" ? "active" : ""}
            onClick={() => setTimeframe("1w")}
          >
            1W
          </button>
          <button
            className={timeframe === "1mo" ? "active" : ""}
            onClick={() => setTimeframe("1mo")}
          >
            1M
          </button>
          <button
            className={timeframe === "1y" ? "active" : ""}
            onClick={() => setTimeframe("1y")}
          >
            1Y
          </button>
        </div>

        {/* Chart options */}
        <div className="chart-options">
          <label>
            <input
              type="checkbox"
              checked={showSMA}
              onChange={() => setShowSMA(!showSMA)}
            />
            SMA
          </label>
          <label>
            <input
              type="checkbox"
              checked={showVolume}
              onChange={() => setShowVolume(!showVolume)}
            />
            Volume
          </label>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-indicator">Loading chart data...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : ohlcData.length === 0 ? (
        <div className="no-data-message">No price data available</div>
      ) : (
        <div className="chart-container">
          {/* Main price chart */}
          <ResponsiveContainer width="100%" height={showVolume ? 400 : 500}>
            <ComposedChart data={ohlcData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={formatXAxis}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={calculatePriceRange()}
                tickFormatter={(value) => `${value.toFixed(2)}`}
                tick={{ fontSize: 12 }}
                orientation="right"
              />
              <Tooltip
                formatter={(value, name) => {
                  if (["open", "high", "low", "close"].includes(name)) {
                    return [
                      `${parseFloat(value).toFixed(2)}`,
                      name.charAt(0).toUpperCase() + name.slice(1),
                    ];
                  }
                  if (name === "sma20")
                    return [`${parseFloat(value).toFixed(2)}`, "20 SMA"];
                  if (name === "sma50")
                    return [`${parseFloat(value).toFixed(2)}`, "50 SMA"];
                  return [value, name];
                }}
                labelFormatter={(label) => new Date(label).toLocaleString()}
              />
              <Legend />

              {/* Custom rendering for OHLC bars */}
              {ohlcData.map((entry, index) => {
                // Only render a fraction of bars for performance
                if (
                  ohlcData.length > 50 &&
                  index % Math.ceil(ohlcData.length / 50) !== 0
                )
                  return null;

                const isUp = entry.close >= entry.open;
                const barColor = isUp ? "#4CAF50" : "#F44336"; // Green for up, red for down

                return (
                  <Bar
                    key={`bar-${index}`}
                    dataKey="high"
                    fill={barColor}
                    stroke={barColor}
                    name="Price"
                  />
                );
              })}

              {/* Moving Averages */}
              {showSMA && (
                <>
                  <Line
                    type="monotone"
                    dataKey="sma20"
                    stroke="#FF9800"
                    dot={false}
                    name="20 SMA"
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="sma50"
                    stroke="#2196F3"
                    dot={false}
                    name="50 SMA"
                    strokeWidth={1.5}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Volume chart */}
          {showVolume && (
            <ResponsiveContainer width="100%" height={100}>
              <ComposedChart data={ohlcData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="time"
                  tickFormatter={formatXAxis}
                  tick={{ fontSize: 10 }}
                  height={20}
                />
                <YAxis
                  tickFormatter={(value) =>
                    value >= 1000000
                      ? `${(value / 1000000).toFixed(1)}M`
                      : value >= 1000
                      ? `${(value / 1000).toFixed(1)}K`
                      : value
                  }
                  tick={{ fontSize: 10 }}
                  orientation="right"
                  width={60}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "volume")
                      return [value.toLocaleString(), "Volume"];
                    return [value, name];
                  }}
                  labelFormatter={(label) => new Date(label).toLocaleString()}
                />
                <Bar
                  dataKey="volume"
                  fill={(entry) => (entry.isUp ? "#4CAF50" : "#F44336")}
                  name="Volume"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Price statistics */}
      {ohlcData.length > 0 && (
        <div className="price-stats">
          <div className="stat">
            <span className="label">O:</span>
            <span className="value">
              ${ohlcData[ohlcData.length - 1].open.toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="label">H:</span>
            <span className="value">
              ${ohlcData[ohlcData.length - 1].high.toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="label">L:</span>
            <span className="value">
              ${ohlcData[ohlcData.length - 1].low.toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="label">C:</span>
            <span className="value">
              ${ohlcData[ohlcData.length - 1].close.toFixed(2)}
            </span>
          </div>
          <div className="stat">
            <span className="label">Change:</span>
            <span
              className={`value ${
                ohlcData[ohlcData.length - 1].isUp ? "positive" : "negative"
              }`}
            >
              {(
                ((ohlcData[ohlcData.length - 1].close -
                  ohlcData[ohlcData.length - 1].open) /
                  ohlcData[ohlcData.length - 1].open) *
                100
              ).toFixed(2)}
              %
            </span>
          </div>
        </div>
      )}

      <style jsx>{`
        .candlestick-chart-container {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          padding: 16px;
          margin-bottom: 24px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .title-section {
          display: flex;
          flex-direction: column;
        }

        .title-section h3 {
          margin: 0;
          font-size: 16px;
        }

        .timeframe-label {
          font-size: 12px;
          color: #666;
        }

        .timeframe-selector {
          display: flex;
          gap: 4px;
        }

        .timeframe-selector button {
          padding: 6px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .timeframe-selector button.active {
          background: #8884d8;
          color: white;
          border-color: #8884d8;
        }

        .chart-options {
          display: flex;
          gap: 12px;
          font-size: 12px;
        }

        .chart-options label {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .loading-indicator,
        .error-message,
        .no-data-message {
          height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #666;
        }

        .chart-container {
          margin-top: 8px;
        }

        .price-stats {
          display: flex;
          gap: 16px;
          margin-top: 16px;
          font-size: 12px;
          border-top: 1px solid #eee;
          padding-top: 16px;
        }

        .stat {
          display: flex;
          gap: 4px;
        }

        .label {
          font-weight: 500;
          color: #666;
        }

        .value {
          font-family: monospace;
        }

        .positive {
          color: #4caf50;
        }

        .negative {
          color: #f44336;
        }
      `}</style>
    </div>
  );
};

export default CandlestickChart;
