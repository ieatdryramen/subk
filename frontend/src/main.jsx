import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import './index.css';

import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import LeadListsPage from './pages/LeadListsPage';
import LeadListDetailPage from './pages/LeadListDetailPage';
import TeamPage from './pages/TeamPage';
import BillingPage from './pages/BillingPage';
import AdminDashboard from './pages/AdminDashboard';
import CardScanPage from './pages/CardScanPage';
import PipelinePage from './pages/PipelinePage';
import TemplatesPage from './pages/TemplatesPage';

const Protected = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" replace />;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicOrApp />} />
        <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><AuthPage mode="register" /></PublicOnly>} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
        <Route path="/lists" element={<Protected><LeadListsPage /></Protected>} />
        <Route path="/lists/:id" element={<Protected><LeadListDetailPage /></Protected>} />
        <Route path="/team" element={<Protected><TeamPage /></Protected>} />
        <Route path="/billing" element={<Protected><BillingPage /></Protected>} />
        <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
        <Route path="/cardscan" element={<Protected><CardScanPage /></Protected>} />
        <Route path="/pipeline" element={<Protected><PipelinePage /></Protected>} />
        <Route path="/templates" element={<Protected><TemplatesPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

// Show landing page to logged-out users, dashboard to logged-in
const PublicOrApp = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
