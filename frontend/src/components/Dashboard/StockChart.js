import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import Button from "../UI/Button";

const StockChart = ({
  data = [],
  loading = false,
  error = null,
  onRefresh = () => {},
  stockSymbol = "",
  priceChange = 0,
  timeframe = "1H",
  onTimeframeChange = () => {},
}) => {
  const { isDarkMode } = useTheme();
  const [chartType, setChartType] = useState("area"); // 'line', 'area', 'candle'
  const [showVolume, setShowVolume] = useState(true);

  // Calculate min and max for Y axis
  const calculateYDomain = () => {
    if (!data || data.length === 0) return [0, 1];

    const prices = data.map((item) => parseFloat(item.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Add padding (5%)
    const padding = (maxPrice - minPrice) * 0.05;
    return [minPrice - padding, maxPrice + padding];
  };

  // Format time based on timeframe
  const formatXAxis = (time) => {
    if (!time) return "";

    // For timeframes that use actual dates (like '1D', '1W', etc.)
    if (typeof time === "string" && time.includes("-")) {
      const date = new Date(time);
      if (["1D", "3D"].includes(timeframe)) {
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else if (["1W", "1M"].includes(timeframe)) {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    }

    // For intraday timeframes (like '5M', '15M', '1H')
    return time;
  };

  // Format tooltip values
  const formatTooltipValue = (value, name) => {
    if (name === "price") {
      return [`$${parseFloat(value).toFixed(2)}`, "Price"];
    }
    if (name === "volume") {
      return [
        value >= 1000000
          ? `${(value / 1000000).toFixed(1)}M`
          : value >= 1000
          ? `${(value / 1000).toFixed(1)}K`
          : value,
        "Volume",
      ];
    }
    return [value, name];
  };

  // Format tooltip label (time)
  const formatTooltipLabel = (label) => {
    if (typeof label === "string" && label.includes("-")) {
      return new Date(label).toLocaleString();
    }
    return label;
  };

  // Get theme colors
  const getChartColors = () => {
    return {
      gridColor: isDarkMode ? "#374151" : "#E5E7EB",
      positiveColor: "#10B981", // success-light
      negativeColor: "#EF4444", // danger-light
      textColor: isDarkMode ? "#9CA3AF" : "#6B7280",
      areaPositiveColor: "rgba(16, 185, 129, 0.2)", // success-light with alpha
      areaNegativeColor: "rgba(239, 68, 68, 0.2)", // danger-light with alpha
      volumeColor: isDarkMode ? "#4B5563" : "#D1D5DB",
      tooltipBg: isDarkMode ? "#1F2937" : "#FFFFFF",
      tooltipBorder: isDarkMode ? "#374151" : "#E5E7EB",
      referenceLine: isDarkMode ? "#6B7280" : "#9CA3AF",
    };
  };

  const colors = getChartColors();
  const yDomain = calculateYDomain();

  // Get chart color based on price change
  const chartColor =
    priceChange >= 0 ? colors.positiveColor : colors.negativeColor;
  const areaColor =
    priceChange >= 0 ? colors.areaPositiveColor : colors.areaNegativeColor;

  // Chart component to render based on type
  const renderChart = () => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-600">
          {error ? error : "No chart data available"}
        </div>
      );
    }

    // Common chart props
    const commonProps = {
      data,
      margin: { top: 10, right: 30, left: 10, bottom: 5 },
    };

    const commonChartElements = (
      <>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke={colors.gridColor}
        />
        <XAxis
          dataKey="time"
          tickFormatter={formatXAxis}
          tick={{ fill: colors.textColor, fontSize: 12 }}
          axisLine={{ stroke: colors.gridColor }}
          tickLine={{ stroke: colors.gridColor }}
        />
        <YAxis
          domain={yDomain}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
          tick={{ fill: colors.textColor, fontSize: 12 }}
          axisLine={{ stroke: colors.gridColor }}
          tickLine={{ stroke: colors.gridColor }}
          orientation="right"
          width={60}
        />
        <Tooltip
          formatter={formatTooltipValue}
          labelFormatter={formatTooltipLabel}
          contentStyle={{
            backgroundColor: colors.tooltipBg,
            borderColor: colors.tooltipBorder,
            color: colors.textColor,
          }}
        />
        <Legend wrapperStyle={{ color: colors.textColor }} />

        {/* Reference line at opening price */}
        {data.length > 0 && (
          <ReferenceLine
            y={parseFloat(data[0].price)}
            stroke={colors.referenceLine}
            strokeDasharray="3 3"
            strokeOpacity={0.7}
          />
        )}
      </>
    );

    // Render chart based on type
    switch (chartType) {
      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart {...commonProps}>
              {commonChartElements}
              <Line
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                strokeWidth={2}
                dot={false}
                animationDuration={500}
                name="Price"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
      default:
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart {...commonProps}>
              {commonChartElements}
              <Area
                type="monotone"
                dataKey="price"
                stroke={chartColor}
                fill={areaColor}
                strokeWidth={2}
                dot={false}
                animationDuration={500}
                name="Price"
              />
            </AreaChart>
          </ResponsiveContainer>
        );
    }
  };

  // Volume chart
  const renderVolumeChart = () => {
    if (!showVolume || data.length === 0) return null;

    return (
      <ResponsiveContainer width="100%" height={100}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke={colors.gridColor}
          />
          <XAxis
            dataKey="time"
            tickFormatter={formatXAxis}
            tick={{ fill: colors.textColor, fontSize: 10 }}
            axisLine={{ stroke: colors.gridColor }}
            tickLine={{ stroke: colors.gridColor }}
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
            tick={{ fill: colors.textColor, fontSize: 10 }}
            axisLine={{ stroke: colors.gridColor }}
            tickLine={{ stroke: colors.gridColor }}
            orientation="right"
            width={50}
          />
          <Tooltip
            formatter={formatTooltipValue}
            labelFormatter={formatTooltipLabel}
            contentStyle={{
              backgroundColor: colors.tooltipBg,
              borderColor: colors.tooltipBorder,
              color: colors.textColor,
            }}
          />
          <Bar
            dataKey="volume"
            fill={colors.volumeColor}
            name="Volume"
            animationDuration={500}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // Timeframes available
  const timeframes = [
    { value: "5M", label: "5M" },
    { value: "15M", label: "15M" },
    { value: "1H", label: "1H" },
    { value: "1D", label: "1D" },
    { value: "1W", label: "1W" },
    { value: "1M", label: "1M" },
    { value: "3M", label: "3M" },
  ];

  return (
    <div className="stock-chart-container">
      {/* Chart Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-2">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center">
            {stockSymbol} Price Chart
            <span
              className={`ml-2 text-sm font-normal ${
                priceChange >= 0
                  ? "text-success-light dark:text-green-400"
                  : "text-danger-light dark:text-red-400"
              }`}
            >
              {priceChange >= 0 ? (
                <TrendingUp className="h-4 w-4 inline mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 inline mr-1" />
              )}
              {priceChange.toFixed(2)}%
            </span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            {timeframe} Timeframe
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Timeframe selection */}
          <div className="flex rounded-md overflow-hidden shadow-sm border border-gray-300 dark:border-gray-700">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                className={`px-2 py-1 text-xs focus:outline-none ${
                  timeframe === tf.value
                    ? "bg-indigo-600 text-white dark:bg-indigo-700"
                    : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark-100 dark:text-gray-300 dark:hover:bg-dark-200"
                }`}
                onClick={() => onTimeframeChange(tf.value)}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart type selection */}
          <div className="flex rounded-md overflow-hidden shadow-sm border border-gray-300 dark:border-gray-700">
            <button
              className={`px-2 py-1 text-xs focus:outline-none ${
                chartType === "line"
                  ? "bg-indigo-600 text-white dark:bg-indigo-700"
                  : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark-100 dark:text-gray-300 dark:hover:bg-dark-200"
              }`}
              onClick={() => setChartType("line")}
            >
              Line
            </button>
            <button
              className={`px-2 py-1 text-xs focus:outline-none ${
                chartType === "area"
                  ? "bg-indigo-600 text-white dark:bg-indigo-700"
                  : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark-100 dark:text-gray-300 dark:hover:bg-dark-200"
              }`}
              onClick={() => setChartType("area")}
            >
              Area
            </button>
          </div>

          {/* Volume toggle */}
          <div className="flex rounded-md overflow-hidden shadow-sm border border-gray-300 dark:border-gray-700">
            <button
              className={`px-2 py-1 text-xs focus:outline-none ${
                showVolume
                  ? "bg-indigo-600 text-white dark:bg-indigo-700"
                  : "bg-white text-gray-700 hover:bg-gray-100 dark:bg-dark-100 dark:text-gray-300 dark:hover:bg-dark-200"
              }`}
              onClick={() => setShowVolume(!showVolume)}
            >
              Volume
            </button>
          </div>

          {/* Refresh button */}
          <Button
            size="small"
            variant="outline"
            onClick={onRefresh}
            className="ml-2"
            icon={
              <RefreshCw
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
            }
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-2" />
            <span className="text-gray-500 dark:text-gray-400">
              Loading chart data...
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* Price chart */}
          {renderChart()}

          {/* Volume chart */}
          {renderVolumeChart()}

          {/* Stats footer */}
          {data.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-sm">
              <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded">
                <span className="text-gray-500 dark:text-gray-400 block">
                  Open
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${parseFloat(data[0].price).toFixed(2)}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded">
                <span className="text-gray-500 dark:text-gray-400 block">
                  Close
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${parseFloat(data[data.length - 1].price).toFixed(2)}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded">
                <span className="text-gray-500 dark:text-gray-400 block">
                  High
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  $
                  {Math.max(
                    ...data.map((item) => parseFloat(item.price))
                  ).toFixed(2)}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded">
                <span className="text-gray-500 dark:text-gray-400 block">
                  Low
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  $
                  {Math.min(
                    ...data.map((item) => parseFloat(item.price))
                  ).toFixed(2)}
                </span>
              </div>
              <div className="bg-gray-50 dark:bg-dark-200 p-2 rounded">
                <span className="text-gray-500 dark:text-gray-400 block">
                  Change
                </span>
                <span
                  className={`font-medium ${
                    priceChange >= 0
                      ? "text-success-light dark:text-green-400"
                      : "text-danger-light dark:text-red-400"
                  }`}
                >
                  {priceChange >= 0 ? "+" : ""}
                  {priceChange.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StockChart;
