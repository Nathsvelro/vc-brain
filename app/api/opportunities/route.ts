import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT o.id, o.company_name, o.one_liner, o.sector, o.geo, o.stage, o.source, o.status,
              o.screen_json, o.recommendation_json, o.source_signal, o.linked_opportunity_id, o.created_at,
              f.id AS founder_id, f.name AS founder_name, f.current_score AS founder_score,
              f.score_low, f.score_high, f.cold_start
       FROM opportunities o LEFT JOIN founders f ON f.id = o.founder_id
       ORDER BY o.id DESC`,
    )
    .all();
  return NextResponse.json({ opportunities: rows });
}
