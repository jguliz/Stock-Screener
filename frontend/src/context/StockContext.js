// frontend/src/context/StockContext.js
import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

// Create the stock context
const StockContext = createContext();

// Custom hook to use the stock context
export const useStock = () => useContext(StockContext);

// Stock provider component
export const StockProvider = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sectors, setSectors] = useState(["All"]);
  const [marketOverview, setMarketOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState(false);
  const [socket, setSocket] = useState(null);

  // Add a ref to track if we're already fetching stocks - prevents infinite loop
  const isFetchingRef = useRef(false);

  // Add a ref to track which stocks we've already subscribed to - outside any callback
  const subscribedStocksRef = useRef(new Set());

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8080/api";
  const SOCKET_URL =
    process.env.REACT_APP_SOCKET_URL || "http://localhost:8080";

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated) {
      const newSocket = io(SOCKET_URL, {
        transports: ["websocket"],
        auth: {
          token: localStorage.getItem("token"),
        },
      });

      setSocket(newSocket);

      // Cleanup on unmount
      return () => {
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    }
  }, [isAuthenticated, SOCKET_URL]);

  // Listen for stock updates
  useEffect(() => {
    if (socket) {
      socket.on("stock-update", (data) => {
        setStocks((prevStocks) => {
          return prevStocks.map((stock) => {
            if (stock.id === data.id) {
              return {
                ...stock,
                last_price: data.last_price,
                change_amount: data.change_amount,
                change_percent: data.change_percent,
                volume: data.volume,
                updated_at: data.updated_at,
              };
            }
            return stock;
          });
        });
      });

      // Listen for alerts
      socket.on("alert", (data) => {
        // Show notification
        if (Notification.permission === "granted") {
          new Notification(`Alert: ${data.symbol}`, {
            body: `${data.symbol} has reached your ${data.threshold}% threshold`,
            icon: "/favicon.ico",
          });
        }

        // Refresh alerts
        fetchAlerts();
      });

      // Join user-specific room for alerts
      if (currentUser) {
        socket.emit("join", `user:${currentUser.id}`);
      }

      return () => {
        socket.off("stock-update");
        socket.off("alert");
      };
    }
  }, [socket, currentUser]);

  // Helper function to subscribe to stock updates - separate from the fetchStocks function
  const subscribeToStocks = useCallback(
    (stocksData) => {
      if (!socket) return;

      const stockIds = stocksData.map((stock) => stock.id);
      // Only subscribe to stocks we haven't subscribed to yet
      const newStockIds = stockIds.filter(
        (id) => !subscribedStocksRef.current.has(id)
      );

      if (newStockIds.length > 0) {
        socket.emit("subscribe", newStockIds);
        // Add the new stocks to our subscribed set
        newStockIds.forEach((id) => subscribedStocksRef.current.add(id));
      }
    },
    [socket]
  );

  // Fetch all stocks - use useCallback to prevent the function from being recreated on each render
  const fetchStocks = useCallback(async () => {
    if (!isAuthenticated) return;

    // Return if we're already fetching to prevent infinite loops
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setLoading(true);
    setError("");
    setConnectionError(false);

    try {
      const token = localStorage.getItem("token");

      // Create an AbortController for the timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      try {
        const response = await axios.get(`${API_URL}/stocks`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Only update stocks if we actually got valid data
        if (response.data.stocks && response.data.stocks.length > 0) {
          // Update the state with fresh data
          setStocks(response.data.stocks);

          // Subscribe to stock updates
          subscribeToStocks(response.data.stocks);

          isFetchingRef.current = false;
          return response.data;
        } else {
          // If we have no data, show error
          isFetchingRef.current = false;
          throw new Error("No stock data received from API");
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (err) {
      console.error("Error fetching stocks:", err);

      if (
        err.name === "AbortError" ||
        err.code === "ECONNABORTED" ||
        !err.response
      ) {
        setConnectionError(true);
        setError("Connection timeout. Please try again later.");
      } else {
        setError(err.response?.data?.message || "Failed to fetch stocks");
      }

      isFetchingRef.current = false;
      throw err;
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, API_URL, subscribeToStocks]);

  // Get stock price history - using useCallback to cache the function
  // Enhanced getStockHistory function with better timeframe handling
  const getStockHistory = useCallback(
    async (stockId, timeframe = "1H") => {
      if (!isAuthenticated) return [];

      try {
        const token = localStorage.getItem("token");

        // Improved timeframe to minutes conversion
        let minutes;
        switch (timeframe) {
          case "1W":
            minutes = 60 * 24 * 7;
            break;
          case "1D":
            minutes = 60 * 24;
            break;
          case "4H":
            minutes = 60 * 4;
            break;
          case "1H":
            minutes = 60;
            break;
          case "30M":
            minutes = 30;
            break;
          case "15M":
            minutes = 15;
            break;
          case "5M":
            minutes = 5;
            break;
          default:
            minutes = 60;
        }

        // Add cache control parameters
        const params = {
          minutes,
          timestamp: Date.now(), // Add timestamp to avoid caching
        };

        const response = await axios.get(
          `${API_URL}/stocks/${stockId}/history`,
          {
            params,
            headers: {
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
            },
          }
        );

        // Validate and clean data
        const history = response.data.history || [];
        return history.map((item) => ({
          time: item.time,
          price:
            typeof item.price === "string"
              ? parseFloat(item.price)
              : item.price,
          volume: item.volume ? parseInt(item.volume) : 0,
        }));
      } catch (err) {
        console.error("Failed to fetch stock history:", err);
        throw new Error(
          err.response?.data?.message || "Failed to fetch stock history"
        );
      }
    },
    [isAuthenticated, API_URL]
  );

  // Fetch favorite stocks
  const fetchFavorites = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/favorites`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setFavorites(response.data.favorites);

      // Update stocks with favorite status
      updateFavoriteStatus(response.data.favorites);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch favorites");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, API_URL]);

  // Update stocks with favorite status
  const updateFavoriteStatus = (favoriteStocks) => {
    const favoriteIds = favoriteStocks.map((fav) => fav.id);

    setStocks((prevStocks) => {
      return prevStocks.map((stock) => ({
        ...stock,
        isFavorite: favoriteIds.includes(stock.id),
      }));
    });
  };

  // Toggle favorite status
  const toggleFavorite = useCallback(
    async (stockId) => {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem("token");

        const response = await axios.post(
          `${API_URL}/favorites`,
          { stockId },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const isFavorite = response.data.isFavorite;

        // Update local state
        setStocks((prevStocks) => {
          return prevStocks.map((stock) => {
            if (stock.id === stockId) {
              return { ...stock, isFavorite };
            }
            return stock;
          });
        });

        // Refresh favorites
        fetchFavorites();

        return response.data;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to update favorite");
        throw err;
      }
    },
    [isAuthenticated, API_URL, fetchFavorites]
  );

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/alerts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setAlerts(response.data.alerts);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch alerts");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, API_URL]);

  // Set alert
  const setAlert = useCallback(
    async (stockId, alertData) => {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem("token");

        const response = await axios.post(
          `${API_URL}/alerts`,
          { stockId, ...alertData },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        // Refresh alerts
        fetchAlerts();

        return response.data;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to set alert");
        throw new Error(err.response?.data?.message || "Failed to set alert");
      }
    },
    [isAuthenticated, API_URL, fetchAlerts]
  );

  // Delete alert
  const deleteAlert = useCallback(
    async (alertId) => {
      if (!isAuthenticated) return;

      try {
        const token = localStorage.getItem("token");

        const response = await axios.delete(`${API_URL}/alerts/${alertId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // Refresh alerts
        fetchAlerts();

        return response.data;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete alert");
        throw err;
      }
    },
    [isAuthenticated, API_URL, fetchAlerts]
  );

  // Fetch sectors
  const fetchSectors = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/sectors`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setSectors(["All", ...response.data.sectors.map((s) => s.sector)]);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch sectors");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, API_URL]);

  // Fetch market overview
  const fetchMarketOverview = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_URL}/market`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setMarketOverview(response.data);
    } catch (err) {
      console.error("Failed to fetch market overview:", err);
    }
  }, [isAuthenticated, API_URL]);

  // Helper to convert timeframe to minutes
  const timeframeToMinutes = (timeframe) => {
    switch (timeframe) {
      case "1M":
        return 1;
      case "5M":
        return 5;
      case "15M":
        return 15;
      case "30M":
        return 30;
      case "1H":
      default:
        return 60;
    }
  };

  // Load initial data when authenticated - using useEffect with proper dependencies
  useEffect(() => {
    if (isAuthenticated) {
      // Use a flag to prevent multiple fetches
      let isMounted = true;

      const loadInitialData = async () => {
        if (isMounted) {
          await fetchStocks().catch((error) => {
            console.error("Error loading stocks:", error);
          });
        }
        if (isMounted) {
          await fetchFavorites().catch((error) => {
            console.error("Error loading favorites:", error);
          });
        }
        if (isMounted) {
          await fetchAlerts().catch((error) => {
            console.error("Error loading alerts:", error);
          });
        }
        if (isMounted) {
          await fetchSectors().catch((error) => {
            console.error("Error loading sectors:", error);
          });
        }
        if (isMounted) {
          await fetchMarketOverview().catch((error) => {
            console.error("Error loading market overview:", error);
          });
        }
      };

      loadInitialData();

      // Refresh market overview periodically (every minute)
      const marketOverviewInterval = setInterval(() => {
        if (isMounted) {
          fetchMarketOverview().catch((error) => {
            console.error("Error refreshing market overview:", error);
          });
        }
      }, 60000);

      // Cleanup function to prevent state updates after unmount
      return () => {
        isMounted = false;
        clearInterval(marketOverviewInterval);
      };
    }
  }, [
    isAuthenticated,
    fetchStocks,
    fetchFavorites,
    fetchAlerts,
    fetchSectors,
    fetchMarketOverview,
  ]);

  // Create a value object to provide through the context
  const value = {
    stocks,
    favorites,
    alerts,
    sectors,
    marketOverview,
    loading,
    error,
    connectionError,
    fetchStocks,
    fetchFavorites,
    toggleFavorite,
    fetchAlerts,
    setAlert,
    deleteAlert,
    fetchSectors,
    getStockHistory,
    fetchMarketOverview,
  };

  return (
    <StockContext.Provider value={value}>{children}</StockContext.Provider>
  );
};

export default StockContext;