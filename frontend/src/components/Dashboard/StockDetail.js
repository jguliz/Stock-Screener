// frontend/src/components/Dashboard/StockDetail.js
import React, { useState, useEffect, useCallback } from "react";
import { X, Heart, Bell, AlertTriangle } from "lucide-react";
import { useStock } from "../../context/StockContext";
import Modal from "../UI/Modal";
import Button from "../UI/Button";
import StockChart from "./StockChart";
import Card from "../UI/Card";

const StockDetail = ({ stock, onClose }) => {
  const { getStockHistory, toggleFavorite } = useStock();

  const [timeframe, setTimeframe] = useState("1H");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Ensure stock has all required properties with fallbacks
  const safeStock = {
    ...stock,
    id: stock.id || 0,
    symbol: stock.symbol || "UNKNOWN",
    name: stock.name || "Unknown Stock",
    sector: stock.sector || "N/A",
    last_price: parseFloat(stock.last_price || 0),
    change_amount: parseFloat(stock.change_amount || 0),
    change_percent: parseFloat(stock.change_percent || 0),
    volume: parseInt(stock.volume || 0, 10),
    market_cap: parseInt(stock.market_cap || 0, 10),
    pe_ratio: parseFloat(stock.pe_ratio || 0),
    dividend_yield: parseFloat(stock.dividend_yield || 0),
    high_52week: parseFloat(stock.high_52week || 0),
    low_52week: parseFloat(stock.low_52week || 0),
    updated_at: stock.updated_at || new Date().toISOString(),
    isFavorite: !!stock.isFavorite,
  };

  // Create a memoized fetchHistory function so we can call it from the refresh button
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const history = await getStockHistory(safeStock.id, timeframe);

      // Validate data before setting it
      if (!history || history.length === 0) {
        throw new Error("No chart data available for this timeframe");
      }

      // Ensure all data points have numeric prices
      const validatedHistory = history.map((point) => ({
        ...point,
        price:
          typeof point.price === "string"
            ? parseFloat(point.price)
            : point.price,
        volume:
          typeof point.volume === "string"
            ? parseInt(point.volume)
            : point.volume || 0,
      }));

      // Sort by time if needed
      validatedHistory.sort((a, b) => {
        if (
          typeof a.time === "string" &&
          a.time.includes(":") &&
          typeof b.time === "string" &&
          b.time.includes(":")
        ) {
          const timeA = new Date(`1970/01/01 ${a.time}`);
          const timeB = new Date(`1970/01/01 ${b.time}`);
          return timeA - timeB;
        }
        return new Date(a.time) - new Date(b.time);
      });

      setChartData(validatedHistory);
    } catch (err) {
      console.error("Error fetching stock history:", err);
      setError(err.message || "Failed to load chart data");

      // Set empty array to avoid issues with the chart component
      setChartData([]);
    } finally {
      setLoading(false);
    }
  }, [safeStock.id, timeframe, getStockHistory]);

  // Fetch stock history when component mounts or timeframe changes
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory, timeframe]);

  // Handle favorite toggle
  const handleFavoriteToggle = () => {
    toggleFavorite(safeStock.id);
  };

  // Format large numbers
  const formatLargeNumber = (num) => {
    if (num >= 1000000000000) {
      return `$${(num / 1000000000000).toFixed(2)}T`;
    } else if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else {
      return `$${num.toLocaleString()}`;
    }
  };

  // Get current time formatted
  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      size="extraLarge"
      title={`${safeStock.symbol} - ${safeStock.name}`}
    >
      <div className="space-y-6">
        {/* Price and action buttons */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                ${safeStock.last_price.toFixed(2)}
              </div>
              <div
                className={`ml-3 ${
                  safeStock.change_percent >= 0
                    ? "text-success-light dark:text-green-400"
                    : "text-danger-light dark:text-red-400"
                }`}
              >
                {safeStock.change_amount.toFixed(2)} (
                {safeStock.change_percent.toFixed(2)}%)
              </div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Volume: {safeStock.volume.toLocaleString()}
            </div>
          </div>

          <div className="flex space-x-2">
            <Button
              variant={safeStock.isFavorite ? "primary" : "outline"}
              className={safeStock.isFavorite ? "" : ""}
              onClick={handleFavoriteToggle}
              icon={
                <Heart
                  className="h-5 w-5"
                  fill={safeStock.isFavorite ? "currentColor" : "none"}
                />
              }
            >
              {safeStock.isFavorite
                ? "Remove from Favorites"
                : "Add to Favorites"}
            </Button>

            <Button variant="outline" icon={<Bell className="h-5 w-5" />}>
              Set Alert
            </Button>
          </div>
        </div>

        {/* Stock chart */}
        <Card>
          {error ? (
            <div className="bg-red-100 dark:bg-red-900 dark:bg-opacity-20 p-4 mb-4 rounded-md flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-red-800 dark:text-red-300">
                  Chart Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
          ) : null}

          <StockChart
            data={chartData}
            loading={loading}
            error={error}
            onRefresh={fetchHistory}
            stockSymbol={safeStock.symbol}
            priceChange={safeStock.change_percent}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
        </Card>

        {/* Stock details - Two column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Company Info */}
          <Card title="Company Info">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Sector</span>
                <span className="text-gray-900 dark:text-white">
                  {safeStock.sector}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Market Cap
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatLargeNumber(safeStock.market_cap)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  P/E Ratio
                </span>
                <span className="text-gray-900 dark:text-white">
                  {safeStock.pe_ratio > 0
                    ? safeStock.pe_ratio.toFixed(2)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Dividend Yield
                </span>
                <span className="text-gray-900 dark:text-white">
                  {safeStock.dividend_yield > 0
                    ? `${safeStock.dividend_yield.toFixed(2)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          </Card>

          {/* Price Stats */}
          <Card title="Price Stats">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  52-Week High
                </span>
                <span className="text-gray-900 dark:text-white">
                  $
                  {safeStock.high_52week > 0
                    ? safeStock.high_52week.toFixed(2)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  52-Week Low
                </span>
                <span className="text-gray-900 dark:text-white">
                  $
                  {safeStock.low_52week > 0
                    ? safeStock.low_52week.toFixed(2)
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Daily Range
                </span>
                <span className="text-gray-900 dark:text-white">
                  ${(safeStock.last_price - safeStock.change_amount).toFixed(2)}{" "}
                  - ${safeStock.last_price.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Last Updated
                </span>
                <span className="text-gray-900 dark:text-white">
                  {getCurrentTime()}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Trading Actions */}
        <Card title="Trading Actions">
          <div className="grid grid-cols-2 gap-4">
            <Button variant="primary" fullWidth>
              Buy {safeStock.symbol}
            </Button>
            <Button variant="outline" fullWidth>
              Sell {safeStock.symbol}
            </Button>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default StockDetail;
