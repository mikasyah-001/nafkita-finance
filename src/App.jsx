import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PrivacyProvider } from '@/lib/PrivacyContext';
import { ScopeProvider } from '@/lib/ScopeContext';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Transactions from '@/pages/Transactions';
import AddTransaction from '@/pages/AddTransaction';
import Assets from '@/pages/Assets';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Budget from '@/pages/Budget';
import AssetDashboard from '@/pages/AssetDashboard';
import ImportReport from '@/pages/ImportReport';
import TransactionDetail from '@/pages/TransactionDetail';
import Profile from '@/pages/Profile';
import Categories from '@/pages/Categories';
import Ringkasan from '@/pages/Ringkasan';
import InvestmentDetail from '@/pages/InvestmentDetail';
import Feedback from '@/pages/Feedback';
import Welcome from '@/pages/Welcome';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import PartnerOnboarding from '@/pages/PartnerOnboarding';
import Admin from '@/pages/Admin';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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

  // Render the main app
  return (
    <Routes>
      <Route path="/selamat-datang" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/selamat-datang" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/riwayat" element={<Transactions />} />
          <Route path="/add" element={<AddTransaction />} />
          <Route path="/aset" element={<Assets />} />
          <Route path="/laporan" element={<Reports />} />
          <Route path="/ringkasan" element={<Ringkasan />} />
          <Route path="/anggaran" element={<Budget />} />
          <Route path="/aset-dashboard" element={<AssetDashboard />} />
          <Route path="/impor" element={<ImportReport />} />
          <Route path="/transaksi/:id" element={<TransactionDetail />} />
          <Route path="/pengaturan" element={<Settings />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/sambungkan-pasangan" element={<PartnerOnboarding />} />
          <Route path="/kategori" element={<Categories />} />
          <Route path="/asisten-struk" element={<Navigate to="/add" replace />} />
          <Route path="/investasi/:id" element={<InvestmentDetail />} />
          <Route path="/umpan-balik" element={<Feedback />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <PrivacyProvider>
        <ScopeProvider>
          <QueryClientProvider client={queryClientInstance}>
            <Router>
              <ScrollToTop />
              <AuthenticatedApp />
            </Router>
            <Toaster />
          </QueryClientProvider>
        </ScopeProvider>
      </PrivacyProvider>
    </AuthProvider>
  )
}

export default App