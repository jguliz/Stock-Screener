import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import page components
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import PrivateRoute from './components/Common/PrivateRoute';

// Lazy-loaded components for better performance
const Favorites = React.lazy(() => import('./components/Favorites/Favorites'));
const Alerts = React.lazy(() => import('./components/Alerts/Alerts'));
const Profile = React.lazy(() => import('./components/Profile/Profile'));
const Support = React.lazy(() => import('./components/Support/Support'));
const TermsOfService = React.lazy(() => import('./components/Legal/TermsOfService'));
const PrivacyPolicy = React.lazy(() => import('./components/Legal/PrivacyPolicy'));

const AppRoutes = () => {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <Routes>
        {/* Authentication Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/favorites" 
          element={
            <PrivateRoute>
              <Favorites />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/alerts" 
          element={
            <PrivateRoute>
              <Alerts />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } 
        />

        {/* Public Routes */}
        <Route path="/support" element={<Support />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </React.Suspense>
  );
};

export default AppRoutes;