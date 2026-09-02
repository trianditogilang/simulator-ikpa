import { createDbClient } from "@simulator-ikpa/db";
import { importJobs } from "@simulator-ikpa/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { verifyQStashSignature } from "../qstash/handler";

// ponytail: import async handled inline for <10k rows; QStash only recovers stuck jobs & re-validates uploaded
// ceiling = large async queue; upgrade to dedicated worker if throughput matters

function newRequestId(): string {
	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function handleQStashImport(
	dbUrl: string | undefined,
	headers: Headers,
	rawBody: string,
): Promise<{ requestId: string; processed: number; stuckRecovered: number }> {
	if (!verifyQStashSignature(headers, rawBody)) {
		throw Object.assign(new Error("Invalid QStash signature"), { statusCode: 401, code: "INVALID_SIGNATURE" });
	}
	const requestId = headers.get("x-request-id") ?? newRequestId();
	if (!dbUrl) return { requestId, processed: 0, stuckRecovered: 0 };
	const db = createDbClient(dbUrl);
	const now = new Date();
	const stuckThreshold = new Date(now.getTime() - 5 * 60 * 1000);

	// recover stuck committing >5m -> failed
	const stuck = await db.select().from(importJobs).where(and(eq(importJobs.status, "committing"), lt(importJobs.updatedAt, stuckThreshold))).limit(20);
	let stuckRecovered = 0;
	for (const job of stuck) {
		try {
			await db.update(importJobs).set({ status: "failed" as never, updatedAt: now as never, errorReportJson: { ...(job.errorReportJson as object ?? {}), stuckError: "Job stuck >5m auto-failed by QStash" } as never }).where(eq(importJobs.id, job.id));
			stuckRecovered++;
		} catch {
			// safe
		}
	}

	// For future: process uploaded pending (not used now because upload is sync). Keep for completeness.
	const uploaded = await db.select().from(importJobs).where(eq(importJobs.status, "uploaded")).limit(10);
	let processed = 0;
	for (const job of uploaded) {
		try {
			// mark validated empty -> failed (requires re-upload with real content)
			await db.update(importJobs).set({ status: "failed" as never, updatedAt: now as never, errorReportJson: { error: "uploaded without content – re-upload required" } as never }).where(eq(importJobs.id, job.id));
			processed++;
		} catch {
			//
		}
	}

	return { requestId, processed, stuckRecovered };
}
