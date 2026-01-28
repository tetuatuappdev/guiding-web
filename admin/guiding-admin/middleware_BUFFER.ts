import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  console.log("[MW] path =", req.nextUrl.pathname);
  console.log("[MW] cookie names =", req.cookies.getAll().map(c => c.name));
  console.log("[MW] has SUPABASE_URL =", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log("[MW] has ANON_KEY =", !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = req.nextUrl.pathname.startsWith("/tours");

  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/tours/:path*"],
};
