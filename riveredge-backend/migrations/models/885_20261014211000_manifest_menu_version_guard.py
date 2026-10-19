"""应用菜单清单版本门禁：旧节点不得覆盖新菜单结构。"""

from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE OR REPLACE FUNCTION core_guard_application_menu_config_version()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          old_parts integer[];
          new_parts integer[];
        BEGIN
          IF NEW.menu_config IS NOT DISTINCT FROM OLD.menu_config THEN
            RETURN NEW;
          END IF;

          IF COALESCE(NEW.version, '') !~ '^[0-9]+\\.[0-9]+\\.[0-9]+$'
             OR COALESCE(OLD.version, '') !~ '^[0-9]+\\.[0-9]+\\.[0-9]+$' THEN
            RAISE EXCEPTION
              'menu_config change requires semantic manifest version upgrade: app=%, old=%, new=%',
              OLD.code, OLD.version, NEW.version;
          END IF;

          old_parts := string_to_array(OLD.version, '.')::integer[];
          new_parts := string_to_array(NEW.version, '.')::integer[];
          IF new_parts <= old_parts THEN
            RAISE EXCEPTION
              'stale manifest rejected: app=%, old=%, new=%',
              OLD.code, OLD.version, NEW.version;
          END IF;

          RETURN NEW;
        END;
        $$;

        DROP TRIGGER IF EXISTS trg_core_applications_menu_version_guard
          ON core_applications;
        CREATE TRIGGER trg_core_applications_menu_version_guard
          BEFORE UPDATE OF menu_config, version
          ON core_applications
          FOR EACH ROW
          EXECUTE FUNCTION core_guard_application_menu_config_version();
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TRIGGER IF EXISTS trg_core_applications_menu_version_guard
          ON core_applications;
        DROP FUNCTION IF EXISTS core_guard_application_menu_config_version();
    """
