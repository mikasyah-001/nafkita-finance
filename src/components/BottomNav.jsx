import { NavLink, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, ReceiptText, Plus, Landmark, LayoutGrid, X } from "lucide-react";
import { moreGroups, moreItems, moreToneClasses } from "@/lib/navConfig";

const items = [
  { to: "/", icon: Home, label: "Beranda", end: true },
  { to: "/riwayat", icon: ReceiptText, label: "Riwayat" },
  { to: "/aset", icon: Landmark, label: "Aset" },
];

export default function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  // Tutup sheet saat rute berubah & saat tombol Escape ditekan.
  useEffect(() => { setShowMore(false); }, [location.pathname]);
  useEffect(() => {
    if (!showMore) return;
    const onKey = (e) => { if (e.key === "Escape") setShowMore(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showMore]);

  const hideNav = location.pathname === "/add" || location.pathname === "/impor" || /^\/transaksi\/[^/]+\/edit$/.test(location.pathname);
  if (hideNav) return null;

  // Tab "Lainnya" ikut menyala bila halaman aktif berada di dalam menunya.
  const moreActive = moreItems.some((it) => location.pathname.startsWith(it.to));

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="no-select md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-3 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pointer-events-none"
      >
        <div className="pointer-events-auto flex items-end justify-around h-[66px] px-1 rounded-[26px] bg-card/90 backdrop-blur-xl border border-border shadow-[0_14px_40px_-18px_hsl(var(--hero-from)/0.55)]">
          {items.slice(0, 2).map((it) => (
            <NavItem key={it.to} {...it} />
          ))}
          <Link
            to="/add"
            aria-label="Tambah transaksi"
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
          >
            <span className="w-[52px] h-[52px] rounded-full bg-gold text-gold-foreground flex items-center justify-center shadow-[0_10px_22px_-8px_hsl(var(--gold)/0.9)] ring-4 ring-background active:scale-95 transition-transform -mt-6">
              <Plus className="w-6 h-6" strokeWidth={2.5} />
            </span>
            <span className="text-[11px] font-medium text-foreground/80 mt-0.5">Catat</span>
          </Link>
          {items.slice(2).map((it) => (
            <NavItem key={it.to} {...it} />
          ))}
          <button
            onClick={() => setShowMore(true)}
            aria-haspopup="dialog"
            aria-expanded={showMore}
            className={`relative flex flex-col items-center justify-center gap-1 flex-1 h-[54px] my-1.5 mx-0.5 rounded-[20px] transition-colors ${moreActive ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className={`text-[11px] ${moreActive ? "font-semibold" : ""}`}>Lainnya</span>
          </button>
        </div>
      </nav>

      {showMore && (
        <div
          className="md:hidden fixed inset-0 z-[60] bg-foreground/20 backdrop-blur-[2px] animate-in fade-in-0 duration-150"
          onClick={() => setShowMore(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu lainnya"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md max-h-[85vh] overflow-y-auto bg-card rounded-t-3xl border-t border-border px-5 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-6 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-base">Menu lainnya</h2>
              <button
                onClick={() => setShowMore(false)}
                aria-label="Tutup menu"
                className="btn-icon btn-icon-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {moreGroups.map((g) => (
              <section key={g.title} className="mt-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 px-1">{g.title}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        className={({ isActive }) =>
                          `flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-2xl transition-colors ${isActive ? "bg-primary/10" : "active:bg-muted"}`
                        }
                      >
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${moreToneClasses[g.tone]}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] text-center leading-tight text-foreground/85">{it.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </section>
            ))}
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
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-1 flex-1 h-[54px] my-1.5 mx-0.5 rounded-[20px] transition-colors ${isActive ? "text-primary bg-primary/10" : "text-muted-foreground"}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 2} />
          <span className={`text-[11px] ${isActive ? "font-semibold" : ""}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
