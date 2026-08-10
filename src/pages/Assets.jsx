import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAssets, useRefresh } from "@/hooks/useFinance";
import { formatRupiah, formatNumber, formatDate, formatDuration, colorMap, assetTypeLabels } from "@/lib/finance";
import CategoryIcon from "@/components/CategoryIcon";
import EmptyState from "@/components/EmptyState";
import { toast } from "sonner";
import { Landmark, Plus, Loader2, Trash2, X, Coins, RefreshCw, TrendingUp, TrendingDown, Calendar, BarChart3, Users, Lock } from "lucide-react";

const types = ["bank", "emas", "investasi", "properti", "lainnya"];

export default function Assets() {
  const { data: assets = [] } = useAssets();
  const refresh = useRefresh();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [goldPrice, setGoldPrice] = useState("");
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [scope, setScope] = useState("shared");
  const [form, setForm] = useState({
    name: "", type: "bank", value: "", quantity: "", unit: "",
    purchase_date: "", purchase_price: "", owner: "", notes: "", visibility: "shared",
  });

  const goldPriceNum = Number(goldPrice) || 0;
  const scopedAssets = assets.filter((a) => (scope === "private" ? a.visibility === "private" : a.visibility !== "private"));

  const currentValue = (a) => {
    if (a.type === "emas" && a.quantity && goldPriceNum > 0) {
      return a.quantity * goldPriceNum;
    }
    return a.value || 0;
  };

  const total = scopedAssets.reduce((s, a) => s + currentValue(a), 0);
  const emasGrams = scopedAssets.filter((a) => a.type === "emas").reduce((s, a) => s + (a.quantity || 0), 0);

  const fetchGoldPrice = async () => {
    setFetchingPrice(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt:
          "Cari harga emas per gram di Indonesia saat ini (harga emas Antam atau emas batangan terbaru). Berikan harga per gram dalam Rupiah. Jawab hanya dengan angka.",
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: { price_per_gram: { type: "number" } },
        },
      });
      const price = result.price_per_gram;
      if (price && price > 0) {
        setGoldPrice(String(Math.round(price)));
        toast.success("Harga emas diperbarui", { description: `Rp ${formatNumber(Math.round(price))} /gram` });
      } else {
        toast.error("Tidak dapat menemukan harga emas");
      }
    } catch {
      toast.error("Gagal mengambil harga emas", { description: "Masukkan harga manual." });
    }
    setFetchingPrice(false);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error("Isi nama aset");
    if (!form.value && form.type !== "emas") return toast.error("Isi nilai aset");
    if (form.type === "emas" && !form.quantity) return toast.error("Isi jumlah gram emas");
    setSaving(true);
    try {
      const value = form.type === "emas" && form.quantity && form.purchase_price
        ? Number(form.quantity) * Number(form.purchase_price)
        : Number(form.value);
      await base44.entities.Asset.create({
        name: form.name,
        type: form.type,
        value,
        quantity: form.quantity ? Number(form.quantity) : 0,
        unit: form.type === "emas" ? "gram" : form.unit,
        purchase_date: form.purchase_date || "",
        purchase_price: form.purchase_price ? Number(form.purchase_price) : 0,
        owner: form.owner,
        notes: form.notes,
        visibility: form.visibility,
      });
      refresh();
      toast.success("Aset ditambahkan");
      setForm({ name: "", type: "bank", value: "", quantity: "", unit: "", purchase_date: "", purchase_price: "", owner: "", notes: "", visibility: "shared" });
      setShowForm(false);
    } catch {
      toast.error("Gagal menambah aset");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.Asset.delete(id);
      refresh();
      toast.success("Aset dihapus");
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const handleToggleVisibility = async (a) => {
    const next = a.visibility === "private" ? "shared" : "private";
    try {
      await base44.entities.Asset.update(a.id, { visibility: next });
      refresh();
      toast.success(next === "private" ? "Aset diubah menjadi Pribadi" : "Aset diubah menjadi Bersama");
    } catch {
      toast.error("Gagal mengubah jangkauan");
    }
  };

  return (
    <div className="px-5 pt-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Aset Keluarga</h1>
        <div className="flex items-center gap-2">
          <Link to="/aset-dashboard" className="w-10 h-10 rounded-full bg-muted flex items-center justify-center active:scale-95 transition-transform">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
          </Link>
          <button onClick={() => setShowForm(true)} className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform">
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setScope("shared")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "shared" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Users className="w-4 h-4" /> Bersama
        </button>
        <button onClick={() => setScope("private")} className={`flex-1 py-2 rounded-2xl text-sm font-medium flex items-center justify-center gap-1.5 transition-all ${scope === "private" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          <Lock className="w-4 h-4" /> Pribadi
        </button>
      </div>

      <div className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 mb-4 shadow-lg">
        <p className="text-xs opacity-80">{scope === "private" ? "Total Aset Pribadi" : "Total Nilai Aset"}</p>
        <p className="text-3xl font-bold tracking-tight">{formatRupiah(total)}</p>
        {emasGrams > 0 && <p className="text-xs opacity-80 mt-2 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Emas: {formatNumber(emasGrams)} gram</p>}
      </div>

      {scopedAssets.some((a) => a.type === "emas") && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-medium">Harga Emas Pasar</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center flex-1 rounded-xl bg-background border border-border px-3">
              <span className="text-xs text-muted-foreground">Rp</span>
              <input
                type="number"
                value={goldPrice}
                onChange={(e) => setGoldPrice(e.target.value)}
                placeholder="harga / gram"
                className="flex-1 px-2 py-2.5 text-sm outline-none bg-transparent"
              />
            </div>
            <button
              onClick={fetchGoldPrice}
              disabled={fetchingPrice}
              className="px-3 rounded-xl bg-amber-600 text-white text-xs font-medium flex items-center gap-1.5 disabled:opacity-60"
            >
              {fetchingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Cek
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">Nilai emas diperbarui otomatis mengikuti harga pasar ini.</p>
        </div>
      )}

      {scopedAssets.length === 0 ? (
        <EmptyState icon={scope === "private" ? Lock : Landmark} title={scope === "private" ? "Belum ada aset pribadi" : "Belum ada aset"} subtitle="Catat tabungan, emas, investasi, dan aset lainnya untuk memantau kekayaan dan kewajiban zakat." />
      ) : (
        <div className="space-y-3">
          {scopedAssets.map((a) => {
            const meta = assetTypeLabels[a.type] || assetTypeLabels.lainnya;
            const cm = colorMap[meta.color] || colorMap.slate;
            const curVal = currentValue(a);
            const hasPurchase = a.purchase_price && a.purchase_price > 0;
            const gain = hasPurchase ? curVal - a.purchase_price : 0;
            const gainPct = hasPurchase && a.purchase_price > 0 ? (gain / a.purchase_price) * 100 : 0;
            const isGain = gain >= 0;
            const duration = formatDuration(a.purchase_date);

            return (
              <div key={a.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${cm.bg}`}>
                    <CategoryIcon name={meta.icon} className={`w-5 h-5 ${cm.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1">
                      {a.visibility === "private" && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      {a.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label}{a.owner ? ` • ${a.owner}` : ""}
                      {a.type === "emas" && a.quantity ? ` • ${formatNumber(a.quantity)} gr` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatRupiah(curVal)}</p>
                    <div className="flex items-center gap-2 mt-1 ml-auto justify-end">
                      <button
                        onClick={() => handleToggleVisibility(a)}
                        className="text-xs text-muted-foreground flex items-center gap-1 active:scale-95 transition-transform"
                        title={a.visibility === "private" ? "Jadikan Bersama" : "Jadikan Pribadi"}
                      >
                        {a.visibility === "private" ? <Users className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs text-red-500 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {(hasPurchase || duration) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                    {hasPurchase && (
                      <>
                        <div>
                          <p className="text-muted-foreground">Harga Beli</p>
                          <p className="font-medium">{formatRupiah(a.purchase_price)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Perubahan</p>
                          <p className={`font-medium flex items-center gap-1 ${isGain ? "text-emerald-600" : "text-red-500"}`}>
                            {isGain ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {isGain ? "+" : ""}{formatRupiah(gain)} ({isGain ? "+" : ""}{gainPct.toFixed(1)}%)
                          </p>
                        </div>
                      </>
                    )}
                    {duration && (
                      <div className={hasPurchase ? "" : "col-span-2"}>
                        <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Disimpan</p>
                        <p className="font-medium">{duration}{a.purchase_date ? ` (sejak ${formatDate(a.purchase_date, "dd MMM yyyy")})` : ""}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center max-w-md mx-auto">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative w-full bg-background rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Tambah Aset</h2>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Nama Aset">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mis. Tabungan BCA, Emas 10gr" className="input" />
              </Field>
              <Field label="Jenis">
                <div className="flex gap-2 flex-wrap">
                  {types.map((t) => (
                    <button key={t} onClick={() => setForm({ ...form, type: t, unit: t === "emas" ? "gram" : form.unit })} className={`px-3 py-1.5 rounded-full text-xs font-medium ${form.type === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {assetTypeLabels[t].label}
                    </button>
                  ))}
                </div>
              </Field>

              {form.type === "emas" ? (
                <>
                  <Field label="Jumlah (gram)">
                    <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="0" className="input" />
                  </Field>
                  <Field label="Harga Beli / gram (Rp)">
                    <input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value, value: e.target.value && form.quantity ? String(Number(e.target.value) * Number(form.quantity)) : form.value })} placeholder="Mis. 1350000" className="input" />
                  </Field>
                </>
              ) : (
                <Field label="Nilai Saat Ini (Rp)">
                  <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" className="input" />
                </Field>
              )}

              <Field label="Tanggal Pembelian (opsional)">
                <input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className="input" />
              </Field>

              {form.type !== "emas" && (
                <Field label="Harga Pembelian (Rp, opsional)">
                  <input type="number" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} placeholder="0" className="input" />
                </Field>
              )}

              <Field label="Jangkauan">
                <div className="flex gap-2">
                  <button onClick={() => setForm({ ...form, visibility: "shared" })} className={`flex-1 py-2 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${form.visibility !== "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                    <Users className="w-4 h-4" /> Bersama
                  </button>
                  <button onClick={() => setForm({ ...form, visibility: "private" })} className={`flex-1 py-2 rounded-2xl border flex items-center justify-center gap-1.5 text-sm font-medium transition-all ${form.visibility === "private" ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
                    <Lock className="w-4 h-4" /> Pribadi
                  </button>
                </div>
              </Field>
              <Field label="Pemilik (opsional)">
                <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Mis. Suami / Istri" className="input" />
              </Field>
              <Field label="Catatan (opsional)">
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" />
              </Field>
              <button onClick={handleSave} disabled={saving} className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan Aset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}