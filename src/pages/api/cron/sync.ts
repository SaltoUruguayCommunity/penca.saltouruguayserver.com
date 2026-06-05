import type { APIRoute } from "astro";
import { runFullSync } from "../../../utils/pencas/sync";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const auth = request.headers.get("authorization");
  const secret = import.meta.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await runFullSync();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
