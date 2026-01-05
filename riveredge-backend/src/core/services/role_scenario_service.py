"""
角色场景服务模块

提供角色使用场景和工作台定制的业务逻辑处理。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Dict, Any, Optional
from core.models.role import Role
from core.services.authorization.role_service import RoleService
from core.services.authorization.permission_service import PermissionService
from infra.exceptions.exceptions import NotFoundError
from loguru import logger


# 角色场景定义（预定义的角色使用场景）
ROLE_SCENARIOS: Dict[str, Dict[str, Any]] = {
    "sales": {
        "name": "销售",
        "description": "负责销售订单管理、客户管理、销售预测等",
        "scenarios": [
            {
                "id": "sales_order_management",
                "name": "销售订单管理",
                "description": "创建、查看、编辑销售订单",
                "features": ["销售订单列表", "销售订单创建", "销售订单编辑", "销售订单查询"],
                "permissions": ["sales_order:list", "sales_order:create", "sales_order:update", "sales_order:view"],
            },
            {
                "id": "customer_management",
                "name": "客户管理",
                "description": "管理客户信息和客户关系",
                "features": ["客户列表", "客户创建", "客户编辑", "客户查询"],
                "permissions": ["customer:list", "customer:create", "customer:update", "customer:view"],
            },
            {
                "id": "sales_forecast",
                "name": "销售预测",
                "description": "创建和管理销售预测",
                "features": ["销售预测列表", "销售预测创建", "销售预测编辑"],
                "permissions": ["sales_forecast:list", "sales_forecast:create", "sales_forecast:update"],
            },
        ],
        "dashboard": {
            "widgets": [
                {"type": "statistics", "title": "待处理订单", "api": "/apps/kuaizhizao/sales-orders?status=pending"},
                {"type": "statistics", "title": "本月销售额", "api": "/apps/kuaizhizao/sales-orders/statistics"},
                {"type": "list", "title": "待处理订单列表", "api": "/apps/kuaizhizao/sales-orders?status=pending&limit=10"},
            ],
        },
    },
    "purchase": {
        "name": "采购",
        "description": "负责采购订单管理、供应商管理、采购入库等",
        "scenarios": [
            {
                "id": "purchase_order_management",
                "name": "采购订单管理",
                "description": "创建、查看、编辑采购订单",
                "features": ["采购订单列表", "采购订单创建", "采购订单编辑", "采购订单查询"],
                "permissions": ["purchase_order:list", "purchase_order:create", "purchase_order:update", "purchase_order:view"],
            },
            {
                "id": "supplier_management",
                "name": "供应商管理",
                "description": "管理供应商信息和供应商关系",
                "features": ["供应商列表", "供应商创建", "供应商编辑", "供应商查询"],
                "permissions": ["supplier:list", "supplier:create", "supplier:update", "supplier:view"],
            },
            {
                "id": "purchase_receipt",
                "name": "采购入库",
                "description": "处理采购入库单",
                "features": ["采购入库列表", "采购入库创建", "采购入库编辑"],
                "permissions": ["purchase_receipt:list", "purchase_receipt:create", "purchase_receipt:update"],
            },
        ],
        "dashboard": {
            "widgets": [
                {"type": "statistics", "title": "待处理订单", "api": "/apps/kuaizhizao/purchase-orders?status=pending"},
                {"type": "statistics", "title": "待入库订单", "api": "/apps/kuaizhizao/purchase-orders?status=received"},
                {"type": "list", "title": "待处理订单列表", "api": "/apps/kuaizhizao/purchase-orders?status=pending&limit=10"},
            ],
        },
    },
    "warehouse": {
        "name": "仓库",
        "description": "负责库存管理、出入库管理、库存盘点等",
        "scenarios": [
            {
                "id": "inventory_management",
                "name": "库存管理",
                "description": "查看和管理库存",
                "features": ["库存查询", "库存统计", "库存预警"],
                "permissions": ["inventory:list", "inventory:view", "inventory:statistics"],
            },
            {
                "id": "stock_in_out",
                "name": "出入库管理",
                "description": "处理生产领料、成品入库等",
                "features": ["生产领料", "成品入库", "其他入库", "其他出库"],
                "permissions": ["production_picking:list", "production_picking:create", "finished_goods_receipt:list", "finished_goods_receipt:create"],
            },
            {
                "id": "stocktaking",
                "name": "库存盘点",
                "description": "执行库存盘点",
                "features": ["盘点单创建", "盘点执行", "盘点差异处理"],
                "permissions": ["stocktaking:list", "stocktaking:create", "stocktaking:execute"],
            },
        ],
        "dashboard": {
            "widgets": [
                {"type": "statistics", "title": "库存预警", "api": "/apps/kuaizhizao/inventory/alerts"},
                {"type": "statistics", "title": "待处理单据", "api": "/apps/kuaizhizao/inventory/pending-documents"},
                {"type": "list", "title": "库存预警列表", "api": "/apps/kuaizhizao/inventory/alerts?status=open&limit=10"},
            ],
        },
    },
    "production": {
        "name": "生产",
        "description": "负责生产报工、生产看板、生产执行等",
        "scenarios": [
            {
                "id": "work_order_reporting",
                "name": "生产报工",
                "description": "执行生产报工",
                "features": ["报工列表", "报工创建", "报工查询"],
                "permissions": ["reporting:list", "reporting:create", "reporting:view"],
            },
            {
                "id": "production_dashboard",
                "name": "生产看板",
                "description": "查看生产看板",
                "features": ["生产看板", "工单进度", "生产效率"],
                "permissions": ["production:dashboard", "work_order:view"],
            },
            {
                "id": "work_order_management",
                "name": "工单管理",
                "description": "查看和管理工单",
                "features": ["工单列表", "工单查询", "工单详情"],
                "permissions": ["work_order:list", "work_order:view"],
            },
        ],
        "dashboard": {
            "widgets": [
                {"type": "statistics", "title": "待报工工单", "api": "/apps/kuaizhizao/work-orders?status=in_progress"},
                {"type": "statistics", "title": "今日报工", "api": "/apps/kuaizhizao/reporting/today"},
                {"type": "list", "title": "待报工工单列表", "api": "/apps/kuaizhizao/work-orders?status=in_progress&limit=10"},
            ],
        },
    },
    "quality": {
        "name": "质量",
        "description": "负责质量检验、质量异常处理、质量报表等",
        "scenarios": [
            {
                "id": "quality_inspection",
                "name": "质量检验",
                "description": "执行质量检验",
                "features": ["来料检验", "过程检验", "成品检验"],
                "permissions": ["incoming_inspection:list", "incoming_inspection:create", "process_inspection:list", "process_inspection:create", "finished_goods_inspection:list", "finished_goods_inspection:create"],
            },
            {
                "id": "quality_exception",
                "name": "质量异常处理",
                "description": "处理质量异常",
                "features": ["质量异常列表", "质量异常创建", "质量异常处理"],
                "permissions": ["quality_exception:list", "quality_exception:create", "quality_exception:handle"],
            },
            {
                "id": "quality_report",
                "name": "质量报表",
                "description": "查看质量报表",
                "features": ["质量统计", "合格率报表", "不良品统计"],
                "permissions": ["quality:report", "quality:statistics"],
            },
        ],
        "dashboard": {
            "widgets": [
                {"type": "statistics", "title": "待检验单据", "api": "/apps/kuaizhizao/inspections/pending"},
                {"type": "statistics", "title": "质量异常", "api": "/apps/kuaizhizao/exceptions/quality?status=open"},
                {"type": "list", "title": "待检验单据列表", "api": "/apps/kuaizhizao/inspections/pending&limit=10"},
            ],
        },
    },
    "planner": {
        "name": "计划",
        "description": "负责生产计划、MRP/LRP运算、工单下达等",
        "scenarios": [
            {
                "id": "production_planning",
                "name": "生产计划",
                "description": "创建和管理生产计划",
                "features": ["生产计划列表", "生产计划创建", "生产计划执行"],
                "permissions": ["production_plan:list", "production_plan:create", "production_plan:execute"],
            },
            {
                "id": "mrp_lrp",
                "name": "MRP/LRP运算",
                "description": "执行MRP/LRP运算",
                "features": ["MRP运算", "LRP运算", "运算结果查看"],
                "permissions": ["mrp:calculate", "lrp:calculate", "mrp:view"],
            },
            {
                "id": "work_order_release",
                "name": "工单下达",
                "description": "下达生产工单",
                "features": ["工单列表", "工单下达", "工单查询"],
                "permissions": ["work_order:list", "work_order:release", "work_order:view"],
            },
        ],
        "dashboard": {
            "widgets": [
                {"type": "statistics", "title": "待执行计划", "api": "/apps/kuaizhizao/production-plans?status=pending"},
                {"type": "statistics", "title": "待下达工单", "api": "/apps/kuaizhizao/work-orders?status=draft"},
                {"type": "list", "title": "待执行计划列表", "api": "/apps/kuaizhizao/production-plans?status=pending&limit=10"},
            ],
        },
    },
    "manager": {
        "name": "管理者",
        "description": "负责系统管理、数据查看、决策支持等",
        "scenarios": [
            {
                "id": "dashboard",
                "name": "工作台",
                "description": "查看工作台和统计数据",
                "features": ["工作台", "统计数据", "待办事项"],
                "permissions": ["dashboard:view", "statistics:view"],
            },
            {
                "id": "report_analysis",
                "name": "报表分析",
                "description": "查看各类报表和分析",
                "features": ["生产报表", "库存报表", "质量报表", "成本报表"],
                "permissions": ["report:view", "report:export"],
            },
            {
                "id": "system_management",
                "name": "系统管理",
                "description": "管理系统配置和用户",
                "features": ["用户管理", "角色管理", "权限管理", "系统配置"],
                "permissions": ["user:manage", "role:manage", "permission:manage", "system:config"],
            },
        ],
        "dashboard": {
            "widgets": [
                {"type": "statistics", "title": "生产统计", "api": "/apps/kuaizhizao/dashboard/statistics"},
                {"type": "statistics", "title": "库存统计", "api": "/apps/kuaizhizao/dashboard/statistics"},
                {"type": "statistics", "title": "质量统计", "api": "/apps/kuaizhizao/dashboard/statistics"},
                {"type": "list", "title": "待办事项", "api": "/apps/kuaizhizao/dashboard/todos"},
            ],
        },
    },
}


class RoleScenarioService:
    """
    角色场景服务类
    
    处理角色使用场景和工作台定制相关的业务逻辑。
    """
    
    @staticmethod
    async def get_role_scenarios(
        tenant_id: int,
        role_id: Optional[int] = None,
        role_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取角色使用场景
        
        Args:
            tenant_id: 组织ID
            role_id: 角色ID（可选）
            role_code: 角色代码（可选）
            
        Returns:
            Dict[str, Any]: 角色使用场景信息
            
        Raises:
            NotFoundError: 当角色不存在时抛出
        """
        # 如果提供了角色ID或代码，获取角色信息
        role = None
        if role_id:
            role = await Role.filter(
                tenant_id=tenant_id,
                id=role_id,
                deleted_at__isnull=True
            ).first()
        elif role_code:
            role = await Role.filter(
                tenant_id=tenant_id,
                code=role_code,
                deleted_at__isnull=True
            ).first()
        
        # 如果没有找到角色，返回所有预定义场景
        if not role:
            return {
                "scenarios": ROLE_SCENARIOS,
            }
        
        # 根据角色代码匹配场景
        role_scenario_key = None
        for key, scenario in ROLE_SCENARIOS.items():
            if role.code.lower() == key or role.code.lower().startswith(key):
                role_scenario_key = key
                break
        
        if not role_scenario_key:
            # 如果没有匹配的场景，返回通用场景
            return {
                "role": {
                    "id": role.id,
                    "uuid": role.uuid,
                    "name": role.name,
                    "code": role.code,
                },
                "scenarios": ROLE_SCENARIOS.get("manager", {}),  # 默认返回管理者场景
            }
        
        return {
            "role": {
                "id": role.id,
                "uuid": role.uuid,
                "name": role.name,
                "code": role.code,
            },
            "scenarios": ROLE_SCENARIOS[role_scenario_key],
        }
    
    @staticmethod
    async def get_role_dashboard(
        tenant_id: int,
        role_id: Optional[int] = None,
        role_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取角色工作台配置
        
        Args:
            tenant_id: 组织ID
            role_id: 角色ID（可选）
            role_code: 角色代码（可选）
            
        Returns:
            Dict[str, Any]: 角色工作台配置
            
        Raises:
            NotFoundError: 当角色不存在时抛出
        """
        # 获取角色场景
        scenario_data = await RoleScenarioService.get_role_scenarios(
            tenant_id=tenant_id,
            role_id=role_id,
            role_code=role_code
        )
        
        # 提取工作台配置
        scenarios = scenario_data.get("scenarios", {})
        if isinstance(scenarios, dict) and "dashboard" in scenarios:
            dashboard_config = scenarios["dashboard"]
        else:
            # 如果没有特定工作台配置，返回通用工作台
            dashboard_config = ROLE_SCENARIOS["manager"]["dashboard"]
        
        return {
            "role": scenario_data.get("role"),
            "dashboard": dashboard_config,
        }
    
    @staticmethod
    async def get_role_permissions(
        tenant_id: int,
        role_id: Optional[int] = None,
        role_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取角色权限
        
        Args:
            tenant_id: 组织ID
            role_id: 角色ID（可选）
            role_code: 角色代码（可选）
            
        Returns:
            Dict[str, Any]: 角色权限信息
            
        Raises:
            NotFoundError: 当角色不存在时抛出
        """
        # 获取角色
        role = None
        if role_id:
            role = await Role.filter(
                tenant_id=tenant_id,
                id=role_id,
                deleted_at__isnull=True
            ).first()
        elif role_code:
            role = await Role.filter(
                tenant_id=tenant_id,
                code=role_code,
                deleted_at__isnull=True
            ).first()
        
        if not role:
            raise NotFoundError("角色", role_id or role_code)
        
        # 获取角色权限
        permissions = await RoleService.get_role_permissions(
            tenant_id=tenant_id,
            role_uuid=role.uuid
        )
        
        return {
            "role": {
                "id": role.id,
                "uuid": role.uuid,
                "name": role.name,
                "code": role.code,
            },
            "permissions": [
                {
                    "id": p.id,
                    "uuid": p.uuid,
                    "name": p.name,
                    "code": p.code,
                    "type": p.type,
                }
                for p in permissions
            ],
        }

