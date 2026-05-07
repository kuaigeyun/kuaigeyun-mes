"""
重新排列所有应用的 sort_order，并注册进销存 (kuaierp) / 快车间 (kuaimes) 虚拟应用。

排序规则（以后端数据库为单一真相来源）：
  10  主数据    master-data
  20  快制造    kuaizhizao
  21  进销存    kuaierp     （虚拟，路由转发至 kuaizhizao 前端）
  22  快车间    kuaimes     （虚拟，路由转发至 kuaizhizao 前端）
  30  快财务    kuaicaiwu
  40  快客户    kuaicrm     （占位，无后端代码）
  50  快研发    kuaiplm     （占位，无后端代码）
  60  快协同    kuaisrm     （占位，无后端代码）
  70  快数采    kuaiiot
  80  快报表    kuaireport
  90  KU-AI     kuaiai
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- ① 更新已有应用的 sort_order
        UPDATE core_applications SET sort_order = 10  WHERE code = 'master-data'  AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 20  WHERE code = 'kuaizhizao'   AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 30  WHERE code = 'kuaicaiwu'    AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 70  WHERE code = 'kuaiiot'      AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 80  WHERE code = 'kuaireport'   AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 90  WHERE code = 'kuaiai'       AND deleted_at IS NULL;

        -- ② 插入虚拟应用 kuaierp（进销存），若不存在则插入；已存在则仅更新 sort_order
        INSERT INTO core_applications (
            uuid, tenant_id, code, name, description, version,
            entry_point, route_path, sort_order,
            is_system, is_active, is_installed,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            t.id,
            'kuaierp',
            '进销存',
            '标准进销存管理（由快制造虚拟拆分，共享快制造前端路由）',
            '1.0.0',
            '../apps/kuaizhizao/index.tsx',
            '/apps/kuaierp',
            21,
            FALSE, TRUE, TRUE,
            NOW(), NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_applications
            WHERE code = 'kuaierp' AND tenant_id = t.id AND deleted_at IS NULL
        );

        UPDATE core_applications SET sort_order = 21 WHERE code = 'kuaierp' AND deleted_at IS NULL;

        -- ③ 插入虚拟应用 kuaimes（快车间）
        INSERT INTO core_applications (
            uuid, tenant_id, code, name, description, version,
            entry_point, route_path, sort_order,
            is_system, is_active, is_installed,
            created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            t.id,
            'kuaimes',
            '快车间',
            '车间生产执行与计划协同（由快制造虚拟拆分，共享快制造前端路由）',
            '1.0.0',
            '../apps/kuaizhizao/index.tsx',
            '/apps/kuaimes',
            22,
            FALSE, TRUE, TRUE,
            NOW(), NOW()
        FROM infra_tenants t
        WHERE NOT EXISTS (
            SELECT 1 FROM core_applications
            WHERE code = 'kuaimes' AND tenant_id = t.id AND deleted_at IS NULL
        );

        UPDATE core_applications SET sort_order = 22 WHERE code = 'kuaimes' AND deleted_at IS NULL;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_applications SET sort_order = 70  WHERE code = 'master-data'  AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 30  WHERE code = 'kuaizhizao'   AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 50  WHERE code = 'kuaicaiwu'    AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 55  WHERE code = 'kuaiiot'      AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 60  WHERE code = 'kuaireport'   AND deleted_at IS NULL;
        UPDATE core_applications SET sort_order = 80  WHERE code = 'kuaiai'       AND deleted_at IS NULL;
        UPDATE core_applications SET deleted_at = NOW() WHERE code IN ('kuaierp', 'kuaimes') AND deleted_at IS NULL;
    """
