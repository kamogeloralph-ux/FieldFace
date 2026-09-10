import { useState } from "react";
import { trpc } from "../lib/trpc";
import SiteFormModal, { type EditingSite } from "./SiteFormModal";

export default function SitesPage() {
  const utils = trpc.useUtils();
  const sites = trpc.sites.list.useQuery();
  const updateSite = trpc.sites.update.useMutation({ onSuccess: () => utils.sites.list.invalidate() });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditingSite | null>(null);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(site: EditingSite) {
    setEditing(site);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-800">Worksites</h1>
        <button className="btn-primary w-auto px-4 py-2.5 text-sm" onClick={openAdd}>
          + Add site
        </button>
      </div>

      <div className="space-y-3">
        {sites.data?.map((site) => (
          <div key={site.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="flex-1 flex items-center gap-4 text-left" onClick={() => openEdit(site)}>
              {site.referencePhotoUrl && (
                <img src={site.referencePhotoUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
              )}
              <div>
                <p className="font-medium text-slate-800">
                  {site.name}
                  {!site.active && <span className="ml-2 text-red-500 font-medium text-xs">Inactive</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {site.radiusMeters}m radius
                </p>
              </div>
            </button>
            <button
              className="text-sm text-slate-500 underline"
              onClick={() => updateSite.mutate({ id: site.id, active: !site.active })}
            >
              {site.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
        {sites.data?.length === 0 && (
          <p className="text-sm text-slate-500">No sites yet. Tap "+ Add site" to create the first one.</p>
        )}
      </div>

      <SiteFormModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
