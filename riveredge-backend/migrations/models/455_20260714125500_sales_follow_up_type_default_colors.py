"""为销售跟进方式系统字典补齐默认颜色。"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE core_dictionary_items AS i
SET color = CASE i.value
    WHEN 'PHONE' THEN 'blue'
    WHEN 'VISIT' THEN 'green'
    WHEN 'IM' THEN 'cyan'
    WHEN 'EMAIL' THEN 'geekblue'
    WHEN 'EXPO' THEN 'purple'
    WHEN 'SAMPLE_TECH' THEN 'gold'
    WHEN 'OTHER' THEN 'default'
    ELSE i.color
END
FROM core_data_dictionaries AS d
WHERE d.id = i.dictionary_id
  AND d.deleted_at IS NULL
  AND i.deleted_at IS NULL
  AND d.code = 'SALES_FOLLOW_UP_TYPE'
  AND (i.color IS NULL OR BTRIM(i.color) = '');
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
-- 默认颜色为业务可编辑配置，不在回滚中清空。
SELECT 1;
    """
