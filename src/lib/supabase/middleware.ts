import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Wymiana kodu PKCE po powrocie z linku potwierdzającego email.
  // Wymaga to bycia na middleware, aby cookies ustawiły się w tej samej sesji
  // requestu — inaczej kod zostałby zgubiony.
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.delete("code");
      url.searchParams.delete("next");
      url.searchParams.set("error", "email-confirm");
      return NextResponse.redirect(url);
    }

    const url = request.nextUrl.clone();
    url.searchParams.delete("code");
    return NextResponse.redirect(url);
  }

  // Odświeżanie sesji — ważne dla poprawnego działania RLS z auth.uid().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rola admina czytana wyłącznie z JWT (app_metadata), tak samo jak w RPC
  // public.is_admin(). Nigdy z raw_user_meta_data (nieufne).
  const isAdmin = user?.app_metadata?.role === "admin";

  const path = request.nextUrl.pathname;
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");
  const isProtected = path.startsWith("/dashboard") || isAdminArea;
  const isAuthPage = path === "/login" || path === "/register";

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Strefa admina jest zamknięta nawet dla zalogowanych nie-adminów.
  if (isAdminArea && user && !isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin nie ma czego szukać w dashboardzie rodziny.
  if (path.startsWith("/dashboard") && user && isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    const url = request.nextUrl.clone();
    url.pathname = isAdmin ? "/admin" : "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}