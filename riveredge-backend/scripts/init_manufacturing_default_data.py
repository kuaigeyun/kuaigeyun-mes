"""
制造业默认数据初始化脚本

用于创建制造业系统所需的基础数据，包括：
- 默认部门（生产、质量、采购、销售、仓储、财务、人事、研发、行政）
- 默认职位（各部门的常见职位）
- 默认角色（系统管理员、组织管理员、部门管理员、业务角色）
- 默认权限（基础权限）

使用方法:
    python scripts/init_manufacturing_default_data.py [--tenant-id TENANT_ID] [--force]

参数:
    --tenant-id: 指定组织ID（可选，如果不指定，需要从环境变量或配置中获取）
    --force: 强制重新初始化（删除现有数据后重新创建）
"""

import asyncio
import sys
import os
import uuid
from pathlib import Path
from typing import Dict, List, Optional

# 添加src目录到Python路径
src_path = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(src_path))

# 设置时区环境变量（必须在导入 Tortoise 之前）
from soil.config.platform_config import platform_settings, setup_tortoise_timezone_env

# 确保环境变量在导入 Tortoise 之前就已经设置
os.environ["USE_TZ"] = str(platform_settings.USE_TZ)
os.environ["TIMEZONE"] = platform_settings.TIMEZONE
setup_tortoise_timezone_env()

from tortoise import Tortoise
from tortoise.exceptions import IntegrityError
from soil.infrastructure.database.database import TORTOISE_ORM
from tree_root.models.department import Department
from tree_root.models.position import Position
from tree_root.models.role import Role
from tree_root.models.permission import Permission
from tree_root.models.role_permission import RolePermission


# ==================== 默认数据定义 ====================

# 默认部门数据（按层级顺序）
DEFAULT_DEPARTMENTS = [
    # 根部门（生产部）
    {"name": "生产部", "code": "PROD", "parent_code": None, "sort_order": 10, "description": "生产制造部门"},
    {"name": "生产计划组", "code": "PROD_PLAN", "parent_code": "PROD", "sort_order": 11, "description": "生产计划与调度"},
    {"name": "生产车间", "code": "PROD_WORKSHOP", "parent_code": "PROD", "sort_order": 12, "description": "生产车间"},
    {"name": "设备维护组", "code": "PROD_MAINT", "parent_code": "PROD", "sort_order": 13, "description": "设备维护保养"},
    
    # 质量部
    {"name": "质量部", "code": "QUALITY", "parent_code": None, "sort_order": 20, "description": "质量管理部门"},
    {"name": "质量检验组", "code": "QUALITY_INSP", "parent_code": "QUALITY", "sort_order": 21, "description": "质量检验"},
    {"name": "质量保证组", "code": "QUALITY_ASSUR", "parent_code": "QUALITY", "sort_order": 22, "description": "质量保证"},
    
    # 采购部
    {"name": "采购部", "code": "PURCHASE", "parent_code": None, "sort_order": 30, "description": "采购部门"},
    
    # 销售部
    {"name": "销售部", "code": "SALES", "parent_code": None, "sort_order": 40, "description": "销售部门"},
    {"name": "国内销售组", "code": "SALES_DOMESTIC", "parent_code": "SALES", "sort_order": 41, "description": "国内销售"},
    {"name": "国际销售组", "code": "SALES_INTER", "parent_code": "SALES", "sort_order": 42, "description": "国际销售"},
    
    # 仓储部
    {"name": "仓储部", "code": "WAREHOUSE", "parent_code": None, "sort_order": 50, "description": "仓储部门"},
    {"name": "原材料仓库", "code": "WAREHOUSE_RAW", "parent_code": "WAREHOUSE", "sort_order": 51, "description": "原材料仓库"},
    {"name": "成品仓库", "code": "WAREHOUSE_FIN", "parent_code": "WAREHOUSE", "sort_order": 52, "description": "成品仓库"},
    
    # 财务部
    {"name": "财务部", "code": "FINANCE", "parent_code": None, "sort_order": 60, "description": "财务部门"},
    
    # 人事部
    {"name": "人事部", "code": "HR", "parent_code": None, "sort_order": 70, "description": "人事部门"},
    
    # 研发部
    {"name": "研发部", "code": "R&D", "parent_code": None, "sort_order": 80, "description": "研发部门"},
    {"name": "产品研发组", "code": "R&D_PRODUCT", "parent_code": "R&D", "sort_order": 81, "description": "产品研发"},
    {"name": "工艺研发组", "code": "R&D_PROCESS", "parent_code": "R&D", "sort_order": 82, "description": "工艺研发"},
    
    # 行政部
    {"name": "行政部", "code": "ADMIN", "parent_code": None, "sort_order": 90, "description": "行政部门"},
]

