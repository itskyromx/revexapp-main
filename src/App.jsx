import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { useAuth } from '@/lib/useAuth';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Feed from '@/pages/Feed';
import UploadPage from '@/pages/Upload';
import ItemDetail from '@/pages/ItemDetail';
import Profile from '@/pages/Profile';
import Inbox from '@/pages/Inbox';
import Chat from '@/pages/Chat';
import Home from '@/pages/Home';
import Watch from '@/pages/Watch';
import Search from '@/pages/Search';
import Onboarding from '@/pages/Onboarding';
import HaulDetail from '@/pages/HaulDetail';
import Reports from '@/pages/Reports';
import Orders from '@/pages/Orders';
import SettingsPage from '@/pages/Settings';
import TermsAndConditions from '@/pages/TermsAndConditions';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
// Add page imports here

const AuthenticatedApp = () => {
  const { user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Google OAuth does not collect a Revex username at registration. Require
  // one on the onboarding screen before letting that account into the app.
  const needsUsername = !user?.display_name?.trim();
  if (isAuthenticated && needsUsername && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/" element={<Feed />} />
      <Route path="/home" element={<Home />} />
      <Route path="/watch" element={<Watch />} />
      <Route path="/search" element={<Search />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/haul/:postId" element={<HaulDetail />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/upload/:draftId" element={<UploadPage />} />
      <Route path="/profile/:userId" element={<Profile />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/item/:itemId" element={<ItemDetail />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/chat/:userId" element={<Chat />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
