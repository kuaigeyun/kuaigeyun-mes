"""
CAPA服务模块

提供CAPA的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaiqms.models.capa import CAPA
from apps.kuaiqms.schemas.capa_schemas import (
    CAPACreate, CAPAUpdate, CAPAResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class CAPAService:
    """CAPA服务"""
    
    @staticmethod
    async def create_capa(
        tenant_id: int,
        data: CAPACreate
    ) -> CAPAResponse:
        """创建CAPA"""
        existing = await CAPA.filter(
            tenant_id=tenant_id,
            capa_no=data.capa_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"CAPA编号 {data.capa_no} 已存在")
        
        capa = await CAPA.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return CAPAResponse.model_validate(capa)
    
    @staticmethod
    async def get_capa_by_uuid(
        tenant_id: int,
        capa_uuid: str
    ) -> CAPAResponse:
        """根据UUID获取CAPA"""
        capa = await CAPA.filter(
            tenant_id=tenant_id,
            uuid=capa_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not capa:
            raise NotFoundError(f"CAPA {capa_uuid} 不存在")
        
        return CAPAResponse.model_validate(capa)
    
    @staticmethod
    async def list_capas(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        capa_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[CAPAResponse]:
        """获取CAPA列表"""
        query = CAPA.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if capa_type:
            query = query.filter(capa_type=capa_type)
        if status:
            query = query.filter(status=status)
        
        capas = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [CAPAResponse.model_validate(c) for c in capas]
    
    @staticmethod
    async def update_capa(
        tenant_id: int,
        capa_uuid: str,
        data: CAPAUpdate
    ) -> CAPAResponse:
        """更新CAPA"""
        capa = await CAPA.filter(
            tenant_id=tenant_id,
            uuid=capa_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not capa:
            raise NotFoundError(f"CAPA {capa_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(capa, key, value)
        
        await capa.save()
        
        return CAPAResponse.model_validate(capa)
    
    @staticmethod
    async def delete_capa(
        tenant_id: int,
        capa_uuid: str
    ) -> None:
        """删除CAPA（软删除）"""
        capa = await CAPA.filter(
            tenant_id=tenant_id,
            uuid=capa_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not capa:
            raise NotFoundError(f"CAPA {capa_uuid} 不存在")
        
        capa.deleted_at = datetime.utcnow()
        await capa.save()
