"""
合并后的初始迁移文件

此文件合并了所有历史迁移，记录了数据库当前完整结构
生成时间: 2025-12-23 15:01:28

注意:
1. 此文件使用 IF NOT EXISTS，如果表已存在不会报错
2. 建议备份现有迁移文件后再使用此文件
3. 使用前请检查 SQL 语句是否正确
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    创建所有表结构
    """
    return """
-- 合并后的初始迁移文件
-- 生成时间: 2025-12-23 15:01:28
-- 表数量: 2

-- 注意: 此文件记录了数据库当前完整结构
-- 使用 pg_dump 方式生成，包含完整的表结构、索引、约束等

-- 表: 116
-- 如需完整结构，请使用: pg_dump -t "116" -s

-- 表: <Record table_name='apps_kuaicrm_complaints'>
-- 如需完整结构，请使用: pg_dump -t "<Record table_name='apps_kuaicrm_complaints'>" -s

-- 建议使用以下方法获取完整 SQL:
-- 1. 使用 pg_dump: pg_dump -s -t 'table_name' database_name
-- 2. 或使用数据库工具导出表结构
-- 3. 将导出的 SQL 整理后放入此迁移文件
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    删除所有表（谨慎使用）
    """
    return """
-- 注意: 此操作会删除所有表，请谨慎使用
-- 如需回滚，请手动执行 DROP TABLE 语句
"""
