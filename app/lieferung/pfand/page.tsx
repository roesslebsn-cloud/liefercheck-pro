"use client";

import { useState } from "react";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { saveLieferung } from "../../../lib/database";

interface PfandArtikel {
  id: string;
  name: string;
  menge: number;
}

const vordefinierteArtikel: PfandArtikel[] = [
  { id: "fass30l", name: "Bierfass 30L", menge: 0 },
  { id: "kiste05bier", name: "Kiste 0.5L Bier", menge: 0 },
  { id: "kiste033bier", name: "Kiste 0.33L Bier", menge: 0 },
  { id: "kiste02soft", name: "Kiste 0.2L Softdrink", menge: 0 },
  { id: "kiste075wasser", name: "Kiste 0.75L Wasser", menge: 0 },
  { id: "kiste05wasser", name: "Kiste 0.5L Wasser", menge: 0 },
  { id: "kiste1lsaft", name: "Kiste 1L Saft", menge: 0 },
  { id: "kiste1lpet", name: "Kiste 1L PET Softdrink", menge: 0 },
  { id: "co2", name: "CO2 Flasche", menge: 0 },
  { id: "biogon", name: "Biogon Flasche", menge: 0 },
];

export default function PfandPage() {
  const [artikel, setArtikel] = useState<PfandArtikel[]>(vordefinierteArtikel);
  const [lieferungId, setLieferungId] = useState<string | null>(null);

  const handleMengeAendern = (id: string, delta: number) => {
    setArtikel((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const neueMenge = Math.max(0, a.menge + delta);
          return { ...a, menge: neueMenge };
        }
        return a;
      })
    );
  };

  const handleWeiter = async () => {
    const artikelMitMenge = artikel.filter((a) => a.menge > 0);

    if (artikelMitMenge.length > 0) {
      const lieferung = await saveLieferung({
        pfand_items: {
          artikel: artikelMitMenge.map((a) => ({
            name: a.name,
            marke: "",
            groesse: "",
            menge: a.menge,
            typ: "Kiste",
            stueck_pro_kiste: null,
            unsicher: false,
            hinweis: null,
          })),
          gesamt_kisten: artikelMitMenge.filter((a) =>
            a.name.includes("Kiste")
          ).length,
          gesamt_faesser: artikelMitMenge.filter((a) => a.name.includes("Fass")).length > 0,
          mehrere_bereiche: false,
          analyse_hinweis: "Manuelle Eingabe",
        },
      });
      setLieferungId(lieferung.id);
      localStorage.setItem("lieferungId", lieferung.id);
      localStorage.setItem(
        "pfandItems",
        JSON.stringify({
          artikel: artikelMitMenge.map((a) => ({
            name: a.name,
            marke: "",
            groesse: "",
            menge: a.menge,
            typ: "Kiste",
            stueck_pro_kiste: null,
            unsicher: false,
            hinweis: null,
          })),
          gesamt_kisten: artikelMitMenge.filter((a) =>
            a.name.includes("Kiste")
          ).length,
          gesamt_faesser: artikelMitMenge.filter((a) => a.name.includes("Fass")).length > 0,
          mehrere_bereiche: false,
          analyse_hinweis: "Manuelle Eingabe",
        })
      );
    } else {
      // Keine Artikel mit Menge > 0, trotzdem ID setzen
      const lieferung = await saveLieferung({});
      setLieferungId(lieferung.id);
      localStorage.setItem("lieferungId", lieferung.id);
    }
  };

  const handleUeberspringen = async () => {
    const lieferung = await saveLieferung({});
    setLieferungId(lieferung.id);
    localStorage.setItem("lieferungId", lieferung.id);
  };

  return (
    <AuthGuard>
      <div className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface-elevated">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted ring-1 ring-accent/30">
                <svg
                  className="h-5 w-5 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9.75 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                  />
                </svg>
              </div>
              <span className="text-sm font-semibold text-white">
                LieferCheck Pro
              </span>
            </div>
            <a
              href="/dashboard"
              className="text-sm text-muted transition-colors hover:text-white"
            >
              Abbrechen
            </a>
          </div>
        </header>

        <ProgressBar currentStep={1} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Schritt 1 von 5
          </div>

          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Pfand erfassen
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
            Erfassen Sie alle Pfandartikel manuell. Dieser Schritt ist optional.
          </p>

          <div className="mt-6 rounded-lg bg-accent-muted/20 p-4">
            <p className="flex items-start gap-2 text-sm text-muted">
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
              Dieser Schritt ist optional. Sie können den Pfand auch später eintragen.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {artikel.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition-colors ${
                  item.menge > 0
                    ? "border-accent bg-surface-elevated"
                    : "border-border bg-surface-elevated/50"
                }`}
              >
                <p className="text-sm font-medium text-white">{item.name}</p>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleMengeAendern(item.id, -1)}
                    disabled={item.menge === 0}
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface text-2xl font-semibold text-white transition-colors hover:bg-surface-elevated disabled:opacity-30 disabled:hover:bg-surface sm:h-14 sm:w-14"
                  >
                    −
                  </button>
                  <span className="text-2xl font-semibold text-white sm:text-3xl">
                    {item.menge}
                  </span>
                  <button
                    onClick={() => handleMengeAendern(item.id, 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-2xl font-semibold text-white transition-colors hover:bg-accent-hover sm:h-14 sm:w-14"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <a
              href="/lieferung/lieferschein"
              onClick={handleUeberspringen}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-surface-elevated sm:px-8 sm:py-3"
            >
              Überspringen
            </a>
            <a
              href="/lieferung/lieferschein"
              onClick={handleWeiter}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:px-8 sm:py-3"
            >
              Weiter
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            </a>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
