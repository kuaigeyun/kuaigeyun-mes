"""
补齐单据审核开关流程定义（默认关闭）。

为每个租户补齐常用单据审批流程，便于在流程设置中按单据开关审核。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


AUDIT_CODES = (
    "demand",
    "sales_forecast",
    "sales_order",
    "quotation",
    "production_plan",
    "purchase_request",
    "purchase_order",
    "reporting_record",
    "quality_inspection",
    "incoming_inspection",
    "process_inspection",
    "finished_goods_inspection",
    "sales_delivery",
    "purchase_receipt",
    "finished_goods_receipt",
    "other_inbound",
    "other_outbound",
    "production_picking",
    "production_return",
    "material_borrow",
    "material_return",
    "sales_return",
    "purchase_return"
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    values = ", ".join([f"('{code}')" for code in AUDIT_CODES])
    return f"""
        WITH all_tenants AS (
            SELECT id AS tenant_id FROM infra_tenants
        ),
        all_codes AS (
            SELECT code FROM (VALUES {values}) AS v(code)
        ),
        candidate_rows AS (
            SELECT
                t.tenant_id,
                c.code,
                c.code || '_audit' AS name,
                '单据审核开关（默认关闭）'::text AS description
            FROM all_tenants t
            CROSS JOIN all_codes c
        )
        INSERT INTO core_approval_processes
            (uuid, tenant_id, name, code, description, nodes, config, is_active, created_at, updated_at)
        SELECT
            gen_random_uuid()::text,
            r.tenant_id,
            r.name,
            r.code,
            r.description,
            '{{"nodes":[{{"id":"start","type":"start","position":{{"x":250,"y":50}},"data":{{"label":"开始","layoutDirection":"vertical"}}}},{{"id":"approval_1","type":"approval","position":{{"x":250,"y":200}},"data":{{"label":"审批","approver_type":"user","layoutDirection":"vertical"}}}},{{"id":"end","type":"end","position":{{"x":250,"y":350}},"data":{{"label":"结束","layoutDirection":"vertical"}}}}],"edges":[{{"source":"start","target":"approval_1"}},{{"source":"approval_1","target":"end"}}]}}'::jsonb,
            '{{}}'::jsonb,
            FALSE,
            NOW(),
            NOW()
        FROM candidate_rows r
        LEFT JOIN core_approval_processes p
            ON p.tenant_id = r.tenant_id
           AND p.code = r.code
           AND p.deleted_at IS NULL
        WHERE p.id IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    codes = "', '".join(AUDIT_CODES)
    return f"""
        DELETE FROM core_approval_processes
        WHERE code IN ('{codes}')
          AND description = '单据审核开关（默认关闭）';
    """
