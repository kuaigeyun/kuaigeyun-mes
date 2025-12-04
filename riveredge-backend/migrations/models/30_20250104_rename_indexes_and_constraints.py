"""
数据库索引和约束重命名迁移 - 从植物系命名重构为常规B端命名

此迁移将索引和约束名从植物系命名（soil_, root_, sys_, tree_）重构为常规B端命名（platform_, core_）

重命名规则：
- soil_ → platform_ (平台级基础设施)
- root_ → core_ (系统级核心功能)
- sys_ → core_ (系统级核心功能，统一为 core_)
- tree_ → platform_ (租户管理，归到平台级)

执行时间: 2025-01-04
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：重命名所有索引和约束
    """
    return """
        -- 数据库索引和约束重命名迁移
        -- 从植物系命名重构为常规B端命名
        
        -- ============================================
        -- 重命名索引
        -- ============================================
        -- 注意：索引名需要根据实际数据库中的索引名进行调整
        -- 以下是一些常见的索引重命名模式
        
        -- 平台级表索引 (soil_ → platform_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_soil_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_soil_', 'idx_platform_');
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
        
        -- 租户管理表索引 (tree_ → platform_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_tree_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_tree_', 'idx_platform_');
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
        
        -- 系统级表索引 (root_ → core_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_root_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_root_', 'idx_core_');
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
        
        -- 系统级表索引 (sys_ → core_)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND indexname LIKE 'idx_sys_%'
            LOOP
                new_name := REPLACE(idx_record.indexname, 'idx_sys_', 'idx_core_');
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
        
        -- 唯一索引 (uk_ 前缀)
        DO $$
        DECLARE
            idx_record RECORD;
            new_name TEXT;
        BEGIN
            FOR idx_record IN 
                SELECT indexname, tablename
                FROM pg_indexes 
                WHERE schemaname = 'public' 
                  AND (
                    indexname LIKE 'uk_soil_%' OR 
                    indexname LIKE 'uk_root_%' OR 
                    indexname LIKE 'uk_sys_%' OR 
                    indexname LIKE 'uk_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN idx_record.indexname LIKE 'uk_soil_%' THEN REPLACE(idx_record.indexname, 'uk_soil_', 'uk_platform_')
                    WHEN idx_record.indexname LIKE 'uk_root_%' THEN REPLACE(idx_record.indexname, 'uk_root_', 'uk_core_')
                    WHEN idx_record.indexname LIKE 'uk_sys_%' THEN REPLACE(idx_record.indexname, 'uk_sys_', 'uk_core_')
                    WHEN idx_record.indexname LIKE 'uk_tree_%' THEN REPLACE(idx_record.indexname, 'uk_tree_', 'uk_platform_')
                END;
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
        -- 重命名外键约束
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
                    conname LIKE '%_soil_%' OR 
                    conname LIKE '%_root_%' OR 
                    conname LIKE '%_sys_%' OR 
                    conname LIKE '%_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN con_record.conname LIKE '%_soil_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_soil_', '_platform_'), 'fk_soil_', 'fk_platform_'), 'uk_soil_', 'uk_platform_')
                    WHEN con_record.conname LIKE '%_root_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_root_', '_core_'), 'fk_root_', 'fk_core_'), 'uk_root_', 'uk_core_')
                    WHEN con_record.conname LIKE '%_sys_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_sys_', '_core_'), 'fk_sys_', 'fk_core_'), 'uk_sys_', 'uk_core_')
                    WHEN con_record.conname LIKE '%_tree_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_tree_', '_platform_'), 'fk_tree_', 'fk_platform_'), 'uk_tree_', 'uk_platform_')
                END;
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
        -- 重命名唯一约束
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
                    conname LIKE '%_soil_%' OR 
                    conname LIKE '%_root_%' OR 
                    conname LIKE '%_sys_%' OR 
                    conname LIKE '%_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN con_record.conname LIKE '%_soil_%' THEN REPLACE(con_record.conname, '_soil_', '_platform_')
                    WHEN con_record.conname LIKE '%_root_%' THEN REPLACE(con_record.conname, '_root_', '_core_')
                    WHEN con_record.conname LIKE '%_sys_%' THEN REPLACE(con_record.conname, '_sys_', '_core_')
                    WHEN con_record.conname LIKE '%_tree_%' THEN REPLACE(con_record.conname, '_tree_', '_platform_')
                END;
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
        -- 重命名检查约束
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
                    conname LIKE '%_soil_%' OR 
                    conname LIKE '%_root_%' OR 
                    conname LIKE '%_sys_%' OR 
                    conname LIKE '%_tree_%'
                  )
            LOOP
                new_name := CASE 
                    WHEN con_record.conname LIKE '%_soil_%' THEN REPLACE(con_record.conname, '_soil_', '_platform_')
                    WHEN con_record.conname LIKE '%_root_%' THEN REPLACE(con_record.conname, '_root_', '_core_')
                    WHEN con_record.conname LIKE '%_sys_%' THEN REPLACE(con_record.conname, '_sys_', '_core_')
                    WHEN con_record.conname LIKE '%_tree_%' THEN REPLACE(con_record.conname, '_tree_', '_platform_')
                END;
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
                    conname LIKE '%_platform_%' OR 
                    conname LIKE '%_core_%'
                  )
            LOOP
                EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                    con_record.table_name,
                    con_record.conname,
                    CASE 
                        WHEN con_record.conname LIKE '%_platform_%' AND con_record.conname NOT LIKE '%_tree_%' THEN REPLACE(con_record.conname, '_platform_', '_soil_')
                        WHEN con_record.conname LIKE '%_platform_%' THEN REPLACE(con_record.conname, '_platform_', '_tree_')
                        WHEN con_record.conname LIKE '%_core_%' AND con_record.conname LIKE '%_sys_%' THEN REPLACE(con_record.conname, '_core_', '_sys_')
                        WHEN con_record.conname LIKE '%_core_%' THEN REPLACE(con_record.conname, '_core_', '_root_')
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
                    conname LIKE '%_platform_%' OR 
                    conname LIKE '%_core_%'
                  )
            LOOP
                EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                    con_record.table_name,
                    con_record.conname,
                    CASE 
                        WHEN con_record.conname LIKE '%_platform_%' AND con_record.conname NOT LIKE '%_tree_%' THEN REPLACE(con_record.conname, '_platform_', '_soil_')
                        WHEN con_record.conname LIKE '%_platform_%' THEN REPLACE(con_record.conname, '_platform_', '_tree_')
                        WHEN con_record.conname LIKE '%_core_%' AND con_record.conname LIKE '%_sys_%' THEN REPLACE(con_record.conname, '_core_', '_sys_')
                        WHEN con_record.conname LIKE '%_core_%' THEN REPLACE(con_record.conname, '_core_', '_root_')
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
                    conname LIKE '%_platform_%' OR 
                    conname LIKE '%_core_%'
                  )
            LOOP
                EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', 
                    con_record.table_name,
                    con_record.conname,
                    CASE 
                        WHEN con_record.conname LIKE '%_platform_%' AND con_record.conname NOT LIKE '%_tree_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_platform_', '_soil_'), 'fk_platform_', 'fk_soil_'), 'uk_platform_', 'uk_soil_')
                        WHEN con_record.conname LIKE '%_platform_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_platform_', '_tree_'), 'fk_platform_', 'fk_tree_'), 'uk_platform_', 'uk_tree_')
                        WHEN con_record.conname LIKE '%_core_%' AND con_record.conname LIKE '%_sys_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_core_', '_sys_'), 'fk_core_', 'fk_sys_'), 'uk_core_', 'uk_sys_')
                        WHEN con_record.conname LIKE '%_core_%' THEN REPLACE(REPLACE(REPLACE(con_record.conname, '_core_', '_root_'), 'fk_core_', 'fk_root_'), 'uk_core_', 'uk_root_')
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
                    indexname LIKE 'idx_platform_%' OR 
                    indexname LIKE 'idx_core_%' OR
                    indexname LIKE 'uk_platform_%' OR 
                    indexname LIKE 'uk_core_%'
                  )
            LOOP
                EXECUTE format('ALTER INDEX IF EXISTS %I RENAME TO %I', 
                    idx_record.indexname,
                    CASE 
                        WHEN idx_record.indexname LIKE 'idx_platform_%' AND idx_record.indexname NOT LIKE '%_tree_%' THEN REPLACE(idx_record.indexname, 'idx_platform_', 'idx_soil_')
                        WHEN idx_record.indexname LIKE 'idx_platform_%' THEN REPLACE(idx_record.indexname, 'idx_platform_', 'idx_tree_')
                        WHEN idx_record.indexname LIKE 'idx_core_%' AND idx_record.indexname LIKE '%_sys_%' THEN REPLACE(idx_record.indexname, 'idx_core_', 'idx_sys_')
                        WHEN idx_record.indexname LIKE 'idx_core_%' THEN REPLACE(idx_record.indexname, 'idx_core_', 'idx_root_')
                        WHEN idx_record.indexname LIKE 'uk_platform_%' AND idx_record.indexname NOT LIKE '%_tree_%' THEN REPLACE(idx_record.indexname, 'uk_platform_', 'uk_soil_')
                        WHEN idx_record.indexname LIKE 'uk_platform_%' THEN REPLACE(idx_record.indexname, 'uk_platform_', 'uk_tree_')
                        WHEN idx_record.indexname LIKE 'uk_core_%' AND idx_record.indexname LIKE '%_sys_%' THEN REPLACE(idx_record.indexname, 'uk_core_', 'uk_sys_')
                        WHEN idx_record.indexname LIKE 'uk_core_%' THEN REPLACE(idx_record.indexname, 'uk_core_', 'uk_root_')
                    END
                );
            END LOOP;
        END $$;
    """

