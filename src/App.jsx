import { lazy, Suspense } from 'react';
import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { ThemeProvider } from 'next-themes';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PrivacyProvider } from '@/lib/PrivacyContext';
import { ScopeProvider } from '@/lib/ScopeContext';
import { ColorPrefsProvider } from '@/lib/ColorPrefsContext';
import Layout from '@/components/Layout';
import ConfirmHost from '@/components/ConfirmHost';
import Home from '@/pages/Home';
const Transactions = lazy(() => import('@/pages/Transactions'));
const AddTransaction = lazy(() => import('@/pages/AddTransaction'));
const Assets = lazy(() => import('@/pages/Assets'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const Budget = lazy(() => import('@/pages/Budget'));
const AssetDashboard = lazy(() => import('@/pages/AssetDashboard'));
const ImportReport = lazy(() => import('@/pages/ImportReport'));
const TransactionDetail = lazy(() => import('@/pages/TransactionDetail'));
const Profile = lazy(() => import('@/pages/Profile'));
const Categories = lazy(() => import('@/pages/Categories'));
const InvestmentDetail = lazy(() => import('@/pages/InvestmentDetail'));
const Feedback = lazy(() => import('@/pages/Feedback'));
import Welcome from '@/pages/Welcome';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
const PartnerOnboarding = lazy(() => import('@/pages/PartnerOnboarding'));
const Admin = lazy(() => import('@/pages/Admin'));
const Transfer = lazy(() => import('@/pages/Transfer'));
const Debts = lazy(() => import('@/pages/Debts'));
const RecurringBills = lazy(() => import('@/pages/RecurringBills'));
const Reconciliation = lazy(() => import('@/pages/Reconciliation'));
const SavingsGoals = lazy(() => import('@/pages/SavingsGoals'));
const Approvals = lazy(() => import('@/pages/Approvals'));
const AssetMutations = lazy(() => import('@/pages/AssetMutations'));
const DataHealth = lazy(() => import('@/pages/DataHealth'));
const Zakat = lazy(() => import('@/pages/Zakat'));
const Panduan = lazy(() => import('@/pages/Panduan'));
const AuditKas = lazy(() => import('@/pages/AuditKas'));

// Halaman selain Beranda & auth dimuat saat dibuka (code-splitting), sehingga
// pembukaan pertama aplikasi jauh lebih ringan di jaringan lemah.
const RouteFallback = () => (
  <div className="px-5 pt-6 space-y-4" aria-busy="true" aria-label="Memuat halaman">
    <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
    <div className="h-36 rounded-3xl bg-muted animate-pulse" />
    <div className="h-48 rounded-2xl bg-muted animate-pulse" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" aria-label="Memuat"></div>
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
    <Suspense fallback={<RouteFallback />}>
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
          <Route path="/ringkasan" element={<Navigate to="/laporan?tab=bulanan" replace />} />
          <Route path="/anggaran" element={<Budget />} />
          <Route path="/aset-dashboard" element={<AssetDashboard />} />
          <Route path="/impor" element={<ImportReport />} />
          <Route path="/transaksi/:id" element={<TransactionDetail />} />
          <Route path="/transaksi/:id/edit" element={<AddTransaction />} />
          <Route path="/pengaturan" element={<Settings />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/sambungkan-pasangan" element={<PartnerOnboarding />} />
          <Route path="/kategori" element={<Categories />} />
          <Route path="/asisten-struk" element={<Navigate to="/add" replace />} />
          <Route path="/investasi/:id" element={<InvestmentDetail />} />
          <Route path="/umpan-balik" element={<Feedback />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/utang" element={<Debts />} />
          <Route path="/tagihan-berulang" element={<RecurringBills />} />
          <Route path="/rekonsiliasi" element={<Reconciliation />} />
          <Route path="/target-tabungan" element={<SavingsGoals />} />
          <Route path="/persetujuan" element={<Approvals />} />
          <Route path="/mutasi-aset" element={<AssetMutations />} />
          <Route path="/kesehatan-data" element={<DataHealth />} />
          <Route path="/zakat" element={<Zakat />} />
          <Route path="/panduan" element={<Panduan />} />
          <Route path="/audit-kas" element={<AuditKas />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <PrivacyProvider>
          <ScopeProvider>
            <QueryClientProvider client={queryClientInstance}>
              <ColorPrefsProvider>
                <Router>
                  <ScrollToTop />
                  <AuthenticatedApp />
                </Router>
              </ColorPrefsProvider>
              <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-body)", borderRadius: "14px" } }} />
              <ConfirmHost />
            </QueryClientProvider>
          </ScopeProvider>
        </PrivacyProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App