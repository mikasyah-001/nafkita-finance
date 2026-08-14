import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  ArrowLeft, ShieldCheck, Users, Link2, Receipt, Lock, Unlock,
  Trash2, UserCircle, Search, Loader2,
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
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState("pengguna");
  const [txFilter, setTxFilter] = useState("");
  const [txUserFilter, setTxUserFilter] = useState("all");
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, u, p, t, c] = await Promise.all([
        base44.auth.me(),
        base44.entities.User.list(),
        base44.entities.Partnership.list(),
        base44.entities.Transaction.list("-date", 200),
        base44.entities.Category.list(),
      ]);
      setMe(m);
      setUsers(u);
      setPartnerships(p);
      setTransactions(t);
      setCategories(c);
    } catch (e) {
      toast.error("Gagal memuat data admin", { description: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const isAdmin = me?.role === "admin";

  // Map user id -> user object
  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => (map[u.id] = u));
    return map;
  }, [users]);

  // Active partnership per user
  const partnerOf = useMemo(() => {
    const map = {};
    partnerships.filter((p) => p.status === "active").forEach((p) => {
      if (p.inviter_id) map[p.inviter_id] = p.invitee_id || p.invitee_email;
      if (p.invitee_id) map[p.invitee_id] = p.inviter_id;
    });
    return map;
  }, [partnerships]);

  // Filtered transactions
  const filteredTx = useMemo(() => {
    let list = transactions;
    if (txUserFilter !== "all") list = list.filter((t) => t.created_by_id === txUserFilter);
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
  }, [transactions, txFilter, txUserFilter]);

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

  const handleConnect = async () => {
    if (!aId || !bId) return toast.error("Pilih kedua pengguna");
    if (aId === bId) return toast.error("Pengguna tidak boleh sama");
    const a = userMap[aId], b = userMap[bId];
    if (!a?.email || !b?.email) return toast.error("Data email tidak ditemukan");
    setConnecting(true);
    try {
      await base44.entities.Partnership.create({
        inviter_id: a.id,
        invitee_email: b.email,
        invitee_id: b.id,
        status: "active",
      });
      toast.success("Pasangan terhubung", { description: `${a.full_name || a.email} ⇄ ${b.full_name || b.email}` });
      setAId(""); setBId("");
      load();
    } catch (e) {
      toast.error("Gagal menghubungkan", { description: e?.message });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async (p) => {
    if (!confirm("Putuskan koneksi pasangan ini?")) return;
    try {
      await base44.entities.Partnership.delete(p.id);
      toast.success("Koneksi diputus");
      load();
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

        {/* CONNECTIONS */}
        <TabsContent value="koneksi" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="font-semibold text-sm mb-1 flex items-center gap-2"><Link2 className="w-4 h-4" /> Hubungkan Manual</h2>
            <p className="text-xs text-muted-foreground mb-3">Sambungkan dua pengguna sebagai pasangan secara langsung.</p>
            <div className="space-y-2">
              <select value={aId} onChange={(e) => setAId(e.target.value)} className="input">
                <option value="">— Pilih Pengguna 1 —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
              <select value={bId} onChange={(e) => setBId(e.target.value)} className="input">
                <option value="">— Pilih Pengguna 2 —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
              </select>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Hubungkan Pasangan
              </button>
            </div>
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

        {/* TRANSACTIONS */}
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

          {filteredTx.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada transaksi.</p>}

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
                    {tx.visibility === "private" && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}