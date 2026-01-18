"""
优化建议推送服务模块

提供优化建议的生成和推送功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger

from core.services.usage_analysis.usage_analysis_service import UsageAnalysisService


class OptimizationSuggestionService:
    """
    优化建议推送服务类
    
    提供基于使用情况分析的优化建议生成和推送功能。
    """
    
    def __init__(self):
        self.usage_analysis_service = UsageAnalysisService()
    
    async def generate_suggestions(
        self,
        tenant_id: int
    ) -> List[Dict[str, Any]]:
        """
        生成优化建议
        
        Args:
            tenant_id: 组织ID
            
        Returns:
            List[Dict[str, Any]]: 优化建议列表
        """
        suggestions = []
        
        # 获取使用情况分析
        function_usage = await self.usage_analysis_service.analyze_function_usage(tenant_id)
        data_quality = await self.usage_analysis_service.analyze_data_quality(tenant_id)
        performance = await self.usage_analysis_service.analyze_performance(tenant_id)
        
        # 基于功能使用分析生成建议
        for unused_func in function_usage.get("unused_functions", []):
            suggestions.append({
                "type": "function_optimization",
                "category": "功能优化",
                "title": f"建议使用功能：{unused_func['function_name']}",
                "description": f"该功能已{unused_func['days_unused']}天未使用，建议了解并使用该功能以提高系统利用率",
                "priority": "low",
                "action": f"前往{unused_func['function_name']}页面",
                "related_data": unused_func,
            })
        
        # 基于数据质量分析生成建议
        for issue in data_quality.get("issues", []):
            priority = "high" if issue["severity"] == "high" else ("medium" if issue["severity"] == "medium" else "low")
            suggestions.append({
                "type": "data_optimization",
                "category": "数据优化",
                "title": f"修复数据质量问题：{issue['type']}",
                "description": issue["description"],
                "priority": priority,
                "action": "前往数据质量保障页面处理",
                "related_data": issue,
            })
        
        # 基于性能分析生成建议
        for issue in performance.get("issues", []):
            priority = "high" if issue["severity"] == "high" else ("medium" if issue["severity"] == "medium" else "low")
            suggestions.append({
                "type": "performance_optimization",
                "category": "性能优化",
                "title": f"优化性能问题：{issue['type']}",
                "description": issue["description"],
                "priority": priority,
                "action": "查看性能分析报告",
                "related_data": issue,
            })
        
        # 基于数据质量评分生成建议
        if data_quality.get("overall_score", 100) < 90:
            suggestions.append({
                "type": "data_optimization",
                "category": "数据优化",
                "title": "数据质量需要提升",
                "description": f"当前数据质量评分为{data_quality.get('overall_score')}分，建议提升数据质量以提高系统可靠性",
                "priority": "medium",
                "action": "前往数据质量保障页面",
                "related_data": data_quality,
            })
        
        return suggestions
    
    async def get_suggestions_by_category(
        self,
        tenant_id: int,
        category: str = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        按分类获取优化建议
        
        Args:
            tenant_id: 组织ID
            category: 分类（可选：function_optimization/data_optimization/performance_optimization）
            
        Returns:
            Dict[str, List[Dict[str, Any]]]: 按分类的建议列表
        """
        all_suggestions = await self.generate_suggestions(tenant_id)
        
        if category:
            return {
                category: [s for s in all_suggestions if s["type"] == category]
            }
        
        # 按分类分组
        categorized = {
            "function_optimization": [],
            "data_optimization": [],
            "performance_optimization": [],
        }
        
        for suggestion in all_suggestions:
            suggestion_type = suggestion.get("type", "")
            if suggestion_type in categorized:
                categorized[suggestion_type].append(suggestion)
        
        return categorized
    
    async def get_suggestions_by_priority(
        self,
        tenant_id: int,
        priority: str = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        按优先级获取优化建议
        
        Args:
            tenant_id: 组织ID
            priority: 优先级（可选：high/medium/low）
            
        Returns:
            Dict[str, List[Dict[str, Any]]]: 按优先级的建议列表
        """
        all_suggestions = await self.generate_suggestions(tenant_id)
        
        if priority:
            return {
                priority: [s for s in all_suggestions if s.get("priority") == priority]
            }
        
        # 按优先级分组
        prioritized = {
            "high": [],
            "medium": [],
            "low": [],
        }
        
        for suggestion in all_suggestions:
            suggestion_priority = suggestion.get("priority", "low")
            if suggestion_priority in prioritized:
                prioritized[suggestion_priority].append(suggestion)
        
        return prioritized
