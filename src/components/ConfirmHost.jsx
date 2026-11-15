import { useEffect, useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

// Dialog konfirmasi global, pengganti window.confirm() bawaan browser.
// Pemakaian:  if (!(await confirmAction({ title: "Hapus aset?" }))) return;
let open = null;
export function confirmAction(opts) {
  if (!open) return Promise.resolve(window.confirm(opts?.title || "Lanjutkan?"));
  return new Promise((resolve) => open({ ...opts, resolve }));
}

export default function ConfirmHost() {
  const [req, setReq] = useState(null);
  useEffect(() => { open = setReq; return () => { open = null; }; }, []);

  const close = (result) => { req?.resolve(result); setReq(null); };
  const destructive = req?.destructive !== false;

  return (
    <AlertDialog open={!!req} onOpenChange={(o) => { if (!o) close(false); }}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl p-6">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="text-lg">{req?.title}</AlertDialogTitle>
          {req?.description && <AlertDialogDescription className="text-sm leading-relaxed">{req.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 sm:space-x-0">
          <AlertDialogCancel className="flex-1 mt-0 h-11 rounded-xl">{req?.cancelText || "Batal"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={`flex-1 h-11 rounded-xl ${destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
          >
            {req?.confirmText || "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
