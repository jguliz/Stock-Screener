// services/polygonWebSocketCollector.js
require("dotenv").config();
const WebSocket = require("ws");
const database = require("../database");
const { tickers } = require("../config");
const cron = require("node-cron");

class PolygonWebSocketCollector {
  constructor() {
    this.pool = null;
    this.ws = null;
    this.symbols = tickers;
    this.connected = false;
    this.cleanupRunning = false;
  }

  async initialize() {
    this.pool = await database.createConnectionPool();
    console.log("Polygon WebSocket collector initialized");
    return true;
  }

  async query(sql, params) {
    return new Promise((resolve, reject) => {
      this.pool.query(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  connect() {
    if (this.connected) return;

    this.ws = new WebSocket("wss://socket.polygon.io/stocks");

    this.ws.on("open", () => {
      console.log("✅ WS connected — sending auth");
      this.ws.send(
        JSON.stringify({
          action: "auth",
          params: process.env.POLYGON_API_KEY,
        })
      );
    });

    this.ws.on("message", async (raw) => {
      const text = raw.toString();
      console.log("📨 WS text:", text);

      let msgs;
      try {
        msgs = JSON.parse(text);
      } catch (e) {
        console.error("❌ JSON parse failed:", e);
        return;
      }

      for (const msg of msgs) {
        // 1) On auth_success, subscribe to trades and 1s aggregates
        if (msg.ev === "status" && msg.status === "auth_success") {
          console.log("🔑 Auth successful — subscribing to T.* and A.*");
          const tradeParams = this.symbols.map((s) => `T.${s}`).join(",");
          const aggParams = this.symbols.map((s) => `A.${s}`).join(",");
          this.ws.send(
            JSON.stringify({ action: "subscribe", params: tradeParams })
          );
          this.ws.send(
            JSON.stringify({ action: "subscribe", params: aggParams })
          );
          console.log(`Subscribed to: ${tradeParams} and ${aggParams}`);
          continue;
        }

        // 2) Ignore other status messages
        if (msg.ev === "status") {
          console.log("⚪ WS status:", msg);
          continue;
        }

        // 3) Trade events → price_history
        if (msg.ev === "T") {
          const { sym, p: price, s: volume, t: ts } = msg;
          console.log(`📈 TRADE ${sym} @ ${price} ×${volume}`);
          try {
            const rows = await this.query(
              "SELECT id FROM stocks WHERE symbol = ?",
              [sym]
            );
            if (rows.length) {
              const stockId = rows[0].id;
              await this.query(
                `INSERT INTO price_history
                   (stock_id, price, volume, timestamp, source)
                 VALUES (?, ?, ?, FROM_UNIXTIME(?/1000), 'websocket')`,
                [stockId, price, volume, ts]
              );
              console.log(`  ✔ Inserted trade for ${sym}`);
            } else {
              console.warn(`  ⚠️ No stock record for ${sym}`);
            }
          } catch (err) {
            console.error(`Error inserting trade for ${sym}:`, err);
          }
          continue;
        }

        // 4) Per-second aggregates → aggregate_history
        if (msg.ev === "A") {
          const {
            sym,
            o: open,
            h: high,
            l: low,
            c: close,
            v: volume,
            vw,
            s: startTs,
          } = msg;
          console.log(
            `📊 1s BAR ${sym}: o=${open},h=${high},l=${low},c=${close},v=${volume}`
          );
          try {
            const rows = await this.query(
              "SELECT id FROM stocks WHERE symbol = ?",
              [sym]
            );
            if (rows.length) {
              const stockId = rows[0].id;
              await this.query(
                `INSERT INTO aggregate_history
                   (stock_id, open_price, high_price, low_price, close_price,
                    volume, volume_weighted_avg, timestamp, source)
                 VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?/1000), 'websocket')`,
                [stockId, open, high, low, close, volume, vw, startTs]
              );
              console.log(`  ✔ Saved 1s bar for ${sym}`);
            } else {
              console.warn(`  ⚠️ No stock record for ${sym}`);
            }
          } catch (err) {
            console.error(`Error inserting 1s bar for ${sym}:`, err);
          }
          continue;
        }
      }
    });

    this.ws.on("error", (err) => {
      console.error("WS error:", err);
      this.connected = false;
    });

    this.ws.on("close", () => {
      console.log("WS closed, reconnecting in 5s");
      this.connected = false;
      setTimeout(() => this.connect(), 5000);
    });

    this.connected = true;
  }

  start() {
    this.connect();

    // Schedule cleanup every 5 minutes instead of every minute
    // This reduces contention and gives more time between cleanup operations
    cron.schedule("*/5 * * * *", async () => {
      // Skip if another cleanup is still running
      if (this.cleanupRunning) {
        console.log("Skipping cleanup - previous cleanup still running");
        return;
      }

      this.cleanupWebsocketData().catch((err) => {
        console.error("Scheduled cleanup error:", err);
        this.cleanupRunning = false;
      });
    });
  }

  // Complete rewrite of the cleanup approach using ID-based pagination
  // which avoids long-running transactions and lock timeouts
  async cleanupWebsocketData() {
    if (this.cleanupRunning) {
      return;
    }

    this.cleanupRunning = true;
    const batchSize = 250; // Much smaller batches
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - 15);

    console.log(
      `Starting websocket data cleanup (cutoff: ${cutoffTime.toISOString()})`
    );

    try {
      // Clean price_history in small batches with ID-based pagination
      await this.cleanupTableInBatches("price_history", cutoffTime, batchSize);

      // Then clean aggregate_history
      await this.cleanupTableInBatches(
        "aggregate_history",
        cutoffTime,
        batchSize
      );

      console.log("⏲️ Websocket data cleanup completed successfully");
    } catch (err) {
      console.error("Cleanup error:", err);
    } finally {
      this.cleanupRunning = false;
    }
  }

  async cleanupTableInBatches(tableName, cutoffTime, batchSize) {
    let hasMoreRecords = true;
    let deletedTotal = 0;
    let lastId = 0;
    const maxAttempts = 5;

    console.log(`Starting cleanup of ${tableName}`);

    while (hasMoreRecords) {
      let attempt = 0;
      let deleted = 0;

      while (attempt < maxAttempts) {
        try {
          // First find IDs to delete in a separate query
          const idsToDelete = await this.query(
            `SELECT id FROM ${tableName}
             WHERE source = 'websocket'
             AND timestamp < ?
             AND id > ?
             ORDER BY id
             LIMIT ?`,
            [cutoffTime, lastId, batchSize]
          );

          if (idsToDelete.length === 0) {
            hasMoreRecords = false;
            break;
          }

          // Extract just the IDs
          const ids = idsToDelete.map((row) => row.id);
          lastId = ids[ids.length - 1];

          // Then delete those specific IDs (much faster query)
          const result = await this.query(
            `DELETE FROM ${tableName} WHERE id IN (?)`,
            [ids]
          );

          deleted = result.affectedRows || 0;
          deletedTotal += deleted;
          console.log(
            `Deleted ${deleted} records from ${tableName} (total: ${deletedTotal})`
          );

          // Success - break out of retry loop
          break;
        } catch (err) {
          attempt++;
          console.error(
            `Error cleaning ${tableName} (attempt ${attempt}/${maxAttempts}):`,
            err
          );

          // Wait before retrying
          if (attempt < maxAttempts) {
            const delay = 1000 * Math.pow(2, attempt);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          } else {
            throw err; // Max attempts reached, propagate error
          }
        }
      }

      // Small pause between batches to reduce database load
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(
      `Completed cleanup of ${tableName} - deleted ${deletedTotal} records`
    );
  }

  stop() {
    if (this.ws) this.ws.close();
  }
}

module.exports = new PolygonWebSocketCollector();
