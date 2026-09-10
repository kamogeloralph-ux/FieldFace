import { Link } from "react-router-dom";

const FEATURES = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
    title: "Code + PIN",
    body: "No emails to remember. Every crew member gets a short code and a private PIN.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    ),
    title: "GPS checked",
    body: "Location is compared to the site geofence and the distance is recorded.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
        <circle cx="12" cy="12.5" r="3.5" />
      </svg>
    ),
    title: "Selfie proof",
    body: "A photo at the designated spot is stored with every clock-in and clock-out.",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6Z" />
        <path d="m9.5 12 1.8 1.8L15 10" />
      </svg>
    ),
    title: "Hours & pay",
    body: "Weekday and weekend hours add up on their own, into monthly payslips.",
  },
];

export default function WelcomeScreen() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="max-w-sm mx-auto">
        <div className="flex justify-center mb-8">
          <img src="/fieldface-logo.png" alt="Fieldface" className="h-8 w-auto" />
        </div>

        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Built for the field.</h1>
          <p className="text-slate-500 mt-2">
            Clock in with a selfie at the site, and let the hours, reports and payslips take care of themselves.
          </p>
        </div>

        <div className="space-y-3 mb-10">
          <Link to="/clock-in" className="block rounded-2xl bg-emerald-900 text-white px-5 py-4 active:scale-[0.98] transition">
            <p className="font-semibold">I'm clocking in</p>
            <p className="text-emerald-200 text-sm">Crew · code + PIN</p>
          </Link>
          <Link to="/company/login" className="block rounded-2xl bg-white border border-slate-200 shadow-sm px-5 py-4 active:scale-[0.98] transition">
            <p className="font-semibold text-slate-800">Management Sign in</p>
            <p className="text-slate-500 text-sm">Sites · crew · payslips</p>
          </Link>
        </div>

        <p className="text-center text-xs font-semibold tracking-wide text-slate-400 mb-4">HOW A SHIFT IS RECORDED</p>

        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <p className="font-semibold text-slate-800 text-sm mb-1">{f.title}</p>
              <p className="text-xs text-slate-500 leading-snug">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