# 默认职位数据
DEFAULT_POSITIONS = [
    # 通用职位
    {"name": "总经理", "code": "GM", "department_code": None, "sort_order": 1, "description": "公司总经理"},
    {"name": "副总经理", "code": "DGM", "department_code": None, "sort_order": 2, "description": "公司副总经理"},
    {"name": "部门经理", "code": "DEPT_MGR", "department_code": None, "sort_order": 3, "description": "通用部门经理"},
    {"name": "部门副经理", "code": "DEPT_DMGR", "department_code": None, "sort_order": 4, "description": "通用部门副经理"},
    
    # 生产部职位
    {"name": "生产经理", "code": "PROD_MGR", "department_code": "PROD", "sort_order": 10, "description": "生产部门负责人"},
    {"name": "生产计划员", "code": "PROD_PLANNER", "department_code": "PROD_PLAN", "sort_order": 11, "description": "生产计划制定"},
    {"name": "车间主任", "code": "WORKSHOP_DIR", "department_code": "PROD_WORKSHOP", "sort_order": 12, "description": "车间管理"},
    {"name": "生产班长", "code": "PROD_LEADER", "department_code": "PROD_WORKSHOP", "sort_order": 13, "description": "班组管理"},
    {"name": "操作工", "code": "OPERATOR", "department_code": "PROD_WORKSHOP", "sort_order": 14, "description": "生产操作"},
    {"name": "设备工程师", "code": "EQUIP_ENG", "department_code": "PROD_MAINT", "sort_order": 15, "description": "设备维护"},
    {"name": "设备维修工", "code": "EQUIP_REPAIR", "department_code": "PROD_MAINT", "sort_order": 16, "description": "设备维修"},
    
    # 质量部职位
    {"name": "质量经理", "code": "QUALITY_MGR", "department_code": "QUALITY", "sort_order": 20, "description": "质量部门负责人"},
    {"name": "质量工程师", "code": "QUALITY_ENG", "department_code": "QUALITY_INSP", "sort_order": 21, "description": "质量工程"},
    {"name": "质检员", "code": "QC_INSPECTOR", "department_code": "QUALITY_INSP", "sort_order": 22, "description": "质量检验"},
    {"name": "质量体系专员", "code": "QMS_SPEC", "department_code": "QUALITY_ASSUR", "sort_order": 23, "description": "质量体系管理"},
    
    # 采购部职位
    {"name": "采购经理", "code": "PURCHASE_MGR", "department_code": "PURCHASE", "sort_order": 30, "description": "采购部门负责人"},
    {"name": "采购专员", "code": "PURCHASE_SPEC", "department_code": "PURCHASE", "sort_order": 31, "description": "采购执行"},
    
    # 销售部职位
    {"name": "销售经理", "code": "SALES_MGR", "department_code": "SALES", "sort_order": 40, "description": "销售部门负责人"},
    {"name": "销售代表", "code": "SALES_REP", "department_code": "SALES_DOMESTIC", "sort_order": 41, "description": "销售代表"},
    {"name": "外贸专员", "code": "EXPORT_SPEC", "department_code": "SALES_INTER", "sort_order": 42, "description": "外贸业务"},
    
    # 仓储部职位
    {"name": "仓储经理", "code": "WAREHOUSE_MGR", "department_code": "WAREHOUSE", "sort_order": 50, "description": "仓储部门负责人"},
    {"name": "仓库管理员", "code": "WAREHOUSE_KEEPER", "department_code": "WAREHOUSE_RAW", "sort_order": 51, "description": "仓库管理"},
    {"name": "仓管员", "code": "STOCK_KEEPER", "department_code": "WAREHOUSE_FIN", "sort_order": 52, "description": "库存管理"},
    
    # 财务部职位
    {"name": "财务经理", "code": "FINANCE_MGR", "department_code": "FINANCE", "sort_order": 60, "description": "财务部门负责人"},
    {"name": "会计", "code": "ACCOUNTANT", "department_code": "FINANCE", "sort_order": 61, "description": "会计核算"},
    {"name": "出纳", "code": "CASHIER", "department_code": "FINANCE", "sort_order": 62, "description": "出纳管理"},
    
    # 人事部职位
    {"name": "人事经理", "code": "HR_MGR", "department_code": "HR", "sort_order": 70, "description": "人事部门负责人"},
    {"name": "人事专员", "code": "HR_SPEC", "department_code": "HR", "sort_order": 71, "description": "人事管理"},
    
    # 研发部职位
    {"name": "研发经理", "code": "R&D_MGR", "department_code": "R&D", "sort_order": 80, "description": "研发部门负责人"},
    {"name": "产品工程师", "code": "PRODUCT_ENG", "department_code": "R&D_PRODUCT", "sort_order": 81, "description": "产品设计"},
    {"name": "工艺工程师", "code": "PROCESS_ENG", "department_code": "R&D_PROCESS", "sort_order": 82, "description": "工艺设计"},
    
    # 行政部职位
    {"name": "行政经理", "code": "ADMIN_MGR", "department_code": "ADMIN", "sort_order": 90, "description": "行政部门负责人"},
    {"name": "行政专员", "code": "ADMIN_SPEC", "department_code": "ADMIN", "sort_order": 91, "description": "行政管理"},
]

