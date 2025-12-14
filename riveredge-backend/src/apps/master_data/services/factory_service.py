"""
工厂数据服务模块

提供工厂数据的业务逻辑处理（车间、产线、工位），支持多组织隔离。
"""

from typing import List, Optional
from tortoise.exceptions import IntegrityError

from apps.master_data.models.factory import Workshop, ProductionLine, Workstation
from apps.master_data.schemas.factory_schemas import (
    WorkshopCreate, WorkshopUpdate, WorkshopResponse,
    ProductionLineCreate, ProductionLineUpdate, ProductionLineResponse,
    WorkstationCreate, WorkstationUpdate, WorkstationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class FactoryService:
    """工厂数据服务"""
    
    # ==================== 车间相关方法 ====================
    
    @staticmethod
    async def create_workshop(
        tenant_id: int,
        data: WorkshopCreate
    ) -> WorkshopResponse:
        """
        创建车间
        
        Args:
            tenant_id: 租户ID
            data: 车间创建数据
            
        Returns:
            WorkshopResponse: 创建的车间对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await Workshop.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"车间编码 {data.code} 已存在")
        
        # 创建车间
        workshop = await Workshop.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return WorkshopResponse.model_validate(workshop)
    
    @staticmethod
    async def get_workshop_by_uuid(
        tenant_id: int,
        workshop_uuid: str
    ) -> WorkshopResponse:
        """
        根据UUID获取车间
        
        Args:
            tenant_id: 租户ID
            workshop_uuid: 车间UUID
            
        Returns:
            WorkshopResponse: 车间对象
            
        Raises:
            NotFoundError: 当车间不存在时抛出
        """
        workshop = await Workshop.filter(
            tenant_id=tenant_id,
            uuid=workshop_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workshop:
            raise NotFoundError(f"车间 {workshop_uuid} 不存在")
        
        return WorkshopResponse.model_validate(workshop)
    
    @staticmethod
    async def list_workshops(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[WorkshopResponse]:
        """
        获取车间列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[WorkshopResponse]: 车间列表
        """
        try:
            query = Workshop.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            
            if is_active is not None:
                query = query.filter(is_active=is_active)
            
            workshops = await query.offset(skip).limit(limit).order_by("code").all()
            
            # 转换为响应格式
            result = []
            for w in workshops:
                try:
                    result.append(WorkshopResponse.model_validate(w))
                except Exception as e:
                    from loguru import logger
                    logger.error(f"转换车间数据失败 (ID: {w.id}, UUID: {w.uuid}): {str(e)}")
                    # 跳过有问题的记录，继续处理其他记录
                    continue
            
            return result
        except Exception as e:
            from loguru import logger
            logger.exception(f"获取车间列表失败 (tenant_id: {tenant_id}): {str(e)}")
            # 重新抛出异常，让 API 层处理
            raise
    
    @staticmethod
    async def update_workshop(
        tenant_id: int,
        workshop_uuid: str,
        data: WorkshopUpdate
    ) -> WorkshopResponse:
        """
        更新车间
        
        Args:
            tenant_id: 租户ID
            workshop_uuid: 车间UUID
            data: 车间更新数据
            
        Returns:
            WorkshopResponse: 更新后的车间对象
            
        Raises:
            NotFoundError: 当车间不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        workshop = await Workshop.filter(
            tenant_id=tenant_id,
            uuid=workshop_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workshop:
            raise NotFoundError(f"车间 {workshop_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != workshop.code:
            existing = await Workshop.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"车间编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(workshop, key, value)
        
        await workshop.save()
        
        return WorkshopResponse.model_validate(workshop)
    
    @staticmethod
    async def delete_workshop(
        tenant_id: int,
        workshop_uuid: str
    ) -> None:
        """
        删除车间（软删除）
        
        Args:
            tenant_id: 租户ID
            workshop_uuid: 车间UUID
            
        Raises:
            NotFoundError: 当车间不存在时抛出
            ValidationError: 当车间下有关联的产线时抛出
        """
        workshop = await Workshop.filter(
            tenant_id=tenant_id,
            uuid=workshop_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workshop:
            raise NotFoundError(f"车间 {workshop_uuid} 不存在")
        
        # 检查是否有关联的产线
        production_lines_count = await ProductionLine.filter(
            tenant_id=tenant_id,
            workshop_id=workshop.id,
            deleted_at__isnull=True
        ).count()
        
        if production_lines_count > 0:
            raise ValidationError(f"车间下存在 {production_lines_count} 条产线，无法删除")
        
        # 软删除
        from tortoise import timezone
        workshop.deleted_at = timezone.now()
        await workshop.save()
    
    # ==================== 产线相关方法 ====================
    
    @staticmethod
    async def create_production_line(
        tenant_id: int,
        data: ProductionLineCreate
    ) -> ProductionLineResponse:
        """
        创建产线
        
        Args:
            tenant_id: 租户ID
            data: 产线创建数据
            
        Returns:
            ProductionLineResponse: 创建的产线对象
            
        Raises:
            ValidationError: 当编码已存在或车间不存在时抛出
        """
        # 检查车间是否存在（通过 workshop_id 字段访问）
        workshop = await Workshop.filter(
            tenant_id=tenant_id,
            id=data.workshop_id,
            deleted_at__isnull=True
        ).first()
        
        if not workshop:
            raise ValidationError(f"车间 {data.workshop_id} 不存在")
        
        # 检查编码是否已存在
        existing = await ProductionLine.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"产线编码 {data.code} 已存在")
        
        # 创建产线
        production_line = await ProductionLine.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProductionLineResponse.model_validate(production_line)
    
    @staticmethod
    async def get_production_line_by_uuid(
        tenant_id: int,
        production_line_uuid: str
    ) -> ProductionLineResponse:
        """
        根据UUID获取产线
        
        Args:
            tenant_id: 租户ID
            production_line_uuid: 产线UUID
            
        Returns:
            ProductionLineResponse: 产线对象
            
        Raises:
            NotFoundError: 当产线不存在时抛出
        """
        production_line = await ProductionLine.filter(
            tenant_id=tenant_id,
            uuid=production_line_uuid,
            deleted_at__isnull=True
        ).prefetch_related("workshop").first()
        
        if not production_line:
            raise NotFoundError(f"产线 {production_line_uuid} 不存在")
        
        return ProductionLineResponse.model_validate(production_line)
    
    @staticmethod
    async def list_production_lines(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        workshop_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[ProductionLineResponse]:
        """
        获取产线列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            workshop_id: 车间ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[ProductionLineResponse]: 产线列表
        """
        query = ProductionLine.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if workshop_id is not None:
            query = query.filter(workshop_id=workshop_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        production_lines = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [ProductionLineResponse.model_validate(pl) for pl in production_lines]
    
    @staticmethod
    async def update_production_line(
        tenant_id: int,
        production_line_uuid: str,
        data: ProductionLineUpdate
    ) -> ProductionLineResponse:
        """
        更新产线
        
        Args:
            tenant_id: 租户ID
            production_line_uuid: 产线UUID
            data: 产线更新数据
            
        Returns:
            ProductionLineResponse: 更新后的产线对象
            
        Raises:
            NotFoundError: 当产线不存在时抛出
            ValidationError: 当编码已存在或车间不存在时抛出
        """
        production_line = await ProductionLine.filter(
            tenant_id=tenant_id,
            uuid=production_line_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not production_line:
            raise NotFoundError(f"产线 {production_line_uuid} 不存在")
        
        # 如果更新车间ID，检查车间是否存在
        if data.workshop_id and data.workshop_id != production_line.workshop_id:
            workshop = await Workshop.filter(
                tenant_id=tenant_id,
                id=data.workshop_id,
                deleted_at__isnull=True
            ).first()
            
            if not workshop:
                raise ValidationError(f"车间 {data.workshop_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != production_line.code:
            existing = await ProductionLine.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"产线编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(production_line, key, value)
        
        await production_line.save()
        
        return ProductionLineResponse.model_validate(production_line)
    
    @staticmethod
    async def delete_production_line(
        tenant_id: int,
        production_line_uuid: str
    ) -> None:
        """
        删除产线（软删除）
        
        Args:
            tenant_id: 租户ID
            production_line_uuid: 产线UUID
            
        Raises:
            NotFoundError: 当产线不存在时抛出
            ValidationError: 当产线下有关联的工位时抛出
        """
        production_line = await ProductionLine.filter(
            tenant_id=tenant_id,
            uuid=production_line_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not production_line:
            raise NotFoundError(f"产线 {production_line_uuid} 不存在")
        
        # 检查是否有关联的工位
        workstations_count = await Workstation.filter(
            tenant_id=tenant_id,
            production_line_id=production_line.id,
            deleted_at__isnull=True
        ).count()
        
        if workstations_count > 0:
            raise ValidationError(f"产线下存在 {workstations_count} 个工位，无法删除")
        
        # 软删除
        from tortoise import timezone
        production_line.deleted_at = timezone.now()
        await production_line.save()
    
    # ==================== 工位相关方法 ====================
    
    @staticmethod
    async def create_workstation(
        tenant_id: int,
        data: WorkstationCreate
    ) -> WorkstationResponse:
        """
        创建工位
        
        Args:
            tenant_id: 租户ID
            data: 工位创建数据
            
        Returns:
            WorkstationResponse: 创建的工位对象
            
        Raises:
            ValidationError: 当编码已存在或产线不存在时抛出
        """
        # 检查产线是否存在（通过 production_line_id 字段访问）
        production_line = await ProductionLine.filter(
            tenant_id=tenant_id,
            id=data.production_line_id,
            deleted_at__isnull=True
        ).first()
        
        if not production_line:
            raise ValidationError(f"产线 {data.production_line_id} 不存在")
        
        # 检查编码是否已存在
        existing = await Workstation.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工位编码 {data.code} 已存在")
        
        # 创建工位
        workstation = await Workstation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return WorkstationResponse.model_validate(workstation)
    
    @staticmethod
    async def get_workstation_by_uuid(
        tenant_id: int,
        workstation_uuid: str
    ) -> WorkstationResponse:
        """
        根据UUID获取工位
        
        Args:
            tenant_id: 租户ID
            workstation_uuid: 工位UUID
            
        Returns:
            WorkstationResponse: 工位对象
            
        Raises:
            NotFoundError: 当工位不存在时抛出
        """
        workstation = await Workstation.filter(
            tenant_id=tenant_id,
            uuid=workstation_uuid,
            deleted_at__isnull=True
        ).prefetch_related("production_line").first()
        
        if not workstation:
            raise NotFoundError(f"工位 {workstation_uuid} 不存在")
        
        return WorkstationResponse.model_validate(workstation)
    
    @staticmethod
    async def list_workstations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        production_line_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[WorkstationResponse]:
        """
        获取工位列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            production_line_id: 产线ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[WorkstationResponse]: 工位列表
        """
        query = Workstation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if production_line_id is not None:
            query = query.filter(production_line_id=production_line_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        workstations = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [WorkstationResponse.model_validate(ws) for ws in workstations]
    
    @staticmethod
    async def update_workstation(
        tenant_id: int,
        workstation_uuid: str,
        data: WorkstationUpdate
    ) -> WorkstationResponse:
        """
        更新工位
        
        Args:
            tenant_id: 租户ID
            workstation_uuid: 工位UUID
            data: 工位更新数据
            
        Returns:
            WorkstationResponse: 更新后的工位对象
            
        Raises:
            NotFoundError: 当工位不存在时抛出
            ValidationError: 当编码已存在或产线不存在时抛出
        """
        workstation = await Workstation.filter(
            tenant_id=tenant_id,
            uuid=workstation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workstation:
            raise NotFoundError(f"工位 {workstation_uuid} 不存在")
        
        # 如果更新产线ID，检查产线是否存在
        if data.production_line_id and data.production_line_id != workstation.production_line_id:
            production_line = await ProductionLine.filter(
                tenant_id=tenant_id,
                id=data.production_line_id,
                deleted_at__isnull=True
            ).first()
            
            if not production_line:
                raise ValidationError(f"产线 {data.production_line_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != workstation.code:
            existing = await Workstation.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"工位编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(workstation, key, value)
        
        await workstation.save()
        
        return WorkstationResponse.model_validate(workstation)
    
    @staticmethod
    async def delete_workstation(
        tenant_id: int,
        workstation_uuid: str
    ) -> None:
        """
        删除工位（软删除）
        
        Args:
            tenant_id: 租户ID
            workstation_uuid: 工位UUID
            
        Raises:
            NotFoundError: 当工位不存在时抛出
        """
        workstation = await Workstation.filter(
            tenant_id=tenant_id,
            uuid=workstation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not workstation:
            raise NotFoundError(f"工位 {workstation_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        workstation.deleted_at = timezone.now()
        await workstation.save()

