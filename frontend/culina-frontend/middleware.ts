import { type NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/middleware";
import { verifyJWT } from "@/utils/jwt";

function copyResponseCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value, {
      ...cookie,
      name: undefined,
      value: undefined,
    });
  });
}

function redirectWithCookies(
  request: NextRequest,
  baseResponse: NextResponse,
  destination: string
) {
  const response = NextResponse.redirect(new URL(destination, request.url));
  copyResponseCookies(baseResponse, response);
  return response;
}

export async function middleware(request: NextRequest) {
  const supabaseResponse = await createClient(request);
  const pathname = request.nextUrl.pathname;

  const isManagerDashboard = pathname.startsWith("/manager-dash");
  const isWaiterDashboard = pathname.startsWith("/waiter-dash");

  if (!isManagerDashboard && !isWaiterDashboard) {
    return supabaseResponse;
  }

  const token = request.cookies.get("auth-token")?.value;

  if (!token) {
    return redirectWithCookies(request, supabaseResponse, "/staff-login");
  }

  const payload = await verifyJWT(token);

  if (!payload) {
    const response = redirectWithCookies(request, supabaseResponse, "/staff-login");
    response.cookies.set({
      name: "auth-token",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
    return response;
  }

  if (isManagerDashboard && payload.role !== "manager" && payload.role !== "admin") {
    return redirectWithCookies(request, supabaseResponse, "/waiter-dash");
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
