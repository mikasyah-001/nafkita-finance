import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import { Toaster } from "sonner";

export default function Layout() {
  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative shadow-xl">
      <main className="pb-24 min-h-screen">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}