import { NavLink, Link, useLocation } from "react-router-dom";
import { Home, ReceiptText, Plus, Landmark, BarChart3 } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Beranda", end: true },
  { to: "/riwayat", icon: ReceiptText, label: "Riwayat" },
  { to: "/aset", icon: Landmark, label: "Aset" },
  { to: "/laporan", icon: BarChart3, label: "Laporan" },
];

export default function BottomNav() {
  const location = useLocation();
  const hideNav = location.pathname === "/add" || location.pathname === "/impor";
  if (hideNav) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background/90 backdrop-blur-lg border-t border-border z-50">
      <div className="flex items-end justify-around h-16 px-2 relative">
        {items.slice(0, 2).map((it) => (
          <NavItem key={it.to} {...it} />
        ))}
        <Link
          to="/add"
          className="absolute -top-5 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="w-7 h-7" />
        </Link>
        {items.slice(2).map((it) => (
          <NavItem key={it.to} {...it} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground"
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
          <span className={`text-[10px] ${isActive ? "text-primary font-medium" : ""}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}