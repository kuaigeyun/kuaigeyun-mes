#!/usr/bin/env python3
"""
数据库表重命名脚本
从植物系命名（soil_, root_, sys_）重构为常规B端命名（platform_, core_）

使用方法:
    python rename_database_tables.py [--dry-run] [--generate-sql] [--apply]

选项:
    --dry-run      预览模式，不实际执行
    --generate-sql 生成 SQL 迁移脚本
    --apply        应用更改（需要先生成 SQL）
"""

import os
import re
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Tuple

# 表名重命名映射
TABLE_RENAMES: List[Tuple[str, str, str]] = [
    # (旧表名, 新表名, 说明)
    # 平台级表
    ('soil_platform_superadmin', 'platform_superadmin', '平台超级管理员'),
    ('soil_packages', 'platform_packages', '套餐表'),
    # 租户管理表（归到平台级）
    ('tree_tenants', 'platform_tenants', '组织表'),
    ('tree_tenant_configs', 'platform_tenant_configs', '组织配置表'),
    ('tree_tenant_activity_logs', 'platform_tenant_activity_logs', '组织活动日志表'),
    
    # 系统级表 - root_ → core_
    ('root_menus', 'core_menus', '菜单表'),
    ('root_approval_instances', 'core_approval_instances', '审批实例表'),
    ('root_login_logs', 'core_login_logs', '登录日志表'),
    ('root_operation_logs', 'core_operation_logs', '操作日志表'),
    ('root_message_logs', 'core_message_logs', '消息日志表'),
    ('root_data_backups', 'core_data_backups', '数据备份表'),
    ('root_user_preferences', 'core_user_preferences', '用户偏好表'),
    ('root_print_devices', 'core_print_devices', '打印设备表'),
    ('root_print_templates', 'core_print_templates', '打印模板表'),
    ('root_scripts', 'core_scripts', '脚本表'),
    ('root_electronic_records', 'core_electronic_records', '电子记录表'),
    ('root_approval_processes', 'core_approval_processes', '审批流程表'),
    ('root_scheduled_tasks', 'core_scheduled_tasks', '定时任务表'),
    ('root_message_configs', 'core_message_configs', '消息配置表'),
    ('root_message_templates', 'core_message_templates', '消息模板表'),
    ('root_datasets', 'core_datasets', '数据集表'),
    ('root_data_sources', 'core_data_sources', '数据源表'),
    ('root_apis', 'core_apis', 'API表'),
    ('root_files', 'core_files', '文件表'),
    ('root_integration_configs', 'core_integration_configs', '集成配置表'),
    ('root_applications', 'core_applications', '应用表'),
    
    # 系统级表 - sys_ → core_
    ('sys_users', 'core_users', '用户表'),
    ('sys_saved_searches', 'core_saved_searches', '保存的搜索表'),
    ('sys_data_dictionaries', 'core_data_dictionaries', '数据字典表'),
    ('sys_languages', 'core_languages', '语言表'),
    ('sys_site_settings', 'core_site_settings', '站点设置表'),
    ('sys_invitation_codes', 'core_invitation_codes', '邀请码表'),
    ('sys_custom_field_values', 'core_custom_field_values', '自定义字段值表'),
    ('sys_custom_fields', 'core_custom_fields', '自定义字段表'),
    ('sys_code_rules', 'core_code_rules', '编码规则表'),
    ('sys_code_sequences', 'core_code_sequences', '编码序列表'),
    ('sys_system_parameters', 'core_system_parameters', '系统参数表'),
    ('sys_dictionary_items', 'core_dictionary_items', '字典项表'),
    ('sys_departments', 'core_departments', '部门表'),
    ('sys_roles', 'core_roles', '角色表'),
    ('sys_positions', 'core_positions', '职位表'),
    ('sys_permissions', 'core_permissions', '权限表'),
    ('sys_role_permissions', 'core_role_permissions', '角色权限关联表'),
    ('sys_user_roles', 'core_user_roles', '用户角色关联表'),
]

# 模型文件路径映射
MODEL_FILE_MAPPING: Dict[str, str] = {
    'soil_platform_superadmin': 'platform/models/platform_superadmin.py',
    'soil_packages': 'platform/models/package.py',
    'sys_users': 'platform/models/user.py',
    'sys_saved_searches': 'platform/models/saved_search.py',
    'tree_tenants': 'platform/models/tenant.py',
    'tree_tenant_configs': 'platform/models/tenant_config.py',
    'tree_tenant_activity_logs': 'platform/models/tenant_activity_log.py',
    # core 模型
    'root_menus': 'core/models/menu.py',
    'root_approval_instances': 'core/models/approval_instance.py',
    'root_login_logs': 'core/models/login_log.py',
    'root_operation_logs': 'core/models/operation_log.py',
    'root_message_logs': 'core/models/message_log.py',
    'root_data_backups': 'core/models/data_backup.py',
    'root_user_preferences': 'core/models/user_preference.py',
    'root_print_devices': 'core/models/print_device.py',
    'root_print_templates': 'core/models/print_template.py',
    'root_scripts': 'core/models/script.py',
    'root_electronic_records': 'core/models/electronic_record.py',
    'root_approval_processes': 'core/models/approval_process.py',
    'root_scheduled_tasks': 'core/models/scheduled_task.py',
    'root_message_configs': 'core/models/message_config.py',
    'root_message_templates': 'core/models/message_template.py',
    'root_datasets': 'core/models/dataset.py',
    'root_data_sources': 'core/models/data_source.py',
    'root_apis': 'core/models/api.py',
    'root_files': 'core/models/file.py',
    'root_integration_configs': 'core/models/integration_config.py',
    'root_applications': 'core/models/application.py',
    'sys_data_dictionaries': 'core/models/data_dictionary.py',
    'sys_languages': 'core/models/language.py',
    'sys_site_settings': 'core/models/site_setting.py',
    'sys_invitation_codes': 'core/models/invitation_code.py',
    'sys_custom_field_values': 'core/models/custom_field_value.py',
    'sys_custom_fields': 'core/models/custom_field.py',
    'sys_code_rules': 'core/models/code_rule.py',
    'sys_code_sequences': 'core/models/code_sequence.py',
    'sys_system_parameters': 'core/models/system_parameter.py',
    'sys_dictionary_items': 'core/models/dictionary_item.py',
    'sys_departments': 'core/models/department.py',
    'sys_roles': 'core/models/role.py',
    'sys_positions': 'core/models/position.py',
    'sys_permissions': 'core/models/permission.py',
    'sys_role_permissions': 'core/models/role_permission.py',
    'sys_user_roles': 'core/models/user_role.py',
}


