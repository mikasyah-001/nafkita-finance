import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import Sidebar from "./Sidebar";
import OfflineSyncManager from "./OfflineSyncManager";
import NotificationToaster from "./NotificationToaster";
import InstallPrompt from "./InstallPrompt";
import { Toaster } from "sonner";
import { useSeedCategories } from "@/hooks/useSeedCategories";

export default function Layout() {
  useSeedCategories();
  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <main className="flex-1 pb-28 md:pb-8 min-h-screen w-full max-w-md md:max-w-3xl mx-auto px-0 md:px-6 py-0 md:py-6 min-w-0">
        <Outlet />
      </main>
      <BottomNav />
      <OfflineSyncManager />
      <NotificationToaster />
      <InstallPrompt />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}