// frontend/src/components/Dashboard/StockList.js
import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Heart,
  Bell,
  RefreshCw,
  Eye,
} from "lucide-react";
import { useStock } from "../../context/StockContext";
import MiniStockChart from "./MiniStockChart";
import Button from "../UI/Button";

const StockList = ({
  stocks = [],
  onStockSelect,
  onAlertClick,
  onFavoriteClick,
}) => {
  const { getStockHistory } = useStock();
  const [stockCharts, setStockCharts] = useState({});
  const [loadingCharts, setLoadingCharts] = useState({});
  const [visibleCharts, setVisibleCharts] = useState({});

  // Helper function to sample data to reduce points for mini charts
  const sampleData = (data, maxPoints) => {
    if (!data || data.length <= maxPoints) return data;

    const result = [];
    const step = Math.floor(data.length / maxPoints);

    for (let i = 0; i < data.length; i += step) {
      result.push(data[i]);
      if (result.length >= maxPoints) break;
    }

    // Always include the last point
    if (
      result.length > 0 &&
      result[result.length - 1] !== data[data.length - 1]
    ) {
      result.push(data[data.length - 1]);
    }

    return result;
  };

  // Load mini chart data for visible stocks on initial load
  useEffect(() => {
    const loadInitialCharts = async () => {
      // Limit to loading first 5 stocks initially to avoid too many requests
      const initialStocks = stocks.slice(0, 5);

      for (const stock of initialStocks) {
        if (stockCharts[stock.id]) continue;

        try {
          setLoadingCharts((prev) => ({ ...prev, [stock.id]: true }));
          const history = await getStockHistory(stock.id, "1H");

          // Store only a small amount of data points for the mini chart
          const sampledData = sampleData(history, 20);

          setStockCharts((prev) => ({
            ...prev,
            [stock.id]: sampledData,
          }));

          // Mark chart as visible
          setVisibleCharts((prev) => ({
            ...prev,
            [stock.id]: true,
          }));
        } catch (err) {
          console.error(`Failed to load chart for ${stock.symbol}:`, err);
        } finally {
          setLoadingCharts((prev) => ({ ...prev, [stock.id]: false }));
        }
      }
    };

    if (stocks.length > 0) {
      loadInitialCharts();
    }
  }, [stocks, getStockHistory, stockCharts]);

  // Handle loading chart data for a specific stock
  const handleLoadChart = async (stockId) => {
    if (loadingCharts[stockId] || stockCharts[stockId]) return;

    const stock = stocks.find((s) => s.id === stockId);
    if (!stock) return;

    setLoadingCharts((prev) => ({ ...prev, [stockId]: true }));

    try {
      const history = await getStockHistory(stockId, "1H");
      const sampledData = sampleData(history, 20);

      setStockCharts((prev) => ({
        ...prev,
        [stockId]: sampledData,
      }));

      // Mark chart as visible
      setVisibleCharts((prev) => ({
        ...prev,
        [stockId]: true,
      }));
    } catch (err) {
      console.error(`Failed to load chart for ${stock.symbol}:`, err);
    } finally {
      setLoadingCharts((prev) => ({ ...prev, [stockId]: false }));
    }
  };

  // Toggle chart visibility
  const toggleChartVisibility = (stockId) => {
    if (!stockCharts[stockId] && !loadingCharts[stockId]) {
      // If chart isn't loaded yet, load it
      handleLoadChart(stockId);
    } else {
      // Otherwise toggle visibility
      setVisibleCharts((prev) => ({
        ...prev,
        [stockId]: !prev[stockId],
      }));
    }
  };

  if (stocks.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500 dark:text-gray-400">
        No stocks found. Try adjusting your filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-dark-200">
          <tr>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Symbol
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Name
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Price
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Change
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Chart
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Volume
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Sector
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="bg-white dark:bg-dark-100 divide-y divide-gray-200 dark:divide-gray-700">
          {stocks.map((stock) => (
            <tr
              key={stock.id}
              className="hover:bg-gray-50 dark:hover:bg-dark-200 transition-colors"
            >
              <td
                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                onClick={() => onStockSelect(stock)}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {stock.symbol}
                </div>
              </td>
              <td
                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                onClick={() => onStockSelect(stock)}
              >
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {stock.name}
                </div>
              </td>
              <td
                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                onClick={() => onStockSelect(stock)}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  $
                  {typeof stock.last_price === "number"
                    ? stock.last_price.toFixed(2)
                    : parseFloat(stock.last_price).toFixed(2)}
                </div>
              </td>
              <td
                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                onClick={() => onStockSelect(stock)}
              >
                <div
                  className={`text-sm inline-flex items-center ${
                    stock.change_percent >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {stock.change_percent >= 0 ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {stock.change_amount.toFixed(2)} (
                  {stock.change_percent.toFixed(2)}%)
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {loadingCharts[stock.id] ? (
                  <div className="h-10 w-24 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center">
                    <RefreshCw className="h-4 w-4 text-gray-400 dark:text-gray-600 animate-spin" />
                  </div>
                ) : stockCharts[stock.id] && visibleCharts[stock.id] ? (
                  <div className="flex items-center">
                    <MiniStockChart
                      data={stockCharts[stock.id]}
                      priceChange={stock.change_percent}
                      height={40}
                      width={100}
                    />
                    <button
                      className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      onClick={() => toggleChartVisibility(stock.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                ) : stockCharts[stock.id] ? (
                  <button
                    className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded"
                    onClick={() => toggleChartVisibility(stock.id)}
                  >
                    Show Chart
                  </button>
                ) : (
                  <button
                    className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-700 rounded flex items-center"
                    onClick={() => handleLoadChart(stock.id)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Load Chart
                  </button>
                )}
              </td>
              <td
                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                onClick={() => onStockSelect(stock)}
              >
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {stock.volume.toLocaleString()}
                </div>
              </td>
              <td
                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                onClick={() => onStockSelect(stock)}
              >
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900 dark:bg-opacity-50 text-indigo-800 dark:text-indigo-200">
                  {stock.sector}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button
                  onClick={(e) => onFavoriteClick(stock.id, e)}
                  className={`text-gray-400 hover:text-yellow-500 mr-3 ${
                    stock.isFavorite ? "text-yellow-500" : ""
                  }`}
                  title={
                    stock.isFavorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                >
                  <Heart
                    className="h-5 w-5"
                    fill={stock.isFavorite ? "currentColor" : "none"}
                  />
                </button>
                <button
                  onClick={(e) => onAlertClick(stock, e)}
                  className="text-gray-400 hover:text-indigo-500"
                  title="Set price alert"
                >
                  <Bell className="h-5 w-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockList;
