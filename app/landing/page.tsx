"use client";

import { useState } from "react";

const features = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
    ),
    title: "KI-Analyse in Sekunden",
    desc: "Fotografieren Sie den Lieferschein – unsere KI extrahiert automatisch alle Artikel, Mengen und Preise.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
      </svg>
    ),
    title: "Bares Geld sparen",
    desc: "Jede Abweichung zwischen Lieferschein und Rechnung wird erkannt. Kunden sparen im Schnitt 3–8% pro Lieferung.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    title: "E-Rechnung ab 2025 Pflicht",
    desc: "XRechnung und ZUGFeRD-konforme Verarbeitung. Gesetzlich vorgeschrieben für alle B2B-Betriebe in Deutschland.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3.75h3m-6-3.75H6m6 3.75H6" />
      </svg>
    ),
    title: "5-Schritte-Workflow",
    desc: "Pfand → Lieferschein → Abgleich → Rechnung → Freigabe. Strukturiert, vollständig, nachvollziehbar.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
    title: "Analytics & Wochenberichte",
    desc: "Erkennen Sie, welche Lieferanten wiederholt Abweichungen verursachen. Automatische Wochenberichte per E-Mail.",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    title: "Teamverwaltung",
    desc: "Chef- und Mitarbeiter-Rollen. Jede Freigabe wird protokolliert – für volle Transparenz im Team.",
  },
];

const pricing = [
  {
    name: "Starter",
    price: "30€",
    period: "/Monat",
    desc: "Für den Einstieg",
    note: "Kostenloser Ersttermin · Jederzeit kündbar",
    features: [
      "5 Lieferungen/Monat",
      "1 Nutzer · 2 Standorte · 3 Mitarbeiter",
      "KI-Lieferscheinanalyse",
      "PDF-Export",
      "Personalisierte Einrichtung Ihrer Unternehmensstruktur",
    ],
    cta: "Kostenlos testen",
    highlight: false,
  },
  {
    name: "Pro",
    price: "60€",
    period: "/Monat",
    desc: "Für aktive Betriebe",
    note: "14 Tage gratis · Dann 60 €/Monat · Kein Risiko",
    features: [
      "15 Lieferungen/Monat",
      "3 Nutzer · 2 Standorte · 3 Mitarbeiter/Standort",
      "E-Rechnung (XRechnung / ZUGFeRD)",
      "Wochenberichte per E-Mail",
      "Analytics-Dashboard",
      "E-Mail-Rechnungseingang",
      "Personalisierte Einrichtung Ihrer Unternehmensstruktur",
    ],
    cta: "14 Tage kostenlos testen",
    highlight: true,
  },
  {
    name: "Business",
    price: "130€",
    period: "/Monat",
    desc: "Für wachsende Betriebe",
    note: "Persönliche Beratung · Individuelles Onboarding",
    features: [
      "Unbegrenzte Lieferungen",
      "Unbegrenzte Nutzer & Standorte",
      "DATEV-Export",
      "API-Zugang (Anbindung an ERP & Warenwirtschaft)",
      "Audit-Trail (GoBD-konforme Protokollierung aller Freigaben)",
      "Priority-Support",
      "Personalisierte Einrichtung Ihrer Unternehmensstruktur",
    ],
    cta: "Kontakt aufnehmen",
    highlight: false,
  },
];

type FormData = { name: string; firma: string; email: string; telefon: string; nachricht: string };