# 默认角色数据
DEFAULT_ROLES = [
    # 系统角色（is_system=true）
    {"name": "系统管理员", "code": "SYSTEM_ADMIN", "is_system": True, "description": "系统最高权限，可管理所有功能"},
    {"name": "组织管理员", "code": "TENANT_ADMIN", "is_system": True, "description": "组织管理员，可管理组织内所有数据"},
    {"name": "部门管理员", "code": "DEPT_ADMIN", "is_system": True, "description": "部门管理员，可管理本部门数据"},
    
    # 业务角色（is_system=false）
    {"name": "总经理", "code": "GM", "is_system": False, "description": "公司总经理角色"},
    {"name": "副总经理", "code": "DGM", "is_system": False, "description": "公司副总经理角色"},
    {"name": "部门经理", "code": "DEPT_MGR", "is_system": False, "description": "部门经理角色"},
    {"name": "部门副经理", "code": "DEPT_DMGR", "is_system": False, "description": "部门副经理角色"},
    {"name": "生产经理", "code": "PROD_MGR", "is_system": False, "description": "生产部门经理"},
    {"name": "质量经理", "code": "QUALITY_MGR", "is_system": False, "description": "质量部门经理"},
    {"name": "采购经理", "code": "PURCHASE_MGR", "is_system": False, "description": "采购部门经理"},
    {"name": "销售经理", "code": "SALES_MGR", "is_system": False, "description": "销售部门经理"},
    {"name": "仓储经理", "code": "WAREHOUSE_MGR", "is_system": False, "description": "仓储部门经理"},
    {"name": "财务经理", "code": "FINANCE_MGR", "is_system": False, "description": "财务部门经理"},
    {"name": "人事经理", "code": "HR_MGR", "is_system": False, "description": "人事部门经理"},
    {"name": "研发经理", "code": "R&D_MGR", "is_system": False, "description": "研发部门经理"},
    {"name": "行政经理", "code": "ADMIN_MGR", "is_system": False, "description": "行政部门经理"},
    {"name": "普通员工", "code": "EMPLOYEE", "is_system": False, "description": "普通员工角色"},
]

