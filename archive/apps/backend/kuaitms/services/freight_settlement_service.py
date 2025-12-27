"""
运费结算服务模块

提供运费结算的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaitms.models.freight_settlement import FreightSettlement
from apps.kuaitms.schemas.freight_settlement_schemas import (
    FreightSettlementCreate, FreightSettlementUpdate, FreightSettlementResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class FreightSettlementService:
    """运费结算服务"""
    
    @staticmethod
    async def create_freight_settlement(
        tenant_id: int,
        data: FreightSettlementCreate
    ) -> FreightSettlementResponse:
        """创建运费结算"""
        existing = await FreightSettlement.filter(
            tenant_id=tenant_id,
            settlement_no=data.settlement_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"运费结算编号 {data.settlement_no} 已存在")
        
        settlement = await FreightSettlement.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return FreightSettlementResponse.model_validate(settlement)
    
    @staticmethod
    async def get_freight_settlement_by_uuid(
        tenant_id: int,
        settlement_uuid: str
    ) -> FreightSettlementResponse:
        """根据UUID获取运费结算"""
        settlement = await FreightSettlement.filter(
            tenant_id=tenant_id,
            uuid=settlement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not settlement:
            raise NotFoundError(f"运费结算 {settlement_uuid} 不存在")
        
        return FreightSettlementResponse.model_validate(settlement)
    
    @staticmethod
    async def list_freight_settlements(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        settlement_status: Optional[str] = None
    ) -> List[FreightSettlementResponse]:
        """获取运费结算列表"""
        query = FreightSettlement.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if settlement_status:
            query = query.filter(settlement_status=settlement_status)
        
        settlements = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [FreightSettlementResponse.model_validate(s) for s in settlements]
    
    @staticmethod
    async def update_freight_settlement(
        tenant_id: int,
        settlement_uuid: str,
        data: FreightSettlementUpdate
    ) -> FreightSettlementResponse:
        """更新运费结算"""
        settlement = await FreightSettlement.filter(
            tenant_id=tenant_id,
            uuid=settlement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not settlement:
            raise NotFoundError(f"运费结算 {settlement_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(settlement, key, value)
        
        await settlement.save()
        
        return FreightSettlementResponse.model_validate(settlement)
    
    @staticmethod
    async def delete_freight_settlement(
        tenant_id: int,
        settlement_uuid: str
    ) -> None:
        """删除运费结算（软删除）"""
        settlement = await FreightSettlement.filter(
            tenant_id=tenant_id,
            uuid=settlement_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not settlement:
            raise NotFoundError(f"运费结算 {settlement_uuid} 不存在")
        
        settlement.deleted_at = datetime.utcnow()
        await settlement.save()

