"""
物料来源控制服务模块

提供物料来源验证、变更控制、智能建议等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from loguru import logger

from apps.master_data.models.material import Material, BOM
from apps.master_data.models.process import ProcessRoute
from apps.master_data.models.supplier import Supplier
from apps.master_data.models.customer import Customer
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.purchase_order import PurchaseOrder
from apps.kuaizhizao.utils.material_source_helper import (
    SOURCE_TYPE_MAKE, SOURCE_TYPE_BUY, SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_OUTSOURCE, SOURCE_TYPE_CONFIGURE,
    MANUFACTURING_MODE_FABRICATION, MANUFACTURING_MODE_ASSEMBLY,
    VALID_SOURCE_TYPES,
    validate_material_source_config,
)
from infra.exceptions.exceptions import ValidationError, NotFoundError


class MaterialSourceValidationService:
    """
    物料来源验证服务类
    
    提供物料来源配置的验证功能。
    """
    
    @staticmethod
    async def validate_material_source(
        tenant_id: int,
        material_uuid: str
    ) -> Dict[str, Any]:
        """
        验证物料来源配置
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Returns:
            dict: 验证结果（is_valid, errors, warnings）
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", material_uuid)
        
        if not material.source_type:
            return {
                "is_valid": True,
                "errors": [],
                "warnings": ["物料未设置来源类型，建议配置物料来源类型"],
            }
        
        # 使用辅助函数验证
        is_valid, errors = await validate_material_source_config(
            tenant_id=tenant_id,
            material_id=material.id,
            source_type=material.source_type
        )
        
        # 区分错误和警告
        critical_errors = []
        warnings = []
        
        for error in errors:
            if material.source_type == SOURCE_TYPE_BUY and "建议" in error:
                warnings.append(error)
            else:
                critical_errors.append(error)
        
        return {
            "is_valid": len(critical_errors) == 0,
            "errors": critical_errors,
            "warnings": warnings,
        }
    
    @staticmethod
    async def validate_batch_materials(
        tenant_id: int,
        material_uuids: List[str]
    ) -> Dict[str, Dict[str, Any]]:
        """
        批量验证物料来源配置
        
        Args:
            tenant_id: 租户ID
            material_uuids: 物料UUID列表
            
        Returns:
            dict: 每个物料的验证结果
        """
        results = {}
        
        for material_uuid in material_uuids:
            try:
                result = await MaterialSourceValidationService.validate_material_source(
                    tenant_id=tenant_id,
                    material_uuid=material_uuid
                )
                results[material_uuid] = result
            except Exception as e:
                logger.error(f"验证物料来源失败: {material_uuid}, 错误: {str(e)}")
                results[material_uuid] = {
                    "is_valid": False,
                    "errors": [f"验证失败: {str(e)}"],
                    "warnings": [],
                }
        
        return results


