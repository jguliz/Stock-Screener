require("events").defaultMaxListeners = 20;
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const NodeCache = require("node-cache");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Local module imports
const polygonDataCollector = require("./services/polygonDataCollector");
const polygonWSCollector = require("./services/PolygonWebSocketCollector");
const stockService = require("./stockServiceEnhanced");
const database = require("./database");
const { closeConnection, executeQueryWithRetry } = database;
const backfillService = require("./backfill-service");

// Initialize Express and HTTP server
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8080;

let repairAttempts = 0;

// Setup Socket.io with msgpack parser
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  parser: require("socket.io-msgpack-parser"),
});

// Initialize in-memory cache
const stockCache = new NodeCache({ stdTTL: 60 });

// Middleware
app.use(cors());
app.use(express.json());

// Simple Redis mock
const redisClient = {
  isReady: false,
  connect: async () => {
    console.log("Using Mock Redis (not connected to actual Redis server)");
    return Promise.resolve();
  },
  disconnect: () => console.log("Mock Redis: disconnect called"),
  get: async () => null,
  set: async () => {},
  setEx: async () => {},
  del: async () => {},
  publish: async () => {},
  subscribe: async () => {},
  duplicate: () => ({
    ...redisClient,
    connect: async () => console.log("Mock Redis PubSub: connect called"),
  }),
  on: () => {},
  ping: async () => "PONG",
  dbSize: async () => 0,
  flushDb: async () => {},
};

// Global variables for database and connection management
let pool = null;
let databaseConnected = false;
const stockData = {};
let connectionMonitorInterval = null;
let isRepairing = false;

// Connection monitoring and repair
function startConnectionMonitor() {
  if (connectionMonitorInterval) {
    clearInterval(connectionMonitorInterval);
  }

  console.log("Starting database connection monitor...");

  connectionMonitorInterval = setInterval(async () => {
    if (!pool || isRepairing) return;

    try {
      // Test connection with a simple query
      const connection = await pool.getConnection();
      await connection.query("SELECT 1 AS health_check");
      connection.release();
    } catch (error) {
      console.error("Connection monitor detected an issue:", error.message);

      if (!isRepairing) {
        await repairConnection();
      }
    }
  }, 30000); // Check every 30 seconds
}

async function repairConnection() {
  if (isRepairing) return;
  isRepairing = true;
  repairAttempts++;

  console.log(`Attempting connection repair (attempt ${repairAttempts})...`);
  try {
    if (pool) await closeConnection(pool);

    // Reset port if needed
    if (repairAttempts % 3 === 0) {
      localPort = parseInt(process.env.LOCAL_PORT || "33306");
    }

    pool = await database.createConnectionPool();
    console.log("✅ Connection repaired successfully");
    databaseConnected = true;
    repairAttempts = 0;

    // Update backfill service pool
    backfillService.setPool(pool);
  } catch (error) {
    console.error(`Repair failed (attempt ${repairAttempts}):`, error);
    databaseConnected = false;
  } finally {
    isRepairing = false;
  }
}

const initializeDatabase = async () => {
  try {
    console.log("Initializing database connection...");

    // Add timeout to prevent hanging
    const connectionPromise = database.createConnectionPool();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Connection timeout after 30 seconds")),
        30000
      )
    );

    // Race the connection against a timeout
    pool = await Promise.race([connectionPromise, timeoutPromise]);

    if (!pool) {
      throw new Error("Failed to create connection pool - returned undefined");
    }

    // Add connection validation
    console.log("Getting connection from pool...");
    const connection = await pool.getConnectionPromise();
    console.log("Executing test query...");
    await connection.query("SELECT 1");
    connection.release();

    console.log("✅ Database connection validated");
    databaseConnected = true;
    return true;
  } catch (error) {
    console.error("Database connection failed:", error);
    // Add detailed error analysis
    if (error.code === "ER_NOT_SUPPORTED_AUTH_MODE") {
      console.error("Authentication protocol mismatch:");
      console.error("1. Check if MySQL user uses mysql_native_password");
      console.error("2. Verify password contains no special characters");
      console.error("3. Confirm MySQL version is compatible with mysql2");
    }
    databaseConnected = false;
    return false;
  }
};

// Connect to Redis (mock)
(async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis (mock)");
  } catch (err) {
    console.error("Redis connection error:", err);
  }
})();

