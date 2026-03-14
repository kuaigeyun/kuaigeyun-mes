"""将发票表从 apps_kuaizhizao_* 重命名为 apps_kuaicaiwu_*

发票管理已从快制造迁移至快财务，表名按 APP 代码统一为 kuaicaiwu。
通过表重命名实现，保持数据与 ID 不变。
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 1. 删除 invoice_items 的外键（PostgreSQL 默认约束名）
        ALTER TABLE IF EXISTS "apps_kuaizhizao_invoice_items"
            DROP CONSTRAINT IF EXISTS "apps_kuaizhizao_invoice_items_invoice_id_fkey";

        -- 2. 发票主表重命名
        ALTER TABLE IF EXISTS "apps_kuaizhizao_invoices" RENAME TO "apps_kuaicaiwu_invoices";
        COMMENT ON TABLE "apps_kuaicaiwu_invoices" IS '快财务 - 发票库（销项/进项）';

        -- 3. 发票明细表重命名
        ALTER TABLE IF EXISTS "apps_kuaizhizao_invoice_items" RENAME TO "apps_kuaicaiwu_invoice_items";
        COMMENT ON TABLE "apps_kuaicaiwu_invoice_items" IS '快财务 - 发票明细';

        -- 4. 恢复 invoice_items 的外键
        ALTER TABLE "apps_kuaicaiwu_invoice_items"
            ADD CONSTRAINT "apps_kuaicaiwu_invoice_items_invoice_id_fkey"
            FOREIGN KEY ("invoice_id") REFERENCES "apps_kuaicaiwu_invoices"("id") ON DELETE CASCADE;
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        -- 4. 删除外键
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_invoice_items"
            DROP CONSTRAINT IF EXISTS "apps_kuaicaiwu_invoice_items_invoice_id_fkey";

        -- 3. 发票明细表还原
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_invoice_items" RENAME TO "apps_kuaizhizao_invoice_items";

        -- 2. 发票主表还原
        ALTER TABLE IF EXISTS "apps_kuaicaiwu_invoices" RENAME TO "apps_kuaizhizao_invoices";

        -- 1. 恢复外键
        ALTER TABLE "apps_kuaizhizao_invoice_items"
            ADD CONSTRAINT "apps_kuaizhizao_invoice_items_invoice_id_fkey"
            FOREIGN KEY ("invoice_id") REFERENCES "apps_kuaizhizao_invoices"("id") ON DELETE CASCADE;
        """
