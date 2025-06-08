# StockScope 📈 (IN PROGRESS)

Real-time stock monitoring platform built with React and Node.js, featuring live market data, customizable alerts, and advanced screening capabilities.

## 🚀 Features

### Real-Time Market Data
- **Live Price Updates**: WebSocket integration for real-time stock prices
- **Historical Data**: View and analyze historical price movements
- **Market Overview**: Track major indices and market trends

### Stock Screening & Analysis
- **Custom Screeners**: Filter stocks by multiple criteria (price, volume, market cap, etc.)
- **Technical Indicators**: Built-in support for common technical analysis indicators
- **Watchlists**: Create and manage multiple watchlists for different investment strategies

### Alert System
- **Price Alerts**: Set custom price threshold alerts
- **Volume Alerts**: Monitor unusual volume activity
- **Email Notifications**: Receive alerts via email when conditions are met

### User Features
- **Secure Authentication**: JWT-based authentication system
- **Role-Based Access**: Different access levels for various user types
- **Audit Logging**: Comprehensive activity tracking for compliance
- **Dark Mode**: Toggle between light and dark themes

## 🛠️ Tech Stack

### Frontend
- **React** - UI framework
- **Recharts** - Data visualization
- **Socket.io Client** - Real-time updates
- **Tailwind CSS** - Styling
- **React Router** - Navigation

### Backend
- **Node.js** - Runtime environment
- **Express** - Web framework
- **MySQL** - Database
- **Socket.io** - WebSocket server
- **JWT** - Authentication
- **Polygon.io API** - Market data provider

### Infrastructure
- **AWS RDS** - Managed database
- **SSH Tunneling** - Secure database connections
- **Connection Pooling** - Efficient database management

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- Polygon.io API key (free tier available)
- AWS RDS instance (or local MySQL)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jguliz/StockScreener.git
   cd StockScreener
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Environment Configuration**
   
   Create `.env` files in both backend and frontend directories:

   **Backend `.env`:**
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database Configuration
   DB_HOST=your-rds-endpoint
   DB_PORT=3306
   DB_USER=your-username
   DB_PASSWORD=your-password
   DB_NAME=stockscope

   # SSH Tunnel (if using)
   SSH_HOST=your-ssh-host
   SSH_USER=your-ssh-user
   SSH_KEY_PATH=path/to/ssh/key

   # API Keys
   POLYGON_API_KEY=your-polygon-api-key

   # JWT Configuration
   JWT_SECRET=your-jwt-secret
   JWT_EXPIRE=7d

   # Email Configuration (for alerts)
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   ```

   **Frontend `.env`:**
   ```env
   REACT_APP_API_URL=http://localhost:5000
   REACT_APP_SOCKET_URL=http://localhost:5000
   ```

4. **Database Setup**
   ```bash
   # Run database migrations
   cd backend
   npm run migrate

   # Seed initial data (optional)
   npm run seed
   ```

## 🚀 Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm start
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Production Mode

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start the production server**
   ```bash
   cd backend
   npm run start
   ```

## 📁 Project Structure

```
StockScreener/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Custom middleware
│   │   ├── utils/           # Helper functions
│   │   └── config/          # Configuration files
│   ├── migrations/          # Database migrations
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API services
│   │   ├── utils/           # Helper functions
│   │   └── styles/          # CSS files
│   ├── public/              # Static assets
│   └── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Stocks
- `GET /api/stocks` - Get all stocks
- `GET /api/stocks/:symbol` - Get stock details
- `GET /api/stocks/:symbol/history` - Get historical data
- `POST /api/stocks/screen` - Screen stocks with filters

### Watchlists
- `GET /api/watchlists` - Get user watchlists
- `POST /api/watchlists` - Create new watchlist
- `PUT /api/watchlists/:id` - Update watchlist
- `DELETE /api/watchlists/:id` - Delete watchlist

### Alerts
- `GET /api/alerts` - Get user alerts
- `POST /api/alerts` - Create new alert
- `PUT /api/alerts/:id` - Update alert
- `DELETE /api/alerts/:id` - Delete alert

## 🧪 Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test

# Run e2e tests
npm run test:e2e
```

## 🚢 Deployment

### Using Docker

1. **Build the Docker image**
   ```bash
   docker build -t stockscope .
   ```

2. **Run the container**
   ```bash
   docker run -p 5000:5000 --env-file .env stockscope
   ```

### Manual Deployment

1. Set up a production MySQL database
2. Configure environment variables on your server
3. Build the frontend and deploy static files
4. Deploy the backend Node.js application
5. Set up a reverse proxy (nginx/Apache)
6. Configure SSL certificates

Your Name - jgulizia1205@gmail.com

Project Link: https://github.com/jguliz/StockScreener
