"""
AI智能建议规则模块

实现各业务场景的建议规则。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta

from core.services.ai.suggestion_engine import (
    SuggestionRule,
    Suggestion,
    SuggestionType,
    SuggestionPriority,
)
from loguru import logger


# ========== 系统初始化建议规则 ==========

class InitOrganizationInfoRule(SuggestionRule):
    """组织信息完善建议规则"""
    
    def __init__(self):
        super().__init__("init_organization_info", "组织信息完善建议")
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """检查组织信息是否完善"""
        suggestions = []
        
        # TODO: 检查组织信息是否完善
        # 如果组织信息不完整，生成建议
        if not context.get("organization_complete", False):
            suggestions.append(Suggestion(
                id=f"init_org_info_{tenant_id}",
                type=SuggestionType.INFO,
                priority=SuggestionPriority.MEDIUM,
                title="完善组织信息",
                content="建议完善组织信息，包括组织代码、行业、规模等，以便系统更好地为您提供服务。",
                action="/system/organizations/edit",
                action_label="去完善",
            ))
        
        return suggestions


class InitDefaultSettingsRule(SuggestionRule):
    """默认设置建议规则"""
    
    def __init__(self):
        super().__init__("init_default_settings", "默认设置建议")
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """检查默认设置是否配置"""
        suggestions = []
        
        # TODO: 检查默认设置是否配置
        # 如果默认设置未配置，生成建议
        if not context.get("default_settings_configured", False):
            suggestions.append(Suggestion(
                id=f"init_default_settings_{tenant_id}",
                type=SuggestionType.INFO,
                priority=SuggestionPriority.LOW,
                title="配置默认设置",
                content="建议配置默认设置，包括时区、货币、语言等，以便系统更好地适应您的使用习惯。",
                action="/system/settings",
                action_label="去配置",
            ))
        
        return suggestions


# ========== 工单管理建议规则 ==========

class WorkOrderMaterialShortageRule(SuggestionRule):
    """工单缺料建议规则"""
    
    def __init__(self):
        super().__init__("work_order_material_shortage", "工单缺料建议")
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """检查工单是否缺料"""
        suggestions = []
        
        # 从上下文获取缺料信息
        material_shortages = context.get("material_shortages", [])
        
        for shortage in material_shortages:
            suggestions.append(Suggestion(
                id=f"wo_material_shortage_{shortage.get('work_order_id')}_{shortage.get('material_id')}",
                type=SuggestionType.WARNING,
                priority=SuggestionPriority.HIGH,
                title=f"工单 {shortage.get('work_order_code', '')} 缺料",
                content=f"物料 {shortage.get('material_name', '')} 缺料 {shortage.get('shortage_quantity', 0)}，建议及时处理。",
                action=f"/apps/kuaizhizao/work-orders/{shortage.get('work_order_id')}",
                action_label="查看工单",
                metadata=shortage,
            ))
        
        return suggestions


class WorkOrderDelayRule(SuggestionRule):
    """工单延期建议规则"""
    
    def __init__(self):
        super().__init__("work_order_delay", "工单延期建议")
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """检查工单是否延期"""
        suggestions = []
        
        # 从上下文获取延期工单信息
        delayed_work_orders = context.get("delayed_work_orders", [])
        
        for wo in delayed_work_orders:
            delay_days = wo.get("delay_days", 0)
            priority = SuggestionPriority.HIGH if delay_days > 3 else SuggestionPriority.MEDIUM
            
            suggestions.append(Suggestion(
                id=f"wo_delay_{wo.get('work_order_id')}",
                type=SuggestionType.WARNING,
                priority=priority,
                title=f"工单 {wo.get('work_order_code', '')} 延期",
                content=f"工单已延期 {delay_days} 天，建议及时调整计划或加快生产进度。",
                action=f"/apps/kuaizhizao/work-orders/{wo.get('work_order_id')}",
                action_label="查看工单",
                metadata=wo,
            ))
        
        return suggestions


# ========== 报工建议规则 ==========

class ReportingQualityIssueRule(SuggestionRule):
    """报工质量问题建议规则"""
    
    def __init__(self):
        super().__init__("reporting_quality_issue", "报工质量问题建议")
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """检查报工质量问题"""
        suggestions = []
        
        # 从上下文获取质量问题信息
        quality_issues = context.get("quality_issues", [])
        
        for issue in quality_issues:
            suggestions.append(Suggestion(
                id=f"reporting_quality_{issue.get('reporting_id')}",
                type=SuggestionType.WARNING,
                priority=SuggestionPriority.MEDIUM,
                title="报工质量问题",
                content=f"报工记录存在质量问题：{issue.get('issue_description', '')}，建议及时处理。",
                action=f"/apps/kuaizhizao/reporting/{issue.get('reporting_id')}",
                action_label="查看报工",
                metadata=issue,
            ))
        
        return suggestions


# ========== 库存管理建议规则 ==========

class InventoryLowStockRule(SuggestionRule):
    """库存低库存建议规则"""
    
    def __init__(self):
        super().__init__("inventory_low_stock", "库存低库存建议")
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """检查低库存物料"""
        suggestions = []
        
        # 从上下文获取低库存信息
        low_stock_items = context.get("low_stock_items", [])
        
        for item in low_stock_items:
            suggestions.append(Suggestion(
                id=f"inventory_low_stock_{item.get('material_id')}",
                type=SuggestionType.WARNING,
                priority=SuggestionPriority.MEDIUM,
                title=f"物料 {item.get('material_name', '')} 库存不足",
                content=f"物料当前库存 {item.get('current_quantity', 0)}，低于安全库存 {item.get('safety_stock', 0)}，建议及时补货。",
                action=f"/apps/master-data/materials/{item.get('material_id')}",
                action_label="查看物料",
                metadata=item,
            ))
        
        return suggestions


# ========== 生产看板建议规则 ==========

class ProductionEfficiencyRule(SuggestionRule):
    """生产效率建议规则"""
    
    def __init__(self):
        super().__init__("production_efficiency", "生产效率建议")
    
    async def check(self, tenant_id: int, context: Dict[str, Any]) -> List[Suggestion]:
        """检查生产效率"""
        suggestions = []
        
        # 从上下文获取生产效率信息
        efficiency = context.get("efficiency", {})
        current_efficiency = efficiency.get("current", 0)
        target_efficiency = efficiency.get("target", 0)
        
        if current_efficiency < target_efficiency * 0.8:
            suggestions.append(Suggestion(
                id=f"production_efficiency_{tenant_id}",
                type=SuggestionType.OPTIMIZATION,
                priority=SuggestionPriority.MEDIUM,
                title="生产效率偏低",
                content=f"当前生产效率 {current_efficiency:.1f}%，低于目标效率 {target_efficiency:.1f}%，建议优化生产流程。",
                action="/apps/kuaizhizao/production/dashboard",
                action_label="查看看板",
                metadata=efficiency,
            ))
        
        return suggestions

