"use client";

import { useState } from "react";

interface LineItem {
  beschreibung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
}

const EMPTY_ITEM: LineItem = { beschreibung: "", menge: "1", einheit: "Monat", einzelpreis: "" };

export default function Rechnungsvorlage() {
  const today = new Date().toLocaleDateString("de-DE");

  const [absender, setAbsender] = useState({
    name: "Silas Rößle",
    strasse: "[STRASSE + NR]",
    plz: "[PLZ]",
    ort: "[ORT]",
    tel: "+49 1577 1015650",
    email: "liefercheck.pro@gmail.com",
    steuernr: "[STEUERNUMMER]",
    iban: "[IBAN]",
    bic: "[BIC]",
    bank: "[BANKNAME]",
  });

  const [empfaenger, setEmpfaenger] = useState({
    name: "",
    strasse: "",
    plz: "",
    ort: "",
  });

  const [meta, setMeta] = useState({
    rechnungsnr: "2026-001",
    datum: today,
    zahlungsziel: "14",
    leistungszeitraum: "",
  });

  const [items, setItems] = useState<LineItem[]>([
    { beschreibung: "LieferCheck – monatliche Nutzungsgebühr", menge: "1", einheit: "Monat", einzelpreis: "" },
  ]);

  const [kleinunternehmer, setKleinunternehmer] = useState(true);

  const updateItem = (i: number, field: keyof LineItem, val: string) => {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  };

  const netto = items.reduce((sum, it) => {
    const p = parseFloat(it.einzelpreis.replace(",", ".")) || 0;
    const m = parseFloat(it.menge.replace(",", ".")) || 0;
    return sum + p * m;
  }, 0);
  const mwst = kleinunternehmer ? 0 : netto * 0.19;
  const brutto = netto + mwst;

  const fmtEur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const faelligAm = () => {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(meta.zahlungsziel || "14", 10));
    return d.toLocaleDateString("de-DE");
  };

  const inputStyle = {
    background: "#0e1015", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6,
    color: "#ededf0", padding: "6px 10px", fontSize: 13, width: "100%", outline: "none",
  };
  const labelStyle = { fontSize: 11, color: "#8b8f99", marginBottom: 4, display: "block" as const };

  return (
    <div style={{ minHeight: "100vh", background: "#08090c", color: "#ededf0", fontFamily: "system-ui,-apple-system,sans-serif" }}>

      {/* ── Bearbeitungsbereich (wird beim Drucken ausgeblendet) ── */}
      <div className="no-print" style={{ maxWidth: 900, margin: "0 auto", padding: "36px 24px 0" }}>
        <a href="/dashboard" style={{ color: "#8a97ff", fontSize: 13, textDecoration: "none" }}>← Dashboard</a>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "20px 0 4px" }}>Rechnungsvorlage</h1>
        <p style={{ color: "#8b8f99", fontSize: 13, marginBottom: 28 }}>
          Felder ausfüllen → Vorschau erscheint automatisch → Drucken / Als PDF speichern
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>

          {/* Absender */}
          <div style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a97ff", marginBottom: 14 }}>Absender (deine Daten)</p>
            <div style={{ display: "grid", gap: 10 }}>
              {(["name","strasse","plz","ort","tel","email","steuernr","iban","bic","bank"] as const).map(f => (
                <div key={f}>
                  <label style={labelStyle}>{f === "steuernr" ? "Steuernummer" : f === "iban" ? "IBAN" : f === "bic" ? "BIC" : f === "bank" ? "Bank" : f.charAt(0).toUpperCase() + f.slice(1)}</label>
                  <input style={inputStyle} value={absender[f]} onChange={e => setAbsender(p => ({ ...p, [f]: e.target.value }))} />
                </div>
              ))}
            </div>
          </div>

          {/* Empfänger + Metadaten */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a97ff", marginBottom: 14 }}>Empfänger (Kunde)</p>
              <div style={{ display: "grid", gap: 10 }}>
                {(["name","strasse","plz","ort"] as const).map(f => (
                  <div key={f}>
                    <label style={labelStyle}>{f.charAt(0).toUpperCase() + f.slice(1)}</label>
                    <input style={inputStyle} value={empfaenger[f]} onChange={e => setEmpfaenger(p => ({ ...p, [f]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a97ff", marginBottom: 14 }}>Rechnungsdetails</p>
              <div style={{ display: "grid", gap: 10 }}>
                <div><label style={labelStyle}>Rechnungsnummer</label><input style={inputStyle} value={meta.rechnungsnr} onChange={e => setMeta(p => ({ ...p, rechnungsnr: e.target.value }))} /></div>
                <div><label style={labelStyle}>Rechnungsdatum</label><input style={inputStyle} value={meta.datum} onChange={e => setMeta(p => ({ ...p, datum: e.target.value }))} /></div>
                <div><label style={labelStyle}>Zahlungsziel (Tage)</label><input style={inputStyle} value={meta.zahlungsziel} onChange={e => setMeta(p => ({ ...p, zahlungsziel: e.target.value }))} /></div>
                <div><label style={labelStyle}>Leistungszeitraum (optional)</label><input style={inputStyle} value={meta.leistungszeitraum} onChange={e => setMeta(p => ({ ...p, leistungszeitraum: e.target.value }))} placeholder="z. B. Juni 2026" /></div>
              </div>
            </div>

            <div style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#c8ccd4" }}>
                <input type="checkbox" checked={kleinunternehmer} onChange={e => setKleinunternehmer(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#5b6cff" }} />
                Kleinunternehmerregelung (§ 19 UStG) – keine MwSt
              </label>
              <p style={{ fontSize: 12, color: "#8b8f99", marginTop: 6, marginLeft: 26 }}>
                Empfohlen für den Einstieg (unter 22.000 €/Jahr Umsatz)
              </p>
            </div>
          </div>
        </div>

        {/* Positionen */}
        <div style={{ background: "#0e1015", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a97ff", marginBottom: 14 }}>Positionen</p>
          {items.map((it, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1.2fr auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input style={inputStyle} placeholder="Beschreibung" value={it.beschreibung} onChange={e => updateItem(i, "beschreibung", e.target.value)} />
              <input style={inputStyle} placeholder="Menge" value={it.menge} onChange={e => updateItem(i, "menge", e.target.value)} />
              <input style={inputStyle} placeholder="Einheit" value={it.einheit} onChange={e => updateItem(i, "einheit", e.target.value)} />
              <input style={inputStyle} placeholder="Preis (€)" value={it.einzelpreis} onChange={e => updateItem(i, "einzelpreis", e.target.value)} />
              <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, color: "#ef4444", padding: "6px 10px", cursor: "pointer", fontSize: 13 }}>
                ✕
              </button>
            </div>
          ))}
          <button onClick={() => setItems(p => [...p, { ...EMPTY_ITEM }])}
            style={{ marginTop: 8, background: "rgba(91,108,255,0.12)", border: "1px solid rgba(91,108,255,0.25)", borderRadius: 8, color: "#8a97ff", padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>
            + Position hinzufügen
          </button>
        </div>

        <button onClick={() => window.print()}
          style={{ background: "#5b6cff", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 40 }}>
          Drucken / Als PDF speichern
        </button>
      </div>

      {/* ── Druckvorschau / Rechnung ── */}
      <div id="rechnung-print" style={{ maxWidth: 780, margin: "0 auto", padding: "48px 52px", background: "#fff", color: "#1a1a1a", fontFamily: "Arial,Helvetica,sans-serif" }}>

        {/* Kopf */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40, paddingBottom: 20, borderBottom: "2px solid #5b6cff" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#5b6cff" }}>LieferCheck</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>liefercheck.pro</div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "#444", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 700, color: "#1a1a1a" }}>{absender.name}</div>
            <div>{absender.strasse}</div>
            <div>{absender.plz} {absender.ort}</div>
            <div>{absender.tel}</div>
            <div>{absender.email}</div>
          </div>
        </div>

        {/* Empfänger + Metadaten */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 36 }}>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.8 }}>
            <div style={{ fontSize: 10, color: "#888", marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Rechnung an</div>
            <div style={{ fontWeight: 700, color: "#1a1a1a" }}>{empfaenger.name || "[Kundenname]"}</div>
            <div>{empfaenger.strasse}</div>
            <div>{empfaenger.plz} {empfaenger.ort}</div>
          </div>
          <div style={{ fontSize: 13, color: "#444", lineHeight: 1.8, textAlign: "right" as const }}>
            <div><strong>Rechnungsnummer:</strong> {meta.rechnungsnr}</div>
            <div><strong>Datum:</strong> {meta.datum}</div>
            <div><strong>Fällig bis:</strong> {faelligAm()}</div>
            {meta.leistungszeitraum && <div><strong>Leistungszeitraum:</strong> {meta.leistungszeitraum}</div>}
          </div>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", marginBottom: 20 }}>Rechnung Nr. {meta.rechnungsnr}</h2>

        {/* Positionen */}
        <table style={{ width: "100%", borderCollapse: "collapse" as const, marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#f5f5f7", borderBottom: "2px solid #e0e0e0" }}>
              <th style={{ textAlign: "left" as const, padding: "10px 12px", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#888", fontWeight: 600 }}>Beschreibung</th>
              <th style={{ textAlign: "right" as const, padding: "10px 12px", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#888", fontWeight: 600 }}>Menge</th>
              <th style={{ textAlign: "right" as const, padding: "10px 12px", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#888", fontWeight: 600 }}>Einzelpreis</th>
              <th style={{ textAlign: "right" as const, padding: "10px 12px", fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#888", fontWeight: 600 }}>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => {
              const p = parseFloat(it.einzelpreis.replace(",", ".")) || 0;
              const m = parseFloat(it.menge.replace(",", ".")) || 0;
              return (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "11px 12px", fontSize: 13, color: "#1a1a1a" }}>
                    {it.beschreibung || "–"}
                  </td>
                  <td style={{ padding: "11px 12px", fontSize: 13, color: "#555", textAlign: "right" as const }}>
                    {it.menge} {it.einheit}
                  </td>
                  <td style={{ padding: "11px 12px", fontSize: 13, color: "#555", textAlign: "right" as const }}>
                    {p > 0 ? fmtEur(p) : "–"}
                  </td>
                  <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 600, color: "#1a1a1a", textAlign: "right" as const }}>
                    {p > 0 ? fmtEur(p * m) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summen */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ minWidth: 260, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#555" }}>
              <span>Nettobetrag</span><span>{fmtEur(netto)}</span>
            </div>
            {kleinunternehmer ? (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#888", fontSize: 12 }}>
                <span>MwSt (§ 19 UStG)</span><span>entfällt</span>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", color: "#555" }}>
                <span>MwSt 19 %</span><span>{fmtEur(mwst)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "2px solid #5b6cff", marginTop: 4, fontWeight: 800, fontSize: 16, color: "#1a1a1a" }}>
              <span>Rechnungsbetrag</span><span style={{ color: "#5b6cff" }}>{fmtEur(brutto)}</span>
            </div>
          </div>
        </div>

        {/* Kleinunternehmer-Hinweis */}
        {kleinunternehmer && (
          <p style={{ fontSize: 12, color: "#888", marginTop: 20, lineHeight: 1.6 }}>
            Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet.
          </p>
        )}

        {/* Zahlung */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #eee", fontSize: 13, color: "#444", lineHeight: 1.8 }}>
          <strong style={{ color: "#1a1a1a" }}>Zahlungsinformationen</strong>
          <div style={{ marginTop: 8 }}>
            Bitte überweisen Sie den Rechnungsbetrag bis zum <strong>{faelligAm()}</strong> unter Angabe
            der Rechnungsnummer <strong>{meta.rechnungsnr}</strong> auf folgendes Konto:
          </div>
          <div style={{ marginTop: 10, background: "#f9f9fb", borderRadius: 8, padding: "12px 16px", fontSize: 13 }}>
            <div>{absender.name}</div>
            <div>IBAN: <strong>{absender.iban}</strong></div>
            <div>BIC: {absender.bic} · {absender.bank}</div>
          </div>
        </div>

        {/* Absender Steuernummer */}
        <div style={{ marginTop: 24, fontSize: 12, color: "#aaa" }}>
          Steuernummer: {absender.steuernr}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #f0f0f0", fontSize: 11, color: "#bbb", textAlign: "center" as const }}>
          LieferCheck · Silas Rößle · liefercheck.pro · {absender.email}
        </div>
      </div>

      {/* Print-CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          #rechnung-print {
            margin: 0 !important;
            padding: 30px 40px !important;
            box-shadow: none !important;
            max-width: 100% !important;
          }
          body { background: #fff !important; }
          @page { size: A4; margin: 15mm; }
        }
        @media screen {
          #rechnung-print {
            margin: 24px auto 60px !important;
            border-radius: 16px;
            box-shadow: 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(0,0,0,0.5);
          }
        }
      `}</style>

    </div>
  );
}
