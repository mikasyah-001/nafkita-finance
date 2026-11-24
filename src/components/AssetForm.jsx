import { useEffect, useRef, useState } from "react";
import { deleteAssetFlow } from "@/lib/assetDelete";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { uploadFile, uploadErrorText } from "@/lib/upload";
import { useRefresh, useMe, useUserCurrencies, useRateMap, useAssets } from "@/hooks/useFinance";
import { assetTypeLabels, formatMoney, currencySymbol, isGoldType, buildAssetPayload, switchAssetType, assetHasPurchase, goldPriceCurrencyHint, conversionPreview, amountCurrencyHint, canonicalBrokerFor, canonicalBroker, placeSuggestions, withSavedBank, BANK_LIKE_TYPES, DEFAULT_BANKS } from "@/lib/finance";
import ProofViewer from "@/components/ProofViewer";
import CurrencySwitchNotice from "@/components/CurrencySwitchNotice";
import { useCurrencySwitch } from "@/hooks/useCurrencySwitch";
import { INVESTMENT_CATEGORIES, investmentCategory } from "@/lib/investmentCategory";
import { normalizeAccountNumber, accountNumberError, defaultBankName, findDuplicateAccount, formatAccountNumber } from "@/lib/bankAccount";
import { toast } from "sonner";
import { Loader2, Upload, Check, Trash2, Users, Lock, Tag, Building2, UserRound, CalendarDays, Receipt, Image as ImageIcon, NotebookPen, ChevronRight, Shapes, Hash, Wallet } from "lucide-react";
import FormSheet, { FieldGroup, FieldRow, ChipChoice, fieldInput } from "@/components/FormSheet";
import CategoryIcon from "@/components/CategoryIcon";
import MoneyInput from "@/components/MoneyInput";

const types = ["bank", "tunai", "emas", "emas_digital", "investasi", "properti", "tanah", "lainnya"];

const digitalGoldBrokers = {
  SAR: ["Bank Al Rajhi", "Bank Aljazira", "SNB"],
  IDR: ["Bank BSI", "BCA", "Pegadaian"],
  USD: ["BullionStar", "Goldmoney"],
};

const empty = {
  name: "", type: "bank", value: "", quantity: "", unit: "", broker: "", account_number: "",
  purchase_date: "", purchase_price: "", purchase_proof_url: "",
  owner: "", notes: "", visibility: "shared", currency: "", account_role: "harian",
};

