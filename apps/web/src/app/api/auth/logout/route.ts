import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("pitwall-session");
  cookieStore.delete("pitwall-session-raw");
  return Response.json({ success: true });
}
