import LoginForm from "./components/LoginForm";

export default function LoginPage() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-12 overflow-hidden">
      <div className="aurora-bg" />
      <div className="fixed inset-0 grid-bg pointer-events-none" style={{ maskImage: "radial-gradient(ellipse at center, #000 0%, transparent 60%)" }} />

      <div className="relative w-full max-w-[400px] reveal">

        {/* Logo + Hero-Kopf */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative mb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl animate-float"
              style={{
                background: "linear-gradient(135deg, var(--accent) 0%, #7c3aed 100%)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.07) inset, 0 12px 40px rgba(91,108,255,0.35), 0 0 80px rgba(91,108,255,0.15)",
              }}>
              <svg className="h-7 w-7 text-white relative z-10" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            {/* Subtle ring glow */}
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ boxShadow: "0 0 0 8px rgba(91,108,255,0.06)" }} />
          </div>

          <h1 className="text-[26px] font-semibold tracking-tight gradient-text">LieferCheck Pro</h1>
          <p className="mt-2 text-[13px] text-center max-w-[280px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            KI-gestützte Lieferprüfung — erkenne Überzahlungen, bevor sie zu Gewinnverlust werden.
          </p>

          {/* Social Proof Chips */}
          <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
            {[
              { icon: "✓", text: "GoBD-konform" },
              { icon: "⚡", text: "Ergebnis in 5 Min" },
            ].map(chip => (
              <span key={chip.text} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <span style={{ color: "var(--green)", fontWeight: 600 }}>{chip.icon}</span>
                {chip.text}
              </span>
            ))}
          </div>
        </div>

        {/* Login-Card */}
        <div className="spotlight-card spotlight-border rounded-2xl p-7 relative"
          style={{
            background: "rgba(19,22,29,0.65)",
            backdropFilter: "blur(28px) saturate(150%)",
            border: "1px solid var(--border-hover)",
            boxShadow: "var(--shadow-lg), var(--shadow-inset)",
          }}>
          <p className="text-[12px] font-medium text-muted mb-4">Mit deinem Account anmelden</p>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
          © {new Date().getFullYear()} LieferCheck Pro · Für die Gastronomie gemacht
        </p>
      </div>
    </div>
  );
}