// Helper functions
function isMarketOpen() {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 0 || day === 6) return false;
  return hour >= 9 && hour < 16;
}

function generateMockPriceHistory(stockId, minutes) {
  const stockMap = {
    1: { symbol: "AAPL", price: 180.95 },
    2: { symbol: "MSFT", price: 380.75 },
    3: { symbol: "AMZN", price: 185.88 },
    4: { symbol: "GOOGL", price: 176.44 },
    5: { symbol: "META", price: 504.22 },
    6: { symbol: "TSLA", price: 172.63 },
    7: { symbol: "NVDA", price: 874.5 },
    8: { symbol: "JPM", price: 192.82 },
    9: { symbol: "V", price: 267.88 },
    10: { symbol: "JNJ", price: 156.67 },
  };
  const stock = stockMap[stockId] || { symbol: "UNKNOWN", price: 100 };
  const basePrice = stock.price;
  const now = new Date();
  const data = [];
  for (let i = 0; i < minutes; i++) {
    const time = new Date(now.getTime() - (minutes - i) * 60000);
    const randomChange = (Math.random() - 0.5) * 0.04;
    const price = basePrice * (1 + randomChange);
    data.push({
      time: time.toLocaleTimeString(),
      price: parseFloat(price.toFixed(2)),
    });
  }
  return data;
}

function getMockStocks() {
  return [
    {
      id: 1,
      symbol: "AAPL",
      name: "Apple Inc.",
      sector: "Technology",
      last_price: 180.95,
      change_amount: 2.45,
      change_percent: 1.37,
      volume: 63521400,
      market_cap: 2850000000000,
      pe_ratio: 30.1,
      dividend_yield: 0.5,
      high_52week: 198.23,
      low_52week: 124.17,
      updated_at: new Date().toISOString(),
      isFavorite: false,
    },
    {
      id: 2,
      symbol: "MSFT",
      name: "Microsoft Corporation",
      sector: "Technology",
      last_price: 380.75,
      change_amount: 4.8,
      change_percent: 1.28,
      volume: 24680500,
      market_cap: 2830000000000,
      pe_ratio: 36.4,
      dividend_yield: 0.7,
      high_52week: 386.12,
      low_52week: 260.68,
      updated_at: new Date().toISOString(),
      isFavorite: false,
    },
  ];
}

// Start real-time stock updates
const startRealTimeUpdates = () => {
  console.log("Starting real-time stock updates (every second)...");
  setInterval(async () => {
    if (!isMarketOpen()) return;

    try {
      const symbols = stockService.getDefaultSymbols();
      const now = Date.now();
      const index = Math.floor((now / 1000) % symbols.length);
      const symbol = symbols[index];

      try {
        const data = await stockService.getReliableStockData(symbol);
        const sanitizedData = {
          id: data.id,
          symbol: data.symbol,
          name: data.name,
          last_price: data.last_price,
          change_amount: data.change_amount,
          change_percent: data.change_percent,
          volume: data.volume,
          market_cap: data.market_cap,
          updated_at: new Date().toISOString(),
        };
        stockData[symbol] = { ...sanitizedData };
        io.to(`stock:${symbol}`).emit("stock-update", sanitizedData);
      } catch (symbolError) {
        console.error(`Error updating ${symbol}:`, symbolError.message);
      }
    } catch (error) {
      console.error("Real-time update loop error:", error);
    }
  }, 1000);
};

// Start mock data refresh loop (fallback mode)
const startMockDataRefresh = () => {
  console.log("Starting mock data refresh cycle...");
  setInterval(() => {
    const mockStocks = getMockStocks();
    mockStocks.forEach((stock) => {
      const randomChange = (Math.random() * 4 - 2) / 100;
      const newPrice = stock.last_price * (1 + randomChange);
      const changeAmount = newPrice - stock.last_price;
      stock.last_price = parseFloat(newPrice.toFixed(2));
      stock.change_amount = parseFloat(changeAmount.toFixed(2));
      stock.change_percent = parseFloat((randomChange * 100).toFixed(2));
      stock.updated_at = new Date().toISOString();
      stockData[stock.symbol] = stock;
      io.to(`stock:${stock.symbol}`).emit("stock-update", stock);
    });
    console.log(`Mock data refreshed at ${new Date().toISOString()}`);
  }, 60000);
};

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  const clientSubscriptions = new Set();

  socket.on("subscribe", (stockIds) => {
    const stocks = Array.isArray(stockIds) ? stockIds : [stockIds];
    const newStocks = stocks.filter(
      (stockId) => !clientSubscriptions.has(stockId)
    );
    if (newStocks.length === 0) return;

    newStocks.forEach((stockId) => {
      socket.join(`stock:${stockId}`);
      clientSubscriptions.add(stockId);
    });
    console.log(`Client ${socket.id} subscribed to stocks:`, newStocks);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    clientSubscriptions.clear();
  });
});