class MaterialSourceChangeService:
    """
    物料来源变更控制服务类
    
    提供物料来源类型变更的审批和控制功能。
    """
    
    @staticmethod
    async def check_change_impact(
        tenant_id: int,
        material_uuid: str,
        new_source_type: str
    ) -> Dict[str, Any]:
        """
        检查物料来源类型变更的影响
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            new_source_type: 新的来源类型
            
        Returns:
            dict: 变更影响分析（影响工单、采购订单等）
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", material_uuid)
        
        if material.source_type == new_source_type:
            return {
                "can_change": True,
                "impact": {
                    "work_orders": [],
                    "purchase_orders": [],
                    "warnings": [],
                },
            }
        
        # 检查在制工单
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            status__in=["pending", "in_progress"],
            deleted_at__isnull=True
        ).all()
        
        # 检查未完成采购订单
        purchase_orders = await PurchaseOrder.filter(
            tenant_id=tenant_id,
            items__material_id=material.id,
            status__in=["pending", "confirmed", "partial_received"],
            deleted_at__isnull=True
        ).distinct().all()
        
        impact = {
            "work_orders": [
                {
                    "uuid": wo.uuid,
                    "code": wo.code,
                    "status": wo.status,
                }
                for wo in work_orders
            ],
            "purchase_orders": [
                {
                    "uuid": po.uuid,
                    "code": po.code,
                    "status": po.status,
                }
                for po in purchase_orders
            ],
            "warnings": [],
        }
        
        # 生成警告信息
        if work_orders:
            impact["warnings"].append(
                f"存在 {len(work_orders)} 个在制工单，变更后需要重新评估"
            )
        
        if purchase_orders:
            impact["warnings"].append(
                f"存在 {len(purchase_orders)} 个未完成采购订单，变更后需要重新评估"
            )
        
        # 判断是否可以变更
        can_change = len(work_orders) == 0 and len(purchase_orders) == 0
        
        return {
            "can_change": can_change,
            "impact": impact,
        }
    
    @staticmethod
    async def apply_source_change(
        tenant_id: int,
        material_uuid: str,
        new_source_type: str,
        new_source_config: Optional[Dict[str, Any]] = None,
        updated_by: int = 1
    ) -> Material:
        """
        应用物料来源类型变更
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            new_source_type: 新的来源类型
            new_source_config: 新的来源配置（可选）
            updated_by: 更新人ID
            
        Returns:
            Material: 更新后的物料对象
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", material_uuid)
        
        if new_source_type not in VALID_SOURCE_TYPES:
            raise ValidationError(f"无效的物料来源类型: {new_source_type}")
        
        # 检查变更影响
        impact_check = await MaterialSourceChangeService.check_change_impact(
            tenant_id=tenant_id,
            material_uuid=material_uuid,
            new_source_type=new_source_type
        )
        
        if not impact_check["can_change"]:
            raise ValidationError(
                f"无法变更物料来源类型，存在影响：{', '.join(impact_check['impact']['warnings'])}"
            )
        
        # 更新物料来源类型
        old_source_type = material.source_type
        material.source_type = new_source_type
        
        if new_source_config is not None:
            material.source_config = new_source_config
        
        await material.save()
        
        # 根据新来源类型自动处理相关配置
        if old_source_type == SOURCE_TYPE_MAKE and new_source_type != SOURCE_TYPE_MAKE:
            # 从自制件改为其他类型，保留BOM和工艺路线（可能还需要）
            pass
        
        if new_source_type == SOURCE_TYPE_MAKE and old_source_type != SOURCE_TYPE_MAKE:
            # 改为自制件，需要验证BOM和工艺路线
            bom_count = await BOM.filter(
                tenant_id=tenant_id,
                material_id=material.id,
                deleted_at__isnull=True
            ).count()
            
            if bom_count == 0:
                logger.warning(f"物料 {material.main_code} 改为自制件，但未配置BOM")
            
            if not material.process_route_id:
                logger.warning(f"物料 {material.main_code} 改为自制件，但未配置工艺路线")
        
        logger.info(
            f"物料来源类型变更成功: {material.main_code}, "
            f"从 {old_source_type} 变更为 {new_source_type}"
        )
        
        return material


