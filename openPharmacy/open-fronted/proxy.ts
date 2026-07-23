import { NextResponse, type NextRequest } from "next/server"

/**
 * Routing guard based on the presence of the `op_session` flag cookie.
 *
 * This is a UX-layer redirect, NOT a security boundary: the real check is
 * the refresh-token round trip done by `AuthGuard` (the refresh cookie is
 * scoped to `/api/auth`, so it is never visible here), and ultimately the
 * backend validating the JWT on every API call.
 */
const SESSION_COOKIE_NAME = "op_session"
const LOGIN_PATH = "/login"
const DEFAULT_APP_PATH = "/dashboard"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME)

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ""
    return url
  }

  if (pathname === "/") {
    return NextResponse.redirect(
      redirectTo(hasSession ? DEFAULT_APP_PATH : LOGIN_PATH)
    )
  }

  if (pathname === LOGIN_PATH) {
    return hasSession
      ? NextResponse.redirect(redirectTo(DEFAULT_APP_PATH))
      : NextResponse.next()
  }

  if (!hasSession) {
    const url = redirectTo(LOGIN_PATH)
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Page routes only: skip the API proxy (`/api` is forwarded to NestJS),
     * static assets, image optimization, and metadata files.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
}
