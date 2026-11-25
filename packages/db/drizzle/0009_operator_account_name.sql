-- Owner decision 2026-11-24: an Operator Satker account is named after its
-- satker. Existing Operator accounts take the name of their organization.
UPDATE "users" SET "name" = o."name", "updated_at" = now()
FROM "user_accesses" ua
JOIN "organizations" o ON o."id" = ua."org_id"
WHERE ua."user_id" = "users"."id"
	AND ua."access_type" = 'operator_satker'
	AND ua."active" = true
	AND "users"."name" IS DISTINCT FROM o."name";
