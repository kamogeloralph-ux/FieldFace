import { Link } from "react-router-dom";

const sections = [
  ["Purpose and scope", "FieldFace records attendance, supports payroll administration, and handles information submitted by client companies and employees. It does not replace an employer’s legal duties, payroll review, employment policies, privacy notices, or record-retention obligations."],
  ["Information collected", "The service may process employee numbers, names, tax numbers, contact details, PIN credentials, hourly rates, site assignments, clocking times, GPS coordinates, geofence results, selfie photographs, shift hours, payslips, deductions, and administrator audit records."],
  ["Attendance and selfies", "A selfie and location evidence are stored with each clock-in and clock-out. A failed geofence check is recorded for management review. Employees must use their own credentials and clock at the designated worksite."],
  ["Offline operation", "When a device is offline, FieldFace may temporarily store a queued clocking action on that device and synchronize it when connectivity returns. Employees should not repeatedly submit the same action while offline. Employers must review synchronization failures and disputed records."],
  ["Payslips and deductions", "Management users or platform administrators issue payslips. Employees cannot generate their own payslips. Company deductions may apply to all employees or selected employees. The deduction details on an issued payslip are a snapshot and do not change when later settings are edited."],
  ["Employer responsibilities", "The client must provide employees with an appropriate privacy notice, keep records accurate, review flagged attendance, approve payroll, configure lawful deductions, restrict administrator access, and remove access when a person leaves the organization."],
  ["Access and security", "Management users are limited to their company’s operational data. Platform administrators can manage companies across the platform and must use that access only for authorized support and administration. Users must protect passwords, PINs, persistent-login devices, and administrator sessions."],
  ["Retention and requests", "The client determines retention periods subject to employment, tax, payroll, privacy, and evidentiary obligations. Employees should contact their employer about access, correction, attendance, payroll, deduction, or deletion questions."],
];

export default function PolicyPage() {
  return (
    <div className="app-wallpaper min-h-screen px-5 py-8">
      <article className="max-w-2xl mx-auto card space-y-6">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div><img src="/fieldface-logo.png" alt="FieldFace" className="h-8 w-auto mb-4" /><p className="eyebrow mb-2">CLIENT POLICY</p><h1 className="text-2xl font-bold text-slate-900">FieldFace Client Policy</h1><p className="text-sm text-slate-500 mt-2">Effective date: 12 September 2026</p></div>
          <Link to="/" className="text-sm text-slate-500 underline">Back</Link>
        </header>
        <p className="text-sm leading-6 text-slate-700">This policy explains how FieldFace records attendance, supports payroll administration, and handles information submitted by client companies and their employees.</p>
        {sections.map(([title, body]) => <section key={title}><h2 className="font-semibold text-slate-800 mb-1">{title}</h2><p className="text-sm leading-6 text-slate-600">{body}</p></section>)}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><strong>Important:</strong> This is a product policy template, not legal advice. Each client must obtain independent legal, payroll, and privacy advice and adapt the policy before relying on it as an employment or privacy notice.</div>
      </article>
    </div>
  );
}
