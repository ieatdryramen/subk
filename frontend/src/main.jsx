import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import CommandPalette from './components/CommandPalette';
import './index.css';

// ProspectForge (BD/Sales) pages
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
import RemindersPage from './pages/RemindersPage';
import ActivityBoard from './pages/ActivityBoard';

// SubK (Teaming/Marketplace/Opportunities) pages
import OpportunitiesPage from './pages/OpportunitiesPage';
import MarketplacePage from './pages/MarketplacePage';
import TeamingInboxPage from './pages/TeamingInboxPage';
import SubkPrimesPage from './pages/SubkPrimesPage';
import SubProfilePage from './pages/SubProfilePage';
import CoachPage from './pages/CoachPage';
import OnboardingPage from './pages/OnboardingPage';
import PublicProfilePage from './pages/PublicProfilePage';

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
    <ToastProvider>
    <BrowserRouter>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<PublicOrApp />} />
        <Route path="/login" element={<PublicOnly><AuthPage mode="login" /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><AuthPage mode="register" /></PublicOnly>} />

        {/* Core */}
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />

        {/* Opportunities & Capture */}
        <Route path="/opportunities" element={<Protected><OpportunitiesPage /></Protected>} />

        {/* BD / Sales / Outreach */}
        <Route path="/lists" element={<Protected><LeadListsPage /></Protected>} />
        <Route path="/lists/:id" element={<Protected><LeadListDetailPage /></Protected>} />
        <Route path="/pipeline" element={<Protected><PipelinePage /></Protected>} />
        <Route path="/reminders" element={<Protected><RemindersPage /></Protected>} />
        <Route path="/templates" element={<Protected><TemplatesPage /></Protected>} />

        {/* Teaming & Marketplace */}
        <Route path="/marketplace" element={<Protected><MarketplacePage /></Protected>} />
        <Route path="/teaming" element={<Protected><TeamingInboxPage /></Protected>} />
        <Route path="/primes" element={<Protected><SubkPrimesPage /></Protected>} />
        <Route path="/sub-profile" element={<Protected><SubProfilePage /></Protected>} />

        {/* AI Coach */}
        <Route path="/coach" element={<Protected><CoachPage /></Protected>} />

        {/* Admin / Settings */}
        <Route path="/team" element={<Protected><TeamPage /></Protected>} />
        <Route path="/billing" element={<Protected><BillingPage /></Protected>} />
        <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
        <Route path="/cardscan" element={<Protected><CardScanPage /></Protected>} />
        <Route path="/activity" element={<Protected><ActivityBoard /></Protected>} />
        <Route path="/onboarding" element={<Protected><OnboardingPage /></Protected>} />

        {/* Public routes */}
        <Route path="/sub/:id" element={<PublicProfilePage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  </AuthProvider>
);

// Show landing page to logged-out users, dashboard to logged-in
const PublicOrApp = () => {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
