"""
图纸密级授权 / 借阅明细补齐 BaseModel 审计列。

585 建表时 clearances 缺 created_by / created_by_name，loan_lines 缺整套审计人字段。
上传图纸会查 DrawingUserClearance（继承 BaseModel），缺列即 500：
column "created_by" does not exist.
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_drawing_user_clearances"
    ADD COLUMN IF NOT EXISTS "created_by" INT,
    ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100);

ALTER TABLE "apps_master_data_drawing_loan_lines"
    ADD COLUMN IF NOT EXISTS "created_by" INT,
    ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
    ADD COLUMN IF NOT EXISTS "updated_by" INT,
    ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
ALTER TABLE "apps_master_data_drawing_loan_lines"
    DROP COLUMN IF EXISTS "updated_by_name",
    DROP COLUMN IF EXISTS "updated_by",
    DROP COLUMN IF EXISTS "created_by_name",
    DROP COLUMN IF EXISTS "created_by";

ALTER TABLE "apps_master_data_drawing_user_clearances"
    DROP COLUMN IF EXISTS "created_by_name",
    DROP COLUMN IF EXISTS "created_by";
"""
