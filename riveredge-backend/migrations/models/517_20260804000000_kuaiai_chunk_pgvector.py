"""
KU-AI 知识库分块 pgvector 列

Author: Auto
Date: 2026-08-04
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE EXTENSION IF NOT EXISTS vector;

        ALTER TABLE "apps_kuaiai_knowledge_chunks"
            ADD COLUMN IF NOT EXISTS "embedding_vector" vector(768);

        CREATE INDEX IF NOT EXISTS "idx_kuaiai_kchunk_tenant_hnsw"
            ON "apps_kuaiai_knowledge_chunks"
            USING hnsw ("embedding_vector" vector_cosine_ops)
            WHERE "deleted_at" IS NULL AND "embedding_vector" IS NOT NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_kuaiai_kchunk_tenant_hnsw";
        ALTER TABLE "apps_kuaiai_knowledge_chunks"
            DROP COLUMN IF EXISTS "embedding_vector";
    """
