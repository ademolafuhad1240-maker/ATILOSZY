WITH "zch" AS (
  SELECT "id"
  FROM "storefronts"
  WHERE "code" = 'ZCH'
)
INSERT INTO "categories" (
  "id",
  "storefrontId",
  "slug",
  "name",
  "description",
  "position",
  "status",
  "createdAt",
  "updatedAt"
)
SELECT
  'zch-category-' || "category"."slug",
  "zch"."id",
  "category"."slug",
  "category"."name",
  "category"."description",
  "category"."position",
  'ACTIVE'::"CategoryStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "zch"
CROSS JOIN (
  VALUES
    ('bras', 'Bras', 'Comfort-focused everyday bras.', 1),
    ('underwear', 'Underwear', 'Comfortable underwear for everyday wear.', 2),
    ('leggings', 'Leggings', 'Flexible leggings for comfort and movement.', 3),
    ('sleepwear', 'Sleepwear', 'Soft sleepwear designed for restful evenings.', 4),
    ('boxers', 'Boxers', 'Comfortable boxer briefs and everyday underwear for men.', 5),
    ('bralettes', 'Bralettes', 'Soft bralettes selected for everyday comfort and support.', 6),
    ('vintage', 'Vintage', 'Distinctive vintage and vintage-inspired clothing.', 7),
    ('round-necks', 'Round Necks', 'Plain round-neck shirts and easy everyday layers.', 8),
    ('womens-essentials', 'Women''s Essentials', 'Practical comfort essentials selected for women.', 9),
    ('mens-essentials', 'Men''s Essentials', 'Boxers, singlets, vintage tops and round-neck essentials.', 10),
    ('loungewear', 'Loungewear', 'Relaxed pieces for comfortable home living.', 11)
) AS "category" ("slug", "name", "description", "position")
ON CONFLICT ("storefrontId", "slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "position" = EXCLUDED."position",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;
