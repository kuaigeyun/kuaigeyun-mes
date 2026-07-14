"""销售预测审计操作人一次性回填。

历史行常见：updated_at 有值但 updated_by/_name 为空；列表「更新时间」列只读
updated_by_name，因而显示「-」。本迁移仅回填可溯源数据，不伪造管理员。
"""

from tortoise import BaseDBAsyncClient

_TABLE = "apps_kuaizhizao_sales_forecasts"


async def upgrade(db: BaseDBAsyncClient) -> str:
    return f"""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = '{_TABLE}'
    ) THEN
        RETURN;
    END IF;

    -- 1) created_by -> created_by_name
    UPDATE {_TABLE} x
       SET created_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
      FROM core_users u
     WHERE x.created_by IS NOT NULL
       AND CAST(x.created_by AS TEXT) = CAST(u.id AS TEXT)
       AND (
            x.created_by_name IS NULL
            OR BTRIM(x.created_by_name) = ''
            OR BTRIM(x.created_by_name) = CAST(x.created_by AS TEXT)
       );

    -- 2) updated_by -> updated_by_name
    UPDATE {_TABLE} x
       SET updated_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
      FROM core_users u
     WHERE x.updated_by IS NOT NULL
       AND CAST(x.updated_by AS TEXT) = CAST(u.id AS TEXT)
       AND (
            x.updated_by_name IS NULL
            OR BTRIM(x.updated_by_name) = ''
            OR BTRIM(x.updated_by_name) = CAST(x.updated_by AS TEXT)
       );

    -- 3) 从未写过更新人：用创建人作为最后操作人（创建即唯一操作）
    UPDATE {_TABLE}
       SET updated_by = created_by,
           updated_by_name = created_by_name
     WHERE updated_by IS NULL
       AND created_by IS NOT NULL
       AND (
            updated_by_name IS NULL
            OR BTRIM(updated_by_name) = ''
       );

    -- 4) 仍缺 ID：从操作日志回填（最早 create / 最晚 create|update）
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='{_TABLE}' AND column_name='uuid'
    ) THEN
        UPDATE {_TABLE} x
           SET created_by = sub.user_id,
               created_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
          FROM (
                SELECT DISTINCT ON (x2.id)
                       x2.id AS row_id,
                       l.user_id
                  FROM {_TABLE} x2
                  JOIN core_operation_logs l
                    ON l.tenant_id = x2.tenant_id
                   AND l.operation_type = 'create'
                   AND l.user_id IS NOT NULL
                   AND (
                        (l.operation_object_uuid IS NOT NULL
                         AND CAST(l.operation_object_uuid AS text) = CAST(x2.uuid AS text))
                        OR (l.operation_object_id IS NOT NULL
                            AND l.operation_object_id = x2.id)
                   )
                 WHERE x2.created_by IS NULL
                 ORDER BY x2.id, l.created_at ASC, l.id ASC
          ) sub
          JOIN core_users u ON u.id = sub.user_id
         WHERE x.id = sub.row_id
           AND x.created_by IS NULL;

        UPDATE {_TABLE} x
           SET updated_by = sub.user_id,
               updated_by_name = COALESCE(NULLIF(u.full_name, ''), u.username)
          FROM (
                SELECT DISTINCT ON (x2.id)
                       x2.id AS row_id,
                       l.user_id
                  FROM {_TABLE} x2
                  JOIN core_operation_logs l
                    ON l.tenant_id = x2.tenant_id
                   AND l.operation_type IN ('create', 'update')
                   AND l.user_id IS NOT NULL
                   AND (
                        (l.operation_object_uuid IS NOT NULL
                         AND CAST(l.operation_object_uuid AS text) = CAST(x2.uuid AS text))
                        OR (l.operation_object_id IS NOT NULL
                            AND l.operation_object_id = x2.id)
                   )
                 WHERE x2.updated_by IS NULL
                 ORDER BY x2.id, l.created_at DESC, l.id DESC
          ) sub
          JOIN core_users u ON u.id = sub.user_id
         WHERE x.id = sub.row_id
           AND x.updated_by IS NULL;
    END IF;
END$$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
SELECT 1;
    """
