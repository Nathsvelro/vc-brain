import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { analyzeOpportunity } from "@/lib/pipeline/run";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const companyName = String(form.get("company_name") ?? "").trim();
  const deckText = String(form.get("deck_text") ?? "").trim();
  const founderName = String(form.get("founder_name") ?? "").trim();
  const links = String(form.get("links") ?? "").trim();
  const deck = form.get("deck");

  if (!companyName) return NextResponse.json({ error: "company_name is required" }, { status: 400 });
  if (!deckText && !(deck instanceof File && deck.size > 0)) {
    return NextResponse.json({ error: "a pitch deck PDF or pasted text is required" }, { status: 400 });
  }

  let deckPath: string | null = null;
  if (deck instanceof File && deck.size > 0) {
    const dir = path.join(process.cwd(), "data", "decks", "uploads");
    fs.mkdirSync(dir, { recursive: true });
    const safe = deck.name.replace(/[^A-Za-z0-9._-]/g, "_");
    deckPath = path.join(dir, `${Date.now()}-${safe}`);
    fs.writeFileSync(deckPath, Buffer.from(await deck.arrayBuffer()));
  }

  const extraText = [
    deckText,
    founderName ? `Founder (from application form): ${founderName}` : "",
    links ? `Links (from application form): ${links}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = db
    .prepare("INSERT INTO opportunities (company_name, source, status, deck_path, deck_text) VALUES (?, 'inbound', 'received', ?, ?)")
    .run(companyName, deckPath, extraText || null);
  const id = Number(res.lastInsertRowid);

  void analyzeOpportunity(id).catch((err) => console.error("analysis failed:", err));
  return NextResponse.json({ id });
}
