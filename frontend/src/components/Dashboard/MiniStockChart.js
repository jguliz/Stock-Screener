// frontend/src/components/Dashboard/MiniStockChart.js
import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  ReferenceLine,
} from "recharts";
import { useTheme } from "../../context/ThemeContext";

const MiniStockChart = ({
  data = [],
  priceChange = 0,
  height = 40,
  width = 100,
  showRefLine = true,
  customLineWidth = 1.5,
  disableAnimation = true,
  gradientFill = true,
  curveType = "monotone",
}) => {
  const { isDarkMode } = useTheme();

  // Define colors based on theme
  const positiveColor = "#10B981"; // success-light from your theme
  const negativeColor = "#EF4444"; // danger-light from your theme
  const loadingColor = isDarkMode ? "#374151" : "#E5E7EB"; // dark: gray-700, light: gray-200

  // Format data to ensure we have numbers not strings - do this before any potential returns
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => ({
      ...item,
      price:
        typeof item.price === "string" ? parseFloat(item.price) : item.price,
    }));
  }, [data]);

  // Early return if no data with loading placeholder
  if (!data || data.length === 0) {
    return (
      <div
        className={`${
          isDarkMode ? "bg-gray-800" : "bg-gray-100"
        } rounded-md animate-pulse`}
        style={{ height: `${height}px`, width: `${width}px` }}
      />
    );
  }

  // Determine color based on price change
  const lineColor = priceChange >= 0 ? positiveColor : negativeColor;
  const fillColor =
    priceChange >= 0
      ? "rgba(16, 185, 129, 0.2)" // Positive with transparency
      : "rgba(239, 68, 68, 0.2);"; // Negative with transparency

  // Get reference price (starting price)
  const refPrice = chartData[0]?.price;

  // Calculate min and max for domain
  const prices = chartData.map((item) => item.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  // Add a small buffer to the domain (10%)
  const buffer = (maxPrice - minPrice) * 0.1;
  const domain = [minPrice - buffer, maxPrice + buffer];

  return (
    <div
      className="overflow-hidden"
      style={{ height: `${height}px`, width: `${width}px` }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          {/* Hidden Y axis to control domain */}
          <YAxis domain={domain} hide />

          {/* Optional reference line for the starting price */}
          {showRefLine && refPrice && (
            <ReferenceLine
              y={refPrice}
              stroke={lineColor}
              strokeDasharray="3 3"
              strokeOpacity={0.4}
            />
          )}

          {/* Gradient definitions */}
          {gradientFill && (
            <defs>
              <linearGradient
                id={`positiveGradient-${width}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={positiveColor} stopOpacity={0.3} />
                <stop
                  offset="95%"
                  stopColor={positiveColor}
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient
                id={`negativeGradient-${width}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={negativeColor} stopOpacity={0.3} />
                <stop
                  offset="95%"
                  stopColor={negativeColor}
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
          )}

          {/* Main price area */}
          <Area
            type={curveType}
            dataKey="price"
            stroke={lineColor}
            strokeWidth={customLineWidth}
            dot={false}
            isAnimationActive={!disableAnimation}
            connectNulls={true}
            fill={
              gradientFill
                ? `url(#${
                    priceChange >= 0
                      ? `positiveGradient-${width}`
                      : `negativeGradient-${width}`
                  })`
                : "none"
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniStockChart;
