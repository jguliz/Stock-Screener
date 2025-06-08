// src/components/Dashboard/Dashboard.js
import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Bell,
  Heart,
  RefreshCw,
  AlertTriangle,
  BarChart2,
} from "lucide-react";
import { useStock } from "../../context/StockContext";
import Header from "../Common/Header";
import Footer from "../Common/Footer";
import Card from "../UI/Card";
import Button from "../UI/Button";
import Loading from "../Common/Loading";
import ErrorMessage from "../Common/ErrorMessage";
import ConnectionError from "../Common/ConnectionError";
import StockDetail from "./StockDetail";
import AlertSettings from "./AlertSettings";
import StockList from "./Stocklist";
import MarketOverview from "./MarketOverview";

const Dashboard = () => {
  const {
    stocks,
    loading,
    error,
    connectionError,
    fetchStocks,
    toggleFavorite,
    fetchMarketOverview,
  } = useStock();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("All");
  const [viewMode, setViewMode] = useState("all"); // all, favorites, gainers, losers
  const [selectedStock, setSelectedStock] = useState(null);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertStock, setAlertStock] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showMarketOverview, setShowMarketOverview] = useState(true);

  // Use useCallback to prevent the function from being recreated on each render
  const handleRetry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    fetchMarketOverview(); // Also refresh market overview
  }, [fetchMarketOverview]);

  // Only fetch stocks when the component mounts or when retryCount changes
  useEffect(() => {
    fetchStocks().catch((err) => {
      console.error("Error fetching stocks:", err);
    });
  }, [fetchStocks, retryCount]); // Only depend on these two values

  // Filter stocks based on search query, sector, and view mode
  const filteredStocks = stocks.filter((stock) => {
    // Search filter
    if (
      searchQuery &&
      !stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Sector filter
    if (selectedSector !== "All" && stock.sector !== selectedSector) {
      return false;
    }

    // View mode filter
    if (viewMode === "favorites" && !stock.isFavorite) {
      return false;
    } else if (viewMode === "gainers" && stock.change_percent <= 0) {
      return false;
    } else if (viewMode === "losers" && stock.change_percent >= 0) {
      return false;
    }

    return true;
  });

  // Handle stock selection
  const handleStockSelect = (stock) => {
    setSelectedStock(stock);
  };

  // Handle alert setting
  const handleAlertClick = (stock, e) => {
    e.stopPropagation();
    setAlertStock(stock);
    setShowAlertModal(true);
  };

  // Handle favorite toggling
  const handleFavoriteClick = (stockId, e) => {
    e.stopPropagation();
    toggleFavorite(stockId);
  };

  // Get all unique sectors from stocks
  const sectors = [
    "All",
    ...new Set(stocks.map((stock) => stock.sector).filter(Boolean)),
  ];

  // Show loading state if we're still loading and have no stocks yet
  if (loading && stocks.length === 0) {
    return <Loading />;
  }

  // Show connection error
  if (connectionError && stocks.length === 0) {
    return <ConnectionError onRetry={handleRetry} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      <Header />

      <main className="flex-grow py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Stock Screener
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Track stock prices, set alerts, and monitor your watchlist in
              real-time
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6">
              <ErrorMessage message={`Error: ${error}`} />
              <Button
                onClick={handleRetry}
                icon={<RefreshCw className="h-4 w-4" />}
                className="mt-2"
                size="small"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Market Overview Toggle */}
          <div className="mb-4 flex justify-end">
            <Button
              variant="outline"
              size="small"
              icon={<BarChart2 className="h-4 w-4 mr-1" />}
              onClick={() => setShowMarketOverview(!showMarketOverview)}
            >
              {showMarketOverview
                ? "Hide Market Overview"
                : "Show Market Overview"}
            </Button>
          </div>

          {/* Market Overview */}
          {showMarketOverview && <MarketOverview />}

          {/* Filters and controls */}
          <Card className="mb-6">
            <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4 md:items-center">
              {/* Search */}
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search stocks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-dark-100 dark:border-gray-700 dark:text-white"
                />
              </div>

              {/* Sector filter */}
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <Filter className="h-5 w-5 text-gray-400 mr-2" />
                  <select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md dark:bg-dark-100 dark:border-gray-700 dark:text-white"
                  >
                    {sectors.map((sector) => (
                      <option key={sector} value={sector}>
                        {sector}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* View mode buttons */}
              <div className="flex space-x-2">
                <Button
                  onClick={() => setViewMode("all")}
                  variant={viewMode === "all" ? "primary" : "secondary"}
                  size="small"
                >
                  All
                </Button>
                <Button
                  onClick={() => setViewMode("favorites")}
                  variant={viewMode === "favorites" ? "primary" : "secondary"}
                  size="small"
                  icon={<Heart className="h-4 w-4" />}
                >
                  Favorites
                </Button>
                <Button
                  onClick={() => setViewMode("gainers")}
                  variant={viewMode === "gainers" ? "primary" : "secondary"}
                  size="small"
                  icon={<TrendingUp className="h-4 w-4" />}
                >
                  Gainers
                </Button>
                <Button
                  onClick={() => setViewMode("losers")}
                  variant={viewMode === "losers" ? "primary" : "secondary"}
                  size="small"
                  icon={<TrendingDown className="h-4 w-4" />}
                >
                  Losers
                </Button>
              </div>
            </div>
          </Card>

          {/* Stocks table */}
          <Card>
            {loading && (
              <div className="flex justify-center py-2 bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 mb-4 rounded">
                <RefreshCw className="h-5 w-5 text-blue-500 dark:text-blue-400 animate-spin mr-2" />
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                  Loading stock data...
                </span>
              </div>
            )}

            {!loading && stocks.length === 0 && (
              <div className="p-8 text-center">
                <div className="mb-4">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Stock Data Available
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  We couldn't retrieve any stock data at this time. This may be
                  due to API limitations or connection issues.
                </p>
                <Button
                  onClick={handleRetry}
                  icon={<RefreshCw className="h-4 w-4" />}
                >
                  Retry Loading Stocks
                </Button>
              </div>
            )}

            {stocks.length > 0 && filteredStocks.length === 0 && (
              <div className="p-8 text-center">
                <div className="mb-4">
                  <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Matching Stocks
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  No stocks match your current filters. Try adjusting your
                  search criteria or view mode.
                </p>
                <Button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSector("All");
                    setViewMode("all");
                  }}
                  variant="outline"
                >
                  Clear Filters
                </Button>
              </div>
            )}

            {stocks.length > 0 && filteredStocks.length > 0 && (
              <StockList
                stocks={filteredStocks}
                onStockSelect={handleStockSelect}
                onAlertClick={handleAlertClick}
                onFavoriteClick={handleFavoriteClick}
              />
            )}
          </Card>

          {/* Results summary */}
          {stocks.length > 0 && filteredStocks.length > 0 && (
            <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredStocks.length} of {stocks.length} stocks
              {viewMode !== "all" && ` (${viewMode} view)`}
              {selectedSector !== "All" && ` in ${selectedSector} sector`}
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetail
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}

      {/* Alert Settings Modal */}
      {showAlertModal && (
        <AlertSettings
          stock={alertStock}
          onClose={() => setShowAlertModal(false)}
        />
      )}
    </div>
  );
};

export default Dashboard;
