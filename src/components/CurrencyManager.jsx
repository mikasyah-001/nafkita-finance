import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMe, useRefresh } from "@/hooks/useFinance";
import { currencies as builtIn } from "@/lib/finance";
import { toast } from "sonner";
import { Plus, Check, Loader2, Trash2, Star, Power } from "lucide-react";

export default function CurrencyManager() {
  const { data: me } = useMe();
  const refresh = useRefresh();
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ code: "", label: "", symbol: "" });

  const active = me?.active_currencies?.length ? me.active_currencies : [me?.default_currency || "IDR"];
  const custom = me?.custom_currencies || [];
  const defaultCur = me?.default_currency || "IDR";

  const fullList = [...builtIn, ...custom];
  const activeSet = new Set(active);
  const inactiveCurrencies = fullList.filter((c) => !activeSet.has(c.code));

  const persist = async (patch) => {
    setSaving(true);
    try {
      await base44.auth.updateMe(patch);
      refresh();
    } catch {
      toast.error("Gagal menyimpan mata uang");
    }
    setSaving(false);
  };

  const toggle = (code) => {
    const set = new Set(active);
    if (set.has(code)) {
      if (code === defaultCur) return toast.error("Tidak dapat menonaktifkan mata uang utama");
      if (set.size <= 1) return toast.error("Minimal satu mata uang harus aktif");
      set.delete(code);
    } else {
      set.add(code);
    }
    persist({ active_currencies: Array.from(set) });
  };

  const setDefault = (code) => {
    const newActive = active.includes(code) ? active : [...active, code];
    persist({ default_currency: code, active_currencies: newActive });
    toast.success("Mata uang utama diperbarui");
  };

  const addCustom = () => {
    const code = form.code.trim().toUpperCase();
    const label = form.label.trim();
    const symbol = form.symbol.trim();
    if (!/^[A-Z]{3}$/.test(code)) return toast.error("Kode mata uang harus 3 huruf, misalnya KWD");
    if (!label || !symbol) return toast.error("Lengkapi nama dan simbol");
    if (fullList.some((c) => c.code === code)) return toast.error("Kode mata uang sudah ada");
    const newCustom = [...custom, { code, label, symbol }];
    const newActive = active.includes(code) ? active : [...active, code];
    setForm({ code: "", label: "", symbol: "" });
    setShowAdd(false);
    persist({ custom_currencies: newCustom, active_currencies: newActive });
    toast.success(`Mata uang ${code} ditambahkan`);
  };

  const removeCustom = (code) => {
    if (code === defaultCur) return toast.error("Tidak dapat menghapus mata uang utama");
    persist({
      custom_currencies: custom.filter((c) => c.code !== code),
      active_currencies: active.filter((c) => c !== code),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Mata Uang Utama</label>
        <select
          value={defaultCur}
          onChange={(e) => setDefault(e.target.value)}
          disabled={saving}
          className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary/30 bg-transparent"
        >
          {active.map((code) => {
            const c = fullList.find((x) => x.code === code) || { code, label: code };
            return <option key={code} value={code}>{c.code} — {c.label}</option>;
          })}
        </select>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Mata Uang Aktif</p>
        <div className="space-y-2">
          {active.map((code) => {
            const c = fullList.find((x) => x.code === code) || { code, label: code, symbol: code };
            const isCustom = custom.some((x) => x.code === code);
            const isDefault = code === defaultCur;
            return (
              <div key={code} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center font-semibold text-sm text-primary shrink-0">
                  {c.symbol}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    {c.code}
                    {isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                </div>
                {!isDefault && (
                  <button onClick={() => setDefault(code)} disabled={saving} className="text-[10px] text-primary px-2 py-1 rounded-lg hover:bg-primary/10 disabled:opacity-50 shrink-0">
                    Utama
                  </button>
                )}
                {isCustom && (
                  <button onClick={() => removeCustom(code)} disabled={saving} aria-label={`Hapus ${code}`} className="text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => toggle(code)}
                  disabled={saving || isDefault}
                  className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 shrink-0"
                  aria-label={`Nonaktifkan ${code}`}
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {inactiveCurrencies.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Tambah dari Daftar</p>
          <div className="flex flex-wrap gap-2">
            {inactiveCurrencies.map((c) => (
              <button
                key={c.code}
                onClick={() => toggle(c.code)}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium active:scale-95 disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> {c.code} · {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showAdd ? (
        <div className="rounded-xl border border-border p-3 space-y-2.5">
          <p className="text-xs font-medium">Mata Uang Kustom</p>
          <div className="grid grid-cols-3 gap-2">
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3) })} placeholder="Kode" className="input py-2" />
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Nama" className="input py-2" />
            <input value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} placeholder="Simbol" className="input py-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={addCustom} disabled={saving} className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-1.5 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Tambah
            </button>
            <button onClick={() => { setShowAdd(false); setForm({ code: "", label: "", symbol: "" }); }} className="px-4 py-2 rounded-xl border border-border text-sm font-medium">Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowAdd(true)} className="w-full py-2.5 rounded-xl border-2 border-dashed border-border text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform">
          <Plus className="w-4 h-4" /> Tambah Mata Uang Kustom
        </button>
      )}

      <p className="text-[10px] text-muted-foreground">Total di dashboard tetap dipisah per mata uang (tanpa konversi). Nonaktifkan mata uang yang tidak terpakai agar tampilan lebih ringkas.</p>
    </div>
  );
}