// Test SSH connection
async function testSshConnection() {
  console.log("Running SSH connection diagnostic...");
  const { Client } = require("ssh2");
  const client = new Client();

  return new Promise((resolve) => {
    client.on("ready", () => {
      console.log("✅ SSH connection test successful!");
      client.exec('echo "SSH connection working"', (err, stream) => {
        if (err) {
          console.error("SSH exec error:", err);
          client.end();
          resolve(false);
          return;
        }

        stream.on("data", (data) => {
          console.log("SSH STDOUT:", data.toString());
        });

        stream.on("close", () => {
          client.end();
          resolve(true);
        });
      });
    });

    client.on("error", (err) => {
      console.error("SSH Connection Test Error:", err);
      resolve(false);
    });

    client.connect({
      host: process.env.SSH_HOST,
      port: process.env.SSH_PORT || 22,
      username: process.env.SSH_USER,
      privateKey: fs.readFileSync(path.resolve(process.env.SSH_KEY_PATH)),
    });
  });
}

// Seed stock data if needed
const seedStockData = async () => {
  if (!pool) return false;

  try {
    const [existingStocks] = await executeQueryWithRetry(
      pool,
      "SELECT COUNT(*) as count FROM stocks"
    );

    if (existingStocks[0].count > 0) {
      console.log(
        `Database already has ${existingStocks[0].count} stocks. Skipping seeding.`
      );
      return true;
    }

    console.log("No stocks found. Seeding initial stock data...");
    const defaultSymbols = stockService.getDefaultSymbols();

    for (const symbol of defaultSymbols) {
      try {
        const stockData = await stockService.getReliableStockData(symbol);

        await executeQueryWithRetry(
          pool,
          `INSERT INTO stocks 
           (symbol, name, sector, last_price, change_amount, change_percent, volume, market_cap, pe_ratio, dividend_yield, high_52week, low_52week)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            symbol,
            stockData.name || `${symbol} Inc.`,
            stockData.sector || "Unknown",
            stockData.last_price || 0,
            stockData.change_amount || 0,
            stockData.change_percent || 0,
            stockData.volume || 0,
            stockData.market_cap || 0,
            stockData.pe_ratio || 0,
            stockData.dividend_yield || 0,
            stockData.high_52week || 0,
            stockData.low_52week || 0,
          ]
        );

        console.log(`Added stock ${symbol} to database`);
      } catch (error) {
        console.error(`Error seeding stock ${symbol}:`, error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return true;
  } catch (error) {
    console.error("Error seeding stock data:", error);
    return false;
  }
};

// Preload stock data
const preloadStockData = async () => {
  try {
    const symbols = ["AAPL", "MSFT", "AMZN", "GOOGL", "META"];
    console.log("Preloading stock data for core symbols...");
    await stockService.getMultipleStocks(symbols);
    console.log("Stock data preloaded successfully");
  } catch (error) {
    console.error("Failed to preload stock data:", error);
  }
};

// Clean up resources on shutdown
process.on("SIGINT", async () => {
  console.log("🛑 Shutting down server...");

  // Check for active backfill jobs
  const activeJobs = backfillService.getActiveJobs
    ? backfillService.getActiveJobs()
    : [];

  if (activeJobs && activeJobs.length > 0) {
    console.log(
      `Gracefully stopping ${activeJobs.length} active backfill jobs`
    );
  }

  if (connectionMonitorInterval) {
    clearInterval(connectionMonitorInterval);
    console.log("✅ Connection monitor stopped.");
  }

  if (pool) {
    await closeConnection(pool);
    console.log("✅ Database connections closed.");
  }

  if (polygonDataCollector.task) {
    polygonDataCollector.task.stop();
    console.log("✅ Polygon data collector stopped.");
  }

  if (polygonWSCollector) {
    polygonWSCollector.stop();
    console.log("✅ Polygon WebSocket collector stopped.");
  }

  process.exit(0);
});

// Authentication middleware - IMPORTANT: Define before using in routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user;
    next();
  });
};

// Admin middleware
const isAdmin = async (req, res, next) => {
  try {
    const [users] = await executeQueryWithRetry(
      pool,
      "SELECT role FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!users.length || users[0].role !== "admin") {
      return res
        .status(403)
        .json({ message: "Access denied: Admin rights required" });
    }
    next();
  } catch (error) {
    console.error("Admin check error:", error);
    res.status(500).json({ message: "Server error during permission check" });
  }
};

// Define backfill router - IMPORTANT: Define after auth middleware
const backfillRouter = express.Router();

// Trigger a backfill job
backfillRouter.post("/trigger", async (req, res) => {
  try {
    const { startDate, endDate, symbols, force = false } = req.body;

    // If specific parameters provided, customize backfill
    if (startDate && endDate && symbols) {
      // Custom backfill for specific time range and symbols
      const jobId = await backfillService.triggerBackfill({
        startTime: new Date(startDate),
        endTime: new Date(endDate),
        symbols: Array.isArray(symbols) ? symbols : [symbols],
        force,
      });

      res.status(200).json({
        success: true,
        jobId,
        message: `Custom backfill job initiated for ${
          Array.isArray(symbols) ? symbols.length : 1
        } symbol(s) from ${startDate} to ${endDate}`,
      });
    } else {
      // Standard backfill - auto-detect gaps
      const jobId = await backfillService.triggerBackfill({ force });

      res.status(200).json({
        success: true,
        jobId,
        message: "Backfill job initiated to detect and fill all gaps",
      });
    }
  } catch (error) {
    console.error("Backfill trigger error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get status of backfill job
backfillRouter.get("/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await backfillService.getBackfillStatus(jobId);

    res.status(200).json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("Backfill status check error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Trigger backfill for specific stocks
backfillRouter.post("/stocks", async (req, res) => {
  try {
    const { symbols, days = 7 } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of stock symbols",
      });
    }

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    const jobId = await backfillService.triggerBackfill({
      startTime,
      endTime,
      symbols,
      force: true,
    });

    res.status(200).json({
      success: true,
      jobId,
      message: `Backfill job initiated for ${symbols.length} symbols over the last ${days} days`,
    });
  } catch (error) {
    console.error("Stock backfill error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API Routes - Public endpoints
app.get("/api/test", (req, res) => {
  res.status(200).json({
    message: "API is running",
    timestamp: new Date().toISOString(),
    database: { connected: databaseConnected },
  });
});

app.get("/api/health", async (req, res) => {
  try {
    if (!pool) {
      return res.status(200).json({
        status: "partial",
        message: "API is running but database is not connected",
        database: { connected: false },
        timestamp: new Date().toISOString(),
        redis: "mock (not connected)",
      });
    }

    try {
      const connection = await pool.getConnection();
      const [dbInfo] = await connection.execute(
        "SELECT DATABASE() as db_name, VERSION() as db_version"
      );
      const [tables] = await connection.execute(
        `SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = ?`,
        [process.env.DB_NAME]
      );

      let stocksStatus = "unknown";
      let stockCount = 0;
      try {
        const [stocksResult] = await connection.execute(
          "SELECT COUNT(*) as count FROM stocks"
        );
        stockCount = stocksResult[0].count;
        stocksStatus = stockCount > 0 ? "populated" : "empty";
      } catch (stockErr) {
        stocksStatus = "error";
        console.error("Error checking stocks table:", stockErr.message);
      }

      connection.release();

      res.status(200).json({
        status: "healthy",
        database: {
          name: dbInfo[0].db_name,
          version: dbInfo[0].db_version,
          tables: tables[0].table_count,
          connection: "SSH tunnel active",
          stocks: { status: stocksStatus, count: stockCount },
        },
        timestamp: new Date().toISOString(),
        redis: "mock (not connected)",
      });
    } catch (dbConnError) {
      console.error("Database connection error in health check:", dbConnError);
      res.status(200).json({
        status: "partial",
        message: "API is running but database connection failed",
        database: { error: dbConnError.message, code: dbConnError.code },
        timestamp: new Date().toISOString(),
        redis: "mock (not connected)",
      });
    }
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({
      status: "unhealthy",
      database: { error: error.message, code: error.code },
      timestamp: new Date().toISOString(),
      redis: "mock (not connected)",
    });
  }
});

// Non-authenticated routes for login and registration
app.post("/api/register", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    if (!pool)
      return res.status(503).json({
        message: "Database connection not established",
        error: "Try again later",
      });

    const [existingUsers] = await executeQueryWithRetry(
      pool,
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0)
      return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await executeQueryWithRetry(
      pool,
      "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
      [email, hashedPassword, name || email.split("@")[0], "user"]
    );

    await executeQueryWithRetry(
      pool,
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
      [
        result.insertId,
        "register",
        "users",
        result.insertId,
        JSON.stringify({ email, name }),
        req.ip,
      ]
    );

    res.status(201).json({
      message: "User registered successfully",
      userId: result.insertId,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    if (!pool)
      return res.status(503).json({
        message: "Database connection not established",
        error: "Try again later",
      });

    const [users] = await executeQueryWithRetry(
      pool,
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0)
      return res.status(400).json({ message: "Invalid email or password" });

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    await executeQueryWithRetry(
      pool,
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
      [
        user.id,
        "login",
        "users",
        user.id,
        JSON.stringify({ timestamp: new Date().toISOString() }),
        req.ip,
      ]
    );

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Register middleware and routes in the correct order
// IMPORTANT: Apply middleware to groups of routes
app.use("/api", authenticateToken); // This applies auth to all /api routes
app.use("/api/backfill", backfillRouter); // Register backfill routes

// Protected routes
app.get("/api/profile", async (req, res) => {
  try {
    if (!pool)
      return res.status(503).json({
        message: "Database connection not established",
        error: "Try again later",
      });

    const [users] = await executeQueryWithRetry(
      pool,
      "SELECT id, email, name, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );

    if (users.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user: users[0] });
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Stock routes
app.get("/api/stocks", async (req, res) => {
  try {
    const symbols = stockService.getDefaultSymbols();
    try {
      const stocks = await stockService.getMultipleStocks(symbols);
      res.status(200).json({
        stocks,
        source: stocks.some((s) => s.source === "api" || s.source === "scrape")
          ? "api"
          : "historical",
      });
    } catch (apiError) {
      console.error("API error:", apiError);
      const fallbackData = stockService.loadFallbackData();
      if (fallbackData && fallbackData.length > 0)
        return res
          .status(200)
          .json({ stocks: fallbackData, source: "historical" });
      res.status(200).json({
        stocks: getMockStocks(),
        source: "mock",
        error: apiError.message,
      });
    }
  } catch (error) {
    console.error("Get stocks error:", error);
    res.status(500).json({
      message: "Server error while fetching stocks",
      error: error.message,
    });
  }
});

app.get("/api/stocks/:id/history", async (req, res) => {
  const stockId = req.params.id;
  const minutes = parseInt(req.query.minutes) || 60;
  const symbolMap = {
    1: "AAPL",
    2: "MSFT",
    3: "AMZN",
    4: "GOOGL",
    5: "META",
    6: "TSLA",
    7: "NVDA",
    8: "JPM",
    9: "V",
    10: "JNJ",
  };

  const symbol = symbolMap[stockId];
  if (!symbol)
    return res
      .status(404)
      .json({ message: "Stock not found", error: "Invalid stock ID" });

  try {
    try {
      const history = await stockService.getHistoricalData(symbol);
      res.status(200).json({ history, source: "api" });
    } catch (error) {
      console.error("Get stock history error:", error);
      const mockHistory = generateMockPriceHistory(stockId, minutes);
      res.status(200).json({ history: mockHistory, source: "mock" });
    }
  } catch (error) {
    console.error("Get stock history error:", error);
    res.status(500).json({
      message: "Server error processing history request",
      error: error.message,
    });
  }
});

// Favorites routes
app.get("/api/favorites", async (req, res) => {
  try {
    if (!pool) return res.status(200).json({ favorites: [] });

    const [favorites] = await executeQueryWithRetry(
      pool,
      `SELECT f.*, s.symbol, s.name, s.last_price, s.change_amount, s.change_percent
       FROM favorites f
       JOIN stocks s ON f.stock_id = s.id
       WHERE f.user_id = ?`,
      [req.user.id]
    );

    res.status(200).json({ favorites });
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(200).json({ favorites: [], error: error.message });
  }
});

app.post("/api/favorites", async (req, res) => {
  const { stockId, isFavorite } = req.body;
  try {
    if (!pool)
      return res.status(200).json({
        success: true,
        message: `Stock ${stockId} ${
          isFavorite ? "added to" : "removed from"
        } favorites (DB not connected)`,
      });

    if (isFavorite) {
      try {
        await executeQueryWithRetry(
          pool,
          "INSERT INTO favorites (user_id, stock_id) VALUES (?, ?)",
          [req.user.id, stockId]
        );
      } catch (insertError) {
        if (!insertError.message.includes("Duplicate entry")) throw insertError;
      }
    } else {
      await executeQueryWithRetry(
        pool,
        "DELETE FROM favorites WHERE user_id = ? AND stock_id = ?",
        [req.user.id, stockId]
      );
    }

    await executeQueryWithRetry(
      pool,
      "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
      [
        req.user.id,
        isFavorite ? "add_favorite" : "remove_favorite",
        "stocks",
        stockId,
        JSON.stringify({ timestamp: new Date().toISOString() }),
        req.ip,
      ]
    );

    res.status(200).json({
      success: true,
      message: `Stock ${stockId} ${
        isFavorite ? "added to" : "removed from"
      } favorites`,
    });
  } catch (error) {
    console.error("Toggle favorite error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Alerts routes
app.get("/api/alerts", async (req, res) => {
  try {
    if (!pool) return res.status(200).json({ alerts: [] });

    const [alerts] = await executeQueryWithRetry(
      pool,
      `SELECT a.*, s.symbol, s.name, s.last_price, s.change_amount, s.change_percent
       FROM alerts a
       JOIN stocks s ON a.stock_id = s.id
       WHERE a.user_id = ?`,
      [req.user.id]
    );

    res.status(200).json({ alerts });
  } catch (error) {
    console.error("Get alerts error:", error);
    res.status(200).json({ alerts: [], error: error.message });
  }
});

app.post("/api/alerts", async (req, res) => {
  const {
    stockId,
    threshold,
    direction,
    type = "interval",
    timeInterval,
    basePrice,
  } = req.body;

  try {
    if (!stockId || !threshold || !direction)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });

    if (type === "interval" && !timeInterval)
      return res.status(400).json({
        success: false,
        message: "Time interval is required for interval alerts",
      });
    if (type === "target" && !basePrice)
      return res.status(400).json({
        success: false,
        message: "Base price is required for target alerts",
      });

    if (pool) {
      try {
        const [existingAlerts] = await executeQueryWithRetry(
          pool,
          "SELECT * FROM alerts WHERE user_id = ? AND stock_id = ?",
          [req.user.id, stockId]
        );

        const alertDetails = {
          type,
          ...(type === "interval" ? { timeInterval } : {}),
          ...(type === "target" ? { basePrice } : {}),
        };

        if (existingAlerts.length > 0) {
          await executeQueryWithRetry(
            pool,
            "UPDATE alerts SET threshold = ?, direction = ?, details = ?, is_triggered = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND stock_id = ?",
            [
              threshold,
              direction,
              JSON.stringify(alertDetails),
              req.user.id,
              stockId,
            ]
          );
        } else {
          const [configResult] = await executeQueryWithRetry(
            pool,
            "SELECT config_value FROM system_config WHERE config_key = ?",
            ["max_alerts_per_user"]
          );

          const maxAlerts = parseInt(configResult[0]?.config_value || "20");

          const [userAlertCount] = await executeQueryWithRetry(
            pool,
            "SELECT COUNT(*) as count FROM alerts WHERE user_id = ?",
            [req.user.id]
          );

          if (userAlertCount[0].count >= maxAlerts)
            return res.status(400).json({
              success: false,
              message: `You have reached the maximum limit of ${maxAlerts} alerts.`,
            });

          await executeQueryWithRetry(
            pool,
            "INSERT INTO alerts (user_id, stock_id, threshold, direction, details, is_triggered) VALUES (?, ?, ?, ?, ?, 0)",
            [
              req.user.id,
              stockId,
              threshold,
              direction,
              JSON.stringify(alertDetails),
            ]
          );
        }

        await executeQueryWithRetry(
          pool,
          "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
          [
            req.user.id,
            existingAlerts.length > 0 ? "update_alert" : "create_alert",
            "alerts",
            stockId,
            JSON.stringify({ threshold, direction, ...alertDetails }),
            req.ip,
          ]
        );
      } catch (dbError) {
        console.error("Database error setting alert:", dbError);
        throw new Error(`Database error: ${dbError.message}`);
      }
    }

    let alertDescription;
    if (type === "interval") {
      alertDescription = `${threshold}% change in ${timeInterval} minutes`;
    } else {
      const thresholdDecimal = threshold / 100;
      const upperTarget = (basePrice * (1 + thresholdDecimal)).toFixed(2);
      const lowerTarget = (basePrice * (1 - thresholdDecimal)).toFixed(2);
      if (direction === "above")
        alertDescription = `price rises above ${upperTarget}`;
      else if (direction === "below")
        alertDescription = `price falls below ${lowerTarget}`;
      else
        alertDescription = `price rises above ${upperTarget} or falls below ${lowerTarget}`;
    }

    res.status(200).json({
      success: true,
      message: `Alert set for stock ${stockId} when ${alertDescription}`,
    });
  } catch (error) {
    console.error("Set alert error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin routes
app.get("/api/admin/system", [authenticateToken, isAdmin], async (req, res) => {
  try {
    const [configs] = await executeQueryWithRetry(
      pool,
      "SELECT * FROM system_config"
    );
    const [logs] = await executeQueryWithRetry(
      pool,
      `SELECT a.*, u.email 
       FROM audit_log a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );

    const [userStats] = await executeQueryWithRetry(
      pool,
      "SELECT COUNT(*) as count FROM users"
    );
    const [stockStats] = await executeQueryWithRetry(
      pool,
      "SELECT COUNT(*) as count FROM stocks"
    );
    const [alertStats] = await executeQueryWithRetry(
      pool,
      "SELECT COUNT(*) as count FROM alerts"
    );
    const [favoriteStats] = await executeQueryWithRetry(
      pool,
      "SELECT COUNT(*) as count FROM favorites"
    );

    res.status(200).json({
      config: configs,
      stats: {
        users: userStats[0].count,
        stocks: stockStats[0].count,
        alerts: alertStats[0].count,
        favorites: favoriteStats[0].count,
      },
      recentActivity: logs,
    });
  } catch (error) {
    console.error("Admin system status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put(
  "/api/admin/config/:key",
  [authenticateToken, isAdmin],
  async (req, res) => {
    const { key } = req.params;
    const { value, description } = req.body;

    try {
      await executeQueryWithRetry(
        pool,
        "UPDATE system_config SET config_value = ?, description = ? WHERE config_key = ?",
        [value, description, key]
      );

      await executeQueryWithRetry(
        pool,
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
        [
          req.user.id,
          "update_config",
          "system_config",
          null,
          JSON.stringify({ key, value, description }),
          req.ip,
        ]
      );

      res.status(200).json({
        success: true,
        message: `Configuration ${key} updated successfully`,
      });
    } catch (error) {
      console.error("Admin config update error:", error);
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

app.get("/api/admin/users", [authenticateToken, isAdmin], async (req, res) => {
  try {
    const [users] = await executeQueryWithRetry(
      pool,
      `SELECT u.*, 
             (SELECT COUNT(*) FROM favorites WHERE user_id = u.id) as favorite_count,
             (SELECT COUNT(*) FROM alerts WHERE user_id = u.id) as alert_count,
             (SELECT MAX(created_at) FROM audit_log WHERE user_id = u.id) as last_activity
      FROM users u
      ORDER BY u.created_at DESC`
    );

    const sanitizedUsers = users.map((user) => {
      const { password, ...safeUser } = user;
      return safeUser;
    });

    res.status(200).json({ users: sanitizedUsers });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post(
  "/api/admin/stocks",
  [authenticateToken, isAdmin],
  async (req, res) => {
    const { symbol, name, sector } = req.body;

    try {
      if (!symbol || !name)
        return res
          .status(400)
          .json({ success: false, message: "Symbol and name are required" });

      const stockData = await stockService.getReliableStockData(symbol);

      const [existingStocks] = await executeQueryWithRetry(
        pool,
        "SELECT * FROM stocks WHERE symbol = ?",
        [symbol]
      );

      let result;
      if (existingStocks.length > 0) {
        await executeQueryWithRetry(
          pool,
          `UPDATE stocks 
         SET name = ?, sector = ?, last_price = ?, change_amount = ?, 
         change_percent = ?, volume = ?, market_cap = ?, pe_ratio = ?,
         dividend_yield = ?, high_52week = ?, low_52week = ?
         WHERE symbol = ?`,
          [
            name,
            sector || stockData.sector,
            stockData.last_price || 0,
            stockData.change_amount || 0,
            stockData.change_percent || 0,
            stockData.volume || 0,
            stockData.market_cap || 0,
            stockData.pe_ratio || 0,
            stockData.dividend_yield || 0,
            stockData.high_52week || 0,
            stockData.low_52week || 0,
            symbol,
          ]
        );

        res.status(200).json({
          success: true,
          message: `Stock ${symbol} updated successfully`,
          stockId: existingStocks[0].id,
        });
      } else {
        [result] = await executeQueryWithRetry(
          pool,
          `INSERT INTO stocks 
         (symbol, name, sector, last_price, change_amount, change_percent, 
          volume, market_cap, pe_ratio, dividend_yield, high_52week, low_52week)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            symbol,
            name,
            sector || stockData.sector,
            stockData.last_price || 0,
            stockData.change_amount || 0,
            stockData.change_percent || 0,
            stockData.volume || 0,
            stockData.market_cap || 0,
            stockData.pe_ratio || 0,
            stockData.dividend_yield || 0,
            stockData.high_52week || 0,
            stockData.low_52week || 0,
          ]
        );

        res.status(201).json({
          success: true,
          message: `Stock ${symbol} added successfully`,
          stockId: result.insertId,
        });
      }

      await executeQueryWithRetry(
        pool,
        "INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)",
        [
          req.user.id,
          existingStocks.length > 0 ? "update_stock" : "create_stock",
          "stocks",
          existingStocks.length > 0 ? existingStocks[0].id : result.insertId,
          JSON.stringify({ symbol, name, sector }),
          req.ip,
        ]
      );
    } catch (error) {
      console.error("Admin stock update error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Server error",
    error:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message,
  });
});

// Server startup
const startServer = async () => {
  try {
    // Test SSH connection first
    const sshTestResult = await testSshConnection();
    if (!sshTestResult) {
      console.warn(
        "⚠️ SSH connection test failed. There may be issues with your SSH configuration."
      );
    } else {
      console.log(
        "✅ SSH connection test passed. Continuing with server startup."
      );
    }

    // Initialize database connection
    const dbConnected = await initializeDatabase();
    if (!dbConnected) {
      console.warn(
        "⚠️ Failed to connect to database. Server will start in fallback mode."
      );
      console.warn("👉 Check database connection settings in .env file");
    } else {
      // Seed stock data if needed
      await seedStockData();
    }

    // Initialize backfill service with database pool
    if (dbConnected) {
      backfillService.setPool(pool);

      // Schedule automatic backfills
      backfillService.scheduleBackfills(60); // Check for gaps every 60 minutes
      console.log(
        "✅ Scheduled automatic data backfill checks (60-minute interval)"
      );
    }

    // Assign pool to Polygon data collector
    polygonDataCollector.pool = pool;

    // Initialize Polygon data collector
    const polygonDataInitialized = await polygonDataCollector.initialize();
    if (polygonDataInitialized) {
      polygonDataCollector.startCollector(10);
      console.log("✅ Polygon data collector started (10-second interval)");
    } else {
      console.warn("⚠️ Failed to initialize Polygon data collector");
    }

    // Initialize Polygon WebSocket collector
    const polygonWSInitialized = await polygonWSCollector.initialize();
    if (polygonWSInitialized) {
      polygonWSCollector.start();
      console.log("✅ Polygon WebSocket collector started");
    } else {
      console.warn("⚠️ Failed to initialize Polygon WebSocket collector");
    }

    // Preload stock data and start updates
    preloadStockData();
    startRealTimeUpdates();

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      if (dbConnected) {
        console.log(`✅ Database: ${process.env.DB_NAME} (via SSH tunnel)`);
      } else {
        console.log(`⚠️ Database connection failed. Using fallback mode.`);
        startMockDataRefresh();
      }
    });
  } catch (error) {
    console.error("❌ Server startup error:", error);
    process.exit(1);
  }
};

// Start the server
startServer();
