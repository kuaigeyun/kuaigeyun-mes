"""
供应链风险服务模块

提供供应链风险的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiscm.models.supply_chain_risk import SupplyChainRisk
from apps.kuaiscm.schemas.supply_chain_risk_schemas import (
    SupplyChainRiskCreate, SupplyChainRiskUpdate, SupplyChainRiskResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class SupplyChainRiskService:
    """供应链风险服务"""
    
    @staticmethod
    async def create_supply_chain_risk(
        tenant_id: int,
        data: SupplyChainRiskCreate
    ) -> SupplyChainRiskResponse:
        """创建供应链风险"""
        existing = await SupplyChainRisk.filter(
            tenant_id=tenant_id,
            risk_no=data.risk_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"供应链风险编号 {data.risk_no} 已存在")
        
        risk = await SupplyChainRisk.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SupplyChainRiskResponse.model_validate(risk)
    
    @staticmethod
    async def get_supply_chain_risk_by_uuid(
        tenant_id: int,
        risk_uuid: str
    ) -> SupplyChainRiskResponse:
        """根据UUID获取供应链风险"""
        risk = await SupplyChainRisk.filter(
            tenant_id=tenant_id,
            uuid=risk_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not risk:
            raise NotFoundError(f"供应链风险 {risk_uuid} 不存在")
        
        return SupplyChainRiskResponse.model_validate(risk)
    
    @staticmethod
    async def list_supply_chain_risks(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        risk_type: Optional[str] = None,
        risk_level: Optional[str] = None,
        warning_status: Optional[str] = None
    ) -> List[SupplyChainRiskResponse]:
        """获取供应链风险列表"""
        query = SupplyChainRisk.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if risk_type:
            query = query.filter(risk_type=risk_type)
        if risk_level:
            query = query.filter(risk_level=risk_level)
        if warning_status:
            query = query.filter(warning_status=warning_status)
        
        risks = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [SupplyChainRiskResponse.model_validate(r) for r in risks]
    
    @staticmethod
    async def update_supply_chain_risk(
        tenant_id: int,
        risk_uuid: str,
        data: SupplyChainRiskUpdate
    ) -> SupplyChainRiskResponse:
        """更新供应链风险"""
        risk = await SupplyChainRisk.filter(
            tenant_id=tenant_id,
            uuid=risk_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not risk:
            raise NotFoundError(f"供应链风险 {risk_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(risk, key, value)
        
        await risk.save()
        
        return SupplyChainRiskResponse.model_validate(risk)
    
    @staticmethod
    async def delete_supply_chain_risk(
        tenant_id: int,
        risk_uuid: str
    ) -> None:
        """删除供应链风险（软删除）"""
        risk = await SupplyChainRisk.filter(
            tenant_id=tenant_id,
            uuid=risk_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not risk:
            raise NotFoundError(f"供应链风险 {risk_uuid} 不存在")
        
        risk.deleted_at = datetime.utcnow()
        await risk.save()

