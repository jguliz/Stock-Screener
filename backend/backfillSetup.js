// backend/backfillSetup.js
const express = require("express");
const { scheduleBackfills } = require("./backfill-service");
const backfillRoutes = require("./routes/backfillRoutes");

/**
 * Register backfill system with the Express app
 * @param {Object} app - Express application instance
 * @param {Object} options - Configuration options
 */
function registerBackfillSystem(app, options = {}) {
  // Default configuration
  const config = {
    scheduleEnabled: true,
    intervalMinutes: 60,
    apiPrefix: "/api/backfill",
    requireAuth: true,
    ...options,
  };

  console.log("Registering backfill system with options:", config);

  // Create router
  const router = express.Router();

  // Apply authentication middleware if required
  if (config.requireAuth) {
    const authMiddleware = require("./middleware/auth");
    router.use(authMiddleware);
  }

  // Register backfill routes
  app.use(config.apiPrefix, backfillRoutes);

  // Schedule automatic backfills if enabled
  if (config.scheduleEnabled) {
    scheduleBackfills(config.intervalMinutes);
    console.log(
      `Scheduled automatic backfills every ${config.intervalMinutes} minutes`
    );
  }

  console.log("Backfill system registered successfully");

  return {
    router,
    scheduleBackfills,
  };
}

// Export a function to register the backfill routes
module.exports = registerBackfillSystem;

// -----

// backend/routes/backfillRoutes.js
const express = require("express");
const { triggerBackfill, getBackfillStatus } = require("../backfill-service");

const router = express.Router();

// Trigger a backfill job
router.post("/trigger", async (req, res) => {
  try {
    const { startDate, endDate, symbols, force = false } = req.body;

    // If specific parameters provided, customize backfill
    if (startDate && endDate && symbols) {
      // Custom backfill for specific time range and symbols
      const jobId = await triggerBackfill({
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
      const jobId = await triggerBackfill({ force });

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
router.get("/status/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await getBackfillStatus(jobId);

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
router.post("/stocks", async (req, res) => {
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

    const jobId = await triggerBackfill({
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

module.exports = router;
