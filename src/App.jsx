import { Suspense } from 'react';
import { lazyPage } from '@/lib/pagePrefetch';
import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import PageTransition from '@/components/PageTransition';
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
const Transactions = lazyPage(() => import('@/pages/Transactions'));
const AddTransaction = lazyPage(() => import('@/pages/AddTransaction'));
const Assets = lazyPage(() => import('@/pages/Assets'));
const Reports = lazyPage(() => import('@/pages/Reports'));
const Settings = lazyPage(() => import('@/pages/Settings'));
const Budget = lazyPage(() => import('@/pages/Budget'));
const AssetDashboard = lazyPage(() => import('@/pages/AssetDashboard'));
const ImportReport = lazyPage(() => import('@/pages/ImportReport'));
const PortfolioImport = lazyPage(() => import('@/pages/PortfolioImport'));
const AssetDetail = lazyPage(() => import('@/pages/AssetDetail'));
const TransactionDetail = lazyPage(() => import('@/pages/TransactionDetail'));
const Profile = lazyPage(() => import('@/pages/Profile'));
const Categories = lazyPage(() => import('@/pages/Categories'));
const InvestmentDetail = lazyPage(() => import('@/pages/InvestmentDetail'));
const Feedback = lazyPage(() => import('@/pages/Feedback'));
import Welcome from '@/pages/Welcome';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Mfa from '@/pages/Mfa';
const PartnerOnboarding = lazyPage(() => import('@/pages/PartnerOnboarding'));
const Admin = lazyPage(() => import('@/pages/Admin'));
const Transfer = lazyPage(() => import('@/pages/Transfer'));
const Debts = lazyPage(() => import('@/pages/Debts'));
const RecurringBills = lazyPage(() => import('@/pages/RecurringBills'));
const Reconciliation = lazyPage(() => import('@/pages/Reconciliation'));
const SavingsGoals = lazyPage(() => import('@/pages/SavingsGoals'));
const Approvals = lazyPage(() => import('@/pages/Approvals'));
const AssetMutations = lazyPage(() => import('@/pages/AssetMutations'));
const DataHealth = lazyPage(() => import('@/pages/DataHealth'));
const Zakat = lazyPage(() => import('@/pages/Zakat'));
const Panduan = lazyPage(() => import('@/pages/Panduan'));
const AuditKas = lazyPage(() => import('@/pages/AuditKas'));
const More = lazyPage(() => import('@/pages/More'));
const PartnerProfile = lazyPage(() => import('@/pages/PartnerProfile'));
const AutoIngest = lazyPage(() => import('@/pages/AutoIngest'));
const Wallet = lazyPage(() => import('@/pages/Wallet'));
const Cards = lazyPage(() => import('@/pages/Cards'));

// Halaman selain Beranda & auth dimuat saat dibuka (code-splitting), sehingga
// pembukaan pertama aplikasi jauh lebih ringan di jaringan lemah.
const RouteFallback = () => (
  <div className="px-5 pt-6 space-y-4" aria-busy="true" aria-label="Memuat halaman">
    <div className="h-7 w-40 rounded-lg bg-muted animate-pulse" />
    <div className="h-36 rounded-3xl bg-muted animate-pulse" />
    <div className="h-48 rounded-2xl bg-muted animate-pulse" />
  </div>
);

// Layar di luar Layout (sambutan & autentikasi) beranimasi per halaman.
// Seluruh area aplikasi memakai satu kunci ("app") agar Layout — sidebar &
// nav bawah — tetap terpasang; transisi antarhalaman di dalamnya ditangani
// Layout sendiri.
const STANDALONE_PATHS = ['/selamat-datang', '/login', '/register', '/forgot-password', '/reset-password', '/mfa'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();
  const transitionKey = STANDALONE_PATHS.includes(location.pathname) ? location.pathname : 'app';

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
    <AnimatePresence mode="wait" initial={false}>
    <PageTransition key={transitionKey}>
    <Suspense fallback={<RouteFallback />}>
    <Routes location={location}>
      <Route path="/selamat-datang" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Langkah kedua (MFA) setelah masuk dengan Google/SSO — lib/authMfaFlow.js kembali ke sini. */}
      <Route path="/mfa" element={<Mfa />} />
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
          <Route path="/impor-portofolio" element={<PortfolioImport />} />
          <Route path="/transaksi/:id" element={<TransactionDetail />} />
          <Route path="/transaksi/:id/edit" element={<AddTransaction />} />
          <Route path="/pengaturan" element={<Settings />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/profil/pasangan" element={<PartnerProfile />} />
          <Route path="/sambungkan-pasangan" element={<PartnerOnboarding />} />
          <Route path="/kategori" element={<Categories />} />
          <Route path="/asisten-struk" element={<Navigate to="/add" replace />} />
          <Route path="/aset/:id" element={<AssetDetail />} />
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
          <Route path="/lainnya" element={<More />} />
          <Route path="/catat-otomatis" element={<AutoIngest />} />
          <Route path="/dompet" element={<Wallet />} />
          <Route path="/kartu" element={<Cards />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
    </PageTransition>
    </AnimatePresence>
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
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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