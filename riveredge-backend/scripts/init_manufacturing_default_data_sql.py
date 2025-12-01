"""
制造业默认数据初始化脚本 - 完整SQL版本

使用原生SQL绕过Tortoise ORM的时区问题，创建完整的制造业默认数据
"""

import asyncio
import sys
from pathlib import Path

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

from soil.infrastructure.database.database import get_db_connection

# 默认部门数据（按层级顺序）
DEPARTMENTS_DATA = [
    # 根部门
    ("生产部", "PROD", None, 10, "生产制造部门"),
    ("生产计划组", "PROD_PLAN", "PROD", 11, "生产计划与调度"),
    ("生产车间", "PROD_WORKSHOP", "PROD", 12, "生产车间"),
    ("设备维护组", "PROD_MAINT", "PROD", 13, "设备维护保养"),

    ("质量部", "QUALITY", None, 20, "质量管理部门"),
    ("质量检验组", "QUALITY_INSP", "QUALITY", 21, "质量检验"),
    ("质量保证组", "QUALITY_ASSUR", "QUALITY", 22, "质量保证"),

    ("采购部", "PURCHASE", None, 30, "采购部门"),

    ("销售部", "SALES", None, 40, "销售部门"),
    ("国内销售组", "SALES_DOMESTIC", "SALES", 41, "国内销售"),
    ("国际销售组", "SALES_INTER", "SALES", 42, "国际销售"),

    ("仓储部", "WAREHOUSE", None, 50, "仓储部门"),
    ("原材料仓库", "WAREHOUSE_RAW", "WAREHOUSE", 51, "原材料仓库"),
    ("成品仓库", "WAREHOUSE_FIN", "WAREHOUSE", 52, "成品仓库"),

    ("财务部", "FINANCE", None, 60, "财务部门"),

    ("人事部", "HR", None, 70, "人事部门"),

    ("研发部", "R&D", None, 80, "研发部门"),
    ("产品研发组", "R&D_PRODUCT", "R&D", 81, "产品研发"),
    ("工艺研发组", "R&D_PROCESS", "R&D", 82, "工艺研发"),

    ("行政部", "ADMIN", None, 90, "行政部门"),
]

# 默认职位数据
POSITIONS_DATA = [
    # 通用职位
    ("总经理", "GM", None, 1, "公司总经理"),
    ("副总经理", "DGM", None, 2, "公司副总经理"),
    ("部门经理", "DEPT_MGR", None, 3, "通用部门经理"),
    ("部门副经理", "DEPT_DMGR", None, 4, "通用部门副经理"),

    # 生产部职位
    ("生产经理", "PROD_MGR", "PROD", 10, "生产部门负责人"),
    ("生产计划员", "PROD_PLANNER", "PROD_PLAN", 11, "生产计划制定"),
    ("车间主任", "WORKSHOP_DIR", "PROD_WORKSHOP", 12, "车间管理"),
    ("生产班长", "PROD_LEADER", "PROD_WORKSHOP", 13, "班组管理"),
    ("操作工", "OPERATOR", "PROD_WORKSHOP", 14, "生产操作"),
    ("设备工程师", "EQUIP_ENG", "PROD_MAINT", 15, "设备维护"),
    ("设备维修工", "EQUIP_REPAIR", "PROD_MAINT", 16, "设备维修"),

    # 质量部职位
    ("质量经理", "QUALITY_MGR", "QUALITY", 20, "质量部门负责人"),
    ("质量工程师", "QUALITY_ENG", "QUALITY_INSP", 21, "质量工程"),
    ("质检员", "QC_INSPECTOR", "QUALITY_INSP", 22, "质量检验"),
    ("质量体系专员", "QMS_SPEC", "QUALITY_ASSUR", 23, "质量体系管理"),

    # 采购部职位
    ("采购经理", "PURCHASE_MGR", "PURCHASE", 30, "采购部门负责人"),
    ("采购专员", "PURCHASE_SPEC", "PURCHASE", 31, "采购执行"),

    # 销售部职位
    ("销售经理", "SALES_MGR", "SALES", 40, "销售部门负责人"),
    ("销售代表", "SALES_REP", "SALES_DOMESTIC", 41, "销售代表"),
    ("外贸专员", "EXPORT_SPEC", "SALES_INTER", 42, "外贸业务"),

    # 仓储部职位
    ("仓储经理", "WAREHOUSE_MGR", "WAREHOUSE", 50, "仓储部门负责人"),
    ("仓库管理员", "WAREHOUSE_KEEPER", "WAREHOUSE_RAW", 51, "仓库管理"),
    ("仓管员", "STOCK_KEEPER", "WAREHOUSE_FIN", 52, "库存管理"),

    # 财务部职位
    ("财务经理", "FINANCE_MGR", "FINANCE", 60, "财务部门负责人"),
    ("会计", "ACCOUNTANT", "FINANCE", 61, "会计核算"),
    ("出纳", "CASHIER", "FINANCE", 62, "出纳管理"),

    # 人事部职位
    ("人事经理", "HR_MGR", "HR", 70, "人事部门负责人"),
    ("人事专员", "HR_SPEC", "HR", 71, "人事管理"),

    # 研发部职位
    ("研发经理", "R&D_MGR", "R&D", 80, "研发部门负责人"),
    ("产品工程师", "PRODUCT_ENG", "R&D_PRODUCT", 81, "产品设计"),
    ("工艺工程师", "PROCESS_ENG", "R&D_PROCESS", 82, "工艺设计"),

    # 行政部职位
    ("行政经理", "ADMIN_MGR", "ADMIN", 90, "行政部门负责人"),
    ("行政专员", "ADMIN_SPEC", "ADMIN", 91, "行政管理"),
]

