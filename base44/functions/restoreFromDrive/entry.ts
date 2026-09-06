import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { BACKUP_ENTITIES, txFingerprint, assetFingerprint, categoryFingerprint, budgetFingerprint } from "../../shared/backupFormat.ts";

// Pemulihan per-pengguna dari Google Drive: hanya file milik pemanggil
// (nama berisi suffix user id). created_by_id di-strip & dipetakan ulang ke
// user saat ini via user-scoped create. Mode "replace" hanya menghapus data
// milik sendiri (bukan seluruh aplikasi).
const STRIP = ["id", "created_date", "updated_date", "created_by_id"];
const strip = (r) => { const c = { ...r }; STRIP.forEach((k) => delete c[k]); return c; };

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try { me = await base44.auth.me(); } catch {}
    if (!me) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googledrive");

    if (action === "list") {
      const suffix = me.id.slice(-8);
      const q = `name contains 'nafkita-backup-${suffix}' and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,createdTime,size)&pageSize=50`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return Response.json({ error: "drive_list_failed", details: await res.text() }, { status: 502 });
      const data = await res.json();
      return Response.json({ files: data.files || [] });
    }

    if (action === "restore") {
      const fileId = body.file_id;
      const mode = body.mode === "replace" ? "replace" : "merge";
      if (!fileId) return Response.json({ error: "file_id required" }, { status: 400 });

      const dl = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!dl.ok) return Response.json({ error: "drive_download_failed", details: await dl.text() }, { status: 502 });
      const text = await dl.text();
      let backup;
      try { backup = JSON.parse(text); } catch { return Response.json({ error: "invalid_backup_file" }, { status: 400 }); }

      // Validasi: file ini benar-benar milik pemanggil.
      if (backup.user_id && backup.user_id !== me.id) {
        return Response.json({ error: "backup_not_yours" }, { status: 403 });
      }

      const d = backup.data || {};

      // Muat data existing milik user untuk dedup.
      const existing = {};
      for (const e of BACKUP_ENTITIES) {
        const all = await base44.asServiceRole.entities[e.entity].list("-created_date", 5000);
        existing[e.key] = (all || []).filter((r) =>
          e.key === "snapshots" ? r.owner_id === me.id : r.created_by_id === me.id
        );
      }

      // Mode Ganti total: hapus data milik sendiri saja.
      if (mode === "replace") {
        for (const e of BACKUP_ENTITIES) {
          const filter = e.key === "snapshots" ? { owner_id: me.id } : { created_by_id: me.id };
          try { await base44.asServiceRole.entities[e.entity].deleteMany(filter); } catch {}
        }
        for (const e of BACKUP_ENTITIES) existing[e.key] = [];
      }

      // Buat ulang via user-scoped agar created_by_id = me.id (mapping eksplisit).
      // 1) Aset lebih dulu — bangun peta oldId -> newId.
      const assetIdMap = {};
      const existingAssetFps = new Set(existing.assets.map(assetFingerprint));
      const assetsToCreate = [];
      for (const a of (d.assets || [])) {
        const fp = assetFingerprint(a);
        if (mode === "merge" && existingAssetFps.has(fp)) {
          const ex = existing.assets.find((x) => assetFingerprint(x) === fp);
          if (a.id && ex?.id) assetIdMap[a.id] = ex.id;
          continue;
        }
        assetsToCreate.push(a);
      }
      const createdAssets = assetsToCreate.length
        ? await base44.entities.Asset.bulkCreate(assetsToCreate.map(strip))
        : [];
      createdAssets.forEach((na, i) => {
        const oldId = assetsToCreate[i].id;
        if (oldId && na?.id) assetIdMap[oldId] = na.id;
      });

      // 2) Kategori.
      const existingCatFps = new Set(existing.categories.map(categoryFingerprint));
      const catsToCreate = (d.categories || []).filter((c) => !existingCatFps.has(categoryFingerprint(c)));
      if (catsToCreate.length) await base44.entities.Category.bulkCreate(catsToCreate.map(strip));

      // 3) Transaksi.
      const existingTxFps = new Set(existing.transactions.map(txFingerprint));
      const txToCreate = (d.transactions || []).filter((t) => !existingTxFps.has(txFingerprint(t)));
      if (txToCreate.length) await base44.entities.Transaction.bulkCreate(txToCreate.map(strip));

      // 4) Anggaran.
      const existingBudgetFps = new Set(existing.budgets.map(budgetFingerprint));
      const budgetsToCreate = (d.budgets || []).filter((b) => !existingBudgetFps.has(budgetFingerprint(b)));
      if (budgetsToCreate.length) await base44.entities.Budget.bulkCreate(budgetsToCreate.map(strip));

      // 5) Entitas lain (zakat, snapshot, template).
      for (const key of ["zakatPayments", "snapshots", "templates"]) {
        const e = BACKUP_ENTITIES.find((x) => x.key === key);
        const recs = (d[key] || []).map(strip);
        if (recs.length) await base44.entities[e.entity].bulkCreate(recs);
      }

      // 6) Lot investasi — remap asset_id; lewati lot yatim.
      const lotsToCreate = (d.investmentLots || []).map((l) => {
        if (l.asset_id && !assetIdMap[l.asset_id]) return null;
        return { ...l, asset_id: l.asset_id ? assetIdMap[l.asset_id] : l.asset_id };
      }).filter(Boolean).map(strip);
      if (lotsToCreate.length) await base44.entities.InvestmentLot.bulkCreate(lotsToCreate);

      return Response.json({
        status: "success",
        mode,
        created: {
          transactions: txToCreate.length,
          assets: assetsToCreate.length,
          categories: catsToCreate.length,
          budgets: budgetsToCreate.length,
          zakatPayments: (d.zakatPayments || []).length,
          snapshots: (d.snapshots || []).length,
          templates: (d.templates || []).length,
          investmentLots: lotsToCreate.length,
        },
      });
    }

    return Response.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}