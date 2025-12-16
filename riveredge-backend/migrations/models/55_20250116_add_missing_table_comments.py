"""
为缺少注释的表添加注释

此迁移为数据库中所有缺少 COMMENT ON TABLE 的表添加中文注释。

执行时间: 2025-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：为所有缺少注释的表添加 COMMENT ON TABLE
    """
    return """
        -- 为缺少注释的表添加 COMMENT ON TABLE
        
        -- ============================================
        -- 平台级表注释 (infra_)
        -- ============================================
        COMMENT ON TABLE "infra_superadmin" IS '平台超级管理员表';
        COMMENT ON TABLE "infra_tenants" IS '租户表';
        COMMENT ON TABLE "infra_tenant_configs" IS '租户配置表';
        COMMENT ON TABLE "infra_packages" IS '套餐表';
        
        -- ============================================
        -- 系统级表注释 (core_)
        -- ============================================
        COMMENT ON TABLE "core_users" IS '用户表';
        COMMENT ON TABLE "core_departments" IS '部门表';
        COMMENT ON TABLE "core_positions" IS '职位表';
        COMMENT ON TABLE "core_roles" IS '角色表';
        COMMENT ON TABLE "core_permissions" IS '权限表';
        COMMENT ON TABLE "core_role_permissions" IS '角色权限关联表';
        COMMENT ON TABLE "core_user_roles" IS '用户角色关联表';
        COMMENT ON TABLE "core_saved_searches" IS '保存的搜索表';
        COMMENT ON TABLE "core_data_dictionaries" IS '数据字典表';
        COMMENT ON TABLE "core_dictionary_items" IS '数据字典项表';
        COMMENT ON TABLE "core_system_parameters" IS '系统参数表';
        COMMENT ON TABLE "core_code_rules" IS '编码规则表';
        COMMENT ON TABLE "core_code_sequences" IS '编码序号表';
        COMMENT ON TABLE "core_languages" IS '语言表';
        COMMENT ON TABLE "core_site_settings" IS '站点设置表';
        COMMENT ON TABLE "core_invitation_codes" IS '邀请码表';
        COMMENT ON TABLE "core_custom_fields" IS '自定义字段表';
        COMMENT ON TABLE "core_custom_field_values" IS '自定义字段值表';
        COMMENT ON TABLE "core_applications" IS '应用表';
        COMMENT ON TABLE "core_integration_configs" IS '集成配置表';
        COMMENT ON TABLE "core_files" IS '文件表';
        COMMENT ON TABLE "core_apis" IS '接口表';
        COMMENT ON TABLE "core_data_sources" IS '数据源表';
        COMMENT ON TABLE "core_datasets" IS '数据集表';
        COMMENT ON TABLE "core_message_configs" IS '消息配置表';
        COMMENT ON TABLE "core_message_templates" IS '消息模板表';
        COMMENT ON TABLE "core_message_logs" IS '消息日志表';
        COMMENT ON TABLE "core_scheduled_tasks" IS '定时任务表';
        COMMENT ON TABLE "core_approval_processes" IS '审批流程表';
        COMMENT ON TABLE "core_approval_instances" IS '审批实例表';
        COMMENT ON TABLE "core_electronic_records" IS '电子记录表';
        COMMENT ON TABLE "core_scripts" IS '脚本表';
        COMMENT ON TABLE "core_print_templates" IS '打印模板表';
        COMMENT ON TABLE "core_print_devices" IS '打印设备表';
        COMMENT ON TABLE "core_user_preferences" IS '用户偏好表';
        COMMENT ON TABLE "core_operation_logs" IS '操作日志表';
        COMMENT ON TABLE "core_login_logs" IS '登录日志表';
        COMMENT ON TABLE "core_data_backups" IS '数据备份表';
        COMMENT ON TABLE "core_menus" IS '菜单表';
        
        -- ============================================
        -- 主数据管理表注释 (apps_master_data_)
        -- ============================================
        COMMENT ON TABLE "apps_master_data_materials" IS '物料表';
        COMMENT ON TABLE "apps_master_data_customers" IS '客户表';
        COMMENT ON TABLE "apps_master_data_suppliers" IS '供应商表';
        COMMENT ON TABLE "apps_master_data_products" IS '产品表';
        COMMENT ON TABLE "apps_master_data_workshops" IS '车间表';
        COMMENT ON TABLE "apps_master_data_production_lines" IS '生产线表';
        COMMENT ON TABLE "apps_master_data_workstations" IS '工作站表';
        COMMENT ON TABLE "apps_master_data_warehouses" IS '仓库表';
        COMMENT ON TABLE "apps_master_data_storage_areas" IS '存储区域表';
        COMMENT ON TABLE "apps_master_data_storage_locations" IS '存储位置表';
        COMMENT ON TABLE "apps_master_data_material_groups" IS '物料组表';
        COMMENT ON TABLE "apps_master_data_bom" IS 'BOM（物料清单）表';
        COMMENT ON TABLE "apps_master_data_defect_types" IS '缺陷类型表';
        COMMENT ON TABLE "apps_master_data_operations" IS '工序表';
        COMMENT ON TABLE "apps_master_data_process_routes" IS '工艺路线表';
        COMMENT ON TABLE "apps_master_data_sop" IS 'SOP（标准作业程序）表';
        COMMENT ON TABLE "apps_master_data_holidays" IS '节假日表';
        COMMENT ON TABLE "apps_master_data_skills" IS '技能表';
        COMMENT ON TABLE "apps_master_data_sop_executions" IS 'SOP执行记录表';
        
        -- ============================================
        -- 系统工具表注释
        -- ============================================
        COMMENT ON TABLE "aerich" IS 'Aerich 迁移工具表（用于跟踪数据库迁移历史）';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：删除注释（回滚）
    """
    return """
        -- 删除表注释（回滚）
        
        -- 主数据管理表
        COMMENT ON TABLE "apps_master_data_sop_executions" IS NULL;
        COMMENT ON TABLE "apps_master_data_skills" IS NULL;
        COMMENT ON TABLE "apps_master_data_holidays" IS NULL;
        COMMENT ON TABLE "apps_master_data_sop" IS NULL;
        COMMENT ON TABLE "apps_master_data_process_routes" IS NULL;
        COMMENT ON TABLE "apps_master_data_operations" IS NULL;
        COMMENT ON TABLE "apps_master_data_defect_types" IS NULL;
        COMMENT ON TABLE "apps_master_data_bom" IS NULL;
        COMMENT ON TABLE "apps_master_data_material_groups" IS NULL;
        COMMENT ON TABLE "apps_master_data_storage_locations" IS NULL;
        COMMENT ON TABLE "apps_master_data_storage_areas" IS NULL;
        COMMENT ON TABLE "apps_master_data_warehouses" IS NULL;
        COMMENT ON TABLE "apps_master_data_workstations" IS NULL;
        COMMENT ON TABLE "apps_master_data_workshops" IS NULL;
        COMMENT ON TABLE "apps_master_data_production_lines" IS NULL;
        COMMENT ON TABLE "apps_master_data_products" IS NULL;
        COMMENT ON TABLE "apps_master_data_suppliers" IS NULL;
        COMMENT ON TABLE "apps_master_data_customers" IS NULL;
        COMMENT ON TABLE "apps_master_data_materials" IS NULL;
        
        -- 系统级表
        COMMENT ON TABLE "core_menus" IS NULL;
        COMMENT ON TABLE "core_data_backups" IS NULL;
        COMMENT ON TABLE "core_login_logs" IS NULL;
        COMMENT ON TABLE "core_operation_logs" IS NULL;
        COMMENT ON TABLE "core_user_preferences" IS NULL;
        COMMENT ON TABLE "core_print_devices" IS NULL;
        COMMENT ON TABLE "core_print_templates" IS NULL;
        COMMENT ON TABLE "core_scripts" IS NULL;
        COMMENT ON TABLE "core_electronic_records" IS NULL;
        COMMENT ON TABLE "core_approval_instances" IS NULL;
        COMMENT ON TABLE "core_approval_processes" IS NULL;
        COMMENT ON TABLE "core_scheduled_tasks" IS NULL;
        COMMENT ON TABLE "core_message_logs" IS NULL;
        COMMENT ON TABLE "core_message_templates" IS NULL;
        COMMENT ON TABLE "core_message_configs" IS NULL;
        COMMENT ON TABLE "core_datasets" IS NULL;
        COMMENT ON TABLE "core_data_sources" IS NULL;
        COMMENT ON TABLE "core_apis" IS NULL;
        COMMENT ON TABLE "core_files" IS NULL;
        COMMENT ON TABLE "core_integration_configs" IS NULL;
        COMMENT ON TABLE "core_applications" IS NULL;
        COMMENT ON TABLE "core_custom_field_values" IS NULL;
        COMMENT ON TABLE "core_custom_fields" IS NULL;
        COMMENT ON TABLE "core_invitation_codes" IS NULL;
        COMMENT ON TABLE "core_site_settings" IS NULL;
        COMMENT ON TABLE "core_languages" IS NULL;
        COMMENT ON TABLE "core_code_sequences" IS NULL;
        COMMENT ON TABLE "core_code_rules" IS NULL;
        COMMENT ON TABLE "core_system_parameters" IS NULL;
        COMMENT ON TABLE "core_dictionary_items" IS NULL;
        COMMENT ON TABLE "core_data_dictionaries" IS NULL;
        COMMENT ON TABLE "core_saved_searches" IS NULL;
        COMMENT ON TABLE "core_user_roles" IS NULL;
        COMMENT ON TABLE "core_role_permissions" IS NULL;
        COMMENT ON TABLE "core_permissions" IS NULL;
        COMMENT ON TABLE "core_roles" IS NULL;
        COMMENT ON TABLE "core_positions" IS NULL;
        COMMENT ON TABLE "core_departments" IS NULL;
        COMMENT ON TABLE "core_users" IS NULL;
        
        -- 平台级表
        COMMENT ON TABLE "infra_tenants" IS NULL;
        COMMENT ON TABLE "infra_tenant_configs" IS NULL;
        COMMENT ON TABLE "infra_packages" IS NULL;
        COMMENT ON TABLE "infra_superadmin" IS NULL;
        
        -- 系统工具表
        COMMENT ON TABLE "aerich" IS NULL;
    """