# 默认角色数据
ROLES_DATA = [
    # 系统角色
    ("系统管理员", "SYSTEM_ADMIN", True, "系统最高权限，可管理所有功能"),
    ("组织管理员", "TENANT_ADMIN", True, "组织管理员，可管理组织内所有数据"),
    ("部门管理员", "DEPT_ADMIN", True, "部门管理员，可管理本部门数据"),

    # 业务角色
    ("总经理", "GM", False, "公司总经理角色"),
    ("副总经理", "DGM", False, "公司副总经理角色"),
    ("部门经理", "DEPT_MGR", False, "部门经理角色"),
    ("部门副经理", "DEPT_DMGR", False, "部门副经理角色"),
    ("生产经理", "PROD_MGR", False, "生产部门经理"),
    ("质量经理", "QUALITY_MGR", False, "质量部门经理"),
    ("采购经理", "PURCHASE_MGR", False, "采购部门经理"),
    ("销售经理", "SALES_MGR", False, "销售部门经理"),
    ("仓储经理", "WAREHOUSE_MGR", False, "仓储部门经理"),
    ("财务经理", "FINANCE_MGR", False, "财务部门经理"),
    ("人事经理", "HR_MGR", False, "人事部门经理"),
    ("研发经理", "R&D_MGR", False, "研发部门经理"),
    ("行政经理", "ADMIN_MGR", False, "行政部门经理"),
    ("普通员工", "EMPLOYEE", False, "普通员工角色"),
]

# 默认权限数据
PERMISSIONS_DATA = [
    # 系统管理权限
    ("系统管理", "system:admin", "system", "admin", "function", "系统管理权限"),

    # 用户管理权限
    ("创建用户", "user:create", "user", "create", "function", "创建用户"),
    ("查看用户", "user:read", "user", "read", "function", "查看用户"),
    ("更新用户", "user:update", "user", "update", "function", "更新用户"),
    ("删除用户", "user:delete", "user", "delete", "function", "删除用户"),
    ("用户列表", "user:list", "user", "list", "function", "用户列表"),
    ("导出用户", "user:export", "user", "export", "function", "导出用户"),

    # 角色管理权限
    ("创建角色", "role:create", "role", "create", "function", "创建角色"),
    ("查看角色", "role:read", "role", "read", "function", "查看角色"),
    ("更新角色", "role:update", "role", "update", "function", "更新角色"),
    ("删除角色", "role:delete", "role", "delete", "function", "删除角色"),
    ("角色列表", "role:list", "role", "list", "function", "角色列表"),

    # 部门管理权限
    ("创建部门", "department:create", "department", "create", "function", "创建部门"),
    ("查看部门", "department:read", "department", "read", "function", "查看部门"),
    ("更新部门", "department:update", "department", "update", "function", "更新部门"),
    ("删除部门", "department:delete", "department", "delete", "function", "删除部门"),
    ("部门列表", "department:list", "department", "list", "function", "部门列表"),

    # 职位管理权限
    ("创建职位", "position:create", "position", "create", "function", "创建职位"),
    ("查看职位", "position:read", "position", "read", "function", "查看职位"),
    ("更新职位", "position:update", "position", "update", "function", "更新职位"),
    ("删除职位", "position:delete", "position", "delete", "function", "删除职位"),
    ("职位列表", "position:list", "position", "list", "function", "职位列表"),
]

