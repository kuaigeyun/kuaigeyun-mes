"""
快研发：任务 parent_task_id + 历史项目默认交付物补全

Author: RiverEdge Team
Date: 2026-05-28
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE "apps_kuaiplm_rd_project_tasks"
            ADD COLUMN IF NOT EXISTS "parent_task_id" INT
            REFERENCES "apps_kuaiplm_rd_project_tasks"("id") ON DELETE CASCADE;

        CREATE INDEX IF NOT EXISTS "idx_kuaiplm_task_parent"
            ON "apps_kuaiplm_rd_project_tasks" ("parent_task_id");

        -- 为尚无交付物的在研项目补全默认 NPI 交付物模板
        INSERT INTO "apps_kuaiplm_rd_project_deliverables" (
            "uuid", "tenant_id", "project_id", "gate_id", "name", "description",
            "deliverable_type", "status", "created_at", "updated_at"
        )
        SELECT
            gen_random_uuid()::text,
            g."tenant_id",
            g."project_id",
            g."id",
            tpl.name,
            NULL,
            tpl.deliverable_type,
            'PENDING',
            NOW(),
            NOW()
        FROM "apps_kuaiplm_rd_project_gates" g
        CROSS JOIN LATERAL (
            VALUES
                ('concept', '项目立项书', 'document'),
                ('concept', '市场调研摘要', 'document'),
                ('design', 'EBOM 初版', 'bom'),
                ('design', '图纸包', 'drawing'),
                ('design', 'DFM 评审纪要', 'document'),
                ('prototype', '样机试制报告', 'document'),
                ('prototype', '样机测试记录', 'test'),
                ('pilot', '试产工艺路线', 'process'),
                ('pilot', '试产质量报告', 'quality'),
                ('release', '量产 EBOM', 'bom'),
                ('release', '作业指导书包', 'sop'),
                ('release', '量产移交清单', 'document')
        ) AS tpl(gate_key, name, deliverable_type)
        WHERE g."gate_key" = tpl.gate_key
          AND NOT EXISTS (
              SELECT 1 FROM "apps_kuaiplm_rd_project_deliverables" d
              WHERE d."project_id" = g."project_id" AND d."deleted_at" IS NULL
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX IF EXISTS "idx_kuaiplm_task_parent";
        ALTER TABLE "apps_kuaiplm_rd_project_tasks"
            DROP COLUMN IF EXISTS "parent_task_id";
    """
