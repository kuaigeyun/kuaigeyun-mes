"""将应收、应付、采购发票、成本核算表从 apps_kuaizhizao_* 迁移至 apps_kuaicaiwu_*

通过表重命名实现数据迁移，保持数据与 ID 不变。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 1. 应收单表重命名
        ALTER TABLE IF EXISTS "apps_kuaizhizao_receivables" RENAME TO "apps_kuaicaiwu_receivables";
        COMMENT ON TABLE "apps_kuaicaiwu_receivables" IS '轻管理会计 - 应收单';

        -- 2. 应付单表重命名（需先处理 purchase_invoices 的外键）
        ALTER TABLE IF EXISTS "apps_kuaizhizao_purchase_invoices"
            DROP CONSTRAINT IF EXISTS "fk_apps_kuaizhizao_purchase_invoices_payable_id";
        ALTER TABLE IF EXISTS "apps_kuaizhizao_payables" RENAME TO "apps_kuaicaiwu_payables";
        COMMENT ON TABLE "apps_kuaicaiwu_payables" IS '轻管理会计 - 应付单';

        -- 3. 采购发票表重命名并恢复外键
        ALTER TABLE IF EXISTS "apps_kuaizhizao_purchase_invoices" RENAME TO "apps_kuaicaiwu_purchase_invoices";
        COMMENT ON TABLE "apps_kuaicaiwu_purchase_invoices" IS '轻管理会计 - 采购发票';
        ALTER TABLE "apps_kuaicaiwu_purchase_invoices"
            ADD CONSTRAINT "fk_apps_kuaicaiwu_purchase_invoices_payable_id"
            FOREIGN KEY ("payable_id") REFERENCES "apps_kuaicaiwu_payables"("id") ON DELETE SET NULL;

        -- 4. 成本核算规则表重命名
        ALTER TABLE IF EXISTS "apps_kuaizhizao_cost_rules" RENAME TO "apps_kuaicaiwu_cost_rules";
        COMMENT ON TABLE "apps_kuaicaiwu_cost_rules" IS '轻管理会计 - 成本核算规则';

        -- 5. 成本核算记录表重命名
        ALTER TABLE IF EXISTS "apps_kuaizhizao_cost_calculations" RENAME TO "apps_kuaicaiwu_cost_calculations";
        COMMENT ON TABLE "apps_kuaicaiwu_cost_calculations" IS '轻管理会计 - 成本核算';
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 5. 成本核算记录表还原
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_cost_calculations" RENAME TO "apps_kuaizhizao_cost_calculations";

        -- 4. 成本核算规则表还原
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_cost_rules" RENAME TO "apps_kuaizhizao_cost_rules";

        -- 3. 采购发票表还原（需先删除外键）
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_purchase_invoices"
            DROP CONSTRAINT IF EXISTS "fk_apps_kuaicaiwu_purchase_invoices_payable_id";
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_purchase_invoices" RENAME TO "apps_kuaizhizao_purchase_invoices";

        -- 2. 应付单表还原
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_payables" RENAME TO "apps_kuaizhizao_payables";
        ALTER TABLE IF EXISTS "apps_kuaizhizao_purchase_invoices"
            ADD CONSTRAINT "fk_apps_kuaizhizao_purchase_invoices_payable_id"
            FOREIGN KEY ("payable_id") REFERENCES "apps_kuaizhizao_payables"("id") ON DELETE SET NULL;

        -- 1. 应收单表还原
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_receivables" RENAME TO "apps_kuaizhizao_receivables";
        """
