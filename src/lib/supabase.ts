import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Browser client – uses the public anon key (safe for client-side bundles)
// ---------------------------------------------------------------------------
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ---------------------------------------------------------------------------
// Admin / server-only client – uses the service-role key (bypasses RLS)
// NEVER import this in client components or files that ship to the browser.
// ---------------------------------------------------------------------------
function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "supabaseAdmin must not be used on the client side. " +
        "Import it only from Server Components, Route Handlers, or Server Actions.",
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export const supabaseAdmin = createAdminClient();
