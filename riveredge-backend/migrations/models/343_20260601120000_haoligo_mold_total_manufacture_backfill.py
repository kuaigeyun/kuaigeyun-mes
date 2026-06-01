"""还入单制造数量回填模具台账总制造数量（历史数据）。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE haoligo_mold m
        SET total_manufacture_qty = COALESCE((
            SELECT SUM(r.manufacture_qty)
            FROM haoligo_mold_return_sheet r
            WHERE r.tenant_id = m.tenant_id
              AND r.mold_code = m.mold_code
              AND r.deleted_at IS NULL
        ), 0),
            updated_at = NOW()
        WHERE m.deleted_at IS NULL
          AND COALESCE(m.total_manufacture_qty, 0) = 0
          AND EXISTS (
            SELECT 1
            FROM haoligo_mold_return_sheet r
            WHERE r.tenant_id = m.tenant_id
              AND r.mold_code = m.mold_code
              AND r.deleted_at IS NULL
          );
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
