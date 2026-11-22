import { useState } from "react";
import { Link } from "react-router-dom";
import PlanEditSheet from "@/components/PlanEditSheet";
import { ChevronRight, User, MessageSquare, Shield, ArrowRight, Pencil } from "lucide-react";
import { useMe, usePendingApprovals, useRecurringBills, useIncomingTransactions } from "@/hooks/useFinance";
import { usePartnership } from "@/hooks/usePartnership";
import { useMonthPace } from "@/hooks/useMonthPace";
import { useScope } from "@/lib/ScopeContext";
import { moreGroups, moreToneClasses } from "@/lib/navConfig";
import { formatDate } from "@/lib/finance";
import Money from "@/components/Money";
import ThemeToggle from "@/components/ThemeToggle";
import { Image as SmartImage } from "@/components/ui/image";

// Halaman "Lainnya": pengganti sheet grid ikon. Daftar berjudul + satu baris
// keterangan per alat, dikelompokkan per tujuan — pengguna baru tidak perlu
// menebak beda "Rekonsiliasi" dan "Audit Kas".
export default function More() {
  const { data: me } = useMe();
  const { partners } = usePartnership();
  const { scope } = useScope();
  const { pace, currency, now, plan, summary, ready } = useMonthPace({ scope });
  const [editPlan, setEditPlan] = useState(false);
  const { data: approvals } = usePendingApprovals();
  const { data: bills = [] } = useRecurringBills();
  const { data: incoming = [] } = useIncomingTransactions();

  const pending = approvals?.pending_approvals?.length || 0;
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  const dueBills = bills.filter((b) => b.created_by_id === me?.id && b.status === "active" && b.next_date && b.next_date <= soon).length;
  const badges = { "/persetujuan": pending, "/tagihan-berulang": dueBills, "/catat-otomatis": incoming.length };
  const partnerName = partners?.[0]?.full_name;

  return (
    <div className="px-5 pt-6 pb-6">
      <h1 className="text-[26px] font-extrabold tracking-tight mb-4">Lainnya</h1>

      {/* Profil */}
      <Link to="/profil" className="surface p-3.5 flex items-center gap-3 mb-3 active:scale-[0.99] transition-transform">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          {me?.photo_url
            ? <SmartImage src={me.photo_url} alt="foto profil" className="w-full h-full" fittingType="fill" />
            : <User className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] leading-tight truncate">{me?.full_name || "Profil saya"}</p>
          <p className="text-xs text-muted-foreground truncate">{partnerName ? `Terhubung dengan ${partnerName}` : "Belum terhubung dengan pasangan"}</p>
          <p className="text-xs text-muted-foreground truncate">{me?.email}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
      </Link>

      {/* Rencana belanja bulan ini — angka = rencana pemasukan − rencana menabung */}
      <section className="surface p-4 mb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Rencana belanja {formatDate(now, "MMMM")}</p>
            <p className="text-[11px] text-muted-foreground">{scope === "private" ? "Pribadi" : "Bersama"} · {currency}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pace && <p className="text-sm font-bold tabular-nums"><Money value={pace.budget} currency={currency} format="short" /></p>}
            <button type="button" onClick={() => setEditPlan(true)} disabled={!ready} className="btn-secondary btn-sm h-8 px-3 disabled:opacity-50"><Pencil className="w-3.5 h-3.5" /> {pace ? "Ubah" : "Atur"}</button>
          </div>
        </div>
        {pace ? (
          <>
            <div className="mt-2.5 h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${pace.over ? "bg-destructive" : pace.pct > 85 ? "bg-warning" : "bg-primary"}`} style={{ width: `${pace.pct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              <Money value={pace.spent} currency={currency} format="short" /> terpakai ·{" "}
              {pace.over
                ? <span className="text-destructive font-medium">lebih <Money value={-pace.remaining} currency={currency} format="short" /></span>
                : <>sisa <Money value={pace.remaining} currency={currency} format="short" /></>}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
              {pace.source === "plan" ? "Pemasukan" : "Pemasukan nyata"} <Money value={pace.source === "plan" ? plan.income : summary.income} currency={currency} format="short" />
              {" − "}menabung <Money value={plan.savings} currency={currency} format="short" />
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">Belum ada rencana atau pemasukan bulan ini.</p>
        )}
        <Link to="/anggaran" className="mt-2.5 text-xs font-medium text-primary inline-flex items-center gap-1">Batas per kategori <ArrowRight className="w-3 h-3" /></Link>
      </section>
      {editPlan && <PlanEditSheet plan={plan} period={`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`} scope={scope} currency={currency} actualIncome={summary.income} onClose={() => setEditPlan(false)} />}

      {moreGroups.map((g) => (
        <section key={g.title} className="mb-5">
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">{g.title}</h2>
          <div className="surface overflow-hidden divide-y divide-border">
            {g.items.map((it) => <Row key={it.to} item={it} tone={moreToneClasses[g.tone]} badge={badges[it.to]} />)}
          </div>
        </section>
      ))}

      <section className="mb-5">
        <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">Bantuan</h2>
        <div className="surface overflow-hidden divide-y divide-border">
          <Row item={{ to: "/umpan-balik", icon: MessageSquare, label: "Umpan Balik", desc: "Laporkan masalah atau usulkan fitur" }} tone={moreToneClasses.slate} />
          {me?.role === "admin" && <Row item={{ to: "/admin", icon: Shield, label: "Panel Admin", desc: "Khusus pengelola aplikasi" }} tone={moreToneClasses.slate} />}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">Tampilan</h2>
        <div className="surface p-3"><ThemeToggle /></div>
      </section>
    </div>
  );
}

function Row({ item, tone, badge }) {
  const Icon = item.icon;
  return (
    <Link to={item.to} className="flex items-center gap-3 px-3.5 py-3 active:bg-muted transition-colors">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold leading-tight">{item.label}</span>
        {item.desc && <span className="block text-xs text-muted-foreground truncate">{item.desc}</span>}
      </span>
      {badge > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">{badge}</span>}
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
