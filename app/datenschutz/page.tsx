"use client";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a97ff", marginBottom: 10, marginTop: 36 }}>
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 15, color: "#c8ccd4", lineHeight: 1.85, marginBottom: 12 }}>{children}</p>;
}
function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ fontSize: 15, color: "#c8ccd4", lineHeight: 1.85, marginBottom: 6 }}>{children}</li>;
}

export default function Datenschutz() {
  return (
    <div style={{ minHeight: "100vh", background: "#08090c", color: "#ededf0", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>

        <a href="/landing" style={{ color: "#8a97ff", fontSize: 13, textDecoration: "none" }}>← LieferCheck</a>

        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "28px 0 4px", letterSpacing: "-0.02em" }}>Datenschutzerklärung</h1>
        <p style={{ color: "#8b8f99", fontSize: 14, marginBottom: 8 }}>Gemäß DSGVO (EU) 2016/679 · Stand: Juni 2026</p>

        <H2>1. Verantwortlicher</H2>
        <P>
          Verantwortlicher im Sinne der DSGVO ist:<br />
          <strong style={{ color: "#fff" }}>Silas Rößle</strong><br />
          E-Mail: liefercheck.pro@gmail.com<br />
          Telefon: +49 1577 1015650
        </P>

        <H2>2. Welche Daten wir verarbeiten</H2>
        <P>LieferCheck verarbeitet folgende Kategorien personenbezogener und geschäftsbezogener Daten:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li><strong style={{ color: "#fff" }}>Zugangsdaten:</strong> E-Mail-Adresse, verschlüsseltes Passwort, Vorname, Rolle</Li>
          <Li><strong style={{ color: "#fff" }}>Betriebsdaten:</strong> Name des Betriebs, Standorte, Lieferanten und deren Preislisten</Li>
          <Li><strong style={{ color: "#fff" }}>Lieferdaten:</strong> Fotos von Lieferscheinen, Rechnungs-PDFs, Abgleichdaten (CSV-Dateien)</Li>
          <Li><strong style={{ color: "#fff" }}>Kommunikationsdaten:</strong> E-Mail-Benachrichtigungen (Wochenbericht, Reklamationen), Push-Benachrichtigungen</Li>
          <Li><strong style={{ color: "#fff" }}>Protokolldaten:</strong> GoBD-konformes Audit-Log bei Freigaben, Zeitstempel</Li>
        </ul>

        <H2>3. Rechtsgrundlagen der Verarbeitung</H2>
        <P>Die Verarbeitung erfolgt auf Basis folgender Rechtsgrundlagen:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li>Art. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung (Bereitstellung der Software)</Li>
          <Li>Art. 6 Abs. 1 lit. c DSGVO – Rechtliche Verpflichtung (z. B. GoBD-konforme Archivierung)</Li>
          <Li>Art. 6 Abs. 1 lit. f DSGVO – Berechtigtes Interesse (Sicherheit, Betrugsschutz)</Li>
        </ul>

        <H2>4. Hosting – Vercel</H2>
        <P>
          Die Anwendung wird über <strong style={{ color: "#fff" }}>Vercel Inc.</strong> (USA) gehostet. Vercel
          ist dem EU-US Data Privacy Framework beigetreten. Beim Aufruf der Anwendung werden technisch
          bedingt IP-Adresse und Zugriffszeit an Vercel-Server übermittelt. Details:{" "}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer" style={{ color: "#8a97ff" }}>
            vercel.com/legal/privacy-policy
          </a>
        </P>

        <H2>5. Datenbank & Authentifizierung – Supabase</H2>
        <P>
          Alle Nutzerdaten und Betriebsdaten werden in einer PostgreSQL-Datenbank bei{" "}
          <strong style={{ color: "#fff" }}>Supabase</strong> gespeichert. Supabase betreibt die
          Datenbankinfrastruktur über <strong style={{ color: "#fff" }}>AWS EU-West-1 (Irland)</strong> – die
          Daten verlassen damit nicht die EU. Die Authentifizierung (Login, Sessions) erfolgt ebenfalls über
          Supabase Auth. Datenschutzrichtlinie:{" "}
          <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" style={{ color: "#8a97ff" }}>
            supabase.com/privacy
          </a>
        </P>

        <H2>6. KI-Analyse – Anthropic Claude API</H2>
        <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: "#fca5a5", fontWeight: 600, marginBottom: 6 }}>Wichtiger Hinweis zur KI-Verarbeitung</p>
          <p style={{ fontSize: 14, color: "#c8ccd4", lineHeight: 1.7 }}>
            Zur Analyse von Lieferscheinen, Rechnungen und Abgleichdaten werden Foto- und Textdaten an die
            API von <strong style={{ color: "#fff" }}>Anthropic PBC</strong> (San Francisco, USA) übermittelt.
            Diese Daten können Geschäftsinformationen wie Artikelbezeichnungen, Mengen und Preise enthalten.
            Anthropic verarbeitet diese Daten ausschließlich zur Durchführung der API-Anfrage und speichert
            sie nicht dauerhaft für Trainingszwecke (API-Nutzungsbedingungen). Die Übermittlung in die USA
            erfolgt auf Basis von Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).
          </p>
        </div>
        <P>
          Datenschutzrichtlinie Anthropic:{" "}
          <a href="https://www.anthropic.com/privacy" target="_blank" rel="noreferrer" style={{ color: "#8a97ff" }}>
            anthropic.com/privacy
          </a>
        </P>

        <H2>7. E-Mail-Versand – Resend</H2>
        <P>
          Automatische E-Mails (Wochenberichte, Reklamationsbenachrichtigungen, Teameinladungen) werden über{" "}
          <strong style={{ color: "#fff" }}>Resend Inc.</strong> (USA) versendet. Dabei werden E-Mail-Adresse
          und Nachrichteninhalt an Resend übermittelt. Grundlage: Standardvertragsklauseln (Art. 46 DSGVO).
          Datenschutzrichtlinie:{" "}
          <a href="https://resend.com/privacy" target="_blank" rel="noreferrer" style={{ color: "#8a97ff" }}>
            resend.com/privacy
          </a>
        </P>

        <H2>8. Push-Benachrichtigungen</H2>
        <P>
          Auf Wunsch des Nutzers werden Web-Push-Benachrichtigungen über den Browser-Push-Dienst des
          jeweiligen Betriebssystems (z. B. Google FCM, Apple APNs) versendet. Die Einwilligung kann
          jederzeit im Browser widerrufen werden.
        </P>

        <H2>9. Speicherdauer</H2>
        <P>
          Daten werden gespeichert, solange das Nutzerkonto aktiv ist. Nach Kündigung werden alle
          personenbezogenen Daten innerhalb von 30 Tagen gelöscht, soweit keine gesetzlichen
          Aufbewahrungspflichten (z. B. GoBD: 10 Jahre für Belege) dem entgegenstehen. Audit-Logs
          unterliegen der gesetzlichen Aufbewahrungspflicht.
        </P>

        <H2>10. Ihre Rechte (Art. 12–22 DSGVO)</H2>
        <P>Sie haben folgende Rechte gegenüber uns:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 12 }}>
          <Li><strong style={{ color: "#fff" }}>Auskunft</strong> – Welche Daten wir über Sie gespeichert haben (Art. 15)</Li>
          <Li><strong style={{ color: "#fff" }}>Berichtigung</strong> – Korrektur falscher Daten (Art. 16)</Li>
          <Li><strong style={{ color: "#fff" }}>Löschung</strong> – „Recht auf Vergessenwerden" (Art. 17)</Li>
          <Li><strong style={{ color: "#fff" }}>Einschränkung</strong> – Einschränkung der Verarbeitung (Art. 18)</Li>
          <Li><strong style={{ color: "#fff" }}>Datenübertragbarkeit</strong> – Export Ihrer Daten in maschinenlesbarem Format (Art. 20)</Li>
          <Li><strong style={{ color: "#fff" }}>Widerspruch</strong> – Widerspruch gegen berechtigte Interessen (Art. 21)</Li>
        </ul>
        <P>
          Anfragen richten Sie bitte an:{" "}
          <a href="mailto:liefercheck.pro@gmail.com" style={{ color: "#8a97ff" }}>liefercheck.pro@gmail.com</a>
        </P>
        <P>
          Sie haben zudem das Recht, Beschwerde bei einer Datenschutz-Aufsichtsbehörde einzulegen.
          Zuständig für Baden-Württemberg:{" "}
          <a href="https://www.baden-wuerttemberg.datenschutz.de" target="_blank" rel="noreferrer" style={{ color: "#8a97ff" }}>
            LfDI Baden-Württemberg
          </a>
        </P>

        <H2>11. Datensicherheit</H2>
        <P>
          Die Übertragung zwischen Browser und Server erfolgt ausschließlich über HTTPS (TLS-Verschlüsselung).
          Passwörter werden nur als bcrypt-Hash gespeichert. Zugriffsrechte sind durch Row-Level-Security
          auf Datenbankebene (Supabase RLS) getrennt – kein Nutzer kann Daten anderer Organisationen einsehen.
        </P>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#5a5e68", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/impressum" style={{ color: "#5a5e68", textDecoration: "none" }}>Impressum</a>
          <a href="/agb" style={{ color: "#5a5e68", textDecoration: "none" }}>AGB</a>
          <span>LieferCheck · liefercheck.pro</span>
        </div>

      </div>
    </div>
  );
}