export default function AssetForm({ asset, onClose }) {
  const refresh = useRefresh();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!asset;
  const [form, setForm] = useState(() =>
    asset
      ? {
          ...empty,
          ...asset,
          value: String(asset.value || ""),
          quantity: String(asset.quantity || ""),
          purchase_price: String(asset.purchase_price || ""),
          account_number: formatAccountNumber(asset.account_number || ""),
        }
      : empty
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef(null);
  const { data: me } = useMe();
  const userCurrencies = useUserCurrencies();
  const { map: rateMap } = useRateMap();
  const { data: allAssets = [] } = useAssets();
  useEffect(() => {
    // Form baru mengikuti mata uang utama; "" = belum diisi (dulu default "IDR"
    // membuat mata uang utama tak pernah terpakai).
    if (!isEdit && me) setForm((f) => (f.currency ? f : { ...f, currency: (me.default_currency || "IDR").toUpperCase() }));
  }, [me, isEdit]);
  const cur = (form.currency || "IDR").toUpperCase();
  const sym = currencySymbol(cur);
  // Ganti mata uang ≠ ganti label diam-diam: tawarkan konversi / tetap / kembali.
  const moneyFields = { value: form.value, purchase_price: form.purchase_price };
  const curGuard = useCurrencySwitch({
    currency: form.currency, amounts: moneyFields, rateMap,
    setCurrency: (c) => setForm((f) => ({ ...f, currency: c })),
    setAmounts: (a) => setForm((f) => ({ ...f, ...a })),
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile(file, "imageOrPdf");
      setForm((f) => ({ ...f, purchase_proof_url: file_url }));
      toast.success("Bukti pembelian terunggah");
    } catch (err) {
      toast.error(uploadErrorText(err, "Gagal mengunggah bukti"));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    // Broker diseragamkan ke ejaan yang sudah tersimpan (tanpa ganda/salah ketik).
    // Tabungan/Bank: rekening dibedakan oleh nomornya (satu bank bisa banyak rekening).
    let name = form.name;
    if (form.type === "bank") {
      if (accountError) return toast.error(accountError);
      if (accountRequired && !normalizeAccountNumber(form.account_number)) return toast.error("Isi no. rekening", { description: "Satu bank bisa punya beberapa rekening — nomornya yang membedakan." });
      if (duplicateAccount) return toast.error("Rekening ini sudah tercatat", { description: `Sebagai "${duplicateAccount.name}".` });
      if (!String(name || "").trim()) name = defaultBankName(canonBroker(form.broker), form.account_number);
    }
    const { error, payload } = buildAssetPayload({ ...form, name, broker: canonBroker(form.broker) });
    if (error) return toast.error(error);
    payload.account_number = payload.type === "bank" ? normalizeAccountNumber(form.account_number) : "";
    // Peran rekening: harian (operasional) vs tabungan (disimpan). Keduanya
    // tetap aset kas; tunai selalu harian.
    payload.account_role = payload.type === "bank" ? (form.account_role === "tabungan" ? "tabungan" : "harian") : payload.type === "tunai" ? "harian" : "";
    // Jenis investasi: pilihan sendiri dikunci; selain itu tebakan otomatis dari nama/ticker.
    if (payload.type === "investasi") {
      payload.instrument = invCategory;
      payload.instrument_manual = !!form.instrument_manual;
    }
    // Nilai yang diubah sendiri di form → asal nilai "manual" (tidak lagi "dari broker").
    if (payload.type === "investasi" && (!isEdit || Number(payload.value) !== Number(asset.value))) {
      payload.value_source = "manual";
      payload.price_date = new Date().toISOString().slice(0, 10);
    }
    setSaving(true);
    try {
      if (isEdit) {
        await base44.entities.Asset.update(asset.id, payload);
        toast.success("Aset diperbarui");
      } else {
        await base44.entities.Asset.create(payload);
        toast.success("Aset ditambahkan");
      }
      // Bank baru → ditetapkan di profil agar lain kali tinggal klik
      // (juga untuk Emas Digital, dan tetap ada walau asetnya dihapus).
      if (BANK_LIKE_TYPES.includes(payload.type)) {
        const next = withSavedBank(savedBanks, payload.broker);
        if (next) {
          base44.auth.updateMe({ saved_banks: next })
            .then(() => queryClient.setQueryData(["me"], (m) => (m ? { ...m, saved_banks: next } : m)))
            .catch(() => {});
        }
      }
      refresh();
      onClose();
    } catch {
      toast.error(isEdit ? "Gagal memperbarui aset" : "Gagal menambah aset");
    }
    setSaving(false);
  };

  const showCurrency = true;
  // Saran: broker yang pernah dipakai untuk jenis ini lebih dulu, lalu saran umum.
  // Pilihan tinggal klik: bank/broker yang pernah ditulis (termasuk yang
  // ditetapkan di profil) lebih dulu, lalu saran umum sesuai mata uang.
  const savedBanks = Array.isArray(me?.saved_banks) ? me.saved_banks : [];
  const defaultBrokers = form.type === "bank" ? (DEFAULT_BANKS[cur] || DEFAULT_BANKS.IDR) : form.type === "emas_digital" ? (digitalGoldBrokers[cur] || []) : [];
  const savedBrokers = placeSuggestions({ assets: allAssets, type: form.type, savedBanks, defaults: [] });
  // Seragamkan ketikan ke ejaan tersimpan: aset sejenis dulu, lalu bank di profil.
  const canonBroker = (x) => {
    const viaAssets = canonicalBrokerFor(x, allAssets, form.type);
    if (viaAssets !== String(x || "").replace(/\s+/g, " ").trim()) return viaAssets;
    return canonicalBroker(x, savedBrokers, { prefix: false });
  };
  const brokerSuggestions = placeSuggestions({ assets: allAssets, type: form.type, savedBanks, defaults: defaultBrokers });
  const brokerTyped = (form.broker || "").trim();
  const brokerCanon = brokerTyped ? canonBroker(brokerTyped) : "";
  const brokerFix = brokerCanon && brokerCanon !== brokerTyped.replace(/\s+/g, " ") ? brokerCanon : "";
  // Rekening wajib untuk bank baru; rekening lama tanpa nomor tetap bisa disimpan.
  const accountRequired = form.type === "bank" && (!isEdit || !!asset?.account_number);
  const accountError = form.type === "bank" ? accountNumberError(form.account_number) : "";
  const duplicateAccount = form.type === "bank" ? findDuplicateAccount(allAssets, form.account_number, asset?.id) : null;
  const autoBankName = defaultBankName(form.broker, form.account_number);
  const brokerLabel = form.type === "bank" ? "Bank" : form.type === "investasi" ? "Broker / aplikasi" : "Tempat beli / simpan";
  const invCategory = investmentCategory({ ...form, ticker: form.ticker || asset?.ticker, exchange: form.exchange || asset?.exchange });
  const showBroker = ["bank", "investasi", "emas_digital"].includes(form.type);
  // Nominal besar dalam mata uang asing yang tampak seperti Rupiah (mis. $1.008.000).
  const valueHint = !isGoldType(form.type) && userCurrencies.some((c) => c.code === "IDR")
    ? (amountCurrencyHint(form.value, cur, rateMap) || (form.type !== "tanah" && amountCurrencyHint(form.purchase_price, cur, rateMap))) : null;
  const goldHint = isGoldType(form.type) ? goldPriceCurrencyHint(form.purchase_price, cur, userCurrencies.map((c) => c.code), rateMap) : null;
  const goldTotal = isGoldType(form.type) && form.quantity && form.purchase_price ? Number(form.quantity) * Number(form.purchase_price) : 0;

  const nameRow = (
    <FieldRow icon={Tag} label={form.type === "bank" ? "Nama (opsional)" : "Nama aset"} htmlFor="asset-name">
      <input id="asset-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder={form.type === "bank" ? (form.broker || form.account_number ? `Otomatis: ${autoBankName}` : "Mis. Tabungan keluarga, Gaji") : form.type === "tunai" ? "Mis. Dompet tunai, Riyal umrah" : "Mis. Tabungan BCA, Emas Antam"} className={fieldInput} />
    </FieldRow>
  );

  const handleDelete = async () => {
    setSaving(true);
    try {
      if (!(await deleteAssetFlow(asset))) { setSaving(false); return; }
      refresh();
      toast.success("Aset dihapus");
      onClose();
      // Bila form dibuka dari halaman detail aset yang kini sudah tidak ada.
      if (window.location.pathname === `/aset/${asset.id}`) navigate("/aset", { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Gagal menghapus aset");
      setSaving(false);
    }
  };

  return (
    <FormSheet
      title={isEdit ? "Edit aset" : "Tambah aset"}
      subtitle="Catat tabungan, dompet tunai, emas, investasi, dan properti keluarga."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          {/* Hapus juga bisa dari form edit (alurnya sama dengan halaman detail aset) */}
          {isEdit && asset.created_by_id === me?.id && (
            <button type="button" onClick={handleDelete} disabled={saving} aria-label="Hapus aset" className="btn-secondary px-4 text-destructive">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {saving ? "Menyimpan..." : isEdit ? "Simpan perubahan" : "Simpan aset"}
          </button>
        </div>
      }
    >
      {/* Jenis */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Jenis aset</p>
        <div role="radiogroup" aria-label="Jenis aset" className="grid grid-cols-4 gap-2">
          {types.map((t) => {
            const meta = assetTypeLabels[t];
            const on = form.type === t;
            return (
              <button key={t} type="button" role="radio" aria-checked={on}
                onClick={() => setForm(switchAssetType(form, t))}
                className={`flex flex-col items-center gap-1.5 pt-2.5 pb-2 rounded-2xl border transition-all ${on ? "border-primary bg-primary/[0.07] ring-1 ring-primary" : "border-border bg-card"}`}>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <CategoryIcon name={meta.icon} className="w-4 h-4" />
                </span>
                <span className={`text-[11px] leading-tight text-center px-0.5 [overflow-wrap:anywhere] ${on ? "font-semibold" : ""}`}>{meta.label.replace("/", "/\u200b")}</span>
              </button>
            );
          })}
        </div>
        {/* Impor otomatis — kontekstual untuk jenis yang biasa dicatat di aplikasi broker */}
        {!isEdit && (form.type === "investasi" || form.type === "emas_digital") && (
          <Link to="/impor-portofolio" onClick={onClose}
            className="mt-3 card-pastel card-pastel-sage rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
            <span className="w-9 h-9 rounded-xl bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0"><Upload className="w-4 h-4" /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold leading-tight">Impor dari aplikasi {form.type === "investasi" ? "broker" : "emas"}</span>
              <span className="block text-[11px] opacity-80 leading-snug mt-0.5">Foto/PDF portofolio dibaca otomatis — jumlah, modal, nilai & tanggal beli</span>
            </span>
            <ChevronRight className="w-4 h-4 opacity-70 shrink-0" />
          </Link>
        )}
      </section>

      <FieldGroup label="Identitas">
        {/* Tabungan/Bank: Bank → No. rekening → Nama (otomatis). Jenis lain: Nama → tempat. */}
        {form.type !== "bank" && nameRow}
        {showBroker && (
          <FieldRow icon={Building2} label={brokerLabel} htmlFor="asset-broker">
            <input id="asset-broker" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} placeholder={brokerSuggestions.length ? "Pilih di bawah atau ketik baru" : "Opsional"} className={fieldInput} />
            {brokerFix && (
              <p className="text-[11px] text-muted-foreground mt-1">Disimpan sebagai <button type="button" onClick={() => setForm({ ...form, broker: brokerFix })} className="font-semibold text-primary">{brokerFix}</button> (sudah tersimpan)</p>
            )}
            {brokerSuggestions.length > 0 && (
              <div className="mt-2"><ChipChoice size="sm" ariaLabel={savedBrokers.length ? (BANK_LIKE_TYPES.includes(form.type) ? "Bank tersimpan" : "Broker tersimpan") : "Saran"} options={brokerSuggestions} value={brokerCanon || form.broker} onChange={(b) => setForm({ ...form, broker: b })} /></div>
            )}
          </FieldRow>
        )}
        {form.type === "bank" && (
          <FieldRow icon={Hash} label={accountRequired ? "No. rekening / IBAN" : "No. rekening / IBAN (disarankan)"} htmlFor="asset-account">
            <input id="asset-account" value={form.account_number || ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              onBlur={() => setForm((f) => ({ ...f, account_number: formatAccountNumber(f.account_number) }))}
              inputMode="text" autoCapitalize="characters" autoComplete="off" placeholder="Mis. 1234567890 atau SA03 8000 …" className={`${fieldInput} tabular-nums tracking-wide`} />
            {accountError ? <p className="text-[11px] text-expense mt-1">{accountError}</p>
              : duplicateAccount ? <p className="text-[11px] text-expense mt-1">Rekening ini sudah tercatat sebagai “{duplicateAccount.name}”.</p>
              : <p className="text-[11px] text-muted-foreground mt-1">Pembeda rekening di bank yang sama. Di daftar tampil ••4 digit terakhir.</p>}
          </FieldRow>
        )}
        {form.type === "bank" && (
          <FieldRow icon={Wallet} label="Dipakai untuk">
            <div className="mt-1.5"><ChipChoice size="sm" ariaLabel="Peran rekening" value={form.account_role === "tabungan" ? "tabungan" : "harian"} onChange={(v) => setForm({ ...form, account_role: v })}
              options={[{ value: "harian", label: "Harian" }, { value: "tabungan", label: "Tabungan" }]} /></div>
            <p className="text-[11px] text-muted-foreground mt-1">{form.account_role === "tabungan"
              ? "Uang yang disimpan: dana darurat, target, simpanan. Cocok untuk \"Disimpan di\" pada target."
              : "Untuk gaji masuk, belanja & tagihan sehari-hari. Saldonya naik-turun."}</p>
          </FieldRow>
        )}
        {form.type === "bank" && nameRow}
        {form.type === "investasi" && (
          <FieldRow icon={Shapes} label={form.instrument_manual ? "Jenis investasi" : "Jenis investasi · otomatis"}>
            <div className="mt-1"><ChipChoice size="sm" ariaLabel="Jenis investasi" options={INVESTMENT_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} value={invCategory}
              onChange={(k) => setForm({ ...form, instrument: k, instrument_manual: true })} /></div>
            {form.instrument_manual && (
              <button type="button" onClick={() => setForm({ ...form, instrument: "", instrument_manual: false })} className="text-[11px] font-semibold text-primary mt-1.5">Kembalikan ke otomatis</button>
            )}
          </FieldRow>
        )}
        <FieldRow icon={UserRound} label="Pemilik (opsional)" htmlFor="asset-owner">
          <input id="asset-owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="Mis. Suami / Istri" className={fieldInput} />
        </FieldRow>
      </FieldGroup>

      {/* Nilai */}
      <section className="card-gradient-primary rounded-[24px] p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs opacity-80">
            {isGoldType(form.type) ? "Jumlah & harga emas" : form.type === "tanah" ? "Luas & harga tanah" : "Nilai saat ini"}
          </p>
          {showCurrency && userCurrencies.length > 1 && (
            <div role="radiogroup" aria-label="Mata uang" className="flex gap-1">
              {userCurrencies.map((c) => (
                <button key={c.code} type="button" role="radio" aria-checked={form.currency === c.code} onClick={() => curGuard.change(c.code)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-bold border transition-colors ${form.currency === c.code ? "bg-white text-[hsl(var(--hero-from))] border-white" : "border-white/25 text-white/75"}`}>{c.code}</button>
              ))}
            </div>
          )}
        </div>
        {isGoldType(form.type) || form.type === "tanah" ? (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <HeroInput id={isGoldType(form.type) ? "asset-gold-quantity" : "asset-land-quantity"} label={isGoldType(form.type) ? "Gram" : "Luas (m²)"} value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            <HeroInput id={isGoldType(form.type) ? "asset-gold-purchase-price" : "asset-land-purchase-price"} label={`Harga beli / ${isGoldType(form.type) ? "gr" : "m²"} (${cur})`} currency={cur}
              value={form.purchase_price}
              onChange={(v) => setForm({ ...form, purchase_price: v })} />
            {form.type === "tanah" && (
              <div className="col-span-2"><HeroInput id="asset-land-value" currency={cur} label={`Perkiraan harga sekarang (${cur}, opsional)`} value={form.value} onChange={(v) => setForm({ ...form, value: v })} /></div>
            )}
          </div>
        ) : (
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-lg font-semibold opacity-70">{sym}</span>
            <MoneyInput currency={cur} id="asset-value" aria-label={`Nilai saat ini (${sym})`} value={form.value} onChange={(v) => setForm({ ...form, value: v })} placeholder="0"
              className="flex-1 min-w-0 bg-transparent outline-none font-heading text-[32px] leading-none font-extrabold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]" />
          </div>
        )}
        {!curGuard.origin && !isGoldType(form.type) && form.type !== "tanah" && cur !== "IDR" && conversionPreview(form.value, cur, "IDR", rateMap) && (
          <p className="text-xs opacity-80 mt-1 tabular-nums">{conversionPreview(form.value, cur, "IDR", rateMap)}</p>
        )}
        <CurrencySwitchNotice guard={curGuard} />
        {valueHint && (
          <div role="alert" className="mt-3 rounded-2xl bg-white/12 border border-white/25 p-3 text-xs">
            <p className="font-semibold">Periksa mata uang</p>
            <p className="opacity-85 mt-0.5">{valueHint.message}</p>
            <button type="button" onClick={() => setForm({ ...form, currency: "IDR" })}
              className="mt-2 h-8 px-3 rounded-full bg-white text-[hsl(var(--hero-from))] text-xs font-bold">Angka ini Rupiah (IDR)</button>
          </div>
        )}
        {goldHint && (
          <div role="alert" className="mt-3 rounded-2xl bg-white/12 border border-white/25 p-3 text-xs">
            <p className="font-semibold">Periksa mata uang</p>
            <p className="opacity-85 mt-0.5">{goldHint.message}</p>
            <button type="button" onClick={() => setForm({ ...form, currency: goldHint.suggest })}
              className="mt-2 h-8 px-3 rounded-full bg-white text-[hsl(var(--hero-from))] text-xs font-bold">
              Ganti ke {goldHint.suggest}
            </button>
          </div>
        )}
        {(goldTotal > 0 || (form.type === "tanah" && form.quantity && form.purchase_price)) && (
          <p className="text-xs opacity-80 mt-2">Total harga beli: <span className="font-semibold">{formatMoney(goldTotal || Number(form.purchase_price) * Number(form.quantity), cur)}</span>
            {cur !== "IDR" && <span className="opacity-75"> {conversionPreview(goldTotal || Number(form.purchase_price) * Number(form.quantity), cur, "IDR", rateMap)}</span>}</p>
        )}
        {isGoldType(form.type) && <p className="text-[11px] opacity-70 mt-1">Nilai pasar dihitung otomatis dari harga emas terkini bila tersedia.</p>}
        {form.type === "tunai" && <p className="text-[11px] opacity-70 mt-1">Isi jumlah uang di dompet saat ini (boleh 0).</p>}
      </section>

      {assetHasPurchase(form.type) && <FieldGroup label="Pembelian (opsional)">
        <FieldRow icon={CalendarDays} label="Tanggal beli" htmlFor="asset-purchase-date">
          <input id="asset-purchase-date" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} className={fieldInput} />
        </FieldRow>
        {!isGoldType(form.type) && form.type !== "tanah" && (
          <FieldRow icon={Receipt} label={`Harga beli (${sym})`} htmlFor="asset-purchase-price" hint="Untuk menghitung pertumbuhan nilai aset.">
            <MoneyInput currency={cur} id="asset-purchase-price" value={form.purchase_price} onChange={(v) => setForm({ ...form, purchase_price: v })} placeholder="0" className={`${fieldInput} tabular-nums`} />
          </FieldRow>
        )}
        <FieldRow icon={ImageIcon} label="Bukti pembelian">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          {form.purchase_proof_url ? (
            <div className="relative w-fit mt-1">
              <button type="button" onClick={() => setPreview(true)} aria-label="Lihat bukti pembelian" className="block rounded-xl overflow-hidden active:scale-95 transition-transform">
                <img src={form.purchase_proof_url} alt="Bukti pembelian" className="w-24 h-24 object-cover bg-muted" />
              </button>
              <button onClick={() => setForm({ ...form, purchase_proof_url: "" })} aria-label="Hapus bukti" className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-foreground text-background flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-1 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-dashed border-border text-xs font-semibold text-muted-foreground disabled:opacity-60">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {uploading ? "Mengunggah..." : "Unggah foto"}
            </button>
          )}
        </FieldRow>
      </FieldGroup>}

      <FieldGroup label="Lainnya">
        <FieldRow icon={form.visibility === "private" ? Lock : Users} label="Jangkauan"
          trailing={
            <div role="radiogroup" aria-label="Jangkauan" className="flex gap-1 p-0.5 rounded-full bg-muted shrink-0 self-center">
              {[["shared", "Bersama"], ["private", "Pribadi"]].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={(form.visibility || "shared") === v} onClick={() => setForm({ ...form, visibility: v })}
                  className={`h-7 px-3 rounded-full text-xs font-semibold transition-colors ${(form.visibility || "shared") === v ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
          }>
          <p className="text-sm">{form.visibility === "private" ? "Hanya Anda" : "Terlihat pasangan"}</p>
        </FieldRow>
        <FieldRow icon={NotebookPen} label="Catatan" htmlFor="asset-notes">
          <input id="asset-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsional" className={fieldInput} />
        </FieldRow>
      </FieldGroup>
      {preview && <ProofViewer url={form.purchase_proof_url} onClose={() => setPreview(false)} />}
    </FormSheet>
  );
}

// `currency` diisi = kotak nominal (berpemisah ribuan); kosong = jumlah (gram, m²).
function HeroInput({ id, label, value, onChange, currency }) {
  const cls = "w-full bg-transparent outline-none text-lg font-bold tabular-nums placeholder:text-white/30 text-[hsl(var(--hero-foreground))]";
  return (
    <div className="rounded-2xl bg-white/[0.08] border border-white/10 px-3 py-2">
      <label htmlFor={id} className="block text-[11px] opacity-75">{label}</label>
      {currency
        ? <MoneyInput id={id} currency={currency} value={value} onChange={onChange} placeholder="0" className={cls} />
        : <input id={id} type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} placeholder="0" className={cls} />}
    </div>
  );
}
