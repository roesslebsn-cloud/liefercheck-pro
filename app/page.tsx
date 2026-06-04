import LoginForm from "./components/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 overflow-hidden">
      {/* Aurora background — animated mesh */}
      <div className="aurora-bg" />
      <div className="fixed inset-0 grid-bg pointer-events-none" style={{ maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 60%)" }} />

      <div className="relative w-full max-w-[400px] reveal">
        {/* Logo with gradient */}
        <div className="mb-10 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl mb-5 relative animate-float"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 8px 32px rgba(91,108,255,0.3), 0 0 64px rgba(91,108,255,0.15)",
            }}>
            <svg className="h-6 w-6 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight gradient-text">LieferCheck</h1>
          <p className="mt-1.5 text-[13px] text-muted">Anmelden, um fortzufahren</p>
        </div>

        {/* Card with subtle border glow */}
        <div className="spotlight-card spotlight-border rounded-2xl p-7 relative"
          style={{
            background: "rgba(19,22,29,0.6)",
            backdropFilter: "blur(24px) saturate(140%)",
            border: "1px solid var(--border-hover)",
            boxShadow: "var(--shadow-lg), var(--shadow-inset)",
          }}>
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          © {new Date().getFullYear()} LieferCheck Pro · Made for Gastronomy
        </p>
      </div>
    </div>
  );
}
