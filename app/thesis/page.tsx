"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";

interface ThesisConfig {
  fund_name: string;
  sectors: string[];
  stages: string[];
  geographies: string[];
  check_size_usd: { min: number; max: number };
  ownership_target_pct: number;
  risk_appetite: "conservative" | "balanced" | "aggressive";
  notes: string;
}

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted";

function toList(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function ThesisPage() {
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [fundName, setFundName] = useState("");
  const [sectors, setSectors] = useState("");
  const [stages, setStages] = useState("");
  const [geographies, setGeographies] = useState("");
  const [checkMin, setCheckMin] = useState("");
  const [checkMax, setCheckMax] = useState("");
  const [ownership, setOwnership] = useState("");
  const [risk, setRisk] = useState<ThesisConfig["risk_appetite"]>("balanced");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/thesis");
        if (!res.ok) throw new Error(res.statusText);
        const t = (await res.json()) as ThesisConfig;
        if (cancelled) return;
        setFundName(t.fund_name ?? "");
        setSectors((t.sectors ?? []).join(", "));
        setStages((t.stages ?? []).join(", "));
        setGeographies((t.geographies ?? []).join(", "));
        setCheckMin(String(t.check_size_usd?.min ?? ""));
        setCheckMax(String(t.check_size_usd?.max ?? ""));
        setOwnership(String(t.ownership_target_pct ?? ""));
        setRisk(t.risk_appetite ?? "balanced");
        setNotes(t.notes ?? "");
      } catch (err) {
        if (!cancelled) setLoadErr(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveErr(null);
    const body: ThesisConfig = {
      fund_name: fundName.trim(),
      sectors: toList(sectors),
      stages: toList(stages),
      geographies: toList(geographies),
      check_size_usd: { min: Number(checkMin) || 0, max: Number(checkMax) || 0 },
      ownership_target_pct: Number(ownership) || 0,
      risk_appetite: risk,
      notes: notes.trim(),
    };
    try {
      const res = await fetch("/api/thesis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveErr(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Investment Thesis</h1>
        <p className="mt-1 text-sm text-muted">
          Every recommendation, screen, and sourcing play is filtered through this thesis.
        </p>
      </div>

      <div className="mb-6 rounded-lg bg-indigo-50 px-3.5 py-2.5 text-xs leading-snug text-indigo-800">
        Changing the thesis changes what outbound sourcing hunts for — the next sourcing plays will be generated
        against whatever you save here, and new applications are screened against it too.
      </div>

      {loading ? (
        <Card>
          <p className="py-8 text-center text-sm text-muted">Loading thesis…</p>
        </Card>
      ) : (
        <Card>
          {loadErr && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Couldn&apos;t load the saved thesis ({loadErr}) — saving will overwrite with what&apos;s below.
            </p>
          )}
          <form onSubmit={save}>
            <div className="mb-4">
              <label htmlFor="fund_name" className={labelCls}>
                Fund name
              </label>
              <input
                id="fund_name"
                value={fundName}
                onChange={(e) => setFundName(e.target.value)}
                placeholder="e.g. Brainstem Ventures"
                className={inputCls}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="sectors" className={labelCls}>
                Sectors <span className="normal-case text-muted/70">(comma-separated)</span>
              </label>
              <input
                id="sectors"
                value={sectors}
                onChange={(e) => setSectors(e.target.value)}
                placeholder="AI infra, dev tools, fintech"
                className={inputCls}
              />
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="stages" className={labelCls}>
                  Stages <span className="normal-case text-muted/70">(comma-separated)</span>
                </label>
                <input
                  id="stages"
                  value={stages}
                  onChange={(e) => setStages(e.target.value)}
                  placeholder="pre-seed, seed"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="geographies" className={labelCls}>
                  Geographies <span className="normal-case text-muted/70">(comma-separated)</span>
                </label>
                <input
                  id="geographies"
                  value={geographies}
                  onChange={(e) => setGeographies(e.target.value)}
                  placeholder="US, Europe"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="check_min" className={labelCls}>
                  Check size min (USD)
                </label>
                <input
                  id="check_min"
                  type="number"
                  min={0}
                  step={1000}
                  value={checkMin}
                  onChange={(e) => setCheckMin(e.target.value)}
                  placeholder="25000"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="check_max" className={labelCls}>
                  Check size max (USD)
                </label>
                <input
                  id="check_max"
                  type="number"
                  min={0}
                  step={1000}
                  value={checkMax}
                  onChange={(e) => setCheckMax(e.target.value)}
                  placeholder="100000"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ownership" className={labelCls}>
                  Ownership target (%)
                </label>
                <input
                  id="ownership"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={ownership}
                  onChange={(e) => setOwnership(e.target.value)}
                  placeholder="7"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="risk" className={labelCls}>
                  Risk appetite
                </label>
                <select
                  id="risk"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value as ThesisConfig["risk_appetite"])}
                  className={inputCls}
                >
                  <option value="conservative">Conservative</option>
                  <option value="balanced">Balanced</option>
                  <option value="aggressive">Aggressive</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="notes" className={labelCls}>
                Notes
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Anything the brain should weigh — anti-patterns, pet theses, founder archetypes you back."
                className={`${inputCls} resize-y`}
              />
            </div>

            {saveErr && <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveErr}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save thesis"}
              </button>
              {saved && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  ✓ Saved — future screens and sourcing plays now use this thesis
                </span>
              )}
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
