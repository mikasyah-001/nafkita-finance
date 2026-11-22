import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { wrapIndex } from "@/lib/wallet";

// Tumpukan kartu yang digeser vertikal — dipakai halaman Dompet dan
// "Rencana kita" di Beranda (satu logika, banyak tampilan).
//
// Gerak kartu fisik, tanpa animasi opasitas (jadi tidak berkedip):
//  - maju (geser ke ATAS): kartu depan meluncur keluar lewat tepi atas (dipotong
//    rapi oleh wadah), lalu turun di belakang; kartu berikutnya naik ke depan.
//  - mundur (geser ke BAWAH): kartu sebelumnya dipindah diam-diam ke atas (di
//    luar area terlihat), lalu turun menutup tumpukan.

export const CARD_H = 176;
const PEEK = 9;
const SWIPE_PX = 36;
// Pegas teredam penuh: gerak lembut tanpa memantul.
const SPRING = { type: "spring", stiffness: 260, damping: 32, mass: 1 };

// Posisi menurut jarak dari kartu terdepan (d = 0). Kartu tersembunyi menunggu
// tepat di belakang kartu ke-3 → tertutup penuh, tidak pernah melintas.
function slot(d) {
  if (d === 0) return { y: 0, scale: 1, opacity: 1, zIndex: 30 };
  if (d <= 2) return { y: d * PEEK, scale: 1 - d * 0.045, opacity: 1, zIndex: 30 - d };
  return { y: 2 * PEEK, scale: 0.91, opacity: 1, zIndex: 1 };
}
const OUT = { y: -(CARD_H + 24), scale: 1, opacity: 1, zIndex: 40 };

/** Status navigasi tumpukan. `activeId` dikendalikan pemanggil. */
export function useCardStack(items, activeId, onActiveChange) {
  const n = items.length;
  const found = items.findIndex((x) => x.id === activeId);
  const idx = found >= 0 ? found : 0;
  const current = items[idx];
  const [leaving, setLeaving] = useState(null);
  const [entering, setEntering] = useState(null); // { id, phase: "place" | "drop" }
  const busy = !!leaving || !!entering;

  // Pengaman: bila event selesai-animasi tidak datang, jangan sampai terkunci.
  useEffect(() => {
    if (!leaving && !entering) return undefined;
    const t = setTimeout(() => { setLeaving(null); setEntering(null); }, 900);
    return () => clearTimeout(t);
  }, [leaving, entering]);

  const go = (step) => {
    if (n < 2 || busy) return;
    const target = items[wrapIndex(idx + step, n)];
    if (step > 0) setLeaving(current.id);
    else setEntering({ id: target.id, phase: "place" });
    onActiveChange(target.id);
  };
  // Lompat langsung (mis. tab) — dianimasikan sebagai maju/mundur satu langkah.
  const jumpTo = (id) => {
    const i = items.findIndex((x) => x.id === id);
    if (i < 0 || i === idx || busy) return;
    if (i > idx) setLeaving(current.id);
    else setEntering({ id, phase: "place" });
    onActiveChange(id);
  };
  return { n, idx, current, go, jumpTo, leaving, setLeaving, entering, setEntering };
}

export default function CardStack({ stack, items, renderCard, onTapFront, ariaLabel }) {
  const { n, idx, current, go, leaving, setLeaving, entering, setEntering } = stack;
  const stackH = CARD_H + Math.min(n - 1, 2) * PEEK;
  // Geser ≠ ketuk: ketukan diabaikan bila jari sempat bergeser.
  const panned = useRef(false);

  return (
    // Wadah pemotong (40px ekstra untuk bayangan) TIDAK menangkap sentuhan,
    // agar elemen di bawahnya tetap bisa diketuk. Gestur ditangani lapisan
    // transparan seukuran tumpukan kartu.
    <div
      className="relative select-none overflow-hidden -mx-4 -mb-10 pointer-events-none"
      style={{ height: stackH + 40 }}
      role="group"
      aria-roledescription="tumpukan kartu"
      aria-label={ariaLabel ?? (current ? `Kartu ${idx + 1} dari ${n}` : undefined)}
    >
      {items.map((item, i) => {
        const d = wrapIndex(i - idx, n);
        let target = slot(d);
        let transition = SPRING;
        let onDone;
        if (item.id === leaving) {
          target = OUT;
          onDone = () => setLeaving(null); // sudah di luar area terlihat → aman turun ke belakang
        } else if (entering?.id === item.id) {
          if (entering.phase === "place") {
            target = OUT;
            transition = { duration: 0 };
            onDone = () => setEntering({ id: item.id, phase: "drop" });
          } else {
            target = { ...slot(0), zIndex: 40 };
            onDone = () => setEntering(null);
          }
        }
        return (
          <motion.div
            key={item.id}
            className="absolute left-4 right-4 top-0 rounded-[26px] shadow-[0_18px_36px_-20px_rgba(0,0,0,0.55)]"
            style={{ height: CARD_H, zIndex: target.zIndex, transformOrigin: "bottom center", willChange: "transform", pointerEvents: "none" }}
            initial={false}
            animate={{ y: target.y, scale: target.scale, opacity: target.opacity }}
            transition={transition}
            onAnimationComplete={onDone}
            aria-hidden={d !== 0}
          >
            {renderCard(item)}
          </motion.div>
        );
      })}
      <motion.div
        className={`absolute left-4 right-4 top-0 pointer-events-auto ${n > 1 ? "cursor-grab active:cursor-grabbing" : onTapFront ? "cursor-pointer" : ""}`}
        style={{ height: stackH, zIndex: 50, touchAction: n > 1 ? "none" : "auto" }}
        onPointerDown={() => { panned.current = false; }}
        onPanStart={() => { panned.current = true; }}
        onPanEnd={(_, info) => {
          if (n < 2) return;
          if (info.offset.y < -SWIPE_PX || info.velocity.y < -400) go(1);
          else if (info.offset.y > SWIPE_PX || info.velocity.y > 400) go(-1);
        }}
        onTap={onTapFront && current ? () => { if (!panned.current) onTapFront(current); } : undefined}
        role={onTapFront ? "button" : undefined}
        tabIndex={onTapFront ? 0 : undefined}
        aria-label={onTapFront && current ? `Buka ${current.title || "kartu"}` : undefined}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); go(1); }
          else if (e.key === "ArrowUp") { e.preventDefault(); go(-1); }
          else if ((e.key === "Enter" || e.key === " ") && onTapFront && current) { e.preventDefault(); onTapFront(current); }
        }}
      />
    </div>
  );
}
