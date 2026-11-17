import { Fragment, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import FormSheet from "@/components/FormSheet";

// Pilihan gaya native: di layar lebar memakai <select> asli apa adanya,
// di HP (WebView) ketukan membuka bottom sheet — bukan picker bawaan sistem.
// <select> tetap dirender (tak terlihat & tak bisa disentuh di HP) agar id,
// value, onChange, aria-label, dan daftar <option> tetap sama seperti semula.
export default function NativeSelect({
  id,
  value,
  onChange,
  className = "",
  children,
  sheetTitle,
  "aria-label": ariaLabel,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => collectOptions(children), [children]);
  const selected = options.find((o) => String(o.value) === String(value ?? ""));

  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        className={`${className} opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto`}
        {...props}
      >
        {children}
      </select>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`md:hidden absolute inset-0 flex items-center justify-between gap-2 text-left ${className}`}
      >
        <span className="truncate">{selected ? selected.label : ""}</span>
        <ChevronDown className="w-4 h-4 shrink-0 opacity-60" />
      </button>

      {open && (
        <FormSheet title={sheetTitle || ariaLabel || "Pilih opsi"} onClose={() => setOpen(false)}>
          <div className="surface rounded-3xl divide-y divide-border">
            {options.map((o, i) => {
              const on = String(o.value) === String(value ?? "");
              return (
                <button
                  key={`${o.value}-${i}`}
                  type="button"
                  disabled={o.disabled}
                  onClick={() => {
                    onChange?.({ target: { value: o.value } });
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm active:bg-muted/60 disabled:opacity-50"
                >
                  <span className="flex-1 min-w-0">{o.label}</span>
                  {on && <Check className="w-4 h-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </FormSheet>
      )}
    </div>
  );
}

// Mengumpulkan <option> (termasuk dari array/conditional/fragment) menjadi
// { value, label, disabled } untuk dirender di dalam sheet.
function collectOptions(node, out = []) {
  if (node == null || node === false) return out;
  if (typeof node === "string" || typeof node === "number") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => collectOptions(n, out));
    return out;
  }
  if (!node || typeof node !== "object" || !node.props) return out;

  if (node.type === Fragment) {
    collectOptions(node.props.children, out);
    return out;
  }
  if (node.type === "option") {
    out.push({
      value: node.props.value ?? "",
      label: node.props.children,
      disabled: !!node.props.disabled,
    });
    return out;
  }
  if (node.type === "optgroup") {
    collectOptions(node.props.children, out);
  }
  return out;
}