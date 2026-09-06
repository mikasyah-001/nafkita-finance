import { NavLink, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Home, ReceiptText, Plus, Landmark, BarChart3, Grid, X, ArrowRightLeft, HandCoins, RefreshCw, Scale, Upload, Tags, Target, CheckCheck } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Beranda", end: true },
  { to: "/riwayat", icon: ReceiptText, label: "Riwayat" },
  { to: "/aset", icon: Landmark, label: "Aset" },
  { to: "/laporan", icon: BarChart3, label: "Laporan" },
];

const moreItems = [
  { to: "/transfer", icon: ArrowRightLeft, label: "Transfer" },
  { to: "/utang", icon: HandCoins, label: "Utang & Piutang" },
  { to: "/tagihan-berulang", icon: RefreshCw, label: "Tagihan Berulang" },
  { to: "/rekonsiliasi", icon: Scale, label: "Rekonsiliasi" },
  { to: "/target-tabungan", icon: Target, label: "Target Tabungan" },
  { to: "/persetujuan", icon: CheckCheck, label: "Persetujuan" },
  { to: "/impor", icon: Upload, label: "Impor Data" },
  { to: "/kategori", icon: Tags, label: "Kategori" },
];

export default function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const hideNav = location.pathname === "/add" || location.pathname === "/impor";
  if (hideNav) return null;

  return (
    <>
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
          <button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground"
          >
            <Grid className="w-5 h-5" />
            <span className="text-[10px]">Lainnya</span>
          </button>
        </div>
      </nav>

      {showMore && (
        <div className="md:hidden fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background rounded-t-3xl border-t border-border p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Menu Lainnya</h2>
              <button onClick={() => setShowMore(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {moreItems.map((it) => {
                const Icon = it.icon;
                return (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border border-border hover:bg-muted transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[10px] text-center leading-tight">{it.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
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