def generate_sql_migration() -> str:
    """生成 SQL 迁移脚本"""
    sql_lines = [
        "-- 数据库表重命名迁移脚本",
        "-- 从植物系命名重构为常规B端命名",
        "-- 生成时间: 2025-01-04",
        "",
        "BEGIN;",
        "",
    ]
    
    # 生成表重命名语句
    for old_name, new_name, description in TABLE_RENAMES:
        sql_lines.append(f"-- {description}")
        sql_lines.append(f'ALTER TABLE "{old_name}" RENAME TO "{new_name}";')
        sql_lines.append("")
    
    # 生成索引重命名语句（需要根据实际索引名调整）
    sql_lines.append("-- 重命名索引（需要根据实际索引名调整）")
    for old_name, new_name, _ in TABLE_RENAMES:
        # 假设索引命名格式为 idx_表名_字段名
        # 这里只生成示例，实际需要查询数据库获取所有索引
        old_prefix = old_name.split('_')[0]
        new_prefix = new_name.split('_')[0]
        if old_prefix != new_prefix:
            sql_lines.append(f"-- 重命名 {old_name} 相关索引")
            sql_lines.append(f"-- ALTER INDEX \"idx_{old_name}_xxx\" RENAME TO \"idx_{new_name}_xxx\";")
            sql_lines.append("")
    
    sql_lines.append("COMMIT;")
    
    return "\n".join(sql_lines)


def update_model_files(project_root: Path, dry_run: bool = False) -> int:
    """更新模型文件中的表名"""
    updated_count = 0
    
    for old_name, new_name, description in TABLE_RENAMES:
        model_file = project_root / "riveredge-backend" / "src" / MODEL_FILE_MAPPING.get(old_name, "")
        
        if not model_file.exists():
            print(f"⚠️  模型文件不存在: {model_file}")
            continue
        
        try:
            content = model_file.read_text(encoding='utf-8')
            original_content = content
            
            # 替换表名定义
            # 匹配 table = "old_name" 或 table = 'old_name'
            pattern = rf'table\s*=\s*["\']{re.escape(old_name)}["\']'
            replacement = f'table = "{new_name}"'
            
            if re.search(pattern, content):
                content = re.sub(pattern, replacement, content)
                
                if content != original_content:
                    if not dry_run:
                        model_file.write_text(content, encoding='utf-8')
                        print(f"✅ 更新: {model_file.name} - {old_name} → {new_name}")
                    else:
                        print(f"🔍 将更新: {model_file.name} - {old_name} → {new_name}")
                    updated_count += 1
        except Exception as e:
            print(f"❌ 错误: {model_file} - {e}", file=sys.stderr)
    
    return updated_count


def main():
    parser = argparse.ArgumentParser(
        description='数据库表重命名工具',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--dry-run', action='store_true', help='预览模式')
    parser.add_argument('--generate-sql', action='store_true', help='生成 SQL 迁移脚本')
    parser.add_argument('--apply', action='store_true', help='应用更改（更新模型文件）')
    parser.add_argument('--output', type=str, default='rename_tables.sql', help='SQL 输出文件')
    
    args = parser.parse_args()
    
    project_root = Path(__file__).parent.parent.parent
    
    print("=" * 60)
    print("🔄 数据库表重命名工具")
    print("=" * 60)
    print(f"需要重命名的表数: {len(TABLE_RENAMES)}")
    print("=" * 60)
    
    if args.generate_sql:
        sql_content = generate_sql_migration()
        output_file = project_root / args.output
        
        if not args.dry_run:
            output_file.write_text(sql_content, encoding='utf-8')
            print(f"\n✅ SQL 迁移脚本已生成: {output_file}")
        else:
            print("\n🔍 [预览] SQL 迁移脚本内容:")
            print(sql_content)
    
    if args.apply:
        print("\n📝 更新模型文件...")
        updated = update_model_files(project_root, dry_run=args.dry_run)
        print(f"\n📊 更新了 {updated} 个模型文件")
        
        if args.dry_run:
            print("\n⚠️  这是预览模式，未实际修改文件")
    
    if not args.generate_sql and not args.apply:
        print("\n请指定操作:")
        print("  --generate-sql  生成 SQL 迁移脚本")
        print("  --apply        更新模型文件")


if __name__ == '__main__':
    main()

