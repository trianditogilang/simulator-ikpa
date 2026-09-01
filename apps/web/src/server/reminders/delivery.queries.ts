import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbClient } from "@simulator-ikpa/db";
import { notificationDeliveries, organizations } from "@simulator-ikpa/db/schema";
import type { AccessResolution } from "@simulator-ikpa/contracts";
import { assertAdminKppnScope } from "@simulator-ikpa/access-control";

export interface DeliveryFilter {
  status?: string;
  orgId?: string;
  page?: number;
  pageSize?: number;
}

export async function listDeliveriesForAdmin(
  db: DbClient,
  access: AccessResolution,
  filter: DeliveryFilter = {},
) {
  const { allowedKppnScopeIds } = assertAdminKppnScope(access);
  // scope to orgs within allowed scopes
  const orgs = await db.select({ id: organizations.id }).from(organizations).where(inArray(organizations.kppnScopeId, allowedKppnScopeIds));
  const orgIds = orgs.map(o => o.id);
  if (orgIds.length === 0) return { items: [], totalItems: 0, page: filter.page ?? 1, pageSize: filter.pageSize ?? 20, totalPages: 0 };

  const whereClauses: unknown[] = [inArray(notificationDeliveries.orgId, orgIds as never)];
  if (filter.status) whereClauses.push(eq(notificationDeliveries.status, filter.status as never));
  if (filter.orgId) {
    if (!orgIds.includes(filter.orgId)) throw new Error("Org di luar scope admin");
    whereClauses.push(eq(notificationDeliveries.orgId, filter.orgId as never));
  }
  const where = whereClauses.length === 1 ? whereClauses[0] as never : and(...(whereClauses as never[])) as never;

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;
  const items = await db.select().from(notificationDeliveries).where(where).limit(pageSize).offset(offset).orderBy(desc(notificationDeliveries.scheduledFor));
  const totalRows = await db.select().from(notificationDeliveries).where(where) as unknown as unknown[];
  return { items, totalItems: totalRows.length, page, pageSize, totalPages: Math.ceil(totalRows.length / pageSize) };
}

export async function getDeliveryForAdmin(
  db: DbClient,
  access: AccessResolution,
  deliveryId: string,
) {
  const { allowedKppnScopeIds } = assertAdminKppnScope(access);
  const [del] = await db.select().from(notificationDeliveries).where(eq(notificationDeliveries.id, deliveryId)).limit(1);
  if (!del) throw new Error("Delivery tidak ditemukan.");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, del.orgId)).limit(1);
  if (!org || !allowedKppnScopeIds.includes(org.kppnScopeId)) throw new Error("Delivery di luar scope admin.");
  return del;
}
