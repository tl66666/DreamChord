ALTER TABLE "agent_conversations" ADD COLUMN "chapter_id" TEXT;
ALTER TABLE "agent_conversations" ADD COLUMN "is_pinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "agent_conversations" ADD COLUMN "summary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "agent_conversations" ADD COLUMN "summary_through_message_id" TEXT;
ALTER TABLE "agent_conversations" ADD COLUMN "deleted_at" DATETIME;

CREATE INDEX "agent_conversations_user_id_project_id_deleted_at_idx"
ON "agent_conversations"("user_id", "project_id", "deleted_at");
