"""下架短期不做的专业版占位应用：快能源 kuaiems、快协同 kuaisrm。

清单真源已从 pro_app_catalog / proAppCatalog 移除；此处软删除库内残留行，
避免应用中心仍从 core_applications 列出。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE core_applications
   SET deleted_at = NOW(),
       updated_at = NOW(),
       is_active = FALSE,
       is_installed = FALSE
 WHERE code IN ('kuaiems', 'kuaisrm')
   AND deleted_at IS NULL;
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return "-- noop: re-register kuaiems / kuaisrm only after they exist as real apps"
