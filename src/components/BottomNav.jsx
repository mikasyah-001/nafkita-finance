import { NavLink, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { Home, ReceiptText, Plus, Landmark, BarChart3, Grid, X, ArrowRightLeft, HandCoins, RefreshCw, Scale, Upload, Tags, Target, CheckCheck, Activity } from "lucide-react";

const items = [
  { to: "/", icon: Home, label: "Beranda", end: true },
  { to: "/riwayat", icon: ReceiptText, label: "Riwayat" },
  { to: "/aset", icon: Landmark, label: "Aset" },
];

const moreColorClasses = {
  blue: "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
  rose: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  teal: "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400",
  emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  indigo: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  orange: "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400",
  cyan: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400",
  red: "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400",
  slate: "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300",
};

const moreItems = [
  { to: "/transfer", icon: ArrowRightLeft, label: "Transfer", color: "blue" },
  { to: "/utang", icon: HandCoins, label: "Utang & Piutang", color: "rose" },
  { to: "/tagihan-berulang", icon: RefreshCw, label: "Tagihan Berulang", color: "amber" },
  { to: "/rekonsiliasi", icon: Scale, label: "Rekonsiliasi", color: "teal" },
  { to: "/target-tabungan", icon: Target, label: "Target Tabungan", color: "emerald" },
  { to: "/zakat", icon: HandCoins, label: "Zakat", color: "violet" },
  { to: "/persetujuan", icon: CheckCheck, label: "Persetujuan", color: "indigo" },
  { to: "/impor", icon: Upload, label: "Impor Data", color: "orange" },
  { to: "/kategori", icon: Tags, label: "Kategori", color: "cyan" },
  { to: "/kesehatan-data", icon: Activity, label: "Kesehatan Data", color: "red" },
  { to: "/laporan", icon: BarChart3, label: "Laporan", color: "slate" },
];

export default function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const hideNav = location.pathname === "/add" || location.pathname === "/impor";
  if (hideNav) return null;

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-background/90 backdrop-blur-lg border-t border-border z-50">
        <div className="flex items-end justify-around h-16 px-1">
          {items.slice(0, 2).map((it) => (
            <NavItem key={it.to} {...it} />
          ))}
          <Link
            to="/add"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
          >
            <span className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg active:scale-95 transition-transform -mt-3">
              <Plus className="w-6 h-6" />
            </span>
            <span className="text-[10px] text-muted-foreground -mt-0.5">Tambah</span>
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${moreColorClasses[it.color] || moreColorClasses.slate}`}>
                      <Icon className="w-5 h-5" />
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