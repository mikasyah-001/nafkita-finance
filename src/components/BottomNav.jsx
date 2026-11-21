import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, ReceiptText, Plus, Landmark, LayoutGrid } from "lucide-react";
import { moreItems, isNavHidden } from "@/lib/navConfig";

// Nav bawah: pil mengambang di kiri berisi 4 tujuan, tombol Catat bulat
// terpisah di KANAN — mudah dijangkau jempol kanan tanpa menggeser
// genggaman (dulu tombol Catat di tengah). Tab aktif melebar dengan label;
// tab lain hanya ikon (label tetap dibacakan pembaca layar).
const items = [
  { to: "/", icon: Home, label: "Beranda", end: true },
  { to: "/riwayat", icon: ReceiptText, label: "Riwayat" },
  { to: "/aset", icon: Landmark, label: "Aset" },
  { to: "/lainnya", icon: LayoutGrid, label: "Lainnya" },
];

export default function BottomNav() {
  const location = useLocation();
  if (isNavHidden(location.pathname)) return null;

  return (
    <nav
      aria-label="Navigasi utama"
      className="no-select md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 px-4 pb-[calc(0.7rem+env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="flex items-center gap-3">
        <div className="pointer-events-auto flex-1 flex items-center justify-between h-[62px] px-1.5 rounded-full bg-card/90 backdrop-blur-xl border border-border shadow-[0_14px_40px_-18px_hsl(var(--hero-from)/0.55)]">
          {items.map((it) => <NavItem key={it.to} {...it} />)}
        </div>
        <Link
          to="/add"
          aria-label="Catat transaksi"
          className="pointer-events-auto shrink-0 w-[62px] h-[62px] rounded-full bg-gold text-gold-foreground flex items-center justify-center shadow-[0_12px_26px_-10px_hsl(var(--gold)/0.95)] ring-4 ring-background/70 active:scale-95 transition-transform"
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </Link>
      </div>
    </nav>
  );
}

function NavItem({ to, icon: Icon, label, end }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // "Lainnya" juga menyala saat berada di salah satu halaman di dalam menunya.
  const inMore = to === "/lainnya" && moreItems.some((it) => pathname === it.to || pathname.startsWith(`${it.to}/`));
  const isCurrent = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  const active = isCurrent || inMore;

  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      // Ketuk tab yang sedang aktif = kembali ke akar tab tanpa menumpuk riwayat.
      onClick={(e) => {
        if (!isCurrent) return;
        e.preventDefault();
        navigate(to, { replace: true });
      }}
      className={`relative flex items-center justify-center gap-1.5 h-[50px] rounded-full transition-colors ${active ? "px-4 text-primary" : "w-[50px] text-muted-foreground active:text-foreground"}`}
    >
      {active && (
        <motion.span
          layoutId="bottomnav-active"
          className="absolute inset-0 rounded-full bg-primary/10"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className="relative w-5 h-5 shrink-0" strokeWidth={active ? 2.3 : 2} />
      {active && <span className="relative text-[13px] font-semibold whitespace-nowrap">{label}</span>}
    </NavLink>
  );
}
