import type { DbClient } from "@simulator-ikpa/db";
import { auditLogs } from "@simulator-ikpa/db/schema";

const SENSITIVE_KEYS = new Set([
  "password",
  "secret",
  "token",
  "clerkUserId",
  "clerk_user_id",
  "authorization",
  "apiKey",
]);

function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k) || SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = redactValue(v);
      }
    }
    return out;
  }
  return value;
}

export interface WriteAuditParams {
  actorId: string | null;
  actorAccessType?: "operator_satker" | "admin_kppn" | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  orgId?: string | null;
  ruleSetVersion?: string | null;
  policyId?: string | null;
  requestId?: string | null;
}

export async function writeAudit(
  // ponytail: accepts DbClient or transaction object with same insert sig
  db: DbClient | { insert: DbClient["insert"] },
  params: WriteAuditParams,
) {
  const before = params.beforeJson ? redactValue(params.beforeJson) : null;
  const after = params.afterJson ? redactValue(params.afterJson) : null;

  const [row] = await (db as DbClient).insert(auditLogs).values({
    actorId: params.actorId ?? null,
    actorAccessType: params.actorAccessType ?? null,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    action: params.action,
    beforeJson: before as never,
    afterJson: after as never,
    orgId: params.orgId ?? null,
    ruleSetVersion: params.ruleSetVersion ?? null,
    policyId: params.policyId ?? null,
    requestId: params.requestId ?? null,
  }).returning();

  return row;
}
