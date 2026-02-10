"""
数据库迁移：创建工艺路线模板表

创建 apps_master_data_process_route_templates 表，用于保存常用工艺路线作为模板。

Author: Luigi Lu
Date: 2026-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    执行迁移：创建工艺路线模板表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 创建工艺路线模板表
        CREATE TABLE IF NOT EXISTS apps_master_data_process_route_templates (
            id SERIAL PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL UNIQUE,
            tenant_id INTEGER NOT NULL,
            code VARCHAR(50) NOT NULL,
            name VARCHAR(200) NOT NULL,
            category VARCHAR(50),
            description TEXT,
            scope VARCHAR(20) NOT NULL DEFAULT 'all_materials',
            scope_groups JSONB,
            process_route_config JSONB,
            version VARCHAR(20) NOT NULL DEFAULT '1.0',
            version_description TEXT,
            base_version VARCHAR(20),
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMPTZ,
            CONSTRAINT unique_tenant_code_version UNIQUE (tenant_id, code, version)
        );
        
        -- 添加注释
        COMMENT ON TABLE apps_master_data_process_route_templates IS '工艺路线模板表，用于保存常用工艺路线作为模板';
        COMMENT ON COLUMN apps_master_data_process_route_templates.id IS '主键ID（自增ID，内部使用）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.uuid IS '业务ID（UUID，对外暴露，安全且唯一）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.tenant_id IS '组织ID（用于多组织数据隔离）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.code IS '模板编码（组织内唯一）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.name IS '模板名称';
        COMMENT ON COLUMN apps_master_data_process_route_templates.category IS '模板分类（如：注塑类、组装类、包装类等）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.description IS '模板描述';
        COMMENT ON COLUMN apps_master_data_process_route_templates.scope IS '适用范围（all_materials:所有物料, all_groups:所有物料分组, specific_groups:特定物料分组）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.scope_groups IS '适用范围物料分组列表（JSON格式，当scope为specific_groups时使用）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.process_route_config IS '工艺路线配置（JSON格式，包含工序顺序、标准工时、SOP关联、跳转规则等）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.version IS '模板版本号';
        COMMENT ON COLUMN apps_master_data_process_route_templates.version_description IS '版本说明';
        COMMENT ON COLUMN apps_master_data_process_route_templates.base_version IS '基于版本（从哪个版本创建）';
        COMMENT ON COLUMN apps_master_data_process_route_templates.is_active IS '是否启用';
        COMMENT ON COLUMN apps_master_data_process_route_templates.created_at IS '创建时间';
        COMMENT ON COLUMN apps_master_data_process_route_templates.updated_at IS '更新时间';
        COMMENT ON COLUMN apps_master_data_process_route_templates.deleted_at IS '删除时间（软删除）';
        
        -- 创建索引
        CREATE INDEX IF NOT EXISTS idx_process_route_templates_tenant_id 
        ON apps_master_data_process_route_templates(tenant_id);
        
        CREATE INDEX IF NOT EXISTS idx_process_route_templates_code 
        ON apps_master_data_process_route_templates(code);
        
        CREATE INDEX IF NOT EXISTS idx_process_route_templates_uuid 
        ON apps_master_data_process_route_templates(uuid);
        
        CREATE INDEX IF NOT EXISTS idx_process_route_templates_category 
        ON apps_master_data_process_route_templates(category);
        
        CREATE INDEX IF NOT EXISTS idx_process_route_templates_version 
        ON apps_master_data_process_route_templates(version);
        
        CREATE INDEX IF NOT EXISTS idx_process_route_templates_is_active 
        ON apps_master_data_process_route_templates(is_active);
        
        -- 创建序列（如果需要）
        CREATE SEQUENCE IF NOT EXISTS apps_master_data_process_route_templates_id_seq
        OWNED BY apps_master_data_process_route_templates.id;
        
        -- 设置序列的当前值
        SELECT setval('apps_master_data_process_route_templates_id_seq', 
                      COALESCE((SELECT MAX(id) FROM apps_master_data_process_route_templates), 1), 
                      false);
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    回滚迁移：删除工艺路线模板表
    
    Args:
        db: 数据库连接
        
    Returns:
        str: SQL 语句
    """
    return """
        -- 删除索引
        DROP INDEX IF EXISTS idx_process_route_templates_is_active;
        DROP INDEX IF EXISTS idx_process_route_templates_version;
        DROP INDEX IF EXISTS idx_process_route_templates_category;
        DROP INDEX IF EXISTS idx_process_route_templates_uuid;
        DROP INDEX IF EXISTS idx_process_route_templates_code;
        DROP INDEX IF EXISTS idx_process_route_templates_tenant_id;
        
        -- 删除序列
        DROP SEQUENCE IF EXISTS apps_master_data_process_route_templates_id_seq;
        
        -- 删除表
        DROP TABLE IF EXISTS apps_master_data_process_route_templates;
    """
