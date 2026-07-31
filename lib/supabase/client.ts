import { createClient, SupabaseClient } from "@supabase/supabase-js";

class DummyWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

if (typeof globalThis.WebSocket === "undefined") {
  (globalThis as any).WebSocket = DummyWebSocket;
}

let clientInstance: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (clientInstance) return clientInstance;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  try {
    clientInstance = createClient(url, key, {
      auth: { persistSession: typeof window !== "undefined" },
      realtime: {
        transport: typeof window !== "undefined" && typeof WebSocket !== "undefined" ? WebSocket : (DummyWebSocket as any),
      },
    });
    return clientInstance;
  } catch (err) {
    console.warn("Failed to create Supabase client:", err);
    return mockSupabase as unknown as SupabaseClient;
  }
}

const mockSupabase = {
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: null, error: new Error("Supabase client unavailable") }),
    }),
  }),
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
