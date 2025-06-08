# Backfill System Integration Guide

## Overview

The backfill system automatically detects and fills gaps in your stock data, ensuring your charts remain continuous even when your server is offline. This guide explains how to implement the system in your StockScope application.

## Files to Create

### 1. `backfill-service.js`

Create this file in your backend root directory.

```javascript
// Copy the entire code from the "complete-backfill-solution" artifact
```

### 2. Server Integration

Modify your `server.js` file following the pattern in "server-integration-solution" artifact. The key changes are:

1. Import the backfill service
2. Define auth middleware before using it
3. Create backfill routes after middleware is defined
4. Initialize backfill service in server startup
5. Integrate with shutdown handlers

## Installation Steps

1. Install dependencies:
   ```bash
   npm install uuid
   ```

2. Create `backfill-service.js` with the provided code

3. Update `server.js` with the correct middleware ordering:
   - First define all middleware functions
   - Then create route handlers
   - Register routes in the correct order

4. Add the backfill service initialization to your startup sequence

## Usage

### API Endpoints

The backfill system exposes the following API endpoints:

- `POST /api/backfill/trigger` - Trigger automatic gap detection and backfill
- `GET /api/backfill/status/:jobId` - Check status of a backfill job
- `POST /api/backfill/stocks` - Backfill specific stocks for a time period

### Example API Usage

```javascript
// Trigger auto-detection and backfill
const response = await fetch('/api/backfill/trigger', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ force: true })
});
const result = await response.json();
const jobId = result.jobId;

// Check job status
const statusResponse = await fetch(`/api/backfill/status/${jobId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const jobStatus = await statusResponse.json();

// Backfill specific stocks
const customResponse = await fetch('/api/backfill/stocks', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    symbols: ['AAPL', 'MSFT', 'GOOGL'],
    days: 7
  })
});
```

### Frontend Integration

For the frontend, you can use the React components provided in the backfill-integration artifact:

1. `BackfillManager` - For manually triggering and monitoring backfill operations
2. `ChartWithBackfill` - A wrapper component that detects gaps in chart data

Example usage:

```jsx
import ChartWithBackfill from './components/ChartWithBackfill';

function StockChart({ stockId, symbol }) {
  const [chartData, setChartData] = useState(null);
  
  // Fetch stock data...
  
  return (
    <ChartWithBackfill
      stockId={stockId}
      symbol={symbol}
      chartData={chartData}
      onRefresh={() => fetchStockData()}
      renderChart={(data) => (
        <LineChart data={data} width={800} height={400} />
      )}
    />
  );
}
```

## Troubleshooting

### Common Issues

1. **Middleware ordering errors**: Make sure middleware is defined before it's used
2. **Database connection issues**: Verify pool is properly shared with the backfill service
3. **API authorization errors**: Verify token is properly passed in Authorization header

### Testing the System

To verify the system is working:

1. Start your server and monitor console logs
2. Check for "Scheduled automatic data backfill checks" message
3. Test the API endpoints with Postman or a similar tool
4. Monitor database tables for inserted data

## Monitoring

The backfill system logs all operations to the console and tracks job status in memory. 
For a production environment, you may want to enhance the system to store job status in the database.

## Security Considerations

The backfill endpoints require authentication to prevent unauthorized access. Make sure 
your JWT tokens are properly protected and have appropriate expiration times.