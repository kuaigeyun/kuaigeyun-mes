"""
初始迁移文件 - 基于当前数据库状态

此迁移文件标记当前数据库状态为已迁移的基础状态。
数据库表结构已通过 public.sql 导入，此迁移文件不执行任何操作。

生成时间: 2025-12-27
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级到当前数据库状态
    
    由于数据库表结构已存在（通过 public.sql 导入），
    此迁移不执行任何操作，仅用于标记当前状态。
    """
    return """
    -- 初始迁移：基于当前数据库状态
    -- 数据库表结构已通过 public.sql 导入
    -- 此迁移不执行任何操作，仅用于标记当前状态
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级操作
    
    此迁移不支持降级，因为它是初始状态。
    """
    return """
    -- 初始迁移不支持降级
    """

