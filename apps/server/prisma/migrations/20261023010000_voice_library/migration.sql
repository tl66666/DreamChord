-- CreateTable
CREATE TABLE "voice_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "language" TEXT NOT NULL,
  "age_tone" TEXT NOT NULL DEFAULT '',
  "gender_tone" TEXT NOT NULL DEFAULT '',
  "tags" TEXT NOT NULL DEFAULT '[]',
  "provider" TEXT NOT NULL DEFAULT 'gpt-sovits',
  "default_emotion" TEXT NOT NULL DEFAULT '自然',
  "default_speed" REAL NOT NULL DEFAULT 1,
  "authorization_note" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "preview_url" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  "owner_id" TEXT NOT NULL,
  CONSTRAINT "voice_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "voice_references" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "transcript" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "emotion" TEXT NOT NULL DEFAULT '自然',
  "authorization_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "profile_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  CONSTRAINT "voice_references_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "voice_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "voice_references_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "character_voice_bindings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  "project_id" TEXT NOT NULL,
  "character_id" TEXT NOT NULL,
  "profile_id" TEXT NOT NULL,
  CONSTRAINT "character_voice_bindings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "character_voice_bindings_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "character_voice_bindings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "voice_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "voice_generation_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "text" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "emotion" TEXT NOT NULL DEFAULT '自然',
  "speed" REAL NOT NULL DEFAULT 1,
  "seed" INTEGER,
  "node_id" TEXT,
  "output_url" TEXT,
  "output_mime_type" TEXT,
  "error_message" TEXT,
  "provider_metadata" TEXT NOT NULL DEFAULT '{}',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  "completed_at" DATETIME,
  "owner_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "character_id" TEXT NOT NULL,
  "chapter_id" TEXT,
  "profile_id" TEXT NOT NULL,
  "reference_id" TEXT NOT NULL,
  "accepted_asset_id" TEXT,
  CONSTRAINT "voice_generation_jobs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "voice_generation_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "voice_generation_jobs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "voice_generation_jobs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "voice_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "voice_generation_jobs_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "voice_references" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "voice_generation_jobs_accepted_asset_id_fkey" FOREIGN KEY ("accepted_asset_id") REFERENCES "assets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "voice_references_asset_id_key" ON "voice_references"("asset_id");
CREATE UNIQUE INDEX "character_voice_bindings_character_id_key" ON "character_voice_bindings"("character_id");
CREATE INDEX "voice_profiles_owner_id_status_created_at_idx" ON "voice_profiles"("owner_id", "status", "created_at");
CREATE INDEX "voice_references_profile_id_status_idx" ON "voice_references"("profile_id", "status");
CREATE INDEX "character_voice_bindings_project_id_idx" ON "character_voice_bindings"("project_id");
CREATE INDEX "character_voice_bindings_profile_id_idx" ON "character_voice_bindings"("profile_id");
CREATE INDEX "voice_generation_jobs_owner_id_status_created_at_idx" ON "voice_generation_jobs"("owner_id", "status", "created_at");
CREATE INDEX "voice_generation_jobs_project_id_character_id_idx" ON "voice_generation_jobs"("project_id", "character_id");
