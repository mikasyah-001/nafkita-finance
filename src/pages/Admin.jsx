import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { errorMessage, partialErrorText } from "@/lib/errorMessage";
import { useMe } from "@/hooks/useFinance";
import {
  ShieldCheck, Users, Link2, Receipt, Search, Loader2, ChevronDown, ScrollText,
  LayoutDashboard, Landmark, Info, Unlink, Activity, HeartHandshake, Inbox,
} from "lucide-react";
import AdminFeedback, { useFeedbackInbox } from "@/components/AdminFeedback";
import Money from "@/components/Money";
import { formatDate, colorMap, formatMoneyShort, assetTypeLabels } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import AdminStats, { lastActiveLabel } from "@/components/AdminStats";
import AdminProofMigration from "@/components/AdminProofMigration";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { confirmAction } from "@/components/ConfirmHost";
import { ChipChoice } from "@/components/FormSheet";
import NativeSelect from "@/components/NativeSelect";

// Urutan menu: gambaran umum dulu, lalu orang (pengguna → pasangan),
// lalu data (transaksi → aset), terakhir jejak tindakan admin.
const TABS = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  { key: "laporan", label: "Laporan", icon: Inbox },
  { key: "pengguna", label: "Pengguna", icon: Users },
  { key: "pasangan", label: "Pasangan", icon: HeartHandshake },
  { key: "transaksi", label: "Transaksi", icon: Receipt },
  { key: "aset", label: "Aset", icon: Landmark },
  { key: "audit", label: "Audit", icon: ScrollText },
];

