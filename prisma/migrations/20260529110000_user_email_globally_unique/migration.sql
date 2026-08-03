-- Deduplicate active users: keep the row with saved profile assets, then oldest.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM(email))
      ORDER BY
        CASE
          WHEN "avatarUrl" IS NOT NULL
            AND "avatarUrl" <> ''
            AND "avatarUrl" NOT LIKE 'blob:%'
          THEN 0
          ELSE 1
        END,
        "createdAt" ASC
    ) AS rn
  FROM users
),
dupes AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE users u
SET
  "isActive" = false,
  email = 'archived+' || u.id || '@deactivated.local',
  "supabaseId" = 'legacy-' || u.id,
  "updatedAt" = NOW()
FROM dupes d
WHERE u.id = d.id;

-- Store emails in lowercase for consistent uniqueness.
UPDATE users
SET email = LOWER(TRIM(email)), "updatedAt" = NOW()
WHERE email <> LOWER(TRIM(email));

DROP INDEX IF EXISTS "users_tenantId_email_key";

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
