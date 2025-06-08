// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { StockProvider } from './context/StockContext';
import { ThemeProvider } from './context/ThemeContext'; // Import ThemeProvider
import PrivateRoute from './components/Common/PrivateRoute';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import './index.css';

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <StockProvider>
          <ThemeProvider> {/* Add ThemeProvider here */}
            <div className="min-h-screen">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  } 
                />
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="*" element={<Navigate to="/dashboard" />} />
              </Routes>
            </div>
          </ThemeProvider>
        </StockProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;