"""
制造业默认数据初始化脚本 - SQL版本

使用原生SQL绕过Tortoise ORM的时区问题
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from platform.infrastructure.database.database import get_db_connection

# 默认部门数据
DEPARTMENTS_SQL = [
    # 根部门
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '生产部', 'PROD', '生产制造部门', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '质量部', 'QUALITY', '质量管理部门', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '采购部', 'PURCHASE', '采购部门', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '销售部', 'SALES', '销售部门', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '仓储部', 'WAREHOUSE', '仓储部门', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '财务部', 'FINANCE', '财务部门', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '人事部', 'HR', '人事部门', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '研发部', 'R&D', '研发部门', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_departments (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '行政部', 'ADMIN', '行政部门', 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
]

# 默认职位数据
POSITIONS_SQL = [
    "INSERT INTO sys_positions (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '总经理', 'GM', '公司总经理', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_positions (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '副总经理', 'DGM', '公司副总经理', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_positions (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '生产经理', 'PROD_MGR', '生产部门负责人', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_positions (uuid, tenant_id, name, code, description, sort_order, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '质量经理', 'QUALITY_MGR', '质量部门负责人', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
]

# 默认角色数据
ROLES_SQL = [
    "INSERT INTO sys_roles (uuid, tenant_id, name, code, description, is_system, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '系统管理员', 'SYSTEM_ADMIN', '系统最高权限，可管理所有功能', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_roles (uuid, tenant_id, name, code, description, is_system, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '组织管理员', 'TENANT_ADMIN', '组织管理员，可管理组织内所有数据', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_roles (uuid, tenant_id, name, code, description, is_system, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '总经理', 'GM', '公司总经理角色', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_roles (uuid, tenant_id, name, code, description, is_system, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 1, '普通员工', 'EMPLOYEE', '普通员工角色', false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
]

# 默认权限数据
PERMISSIONS_SQL = [
    "INSERT INTO sys_permissions (uuid, tenant_id, name, code, resource, action, permission_type, description, created_at, updated_at) VALUES (gen_random_uuid(), 1, '系统管理', 'system:admin', 'system', 'admin', 'function', '系统管理权限', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_permissions (uuid, tenant_id, name, code, resource, action, permission_type, description, created_at, updated_at) VALUES (gen_random_uuid(), 1, '创建用户', 'user:create', 'user', 'create', 'function', '创建用户', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_permissions (uuid, tenant_id, name, code, resource, action, permission_type, description, created_at, updated_at) VALUES (gen_random_uuid(), 1, '查看用户', 'user:read', 'user', 'read', 'function', '查看用户', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_permissions (uuid, tenant_id, name, code, resource, action, permission_type, description, created_at, updated_at) VALUES (gen_random_uuid(), 1, '更新用户', 'user:update', 'user', 'update', 'function', '更新用户', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
    "INSERT INTO sys_permissions (uuid, tenant_id, name, code, resource, action, permission_type, description, created_at, updated_at) VALUES (gen_random_uuid(), 1, '删除用户', 'user:delete', 'user', 'delete', 'function', '删除用户', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);",
]

async def init_manufacturing_data_sql():
    """使用SQL直接初始化制造业默认数据"""
    print("=" * 60)
    print("制造业默认数据初始化（SQL版本）")
    print("=" * 60)

    conn = None
    try:
        conn = await get_db_connection()

        # 1. 初始化部门
        print("开始初始化部门...")
        for sql in DEPARTMENTS_SQL:
            try:
                await conn.execute(sql)
                print("  ✅ 创建部门")
            except Exception as e:
                print(f"  ⚠️  跳过: {str(e)[:50]}...")

        # 2. 初始化职位
        print("开始初始化职位...")
        for sql in POSITIONS_SQL:
            try:
                await conn.execute(sql)
                print("  ✅ 创建职位")
            except Exception as e:
                print(f"  ⚠️  跳过: {str(e)[:50]}...")

        # 3. 初始化角色
        print("开始初始化角色...")
        for sql in ROLES_SQL:
            try:
                await conn.execute(sql)
                print("  ✅ 创建角色")
            except Exception as e:
                print(f"  ⚠️  跳过: {str(e)[:50]}...")

        # 4. 初始化权限
        print("开始初始化权限...")
        for sql in PERMISSIONS_SQL:
            try:
                await conn.execute(sql)
                print("  ✅ 创建权限")
            except Exception as e:
                print(f"  ⚠️  跳过: {str(e)[:50]}...")

        print("=" * 60)
        print("✅ 制造业默认数据初始化完成！")
        print("=" * 60)

    except Exception as e:
        print(f"❌ 初始化失败: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    asyncio.run(init_manufacturing_data_sql())
