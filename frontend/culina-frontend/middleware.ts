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
  const pathname = request.nextUrl.pathname;
  const method = request.method.toUpperCase();

  const isApiRoute = pathname.startsWith("/api/");
  const isStaffAuthRoute =
    pathname === "/api/staff-auth" ||
    pathname === "/api/staff-auth/verify" ||
    pathname === "/api/staff-auth/logout" ||
    pathname === "/api/staff-auth/signup";

  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const managerAdminWritePrefixes = [
    "/api/users",
    "/api/staff",
    "/api/refunds",
    "/api/restaurants",
    "/api/restaurant",
    "/api/menus",
    "/api/recipes",
    "/api/ingredients",
    "/api/dishes",
    "/api/inventory/snapshots",
    "/api/inventory/snapshots/export",
  ];

  const managerAdminOrWaiterStaffWritePrefixes = [
    "/api/orders",
    "/api/customers",
    "/api/tables",
    "/api/shifts",
  ];

  if (isApiRoute) {
    if (!isStaffAuthRoute) {
      const token = request.cookies.get("auth-token")?.value;

      if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const payload = await verifyJWT(token);

      if (!payload) {
        const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

      if (isMutatingMethod) {
        const requiresManagerAdmin = managerAdminWritePrefixes.some((prefix) => pathname.startsWith(prefix));
        if (requiresManagerAdmin && payload.role !== "manager" && payload.role !== "admin") {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const requiresOperationalRole = managerAdminOrWaiterStaffWritePrefixes.some((prefix) =>
          pathname.startsWith(prefix)
        );

        if (
          requiresOperationalRole &&
          payload.role !== "staff" &&
          payload.role !== "waiter" &&
          payload.role !== "manager" &&
          payload.role !== "admin"
        ) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    return NextResponse.next();
  }

  const supabaseResponse = await createClient(request);

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