class MaterialSourceSuggestionService:
    """
    物料来源智能建议服务类
    
    提供基于物料类型、BOM结构、历史数据的智能建议功能。
    """
    
    @staticmethod
    async def suggest_source_type(
        tenant_id: int,
        material_uuid: str
    ) -> Dict[str, Any]:
        """
        建议物料来源类型
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Returns:
            dict: 建议结果（suggested_type, confidence, reasons）
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", material_uuid)
        
        suggestions = []
        reasons = []
        
        # 基于物料类型建议
        if material.material_type == "FIN":
            # 成品通常建议自制件
            suggestions.append({
                "source_type": SOURCE_TYPE_MAKE,
                "confidence": 0.8,
                "reason": "成品通常需要自制",
            })
        elif material.material_type == "RAW":
            # 原材料通常建议采购件
            suggestions.append({
                "source_type": SOURCE_TYPE_BUY,
                "confidence": 0.9,
                "reason": "原材料通常需要采购",
            })
        elif material.material_type == "SEMI":
            # 半成品可能自制或采购
            suggestions.append({
                "source_type": SOURCE_TYPE_MAKE,
                "confidence": 0.6,
                "reason": "半成品通常自制，但也可以采购",
            })
            suggestions.append({
                "source_type": SOURCE_TYPE_BUY,
                "confidence": 0.4,
                "reason": "半成品也可以采购",
            })
        
        # 基于BOM结构建议
        bom_count = await BOM.filter(
            tenant_id=tenant_id,
            material_id=material.id,
            approval_status="approved",
            deleted_at__isnull=True
        ).count()
        
        if bom_count > 0:
            # 有BOM，建议自制件
            suggestions.append({
                "source_type": SOURCE_TYPE_MAKE,
                "confidence": 0.9,
                "reason": "已配置BOM，建议设为自制件",
            })
        
        # 基于工艺路线建议
        if material.process_route_id:
            suggestions.append({
                "source_type": SOURCE_TYPE_MAKE,
                "confidence": 0.8,
                "reason": "已配置工艺路线，建议设为自制件",
            })
        
        # 基于变体管理建议
        if material.variant_managed:
            suggestions.append({
                "source_type": SOURCE_TYPE_CONFIGURE,
                "confidence": 0.7,
                "reason": "已启用变体管理，建议设为配置件",
            })
        
        # 选择置信度最高的建议
        if suggestions:
            best_suggestion = max(suggestions, key=lambda x: x["confidence"])
            reasons = [s["reason"] for s in suggestions if s["source_type"] == best_suggestion["source_type"]]
            result = {
                "suggested_type": best_suggestion["source_type"],
                "confidence": best_suggestion["confidence"],
                "reasons": reasons,
                "all_suggestions": suggestions,
            }
            # 若建议自制件，可进一步建议制造模式（加工型/装配型）
            if best_suggestion["source_type"] == SOURCE_TYPE_MAKE:
                bom_count = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    approval_status="approved",
                    deleted_at__isnull=True
                ).count()
                has_process_route = bool(material.process_route_id)
                if bom_count > 1 and not has_process_route:
                    result["suggested_manufacturing_mode"] = MANUFACTURING_MODE_ASSEMBLY
                    result["manufacturing_mode_reason"] = "已配置多组件BOM，建议选择装配型"
                    result["reasons"] = reasons + [result["manufacturing_mode_reason"]]
                elif has_process_route and bom_count <= 1:
                    result["suggested_manufacturing_mode"] = MANUFACTURING_MODE_FABRICATION
                    result["manufacturing_mode_reason"] = "已配置工艺路线且BOM较简单，建议选择加工型"
                    result["reasons"] = reasons + [result["manufacturing_mode_reason"]]
            return result
        else:
            return {
                "suggested_type": None,
                "confidence": 0.0,
                "reasons": ["无法基于现有信息给出建议"],
                "all_suggestions": [],
            }
    
    @staticmethod
    async def check_config_completeness(
        tenant_id: int,
        material_uuid: str
    ) -> Dict[str, Any]:
        """
        检查物料来源配置完整性
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Returns:
            dict: 配置完整性检查结果
        """
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError("物料", material_uuid)
        
        missing_configs = []
        warnings = []
        
        if not material.source_type:
            missing_configs.append("物料来源类型")
        
        if material.source_type:
            # 根据来源类型检查配置
            source_config = material.source_config or {}
            
            if material.source_type == SOURCE_TYPE_MAKE:
                # 自制件根据制造模式区分：加工型工艺路线必填、BOM可选；装配型BOM必填、工艺路线可选
                manufacturing_mode = source_config.get("manufacturing_mode")
                bom_count = await BOM.filter(
                    tenant_id=tenant_id,
                    material_id=material.id,
                    approval_status="approved",
                    deleted_at__isnull=True
                ).count()
                has_process_route = bool(material.process_route_id)

                if manufacturing_mode == MANUFACTURING_MODE_FABRICATION:
                    if not has_process_route:
                        missing_configs.append("工艺路线配置")
                    if bom_count == 0:
                        warnings.append("加工型建议配置BOM（材料清单）")
                elif manufacturing_mode == MANUFACTURING_MODE_ASSEMBLY:
                    if bom_count == 0:
                        missing_configs.append("BOM配置")
                    if not has_process_route:
                        warnings.append("装配型建议配置工艺路线（装配工序）")
                else:
                    # 未设置制造模式：沿用原逻辑
                    if bom_count == 0:
                        missing_configs.append("BOM配置")
                    if not has_process_route:
                        missing_configs.append("工艺路线配置")
            
            elif material.source_type == SOURCE_TYPE_BUY:
                # 采购件建议配置默认供应商
                if not source_config.get("default_supplier_id"):
                    warnings.append("建议配置默认供应商")
            
            elif material.source_type == SOURCE_TYPE_OUTSOURCE:
                # 委外件需要委外供应商和委外工序
                if not source_config.get("outsource_supplier_id"):
                    missing_configs.append("委外供应商配置")
                
                if not source_config.get("outsource_operation"):
                    missing_configs.append("委外工序配置")
            
            elif material.source_type == SOURCE_TYPE_CONFIGURE:
                # 配置件需要变体属性和BOM变体
                if not material.variant_attributes:
                    missing_configs.append("变体属性配置")
                
                if not source_config.get("bom_variants"):
                    missing_configs.append("BOM变体配置")
        
        return {
            "is_complete": len(missing_configs) == 0,
            "missing_configs": missing_configs,
            "warnings": warnings,
        }
