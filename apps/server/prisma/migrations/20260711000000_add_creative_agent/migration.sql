-- DropIndex
DROP INDEX "ai_provider_configs_user_id_provider_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ai_provider_configs";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "story_bibles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "story_bibles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "agent_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" TEXT NOT NULL,
    CONSTRAINT "agent_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "prompt" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "target_id" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT '[]',
    "timeline" TEXT NOT NULL DEFAULT '[]',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "validation" TEXT NOT NULL DEFAULT '{}',
    "error_code" TEXT,
    "error_message" TEXT,
    "usage" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "chapter_id" TEXT,
    "conversation_id" TEXT NOT NULL,
    CONSTRAINT "agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_runs_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "story_patches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "validation" TEXT NOT NULL DEFAULT '{}',
    "diff" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "base_version" INTEGER NOT NULL,
    "applied_version" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "run_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    CONSTRAINT "story_patches_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_patches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "story_patches_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chapter_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nodes" TEXT NOT NULL,
    "edges" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patch_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    CONSTRAINT "chapter_snapshots_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "story_patches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chapter_snapshots_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_chapters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '未命名章节',
    "order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "chapters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_chapters" ("created_at", "id", "order", "project_id", "title", "updated_at") SELECT "created_at", "id", "order", "project_id", "title", "updated_at" FROM "chapters";
DROP TABLE "chapters";
ALTER TABLE "new_chapters" RENAME TO "chapters";
CREATE INDEX "chapters_project_id_idx" ON "chapters"("project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "story_bibles_project_id_key" ON "story_bibles"("project_id");

-- CreateIndex
CREATE INDEX "agent_conversations_user_id_project_id_idx" ON "agent_conversations"("user_id", "project_id");

-- CreateIndex
CREATE INDEX "agent_messages_conversation_id_created_at_idx" ON "agent_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_runs_user_id_project_id_idx" ON "agent_runs"("user_id", "project_id");

-- CreateIndex
CREATE INDEX "agent_runs_status_idx" ON "agent_runs"("status");

-- CreateIndex
CREATE INDEX "agent_runs_conversation_id_created_at_idx" ON "agent_runs"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "story_patches_run_id_key" ON "story_patches"("run_id");

-- CreateIndex
CREATE INDEX "story_patches_project_id_chapter_id_idx" ON "story_patches"("project_id", "chapter_id");

-- CreateIndex
CREATE INDEX "story_patches_status_idx" ON "story_patches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_snapshots_patch_id_key" ON "chapter_snapshots"("patch_id");

-- CreateIndex
CREATE INDEX "chapter_snapshots_chapter_id_idx" ON "chapter_snapshots"("chapter_id");

-- CreateIndex
CREATE INDEX "assets_project_id_idx" ON "assets"("project_id");

-- CreateIndex
CREATE INDEX "characters_project_id_idx" ON "characters"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "characters_project_id_name_key" ON "characters"("project_id", "name");

-- CreateIndex
CREATE INDEX "comments_project_id_idx" ON "comments"("project_id");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "flow_edges_chapter_id_idx" ON "flow_edges"("chapter_id");

-- CreateIndex
CREATE INDEX "flow_nodes_chapter_id_idx" ON "flow_nodes"("chapter_id");

-- CreateIndex
CREATE INDEX "projects_author_id_idx" ON "projects"("author_id");

-- CreateIndex
CREATE INDEX "sprites_character_id_idx" ON "sprites"("character_id");