# 默认权限数据（基础权限）
DEFAULT_PERMISSIONS = [
    # 系统管理权限
    {"name": "系统管理", "code": "system:admin", "resource": "system", "action": "admin", "permission_type": "function", "description": "系统管理权限"},
    
    # 用户管理权限
    {"name": "创建用户", "code": "user:create", "resource": "user", "action": "create", "permission_type": "function", "description": "创建用户"},
    {"name": "查看用户", "code": "user:read", "resource": "user", "action": "read", "permission_type": "function", "description": "查看用户"},
    {"name": "更新用户", "code": "user:update", "resource": "user", "action": "update", "permission_type": "function", "description": "更新用户"},
    {"name": "删除用户", "code": "user:delete", "resource": "user", "action": "delete", "permission_type": "function", "description": "删除用户"},
    {"name": "用户列表", "code": "user:list", "resource": "user", "action": "list", "permission_type": "function", "description": "用户列表"},
    {"name": "导出用户", "code": "user:export", "resource": "user", "action": "export", "permission_type": "function", "description": "导出用户"},
    
    # 角色管理权限
    {"name": "创建角色", "code": "role:create", "resource": "role", "action": "create", "permission_type": "function", "description": "创建角色"},
    {"name": "查看角色", "code": "role:read", "resource": "role", "action": "read", "permission_type": "function", "description": "查看角色"},
    {"name": "更新角色", "code": "role:update", "resource": "role", "action": "update", "permission_type": "function", "description": "更新角色"},
    {"name": "删除角色", "code": "role:delete", "resource": "role", "action": "delete", "permission_type": "function", "description": "删除角色"},
    {"name": "角色列表", "code": "role:list", "resource": "role", "action": "list", "permission_type": "function", "description": "角色列表"},
    
    # 部门管理权限
    {"name": "创建部门", "code": "department:create", "resource": "department", "action": "create", "permission_type": "function", "description": "创建部门"},
    {"name": "查看部门", "code": "department:read", "resource": "department", "action": "read", "permission_type": "function", "description": "查看部门"},
    {"name": "更新部门", "code": "department:update", "resource": "department", "action": "update", "permission_type": "function", "description": "更新部门"},
    {"name": "删除部门", "code": "department:delete", "resource": "department", "action": "delete", "permission_type": "function", "description": "删除部门"},
    {"name": "部门列表", "code": "department:list", "resource": "department", "action": "list", "permission_type": "function", "description": "部门列表"},
    
    # 职位管理权限
    {"name": "创建职位", "code": "position:create", "resource": "position", "action": "create", "permission_type": "function", "description": "创建职位"},
    {"name": "查看职位", "code": "position:read", "resource": "position", "action": "read", "permission_type": "function", "description": "查看职位"},
    {"name": "更新职位", "code": "position:update", "resource": "position", "action": "update", "permission_type": "function", "description": "更新职位"},
    {"name": "删除职位", "code": "position:delete", "resource": "position", "action": "delete", "permission_type": "function", "description": "删除职位"},
    {"name": "职位列表", "code": "position:list", "resource": "position", "action": "list", "permission_type": "function", "description": "职位列表"},
]

