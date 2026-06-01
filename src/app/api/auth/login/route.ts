import { NextResponse } from "next/server";
import { AUTH_COOKIE, createSessionCookie, verifyPassword } from "@/lib/auth";

export const runtime = "edge";

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!body.password || !verifyPassword(body.password)) {
    return NextResponse.json({ error: "invalid-credentials" }, { status: 401 });
  }
  const token = await createSessionCookie();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
