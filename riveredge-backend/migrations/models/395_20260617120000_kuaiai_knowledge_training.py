"""
KU-AI 知识库与训练样本表

Author: Auto
Date: 2026-06-17
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS "apps_kuaiai_knowledge_documents" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "title" VARCHAR(300) NOT NULL,
            "source_type" VARCHAR(20) NOT NULL,
            "raw_content" TEXT,
            "file_uuid" VARCHAR(36),
            "faq_question" TEXT,
            "faq_answer" TEXT,
            "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
            "chunk_count" INT NOT NULL DEFAULT 0,
            "error_message" TEXT,
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_kdoc_tenant_status"
            ON "apps_kuaiai_knowledge_documents" ("tenant_id", "status");
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_kdoc_tenant_source"
            ON "apps_kuaiai_knowledge_documents" ("tenant_id", "source_type");

        CREATE TABLE IF NOT EXISTS "apps_kuaiai_knowledge_chunks" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "document_id" INT NOT NULL,
            "chunk_index" INT NOT NULL,
            "content" TEXT NOT NULL,
            "char_count" INT NOT NULL DEFAULT 0,
            "embedding" JSONB,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_kchunk_tenant_doc"
            ON "apps_kuaiai_knowledge_chunks" ("tenant_id", "document_id");

        CREATE TABLE IF NOT EXISTS "apps_kuaiai_training_samples" (
            "id" SERIAL PRIMARY KEY,
            "uuid" VARCHAR(36) NOT NULL,
            "tenant_id" INT NOT NULL,
            "question" TEXT NOT NULL,
            "answer" TEXT NOT NULL,
            "source" VARCHAR(30) NOT NULL DEFAULT 'manual',
            "is_active" BOOL NOT NULL DEFAULT TRUE,
            "created_by" INT,
            "updated_by" INT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deleted_at" TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS "idx_kuaiai_train_tenant_active"
            ON "apps_kuaiai_training_samples" ("tenant_id", "is_active");
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS "apps_kuaiai_training_samples";
        DROP TABLE IF EXISTS "apps_kuaiai_knowledge_chunks";
        DROP TABLE IF EXISTS "apps_kuaiai_knowledge_documents";
    """
