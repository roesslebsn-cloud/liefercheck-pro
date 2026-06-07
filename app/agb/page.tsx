"use client";

function Para({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 10 }}>
        {n} {title}
      </h2>
      <div style={{ fontSize: 15, color: "#c8ccd4", lineHeight: 1.85 }}>{children}</div>
    </div>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p style={{ marginBottom: 8 }}>{children}</p>;
}

export default function AGB() {
  return (
    <div style={{ minHeight: "100vh", background: "#08090c", color: "#ededf0", fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>

        <a href="/landing" style={{ color: "#8a97ff", fontSize: 13, textDecoration: "none" }}>← LieferCheck</a>

        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "28px 0 4px", letterSpacing: "-0.02em" }}>Allgemeine Geschäftsbedingungen</h1>
        <p style={{ color: "#8b8f99", fontSize: 14, marginBottom: 36 }}>LieferCheck (liefercheck.pro) · Stand: Juni 2026</p>

        <Para n="§ 1" title="Geltungsbereich">
          <P>
            (1) Diese Allgemeinen Geschäftsbedingungen (AGB) regeln die Nutzung der cloudbasierten
            Software LieferCheck zwischen Silas Rößle (im Folgenden „Anbieter") und dem jeweiligen
            Unternehmer im Sinne des § 14 BGB (im Folgenden „Nutzer").
          </P>
          <P>
            (2) LieferCheck richtet sich ausschließlich an Unternehmer. Verbraucher im Sinne des § 13 BGB
            sind von der Nutzung ausgeschlossen.
          </P>
          <P>
            (3) Abweichende oder ergänzende Bedingungen des Nutzers gelten nicht, es sei denn, der Anbieter
            stimmt ihrer Geltung ausdrücklich schriftlich zu.
          </P>
        </Para>

        <Para n="§ 2" title="Leistungsbeschreibung">
          <P>
            (1) LieferCheck ist eine KI-gestützte SaaS-Lösung zur automatisierten Prüfung von
            Getränkelieferungen in der Gastronomie. Das System ermöglicht den Abgleich von Lieferscheinen,
            Bestellungen und Rechnungen sowie die Erkennung von Mengenabweichungen, Pfanddifferenzen und
            Preisänderungen.
          </P>
          <P>
            (2) Der Anbieter erbringt die Leistungen als Software-as-a-Service (SaaS). Die Software wird
            über einen Internetbrowser genutzt; eine lokale Installation ist nicht vorgesehen.
          </P>
          <P>
            (3) Die KI-gestützten Auswertungen (Lieferscheinanalyse, Rechnungsprüfung) dienen als
            Entscheidungsunterstützung. Der Nutzer ist verpflichtet, Ergebnisse eigenverantwortlich zu
            prüfen. Die KI-Analyse ersetzt keine eigene Kontrolle.
          </P>
          <P>
            (4) Der Anbieter ist berechtigt, den Leistungsumfang weiterzuentwickeln und anzupassen,
            sofern die Kernfunktionen erhalten bleiben.
          </P>
        </Para>

        <Para n="§ 3" title="Vertragsschluss und Registrierung">
          <P>
            (1) Mit der Registrierung auf liefercheck.pro gibt der Nutzer ein verbindliches Angebot
            auf Abschluss eines Nutzungsvertrags ab.
          </P>
          <P>
            (2) Der Vertrag kommt zustande, wenn der Anbieter den Zugang freischaltet oder die
            Registrierung schriftlich bestätigt.
          </P>
          <P>
            (3) Der Nutzer muss bei der Registrierung vollständige und korrekte Angaben machen.
          </P>
        </Para>

        <Para n="§ 4" title="Nutzungsrecht">
          <P>
            (1) Der Anbieter räumt dem Nutzer für die Vertragslaufzeit ein einfaches, nicht übertragbares
            und nicht unterlizenzierbares Recht zur Nutzung der Software für eigene betriebliche Zwecke ein.
          </P>
          <P>
            (2) Die Weitergabe von Zugangsdaten an Dritte außerhalb der eigenen Organisation ist untersagt.
            Die Einrichtung von Teammitgliedern erfolgt über die integrierten Team-Funktionen.
          </P>
          <P>
            (3) Reverse Engineering, Dekompilierung oder sonstige Versuche, den Quellcode zu extrahieren,
            sind nicht gestattet.
          </P>
        </Para>

        <Para n="§ 5" title="Pflichten des Nutzers">
          <P>
            (1) Der Nutzer ist für die Geheimhaltung seiner Zugangsdaten verantwortlich und hat bei
            unbefugtem Zugriff unverzüglich den Anbieter zu informieren.
          </P>
          <P>
            (2) Der Nutzer stellt sicher, dass nur berechtigte Personen aus seiner Organisation
            Zugang zur Software erhalten.
          </P>
          <P>
            (3) Der Nutzer ist allein für die Richtigkeit der von ihm eingegebenen Daten (Lieferanten,
            Preislisten, Bestellungen) verantwortlich.
          </P>
          <P>
            (4) Der Nutzer verpflichtet sich, die Software nicht für rechtswidrige Zwecke zu nutzen
            und keine schädlichen Inhalte hochzuladen.
          </P>
        </Para>

        <Para n="§ 6" title="Preise und Zahlung">
          <P>
            (1) Die jeweils gültigen Preise ergeben sich aus dem individuellen Angebot des Anbieters
            oder der aktuellen Preisübersicht auf liefercheck.pro.
          </P>
          <P>
            (2) Rechnungen sind innerhalb von 14 Tagen nach Rechnungsstellung zu begleichen.
          </P>
          <P>
            (3) Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Software vorübergehend
            zu sperren, bis der ausstehende Betrag beglichen ist.
          </P>
          <P>
            (4) Alle Preise verstehen sich zzgl. der gesetzlichen Mehrwertsteuer, sofern diese anfällt.
          </P>
        </Para>

        <Para n="§ 7" title="Verfügbarkeit und Wartung">
          <P>
            (1) Der Anbieter strebt eine Verfügbarkeit von 99 % im Jahresmittel an, ausgenommen geplante
            Wartungsfenster, die nach Möglichkeit außerhalb der Kernzeiten (08–20 Uhr) stattfinden.
          </P>
          <P>
            (2) Ein Anspruch auf eine bestimmte Verfügbarkeit besteht nicht, soweit Ausfälle auf höherer
            Gewalt oder Drittanbietern (Supabase, Vercel, Anthropic) beruhen.
          </P>
        </Para>

        <Para n="§ 8" title="Haftung">
          <P>
            (1) Der Anbieter haftet unbeschränkt bei Vorsatz, grober Fahrlässigkeit sowie bei der
            Verletzung von Leben, Körper oder Gesundheit.
          </P>
          <P>
            (2) Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher
            Vertragspflichten und begrenzt auf den vertragstypisch vorhersehbaren Schaden. Eine
            wesentliche Vertragspflicht liegt vor, wenn ihre Erfüllung die ordnungsgemäße Durchführung
            des Vertrags überhaupt erst ermöglicht.
          </P>
          <P>
            (3) Der Anbieter übernimmt keine Haftung für die inhaltliche Richtigkeit KI-generierter
            Auswertungen. Die Ergebnisse der KI-Analyse sind stets eigenverantwortlich zu prüfen.
            Entscheidungen auf Basis der Auswertungen liegen in der alleinigen Verantwortung des Nutzers.
          </P>
          <P>
            (4) Die Haftungsbeschränkungen gelten nicht bei arglistigem Verschweigen eines Mangels
            oder bei ausdrücklicher Übernahme einer Garantie.
          </P>
        </Para>

        <Para n="§ 9" title="Datenschutz und Datensicherheit">
          <P>
            (1) Die Verarbeitung personenbezogener Daten erfolgt gemäß unserer{" "}
            <a href="/datenschutz" style={{ color: "#8a97ff" }}>Datenschutzerklärung</a>.
          </P>
          <P>
            (2) Der Nutzer erteilt dem Anbieter die erforderliche Einwilligung zur Verarbeitung der
            eingegebenen Daten (inkl. Lieferschein-Fotos und Rechnungsdaten) durch Drittanbieter-APIs
            (insbesondere Anthropic Claude API) zum Zweck der Vertragserfüllung.
          </P>
          <P>
            (3) Der Anbieter und der Nutzer schließen erforderlichenfalls einen
            Auftragsverarbeitungsvertrag (AVV) gemäß Art. 28 DSGVO ab.
          </P>
        </Para>

        <Para n="§ 10" title="Laufzeit und Kündigung">
          <P>
            (1) Der Vertrag wird auf unbestimmte Zeit geschlossen und ist von beiden Seiten mit einer
            Frist von 30 Tagen zum Monatsende kündbar.
          </P>
          <P>
            (2) Die Kündigung bedarf der Textform (E-Mail an liefercheck.pro@gmail.com genügt).
          </P>
          <P>
            (3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
            Ein wichtiger Grund liegt für den Anbieter insbesondere vor, wenn der Nutzer gegen § 5
            dieser AGB verstößt.
          </P>
          <P>
            (4) Nach Vertragsende werden alle Daten des Nutzers binnen 30 Tagen gelöscht, soweit
            keine gesetzlichen Aufbewahrungspflichten bestehen.
          </P>
        </Para>

        <Para n="§ 11" title="Änderungen der AGB">
          <P>
            (1) Der Anbieter ist berechtigt, diese AGB mit einer Ankündigungsfrist von 30 Tagen zu ändern.
            Die Ankündigung erfolgt per E-Mail an die hinterlegte Adresse des Nutzers.
          </P>
          <P>
            (2) Widerspricht der Nutzer der Änderung nicht innerhalb von 30 Tagen nach Ankündigung,
            gelten die neuen AGB als angenommen.
          </P>
        </Para>

        <Para n="§ 12" title="Schlussbestimmungen">
          <P>(1) Es gilt das Recht der Bundesrepublik Deutschland.</P>
          <P>
            (2) Gerichtsstand für alle Streitigkeiten ist der Sitz des Anbieters, soweit der Nutzer
            Kaufmann im Sinne des HGB ist oder keinen allgemeinen Gerichtsstand in Deutschland hat.
          </P>
          <P>
            (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die
            Wirksamkeit der übrigen Bestimmungen unberührt. Die unwirksame Bestimmung ist durch eine
            wirksame zu ersetzen, die dem wirtschaftlichen Zweck der unwirksamen möglichst nahekommt.
          </P>
        </Para>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 12, color: "#5a5e68", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <a href="/impressum" style={{ color: "#5a5e68", textDecoration: "none" }}>Impressum</a>
          <a href="/datenschutz" style={{ color: "#5a5e68", textDecoration: "none" }}>Datenschutz</a>
          <span>LieferCheck · liefercheck.pro</span>
        </div>

      </div>
    </div>
  );
}
