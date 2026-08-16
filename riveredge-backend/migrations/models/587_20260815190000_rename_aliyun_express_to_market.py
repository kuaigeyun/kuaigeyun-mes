"""将短期快递专用 type=aliyun_express 归一为通用云市场 aliyun_market。

场景写入 express_query，供货运跟踪识别；调用地址仍由连接器配置填写。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE core_integration_configs
   SET type = 'aliyun_market',
       config = COALESCE(config, '{}'::jsonb)
         || jsonb_build_object('scene', 'express_query')
         || CASE
              WHEN COALESCE(config->>'http_method', '') = ''
              THEN jsonb_build_object('http_method', 'POST')
              ELSE '{}'::jsonb
            END,
       updated_at = NOW()
 WHERE type = 'aliyun_express';
"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
UPDATE core_integration_configs
   SET type = 'aliyun_express',
       updated_at = NOW()
 WHERE type = 'aliyun_market'
   AND COALESCE(config->>'scene', '') = 'express_query';
"""
