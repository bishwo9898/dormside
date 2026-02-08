import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

const cookieName = "dormside_admin";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 7;

const getSecret = () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Missing ADMIN_SESSION_SECRET. Set a strong random string in your environment.",
    );
  }
  return secret;
};

const sign = (value: string) => {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
};

const encode = (payload: Record<string, unknown>) => {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

const decode = (value: string) => {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf-8")) as {
    u?: string;
    exp?: number;
  };
};

export const createAdminSession = (username: string) => {
  const payload = encode({ u: username, exp: Date.now() + sessionTtlMs });
  const signature = sign(payload);
  return `${payload}.${signature}`;
};

export const verifyAdminSession = (token?: string | null) => {
  if (!token) {
    return false;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }
  const expected = sign(payload);
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }
  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }
  const data = decode(payload);
  if (!data.exp || Date.now() > data.exp) {
    return false;
  }
  return true;
};

export const getAdminCookieName = () => cookieName;

export const validateCredentials = (username: string, password: string) => {
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminUser || !adminPass) {
    throw new Error(
      "Missing ADMIN_USERNAME or ADMIN_PASSWORD in the environment.",
    );
  }
  return username === adminUser && password === adminPass;
};
