import { NextResponse } from "next/server";

import {
  createAdminSession,
  getAdminCookieName,
  validateCredentials,
} from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    if (!body.username || !body.password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    if (!validateCredentials(body.username, body.password)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = createAdminSession(body.username);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAdminCookieName(), token, {
      httpOnly: true,
      sameSite: "strict",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
