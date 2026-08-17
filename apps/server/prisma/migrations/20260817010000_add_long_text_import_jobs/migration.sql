-- Persisted long-text import jobs and chunk checkpoints.
CREATE TABLE "long_text_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "file_name" TEXT NOT NULL,
    "source_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "chunk_size" INTEGER NOT NULL DEFAULT 12000,
    "total_chunks" INTEGER NOT NULL DEFAULT 0,
    "completed_chunks" INTEGER NOT NULL DEFAULT 0,
    "failed_chunks" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "completed_at" DATETIME,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    CONSTRAINT "long_text_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "long_text_imports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "long_text_import_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "index" INTEGER NOT NULL,
    "chapter_title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "output_text" TEXT,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "import_id" TEXT NOT NULL,
    CONSTRAINT "long_text_import_chunks_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "long_text_imports" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "long_text_import_chunks_import_id_index_key" ON "long_text_import_chunks"("import_id", "index");
CREATE INDEX "long_text_imports_user_id_project_id_created_at_idx" ON "long_text_imports"("user_id", "project_id", "created_at");
CREATE INDEX "long_text_imports_status_updated_at_idx" ON "long_text_imports"("status", "updated_at");
CREATE INDEX "long_text_import_chunks_import_id_status_idx" ON "long_text_import_chunks"("import_id", "status");
