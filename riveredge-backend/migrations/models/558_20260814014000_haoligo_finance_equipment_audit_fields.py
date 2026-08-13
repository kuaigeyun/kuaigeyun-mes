"""
设备合同/应付三表补齐 BaseModel 审计字段

迁移 557 建表时漏了 created_by / created_by_name / updated_by / updated_by_name，
ORM 写入会引用这些列导致登记失败。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True

_TABLES = (
    "haoligo_finance_equipment_contract",
    "haoligo_finance_equipment_payable",
    "haoligo_finance_equipment_payable_payment",
)


async def upgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
        ALTER TABLE "{table}"
            ADD COLUMN IF NOT EXISTS "created_by" INT,
            ADD COLUMN IF NOT EXISTS "created_by_name" VARCHAR(100),
            ADD COLUMN IF NOT EXISTS "updated_by" INT,
            ADD COLUMN IF NOT EXISTS "updated_by_name" VARCHAR(100);
            """
        )
    return "\n".join(parts)


async def downgrade(db: BaseDBAsyncClient) -> str:
    parts = []
    for table in _TABLES:
        parts.append(
            f"""
        ALTER TABLE "{table}"
            DROP COLUMN IF EXISTS "updated_by_name",
            DROP COLUMN IF EXISTS "updated_by",
            DROP COLUMN IF EXISTS "created_by_name",
            DROP COLUMN IF EXISTS "created_by";
            """
        )
    return "\n".join(parts)
