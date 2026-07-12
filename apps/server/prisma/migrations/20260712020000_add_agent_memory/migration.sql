CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "importance" INTEGER NOT NULL DEFAULT 50,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "source_type" TEXT NOT NULL DEFAULT 'assistant',
    "source_id" TEXT,
    "forgotten_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "superseded_by_id" TEXT,
    CONSTRAINT "agent_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_memories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_memories_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "agent_memories_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "agent_memories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "agent_memories_user_id_project_id_status_idx" ON "agent_memories"("user_id", "project_id", "status");
CREATE INDEX "agent_memories_conversation_id_status_idx" ON "agent_memories"("conversation_id", "status");
