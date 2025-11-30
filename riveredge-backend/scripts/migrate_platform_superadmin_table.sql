-- 迁移平台超级管理员表名
-- 从 root_platform_superadmin 改为 soil_platform_superadmin

-- 检查旧表是否存在
DO $$
BEGIN
    -- 如果旧表存在，重命名
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'root_platform_superadmin'
    ) THEN
        -- 重命名表
        ALTER TABLE root_platform_superadmin RENAME TO soil_platform_superadmin;
        RAISE NOTICE '表 root_platform_superadmin 已重命名为 soil_platform_superadmin';
    ELSE
        RAISE NOTICE '表 root_platform_superadmin 不存在，跳过重命名';
    END IF;
    
    -- 如果新表已存在，跳过
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'soil_platform_superadmin'
    ) THEN
        RAISE NOTICE '表 soil_platform_superadmin 已存在';
    END IF;
END $$;