const ROLE_LABEL = { suami: "Suami", istri: "Istri" };
const P_STATUS = {
  active: { label: "Aktif", cls: "bg-success/15 text-success" },
  pending: { label: "Menunggu", cls: "bg-warning/15 text-warning" },
  ended: { label: "Berakhir", cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground" },
  declined: { label: "Ditolak", cls: "bg-muted text-muted-foreground" },
};
const AUDIT_LABEL = {
  view_admin_stats: "Melihat statistik",
  terminate_partnership: "Memutus koneksi pasangan",
  export_data: "Mengekspor data",
  admin_view_transaction: "Membuka transaksi pengguna",
  admin_list_transactions: "Melihat daftar transaksi",
  admin_list_assets: "Melihat daftar aset",
  admin_list_users: "Melihat daftar pengguna",
};

const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

export default function Admin() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [partnerships, setPartnerships] = useState([]);
  const [categories, setCategories] = useState([]);
  // Tab & laporan bisa dibuka langsung lewat URL (mis. dari notifikasi):
  // /admin?tab=laporan&id=<feedback_id>
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "ringkasan";
  const setTab = (k) => setParams(k === "ringkasan" ? {} : { tab: k }, { replace: true });
  const { data: feedback = [] } = useFeedbackInbox(me?.role === "admin");
  const newFeedback = feedback.filter((f) => (f.status || "open") === "open").length;
  const [userQuery, setUserQuery] = useState("");
  const [pFilter, setPFilter] = useState("active");
  const [txFilter, setTxFilter] = useState("");
  const [txUserFilter, setTxUserFilter] = useState("all");
  const [txPage, setTxPage] = useState([]);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [hideViews, setHideViews] = useState(true);
  const [assets, setAssets] = useState([]);
  const [assetFilter, setAssetFilter] = useState("");
  const [assetUserFilter, setAssetUserFilter] = useState("all");
  const [assetLoading, setAssetLoading] = useState(false);

  // Periksa role admin dahulu, baru muat data.
  useEffect(() => {
    if (!me) return;
    (async () => {
      setLoading(true);
      try {
        if (me.role !== "admin") return;
        const [adminData, c] = await Promise.all([
          base44.functions.invoke("adminListUsers", {}),
          base44.entities.Category.list(),
        ]);
        const data = adminData?.data || adminData || {};
        if (data.errors?.length) toast.warning("Sebagian data admin gagal dimuat", { description: partialErrorText(data.errors) });
        setUsers(data.users || []);
        setPartnerships(data.partnerships || []);
        setCategories(c || []);
      } catch (e) {
        toast.error("Gagal memuat data admin", { description: errorMessage(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [me?.id, me?.role]);

  const loadTransactions = useCallback(async (reset) => {
    if (reset) setTxPage([]);
    setTxLoadingMore(true);
    try {
      const before = reset || txPage.length === 0 ? undefined : txPage[txPage.length - 1]?.date;
      const res = await base44.functions.invoke("adminListTransactions", {
        before_date: before,
        user_filter: txUserFilter !== "all" ? txUserFilter : undefined,
        limit: 100,
      });
      const data = res?.data || {};
      const newTx = data.transactions || [];
      setTxPage((prev) => (reset ? newTx : [...prev, ...newTx]));
      setTxHasMore(!!data.has_more);
    } catch (e) {
      toast.error("Gagal memuat transaksi", { description: errorMessage(e) });
    } finally {
      setTxLoadingMore(false);
    }
  }, [txPage, txUserFilter]);

  // Data per menu dimuat saat menu dibuka (bukan semuanya di awal).
  useEffect(() => {
    if (me?.role === "admin" && tab === "transaksi") loadTransactions(true);
     
  }, [tab, txUserFilter, me?.role]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const logs = await base44.entities.AuditLog.list("-created_date", 100);
      setAuditLogs(logs || []);
    } catch (e) {
      toast.error("Gagal memuat audit log", { description: errorMessage(e) });
    } finally {
      setAuditLoading(false);
    }
  }, []);
  useEffect(() => {
    if (me?.role === "admin" && tab === "audit" && auditLogs.length === 0) loadAuditLogs();
     
  }, [tab, me?.role]);

  const loadAssets = useCallback(async (userFilter) => {
    setAssetLoading(true);
    try {
      const res = await base44.functions.invoke("adminListAssets", {
        user_filter: userFilter && userFilter !== "all" ? userFilter : undefined,
        limit: 500,
      });
      setAssets((res?.data || {}).assets || []);
    } catch (e) {
      toast.error("Gagal memuat aset", { description: errorMessage(e) });
    } finally {
      setAssetLoading(false);
    }
  }, []);
  useEffect(() => {
    if (me?.role === "admin" && tab === "aset") loadAssets(assetUserFilter);
     
  }, [tab, assetUserFilter, me?.role]);

  const isAdmin = me?.role === "admin";

  const userMap = useMemo(() => Object.fromEntries((users || []).map((u) => [u.id, u])), [users]);
  const activeP = useMemo(() => (partnerships || []).filter((p) => p.status === "active"), [partnerships]);
  const partnerOf = useMemo(() => {
    const map = {};
    activeP.forEach((p) => {
      if (p.inviter_id) map[p.inviter_id] = { id: p.invitee_id || p.invitee_email, role: p.inviter_role };
      if (p.invitee_id) map[p.invitee_id] = { id: p.inviter_id, role: p.invitee_role };
    });
    return map;
  }, [activeP]);

  const sortedUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return [...users]
      .filter((u) => !q || (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q))
      .sort((a, b) => (b.role === "admin") - (a.role === "admin")
        || new Date(b.last_active_at || 0) - new Date(a.last_active_at || 0));
  }, [users, userQuery]);

  const pGroups = useMemo(() => ({
    active: partnerships.filter((p) => p.status === "active"),
    pending: partnerships.filter((p) => p.status === "pending"),
    history: partnerships.filter((p) => !["active", "pending"].includes(p.status)),
  }), [partnerships]);

  const filteredTx = useMemo(() => {
    const q = txFilter.trim().toLowerCase();
    if (!q) return txPage;
    return txPage.filter((t) => [t.merchant, t.notes, t.category].some((v) => (v || "").toLowerCase().includes(q)));
  }, [txPage, txFilter]);

  const filteredAssets = useMemo(() => {
    const q = assetFilter.trim().toLowerCase();
    return assets.filter((a) => !q || [a.name, a.type, a.notes].some((v) => (v || "").toLowerCase().includes(q)));
  }, [assets, assetFilter]);
  const assetTotals = useMemo(() => {
    const m = {};
    filteredAssets.forEach((a) => { const c = (a.currency || "IDR").toUpperCase(); m[c] = (m[c] || 0) + (Number(a.value) || 0); });
    return Object.entries(m).sort((a, b) => (a[0] === "IDR" ? -1 : b[0] === "IDR" ? 1 : a[0].localeCompare(b[0])));
  }, [filteredAssets]);

  const visibleLogs = useMemo(() => (hideViews ? auditLogs.filter((l) => l.action !== "view_admin_stats") : auditLogs), [auditLogs, hideViews]);

  if (loading) {
    // Judul tetap tampil (bukan layar kosong) selama data admin dimuat —
    // data ini sengaja diambil hanya saat panel dibuka (berat, khusus admin).
    return (
      <div className="px-5 pt-6 pb-4">
        <PageHeader title="Panel admin" subtitle="Pengguna, pasangan, data & audit" back />
        <div className="space-y-4" aria-busy="true" aria-label="Memuat data admin">
          <div className="h-36 rounded-[28px] bg-muted animate-pulse" />
          <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded-full bg-muted animate-pulse" />)}</div>
          <div className="h-48 rounded-3xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-6">
        <PageHeader title="Panel admin" back />
        <EmptyState icon={ShieldCheck} title="Akses ditolak" subtitle="Halaman ini khusus administrator." />
        <button onClick={() => navigate(-1)} className="w-full btn-secondary mt-2">Kembali</button>
      </div>
    );
  }

  const userName = (idOrEmail) => {
    if (!idOrEmail) return "—";
    const u = userMap[idOrEmail];
    return u ? u.full_name || u.email : idOrEmail;
  };

  const handleDisconnect = async (p) => {
    const ok = await confirmAction({
      title: "Putuskan koneksi pasangan?",
      description: `${userName(p.inviter_id)} ⇄ ${userName(p.invitee_id || p.invitee_email)}. Data transaksi tetap ada, hanya tidak lagi dibagikan.`,
      confirmText: "Putuskan",
    });
    if (!ok) return;
    const reason = "Diputus oleh admin";
    try {
      await base44.functions.invoke("terminatePartnership", { partnership_id: p.id, end_reason: reason });
      toast.success("Koneksi diputus");
      setPartnerships((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: "ended", end_reason: reason } : x)));
    } catch (e) {
      toast.error("Gagal memutuskan", { description: errorMessage(e) });
    }
  };

  const onlineNow = users.filter((u) => u.last_active_at && Date.now() - new Date(u.last_active_at).getTime() < 5 * 60000).length;
  const active24 = users.filter((u) => u.last_active_at && Date.now() - new Date(u.last_active_at).getTime() < 864e5).length;

  return (
    <div className="px-5 pt-6 pb-4">
      <PageHeader title="Panel admin" subtitle="Pengguna, pasangan, data & audit" back />

      {/* Ringkasan singkat */}
      <section aria-label="Ringkasan admin" className="card-gradient-primary relative rounded-[28px] p-5 overflow-hidden mb-4">
        <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" aria-hidden="true" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"><ShieldCheck className="w-3.5 h-3.5" /> Administrator</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] opacity-85">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--gold))] opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--gold))]" /></span>
              {onlineNow} online
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <HeroStat label="Pengguna" value={users.length} />
            <HeroStat label="Aktif 24 jam" value={active24} />
            <HeroStat label="Pasangan aktif" value={activeP.length} />
          </div>
        </div>
      </section>

      {/* Menu */}
      <div role="tablist" aria-label="Menu admin" className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mb-4">
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
              className={`h-10 px-2 rounded-full text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"}`}>
              <t.icon className="w-4 h-4" /> {t.label}
              {t.key === "laporan" && newFeedback > 0 && <span className="min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">{newFeedback}</span>}
            </button>
          );
        })}
      </div>

      {/* RINGKASAN */}
      {tab === "ringkasan" && <><AdminStats /><AdminProofMigration /></>}

      {/* LAPORAN PENGGUNA */}
      {tab === "laporan" && <AdminFeedback initialId={params.get("id")} />}

      {/* PENGGUNA */}
      {tab === "pengguna" && (
        <div className="space-y-3">
          <SearchBox value={userQuery} onChange={setUserQuery} placeholder="Cari nama atau email…" label="Cari pengguna" />
          <SectionNote>{sortedUsers.length} pengguna · admin di atas, lalu yang terakhir aktif</SectionNote>
          {sortedUsers.length === 0 ? (
            <EmptyState icon={Users} title="Tidak ada pengguna" subtitle="Tidak ada yang cocok dengan pencarian." />
          ) : (
            <ul className="surface rounded-3xl divide-y divide-border">
              {sortedUsers.map((u) => {
                const p = partnerOf[u.id];
                const online = lastActiveLabel(u.last_active_at) === "Online";
                return (
                  <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="relative w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-sm font-bold">
                      {initials(u.full_name || u.email)}
                      {online && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success ring-2 ring-card" aria-label="Online" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                        {u.full_name || u.email}
                        {u.role === "admin" && <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">Admin</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-[11px] mt-0.5 flex items-center gap-1 truncate">
                        {p ? (
                          <span className="text-success inline-flex items-center gap-1 truncate"><Link2 className="w-3 h-3 shrink-0" /> {userName(p.id)}{p.role ? ` · ${ROLE_LABEL[p.role]}` : ""}</span>
                        ) : (
                          <span className="text-muted-foreground">Belum terhubung</span>
                        )}
                      </p>
                    </div>
                    <span className={`text-[11px] text-right shrink-0 max-w-[6.5rem] leading-tight ${online ? "text-success font-semibold" : "text-muted-foreground"}`}>{lastActiveLabel(u.last_active_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* PASANGAN */}
      {tab === "pasangan" && (
        <div className="space-y-3">
          <ChipChoice
            size="sm"
            ariaLabel="Status koneksi"
            value={pFilter}
            onChange={setPFilter}
            options={[
              { value: "active", label: `Aktif (${pGroups.active.length})` },
              { value: "pending", label: `Menunggu (${pGroups.pending.length})` },
              { value: "history", label: `Riwayat (${pGroups.history.length})` },
            ]}
          />
          {pGroups[pFilter].length === 0 ? (
            <EmptyState icon={HeartHandshake} title="Tidak ada koneksi" subtitle="Belum ada koneksi pada status ini." />
          ) : (
            <ul className="surface rounded-3xl divide-y divide-border">
              {pGroups[pFilter].map((p) => {
                const st = P_STATUS[p.status] || P_STATUS.ended;
                const terminal = ["ended", "cancelled", "declined"].includes(p.status);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Link2 className="w-5 h-5" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-snug">
                        {userName(p.inviter_id)}{p.inviter_role ? ` (${ROLE_LABEL[p.inviter_role]})` : ""}
                        <span className="text-muted-foreground font-normal mx-1">⇄</span>
                        {userName(p.invitee_id || p.invitee_email)}{p.invitee_role ? ` (${ROLE_LABEL[p.invitee_role]})` : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${st.cls}`}>{st.label}</span>
                        {p.created_date && <span>sejak {formatDate(p.created_date, "d MMM yyyy")}</span>}
                        {p.end_reason && <span className="truncate">· {p.end_reason}</span>}
                      </p>
                    </div>
                    {!terminal && (
                      <button onClick={() => handleDisconnect(p)} aria-label="Putuskan koneksi"
                        className="h-8 px-3 rounded-full border border-destructive/30 text-destructive text-xs font-semibold inline-flex items-center gap-1 shrink-0 active:scale-95 transition-transform">
                        <Unlink className="w-3.5 h-3.5" /> Putus
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <InfoNote>Koneksi hanya dibuat oleh pengguna sendiri lewat undangan atau kode referensi. Admin hanya bisa melihat dan memutus koneksi bila diperlukan.</InfoNote>
        </div>
      )}

      {/* TRANSAKSI */}
      {tab === "transaksi" && (
        <div className="space-y-3">
          <FilterBar query={txFilter} onQuery={setTxFilter} queryLabel="Cari transaksi" placeholder="Cari tempat, catatan, kategori…"
            user={txUserFilter} onUser={setTxUserFilter} users={users} />
          <SectionNote>{txLoadingMore && txPage.length === 0 ? "Memuat…" : `${filteredTx.length} transaksi${txHasMore ? " · ada lagi" : ""} · transaksi pribadi tidak ditampilkan`}</SectionNote>
          {txLoadingMore && txPage.length === 0 ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredTx.length === 0 ? (
            <EmptyState icon={Receipt} title="Tidak ada transaksi" subtitle="Belum ada transaksi yang sesuai filter." />
          ) : (
            <ul className="surface rounded-3xl divide-y divide-border">
              {filteredTx.map((tx) => {
                const isIncome = tx.type === "income";
                const isSedekah = tx.type === "sedekah";
                const cat = categories.find((c) => c.name === tx.category);
                const c = colorMap[isSedekah ? "teal" : cat?.color || "slate"] || colorMap.slate;
                return (
                  <li key={tx.id}>
                    <Link to={`/transaksi/${tx.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-muted/50 transition-colors">
                      <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${c.bg}`}>
                        <CategoryIcon name={isSedekah ? "Heart" : cat?.icon || "Wallet"} className={`w-5 h-5 ${c.text}`} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{tx.merchant || tx.notes || (isSedekah ? "Sedekah" : tx.category || "Transaksi")}</span>
                        <span className="block text-[11px] text-muted-foreground truncate">{userName(tx.created_by_id)} · {formatDate(tx.date, "d MMM yyyy, HH:mm")}</span>
                      </span>
                      <span className={`text-sm font-bold whitespace-nowrap shrink-0 tabular-nums ${tx.transfer_pair_id ? "text-muted-foreground" : isIncome ? "text-income" : isSedekah ? "text-sedekah" : "text-expense"}`}>
                        {isIncome ? "+" : "−"}<Money value={tx.amount} currency={tx.currency} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {txHasMore && (
            <button onClick={() => loadTransactions(false)} disabled={txLoadingMore} className="w-full btn-secondary btn-sm disabled:opacity-60">
              {txLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />} Muat lebih banyak
            </button>
          )}
        </div>
      )}

      {/* ASET */}
      {tab === "aset" && (
        <div className="space-y-3">
          <FilterBar query={assetFilter} onQuery={setAssetFilter} queryLabel="Cari aset" placeholder="Cari nama atau jenis aset…"
            user={assetUserFilter} onUser={setAssetUserFilter} users={users} />
          {!assetLoading && assetTotals.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {assetTotals.map(([c, v]) => (
                <div key={c} className="shrink-0 card-pastel card-pastel-butter rounded-2xl px-3.5 py-2.5">
                  <p className="text-[11px] opacity-75">Total {c}</p>
                  <p className="text-sm font-bold tabular-nums">{formatMoneyShort(v, c)}</p>
                </div>
              ))}
            </div>
          )}
          <SectionNote>{assetLoading ? "Memuat…" : `${filteredAssets.length} aset · total dipisah per mata uang`}</SectionNote>
          {assetLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filteredAssets.length === 0 ? (
            <EmptyState icon={Landmark} title="Tidak ada aset" subtitle="Belum ada aset yang sesuai filter." />
          ) : (
            <ul className="surface rounded-3xl divide-y divide-border">
              {filteredAssets.map((a) => {
                const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
                const cm = colorMap[meta?.color] || colorMap.slate;
                return (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${cm.bg}`}><CategoryIcon name={meta?.icon || "Landmark"} className={`w-5 h-5 ${cm.text}`} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{a.name || "Tanpa nama"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {meta?.label || a.type}
                        {a.quantity > 0 ? ` · ${a.quantity}${a.unit ? ` ${a.unit}` : ""}` : ""}
                        {` · ${userName(a.created_by_id)}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap shrink-0 tabular-nums"><Money value={a.value} currency={a.currency} /></span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* AUDIT */}
      {tab === "audit" && (
        <div className="space-y-3">
          <label className="surface rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer">
            <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm">Sembunyikan "melihat statistik"</span>
            <input type="checkbox" checked={hideViews} onChange={(e) => setHideViews(e.target.checked)} className="w-4 h-4 accent-[hsl(var(--primary))]" />
          </label>
          <SectionNote>{auditLoading ? "Memuat…" : `${visibleLogs.length} dari ${auditLogs.length} entri terakhir`}</SectionNote>
          {auditLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : visibleLogs.length === 0 ? (
            <EmptyState icon={ScrollText} title="Belum ada catatan" subtitle="Riwayat tindakan admin akan muncul di sini." />
          ) : (
            <ul className="surface rounded-3xl divide-y divide-border">
              {visibleLogs.map((log) => (
                <li key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><ScrollText className="w-4 h-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{AUDIT_LABEL[log.action] || log.action}</p>
                      <p className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">{formatDate(log.created_date, "d MMM, HH:mm")}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">oleh {log.actor_name || log.actor_email || "Admin"}</p>
                    {log.target_label && <p className="text-[11px] text-muted-foreground truncate mt-0.5">Target: {log.target_label}</p>}
                    {log.details && <p className="text-[11px] text-muted-foreground mt-0.5">{log.details}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 border border-white/10 p-2.5">
      <p className="text-[11px] opacity-75 leading-tight">{label}</p>
      <p className="font-heading text-2xl font-extrabold tabular-nums leading-none mt-1">{value}</p>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder, label }) {
  return (
    <div className="relative flex-1 min-w-0">
      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-11 rounded-full border border-border bg-card pl-10 pr-4 text-sm outline-none focus:ring-2 ring-primary/30" />
    </div>
  );
}

function FilterBar({ query, onQuery, queryLabel, placeholder, user, onUser, users }) {
  return (
    <div className="space-y-2">
      <SearchBox value={query} onChange={onQuery} placeholder={placeholder} label={queryLabel} />
      <NativeSelect aria-label="Filter pengguna" sheetTitle="Filter pengguna" value={user} onChange={(e) => onUser(e.target.value)}
        className="w-full h-11 rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 ring-primary/30">
        <option value="all">Semua pengguna</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
      </NativeSelect>
    </div>
  );
}

function SectionNote({ children }) {
  return <p className="text-xs text-muted-foreground px-1">{children}</p>;
}

function InfoNote({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-muted/60 p-3 text-xs text-muted-foreground leading-snug">
      <Info className="w-4 h-4 shrink-0 mt-0.5" /> {children}
    </div>
  );
}