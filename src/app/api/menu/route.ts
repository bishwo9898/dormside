import { NextResponse } from "next/server";

import { getMenu, updateMenu } from "@/lib/menuStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getMenu();
  return NextResponse.json({ items });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { items?: unknown };
  if (!Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 }
    );
  }

  const items = await updateMenu(body.items as Array<{ name: string; description: string; price: string }>);
  return NextResponse.json({ items });
}
