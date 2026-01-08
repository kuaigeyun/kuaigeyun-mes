-- 添加 process_route 外键字段到物料分组和物料表
-- 执行日期: 2026-01-07
-- 说明: 为物料分组和物料表添加工艺路线绑定字段

-- 1. 为物料分组表添加 process_route_id 字段
ALTER TABLE apps_master_data_material_groups
ADD COLUMN IF NOT EXISTS process_route_id INTEGER NULL;

-- 添加外键约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_apps_master_data_material_groups_process_route'
    ) THEN
        ALTER TABLE apps_master_data_material_groups
        ADD CONSTRAINT fk_apps_master_data_material_groups_process_route
        FOREIGN KEY (process_route_id) 
        REFERENCES apps_master_data_process_routes(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_material_groups_process_route_id 
ON apps_master_data_material_groups(process_route_id);

-- 2. 为物料表添加 process_route_id 字段
ALTER TABLE apps_master_data_materials
ADD COLUMN IF NOT EXISTS process_route_id INTEGER NULL;

-- 添加外键约束
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_apps_master_data_materials_process_route'
    ) THEN
        ALTER TABLE apps_master_data_materials
        ADD CONSTRAINT fk_apps_master_data_materials_process_route
        FOREIGN KEY (process_route_id) 
        REFERENCES apps_master_data_process_routes(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_materials_process_route_id 
ON apps_master_data_materials(process_route_id);

-- 添加字段注释
COMMENT ON COLUMN apps_master_data_material_groups.process_route_id IS '绑定的工艺路线ID（分组级别，物料未绑定时使用）';
COMMENT ON COLUMN apps_master_data_materials.process_route_id IS '绑定的工艺路线ID（物料级别，优先级最高）';



