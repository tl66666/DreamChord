PRAGMA foreign_keys=OFF;

CREATE TABLE "new_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mime_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "has_alpha" BOOLEAN,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "owner_id" TEXT NOT NULL,
    "project_id" TEXT,
    CONSTRAINT "assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_assets" (
    "id", "name", "type", "url", "created_at", "mime_type", "width", "height", "has_alpha", "status", "metadata", "owner_id", "project_id"
)
SELECT
    a."id", a."name", a."type", a."url", a."created_at", a."mime_type", a."width", a."height", a."has_alpha", a."status", a."metadata", p."author_id", a."project_id"
FROM "assets" a
JOIN "projects" p ON p."id" = a."project_id";

DROP TABLE "assets";
ALTER TABLE "new_assets" RENAME TO "assets";

CREATE INDEX "assets_owner_id_created_at_idx" ON "assets"("owner_id", "created_at");
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

PRAGMA foreign_keys=ON;
