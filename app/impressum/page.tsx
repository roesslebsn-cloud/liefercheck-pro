"use client";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a97ff", marginBottom: 10 }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, color: "#c8ccd4", lineHeight: 1.85 }}>
        {children}
      </div>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "#f59e0b", background: "rgba(245,158,11,0.08)", borderRadius: 4, padding: "1px 6px" }}>
      {children}
    </span>
  );
}

export default function Impressum() {
  return (
    <div style={{ minHeight: "100vh", background: "#08090c", color: "#ededf0", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>

        <a href="/landing" style={{ color: "#8a97ff", fontSize: 13, textDecoration: "none" }}>
          ← LieferCheck
        </a>

        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "28px 0 4px", letterSpacing: "-0.02em" }}>Impressum</h1>
        <p style={{ color: "#8b8f99", fontSize: 14, marginBottom: 32 }}>Angaben gemäß § 5 TMG</p>

        <Section title="Verantwortlicher">
          <p>Silas Rößle</p>
          <p>Forststraße 27/1</p>
          <p>74376 Gemmrigheim</p>
        </Section>

        <Section title="Kontakt">
          <p>Telefon: +49 1577 1015650</p>
          <p>E-Mail: <a href="mailto:liefercheck.pro@gmail.com" style={{ color: "#8a97ff" }}>liefercheck.pro@gmail.com</a></p>
        </Section>

        <Section title="Steuernummer / USt-ID">
          <p style={{ color: "#8b8f99" }}>
            Steuernummer: wird nach Gewerbeanmeldung ergänzt.
          </p>
        </Section>

        <Section title="Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)">
          <p>Silas Rößle, Forststraße 27/1, 74376 Gemmrigheim</p>
        </Section>

        <Section title="Hinweis zur KI-gestützten Datenverarbeitung">
          <p>
            LieferCheck verwendet Künstliche Intelligenz (Anthropic Claude API) zur Analyse von
            Lieferschein-Fotos und Rechnungsdaten. Dabei werden Daten an Server in den USA übermittelt.
            Details dazu finden Sie in unserer{" "}
            <a href="/datenschutz" style={{ color: "#8a97ff" }}>Datenschutzerklärung</a>.
          </p>
        </Section>

        <Section title="Haftung für Inhalte">
          <p>
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach
            den allgemeinen Gesetzen verantwortlich. Nach §§ 8–10 TMG sind wir als Diensteanbieter nicht
            verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach
            Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur
            Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben
            hiervon unberührt.
          </p>
        </Section>

        <Section title="Haftung für Links">
          <p>
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss
            haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte
            der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#5a5e68", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/datenschutz" style={{ color: "#5a5e68", textDecoration: "none" }}>Datenschutz</a>
          <a href="/agb" style={{ color: "#5a5e68", textDecoration: "none" }}>AGB</a>
          <span>LieferCheck · liefercheck.pro</span>
        </div>

      </div>
    </div>
  );
}
