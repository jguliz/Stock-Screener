const mysql = require("mysql");
const fs = require("fs");
const path = require("path");
const util = require("util");
const { Client } = require("ssh2");
require("dotenv").config();

// Global variables
let mysqlPool = null;
let sshTunnel = null;
let localPort = parseInt(process.env.LOCAL_PORT || "33306");

// Resolve SSH key path
function resolveSSHKeyPath(keyPath) {
  try {
    if (!keyPath) {
      throw new Error("SSH_KEY_PATH is not defined in environment variables");
    }

    const normalizedKeyPath = keyPath.replace(/^\.\//, "");
    const possiblePaths = [
      path.resolve(normalizedKeyPath),
      path.resolve(process.cwd(), normalizedKeyPath),
      path.resolve(process.cwd(), "backend", normalizedKeyPath),
      path.resolve(__dirname, normalizedKeyPath),
    ];

    console.log("Attempting to find SSH key at:");
    for (const fullPath of possiblePaths) {
      console.log(`- ${fullPath}`);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ SSH Key found at: ${fullPath}`);
        return fullPath;
      }
    }

    throw new Error(
      `SSH Key file not found. Tried paths: ${possiblePaths.join(", ")}`
    );
  } catch (error) {
    console.error("Error resolving SSH key path:", error);
    throw error;
  }
}

// Create connection pool
const createConnectionPool = async () => {
  // Validate environment variables
  const requiredEnvVars = [
    "SSH_HOST",
    "SSH_USER",
    "SSH_KEY_PATH",
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  // Log successful loading of environment variables
  console.log("Environment variables loaded successfully");
  console.log("Database configuration:", {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || "3306",
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
  });

  // Print SSH configuration for debugging
  console.log("SSH Configuration:", {
    host: process.env.SSH_HOST,
    port: process.env.SSH_PORT || "22",
    user: process.env.SSH_USER,
    keyPath: process.env.SSH_KEY_PATH,
  });

  // Load SSH key
  let sshKeyPath;
  try {
    sshKeyPath = resolveSSHKeyPath(process.env.SSH_KEY_PATH);
    console.log(`Using SSH key at: ${sshKeyPath}`);
  } catch (error) {
    console.error("Failed to resolve SSH key path:", error);
    throw error;
  }

  return new Promise((resolve, reject) => {
    // Check if we already have a connection
    if (mysqlPool) {
      console.log("Reusing existing database connection pool");
      resolve(mysqlPool);
      return;
    }

    const sshClient = new Client();

    sshClient.on("ready", () => {
      console.log("✅ SSH connection established");

      // Create MySQL connection configuration
      const dbConfig = {
        host: "127.0.0.1",
        port: localPort,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        acquireTimeout: 30000, // Increase timeout
        connectTimeout: 30000, // Increase connection timeout
        multipleStatements: true, // Allow multiple statements
      };

      // Forward remote port to local port
      const net = require("net");

      // Create SSH tunnel using direct TCP forwarding
      const sshServer = net.createServer((socket) => {
        sshClient.forwardOut(
          socket.remoteAddress,
          socket.remotePort,
          process.env.DB_HOST,
          parseInt(process.env.DB_PORT || "3306"),
          (err, stream) => {
            if (err) {
              socket.end();
              console.error("SSH forwarding error:", err);
              return;
            }

            socket.pipe(stream);
            stream.pipe(socket);

            socket.on("close", () => {
              stream.end();
            });

            stream.on("close", () => {
              socket.end();
            });
          }
        );
      });

      // Handle server errors
      sshServer.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.log(`Port ${localPort} already in use, trying to reuse it`);

          // Try to create the pool without creating a new server
          try {
            const pool = mysql.createPool(dbConfig);

            // Promisify pool methods
            pool.queryPromise = util.promisify(pool.query).bind(pool);
            pool.getConnectionPromise = util
              .promisify(pool.getConnection)
              .bind(pool);

            // Test the connection
            pool.getConnection((connErr, connection) => {
              if (connErr) {
                console.error("Database connection test failed:", connErr);
                reject(connErr);
                return;
              }

              connection.query("SELECT 1 AS test", (queryErr, results) => {
                connection.release();

                if (queryErr) {
                  console.error("Database query test failed:", queryErr);
                  reject(queryErr);
                  return;
                }

                console.log("✅ Database connection validated (reused port)");

                // Store references
                mysqlPool = pool;
                sshTunnel = {
                  client: sshClient,
                  close: function () {
                    sshClient.end();
                  },
                };

                pool.sshTunnel = sshTunnel;
                resolve(pool);
              });
            });
          } catch (poolError) {
            console.error("Error creating pool on existing port:", poolError);
            reject(poolError);
          }
        } else {
          console.error("SSH server error:", err);
          reject(err);
        }
      });

      // Listen on local port
      sshServer.listen(localPort, "127.0.0.1", () => {
        console.log(`✅ SSH tunnel listening on localhost:${localPort}`);

        // Create MySQL connection pool
        try {
          console.log("Creating MySQL connection pool through tunnel...");
          const pool = mysql.createPool(dbConfig);

          // Promisify pool methods
          pool.queryPromise = util.promisify(pool.query).bind(pool);
          pool.getConnectionPromise = util
            .promisify(pool.getConnection)
            .bind(pool);

          // Test the connection
          pool.getConnection((connErr, connection) => {
            if (connErr) {
              console.error("Database connection test failed:", connErr);
              sshServer.close();
              sshClient.end();
              reject(connErr);
              return;
            }

            connection.query("SELECT 1 AS test", (queryErr, results) => {
              connection.release();

              if (queryErr) {
                console.error("Database query test failed:", queryErr);
                sshServer.close();
                sshClient.end();
                reject(queryErr);
                return;
              }

              console.log("✅ Database connection validated");

              // Store references for cleanup
              mysqlPool = pool;
              sshTunnel = {
                server: sshServer,
                client: sshClient,
                close: function () {
                  sshServer.close();
                  sshClient.end();
                },
              };

              // Add cleanup methods
              pool.sshTunnel = sshTunnel;

              resolve(pool);
            });
          });
        } catch (poolError) {
          console.error("Error creating connection pool:", poolError);
          sshServer.close();
          sshClient.end();
          reject(poolError);
        }
      });
    });

    sshClient.on("error", (err) => {
      console.error("❌ SSH connection error:", err);
      reject(err);
    });

    // Connect to SSH server
    console.log(`Connecting to SSH server ${process.env.SSH_HOST}...`);
    try {
      const privateKey = fs.readFileSync(sshKeyPath);
      sshClient.connect({
        host: process.env.SSH_HOST,
        port: parseInt(process.env.SSH_PORT || "22"),
        username: process.env.SSH_USER,
        privateKey: privateKey,
        readyTimeout: 30000,
        keepaliveInterval: 10000,
        keepaliveCountMax: 3,
      });
    } catch (err) {
      console.error("❌ Error connecting to SSH server:", err);
      reject(err);
    }
  });
};

// Close connection
const closeConnection = (pool) => {
  if (pool) {
    console.log("Closing database connection pool...");
    pool.end((err) => {
      if (err) console.error("Error closing pool:", err);
    });
  }

  if (sshTunnel) {
    console.log("Closing SSH tunnel...");
    sshTunnel.close();
  }

  mysqlPool = null;
  sshTunnel = null;
};

// Execute query with retry
const executeQueryWithRetry = async (
  pool,
  query,
  params = [],
  maxRetries = 5
) => {
  if (!pool) {
    throw new Error("Database pool is not initialized");
  }

  let retries = 0;
  let lastError = null;

  while (retries <= maxRetries) {
    try {
      return new Promise((resolve, reject) => {
        pool.query(query, params, (err, results, fields) => {
          if (err) {
            reject(err);
            return;
          }
          resolve([results, fields]);
        });
      });
    } catch (error) {
      lastError = error;
      retries++;

      console.error(
        `Query error (attempt ${retries}/${maxRetries + 1}):`,
        error.message
      );

      // Wait before retry
      const delay = Math.min(1000 * Math.pow(1.5, retries), 5000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Max retries exceeded");
};

// Get pool
const getPool = () => {
  return mysqlPool;
};

// Export functions
module.exports = {
  createConnectionPool,
  closeConnection,
  executeQueryWithRetry,
  getPool,
};
