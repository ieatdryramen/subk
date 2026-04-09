import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/Toast';
import CommandPalette from './components/CommandPalette';
import ErrorBoundary from './components/ErrorBoundary';
import NotFoundPage from './pages/NotFoundPage';
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
import ReportsPage from './pages/ReportsPage';

// SubK (Teaming/Marketplace/Opportunities) pages
import OpportunitiesPage from './pages/OpportunitiesPage';
import OpportunityBoardPage from './pages/OpportunityBoardPage';
import MarketplacePage from './pages/MarketplacePage';
import TeamingInboxPage from './pages/TeamingInboxPage';
import SubkPrimesPage from './pages/SubkPrimesPage';
import SubProfilePage from './pages/SubProfilePage';
import CoachPage from './pages/CoachPage';
import OnboardingPage from './pages/OnboardingPage';
import PublicProfilePage from './pages/PublicProfilePage';
import ProposalTrackerPage from './pages/ProposalTrackerPage';
import CompetitiveIntelPage from './pages/CompetitiveIntelPage';

// Batch 1: Critical Gaps
import ForecastPipelinePage from './pages/ForecastPipelinePage';
import AwardHistoryPage from './pages/AwardHistoryPage';
import SpendingAnalyticsPage from './pages/SpendingAnalyticsPage';
import CaptureManagerPage from './pages/CaptureManagerPage';

// Batch 2: Differentiators
import RateBenchmarksPage from './pages/RateBenchmarksPage';
import ComplianceCenterPage from './pages/ComplianceCenterPage';
import FOIACenterPage from './pages/FOIACenterPage';
import SubConPlanPage from './pages/SubConPlanPage';

// Batch 3: Nice-to-Haves
import GovConEventsPage from './pages/GovConEventsPage';
import MarketResearchPage from './pages/MarketResearchPage';
import ContractVehiclesPage from './pages/ContractVehiclesPage';
import GovContactsPage from './pages/GovContactsPage';
import BidDecisionPage from './pages/BidDecisionPage';
import RevenueForecastPage from './pages/RevenueForecastPage';

const Protected = ({ children, skipOnboarding }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!skipOnboarding && !user.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return children;
};

const PublicOnly = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" replace />;
};

const App = () => (
  <ErrorBoundary>
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
        <Route path="/opportunity-board" element={<Protected><OpportunityBoardPage /></Protected>} />
        <Route path="/opp-board" element={<Navigate to="/opportunity-board" replace />} />
        <Route path="/proposals" element={<Protected><ProposalTrackerPage /></Protected>} />
        <Route path="/competitive" element={<Protected><CompetitiveIntelPage /></Protected>} />
        <Route path="/forecast" element={<Protected><ForecastPipelinePage /></Protected>} />
        <Route path="/award-history" element={<Protected><AwardHistoryPage /></Protected>} />
        <Route path="/spending-analytics" element={<Protected><SpendingAnalyticsPage /></Protected>} />
        <Route path="/capture" element={<Protected><CaptureManagerPage /></Protected>} />

        {/* Batch 2: Differentiators */}
        <Route path="/rate-benchmarks" element={<Protected><RateBenchmarksPage /></Protected>} />
        <Route path="/compliance" element={<Protected><ComplianceCenterPage /></Protected>} />
        <Route path="/foia-center" element={<Protected><FOIACenterPage /></Protected>} />
        <Route path="/subcon-plan" element={<Protected><SubConPlanPage /></Protected>} />

        {/* Batch 3: Nice-to-Haves */}
        <Route path="/events" element={<Protected><GovConEventsPage /></Protected>} />
        <Route path="/market-research" element={<Protected><MarketResearchPage /></Protected>} />
        <Route path="/contract-vehicles" element={<Protected><ContractVehiclesPage /></Protected>} />
        <Route path="/gov-contacts" element={<Protected><GovContactsPage /></Protected>} />
        <Route path="/bid-decision" element={<Protected><BidDecisionPage /></Protected>} />
        <Route path="/revenue-forecast" element={<Protected><RevenueForecastPage /></Protected>} />

        {/* BD / Sales / Outreach */}
        <Route path="/lists" element={<Protected><LeadListsPage /></Protected>} />
        <Route path="/lists/:id" element={<Protected><LeadListDetailPage /></Protected>} />
        <Route path="/pipeline" element={<Protected><PipelinePage /></Protected>} />
        <Route path="/reminders" element={<Protected><RemindersPage /></Protected>} />
        <Route path="/templates" element={<Protected><TemplatesPage /></Protected>} />
        <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />

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
        <Route path="/onboarding" element={<Protected skipOnboarding><OnboardingPage /></Protected>} />

        {/* Public routes */}
        <Route path="/sub/:id" element={<PublicProfilePage />} />

        {/* Route aliases for common URLs */}
        <Route path="/leads" element={<Navigate to="/lists" replace />} />
        <Route path="/calendar" element={<Navigate to="/events" replace />} />
        <Route path="/relationships" element={<Navigate to="/gov-contacts" replace />} />
        <Route path="/settings" element={<Navigate to="/profile" replace />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </ToastProvider>
  </AuthProvider>
  </ErrorBoundary>
);

// Show landing page to logged-out users, dashboard to logged-in
const PublicOrApp = () => {
  const { user } = useAuth();
  if (!user) return <LandingPage />;
  if (!user.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
