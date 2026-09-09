import { useState } from "react";
import { trpc } from "../lib/trpc";
import { getCurrentPosition } from "../lib/geolocation";

export default function SitesPage() {
  const utils = trpc.useUtils();
  const sites = trpc.sites.list.useQuery();
  const createSite = trpc.sites.create.useMutation({ onSuccess: () => utils.sites.list.invalidate() });
  const updateSite = trpc.sites.update.useMutation({ onSuccess: () => utils.sites.list.invalidate() });

  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", radiusMeters: "150" });
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await createSite.mutateAsync({
      name: form.name,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radiusMeters: Number(form.radiusMeters),
      referencePhotoBase64: photoBase64 ?? undefined,
    });
    setForm({ name: "", latitude: "", longitude: "", radiusMeters: "150" });
    setPhotoBase64(null);
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-5">Worksites</h1>

      <form onSubmit={handleCreate} className="card mb-6 space-y-3">
        <p className="font-semibold text-slate-700">Add a new site</p>
        <input
          className="input-field"
          placeholder="Site name (e.g. Main Street Resurfacing)"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <div className="grid grid-cols-2 gap-3">
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
          <input type="file" accept="image/*" onChange={handlePhoto} />
        </div>
        <button className="btn-primary" type="submit" disabled={createSite.isPending}>
          {createSite.isPending ? "Saving..." : "Add site"}
        </button>
      </form>

      <div className="space-y-3">
        {sites.data?.map((site) => (
          <div key={site.id} className="card flex items-center gap-4">
            {site.referencePhotoUrl && (
              <img src={site.referencePhotoUrl} alt="" className="w-16 h-16 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <p className="font-medium text-slate-800">{site.name}</p>
              <p className="text-xs text-slate-500">
                {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)} · {site.radiusMeters}m radius
              </p>
            </div>
            <button
              className="text-sm text-slate-500 underline"
              onClick={() => updateSite.mutate({ id: site.id, active: !site.active })}
            >
              {site.active ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
