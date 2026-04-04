import { cookies } from "next/headers";
import { createHash } from "crypto";

const PASSCODE = process.env.PITWALL_PASSCODE ?? "pitwall";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json();
  const { passcode } = body;

  if (passcode !== PASSCODE) {
    return Response.json({ error: "Invalid passcode" }, { status: 401 });
  }

  // Create a session token
  const token = crypto.randomUUID();
  const cookieStore = await cookies();

  cookieStore.set("pitwall-session", hashToken(token), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  // Store the raw token hash so we can validate later
  // For single-user app, we just check the cookie exists and is valid
  cookieStore.set("pitwall-session-raw", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return Response.json({ success: true });
}
