import { NextResponse } from "next/server";

import { getOrderById } from "@/lib/orderStore";
import {
  buildReceiptHtml,
  buildReceiptPdf,
  getReceiptFilename,
} from "@/lib/receipt";

export const runtime = "nodejs";

type ReceiptRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: ReceiptRouteContext) {
  const { id } = await context.params;
  const order = await getOrderById(id);

  if (!order) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format === "html") {
    return new Response(buildReceiptHtml(order), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${getReceiptFilename(
          order,
          "html",
        )}"`,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  return new Response(buildReceiptPdf(order), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="${getReceiptFilename(
        order,
        "pdf",
      )}"`,
      "Content-Type": "application/pdf",
    },
  });
}
