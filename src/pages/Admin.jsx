import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  ArrowLeft, ShieldCheck, Users, Link2, Receipt, Lock,
  Trash2, UserCircle, Search, Loader2, ChevronDown,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Money from "@/components/Money";
import { formatDate, colorMap } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";

export default function Admin() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [partnerships, setPartnerships] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState("pengguna");
  const [txFilter, setTxFilter] = useState("");
  const [txUserFilter, setTxUserFilter] = useState("all");
  const [txPage, setTxPage] = useState([]);
  const [txHasMore, setTxHasMore] = useState(false);
  const [txLoadingMore, setTxLoadingMore] = useState(false);

  // Periksa role admin dahulu, baru muat data.
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const m = await base44.auth.me();
        setMe(m);
        if (m?.role !== "admin") return;
        const [u, p, c] = await Promise.all([
          base44.entities.User.list(),
          base44.entities.Partnership.list("-created_date", 500),
          base44.entities.Category.list(),
        ]);
        setUsers(u || []);
        setPartnerships(p || []);
        setCategories(c || []);
        loadTransactions(true);
      } catch (e) {
        toast.error("Gagal memuat data admin", { description: e?.message });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      toast.error("Gagal memuat transaksi", { description: e?.message });
    } finally {
      setTxLoadingMore(false);
    }
  }, [txPage, txUserFilter]);

  // Muat ulang transaksi saat filter user berubah.
  useEffect(() => {
    if (me?.role === "admin") loadTransactions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txUserFilter]);

  const isAdmin = me?.role === "admin";

  const userMap = useMemo(() => {
    const map = {};
    (users || []).forEach((u) => (map[u.id] = u));
    return map;
  }, [users]);

  const partnerOf = useMemo(() => {
    const map = {};
    (partnerships || []).filter((p) => p.status === "active").forEach((p) => {
      if (p.inviter_id) map[p.inviter_id] = p.invitee_id || p.invitee_email;
      if (p.invitee_id) map[p.invitee_id] = p.inviter_id;
    });
    return map;
  }, [partnerships]);

  const filteredTx = useMemo(() => {
    let list = txPage;
    if (txFilter.trim()) {
      const q = txFilter.toLowerCase();
      list = list.filter(
        (t) =>
          (t.merchant || "").toLowerCase().includes(q) ||
          (t.notes || "").toLowerCase().includes(q) ||
          (t.category || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [txPage, txFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-10 text-center">
        <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Akses Ditolak</p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">Halaman ini khusus administrator.</p>
        <button onClick={() => navigate(-1)} className="text-sm text-primary underline">Kembali</button>
      </div>
    );
  }

  const partnerLabel = (idOrEmail) => {
    if (!idOrEmail) return "—";
    const u = userMap[idOrEmail];
    return u ? u.full_name || u.email : idOrEmail;
  };

  const handleDisconnect = async (p) => {
    if (!confirm("Putuskan koneksi pasangan ini?")) return;
    try {
      await base44.functions.invoke("terminatePartnership", { partnership_id: p.id });
      toast.success("Koneksi diputus");
      setPartnerships((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      toast.error("Gagal memutuskan", { description: e?.message });
    }
  };

  return (
    <div className="px-5 pt-8 pb-10 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Panel Admin
          </h1>
          <p className="text-xs text-muted-foreground">Kelola pengguna, koneksi & transaksi</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full mb-4">
          <TabsTrigger value="pengguna"><Users className="w-4 h-4 mr-1" />User</TabsTrigger>
          <TabsTrigger value="koneksi"><Link2 className="w-4 h-4 mr-1" />Koneksi</TabsTrigger>
          <TabsTrigger value="transaksi"><Receipt className="w-4 h-4 mr-1" />Transaksi</TabsTrigger>
        </TabsList>

        {/* USERS */}
        <TabsContent value="pengguna" className="space-y-2">
          <p className="text-xs text-muted-foreground mb-1">{users.length} pengguna terdaftar</p>
          {users.map((u) => {
            const pid = partnerOf[u.id];
            const partner = pid && userMap[pid];
            return (
              <div key={u.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UserCircle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    {u.full_name || u.email}
                    {u.role === "admin" && (
                      <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-semibold">ADMIN</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    {partner ? (
                      <><Link2 className="w-3 h-3" /> Terhubung: {partner.full_name || partner.email}</>
                    ) : (
                      <span className="text-amber-600">Belum terhubung</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* CONNECTIONS — read-only; koneksi hanya via undangan */}
        <TabsContent value="koneksi" className="space-y-4">
          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Koneksi pasangan hanya dapat dibuat melalui undangan email/kode referensi oleh pengguna sendiri. Admin tidak membuat koneksi manual. Daftar di bawah bersifat read-only; admin dapat memutuskan koneksi bila diperlukan.
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Koneksi aktif & menunggu</p>
            {partnerships.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Belum ada koneksi.</p>}
            {partnerships.map((p) => {
              const a = userMap[p.inviter_id];
              const b = p.invitee_id ? userMap[p.invitee_id] : null;
              return (
                <div key={p.id} className="rounded-2xl border border-border bg-card p-3 mb-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a?.full_name || a?.email || "—"} <span className="text-muted-foreground">⇄</span> {b?.full_name || b?.email || p.invitee_email}
                    </p>
                    <p className="text-[11px] mt-0.5">
                      {p.status === "active" ? (
                        <span className="text-emerald-600 font-medium">Aktif</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Menunggu</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDisconnect(p)}
                    className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0"
                    title="Putuskan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* TRANSACTIONS — non-private lintas keluarga, paginated */}
        <TabsContent value="transaksi" className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={txFilter}
                onChange={(e) => setTxFilter(e.target.value)}
                placeholder="Cari transaksi…"
                className="input pl-9"
              />
            </div>
            <select value={txUserFilter} onChange={(e) => setTxUserFilter(e.target.value)} className="input max-w-[40%]">
              <option value="all">Semua User</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Menampilkan {filteredTx.length} transaksi non-private{txHasMore ? " (ada lagi)" : ""}. Pencarian berlaku atas data yang sudah dimuat.
          </p>

          {filteredTx.length === 0 && !txLoadingMore && <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada transaksi.</p>}

          {filteredTx.map((tx) => {
            const isIncome = tx.type === "income";
            const isSedekah = tx.type === "sedekah";
            const cat = categories.find((c) => c.name === tx.category);
            const color = isSedekah ? "teal" : cat?.color || "slate";
            const icon = isSedekah ? "Heart" : cat?.icon || "Wallet";
            const c = colorMap[color] || colorMap.slate;
            const owner = userMap[tx.created_by_id];
            return (
              <Link
                to={`/transaksi/${tx.id}`}
                key={tx.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 active:scale-[0.99] transition-transform"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                  <CategoryIcon name={icon} className={`w-5 h-5 ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate flex items-center gap-1">
                    {tx.merchant || tx.notes || (isSedekah ? "Sedekah" : tx.category || "Transaksi")}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {owner?.full_name || owner?.email || "—"} • {formatDate(tx.date, "dd MMM, HH:mm")}
                  </p>
                </div>
                <div className={`text-sm font-semibold whitespace-nowrap shrink-0 tabular-nums ${isIncome ? "text-emerald-600" : isSedekah ? "text-teal-600" : ""}`}>
                  {isIncome ? "+" : "-"}<Money value={tx.amount} currency={tx.currency} />
                </div>
              </Link>
            );
          })}

          {txHasMore && (
            <button
              onClick={() => loadTransactions(false)}
              disabled={txLoadingMore}
              className="w-full py-2.5 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {txLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />} Muat lebih banyak
            </button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}