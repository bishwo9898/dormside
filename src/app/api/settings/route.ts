import { NextResponse } from "next/server";

import { getSettings, updateSettings } from "@/lib/settingsStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { isOpen?: unknown };
  if (typeof body.isOpen !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const settings = await updateSettings({ isOpen: body.isOpen });
  return NextResponse.json(settings);
}
