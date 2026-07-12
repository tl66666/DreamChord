ALTER TABLE "assets" ADD COLUMN "mime_type" TEXT;
ALTER TABLE "assets" ADD COLUMN "width" INTEGER;
ALTER TABLE "assets" ADD COLUMN "height" INTEGER;
ALTER TABLE "assets" ADD COLUMN "has_alpha" BOOLEAN;
ALTER TABLE "assets" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE "assets" ADD COLUMN "metadata" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE "asset_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "url" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "asset_id" TEXT NOT NULL,
    CONSTRAINT "asset_variants_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "asset_variants_asset_id_status_idx" ON "asset_variants"("asset_id", "status");
