import { NextRequest, NextResponse } from "next/server";
import { simulateApplication } from "@/lib/sourcing/plays";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = simulateApplication(Number(id));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
