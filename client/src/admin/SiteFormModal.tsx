import { useEffect, useState } from "react";
import { trpc } from "../lib/trpc";
import { getCurrentPosition } from "../lib/geolocation";

export type EditingSite = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  referencePhotoUrl: string | null;
};

export default function SiteFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: EditingSite | null;
}) {
  const utils = trpc.useUtils();
  const createSite = trpc.sites.create.useMutation({ onSuccess: () => utils.sites.list.invalidate() });
  const updateSite = trpc.sites.update.useMutation({ onSuccess: () => utils.sites.list.invalidate() });

  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", radiusMeters: "150" });
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPhotoBase64(null);
    if (editing) {
      setForm({
        name: editing.name,
        latitude: editing.latitude.toFixed(6),
        longitude: editing.longitude.toFixed(6),
        radiusMeters: String(editing.radiusMeters),
      });
    } else {
      setForm({ name: "", latitude: "", longitude: "", radiusMeters: "150" });
    }
  }, [open, editing]);

  if (!open) return null;

  const isEditing = !!editing;
  const saving = createSite.isPending || updateSite.isPending;

  async function useMyLocation() {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setForm((f) => ({ ...f, latitude: pos.latitude.toFixed(6), longitude: pos.longitude.toFixed(6) }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not get location.");
    } finally {
      setLocating(false);
    }
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (isEditing && editing) {
        await updateSite.mutateAsync({
          id: editing.id,
          name: form.name,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          radiusMeters: Number(form.radiusMeters),
          referencePhotoBase64: photoBase64 ?? undefined,
        });
      } else {
        await createSite.mutateAsync({
          name: form.name,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          radiusMeters: Number(form.radiusMeters),
          referencePhotoBase64: photoBase64 ?? undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save site.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-800">{isEditing ? "Edit site" : "Add a site"}</h2>
        <button type="button" aria-label="Close" className="p-1 text-slate-500" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 space-y-4 pb-24">
        <input
          className="input-field"
          placeholder="Site name (e.g. Main Street Resurfacing)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="input-field"
            placeholder="Latitude"
            value={form.latitude}
            onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
            required
          />
          <input
            className="input-field"
            placeholder="Longitude"
            value={form.longitude}
            onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
            required
          />
        </div>
        <button type="button" className="btn-secondary" onClick={useMyLocation} disabled={locating}>
          {locating ? "Getting location..." : "Use my current location"}
        </button>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Geofence radius (metres)</label>
          <input
            className="input-field"
            type="number"
            value={form.radiusMeters}
            onChange={(e) => setForm((f) => ({ ...f, radiusMeters: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Reference photo of the designated selfie spot
          </label>
          {isEditing && editing?.referencePhotoUrl && !photoBase64 && (
            <img src={editing.referencePhotoUrl} alt="" className="w-20 h-20 rounded-lg object-cover mb-2" />
          )}
          <input type="file" accept="image/*" onChange={handlePhoto} />
          {isEditing && <p className="text-xs text-slate-400 mt-1">Leave blank to keep the current photo.</p>}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
          <div className="max-w-xl mx-auto flex gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Save changes" : "Add site"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
