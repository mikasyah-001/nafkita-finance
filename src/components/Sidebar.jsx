import { NavLink, Link } from "react-router-dom";
import { Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { mainItems, toolItems, accountItems } from "@/lib/navConfig";

function NavSection({ items }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            <span>{it.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const visibleAccountItems = accountItems.filter(
    (it) => !it.adminOnly || user?.role === "admin"
  );

  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border bg-sidebar h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-lg">NAFKITA</span>
        </Link>
      </div>

      <div className="px-3 py-4 flex-1 overflow-y-auto no-scrollbar flex flex-col gap-6">
        <NavSection items={mainItems} />
        <div>
          <p className="px-3 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Alat</p>
          <NavSection items={toolItems} />
        </div>
        <div>
          <p className="px-3 mb-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Akun</p>
          <NavSection items={visibleAccountItems} />
        </div>
      </div>

      <Link
        to="/add"
        className="mx-4 mb-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
      >
        <Plus className="w-5 h-5" />
        Tambah Transaksi
      </Link>
    </aside>
  );
}