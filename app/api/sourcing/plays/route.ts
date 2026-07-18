import { NextResponse } from "next/server";
import { generatePlays } from "@/lib/sourcing/plays";

export async function POST() {
  try {
    const plays = await generatePlays();
    return NextResponse.json(plays);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
