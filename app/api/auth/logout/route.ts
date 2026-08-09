import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function signOut(response: NextResponse) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // A missing or expired session is already logged out from the app's perspective.
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST() {
  return signOut(NextResponse.json({ ok: true }));
}

export async function GET(req: Request) {
  return signOut(NextResponse.redirect(new URL("/login", req.url)));
}
