"""修复 PC 上传误写入 min_version_code = versionCode - 1 的历史发布记录。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        UPDATE core_client_releases
        SET min_version_code = 0
        WHERE min_version_code > 0
          AND min_version_code = version_code - 1;
        """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return ""
