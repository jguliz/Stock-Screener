// backfill-api.js
const express = require("express");
const router = express.Router();
const {
  triggerBackfill,
  performBackfill,
  getBackfillStatus,
} = require("./backfill-service");

// Endpoint to trigger backfill manually
router.post("/trigger", async (req, res) => {
  try {
    // Optional: Add authentication check here

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
        message: `Custom backfill job initiated for ${symbols.length} symbols from ${startDate} to ${endDate}`,
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
