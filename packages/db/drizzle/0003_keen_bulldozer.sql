ALTER TABLE "user_accesses" ADD COLUMN "admin_slot" integer;--> statement-breakpoint
UPDATE "organizations" SET "kode_satker" = UPPER(TRIM("kode_satker")) WHERE "kode_satker" IS DISTINCT FROM UPPER(TRIM("kode_satker"));--> statement-breakpoint
DO $$
DECLARE
  dup RECORD;
BEGIN
  FOR dup IN
    SELECT org_id, COUNT(*)::int AS cnt
    FROM user_accesses
    WHERE access_type = 'operator_satker' AND active = true AND org_id IS NOT NULL
    GROUP BY org_id HAVING COUNT(*) > 1
  LOOP
    RAISE NOTICE 'AUTH-01 VIOLATION: org_id % memiliki % operator aktif (harus 1). Data dibiarkan, migration akan gagal pada pembuatan unique index - perbaiki manual.', dup.org_id, dup.cnt;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM organizations GROUP BY kode_satker HAVING COUNT(*) > 1
  ) THEN
    FOR dup IN
      SELECT kode_satker, COUNT(*)::int AS cnt FROM organizations GROUP BY kode_satker HAVING COUNT(*) > 1
    LOOP
      RAISE NOTICE 'AUTH-01 VIOLATION: kode_satker % duplikat % baris setelah normalisasi UPPERCASE. Perbaiki manual.', dup.kode_satker, dup.cnt;
    END LOOP;
  END IF;
END $$;--> statement-breakpoint
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY kppn_scope_id ORDER BY created_at ASC, id ASC) AS rn
  FROM user_accesses
  WHERE access_type = 'admin_kppn' AND active = true AND kppn_scope_id IS NOT NULL
)
UPDATE user_accesses SET admin_slot = ranked.rn FROM ranked WHERE user_accesses.id = ranked.id;--> statement-breakpoint
CREATE UNIQUE INDEX "user_accesses_admin_slot_unique" ON "user_accesses" USING btree ("kppn_scope_id","admin_slot") WHERE "user_accesses"."access_type" = 'admin_kppn' AND "user_accesses"."active" = true AND "user_accesses"."admin_slot" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_accesses_operator_org_unique" ON "user_accesses" USING btree ("org_id") WHERE "user_accesses"."access_type" = 'operator_satker' AND "user_accesses"."active" = true AND "user_accesses"."org_id" IS NOT NULL;