"""
数据库表重命名迁移 - 统一为最新命名规范

此迁移将表名从旧规范统一为新规范：
- platform_ → infra_ (平台级，对应 infra/ 文件夹)
- seed_ → apps_ (应用级，对应 apps/ 文件夹)
- sys_ → core_ (系统级，对应 core/ 文件夹，兼容别名)

执行时间: 2025-01-16
"""

from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    """
    升级：重命名所有表到新规范
    """
    return """
        -- 数据库表重命名迁移
        -- 统一为最新命名规范（platform_ → infra_, seed_ → apps_）
        
        -- ============================================
        -- 平台级表重命名 (platform_ → infra_)
        -- ============================================
        ALTER TABLE IF EXISTS "platform_superadmin" RENAME TO "infra_superadmin";
        ALTER TABLE IF EXISTS "platform_tenants" RENAME TO "infra_tenants";
        ALTER TABLE IF EXISTS "platform_tenant_configs" RENAME TO "infra_tenant_configs";
        ALTER TABLE IF EXISTS "platform_tenant_activity_logs" RENAME TO "infra_tenant_activity_logs";
        ALTER TABLE IF EXISTS "platform_packages" RENAME TO "infra_packages";
        
        -- ============================================
        -- 应用级表重命名 (seed_ → apps_)
        -- ============================================
        -- MES 相关表
        ALTER TABLE IF EXISTS "seed_kuaimes_orders" RENAME TO "apps_kuaimes_orders";
        ALTER TABLE IF EXISTS "seed_kuaimes_work_orders" RENAME TO "apps_kuaimes_work_orders";
        ALTER TABLE IF EXISTS "seed_kuaimes_production_reports" RENAME TO "apps_kuaimes_production_reports";
        ALTER TABLE IF EXISTS "seed_kuaimes_traceabilities" RENAME TO "apps_kuaimes_traceabilities";
        ALTER TABLE IF EXISTS "seed_kuaimes_rework_orders" RENAME TO "apps_kuaimes_rework_orders";
        
        -- QMS 相关表
        ALTER TABLE IF EXISTS "seed_kuaiqms_inspection_tasks" RENAME TO "apps_kuaiqms_inspection_tasks";
        ALTER TABLE IF EXISTS "seed_kuaiqms_inspection_records" RENAME TO "apps_kuaiqms_inspection_records";
        ALTER TABLE IF EXISTS "seed_kuaiqms_nonconforming_products" RENAME TO "apps_kuaiqms_nonconforming_products";
        ALTER TABLE IF EXISTS "seed_kuaiqms_nonconforming_handlings" RENAME TO "apps_kuaiqms_nonconforming_handlings";
        ALTER TABLE IF EXISTS "seed_kuaiqms_quality_traceabilities" RENAME TO "apps_kuaiqms_quality_traceabilities";
        ALTER TABLE IF EXISTS "seed_kuaiqms_iso_audits" RENAME TO "apps_kuaiqms_iso_audits";
        ALTER TABLE IF EXISTS "seed_kuaiqms_capas" RENAME TO "apps_kuaiqms_capas";
        ALTER TABLE IF EXISTS "seed_kuaiqms_continuous_improvements" RENAME TO "apps_kuaiqms_continuous_improvements";
        ALTER TABLE IF EXISTS "seed_kuaiqms_quality_objectives" RENAME TO "apps_kuaiqms_quality_objectives";
        ALTER TABLE IF EXISTS "seed_kuaiqms_quality_indicators" RENAME TO "apps_kuaiqms_quality_indicators";
        
        -- EAM 相关表
        ALTER TABLE IF EXISTS "seed_kuaieam_maintenance_plans" RENAME TO "apps_kuaieam_maintenance_plans";
        ALTER TABLE IF EXISTS "seed_kuaieam_maintenance_workorders" RENAME TO "apps_kuaieam_maintenance_workorders";
        ALTER TABLE IF EXISTS "seed_kuaieam_maintenance_executions" RENAME TO "apps_kuaieam_maintenance_executions";
        ALTER TABLE IF EXISTS "seed_kuaieam_failure_reports" RENAME TO "apps_kuaieam_failure_reports";
        ALTER TABLE IF EXISTS "seed_kuaieam_failure_handlings" RENAME TO "apps_kuaieam_failure_handlings";
        ALTER TABLE IF EXISTS "seed_kuaieam_spare_part_demands" RENAME TO "apps_kuaieam_spare_part_demands";
        ALTER TABLE IF EXISTS "seed_kuaieam_spare_part_purchases" RENAME TO "apps_kuaieam_spare_part_purchases";
        ALTER TABLE IF EXISTS "seed_kuaieam_tooling_usages" RENAME TO "apps_kuaieam_tooling_usages";
        ALTER TABLE IF EXISTS "seed_kuaieam_mold_usages" RENAME TO "apps_kuaieam_mold_usages";
        
        -- ============================================
        -- 系统级表重命名 (sys_ → core_，兼容别名)
        -- ============================================
        -- 注意：如果表已经是 core_ 前缀，则跳过
        -- 以下只处理可能存在的 sys_ 前缀表（兼容旧数据）
        ALTER TABLE IF EXISTS "sys_users" RENAME TO "core_users";
        ALTER TABLE IF EXISTS "sys_saved_searches" RENAME TO "core_saved_searches";
        ALTER TABLE IF EXISTS "sys_data_dictionaries" RENAME TO "core_data_dictionaries";
        ALTER TABLE IF EXISTS "sys_languages" RENAME TO "core_languages";
        ALTER TABLE IF EXISTS "sys_site_settings" RENAME TO "core_site_settings";
        ALTER TABLE IF EXISTS "sys_invitation_codes" RENAME TO "core_invitation_codes";
        ALTER TABLE IF EXISTS "sys_custom_field_values" RENAME TO "core_custom_field_values";
        ALTER TABLE IF EXISTS "sys_custom_fields" RENAME TO "core_custom_fields";
        ALTER TABLE IF EXISTS "sys_code_rules" RENAME TO "core_code_rules";
        ALTER TABLE IF EXISTS "sys_code_sequences" RENAME TO "core_code_sequences";
        ALTER TABLE IF EXISTS "sys_system_parameters" RENAME TO "core_system_parameters";
        ALTER TABLE IF EXISTS "sys_dictionary_items" RENAME TO "core_dictionary_items";
        ALTER TABLE IF EXISTS "sys_departments" RENAME TO "core_departments";
        ALTER TABLE IF EXISTS "sys_roles" RENAME TO "core_roles";
        ALTER TABLE IF EXISTS "sys_positions" RENAME TO "core_positions";
        ALTER TABLE IF EXISTS "sys_permissions" RENAME TO "core_permissions";
        ALTER TABLE IF EXISTS "sys_role_permissions" RENAME TO "core_role_permissions";
        ALTER TABLE IF EXISTS "sys_user_roles" RENAME TO "core_user_roles";
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    """
    降级：反向重命名（回滚）
    """
    return """
        -- 反向重命名（回滚）
        
        -- 系统级表 (core_ → sys_)
        ALTER TABLE IF EXISTS "core_users" RENAME TO "sys_users";
        ALTER TABLE IF EXISTS "core_saved_searches" RENAME TO "sys_saved_searches";
        ALTER TABLE IF EXISTS "core_data_dictionaries" RENAME TO "sys_data_dictionaries";
        ALTER TABLE IF EXISTS "core_languages" RENAME TO "sys_languages";
        ALTER TABLE IF EXISTS "core_site_settings" RENAME TO "sys_site_settings";
        ALTER TABLE IF EXISTS "core_invitation_codes" RENAME TO "sys_invitation_codes";
        ALTER TABLE IF EXISTS "core_custom_field_values" RENAME TO "sys_custom_field_values";
        ALTER TABLE IF EXISTS "core_custom_fields" RENAME TO "sys_custom_fields";
        ALTER TABLE IF EXISTS "core_code_rules" RENAME TO "sys_code_rules";
        ALTER TABLE IF EXISTS "core_code_sequences" RENAME TO "sys_code_sequences";
        ALTER TABLE IF EXISTS "core_system_parameters" RENAME TO "sys_system_parameters";
        ALTER TABLE IF EXISTS "core_dictionary_items" RENAME TO "sys_dictionary_items";
        ALTER TABLE IF EXISTS "core_departments" RENAME TO "sys_departments";
        ALTER TABLE IF EXISTS "core_roles" RENAME TO "sys_roles";
        ALTER TABLE IF EXISTS "core_positions" RENAME TO "sys_positions";
        ALTER TABLE IF EXISTS "core_permissions" RENAME TO "sys_permissions";
        ALTER TABLE IF EXISTS "core_role_permissions" RENAME TO "sys_role_permissions";
        ALTER TABLE IF EXISTS "core_user_roles" RENAME TO "sys_user_roles";
        
        -- 应用级表 (apps_ → seed_)
        ALTER TABLE IF EXISTS "apps_kuaimes_orders" RENAME TO "seed_kuaimes_orders";
        ALTER TABLE IF EXISTS "apps_kuaimes_work_orders" RENAME TO "seed_kuaimes_work_orders";
        ALTER TABLE IF EXISTS "apps_kuaimes_production_reports" RENAME TO "seed_kuaimes_production_reports";
        ALTER TABLE IF EXISTS "apps_kuaimes_traceabilities" RENAME TO "seed_kuaimes_traceabilities";
        ALTER TABLE IF EXISTS "apps_kuaimes_rework_orders" RENAME TO "seed_kuaimes_rework_orders";
        ALTER TABLE IF EXISTS "apps_kuaiqms_inspection_tasks" RENAME TO "seed_kuaiqms_inspection_tasks";
        ALTER TABLE IF EXISTS "apps_kuaiqms_inspection_records" RENAME TO "seed_kuaiqms_inspection_records";
        ALTER TABLE IF EXISTS "apps_kuaiqms_nonconforming_products" RENAME TO "seed_kuaiqms_nonconforming_products";
        ALTER TABLE IF EXISTS "apps_kuaiqms_nonconforming_handlings" RENAME TO "seed_kuaiqms_nonconforming_handlings";
        ALTER TABLE IF EXISTS "apps_kuaiqms_quality_traceabilities" RENAME TO "seed_kuaiqms_quality_traceabilities";
        ALTER TABLE IF EXISTS "apps_kuaiqms_iso_audits" RENAME TO "seed_kuaiqms_iso_audits";
        ALTER TABLE IF EXISTS "apps_kuaiqms_capas" RENAME TO "seed_kuaiqms_capas";
        ALTER TABLE IF EXISTS "apps_kuaiqms_continuous_improvements" RENAME TO "seed_kuaiqms_continuous_improvements";
        ALTER TABLE IF EXISTS "apps_kuaiqms_quality_objectives" RENAME TO "seed_kuaiqms_quality_objectives";
        ALTER TABLE IF EXISTS "apps_kuaiqms_quality_indicators" RENAME TO "seed_kuaiqms_quality_indicators";
        ALTER TABLE IF EXISTS "apps_kuaieam_maintenance_plans" RENAME TO "seed_kuaieam_maintenance_plans";
        ALTER TABLE IF EXISTS "apps_kuaieam_maintenance_workorders" RENAME TO "seed_kuaieam_maintenance_workorders";
        ALTER TABLE IF EXISTS "apps_kuaieam_maintenance_executions" RENAME TO "seed_kuaieam_maintenance_executions";
        ALTER TABLE IF EXISTS "apps_kuaieam_failure_reports" RENAME TO "seed_kuaieam_failure_reports";
        ALTER TABLE IF EXISTS "apps_kuaieam_failure_handlings" RENAME TO "seed_kuaieam_failure_handlings";
        ALTER TABLE IF EXISTS "apps_kuaieam_spare_part_demands" RENAME TO "seed_kuaieam_spare_part_demands";
        ALTER TABLE IF EXISTS "apps_kuaieam_spare_part_purchases" RENAME TO "seed_kuaieam_spare_part_purchases";
        ALTER TABLE IF EXISTS "apps_kuaieam_tooling_usages" RENAME TO "seed_kuaieam_tooling_usages";
        ALTER TABLE IF EXISTS "apps_kuaieam_mold_usages" RENAME TO "seed_kuaieam_mold_usages";
        
        -- 平台级表 (infra_ → platform_)
        ALTER TABLE IF EXISTS "infra_superadmin" RENAME TO "platform_superadmin";
        ALTER TABLE IF EXISTS "infra_tenants" RENAME TO "platform_tenants";
        ALTER TABLE IF EXISTS "infra_tenant_configs" RENAME TO "platform_tenant_configs";
        ALTER TABLE IF EXISTS "infra_tenant_activity_logs" RENAME TO "platform_tenant_activity_logs";
        ALTER TABLE IF EXISTS "infra_packages" RENAME TO "platform_packages";
    """

