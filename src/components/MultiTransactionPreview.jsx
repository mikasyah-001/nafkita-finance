import { Loader2, Check, X } from "lucide-react";
import { formatRupiah } from "@/lib/finance";

export default function MultiTransactionPreview({ items, categories, onChange, onCancel, onSave, saving }) {
  const expenseCats = categories.filter((c) => c.type === "expense");

  return (
    <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-sm">{items.length} transaksi terbaca</p>
            <p className="text-xs text-muted-foreground">Periksa kategori lalu simpan semua</p>
          </div>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto">
          {items.map((t, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium truncate flex-1">{t.merchant || t.notes || "Transaksi"}</p>
                <p className="text-sm font-bold ml-2">{formatRupiah(t.amount)}</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={t.merchant}
                  onChange={(e) => onChange(i, { merchant: e.target.value })}
                  className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs bg-transparent outline-none focus:ring-2 ring-primary/30"
                  placeholder="Merchant"
                />
                <select
                  value={t.category}
                  onChange={(e) => onChange(i, { category: e.target.value })}
                  className="rounded-lg border border-border px-2 py-1.5 text-xs bg-background outline-none focus:ring-2 ring-primary/30"
                >
                  <option value="">Pilih kategori</option>
                  {expenseCats.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-muted-foreground shrink-0">Tanggal</span>
                <input
                  type="date"
                  value={t.date || ""}
                  onChange={(e) => onChange(i, { date: e.target.value })}
                  className="flex-1 rounded-lg border border-border px-2 py-1 text-xs bg-transparent outline-none focus:ring-2 ring-primary/30"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
        {saving ? "Menyimpan..." : `Simpan Semua (${items.length})`}
      </button>
    </div>
  );
}