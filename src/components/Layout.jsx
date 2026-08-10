import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import OfflineSyncManager from "./OfflineSyncManager";
import TransactionNotifier from "./TransactionNotifier";
import { Toaster } from "sonner";
import { useSeedCategories } from "@/hooks/useSeedCategories";

export default function Layout() {
  useSeedCategories();
  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative shadow-xl">
      <OfflineSyncManager />
      <TransactionNotifier />
      <main className="pb-24 min-h-screen">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}