import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CalendarHeart, Clock, Mail, UserPlus, Bell, Unlink, Loader2, ReceiptText, ChevronRight, Coins } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Money from "@/components/Money";
import Avatar from "@/components/Avatar";
import { usePartnership } from "@/hooks/usePartnership";
import { useTransactions, useMe, useRateMap } from "@/hooks/useFinance";
import { summarizeConsolidated, formatDate } from "@/lib/finance";
import { connectionDuration, lastActiveLabel, ROLE_LABEL } from "@/lib/partner";
import { confirmAction } from "@/components/ConfirmHost";

// Profil pasangan (hanya-baca untuk data pasangan): sejak kapan terhubung,
// siapa yang mengundang, terakhir aktif, catatan bersama bulan ini, serta
// pengaturan hubungan (peran, notifikasi, putuskan koneksi).
export default function PartnerProfile() {
  const { hasPartner, partners, connection, myRole, updateRole, disconnect, loading } = usePartnership();
  const { data: me } = useMe();
  const { data: transactions = [] } = useTransactions();
  const { map: rateMap } = useRateMap();
  const [busy, setBusy] = useState(null);
  const partner = partners?.[0];
  const cur = me?.default_currency || "IDR";

  // Catatan BERSAMA bulan ini per orang (catatan pribadi tidak pernah terlihat).
  const stats = useMemo(() => {
    const now = new Date();
    const month = transactions.filter((t) => {
      const d = new Date(t.date);
      return t.visibility !== "private" && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const of = (uid) => {
      const rows = month.filter((t) => t.created_by_id === uid);
      const s = summarizeConsolidated(rows, cur, rateMap);
      return { count: rows.length, out: s.expense + s.sedekah, income: s.income };
    };
    return { me: of(me?.id), partner: of(partner?.id) };
  }, [transactions, me?.id, partner?.id, cur, rateMap]);

  if (!loading && !hasPartner) return <Navigate to="/profil" replace />;

  const name = partner?.full_name || partner?.email || "Pasangan";
  const firstName = name.split(/\s+/)[0];

  const changeRole = async (role) => {
    if (role === myRole) return;
    setBusy("role");
    await updateRole(role);
    setBusy(null);
  };

  const handleDisconnect = async () => {
    const ok = await confirmAction({
      title: `Putuskan koneksi dengan ${firstName}?`,
      description: "Catatan bersama tidak dihapus, tetapi Anda berdua tidak lagi saling melihat catatan masing-masing. Untuk terhubung kembali perlu undangan baru.",
      confirmText: "Putuskan",
    });
    if (!ok) return;
    setBusy("disconnect");
    await disconnect("");
    setBusy(null);
  };

  return (
    <div className="px-5 pt-6 pb-6">
      <PageHeader title="Profil pasangan" back="/profil" />

      {loading || !partner ? (
        <div className="space-y-3">
          <div className="h-44 rounded-[28px] bg-muted animate-pulse" />
          <div className="h-32 rounded-3xl bg-muted animate-pulse" />
        </div>
      ) : (
        <>
          {/* Identitas pasangan */}
          <section className="card-gradient-primary rounded-[28px] p-5 mb-4 text-center">
            <div className="flex justify-center mb-3">
              <div className="ring-4 ring-white/15 rounded-full"><Avatar url={partner.photo_url} name={name} size="w-20 h-20" /></div>
            </div>
            <p className="font-heading text-[22px] font-extrabold leading-tight">{name}</p>
            {connection?.partner_role && <p className="text-xs opacity-80 mt-0.5">{ROLE_LABEL[connection.partner_role]}{myRole ? ` · Anda: ${ROLE_LABEL[myRole]}` : ""}</p>}
            {connection?.connected_at && (
              <div className="mt-4 rounded-2xl bg-white/[0.08] border border-white/10 px-4 py-3">
                <p className="text-[11px] opacity-75 flex items-center justify-center gap-1"><CalendarHeart className="w-3.5 h-3.5" /> Terhubung sejak</p>
                <p className="font-semibold">{connection.connected_exact ? "" : "± "}{formatDate(connection.connected_at, "d MMMM yyyy")}</p>
                <p className="text-xs opacity-80">{connectionDuration(connection.connected_at)} bersama di NAFKITA</p>
              </div>
            )}
          </section>

          {/* Info */}
          <section className="surface rounded-3xl divide-y divide-border mb-4">
            <InfoRow icon={Mail} label="Email" value={partner.email || "—"} />
            {partner.last_active_at && <InfoRow icon={Clock} label="Terakhir aktif" value={lastActiveLabel(partner.last_active_at)} />}
            {connection?.invited_by && <InfoRow icon={UserPlus} label="Koneksi dibuat oleh" value={connection.invited_by === "me" ? "Anda (mengundang)" : `${firstName} (mengundang Anda)`} />}
            {partner.default_currency && <InfoRow icon={Coins} label="Mata uang utama" value={partner.default_currency} />}
          </section>

          {/* Catatan bersama bulan ini */}
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">Catatan bersama {formatDate(new Date(), "MMMM")}</h2>
          <section className="grid grid-cols-2 gap-3 mb-2">
            <StatCard title={firstName} s={stats.partner} cur={cur} />
            <StatCard title="Anda" s={stats.me} cur={cur} />
          </section>
          <p className="text-[11px] text-muted-foreground px-1 mb-4">Hanya catatan bersama. Catatan pribadi masing-masing tidak pernah terlihat oleh pasangan.</p>
          <Link to="/riwayat" className="surface px-4 py-3 mb-5 flex items-center gap-3 active:bg-muted">
            <ReceiptText className="w-4 h-4 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">Lihat riwayat bersama</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>

          {/* Pengaturan hubungan */}
          <h2 className="text-xs font-semibold text-muted-foreground mb-2 px-1">Pengaturan hubungan</h2>
          <section className="surface rounded-3xl divide-y divide-border mb-4">
            <div className="px-4 py-3.5">
              <p className="text-sm font-semibold">Peran Anda</p>
              <p className="text-xs text-muted-foreground mb-2.5">{firstName} otomatis mendapat peran pasangannya.</p>
              <div role="radiogroup" aria-label="Peran Anda" className="flex gap-1 p-1 rounded-2xl bg-muted">
                {["suami", "istri"].map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={myRole === r} disabled={busy === "role"} onClick={() => changeRole(r)}
                    className={`flex-1 h-9 rounded-xl text-sm font-semibold transition-colors ${myRole === r ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
                    {busy === "role" && myRole !== r ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
            <Link to="/pengaturan" className="flex items-center gap-3 px-4 py-3.5 active:bg-muted">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold">Notifikasi dari {firstName}</span>
                <span className="block text-xs text-muted-foreground">Bisukan, ambang nominal, ringkasan harian</span>
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </Link>
          </section>

          <button onClick={handleDisconnect} disabled={busy === "disconnect"} className="w-full btn-secondary text-destructive border-destructive/25 hover:bg-destructive/5">
            {busy === "disconnect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />} Putuskan koneksi
          </button>
        </>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="flex-1 min-w-0 text-sm font-medium text-right truncate">{value}</span>
    </div>
  );
}

function StatCard({ title, s, cur }) {
  return (
    <div className="surface p-3.5">
      <p className="text-xs font-semibold truncate">{title}</p>
      <p className="text-2xl font-extrabold tabular-nums leading-tight mt-1">{s.count}<span className="text-xs font-medium text-muted-foreground"> catatan</span></p>
      <p className="text-[11px] text-muted-foreground mt-0.5">Keluar <Money value={s.out} currency={cur} format="short" /></p>
      {s.income > 0 && <p className="text-[11px] text-muted-foreground">Masuk <Money value={s.income} currency={cur} format="short" /></p>}
    </div>
  );
}
