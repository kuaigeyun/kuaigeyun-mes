"""
为成本核算规则表补全与 ORM 一致的列：allocation_basis、wip_valuation_method、source_module。

修复「初始化推荐规则」等写入时报错 column "source_module" does not exist。
表名：迁移 138 之后为 apps_kuaicaiwu_cost_rules；未重命名时仍为 apps_kuaizhizao_cost_rules。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


def _alter_table_sql(table: str) -> str:
    return f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = '{table}'
            ) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '{table}'
                    AND column_name = 'allocation_basis'
                ) THEN
                    ALTER TABLE "{table}" ADD COLUMN "allocation_basis" VARCHAR(50);
                    COMMENT ON COLUMN "{table}"."allocation_basis" IS '分摊基准';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '{table}'
                    AND column_name = 'wip_valuation_method'
                ) THEN
                    ALTER TABLE "{table}" ADD COLUMN "wip_valuation_method" VARCHAR(50);
                    COMMENT ON COLUMN "{table}"."wip_valuation_method" IS '在产品核算方法';
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = '{table}'
                    AND column_name = 'source_module'
                ) THEN
                    ALTER TABLE "{table}" ADD COLUMN "source_module" VARCHAR(50);
                    COMMENT ON COLUMN "{table}"."source_module" IS '费用来源模块';
                END IF;
            END IF;
        END $$;
    """


async def upgrade(db: BaseDBAsyncClient) -> str:
    return (
        _alter_table_sql("apps_kuaicaiwu_cost_rules")
        + _alter_table_sql("apps_kuaizhizao_cost_rules")
    )


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_cost_rules" DROP COLUMN IF EXISTS "source_module";
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_cost_rules" DROP COLUMN IF EXISTS "wip_valuation_method";
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_cost_rules" DROP COLUMN IF EXISTS "allocation_basis";
        ALTER TABLE IF EXISTS "apps_kuaizhizao_cost_rules" DROP COLUMN IF EXISTS "source_module";
        ALTER TABLE IF EXISTS "apps_kuaizhizao_cost_rules" DROP COLUMN IF EXISTS "wip_valuation_method";
        ALTER TABLE IF EXISTS "apps_kuaizhizao_cost_rules" DROP COLUMN IF EXISTS "allocation_basis";
    """
