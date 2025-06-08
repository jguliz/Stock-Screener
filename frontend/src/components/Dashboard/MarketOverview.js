// frontend/src/components/Dashboard/MarketOverview.js
import React, { useEffect, useState } from "react";
import { useStock } from "../../context/StockContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  BarChart2,
  RefreshCw,
  PieChart as PieChartIcon,
  Clock,
} from "lucide-react";
import Card from "../UI/Card";
import Button from "../UI/Button";
import { useTheme } from "../../context/ThemeContext";

const MarketOverview = () => {
  const { marketOverview, fetchMarketOverview, loading } = useStock();
  const { isDarkMode } = useTheme();
  const [viewType, setViewType] = useState("standard"); // 'standard', 'detailed', 'minimal'

  // Format large numbers (billions, trillions)
  const formatLargeNumber = (num) => {
    if (!num) return "N/A";

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

  // Format percentage
  const formatPercent = (num) => {
    if (num === null || num === undefined) return "N/A";
    return `${num > 0 ? "+" : ""}${num.toFixed(2)}%`;
  };

  // Manual refresh
  const handleRefresh = () => {
    fetchMarketOverview();
  };

  // Get theme colors for charts
  const getChartColors = () => {
    return {
      gridColor: isDarkMode ? "#374151" : "#E5E7EB",
      positiveColor: "#10B981", // success-light
      negativeColor: "#EF4444", // danger-light
      textColor: isDarkMode ? "#9CA3AF" : "#6B7280",
      areaPositiveColor: "rgba(16, 185, 129, 0.2)", // success-light with alpha
      areaNegativeColor: "rgba(239, 68, 68, 0.2)", // danger-light with alpha
    };
  };

  const colors = getChartColors();

  // Colors for the pie chart
  const COLORS = [colors.positiveColor, colors.negativeColor, "#6B7280"];

  // Prepare data for pie chart
  const getPieChartData = () => {
    if (!marketOverview || !marketOverview.marketStats) return [];

    const { gainers, losers, unchanged } = marketOverview.marketStats;

    return [
      { name: "Gainers", value: gainers || 0 },
      { name: "Losers", value: losers || 0 },
      { name: "Unchanged", value: unchanged || 0 },
    ];
  };

  // Mock index chart data
  const getMarketIndexData = () => {
    if (!marketOverview) return [];

    // Create 30 data points with slight randomization based on market trend
    const points = [];
    const baseValue = 100;
    const trend =
      marketOverview.marketStats.avg_change_percent > 0 ? 0.2 : -0.2;
    let currentValue = baseValue;

    for (let i = 0; i < 30; i++) {
      currentValue =
        currentValue + trend * Math.random() + (Math.random() - 0.5) * 0.3;
      points.push({
        time: i,
        value: currentValue,
      });
    }

    return points;
  };

  // Generate time series for index chart
  const indexData = getMarketIndexData();
  const pieData = getPieChartData();

  // Last update time
  const getLastUpdateTime = () => {
    if (!marketOverview) return "Never";
    return new Date(marketOverview.updatedAt).toLocaleTimeString();
  };

  // Toggle view type
  const toggleViewType = () => {
    if (viewType === "standard") setViewType("detailed");
    else if (viewType === "detailed") setViewType("minimal");
    else setViewType("standard");
  };

  // Loading state
  if (!marketOverview) {
    return (
      <Card className="mb-6 p-8">
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <RefreshCw className="h-10 w-10 text-gray-400 dark:text-gray-600 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
              Loading Market Overview
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Fetching the latest market data...
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Minimal view (just stats)
  if (viewType === "minimal") {
    return (
      <div className="mb-6">
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              <BarChart2 className="mr-2 h-5 w-5 text-indigo-500" />
              Market Summary
            </h2>

            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {getLastUpdateTime()}
              </span>
              <Button
                variant="outline"
                size="small"
                icon={
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                }
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
              <Button variant="outline" size="small" onClick={toggleViewType}>
                Expand
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 dark:bg-dark-200 p-3 rounded-md">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Market Cap
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatLargeNumber(marketOverview.marketStats.total_market_cap)}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-200 p-3 rounded-md">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Volume
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatLargeNumber(marketOverview.marketStats.total_volume)}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-200 p-3 rounded-md">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Gainers
              </div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400 flex items-center">
                <TrendingUp className="h-4 w-4 mr-1" />
                {marketOverview.marketStats.gainers}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-200 p-3 rounded-md">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Losers
              </div>
              <div className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center">
                <TrendingDown className="h-4 w-4 mr-1" />
                {marketOverview.marketStats.losers}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-200 p-3 rounded-md">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Avg Change
              </div>
              <div
                className={`text-lg font-bold flex items-center ${
                  marketOverview.marketStats.avg_change_percent >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {marketOverview.marketStats.avg_change_percent >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {formatPercent(marketOverview.marketStats.avg_change_percent)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Standard view (stats + charts)
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
          <BarChart2 className="mr-2 h-5 w-5 text-indigo-500" />
          Market Overview
        </h2>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            Last updated: {getLastUpdateTime()}
          </span>
          <Button
            variant="outline"
            size="small"
            icon={
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            }
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button variant="outline" size="small" onClick={toggleViewType}>
            {viewType === "standard" ? "View Detailed" : "View Compact"}
          </Button>
        </div>
      </div>

      {/* Market Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Market Cap
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(marketOverview.marketStats.total_market_cap)}
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Trading Volume
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatLargeNumber(marketOverview.marketStats.total_volume)}
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Biggest Gainer
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatPercent(marketOverview.marketStats.max_gain)}
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Biggest Loser
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatPercent(marketOverview.marketStats.max_loss)}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Market Index Chart */}
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart2 className="h-5 w-5 mr-2 text-indigo-500" />
            Market Index
          </h3>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={indexData}
                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={colors.gridColor}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fill: colors.textColor, fontSize: 12 }}
                  tickFormatter={() => ""} // Hide X labels for cleaner look
                  axisLine={{ stroke: colors.gridColor }}
                  tickLine={{ stroke: colors.gridColor }}
                />
                <YAxis
                  tick={{ fill: colors.textColor, fontSize: 12 }}
                  axisLine={{ stroke: colors.gridColor }}
                  tickLine={{ stroke: colors.gridColor }}
                  orientation="right"
                  domain={["dataMin - 1", "dataMax + 1"]}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => [value.toFixed(2), "Index Value"]}
                  contentStyle={{
                    backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
                    borderColor: colors.gridColor,
                    color: colors.textColor,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={
                    marketOverview.marketStats.avg_change_percent >= 0
                      ? colors.positiveColor
                      : colors.negativeColor
                  }
                  fill={
                    marketOverview.marketStats.avg_change_percent >= 0
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(239, 68, 68, 0.2)"
                  }
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-dark-200 rounded-md">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Market Trend
              </span>
              <span
                className={`text-sm font-medium flex items-center ${
                  marketOverview.marketStats.avg_change_percent >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {marketOverview.marketStats.avg_change_percent >= 0 ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {formatPercent(marketOverview.marketStats.avg_change_percent)}
              </span>
            </div>
          </div>
        </Card>

        {/* Market Breadth */}
        <Card>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
            <PieChartIcon className="h-5 w-5 mr-2 text-indigo-500" />
            Market Breadth
          </h3>

          <div className="flex items-center mb-6">
            <div className="h-60 w-full md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={70}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value, "Count"]}
                    contentStyle={{
                      backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
                      borderColor: colors.gridColor,
                      color: colors.textColor,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="hidden md:block md:w-1/2 pl-4">
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Gainers:
                  </span>
                  <span className="ml-auto text-sm font-medium text-green-600 dark:text-green-400">
                    {marketOverview.marketStats.gainers} stocks
                  </span>
                </div>

                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Losers:
                  </span>
                  <span className="ml-auto text-sm font-medium text-red-600 dark:text-red-400">
                    {marketOverview.marketStats.losers} stocks
                  </span>
                </div>

                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-gray-500 mr-2"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Unchanged:
                  </span>
                  <span className="ml-auto text-sm font-medium text-gray-600 dark:text-gray-400">
                    {marketOverview.marketStats.unchanged} stocks
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile view stats (visible on small screens) */}
          <div className="grid grid-cols-3 gap-2 md:hidden mb-4">
            <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded-md">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Gainers
              </div>
              <div className="text-sm font-medium text-green-600 dark:text-green-400">
                {marketOverview.marketStats.gainers}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded-md">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Losers
              </div>
              <div className="text-sm font-medium text-red-600 dark:text-red-400">
                {marketOverview.marketStats.losers}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded-md">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Unchanged
              </div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {marketOverview.marketStats.unchanged}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Only show detailed view if in detailed mode */}
      {viewType === "detailed" && (
        <>
          {/* Sector Performance */}
          <Card className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Sector Performance
            </h3>

            <div className="overflow-auto max-h-60">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-dark-200">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Sector
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Stocks
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Avg Change
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-dark-100 divide-y divide-gray-200 dark:divide-gray-700">
                  {marketOverview.sectorPerformance.map((sector, index) => (
                    <tr key={index}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {sector.sector}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                        {sector.stock_count}
                      </td>
                      <td
                        className={`px-4 py-2 whitespace-nowrap text-sm text-right ${
                          sector.avg_change_percent >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        <div className="flex items-center justify-end">
                          {sector.avg_change_percent >= 0 ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                          )}
                          {formatPercent(sector.avg_change_percent)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Top Performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Top Gainers */}
            <Card>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                Top Gainers
              </h3>

              <div className="overflow-auto max-h-60">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-dark-200">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Symbol
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Price
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-100 divide-y divide-gray-200 dark:divide-gray-700">
                    {marketOverview.topGainers.map((stock) => (
                      <tr key={stock.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {stock.symbol}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stock.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                          ${stock.last_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-green-600 dark:text-green-400">
                          <div className="flex items-center justify-end">
                            <TrendingUp className="h-4 w-4 mr-1" />
                            {formatPercent(stock.change_percent)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Top Losers */}
            <Card>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                <TrendingDown className="h-5 w-5 mr-2 text-red-500" />
                Top Losers
              </h3>

              <div className="overflow-auto max-h-60">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-dark-200">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Symbol
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Name
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Price
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-100 divide-y divide-gray-200 dark:divide-gray-700">
                    {marketOverview.topLosers.map((stock) => (
                      <tr key={stock.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {stock.symbol}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {stock.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-gray-900 dark:text-white">
                          ${stock.last_price.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-right text-red-600 dark:text-red-400">
                          <div className="flex items-center justify-end">
                            <TrendingDown className="h-4 w-4 mr-1" />
                            {formatPercent(stock.change_percent)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default MarketOverview;
