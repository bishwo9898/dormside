import { NextRequest, NextResponse } from "next/server";

const adminCookieName = "dormside_admin";

const isAdminRoute = (pathname: string) => pathname.startsWith("/admin");
const isAdminLogin = (pathname: string) => pathname === "/admin/login";

const requiresAdminForApi = (pathname: string, method: string) => {
  if (pathname === "/api/menu" && method === "PUT") {
    return true;
  }
  if (pathname === "/api/settings" && method === "PUT") {
    return true;
  }
  if (pathname === "/api/orders" && (method === "GET" || method === "DELETE")) {
    return true;
  }
  return false;
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const decodePayload = (payload: string) => {
  const bytes = decodeBase64Url(payload);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as { u?: string; exp?: number };
};

const verifyAdminSession = async (token?: string | null) => {
  if (!token) {
    return false;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signature),
    new TextEncoder().encode(payload),
  );

  if (!ok) {
    return false;
  }

  const data = decodePayload(payload);
  if (!data.exp || Date.now() > data.exp) {
    return false;
  }

  return true;
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isAdminRoute(pathname) && !isAdminLogin(pathname)) {
    const token = request.cookies.get(adminCookieName)?.value;
    if (!(await verifyAdminSession(token))) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/api") && requiresAdminForApi(pathname, request.method)) {
    const token = request.cookies.get(adminCookieName)?.value;
    if (!(await verifyAdminSession(token))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
