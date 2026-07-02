-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover" TEXT NOT NULL DEFAULT '/assets/covers/default-cover.png',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "play_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "author_id" TEXT NOT NULL,
    CONSTRAINT "projects_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT '未命名章节',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "chapters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "flow_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "node_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "position_x" REAL NOT NULL,
    "position_y" REAL NOT NULL,
    "data" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    CONSTRAINT "flow_nodes_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "flow_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "edge_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "label" TEXT,
    "animated" BOOLEAN NOT NULL DEFAULT true,
    "chapter_id" TEXT NOT NULL,
    CONSTRAINT "flow_edges_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "default_sprite" TEXT NOT NULL DEFAULT '/assets/characters/default-avatar.png',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "characters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sprites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT 'default',
    "url" TEXT NOT NULL,
    "character_id" TEXT NOT NULL,
    CONSTRAINT "sprites_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "assets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "author_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "comments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ai_provider_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "base_url" TEXT,
    "model" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "ai_provider_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "flow_nodes_chapter_id_node_id_key" ON "flow_nodes"("chapter_id", "node_id");

-- CreateIndex
CREATE UNIQUE INDEX "flow_edges_chapter_id_edge_id_key" ON "flow_edges"("chapter_id", "edge_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_configs_user_id_provider_key" ON "ai_provider_configs"("user_id", "provider");