async def init_manufacturing_default_data_sql(tenant_id: int = 1):
    """使用SQL直接初始化完整的制造业默认数据"""
    print("=" * 60)
    print(f"制造业默认数据初始化（SQL版本）- 组织ID: {tenant_id}")
    print("=" * 60)

    conn = None
    try:
        conn = await get_db_connection()

        # 1. 初始化部门（按层级顺序）
        print("开始初始化部门...")
        department_map = {}  # 部门代码 -> 部门ID

        for name, code, parent_code, sort_order, description in DEPARTMENTS_DATA:
            try:
                # 如果有父部门，获取父部门ID
                parent_id = None
                if parent_code:
                    parent_id = department_map.get(parent_code)

                # 插入部门
                result = await conn.fetchrow("""
                    INSERT INTO sys_departments
                    (uuid, tenant_id, name, code, description, parent_id, sort_order, is_active, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                """, tenant_id, name, code, description, parent_id, sort_order)

                department_map[code] = result['id']
                parent_desc = f" -> 父部门: {parent_code}" if parent_code else ""
                print(f"  ✅ 创建部门: {name} ({code}){parent_desc}")

            except Exception as e:
                print(f"  ⚠️  跳过部门 {name}: {str(e)[:50]}...")

        # 2. 初始化职位
        print("开始初始化职位...")
        for name, code, dept_code, sort_order, description in POSITIONS_DATA:
            try:
                dept_id = department_map.get(dept_code) if dept_code else None
                await conn.execute("""
                    INSERT INTO sys_positions
                    (uuid, tenant_id, name, code, description, department_id, sort_order, is_active, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, tenant_id, name, code, description, dept_id, sort_order)

                dept_desc = f" -> 部门: {dept_code}" if dept_code else ""
                print(f"  ✅ 创建职位: {name} ({code}){dept_desc}")

            except Exception as e:
                print(f"  ⚠️  跳过职位 {name}: {str(e)[:50]}...")

        # 3. 初始化角色
        print("开始初始化角色...")
        role_map = {}  # 角色代码 -> 角色ID

        for name, code, is_system, description in ROLES_DATA:
            try:
                result = await conn.fetchrow("""
                    INSERT INTO sys_roles
                    (uuid, tenant_id, name, code, description, is_system, is_active, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                """, tenant_id, name, code, description, is_system)

                role_map[code] = result['id']
                sys_tag = "【系统角色】" if is_system else ""
                print(f"  ✅ 创建角色: {name} ({code}) {sys_tag}")

            except Exception as e:
                print(f"  ⚠️  跳过角色 {name}: {str(e)[:50]}...")

        # 4. 初始化权限
        print("开始初始化权限...")
        permission_map = {}  # 权限代码 -> 权限ID

        for name, code, resource, action, perm_type, description in PERMISSIONS_DATA:
            try:
                result = await conn.fetchrow("""
                    INSERT INTO sys_permissions
                    (uuid, tenant_id, name, code, resource, action, permission_type, description, created_at, updated_at)
                    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    RETURNING id
                """, tenant_id, name, code, resource, action, perm_type, description)

                permission_map[code] = result['id']
                print(f"  ✅ 创建权限: {name} ({code})")

            except Exception as e:
                print(f"  ⚠️  跳过权限 {name}: {str(e)[:50]}...")

        # 5. 分配角色权限
        print("开始分配角色权限...")

        # 角色权限分配规则
        ROLE_PERMISSIONS = {
            "SYSTEM_ADMIN": ["*:*"],  # 所有权限
            "TENANT_ADMIN": [
                "user:create", "user:read", "user:update", "user:delete", "user:list", "user:export",
                "role:create", "role:read", "role:update", "role:delete", "role:list",
                "department:create", "department:read", "department:update", "department:delete", "department:list",
                "position:create", "position:read", "position:update", "position:delete", "position:list",
            ],
            "DEPT_ADMIN": [
                "user:read", "user:list",
                "department:read", "department:list",
            ],
            "EMPLOYEE": [
                "user:read",
                "department:read",
                "position:read",
            ],
        }

        for role_code, perm_codes in ROLE_PERMISSIONS.items():
            role_id = role_map.get(role_code)
            if not role_id:
                print(f"  ⚠️  找不到角色 {role_code}")
                continue

            if perm_codes == ["*:*"]:
                # 系统管理员拥有所有权限
                all_perms = list(permission_map.values())
                for perm_id in all_perms:
                    try:
                        await conn.execute("""
                            INSERT INTO sys_role_permissions (uuid, role_id, permission_id, created_at)
                            VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
                        """, role_id, perm_id)
                    except Exception:
                        pass  # 忽略重复插入
                print(f"  ✅ 为角色 {role_code} 分配所有权限（{len(all_perms)} 个）")
            else:
                # 为角色分配指定权限
                assigned = 0
                for perm_code in perm_codes:
                    perm_id = permission_map.get(perm_code)
                    if not perm_id:
                        continue

                    try:
                        await conn.execute("""
                            INSERT INTO sys_role_permissions (uuid, role_id, permission_id, created_at)
                            VALUES (gen_random_uuid(), $1, $2, CURRENT_TIMESTAMP)
                        """, role_id, perm_id)
                        assigned += 1
                    except Exception:
                        pass  # 忽略重复插入

                print(f"  ✅ 为角色 {role_code} 分配 {assigned} 个权限")

        print("=" * 60)
        print("✅ 制造业默认数据初始化完成！")
        print(f"   部门: {len(department_map)} 个")
        print(f"   职位: {len(POSITIONS_DATA)} 个")
        print(f"   角色: {len(role_map)} 个")
        print(f"   权限: {len(permission_map)} 个")
        print("=" * 60)

    except Exception as e:
        print(f"❌ 初始化失败: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        if conn:
            await conn.close()

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="初始化制造业默认数据（SQL版本）")
    parser.add_argument("--tenant-id", type=int, default=1, help="组织ID（默认 1）")

    args = parser.parse_args()
    asyncio.run(init_manufacturing_default_data_sql(args.tenant_id))
