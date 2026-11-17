import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Check if Supabase is fully configured with valid credentials
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return false;

  // Must start with https:// and not be a placeholder
  if (!url.startsWith("https://")) return false;
  if (url.includes("your_supabase_url")) return false;

  // The Supabase JS client expects the project root URL, e.g.
  // https://<project>.supabase.co — NOT the REST path
  // If the URL ends with /rest/v1/ it's the wrong format
  if (url.includes("/rest/")) return false;

  // Service role key must be a real service_role JWT, not the publishable key
  // Real service role keys start with "eyJ" (base-64 JWT)
  if (key.startsWith("sb_publishable_")) return false;

  return true;
}

// In-memory fallback storage for when Supabase credentials are not yet configured
export const memoryStore = {
  leads: [] as any[],
  chat_messages: [] as any[],
  objection_ledger: [] as any[],
  outbox: [] as any[],
};

// Safe fallback proxy so client code doesn't crash on invalid URLs
function createSafeFallbackClient(): any {
  return {
    from: (table: string) => {
      const records = memoryStore[table as keyof typeof memoryStore] || [];
      return {
        select: (_cols?: string) => ({
          order: (_col?: string, _opts?: any) => ({
            limit: (_n?: number) => Promise.resolve({ data: records, error: null }),
            eq: (col: string, val: any) =>
              Promise.resolve({
                data: records.filter((r) => r[col] === val),
                error: null,
              }),
            then: (resolve: any) => resolve({ data: records, error: null }),
          }),
          eq: (col: string, val: any) => ({
            single: () =>
              Promise.resolve({
                data: records.find((r) => r[col] === val) || null,
                error: null,
              }),
            order: (_c?: string, _o?: any) =>
              Promise.resolve({
                data: records.filter((r) => r[col] === val),
                error: null,
              }),
            then: (resolve: any) =>
              resolve({
                data: records.filter((r) => r[col] === val),
                error: null,
              }),
          }),
          single: () => Promise.resolve({ data: records[0] || null, error: null }),
          then: (resolve: any) => resolve({ data: records, error: null }),
        }),
        insert: (data: any) => {
          const id =
            data.id ||
            `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${Math.floor(Math.random() * 10000)}`;
          const item = {
            id,
            created_at: data.created_at || new Date().toISOString(),
            ...data,
          };
          const existingIdx = records.findIndex((r: any) => r.id === id);
          if (existingIdx !== -1) {
            records[existingIdx] = { ...records[existingIdx], ...item };
          } else {
            records.unshift(item);
          }
          return {
            select: (_col?: string) => ({
              single: () => Promise.resolve({ data: item, error: null }),
              then: (resolve: any) => resolve({ data: item, error: null }),
            }),
            then: (resolve: any) => resolve({ data: item, error: null }),
          };
        },
        update: (updates: any) => ({
          eq: (col: string, val: any) => {
            const index = records.findIndex((r) => r[col] === val);
            if (index !== -1) {
              records[index] = { ...records[index], ...updates };
            }
            return Promise.resolve({ data: records[index] || null, error: null });
          },
          or: (_clause: string) => Promise.resolve({ data: null, error: null }),
        }),
        delete: () => ({
          eq: (col: string, val: any) => {
            const initialLen = records.length;
            const filtered = records.filter((r) => r[col] !== val);
            records.length = 0;
            records.push(...filtered);
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    },
  };
}

function initSupabase(isServiceRole: boolean): SupabaseClient | any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = isServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (isSupabaseConfigured() && url && key) {
    try {
      return createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (err) {
      console.warn(
        `[Supabase] Failed to initialize client (${(err as Error).message}). Using safe local fallback.`,
      );
      return createSafeFallbackClient();
    }
  }

  // Graceful fallback for local development before Supabase project is plugged in
  return createSafeFallbackClient();
}

export const supabase = initSupabase(false);
export const supabaseAdmin = initSupabase(true);
