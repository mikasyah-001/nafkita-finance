import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Koneksi pasangan berbasis server (entitas Partnership).
// Hanya suami-istri yang saling terhubung melalui undangan email.
// Pasangan aktif = ada record Partnership berstatus "active" yang melibatkan user ini.
const ROLE_LABEL = { suami: "Suami", istri: "Istri" };
const complement = (r) => (r === "suami" ? "istri" : "suami");

export function usePartnership() {
  const qc = useQueryClient();

  const meQ = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });
  const partnershipsQ = useQuery({
    queryKey: ["partnerships"],
    queryFn: () => base44.entities.Partnership.list("-created_date", 500),
  });
  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list("-created_date", 500),
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
  // Status koneksi mengikuti record Partnership, bukan keberhasilan join profil User.
  const hasPartner = myActive.length > 0;

  // Peran suami/istri dari hubungan aktif (inviter memilih perannya sendiri,
  // invitee mendapat peran pelengkap). Bebas berubah per hubungan baru.
  const activePartnership = partnerships.find(
    (p) => p.status === "active" && (p.inviter_id === me?.id || p.invitee_id === me?.id)
  );
  const myRole = activePartnership
    ? (activePartnership.inviter_id === me?.id ? activePartnership.inviter_role : activePartnership.invitee_role)
    : null;
  const partnerRole = activePartnership
    ? (activePartnership.inviter_id === me?.id ? activePartnership.invitee_role : activePartnership.inviter_role)
    : null;

  // Undangan terkirim oleh saya yang masih menunggu
  const sentInvites = partnerships.filter(
    (p) => p.created_by_id === me?.id && p.status === "pending"
  );

  // Permintaan masuk: seseorang mengundang saya, belum saya tanggapi
  const incomingRequests = partnerships.filter(
    (p) => (p.invitee_email || "").toLowerCase() === (me?.email || "").toLowerCase() && p.status === "pending" && p.inviter_id !== me?.id
  );

  const invite = async (email, role) => {
    if (!email) return toast.error("Masukkan email pasangan");
    if (email.toLowerCase() === (me?.email || "").toLowerCase()) return toast.error("Tidak dapat mengundang diri sendiri");
    if (hasPartner) return toast.error("Anda sudah terhubung dengan pasangan");
    if (sentInvites.length > 0 || incomingRequests.length > 0)
      return toast.error("Selesaikan undangan/permintaan yang ada dahulu");
    try {
      const res = await base44.functions.invoke("createPartnershipInvite", { email, inviter_role: role });
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

  const connectByCode = async (code, role) => {
    if (!code) return toast.error("Masukkan kode referensi");
    if (hasPartner) return toast.error("Anda sudah terhubung dengan pasangan");
    if (sentInvites.length > 0 || incomingRequests.length > 0)
      return toast.error("Selesaikan undangan/permintaan yang ada dahulu");
    try {
      const res = await base44.functions.invoke("connectByRefCode", { code, inviter_role: role });
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

  const updateRole = async (role) => {
    if (!hasPartner) return toast.error("Belum ada pasangan terhubung");
    try {
      const res = await base44.functions.invoke("updatePartnershipRole", { role });
      if (res?.data?.error) throw new Error(res.data.error);
      refresh();
      toast.success("Peran diperbarui", { description: `Anda: ${ROLE_LABEL[role]} • Pasangan: ${ROLE_LABEL[complement(role)]}` });
    } catch (e) {
      const msg = e?.message || "Gagal memperbarui peran";
      toast.error(msg.includes("no_active") ? "Tidak ada koneksi aktif" : "Gagal memperbarui peran", { description: msg });
    }
  };

  const disconnect = async (reason) => {
    const active = partnerships.find((p) => p.status === "active" && (p.inviter_id === me?.id || p.invitee_id === me?.id));
    if (!active) return toast.error("Tidak ada pasangan terhubung");
    try {
      await base44.functions.invoke("terminatePartnership", { partnership_id: active.id, end_reason: reason || "" });
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
    myRole,
    partnerRole,
    sentInvites,
    incomingRequests,
    invite,
    connectByCode,
    resend,
    cancelInvite,
    acceptRequest,
    declineRequest,
    updateRole,
    disconnect,
    refresh,
    loading: meQ.isLoading || partnershipsQ.isLoading || usersQ.isLoading,
  };
}