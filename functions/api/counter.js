// functions/api/counter.js

const LAST_RESET_KEY = "last_reset";
const HISTORY_KEY = "reset_history"; // JSON array of ISO timestamps
const HISTORY_LIMIT = 50;

export async function onRequest({ request, env }) {
  try {
    if (!env.COUNTER_KV) {
      return new Response("KV binding COUNTER_KV is not configured.", {
        status: 500,
      });
    }

    if (request.method === "GET") {
      // Ensure last_reset exists
      let lastReset = await env.COUNTER_KV.get(LAST_RESET_KEY);
      if (!lastReset) {
        const now = new Date().toISOString();
        await env.COUNTER_KV.put(LAST_RESET_KEY, now);
        lastReset = now;

        // Initialize history with this first reset
        await env.COUNTER_KV.put(HISTORY_KEY, JSON.stringify([now]));
      }

      // Load history (backwards compatible)
      let historyRaw = await env.COUNTER_KV.get(HISTORY_KEY);
      let history;
      if (!historyRaw) {
        history = [lastReset];
        await env.COUNTER_KV.put(HISTORY_KEY, JSON.stringify(history));
      } else {
        try {
          history = JSON.parse(historyRaw);
          if (!Array.isArray(history)) history = [lastReset];
        } catch {
          history = [lastReset];
        }
      }

      return new Response(
        JSON.stringify({ lastReset, history }),
        { headers: { "Content-Type": "application/json" } }
      );
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
      await env.COUNTER_KV.put(LAST_RESET_KEY, now);

      // Update history
      let historyRaw = await env.COUNTER_KV.get(HISTORY_KEY);
      let history;
      try {
        history = historyRaw ? JSON.parse(historyRaw) : [];
        if (!Array.isArray(history)) history = [];
      } catch {
        history = [];
      }

      history.unshift(now);                 // newest first
      history = history.slice(0, HISTORY_LIMIT);
      await env.COUNTER_KV.put(HISTORY_KEY, JSON.stringify(history));

      return new Response(
        JSON.stringify({ lastReset: now, history }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (err) {
    return new Response(
      "Worker error: " + (err && (err.stack || err.message || String(err))),
      { status: 500 }
    );
  }
}
