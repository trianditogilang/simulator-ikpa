import { createFileRoute } from "@tanstack/react-router";
import { handleQStashImport } from "@/server/import/process-job";

export const Route = createFileRoute("/api/jobs/import/process")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const rawBody = await request.text();
				const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
				try {
					const res = await handleQStashImport(dbUrl, request.headers, rawBody);
					return new Response(JSON.stringify(res), {
						status: 200,
						headers: { "content-type": "application/json", "x-request-id": res.requestId },
					});
				} catch (e) {
					const err = e as Error & { statusCode?: number; code?: string };
					const code = err.code ?? "UNKNOWN";
					const status = err.statusCode ?? 500;
					return new Response(JSON.stringify({ code, message: err.message.slice(0, 200) }), {
						status,
						headers: { "content-type": "application/json" },
					});
				}
			},
		},
	},
});
