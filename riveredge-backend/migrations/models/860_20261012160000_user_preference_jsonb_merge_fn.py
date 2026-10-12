"""
用户偏好 JSON 原子深合并函数。

主题 / 标签栏等并发 patch 不得先读后写整包 preferences；
UPDATE … SET preferences = core_jsonb_merge_preferences(preferences, patch)
在 PostgreSQL 行版本重读下可组合顶层键，避免 theme:light 被旧 theme:auto 冲掉。
"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE OR REPLACE FUNCTION core_jsonb_merge_preferences(existing jsonb, patch jsonb)
        RETURNS jsonb
        LANGUAGE plpgsql
        AS $$
        DECLARE
          result jsonb;
          key text;
          val jsonb;
          replace_keys text[] := ARRAY[
            'theme_config',
            'uni_tabs_state',
            'columns',
            'columnsDetailTable',
            'columnsWidth'
          ];
        BEGIN
          result := COALESCE(existing, '{}'::jsonb);
          IF patch IS NULL OR patch = '{}'::jsonb THEN
            RETURN result;
          END IF;

          FOR key, val IN SELECT * FROM jsonb_each(patch)
          LOOP
            IF key = ANY (replace_keys) THEN
              result := jsonb_set(result, ARRAY[key], val, true);
            ELSIF jsonb_typeof(val) = 'object'
              AND jsonb_typeof(COALESCE(result -> key, 'null'::jsonb)) = 'object' THEN
              result := jsonb_set(
                result,
                ARRAY[key],
                core_jsonb_merge_preferences(result -> key, val),
                true
              );
            ELSE
              result := jsonb_set(result, ARRAY[key], val, true);
            END IF;
          END LOOP;

          RETURN result;
        END;
        $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP FUNCTION IF EXISTS core_jsonb_merge_preferences(jsonb, jsonb);
    """
