import { motion, useReducedMotion } from "framer-motion";
import { useNavigationType } from "react-router-dom";

// Transisi layar ala aplikasi native: halaman baru masuk dari kanan (PUSH),
// kembali (POP / tombol back) masuk dari kiri. Geser dibuat pendek (bukan
// selebar layar) agar ringan di WebView kelas bawah. Saat animasi selesai
// framer-motion mengembalikan transform ke "none", sehingga elemen
// position:fixed di dalam halaman (sheet, footer lengket) tetap mengacu ke
// viewport, bukan ke pembungkus ini.
const EASE = [0.22, 0.8, 0.3, 1];

export default function PageTransition({ children, className }) {
  const navType = useNavigationType();
  const reduce = useReducedMotion();
  const dir = navType === "POP" ? -1 : 1;
  const offset = reduce ? 0 : 28;

  return (
    <motion.div
      className={className}
      custom={dir}
      initial={{ opacity: 0, x: offset * dir }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.24, ease: EASE } }}
      exit={{ opacity: 0, x: -offset * dir * 0.5, transition: { duration: 0.12, ease: "easeIn" } }}
    >
      {children}
    </motion.div>
  );
}