# 角色权限分配（角色代码 -> 权限代码列表）
ROLE_PERMISSIONS = {
    "SYSTEM_ADMIN": ["*:*"],  # 所有权限（需要在代码中特殊处理）
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


# ==================== 初始化函数 ====================

async def init_departments(tenant_id: int, force: bool = False) -> Dict[str, int]:
    """
    初始化默认部门
    
    Args:
        tenant_id: 组织ID
        force: 是否强制重新初始化
        
    Returns:
        部门代码到部门ID的映射字典
    """
    print("=" * 60)
    print("开始初始化默认部门...")
    print("=" * 60)
    
    # 检查是否已存在部门
    existing_departments = await Department.filter(tenant_id=tenant_id).count()
    if existing_departments > 0 and not force:
        print(f"⚠️  组织 {tenant_id} 已存在 {existing_departments} 个部门，跳过初始化")
        print("如需重新初始化，请使用 --force 参数")
        # 返回现有部门的映射
        departments = await Department.filter(tenant_id=tenant_id).all()
        return {dept.code: dept.id for dept in departments if dept.code}
    
    # 如果强制重新初始化，先删除现有部门（硬删除）
    if force and existing_departments > 0:
        await Department.filter(tenant_id=tenant_id).delete()
        print(f"⚠️  已删除 {existing_departments} 个现有部门（强制模式）")
    
    # 按层级顺序创建部门（先创建父部门，再创建子部门）
    department_map: Dict[str, int] = {}  # 部门代码 -> 部门ID
    
    # 第一遍：创建所有根部门
    for dept_data in DEFAULT_DEPARTMENTS:
        if dept_data["parent_code"] is None:
            try:
                department = await Department.create(
                    tenant_id=tenant_id,
                    name=dept_data["name"],
                    code=dept_data["code"],
                    description=dept_data["description"],
                    parent_id=None,
                    sort_order=dept_data["sort_order"],
                    is_active=True,
                )
                department_map[dept_data["code"]] = department.id
                print(f"  ✅ 创建根部门: {dept_data['name']} ({dept_data['code']})")
            except IntegrityError:
                # 如果已存在，获取现有部门
                existing = await Department.filter(
                    tenant_id=tenant_id,
                    code=dept_data["code"]
                ).first()
                if existing:
                    department_map[dept_data["code"]] = existing.id
                    print(f"  ⚠️  根部门已存在: {dept_data['name']} ({dept_data['code']})")
    
    # 第二遍：创建子部门
    for dept_data in DEFAULT_DEPARTMENTS:
        if dept_data["parent_code"] is not None:
            parent_id = department_map.get(dept_data["parent_code"])
            if parent_id is None:
                print(f"  ❌ 错误：找不到父部门 {dept_data['parent_code']}")
                continue
            
            try:
                department = await Department.create(
                    tenant_id=tenant_id,
                    name=dept_data["name"],
                    code=dept_data["code"],
                    description=dept_data["description"],
                    parent_id=parent_id,
                    sort_order=dept_data["sort_order"],
                    is_active=True,
                )
                department_map[dept_data["code"]] = department.id
                print(f"  ✅ 创建子部门: {dept_data['name']} ({dept_data['code']}) -> 父部门: {dept_data['parent_code']}")
            except IntegrityError:
                # 如果已存在，获取现有部门
                existing = await Department.filter(
                    tenant_id=tenant_id,
                    code=dept_data["code"]
                ).first()
                if existing:
                    department_map[dept_data["code"]] = existing.id
                    print(f"  ⚠️  子部门已存在: {dept_data['name']} ({dept_data['code']})")
    
    print(f"✅ 部门初始化完成，共创建/更新 {len(department_map)} 个部门")
    return department_map


async def init_positions(tenant_id: int, department_map: Dict[str, int], force: bool = False):
    """
    初始化默认职位
    
    Args:
        tenant_id: 组织ID
        department_map: 部门代码到部门ID的映射字典
        force: 是否强制重新初始化
    """
    print("=" * 60)
    print("开始初始化默认职位...")
    print("=" * 60)
    
    # 检查是否已存在职位
    existing_positions = await Position.filter(tenant_id=tenant_id).count()
    if existing_positions > 0 and not force:
        print(f"⚠️  组织 {tenant_id} 已存在 {existing_positions} 个职位，跳过初始化")
        return
    
    # 如果强制重新初始化，先删除现有职位（硬删除）
    if force and existing_positions > 0:
        await Position.filter(tenant_id=tenant_id).delete()
        print(f"⚠️  已删除 {existing_positions} 个现有职位（强制模式）")
    
    position_count = 0
    for pos_data in DEFAULT_POSITIONS:
        department_id = None
        if pos_data["department_code"]:
            department_id = department_map.get(pos_data["department_code"])
            if department_id is None:
                print(f"  ⚠️  警告：找不到部门 {pos_data['department_code']}，职位 {pos_data['name']} 将不关联部门")
        
        try:
            position = await Position.create(
                tenant_id=tenant_id,
                name=pos_data["name"],
                code=pos_data["code"],
                description=pos_data["description"],
                department_id=department_id,
                sort_order=pos_data["sort_order"],
                is_active=True,
            )
            position_count += 1
            dept_name = pos_data["department_code"] if pos_data["department_code"] else "无"
            print(f"  ✅ 创建职位: {pos_data['name']} ({pos_data['code']}) -> 部门: {dept_name}")
        except IntegrityError:
            print(f"  ⚠️  职位已存在: {pos_data['name']} ({pos_data['code']})")
    
    print(f"✅ 职位初始化完成，共创建 {position_count} 个职位")


async def init_roles(tenant_id: int, force: bool = False) -> Dict[str, int]:
    """
    初始化默认角色
    
    Args:
        tenant_id: 组织ID
        force: 是否强制重新初始化
        
    Returns:
        角色代码到角色ID的映射字典
    """
    print("=" * 60)
    print("开始初始化默认角色...")
    print("=" * 60)
    
    # 检查是否已存在角色
    existing_roles = await Role.filter(tenant_id=tenant_id).count()
    if existing_roles > 0 and not force:
        print(f"⚠️  组织 {tenant_id} 已存在 {existing_roles} 个角色，跳过初始化")
        # 返回现有角色的映射
        roles = await Role.filter(tenant_id=tenant_id).all()
        return {role.code: role.id for role in roles}
    
    # 如果强制重新初始化，先删除现有角色（硬删除，但系统角色不删除）
    if force and existing_roles > 0:
        await Role.filter(
            tenant_id=tenant_id,
            is_system=False  # 系统角色不删除
        ).delete()
        print(f"⚠️  已删除非系统角色（强制模式）")
    
    role_map: Dict[str, int] = {}  # 角色代码 -> 角色ID
    
    for role_data in DEFAULT_ROLES:
        try:
            role = await Role.create(
                tenant_id=tenant_id,
                name=role_data["name"],
                code=role_data["code"],
                description=role_data["description"],
                is_system=role_data["is_system"],
                is_active=True,
            )
            role_map[role_data["code"]] = role.id
            system_tag = "【系统角色】" if role_data["is_system"] else ""
            print(f"  ✅ 创建角色: {role_data['name']} ({role_data['code']}) {system_tag}")
        except IntegrityError:
            # 如果已存在，获取现有角色
            existing = await Role.filter(
                tenant_id=tenant_id,
                code=role_data["code"]
            ).first()
            if existing:
                role_map[role_data["code"]] = existing.id
                system_tag = "【系统角色】" if role_data["is_system"] else ""
                print(f"  ⚠️  角色已存在: {role_data['name']} ({role_data['code']}) {system_tag}")
    
    print(f"✅ 角色初始化完成，共创建/更新 {len(role_map)} 个角色")
    return role_map


async def init_permissions(tenant_id: int, force: bool = False) -> Dict[str, int]:
    """
    初始化默认权限
    
    Args:
        tenant_id: 组织ID
        force: 是否强制重新初始化
        
    Returns:
        权限代码到权限ID的映射字典
    """
    print("=" * 60)
    print("开始初始化默认权限...")
    print("=" * 60)
    
    # 检查是否已存在权限
    existing_permissions = await Permission.filter(tenant_id=tenant_id).count()
    if existing_permissions > 0 and not force:
        print(f"⚠️  组织 {tenant_id} 已存在 {existing_permissions} 个权限，跳过初始化")
        # 返回现有权限的映射
        permissions = await Permission.filter(tenant_id=tenant_id).all()
        return {perm.code: perm.id for perm in permissions}
    
    # 如果强制重新初始化，先删除现有权限（硬删除）
    if force and existing_permissions > 0:
        await Permission.filter(tenant_id=tenant_id).delete()
        print(f"⚠️  已删除 {existing_permissions} 个现有权限（强制模式）")
    
    permission_map: Dict[str, int] = {}  # 权限代码 -> 权限ID
    
    for perm_data in DEFAULT_PERMISSIONS:
        try:
            permission = await Permission.create(
                tenant_id=tenant_id,
                name=perm_data["name"],
                code=perm_data["code"],
                resource=perm_data["resource"],
                action=perm_data["action"],
                permission_type=perm_data["permission_type"],
                description=perm_data["description"],
            )
            permission_map[perm_data["code"]] = permission.id
            print(f"  ✅ 创建权限: {perm_data['name']} ({perm_data['code']})")
        except IntegrityError:
            # 如果已存在，获取现有权限
            existing = await Permission.filter(
                tenant_id=tenant_id,
                code=perm_data["code"]
            ).first()
            if existing:
                permission_map[perm_data["code"]] = existing.id
                print(f"  ⚠️  权限已存在: {perm_data['name']} ({perm_data['code']})")
    
    print(f"✅ 权限初始化完成，共创建/更新 {len(permission_map)} 个权限")
    return permission_map


async def assign_role_permissions(tenant_id: int, role_map: Dict[str, int], permission_map: Dict[str, int]):
    """
    分配角色权限
    
    Args:
        tenant_id: 组织ID
        role_map: 角色代码到角色ID的映射字典
        permission_map: 权限代码到权限ID的映射字典
    """
    print("=" * 60)
    print("开始分配角色权限...")
    print("=" * 60)
    
    # 先清除所有现有的角色权限关联（如果强制模式）
    # 注意：这里不清除，因为可能用户已经自定义了权限分配
    
    for role_code, permission_codes in ROLE_PERMISSIONS.items():
        role_id = role_map.get(role_code)
        if role_id is None:
            print(f"  ⚠️  警告：找不到角色 {role_code}")
            continue
        
        # 特殊处理：系统管理员拥有所有权限
        if permission_codes == ["*:*"]:
            # 为系统管理员分配所有权限
            all_permissions = await Permission.filter(
                tenant_id=tenant_id
            ).all()
            assigned_count = 0
            for permission in all_permissions:
                role_permission, created = await RolePermission.get_or_create(
                    role_id=role_id,
                    permission_id=permission.id,
                )
                if created:
                    assigned_count += 1
            print(f"  ✅ 为角色 {role_code} 分配所有权限（共 {len(all_permissions)} 个，新增 {assigned_count} 个）")
        else:
            # 为角色分配指定权限
            assigned_count = 0
            for perm_code in permission_codes:
                perm_id = permission_map.get(perm_code)
                if perm_id is None:
                    print(f"  ⚠️  警告：找不到权限 {perm_code}")
                    continue
                role_permission, created = await RolePermission.get_or_create(
                    role_id=role_id,
                    permission_id=perm_id,
                )
                if created:
                    assigned_count += 1
            print(f"  ✅ 为角色 {role_code} 分配 {len(permission_codes)} 个权限（新增 {assigned_count} 个）")
    
    print("✅ 角色权限分配完成")


async def init_manufacturing_default_data(tenant_id: int, force: bool = False):
    """
    初始化制造业默认数据
    
    Args:
        tenant_id: 组织ID
        force: 是否强制重新初始化
    """
    print("=" * 60)
    print("制造业默认数据初始化")
    print("=" * 60)
    print(f"组织ID: {tenant_id}")
    print(f"强制模式: {'是' if force else '否'}")
    print("=" * 60)
    
    try:
        # 确保时区配置正确（动态更新）
        TORTOISE_ORM["use_tz"] = platform_settings.USE_TZ
        TORTOISE_ORM["timezone"] = platform_settings.TIMEZONE
        
        # 确保环境变量已设置（Tortoise ORM 从环境变量读取时区配置）
        os.environ["USE_TZ"] = str(platform_settings.USE_TZ)
        os.environ["TIMEZONE"] = platform_settings.TIMEZONE
        
        # 重新初始化时区环境（确保 Tortoise ORM 读取到最新配置）
        setup_tortoise_timezone_env()
        
        # 重新导入 timezone 模块，确保读取到最新的环境变量
        import importlib
        from tortoise import timezone as tortoise_timezone
        importlib.reload(tortoise_timezone)
        
        # 初始化数据库连接
        await Tortoise.init(config=TORTOISE_ORM)
        
        # 1. 初始化部门
        department_map = await init_departments(tenant_id, force)
        
        # 2. 初始化职位
        await init_positions(tenant_id, department_map, force)
        
        # 3. 初始化角色
        role_map = await init_roles(tenant_id, force)
        
        # 4. 初始化权限
        permission_map = await init_permissions(tenant_id, force)
        
        # 5. 分配角色权限
        await assign_role_permissions(tenant_id, role_map, permission_map)
        
        print("=" * 60)
        print("✅ 制造业默认数据初始化完成！")
        print("=" * 60)
        
    except Exception as e:
        print("=" * 60)
        print(f"❌ 初始化失败: {str(e)}")
        print("=" * 60)
        raise
    finally:
        # 关闭连接
        await Tortoise.close_connections()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="初始化制造业默认数据")
    parser.add_argument("--tenant-id", type=int, help="组织ID（可选）")
    parser.add_argument("--force", action="store_true", help="强制重新初始化")
    
    args = parser.parse_args()
    
    tenant_id = args.tenant_id
    if tenant_id is None:
        # TODO: 从环境变量或配置中获取 tenant_id
        print("=" * 60)
        print("❌ 错误：请指定组织ID（--tenant-id）")
        print("=" * 60)
        sys.exit(1)
    
    asyncio.run(init_manufacturing_default_data(tenant_id, args.force))

