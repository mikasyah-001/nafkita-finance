import { Loader2, Check, X, Copy } from "lucide-react";
import { formatMoney } from "@/lib/finance";
import { useUserCurrencies } from "@/hooks/useFinance";
import { findDuplicate } from "@/lib/duplicateDetect";

export default function MultiTransactionPreview({ items, categories, onChange, onCancel, onSave, saving, existingTransactions = [] }) {
  const dupCount = items.filter((t) => findDuplicate(t, existingTransactions)).length;
  const expenseCats = categories.filter((c) => c.type === "expense");
  const userCurrencies = useUserCurrencies();

  return (
    <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto">
      <div className="surface p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-sm">{items.length} transaksi terbaca</p>
            <p className="text-xs text-muted-foreground">Periksa kategori lalu simpan semua</p>
          </div>
          <button onClick={onCancel} className="btn-icon btn-icon-sm">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 max-h-[55vh] overflow-y-auto">
          {items.map((t, i) => (
            <div key={i} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {t.photo_url && (
                    <img src={t.photo_url} alt="bon" className="w-9 h-9 object-cover rounded-lg shrink-0" />
                  )}
                  <p className="text-sm font-medium truncate flex-1">{t.merchant || t.notes || "Transaksi"}</p>
                    {findDuplicate(t, existingTransactions) && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/15 text-warning text-[11px] font-medium shrink-0">
                        <Copy className="w-2.5 h-2.5" /> Duplikat
                      </span>
                    )}
                </div>
                <p className="text-sm font-bold ml-2">{formatMoney(t.amount, t.currency)}</p>
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Merchant"
                  value={t.merchant}
                  onChange={(e) => onChange(i, { merchant: e.target.value })}
                  className="flex-1 rounded-lg border border-border px-2 py-1.5 text-xs bg-transparent outline-none focus:ring-2 ring-primary/30"
                  placeholder="Merchant"
                />
                <select
                  aria-label="Kategori"
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
                <span className="text-[11px] text-muted-foreground shrink-0">Tanggal</span>
                <input
                  aria-label="Tanggal"
                  type="date"
                  value={t.date || ""}
                  onChange={(e) => onChange(i, { date: e.target.value })}
                  className="flex-1 rounded-lg border border-border px-2 py-1 text-xs bg-transparent outline-none focus:ring-2 ring-primary/30"
                />
                <input
                  aria-label="Jam"
                  type="time"
                  value={t.time || ""}
                  onChange={(e) => onChange(i, { time: e.target.value })}
                  className="rounded-lg border border-border px-2 py-1 text-xs bg-transparent outline-none focus:ring-2 ring-primary/30"
                />
                <select
                  aria-label="Mata uang"
                  value={t.currency || "IDR"}
                  onChange={(e) => onChange(i, { currency: e.target.value })}
                  className="rounded-lg border border-border px-2 py-1 text-xs bg-background outline-none focus:ring-2 ring-primary/30"
                >
                  {userCurrencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {dupCount > 0 && (
        <p className="text-xs text-warning text-center -mt-2 mb-2">
          {dupCount} transaksi terdeteksi duplikat dan akan dilewati
        </p>
      )}
      <button
        onClick={() => onSave(items.filter((t) => !findDuplicate(t, existingTransactions)))}
        disabled={saving || items.length - dupCount === 0}
        className="w-full btn-primary"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
        {saving ? "Menyimpan..." : `Simpan (${items.length - dupCount}/${items.length})`}
      </button>
    </div>
  );
}