import { Navigate, useParams } from "react-router-dom";

// Detail investasi & Riwayat DCA kini satu halaman dengan Detail aset.
// Rute lama /investasi/:id dipertahankan agar tautan lama tetap bekerja.
export default function InvestmentDetail() {
  const { id } = useParams();
  return <Navigate to={`/aset/${id}#dca`} replace />;
}
