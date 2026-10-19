"""数量/单价/金额配置精度扩至 6 位：库表 scale 4→6（配置中心 numeric precision）。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    # 对业务库中仍为 scale=4 的 numeric 列扩至 scale=6，precision+2 保持整数位不变。
    # 覆盖 apps_* / haoligo_*，避免仅维护 610 那份静态清单漏掉后续新表。
    return """
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT
                    c.table_name,
                    c.column_name,
                    c.numeric_precision
                FROM information_schema.columns c
                WHERE c.table_schema = 'public'
                  AND c.data_type = 'numeric'
                  AND COALESCE(c.numeric_scale, 0) = 4
                  AND (
                    c.table_name LIKE 'apps\\_%' ESCAPE '\\'
                    OR c.table_name LIKE 'haoligo\\_%' ESCAPE '\\'
                  )
                  AND (
                    c.column_name ~* '(quantity|qty|amount|price|cost|balance|debit|credit|fee|interest)'
                    OR c.column_name IN (
                      'opening_debit', 'opening_credit', 'period_debit', 'period_credit',
                      'year_debit', 'year_credit', 'ending_debit', 'ending_credit',
                      'threshold_value', 'current_quantity', 'suggested_quantity',
                      'planned_receipt', 'planned_release', 'planned_production',
                      'planned_procurement', 'net_requirement', 'gross_requirement',
                      'safety_stock', 'reorder_point', 'available_inventory',
                      'reference_cost', 'credit_limit', 'landing_cost'
                    )
                  )
            LOOP
                IF r.numeric_precision IS NOT NULL THEN
                    EXECUTE format(
                        'ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC(%s, 6) USING %I::NUMERIC',
                        r.table_name,
                        r.column_name,
                        r.numeric_precision + 2,
                        r.column_name
                    );
                END IF;
            END LOOP;
        END $$;
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 降级不自动缩 scale；若已写入第 5/6 位小数请先手工处理
        SELECT 1;
        """