export default function LandingPage() {
  const [heroEmail, setHeroEmail] = useState("");

  // Modal-State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPaket, setSelectedPaket] = useState("");
  const [form, setForm] = useState<FormData>({ name: "", firma: "", email: "", telefon: "", nachricht: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function openModal(paket: string, prefillEmail = "") {
    setSelectedPaket(paket);
    setForm((f) => ({ ...f, email: prefillEmail || f.email }));
    setSubmitted(false);
    setError("");
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    setModalOpen(false);
    document.body.style.overflow = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setError("Bitte Name und E-Mail ausfüllen.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, paket: selectedPaket }),
      });
      if (!res.ok) throw new Error("Fehler beim Senden.");
      setSubmitted(true);
    } catch {
      setError("Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* ─── KONTAKTFORMULAR-MODAL ──────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1117] shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-white">Jetzt anfragen</h2>
                <p className="mt-0.5 text-sm text-white/50">
                  {selectedPaket ? `Paket: ${selectedPaket} · ` : ""}Wir melden uns innerhalb von 24 Stunden.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="ml-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Inhalt */}
            <div className="px-6 py-6">
              {submitted ? (
                // ── Erfolg ──
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
                    <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">Anfrage eingegangen!</p>
                    <p className="mt-1 text-sm text-white/55">
                      Danke, {form.name.split(" ")[0]}! Silas meldet sich persönlich bei Ihnen – in der Regel innerhalb von 24 Stunden.
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="mt-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                  >
                    Schließen
                  </button>
                </div>
              ) : (
                // ── Formular ──
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/60">Name *</label>
                      <input
                        type="text"
                        placeholder="Max Mustermann"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        className={inputCls}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/60">Betrieb / Firma</label>
                      <input
                        type="text"
                        placeholder="Restaurant Muster GmbH"
                        value={form.firma}
                        onChange={(e) => setForm((f) => ({ ...f, firma: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/60">E-Mail *</label>
                      <input
                        type="email"
                        placeholder="ihre@email.de"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        className={inputCls}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/60">Telefon</label>
                      <input
                        type="tel"
                        placeholder="+49 123 456789"
                        value={form.telefon}
                        onChange={(e) => setForm((f) => ({ ...f, telefon: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/60">Nachricht (optional)</label>
                    <textarea
                      rows={3}
                      placeholder="Kurz beschreiben, was Sie suchen oder welche Fragen Sie haben …"
                      value={form.nachricht}
                      onChange={(e) => setForm((f) => ({ ...f, nachricht: e.target.value }))}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  {error && (
                    <p className="rounded-lg bg-red-500/10 px-4 py-2.5 text-sm text-red-400">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
                  >
                    {submitting ? "Wird gesendet …" : "Anfrage senden"}
                  </button>
                  <p className="text-center text-xs text-white/30">
                    Kein Spam. Keine automatische Registrierung. Silas meldet sich persönlich.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── NAV ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0f]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20 ring-1 ring-blue-500/30">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <span className="text-lg font-bold">LieferCheck Pro</span>
          </div>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-white/60 transition-colors hover:text-white">Features</a>
            <a href="#pricing" className="text-sm text-white/60 transition-colors hover:text-white">Preise</a>
            <a href="#erechnung" className="text-sm text-white/60 transition-colors hover:text-white">E-Rechnung</a>
          </div>
          <a href="/" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500">
            Anmelden
          </a>
        </div>
      </nav>

      {/* ─── HERO ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-blue-600/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            E-Rechnung-Pflicht ab 2025 – jetzt vorbereitet sein
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Lieferungen prüfen.<br />
            <span className="text-blue-400">Kosten sparen.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/60">
            LieferCheck Pro ist die KI-gestützte Komplettlösung für Gastronomie-Betriebe: Lieferscheine analysieren, Rechnungen prüfen, Abweichungen erkennen – alles in unter 5 Minuten.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <button
              onClick={() => openModal("")}
              className="rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-blue-500"
            >
              Kostenlos starten
            </button>
            <a href="#features" className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10">
              Mehr erfahren
            </a>
          </div>
          <p className="mt-4 text-sm text-white/30">Keine Kreditkarte. Keine versteckten Kosten.</p>
        </div>
      </section>

      {/* ─── STATS ──────────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-white/[0.02] px-6 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            { value: "5 Min.", label: "Durchschnittliche Prüfzeit" },
            { value: "3–8%", label: "Durchschnittliche Ersparnis" },
            { value: "100%", label: "DSGVO-konform" },
            { value: "2025", label: "E-Rechnung-Pflicht bereit" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-blue-400">{stat.value}</div>
              <div className="mt-1 text-xs text-white/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ───────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Alles was Ihr Betrieb braucht</h2>
            <p className="mt-4 text-white/60">Von der Foto-Analyse bis zur E-Rechnung – alles in einer App.</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-blue-500/30 hover:bg-white/[0.05]">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  {f.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-white/55">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── E-RECHNUNG ─────────────────────────────────────────────────── */}
      <section id="erechnung" className="px-6 py-24">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-amber-500/20 bg-amber-500/5">
          <div className="px-8 py-12 sm:px-12">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
                <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-amber-300">E-Rechnung: Pflicht ab 2025</h2>
                <p className="mt-3 text-white/70">
                  Seit dem 01.01.2025 müssen alle B2B-Unternehmen in Deutschland elektronische Rechnungen nach XRechnung oder ZUGFeRD empfangen können. Ab 2027 gilt die Pflicht auch für den Versand.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    "XRechnung-Empfang & Verarbeitung",
                    "ZUGFeRD 2.1 Parsing (COMFORT & EN 16931)",
                    "Automatischer Rechnungseingang per E-Mail",
                    "Archivierung nach GoBD",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-white/70">
                      <svg className="h-4 w-4 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRICING ────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Einfache, faire Preise</h2>
            <p className="mt-4 text-white/60">
              Kein Abo ohne Gespräch. Jedes Paket wird persönlich eingerichtet – passend zu Ihrem Betrieb.
            </p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {pricing.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  plan.highlight
                    ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/20"
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
                    Beliebteste Wahl
                  </div>
                )}

                {/* Plan-Name + Preis */}
                <div className="text-sm font-semibold uppercase tracking-widest text-white/40">{plan.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-white/40">{plan.period}</span>
                </div>
                <div className="mt-1 text-[13px] text-white/40">{plan.desc}</div>

                {/* Divider */}
                <div className="my-6 border-t border-white/[0.07]" />

                {/* Features */}
                <ul className="flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-white/70">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => openModal(plan.name)}
                  className={`mt-8 w-full rounded-xl px-6 py-3 text-center text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </button>
                <p className="mt-2.5 text-center text-[11px] text-white/30">{plan.note}</p>
              </div>
            ))}
          </div>

          {/* Unterzeile */}
          <p className="mt-10 text-center text-sm text-white/35">
            Alle Pakete beinhalten eine persönliche Einrichtung Ihrer Lieferanten, Standorte und Unternehmensstruktur.
            Kein Vertrag. Monatlich kündbar.
          </p>
        </div>
      </section>

      {/* ─── CTA / BEREIT LOSZULEGEN ────────────────────────────────────── */}
      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Bereit loszulegen?</h2>
          <p className="mt-4 text-white/60">Tragen Sie Ihre E-Mail ein – Silas meldet sich persönlich bei Ihnen.</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <input
              type="email"
              value={heroEmail}
              onChange={(e) => setHeroEmail(e.target.value)}
              placeholder="ihre@email.de"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none sm:w-72"
            />
            <button
              onClick={() => openModal("", heroEmail)}
              className="w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 sm:w-auto"
            >
              Kostenlos anfragen
            </button>
          </div>
          <p className="mt-3 text-xs text-white/30">Kein Spam. Keine automatische Registrierung.</p>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.06] px-6 py-8 text-center text-sm text-white/30">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} LieferCheck Pro</span>
          <div className="flex gap-6">
            <a href="/datenschutz" className="hover:text-white/60 transition-colors">Datenschutz</a>
            <a href="/impressum" className="hover:text-white/60 transition-colors">Impressum</a>
            <a href="/agb" className="hover:text-white/60 transition-colors">AGB</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
