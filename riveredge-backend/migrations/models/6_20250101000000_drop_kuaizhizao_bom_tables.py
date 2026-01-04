"""
删除kuaizhizao APP中的BOM管理表

BOM管理已移至master_data APP，删除kuaizhizao中的重复实现。

Author: Luigi Lu
Date: 2025-01-01
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：删除kuaizhizao APP中的BOM管理表
    
    删除以下表：
    - apps_kuaizhizao_bill_of_materials_items (明细表，先删除)
    - apps_kuaizhizao_bill_of_materials (主表)
    """
    return """
    -- 删除BOM明细表（先删除明细表，因为可能有外键依赖）
    DROP TABLE IF EXISTS "apps_kuaizhizao_bill_of_materials_items" CASCADE;
    
    -- 删除BOM主表
    DROP TABLE IF EXISTS "apps_kuaizhizao_bill_of_materials" CASCADE;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：重新创建BOM管理表
    
    注意：此操作仅用于回滚，实际不推荐使用。
    如果需要恢复BOM管理，应该从master_data APP中获取。
    """
    return """
    -- 降级操作：重新创建BOM管理表
    -- 注意：此操作仅用于回滚，实际不推荐使用
    -- BOM管理已移至master_data APP，如需使用请从master_data获取
    
    -- 这里不提供具体的表结构，因为BOM管理已移至master_data APP
    -- 如果需要恢复，请参考master_data APP中的BOM表结构
    """

