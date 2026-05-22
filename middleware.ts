import { NextRequest, NextResponse } from "next/server";

function isBasicAuthEnabled(): boolean {
  return !!process.env.APP_BASIC_AUTH_USER && !!process.env.APP_BASIC_AUTH_PASSWORD;
}

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="PastaVISA"',
    },
  });
}

export function middleware(req: NextRequest) {
  if (!isBasicAuthEnabled()) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) return unauthorized();

  const [, encoded] = auth.split(" ");
  let decoded = "";
  try {
    decoded = atob(encoded || "");
  } catch {
    return unauthorized();
  }
  const separator = decoded.indexOf(":");
  const user = separator >= 0 ? decoded.slice(0, separator) : "";
  const password = separator >= 0 ? decoded.slice(separator + 1) : "";

  if (
    user === process.env.APP_BASIC_AUTH_USER &&
    password === process.env.APP_BASIC_AUTH_PASSWORD
  ) {
    return NextResponse.next();
  }

  return unauthorized();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
