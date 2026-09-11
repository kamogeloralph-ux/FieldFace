import { trpc } from "../lib/trpc";

export default function EmployerSettingsPage() {
  const employer = trpc.employers.getMine.useQuery();

  if (employer.isLoading) return <p className="text-slate-500">Loading company details...</p>;
  if (!employer.data) return <p className="text-slate-500">Company details are unavailable.</p>;

  const fields = [
    ["Company name", employer.data.name],
    ["Tax number", employer.data.taxNumber],
    ["Registration number", employer.data.companyRegNumber],
    ["Address", employer.data.address],
    ["Contact phone", employer.data.contactPhone],
    ["Contact email", employer.data.contactEmail],
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 mb-2">Company settings</h1>
      <div className="card max-w-lg space-y-4">
        <p className="text-sm text-slate-600">Company details are managed by the FieldFace administrator. Contact admin if anything needs to change.</p>
        <div className="divide-y divide-slate-100">
          {fields.map(([label, value]) => (
            <div key={label} className="py-3 first:pt-0 last:pb-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="text-slate-800 mt-1">{value || "Not provided"}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">UIF settings are also controlled by the administrator.</p>
      </div>
    </div>
  );
}
