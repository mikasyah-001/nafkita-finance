import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Koneksi pasangan berbasis server (entitas Partnership).
// Hanya suami-istri yang saling terhubung melalui undangan email.
// Pasangan aktif = ada record Partnership berstatus "active" yang melibatkan user ini.
export function usePartnership() {
  const qc = useQueryClient();

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const partnershipsQ = useQuery({
    queryKey: ["partnerships"],
    queryFn: () => base44.entities.Partnership.list(),
  });
  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const me = meQ.data || null;
  const partnerships = partnershipsQ.data || [];
  const users = usersQ.data || [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["partnerships"] });
    qc.invalidateQueries({ queryKey: ["users"] });
    // Segarkan daftar transaksi/aset/anggaran agar data bersama pasangan langsung termutakhir.
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["assets"] });
    qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  // Pasangan aktif: record status active yang melibatkan saya (sebagai inviter atau invitee)
  const myActive = partnerships.filter(
    (p) => p.status === "active" && (p.inviter_id === me?.id || p.invitee_id === me?.id)
  );
  const partnerIds = myActive
    .map((p) => (p.inviter_id === me?.id ? p.invitee_id : p.inviter_id))
    .filter(Boolean);
  const partners = users.filter((u) => partnerIds.includes(u.id));
  const hasPartner = partners.length > 0;

  // Undangan terkirim oleh saya yang masih menunggu
  const sentInvites = partnerships.filter(
    (p) => p.created_by_id === me?.id && p.status === "pending"
  );

  // Permintaan masuk: seseorang mengundang saya, belum saya tanggapi
  const incomingRequests = partnerships.filter(
    (p) => p.invitee_email === me?.email && p.status === "pending" && p.inviter_id !== me?.id
  );

  const invite = async (email) => {
    if (!email) return toast.error("Masukkan email pasangan");
    if (email === me?.email) return toast.error("Tidak dapat mengundang diri sendiri");
    if (hasPartner) return toast.error("Anda sudah terhubung dengan pasangan");
    if (sentInvites.length > 0 || incomingRequests.length > 0)
      return toast.error("Selesaikan undangan/permintaan yang ada dahulu");
    try {
      const res = await base44.functions.invoke("createPartnershipInvite", { email });
      if (res?.data?.error) throw new Error(res.data.error);
      refresh();
      toast.success("Undangan terkirim", { description: `Ke ${email}. Pasangan akan menerima email undangan.` });
    } catch (e) {
      const msg = e?.message || "Coba lagi.";
      if (msg.includes("already_connected")) return toast.error("Anda sudah terhubung dengan pasangan");
      if (msg.includes("pending_exists")) return toast.error("Selesaikan undangan/permintaan yang ada dahulu");
      toast.error("Gagal mengundang", { description: msg });
    }
  };

  const connectByCode = async (code) => {
    if (!code) return toast.error("Masukkan kode referensi");
    if (hasPartner) return toast.error("Anda sudah terhubung dengan pasangan");
    if (sentInvites.length > 0 || incomingRequests.length > 0)
      return toast.error("Selesaikan undangan/permintaan yang ada dahulu");
    try {
      const res = await base44.functions.invoke("connectByRefCode", { code });
      const r = res?.data || res;
      refresh();
      toast.success("Permintaan koneksi terkirim", {
        description: `Menunggu ${r?.target?.full_name || r?.target?.email || "pasangan"} menyetujui.`,
      });
      return true;
    } catch (e) {
      toast.error("Gagal menghubungkan", { description: e?.message || "Periksa kode dan coba lagi." });
      return false;
    }
  };

  const resend = async (p) => {
    try {
      await base44.users.inviteUser(p.invitee_email, "user");
      toast.success("Undangan dikirim ulang", { description: `Ke ${p.invitee_email}` });
    } catch (e) {
      toast.error("Gagal mengirim ulang", { description: e?.message });
    }
  };

  const cancelInvite = async (id) => {
    try {
      await base44.functions.invoke("terminatePartnership", { partnership_id: id });
      refresh();
      toast.success("Undangan dibatalkan");
    } catch {
      toast.error("Gagal membatalkan");
    }
  };

  const acceptRequest = async (p) => {
    try {
      const res = await base44.functions.invoke("acceptPartnershipInvite", { partnership_id: p.id });
      if (res?.data?.error) throw new Error(res.data.error);
      refresh();
      toast.success("Pasangan terhubung", { description: "Kini Anda dapat mencatat bersama." });
    } catch (e) {
      const msg = e?.message || "Gagal menerima undangan";
      if (msg.includes("already_connected")) return toast.error("Anda sudah terhubung dengan pasangan");
      if (msg.includes("inviter_connected")) return toast.error("Pengundang sudah terhubung dengan orang lain");
      toast.error(msg);
    }
  };

  const declineRequest = async (id) => {
    try {
      await base44.functions.invoke("terminatePartnership", { partnership_id: id });
      refresh();
      toast.success("Permintaan ditolak");
    } catch {
      toast.error("Gagal menolak");
    }
  };

  const disconnect = async () => {
    const active = partnerships.find((p) => p.status === "active" && (p.inviter_id === me?.id || p.invitee_id === me?.id));
    if (!active) return toast.error("Tidak ada pasangan terhubung");
    try {
      await base44.functions.invoke("terminatePartnership", { partnership_id: active.id });
      refresh();
      toast.success("Koneksi pasangan diputus");
    } catch {
      toast.error("Gagal memutuskan koneksi");
    }
  };

  return {
    me,
    users,
    partnerships,
    partners,
    hasPartner,
    sentInvites,
    incomingRequests,
    invite,
    connectByCode,
    resend,
    cancelInvite,
    acceptRequest,
    declineRequest,
    disconnect,
    refresh,
    loading: meQ.isLoading || partnershipsQ.isLoading || usersQ.isLoading,
  };
}