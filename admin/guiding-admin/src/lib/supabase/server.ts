import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type CookieKV = { name: string; value: string };

export async function supabaseServer() {
  const cookieStore: any = await cookies(); // Next 15+ -> Promise

  const getAllCookies = (): CookieKV[] => {
    // Next versions differ: sometimes getAll exists, sometimes only get / entries
    if (typeof cookieStore.getAll === "function") {
      return cookieStore.getAll().map((c: any) => ({ name: c.name, value: c.value }));
    }
    // Fallback: try internal iterable of cookies
    if (typeof cookieStore.get === "function") {
      // We can't enumerate keys reliably; but Next typically has getAll in stable.
      // If we reach here, we return empty and rely on middleware for auth redirect.
      return [];
    }
    return [];
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: getAllCookies,
        // NO setAll here (server components must not mutate cookies)
      },
    }
  );
}
