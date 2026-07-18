"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm outline-none focus:border-accent";
const labelCls = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted";

const reassurances = [
  { title: "Decision within 24 hours", detail: "Screen, diligence, and memo — automated, then reviewed." },
  { title: "Missing data is flagged, not fabricated", detail: "Anything we can't verify is marked as unknown." },
  { title: "Cold-start founders welcome", detail: "No track record required. The work speaks first." },
];

export default function ApplyPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [founderName, setFounderName] = useState("");
  const [links, setLinks] = useState("");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [deckFile, setDeckFile] = useState<File | null>(null);
  const [deckText, setDeckText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    const hasDeck = mode === "file" ? deckFile != null : deckText.trim().length > 0;
    if (!hasDeck) {
      setError(
        mode === "file"
          ? "Attach your pitch deck PDF — or switch to pasting the deck text instead."
          : "Paste your deck text — or switch to uploading a PDF instead.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("company_name", companyName.trim());
      if (founderName.trim()) fd.append("founder_name", founderName.trim());
      if (links.trim()) fd.append("links", links.trim());
      if (mode === "file" && deckFile) fd.append("deck", deckFile);
      if (mode === "text") fd.append("deck_text", deckText.trim());
      const res = await fetch("/api/apply", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      router.push(`/opportunities/${data.id}`);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Apply for $100K</h1>
        <p className="mt-1 text-sm text-muted">
          A deck and your company name is the minimum bar. Everything else is optional — we&apos;ll do the digging.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {reassurances.map((r) => (
          <Card key={r.title} className="p-3">
            <p className="text-xs font-semibold text-foreground">
              <span className="mr-1 text-emerald-600">✓</span>
              {r.title}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{r.detail}</p>
          </Card>
        ))}
      </div>

      <Card>
        <form onSubmit={submit}>
          <div className="mb-4">
            <label htmlFor="company_name" className={labelCls}>
              Company name <span className="text-rose-500">*</span>
            </label>
            <input
              id="company_name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Acme Robotics"
              className={inputCls}
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="founder_name" className={labelCls}>
                Founder name <span className="normal-case text-muted/70">(optional)</span>
              </label>
              <input
                id="founder_name"
                value={founderName}
                onChange={(e) => setFounderName(e.target.value)}
                placeholder="Jane Doe"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="links" className={labelCls}>
                Links <span className="normal-case text-muted/70">(optional)</span>
              </label>
              <input
                id="links"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="site, GitHub, LinkedIn — comma-separated"
                className={inputCls}
              />
            </div>
          </div>

          <div className="mb-4">
            <span className={labelCls}>
              Pitch deck <span className="text-rose-500">*</span>
            </span>
            <div className="mb-3 inline-flex rounded-lg border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setMode("file")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  mode === "file" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setMode("text")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  mode === "text" ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"
                }`}
              >
                Paste deck text instead
              </button>
            </div>

            {mode === "file" ? (
              <div>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setDeckFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3.5 file:py-2 file:text-xs file:font-semibold file:text-accent hover:file:bg-indigo-100"
                />
                {deckFile && (
                  <p className="mt-1.5 text-xs text-muted">
                    Selected: <span className="font-medium text-foreground">{deckFile.name}</span>
                  </p>
                )}
              </div>
            ) : (
              <textarea
                value={deckText}
                onChange={(e) => setDeckText(e.target.value)}
                rows={8}
                placeholder="Paste the text of your deck — problem, product, traction, team, ask. Rough is fine."
                className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
              />
            )}
          </div>

          {error && (
            <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit application"}
          </button>
          <p className="mt-3 text-center text-[11px] leading-snug text-muted">
            You&apos;ll be taken straight to your live analysis — watch the diligence happen in real time.
          </p>
        </form>
      </Card>
    </div>
  );
}
