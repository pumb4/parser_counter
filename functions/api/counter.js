// functions/api/counter.js

const KV_KEY = "last_reset";

export async function onRequest({ request, env }) {
  try {
    // Check KV binding
    if (!env.COUNTER_KV) {
      return new Response("KV binding COUNTER_KV is not configured.", {
        status: 500,
      });
    }

    if (request.method === "GET") {
      let stored = await env.COUNTER_KV.get(KV_KEY);
      if (!stored) {
        const now = new Date().toISOString();
        await env.COUNTER_KV.put(KV_KEY, now);
        stored = now;
      }

      return new Response(JSON.stringify({ lastReset: stored }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.method === "POST") {
      const adminToken = env.ADMIN_TOKEN;
      if (!adminToken) {
        return new Response("ADMIN_TOKEN env var is not configured.", {
          status: 500,
        });
      }

      const url = new URL(request.url);
      const tokenFromQuery = url.searchParams.get("token");
      const tokenFromHeader = request.headers.get("x-admin-token");
      const providedToken = tokenFromQuery || tokenFromHeader;

      if (!providedToken || providedToken !== adminToken) {
        return new Response("Unauthorized", { status: 401 });
      }

      const now = new Date().toISOString();
      await env.COUNTER_KV.put(KV_KEY, now);

      return new Response(JSON.stringify({ lastReset: now }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return new Response(
      "Worker error: " + (err && (err.stack || err.message || String(err))),
      { status: 500 }
    );
  }
}
