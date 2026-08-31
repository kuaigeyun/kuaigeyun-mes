"""快制造 — 补全快研发 DELIVERY 项目迁移（头字段 + 阶段门 → 节点 + 归档标记）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 补全已迁入项目头字段
        UPDATE "apps_kuaizhizao_delivery_projects" dp
        SET
            "owner_id" = rp."owner_id",
            "owner_name" = rp."owner_name",
            "material_id" = rp."material_id",
            "delivery_date" = rp."planned_end_date",
            "planned_start_date" = rp."planned_start_date",
            "planned_end_date" = rp."planned_end_date",
            "actual_start_date" = rp."actual_start_date",
            "actual_end_date" = rp."actual_end_date",
            "created_by" = rp."created_by",
            "created_by_name" = rp."created_by_name",
            "updated_by" = rp."updated_by",
            "updated_by_name" = rp."updated_by_name",
            "notes" = CASE
                WHEN rp."notes" IS NULL OR btrim(rp."notes") = '' THEN '自快研发交付项目迁移'
                ELSE rp."notes" || E'\\n自快研发交付项目迁移'
            END
        FROM "apps_kuaiplm_rd_projects" rp
        WHERE rp."project_type" = 'DELIVERY'
          AND dp."tenant_id" = rp."tenant_id"
          AND dp."project_code" = rp."project_code";

        -- 阶段门 → 交付项目节点
        INSERT INTO "apps_kuaizhizao_delivery_project_nodes" (
            "uuid", "tenant_id", "created_at", "updated_at",
            "created_by", "created_by_name", "updated_by", "updated_by_name",
            "project_id", "node_key", "node_name", "sort_order", "status",
            "progress_percent", "owner_id", "owner_name",
            "planned_start_date", "planned_end_date", "actual_start_date", "actual_end_date",
            "is_critical", "is_milestone"
        )
        SELECT
            gen_random_uuid()::text,
            g."tenant_id",
            COALESCE(g."created_at", NOW()),
            COALESCE(g."updated_at", NOW()),
            g."created_by",
            g."created_by_name",
            g."updated_by",
            g."updated_by_name",
            dp."id",
            g."gate_key",
            g."gate_name",
            g."sort_order",
            CASE g."status"
                WHEN 'PASSED' THEN 'completed'
                WHEN 'SKIPPED' THEN 'completed'
                WHEN 'IN_PROGRESS' THEN 'in_progress'
                WHEN 'FAILED' THEN 'overdue'
                ELSE 'not_started'
            END,
            CASE
                WHEN g."status" IN ('PASSED', 'SKIPPED') THEN 100
                WHEN g."status" = 'IN_PROGRESS' THEN 50
                ELSE 0
            END,
            g."reviewer_id",
            g."reviewer_name",
            g."planned_date",
            g."planned_date",
            g."actual_date",
            g."actual_date",
            FALSE,
            g."gate_key" IN ('first_delivery', 'service_handover')
        FROM "apps_kuaiplm_rd_project_gates" g
        INNER JOIN "apps_kuaiplm_rd_projects" rp
            ON rp."id" = g."project_id" AND rp."project_type" = 'DELIVERY'
        INNER JOIN "apps_kuaizhizao_delivery_projects" dp
            ON dp."tenant_id" = rp."tenant_id" AND dp."project_code" = rp."project_code"
        WHERE NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_delivery_project_nodes" n
            WHERE n."tenant_id" = g."tenant_id"
              AND n."project_id" = dp."id"
              AND n."node_key" = g."gate_key"
        );

        -- 回写当前节点
        UPDATE "apps_kuaizhizao_delivery_projects" dp
        SET
            "current_node_key" = g."gate_key",
            "current_node_name" = g."gate_name"
        FROM "apps_kuaiplm_rd_projects" rp
        INNER JOIN "apps_kuaiplm_rd_project_gates" g
            ON g."project_id" = rp."id" AND g."gate_key" = rp."current_gate_key"
        WHERE rp."project_type" = 'DELIVERY'
          AND dp."tenant_id" = rp."tenant_id"
          AND dp."project_code" = rp."project_code";

        -- 回写总进度（节点完成度均值）
        UPDATE "apps_kuaizhizao_delivery_projects" dp
        SET "progress_percent" = np."avg_progress"
        FROM (
            SELECT
                n."project_id",
                ROUND(AVG(n."progress_percent")::numeric, 2) AS "avg_progress"
            FROM "apps_kuaizhizao_delivery_project_nodes" n
            GROUP BY n."project_id"
        ) np
        WHERE dp."id" = np."project_id";

        -- 全部节点已完成则标记项目已完成
        UPDATE "apps_kuaizhizao_delivery_projects" dp
        SET
            "status" = 'completed',
            "actual_end_date" = COALESCE(dp."actual_end_date", dp."planned_end_date")
        WHERE dp."progress_percent" >= 100
          AND NOT EXISTS (
            SELECT 1 FROM "apps_kuaizhizao_delivery_project_nodes" n
            WHERE n."project_id" = dp."id" AND n."status" <> 'completed'
          );

        -- 快研发侧标记只读归档（保留原记录供审计）
        UPDATE "apps_kuaiplm_rd_projects" rp
        SET "notes" = CASE
                WHEN rp."notes" IS NULL OR btrim(rp."notes") = ''
                    THEN '[已归档] 已迁移至快制造交付项目，请在新菜单查看'
                WHEN rp."notes" NOT LIKE '%已迁移至快制造交付项目%'
                    THEN rp."notes" || E'\\n[已归档] 已迁移至快制造交付项目，请在新菜单查看'
                ELSE rp."notes"
            END
        WHERE rp."project_type" = 'DELIVERY';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DELETE FROM "apps_kuaizhizao_delivery_project_nodes" n
        USING "apps_kuaizhizao_delivery_projects" dp,
              "apps_kuaiplm_rd_projects" rp
        WHERE n."project_id" = dp."id"
          AND rp."project_type" = 'DELIVERY'
          AND dp."tenant_id" = rp."tenant_id"
          AND dp."project_code" = rp."project_code";
    """
