"""
数据库索引和约束重命名迁移 - 统一为最新命名规范

此迁移将索引和约束名从旧规范统一为新规范：
- platform_ → infra_ (平台级，对应 infra/ 文件夹)
- seed_ → apps_ (应用级，对应 apps/ 文件夹)
- sys_ → core_ (系统级，对应 core/ 文件夹，兼容别名)

执行时间: 2025-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：重命名所有索引和约束到新规范
    """
    return """
        -- 数据库索引和约束重命名迁移
        -- 统一为最新命名规范（platform_ → infra_, seed_ → apps_）
        
        -- ============================================
        -- 重命名索引（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_platform_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_platform_', 'idx_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名索引（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_seed_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_seed_', 'idx_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一索引（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'uk_platform_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'uk_platform_', 'uk_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一索引（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'uk_seed_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'uk_seed_', 'uk_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = 'public' AND indexname = new_name
                ) THEN
                    EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                        idx_record.indexname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名外键约束（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_platform_%' OR 
                    conname LIKE 'fk_platform_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_platform_', '_infra_'), 'fk_platform_', 'fk_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名外键约束（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_seed_%' OR 
                    conname LIKE 'fk_seed_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_seed_', '_apps_'), 'fk_seed_', 'fk_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一约束（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'u'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_platform_%' OR 
                    conname LIKE 'uk_platform_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_platform_', '_infra_'), 'uk_platform_', 'uk_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名唯一约束（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'u'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_seed_%' OR 
                    conname LIKE 'uk_seed_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_seed_', '_apps_'), 'uk_seed_', 'uk_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名检查约束（平台级：platform_ → infra_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'c'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_platform_%' OR 
                    conname LIKE 'ck_platform_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_platform_', '_infra_'), 'ck_platform_', 'ck_infra_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
        
        -- ============================================
        -- 重命名检查约束（应用级：seed_ → apps_）
        -- ============================================
        DO $$
        DECLARE
            con_record RECORD;
            new_name TEXT;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'c'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_seed_%' OR 
                    conname LIKE 'ck_seed_%'
                  )
            LOOP
                new_name := REPLACE(REPLACE(con_record.conname, '_seed_', '_apps_'), 'ck_seed_', 'ck_apps_');
                -- 检查新名称是否已存在
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                      AND conname = new_name
                ) THEN
                    EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                        con_record.table_name,
                        con_record.conname,
                        new_name
                    );
                END IF;
            END LOOP;
        END $$;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：反向重命名（回滚）
    """
    return """
        -- 反向重命名（回滚）
        
        -- 检查约束
        DO $$
        DECLARE
            con_record RECORD;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'c'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_infra_%' OR 
                    conname LIKE '%_apps_%'
                  )
            LOOP
                EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                    con_record.table_name,
                    con_record.conname,
                    CASE 
                        WHEN con_record.conname LIKE '%_infra_%' THEN REPLACE(REPLACE(con_record.conname, '_infra_', '_platform_'), 'ck_infra_', 'ck_platform_')
                        WHEN con_record.conname LIKE '%_apps_%' THEN REPLACE(REPLACE(con_record.conname, '_apps_', '_seed_'), 'ck_apps_', 'ck_seed_')
                    END
                );
            END LOOP;
        END $$;
        
        -- 唯一约束
        DO $$
        DECLARE
            con_record RECORD;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'u'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_infra_%' OR 
                    conname LIKE '%_apps_%'
                  )
            LOOP
                EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                    con_record.table_name,
                    con_record.conname,
                    CASE 
                        WHEN con_record.conname LIKE '%_infra_%' THEN REPLACE(REPLACE(con_record.conname, '_infra_', '_platform_'), 'uk_infra_', 'uk_platform_')
                        WHEN con_record.conname LIKE '%_apps_%' THEN REPLACE(REPLACE(con_record.conname, '_apps_', '_seed_'), 'uk_apps_', 'uk_seed_')
                    END
                );
            END LOOP;
        END $$;
        
        -- 外键约束
        DO $$
        DECLARE
            con_record RECORD;
        BEGIN
            FOR con_record IN 
                SELECT 
                    conname,
                    conrelid::regclass::text as table_name
                FROM pg_constraint
                WHERE contype = 'f'
                  AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
                  AND (
                    conname LIKE '%_infra_%' OR 
                    conname LIKE '%_apps_%'
                  )
            LOOP
                EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                    con_record.table_name,
                    con_record.conname,
                    CASE 
                        WHEN con_record.conname LIKE '%_infra_%' THEN REPLACE(REPLACE(con_record.conname, '_infra_', '_platform_'), 'fk_infra_', 'fk_platform_')
                        WHEN con_record.conname LIKE '%_apps_%' THEN REPLACE(REPLACE(con_record.conname, '_apps_', '_seed_'), 'fk_apps_', 'fk_seed_')
                    END
                );
            END LOOP;
        END $$;
        
        -- 索引
        DO $$
        DECLARE
            idx_record RECORD;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND (
                    indexname LIKE 'idx_infra_%' OR 
                    indexname LIKE 'idx_apps_%' OR
                    indexname LIKE 'uk_infra_%' OR 
                    indexname LIKE 'uk_apps_%'
                  )
            LOOP
                EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                    idx_record.indexname,
                    CASE 
                        WHEN idx_record.indexname LIKE 'idx_infra_%' THEN REPLACE(idx_record.indexname, 'idx_infra_', 'idx_platform_')
                        WHEN idx_record.indexname LIKE 'idx_apps_%' THEN REPLACE(idx_record.indexname, 'idx_apps_', 'idx_seed_')
                        WHEN idx_record.indexname LIKE 'uk_infra_%' THEN REPLACE(idx_record.indexname, 'uk_infra_', 'uk_platform_')
                        WHEN idx_record.indexname LIKE 'uk_apps_%' THEN REPLACE(idx_record.indexname, 'uk_apps_', 'uk_seed_')
                    END
                );
            END LOOP;
        END $$;
    """

