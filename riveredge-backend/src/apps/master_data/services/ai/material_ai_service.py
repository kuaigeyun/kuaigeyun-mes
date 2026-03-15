"""
物料 AI 建议服务（简易版）

提供物料相关的 AI 建议功能，包括重复物料识别、配置建议等。

Author: Luigi Lu
Date: 2026-01-09
"""

from typing import Dict, Any, List, Optional
from loguru import logger

from apps.master_data.models.material import Material
from apps.master_data.services.material_code_service import MaterialCodeService


class MaterialAIService:
    """
    物料 AI 建议服务
    
    提供物料相关的 AI 建议功能，当前实现基于规则的简单建议。
    后续可扩展为调用外部 AI API（如 OpenAI、Claude 等）。
    """
    
    @staticmethod
    async def generate_suggestions(
        tenant_id: int,
        material_id: Optional[int] = None,
        material_name: Optional[str] = None,
        specification: Optional[str] = None,
        base_unit: Optional[str] = None,
        source_type: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        生成物料 AI 建议（简易版）
        
        支持两种场景：
        1. 创建前预览（material_id=None）：基于输入信息生成建议
        2. 创建后建议（material_id 有值）：基于已创建的物料生成建议
        
        当前实现：基于规则的简单建议
        后续可扩展：调用外部 AI API（如 OpenAI、Claude 等）
        
        Args:
            tenant_id: 租户ID
            material_id: 物料ID（可选，创建前为 None）
            material_name: 物料名称
            specification: 规格（可选）
            base_unit: 基础单位（可选）
            source_type: 物料来源类型（可选）
            
        Returns:
            List[Dict]: 建议列表，格式：
            [
                {
                    "type": "duplicate_material" | "configuration" | "optimization",
                    "level": "info" | "warning" | "error",
                    "title": "建议标题",
                    "message": "建议消息",
                    "details": [...],
                    "actions": [...]  # 可选
                }
            ]
        """
        suggestions = []
        
        if not material_name:
            return suggestions
        
        # 建议1：检查重复物料（创建前和创建后都可用）
        try:
            duplicates = await MaterialCodeService.find_duplicate_materials(
                tenant_id=tenant_id,
                name=material_name,
                specification=specification,
                base_unit=base_unit,
            )
            
            if duplicates:
                # 按置信度分类
                high_confidence = [d for d in duplicates if d["confidence"] == "high"]
                medium_confidence = [d for d in duplicates if d["confidence"] == "medium"]
                low_confidence = [d for d in duplicates if d["confidence"] == "low"]
                
                # 高置信度重复物料（警告）
                if high_confidence:
                    suggestions.append({
                        "type": "duplicate_material",
                        "level": "warning",
                        "title": "发现高置信度重复物料",
                        "message": f"检测到 {len(high_confidence)} 个高置信度重复物料，建议合并",
                        "details": [
                            {
                                "material_id": d["material"].id,
                                "material_uuid": str(d["material"].uuid),
                                "material_name": d["material"].name,
                                "main_code": d["material"].main_code,
                                "specification": d["material"].specification,
                                "confidence": d["confidence"],
                                "match_score": d["match_score"],
                                "reasons": d["reasons"],
                            }
                            for d in high_confidence[:5]  # 最多显示5个
                        ],
                        "actions": [
                            {
                                "label": "查看详情",
                                "action": "view_material",
                                "params": {"material_uuid": str(d["material"].uuid)},
                            }
                            for d in high_confidence[:3]  # 最多3个操作
                        ],
                    })
                
                # 中置信度重复物料（信息提示）
                if medium_confidence:
                    suggestions.append({
                        "type": "duplicate_material",
                        "level": "info",
                        "title": "发现可能重复的物料",
                        "message": f"检测到 {len(medium_confidence)} 个可能重复的物料，请确认",
                        "details": [
                            {
                                "material_id": d["material"].id,
                                "material_uuid": str(d["material"].uuid),
                                "material_name": d["material"].name,
                                "main_code": d["material"].main_code,
                                "confidence": d["confidence"],
                                "match_score": d["match_score"],
                                "reasons": d["reasons"],
                            }
                            for d in medium_confidence[:3]  # 最多显示3个
                        ],
                    })
        except Exception as e:
            logger.warning(f"检查重复物料失败: {e}")
        
        # 建议2：配置建议（基于物料来源类型）
        if source_type:
            config_suggestions = MaterialAIService._generate_configuration_suggestions(
                source_type=source_type,
                specification=specification,
            )
            if config_suggestions:
                suggestions.extend(config_suggestions)
        
        # 建议3：数据完整性检查（如果 material_id 有值，可以检查更多信息）
        if material_id:
            try:
                material = await Material.filter(
                    tenant_id=tenant_id,
                    id=material_id,
                    deleted_at__isnull=True
                ).first()
                
                if material:
                    completeness_suggestions = MaterialAIService._check_data_completeness(material)
                    if completeness_suggestions:
                        suggestions.extend(completeness_suggestions)
            except Exception as e:
                logger.warning(f"检查数据完整性失败: {e}")
        
        return suggestions
    
    @staticmethod
    def _generate_configuration_suggestions(
        source_type: str,
        specification: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        生成配置建议（基于物料来源类型）
        
        Args:
            source_type: 物料来源类型（Make/Buy/Outsource/Phantom/Configure）
            specification: 规格（可选）
            
        Returns:
            List[Dict]: 配置建议列表
        """
        suggestions = []
        
        if source_type == "Buy":
            suggestions.append({
                "type": "configuration",
                "level": "info",
                "title": "采购件配置建议",
                "message": "建议配置安全库存、默认仓库和采购单位",
                "details": [
                    "采购件通常需要设置安全库存，避免缺料",
                    "建议配置默认仓库，便于入库操作",
                    "建议配置采购单位（如：吨、kg），便于采购管理",
                ],
            })
        elif source_type in ("Make", "Configure"):
            suggestions.append({
                "type": "configuration",
                "level": "info",
                "title": "自制件配置建议",
                "message": "建议配置BOM、工艺路线、安全库存和默认仓库",
                "details": [
                    "自制件需要配置BOM和工艺路线",
                    "建议配置安全库存，保证及时交付",
                    "建议配置默认仓库，便于库存管理",
                ],
            })
        elif source_type == "Outsource":
            suggestions.append({
                "type": "configuration",
                "level": "info",
                "title": "委外件配置建议",
                "message": "建议配置工艺路线、委外工序和委外供应商",
                "details": [
                    "委外件需要配置工艺路线和委外工序",
                    "建议配置委外供应商，便于委外管理",
                ],
            })
        
        return suggestions
    
    @staticmethod
    def _check_data_completeness(material: Material) -> List[Dict[str, Any]]:
        """
        检查数据完整性
        
        Args:
            material: 物料对象
            
        Returns:
            List[Dict]: 完整性检查建议列表
        """
        suggestions = []
        missing_fields = []
        
        # 检查关键字段
        if not material.specification:
            missing_fields.append("规格")
        
        if not material.group_id:
            missing_fields.append("物料分组")
        
        # 检查默认值配置
        if not hasattr(material, 'defaults') or not material.defaults:
            missing_fields.append("默认值配置（如：默认仓库、安全库存等）")
        
        if missing_fields:
            suggestions.append({
                "type": "completeness",
                "level": "info",
                "title": "数据完整性建议",
                "message": f"建议补充以下字段：{', '.join(missing_fields)}",
                "details": missing_fields,
            })
        
        return suggestions
