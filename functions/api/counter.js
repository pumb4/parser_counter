// functions/api/counter.js
// Route: /api/counter (GET and POST)

const KV_KEY = "last_reset";

export async function onRequest(context) {
  const { request, env } = context;

  // Helper: default to "now" if nothing set yet
  async function getOrInitLastReset() {
    let stored = await env.COUNTER_KV.get(KV_KEY);
    if (!stored) {
      const now = new Date().toISOString();
      await env.COUNTER_KV.put(KV_KEY, now);
      stored = now;
    }
    return stored;
  }

  if (request.method === "GET") {
    const lastReset = await getOrInitLastReset();

    return new Response(
      JSON.stringify({ lastReset }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  if (request.method === "POST") {
    // --- Admin token check ---
    const adminToken = env.ADMIN_TOKEN;
    if (!adminToken) {
      return new Response("Admin token not configured", { status: 500 });
    }

    const url = new URL(request.url);
    const tokenFromQuery = url.searchParams.get("token");
    const tokenFromHeader = request.headers.get("x-admin-token");
    const providedToken = tokenFromQuery || tokenFromHeader;

    if (!providedToken || providedToken !== adminToken) {
      return new Response("Unauthorized", { status: 401 });
    }
    // --- end token check ---

    const now = new Date().toISOString();
    await env.COUNTER_KV.put(KV_KEY, now);

    return new Response(
      JSON.stringify({ lastReset: now }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  return new Response("Method not allowed", { status: 405 });
}
