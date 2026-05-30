"""拆分工单 parent_work_order_id 回填（编码 xxx-NNN + 工单拆分关联）"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE "apps_kuaizhizao_work_orders" AS child
        SET "parent_work_order_id" = parent.id
        FROM "apps_kuaizhizao_work_orders" AS parent
        WHERE child."parent_work_order_id" IS NULL
          AND child."deleted_at" IS NULL
          AND parent."deleted_at" IS NULL
          AND child."tenant_id" = parent."tenant_id"
          AND child.code ~ '.+-[0-9]{3}$'
          AND parent.code = regexp_replace(child.code, '-[0-9]{3}$', '');

        UPDATE "apps_kuaizhizao_work_orders" AS child
        SET "parent_work_order_id" = rel."source_id"
        FROM "apps_kuaizhizao_document_relations" AS rel
        WHERE child."parent_work_order_id" IS NULL
          AND child."deleted_at" IS NULL
          AND rel."tenant_id" = child."tenant_id"
          AND rel."source_type" = 'work_order'
          AND rel."target_type" = 'work_order'
          AND rel."relation_desc" = '工单拆分'
          AND rel."target_id" = child.id;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        SELECT 1;
    """
