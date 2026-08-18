"""需求计算「进行中」初始态改名为「待执行」。

「进行中」原本是新建计算单时写入的初始值，语义是待人工执行，但界面上读起来像正在运算，
计划员会误以为算过了或正在算。表示真正运算的「计算中」以前只在事务内出现、提交前即被
改写成「完成」，外部永远观察不到。

本迁移把存量初始态统一为「待执行」；未执行完的单据不会有计算明细，无需回填其它字段。
运算期间被强杀而滞留「计算中」的单据，由启动对账置为「失败」，此处不处理。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE "apps_kuaizhizao_demand_computations"
    SET "computation_status" = '待执行'
    WHERE "computation_status" = '进行中';

ALTER TABLE "apps_kuaizhizao_demand_computations"
    ALTER COLUMN "computation_status" SET DEFAULT '待执行';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE "apps_kuaizhizao_demand_computations"
    SET "computation_status" = '进行中'
    WHERE "computation_status" = '待执行';

ALTER TABLE "apps_kuaizhizao_demand_computations"
    ALTER COLUMN "computation_status" SET DEFAULT '进行中';
"""
