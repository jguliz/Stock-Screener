// hooks/useStockPriceHistory.js
import { useState, useEffect } from "react";
import axios from "axios";

/**
 * Custom hook to fetch and manage stock price history data
 *
 * @param {number} stockId - The ID of the stock
 * @param {string} timeframe - The timeframe to fetch (5m, 15m, 1h, 1d, 1w, 1mo, 1y)
 * @returns {object} - { priceHistory, isLoading, error, setTimeframe, timeframe }
 */
function useStockPriceHistory(stockId, initialTimeframe = "1d") {
  const [priceHistory, setPriceHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState(initialTimeframe);

  // Calculate technical indicators when priceHistory changes
  const processedData = () => {
    if (!priceHistory || priceHistory.length === 0) return [];

    // Calculate moving averages and other indicators
    const calculateMovingAverage = (data, period) => {
      return data.map((item, index, array) => {
        if (index < period - 1) return { ...item, ma: null };

        const slice = array.slice(index - period + 1, index + 1);
        const sum = slice.reduce((acc, val) => acc + parseFloat(val.price), 0);
        const ma = sum / period;

        return { ...item, [`ma${period}`]: ma };
      });
    };

    // Add indicators to the data
    let processed = priceHistory.map((item, index, array) => {
      const prevItem = index > 0 ? array[index - 1] : item;
      const priceChange = parseFloat(item.price) - parseFloat(prevItem.price);
      const priceChangePercent = prevItem.price
        ? (priceChange / parseFloat(prevItem.price)) * 100
        : 0;

      return {
        ...item,
        price: parseFloat(item.price),
        volume: parseInt(item.volume) || 0,
        priceChange,
        priceChangePercent,
      };
    });

    // Add moving averages for different periods based on timeframe
    if (["1d", "1w", "1mo", "1y"].includes(timeframe)) {
      processed = calculateMovingAverage(processed, 10); // 10-day MA

      if (["1mo", "1y"].includes(timeframe)) {
        processed = calculateMovingAverage(processed, 30); // 30-day MA
      }

      if (timeframe === "1y") {
        processed = calculateMovingAverage(processed, 50); // 50-day MA
        processed = calculateMovingAverage(processed, 200); // 200-day MA
      }
    }

    return processed;
  };

  useEffect(() => {
    const fetchPriceHistory = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await axios.get(`/api/stocks/${stockId}/history`, {
          params: { timeframe },
        });

        if (response.data.history && response.data.history.length > 0) {
          setPriceHistory(response.data.history);
        } else {
          setPriceHistory([]);
          setError("No data available for the selected timeframe");
        }
      } catch (err) {
        console.error("Error fetching price history:", err);
        setError(
          err.response?.data?.message || "Failed to load price history data"
        );
        setPriceHistory([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (stockId) {
      fetchPriceHistory();
    }
  }, [stockId, timeframe]);

  return {
    priceHistory: processedData(),
    isLoading,
    error,
    setTimeframe,
    timeframe,
  };
}

export default useStockPriceHistory;
