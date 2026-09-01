import { createFileRoute } from "@tanstack/react-router";
import { handleQStashDaily } from "@/server/qstash/handler";
import { createDbClient } from "@simulator-ikpa/db";

export const Route = createFileRoute("/api/qstash/daily")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
        if (!dbUrl) return new Response(JSON.stringify({ code: "NO_DB" }), { status: 500 });
        const db = createDbClient(dbUrl);
        try {
          const res = await handleQStashDaily(db, request.headers, rawBody);
          return new Response(JSON.stringify(res), { status: 200, headers: { "content-type": "application/json", "x-request-id": res.requestId } });
        } catch (e) {
          const err = e as Error & { statusCode?: number; code?: string };
          const code = err.code ?? "UNKNOWN";
          const status = err.statusCode ?? 500;
          return new Response(JSON.stringify({ code, message: err.message.slice(0, 200) }), { status, headers: { "content-type": "application/json" } });
        }
      },
    },
  },
});
