"""
上线向导服务模块

提供角色上线准备和使用场景引导的业务逻辑处理。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Dict, Any, Optional
from core.models.role import Role
from core.services.role_scenario_service import ROLE_SCENARIOS
from infra.exceptions.exceptions import NotFoundError
from loguru import logger


# 角色上线准备清单（预定义）
ROLE_ONBOARDING_GUIDES: Dict[str, Dict[str, Any]] = {
    "sales": {
        "name": "销售",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "customer_data", "name": "导入客户数据", "required": True, "description": "导入客户基本信息、联系方式等"},
                    {"id": "product_data", "name": "导入产品数据", "required": True, "description": "导入产品信息、价格等"},
                    {"id": "sales_template", "name": "配置销售模板", "required": False, "description": "配置销售订单模板、报价模板等"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配销售角色", "required": True, "description": "为用户分配销售角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认销售相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "sales_order_training", "name": "销售订单操作培训", "required": True, "description": "学习如何创建、编辑、查询销售订单"},
                    {"id": "customer_management_training", "name": "客户管理培训", "required": True, "description": "学习如何管理客户信息"},
                ],
            },
        ],
    },
    "purchase": {
        "name": "采购",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "supplier_data", "name": "导入供应商数据", "required": True, "description": "导入供应商基本信息、联系方式等"},
                    {"id": "material_data", "name": "导入物料数据", "required": True, "description": "导入物料信息、价格等"},
                    {"id": "purchase_template", "name": "配置采购模板", "required": False, "description": "配置采购订单模板等"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配采购角色", "required": True, "description": "为用户分配采购角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认采购相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "purchase_order_training", "name": "采购订单操作培训", "required": True, "description": "学习如何创建、编辑、查询采购订单"},
                    {"id": "supplier_management_training", "name": "供应商管理培训", "required": True, "description": "学习如何管理供应商信息"},
                ],
            },
        ],
    },
    "warehouse": {
        "name": "仓库",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "warehouse_data", "name": "创建仓库信息", "required": True, "description": "创建仓库、库位等基础数据"},
                    {"id": "inventory_data", "name": "导入期初库存", "required": True, "description": "导入期初库存数据"},
                    {"id": "material_data", "name": "确认物料数据", "required": True, "description": "确认物料数据已完整"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配仓库角色", "required": True, "description": "为用户分配仓库角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认仓库相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "inventory_management_training", "name": "库存管理培训", "required": True, "description": "学习如何查询、管理库存"},
                    {"id": "stock_in_out_training", "name": "出入库操作培训", "required": True, "description": "学习如何执行出入库操作"},
                ],
            },
        ],
    },
    "production": {
        "name": "生产",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "workstation_data", "name": "创建工作中心/工位", "required": True, "description": "创建工作中心、工位等基础数据"},
                    {"id": "bom_data", "name": "确认BOM数据", "required": True, "description": "确认BOM数据已完整"},
                    {"id": "routing_data", "name": "确认工艺路线", "required": False, "description": "确认工艺路线数据"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配生产角色", "required": True, "description": "为用户分配生产角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认生产相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "reporting_training", "name": "报工操作培训", "required": True, "description": "学习如何执行报工操作"},
                    {"id": "work_order_training", "name": "工单查看培训", "required": True, "description": "学习如何查看工单信息"},
                ],
            },
        ],
    },
    "quality": {
        "name": "质量",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "inspection_standard", "name": "配置检验标准", "required": True, "description": "配置来料、过程、成品检验标准"},
                    {"id": "quality_template", "name": "配置质量模板", "required": False, "description": "配置质量检验模板"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配质量角色", "required": True, "description": "为用户分配质量角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认质量相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "inspection_training", "name": "检验操作培训", "required": True, "description": "学习如何执行质量检验"},
                    {"id": "quality_exception_training", "name": "质量异常处理培训", "required": True, "description": "学习如何处理质量异常"},
                ],
            },
        ],
    },
    "planner": {
        "name": "计划",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "material_data", "name": "确认物料数据", "required": True, "description": "确认物料数据已完整"},
                    {"id": "bom_data", "name": "确认BOM数据", "required": True, "description": "确认BOM数据已完整"},
                    {"id": "sales_forecast_data", "name": "导入销售预测", "required": False, "description": "导入销售预测数据"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配计划角色", "required": True, "description": "为用户分配计划角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认计划相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "planning_training", "name": "生产计划培训", "required": True, "description": "学习如何创建和执行生产计划"},
                    {"id": "mrp_training", "name": "MRP/LRP运算培训", "required": True, "description": "学习如何执行MRP/LRP运算"},
                ],
            },
        ],
    },
    "manager": {
        "name": "管理者",
        "checklist": [
            {
                "id": "data_preparation",
                "name": "数据准备",
                "items": [
                    {"id": "organization_data", "name": "完善组织信息", "required": True, "description": "完善组织基本信息、设置等"},
                    {"id": "user_data", "name": "创建用户账号", "required": True, "description": "为各角色创建用户账号"},
                    {"id": "role_data", "name": "配置角色权限", "required": True, "description": "配置各角色的权限"},
                ],
            },
            {
                "id": "permission_config",
                "name": "权限配置",
                "items": [
                    {"id": "role_assignment", "name": "分配管理角色", "required": True, "description": "为用户分配管理角色"},
                    {"id": "permission_review", "name": "检查权限设置", "required": True, "description": "确认管理相关权限已正确配置"},
                ],
            },
            {
                "id": "training",
                "name": "操作培训",
                "items": [
                    {"id": "dashboard_training", "name": "工作台使用培训", "required": True, "description": "学习如何使用工作台查看统计数据"},
                    {"id": "report_training", "name": "报表查看培训", "required": True, "description": "学习如何查看各类报表"},
                ],
            },
        ],
    },
}


class OnboardingService:
    """
    上线向导服务类
    
    处理角色上线准备和使用场景引导相关的业务逻辑。
    """
    
    @staticmethod
    async def get_role_onboarding_guide(
        tenant_id: int,
        role_id: Optional[int] = None,
        role_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取角色上线准备向导
        
        Args:
            tenant_id: 组织ID
            role_id: 角色ID（可选）
            role_code: 角色代码（可选）
            
        Returns:
            Dict[str, Any]: 角色上线准备向导信息
        """
        # 获取角色信息
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
        
        # 根据角色代码匹配向导
        role_guide_key = None
        if role:
            for key in ROLE_ONBOARDING_GUIDES.keys():
                if role.code.lower() == key or role.code.lower().startswith(key):
                    role_guide_key = key
                    break
        
        if not role_guide_key:
            # 如果没有匹配的向导，返回通用向导（管理者）
            role_guide_key = "manager"
        
        guide = ROLE_ONBOARDING_GUIDES[role_guide_key]
        
        return {
            "role": {
                "id": role.id if role else None,
                "uuid": role.uuid if role else None,
                "name": role.name if role else "通用",
                "code": role.code if role else "general",
            } if role else None,
            "guide": guide,
        }
    
    @staticmethod
    async def get_role_scenario_guide(
        tenant_id: int,
        role_id: Optional[int] = None,
        role_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取角色使用场景向导
        
        Args:
            tenant_id: 组织ID
            role_id: 角色ID（可选）
            role_code: 角色代码（可选）
            
        Returns:
            Dict[str, Any]: 角色使用场景向导信息
        """
        # 获取角色场景（复用角色场景服务）
        from core.services.role_scenario_service import RoleScenarioService
        scenario_data = await RoleScenarioService.get_role_scenarios(
            tenant_id=tenant_id,
            role_id=role_id,
            role_code=role_code
        )
        
        scenarios = scenario_data.get("scenarios", {})
        if isinstance(scenarios, dict):
            # 提取场景信息
            scenario_list = scenarios.get("scenarios", [])
            
            # 为每个场景添加操作流程和常见问题
            enhanced_scenarios = []
            for scenario in scenario_list:
                enhanced_scenario = {
                    **scenario,
                    "workflow": [
                        {"step": 1, "name": "进入功能", "description": f"从菜单进入{scenario['name']}功能"},
                        {"step": 2, "name": "执行操作", "description": f"根据业务需求执行{scenario['name']}相关操作"},
                        {"step": 3, "name": "保存数据", "description": "保存操作结果"},
                    ],
                    "common_issues": [
                        {"question": f"如何创建{scenario['name']}？", "answer": f"点击创建按钮，填写必要信息后保存即可。"},
                        {"question": f"如何查询{scenario['name']}？", "answer": f"使用搜索功能，输入关键词进行查询。"},
                    ],
                    "best_practices": [
                        f"建议定期查看{scenario['name']}数据，及时处理异常情况",
                        f"操作前请确认数据准确性，避免错误操作",
                    ],
                }
                enhanced_scenarios.append(enhanced_scenario)
            
            return {
                "role": scenario_data.get("role"),
                "scenarios": {
                    "name": scenarios.get("name", ""),
                    "description": scenarios.get("description", ""),
                    "scenarios": enhanced_scenarios,
                },
            }
        else:
            return {
                "role": scenario_data.get("role"),
                "scenarios": {
                    "name": "通用场景",
                    "description": "通用使用场景",
                    "scenarios": [],
                },
            }

