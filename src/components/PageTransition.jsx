import { motion, useReducedMotion } from "framer-motion";
import { useNavigationType } from "react-router-dom";

// Transisi layar ala aplikasi native: halaman baru masuk dari kanan (PUSH),
// kembali (POP / tombol back) masuk dari kiri. Geser dibuat pendek (bukan
// selebar layar) agar ringan di WebView kelas bawah. Saat animasi selesai
// framer-motion mengembalikan transform ke "none", sehingga elemen
// position:fixed di dalam halaman (sheet, footer lengket) tetap mengacu ke
// viewport, bukan ke pembungkus ini.
const EASE = [0.22, 0.8, 0.3, 1];

export default function PageTransition({ children, className, variant = "push" }) {
  const navType = useNavigationType();
  const reduce = useReducedMotion();
  const dir = navType === "POP" ? -1 : 1;
  const offset = reduce ? 0 : 20;

  // Hanya geser (transform), TANPA opacity: memudarkan halaman membuat layar
  // tampak berkedip dua kali (keluar-pudar → kosong → masuk-pudar).
  // Layar formulir penuh (Catat transaksi dll.) naik dari bawah seperti
  // sheet, sehingga terasa sebagai "tindakan", bukan pindah halaman.
  if (variant === "sheet") {
    return (
      <motion.div
        className={className}
        initial={reduce ? false : { y: 48 }}
        animate={{ y: 0, transition: { duration: 0.26, ease: EASE } }}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={offset ? { x: offset * dir } : false}
      animate={{ x: 0, transition: { duration: 0.2, ease: EASE } }}
    >
      {children}
    </motion.div>
  );
}
