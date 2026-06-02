"use client";

import { useState, useEffect } from "react";
import AuthGuard from "../../components/AuthGuard";
import ProgressBar from "../../components/ProgressBar";
import { saveLieferung } from "../../../lib/database";

export default function NeueLieferungPage() {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setSelectedDate(today);
    localStorage.setItem("lieferdatum", today);

    // Check if lieferungId already exists, if not create a new Lieferung
    const existingLieferungId = localStorage.getItem("lieferungId");
    if (!existingLieferungId) {
      createNewLieferung();
    }
  }, []);

  const createNewLieferung = async () => {
    try {
      const result = await saveLieferung({
        pfand_items: undefined,
        lieferschein_data: undefined,
      });
      if (result && result.id) {
        localStorage.setItem("lieferungId", result.id);
      }
    } catch (error) {
      console.error("Fehler beim Erstellen der Lieferung:", error);
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    localStorage.setItem("lieferdatum", date);
    setShowCalendar(false);
  };

  const isLieferTag = (date: Date) => {
    const day = date.getDay();
    return day === 2 || day === 5; // Dienstag (2) oder Freitag (5)
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("de-DE", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const days = getDaysInMonth(currentMonth);

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
              Zurück zum Dashboard
            </a>
          </div>
        </header>

        <ProgressBar currentStep={0} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent-muted/50 px-3 py-1 text-xs font-medium text-accent ring-1 ring-accent/20">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Neue Lieferung
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
            Neue Lieferung starten
          </h1>
          <p className="mt-3 max-w-xl text-muted">
            Folgen Sie den 5 Schritten, um Ihre Lieferung vollständig zu prüfen.
          </p>

          <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6">
            <label className="block text-sm font-medium text-white mb-2">
              Lieferdatum wählen
            </label>
            <div className="relative">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-left text-white hover:border-accent/50 transition-colors"
              >
                {selectedDate ? formatDisplayDate(selectedDate) : "Datum wählen"}
              </button>
              {showCalendar && (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-border bg-surface-elevated p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                        )
                      }
                      className="p-2 text-white hover:bg-surface rounded-lg"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 19.5 8.25 12l7.5-7.5"
                        />
                      </svg>
                    </button>
                    <span className="text-white font-medium">
                      {currentMonth.toLocaleDateString("de-DE", {
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                        )
                      }
                      className="p-2 text-white hover:bg-surface rounded-lg"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m8.25 4.5 7.5 7.5-7.5 7.5"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-sm">
                    {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => (
                      <div key={day} className="text-muted font-medium py-2">
                        {day}
                      </div>
                    ))}
                    {days.map((day, index) => {
                      if (!day) {
                        return <div key={index} className="py-2" />;
                      }
                      const isSelected = formatDate(day) === selectedDate;
                      const isLieferTagDay = isLieferTag(day);
                      return (
                        <button
                          key={index}
                          onClick={() => handleDateSelect(formatDate(day))}
                          className={`py-2 rounded-lg transition-colors ${
                            isSelected
                              ? "bg-accent text-white"
                              : isLieferTagDay
                              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              : "text-white hover:bg-surface"
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <div className="flex items-center gap-1">
                      <div className="h-3 w-3 rounded bg-green-500/20" />
                      <span>Liefertage (Di/Fr)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                step: 1,
                title: "Pfandliste",
                description: "Erfassen Sie alle Pfandartikel",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                    />
                  </svg>
                ),
              },
              {
                step: 2,
                title: "Lieferschein",
                description: "Fotografieren Sie den Lieferschein",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                    />
                  </svg>
                ),
              },
              {
                step: 3,
                title: "Abgleich",
                description: "Laden Sie die Gastronovi CSV hoch",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                    />
                  </svg>
                ),
              },
              {
                step: 4,
                title: "Rechnung",
                description: "Laden Sie die PDF-Rechnung hoch",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"
                    />
                  </svg>
                ),
              },
              {
                step: 5,
                title: "Freigabe",
                description: "Überprüfen und freigeben",
                icon: (
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                ),
              },
            ].map((item) => (
              <a
                key={item.step}
                href={`/lieferung/${["pfand", "lieferschein", "abgleich", "rechnung", "freigabe"][item.step - 1]}`}
                className={`group rounded-xl border p-6 transition-colors ${
                  selectedDate
                    ? "border-border bg-surface-elevated hover:border-accent/50"
                    : "border-border bg-surface-elevated/50 opacity-50 cursor-not-allowed"
                }`}
                onClick={(e) => {
                  if (!selectedDate) e.preventDefault();
                }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-muted/50 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                  {item.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">
                  Schritt {item.step}: {item.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{item.description}</p>
              </a>
            ))}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
