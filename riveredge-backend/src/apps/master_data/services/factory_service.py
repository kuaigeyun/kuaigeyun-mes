"""
工厂数据服务模块

提供工厂数据的业务逻辑处理（厂区、车间、产线、工位），支持多组织隔离。
"""

from typing import List, Optional, TYPE_CHECKING
from tortoise.exceptions import IntegrityError
from tortoise.models import Q

from apps.master_data.models.factory import Plant, Workshop, ProductionLine, Workstation
from apps.master_data.schemas.factory_schemas import (
    PlantCreate, PlantUpdate, PlantResponse,
    WorkshopCreate, WorkshopUpdate, WorkshopResponse,
    ProductionLineCreate, ProductionLineUpdate, ProductionLineResponse,
    WorkstationCreate, WorkstationUpdate, WorkstationResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

if TYPE_CHECKING:
    from apps.master_data.schemas.factory_schemas import (
        WorkshopTreeResponse,
        ProductionLineTreeResponse,
        WorkstationTreeResponse
    )


class FactoryService:
    """工厂数据服务"""
    
    # ==================== 厂区相关方法 ====================
    
    @staticmethod
    async def create_plant(
        tenant_id: int,
        data: PlantCreate
    ) -> PlantResponse:
        """
        创建厂区
        
        Args:
            tenant_id: 租户ID
            data: 厂区创建数据
            
        Returns:
            PlantResponse: 创建的厂区对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在（包括软删除的记录）
        existing_active = await Plant.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"厂区编码 {data.code} 已存在")
        
        # 检查是否存在相同编码的软删除记录
        existing_deleted = await Plant.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录，更新其数据
            existing_deleted.deleted_at = None
            existing_deleted.name = data.name
            existing_deleted.description = data.description
            existing_deleted.address = data.address if hasattr(data, 'address') else None
            existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
            await existing_deleted.save()
            return PlantResponse.model_validate(existing_deleted)
        
        # 创建新厂区
        try:
            plant = await Plant.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束或主键冲突错误
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str or "pkey" in error_str:
                # 再次检查是否有软删除记录（可能在并发情况下被创建）
                existing_deleted_retry = await Plant.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=False
                ).first()
                
                if existing_deleted_retry:
                    # 恢复软删除的记录
                    existing_deleted_retry.deleted_at = None
                    existing_deleted_retry.name = data.name
                    existing_deleted_retry.description = data.description
                    existing_deleted_retry.address = data.address if hasattr(data, 'address') else None
                    existing_deleted_retry.is_active = data.is_active if hasattr(data, 'is_active') else True
                    await existing_deleted_retry.save()
                    return PlantResponse.model_validate(existing_deleted_retry)
                
                raise ValidationError(f"厂区编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return PlantResponse.model_validate(plant)
    
    @staticmethod
    async def get_plant_by_uuid(
        tenant_id: int,
        plant_uuid: str
    ) -> PlantResponse:
        """
        根据UUID获取厂区
        
        Args:
            tenant_id: 租户ID
            plant_uuid: 厂区UUID
            
        Returns:
            PlantResponse: 厂区对象
            
        Raises:
            NotFoundError: 当厂区不存在时抛出
        """
        plant = await Plant.filter(
            tenant_id=tenant_id,
            uuid=plant_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plant:
            raise NotFoundError(f"厂区 {plant_uuid} 不存在")
        
        return PlantResponse.model_validate(plant)
    
    @staticmethod
    async def list_plants(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None
    ) -> List[PlantResponse]:
        """
        获取厂区列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            keyword: 搜索关键词（厂区编码或名称）
            code: 厂区编码（精确匹配）
            name: 厂区名称（模糊匹配）

        Returns:
            List[PlantResponse]: 厂区列表
        """
        try:
            query = Plant.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if is_active is not None:
                query = query.filter(is_active=is_active)

            # 添加搜索条件
            if keyword:
                # 关键词搜索厂区编码或名称
                query = query.filter(
                    Q(code__icontains=keyword) | Q(name__icontains=keyword)
                )

            if code:
                # 精确匹配厂区编码
                query = query.filter(code__icontains=code)

            if name:
                # 模糊匹配厂区名称
                query = query.filter(name__icontains=name)
            
            plants = await query.offset(skip).limit(limit).order_by("code").all()
            
            # 转换为响应格式
            result = []
            for p in plants:
                try:
                    result.append(PlantResponse.model_validate(p))
                except Exception as e:
                    from loguru import logger
                    logger.error(f"转换厂区数据失败 (ID: {p.id}, UUID: {p.uuid}): {str(e)}")
                    # 跳过有问题的记录，继续处理其他记录
                    continue
            
            return result
        except Exception as e:
            from loguru import logger
            logger.exception(f"获取厂区列表失败 (tenant_id: {tenant_id}): {str(e)}")
            # 重新抛出异常，让 API 层处理
            raise
    
    @staticmethod
    async def update_plant(
        tenant_id: int,
        plant_uuid: str,
        data: PlantUpdate
    ) -> PlantResponse:
        """
        更新厂区
        
        Args:
            tenant_id: 租户ID
            plant_uuid: 厂区UUID
            data: 厂区更新数据
            
        Returns:
            PlantResponse: 更新后的厂区对象
            
        Raises:
            NotFoundError: 当厂区不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        plant = await Plant.filter(
            tenant_id=tenant_id,
            uuid=plant_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plant:
            raise NotFoundError(f"厂区 {plant_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != plant.code:
            existing = await Plant.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"厂区编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(plant, key, value)
        
        try:
            await plant.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"厂区编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return PlantResponse.model_validate(plant)
    
    @staticmethod
    async def delete_plant(
        tenant_id: int,
        plant_uuid: str
    ) -> None:
        """
        删除厂区（软删除）
        
        Args:
            tenant_id: 租户ID
            plant_uuid: 厂区UUID
            
        Raises:
            NotFoundError: 当厂区不存在时抛出
            ValidationError: 当厂区下有关联的车间时抛出
        """
        plant = await Plant.filter(
            tenant_id=tenant_id,
            uuid=plant_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not plant:
            raise NotFoundError(f"厂区 {plant_uuid} 不存在")
        
        # 检查是否有关联的车间
        workshops_count = await Workshop.filter(
            tenant_id=tenant_id,
            plant_id=plant.id,
            deleted_at__isnull=True
        ).count()
        
        if workshops_count > 0:
            raise ValidationError(f"厂区下存在 {workshops_count} 个车间，无法删除")
        
        # 软删除
        from tortoise import timezone
        plant.deleted_at = timezone.now()
        await plant.save()
    
    @staticmethod
    async def batch_delete_plants(
        tenant_id: int,
        plant_uuids: List[str]
    ) -> dict:
        """
        批量删除厂区（软删除）
        
        Args:
            tenant_id: 租户ID
            plant_uuids: 厂区UUID列表
            
        Returns:
            dict: 包含成功和失败记录的字典
                {
                    "success_count": int,
                    "failed_count": int,
                    "success_records": List[dict],
                    "failed_records": List[dict]
                }
        """
        from tortoise import timezone
        from loguru import logger
        
        success_records = []
        failed_records = []
        
        for plant_uuid in plant_uuids:
            try:
                # 查找厂区
                plant = await Plant.filter(
                    tenant_id=tenant_id,
                    uuid=plant_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not plant:
                    failed_records.append({
                        "uuid": plant_uuid,
                        "reason": f"厂区 {plant_uuid} 不存在"
                    })
                    continue
                
                # 检查是否有关联的车间
                workshops_count = await Workshop.filter(
                    tenant_id=tenant_id,
                    plant_id=plant.id,
                    deleted_at__isnull=True
                ).count()
                
                if workshops_count > 0:
                    failed_records.append({
                        "uuid": plant_uuid,
                        "code": plant.code,
                        "name": plant.name,
                        "reason": f"厂区下存在 {workshops_count} 个车间，无法删除"
                    })
                    continue
                
                # 软删除
                plant.deleted_at = timezone.now()
                await plant.save()
                
                success_records.append({
                    "uuid": plant_uuid,
                    "code": plant.code,
                    "name": plant.name
                })
            except Exception as e:
                logger.exception(f"批量删除厂区失败 (uuid: {plant_uuid}): {str(e)}")
                failed_records.append({
                    "uuid": plant_uuid,
                    "reason": f"删除失败: {str(e)}"
                })
        
        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
    
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
        # 检查编码是否已存在（包括软删除的记录）
        # 先尝试精确匹配
        existing_active = await Workshop.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"车间编码 {data.code} 已存在")
        
        # 检查是否存在相同编码的软删除记录（精确匹配）
        existing_deleted = await Workshop.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录，更新其数据
            existing_deleted.deleted_at = None
            existing_deleted.name = data.name
            existing_deleted.description = data.description
            existing_deleted.plant_id = data.plant_id if hasattr(data, 'plant_id') else None
            existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
            await existing_deleted.save()
            return WorkshopResponse.model_validate(existing_deleted)
        
        # 如果不区分大小写的匹配（防止编码大小写不一致的问题）
        code_upper = data.code.upper() if data.code else None
        if code_upper:
            # 查询所有可能的匹配（使用模糊查询，然后手动过滤）
            all_possible = await Workshop.filter(
                tenant_id=tenant_id,
                code__icontains=code_upper
            ).all()
            
            # 手动精确匹配（不区分大小写）
            for record in all_possible:
                if record.code and record.code.upper() == code_upper:
                    if record.deleted_at is None:
                        raise ValidationError(f"车间编码 {data.code} 已存在（编码大小写不一致）")
                    else:
                        # 找到软删除记录，恢复它
                        existing_deleted = record
                        existing_deleted.deleted_at = None
                        existing_deleted.name = data.name
                        existing_deleted.description = data.description
                        existing_deleted.plant_id = data.plant_id if hasattr(data, 'plant_id') else None
                        existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
                        # 统一使用新传入的编码
                        existing_deleted.code = data.code
                        await existing_deleted.save()
                        return WorkshopResponse.model_validate(existing_deleted)
        
        # 创建新车间
        try:
            workshop = await Workshop.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束或主键冲突错误
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str or "pkey" in error_str:
                # 再次检查是否有软删除记录（可能在并发情况下被创建）
                # 先尝试精确匹配
                existing_deleted_retry = await Workshop.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=False
                ).first()
                
                if existing_deleted_retry:
                    # 恢复软删除的记录
                    existing_deleted_retry.deleted_at = None
                    existing_deleted_retry.name = data.name
                    existing_deleted_retry.description = data.description
                    existing_deleted_retry.plant_id = data.plant_id if hasattr(data, 'plant_id') else None
                    existing_deleted_retry.is_active = data.is_active if hasattr(data, 'is_active') else True
                    await existing_deleted_retry.save()
                    return WorkshopResponse.model_validate(existing_deleted_retry)
                
                # 如果不区分大小写的匹配
                if code_upper:
                    all_possible_retry = await Workshop.filter(
                        tenant_id=tenant_id,
                        code__icontains=code_upper
                    ).all()
                    
                    for record in all_possible_retry:
                        if record.code and record.code.upper() == code_upper:
                            if record.deleted_at is not None:
                                # 恢复软删除的记录
                                record.deleted_at = None
                                record.name = data.name
                                record.description = data.description
                                record.plant_id = data.plant_id if hasattr(data, 'plant_id') else None
                                record.is_active = data.is_active if hasattr(data, 'is_active') else True
                                # 统一使用新传入的编码
                                record.code = data.code
                                await record.save()
                                return WorkshopResponse.model_validate(record)
                            else:
                                raise ValidationError(f"车间编码 {data.code} 已存在")
                
                raise ValidationError(f"车间编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None
    ) -> List[WorkshopResponse]:
        """
        获取车间列表

        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            keyword: 搜索关键词（车间编码或名称）
            code: 车间编码（精确匹配）
            name: 车间名称（模糊匹配）

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

            # 添加搜索条件
            if keyword:
                # 关键词搜索车间编码或名称
                query = query.filter(
                    Q(code__icontains=keyword) | Q(name__icontains=keyword)
                )

            if code:
                # 精确匹配车间编码
                query = query.filter(code__icontains=code)

            if name:
                # 模糊匹配车间名称
                query = query.filter(name__icontains=name)
            
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
        
        try:
            await workshop.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"车间编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
    
    @staticmethod
    async def batch_delete_workshops(
        tenant_id: int,
        workshop_uuids: List[str]
    ) -> dict:
        """
        批量删除车间（软删除）
        
        Args:
            tenant_id: 租户ID
            workshop_uuids: 车间UUID列表
            
        Returns:
            dict: 包含成功和失败记录的字典
                {
                    "success_count": int,
                    "failed_count": int,
                    "success_records": List[dict],
                    "failed_records": List[dict]
                }
        """
        from tortoise import timezone
        from loguru import logger
        
        success_records = []
        failed_records = []
        
        for workshop_uuid in workshop_uuids:
            try:
                # 查找车间
                workshop = await Workshop.filter(
                    tenant_id=tenant_id,
                    uuid=workshop_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not workshop:
                    failed_records.append({
                        "uuid": workshop_uuid,
                        "reason": f"车间 {workshop_uuid} 不存在"
                    })
                    continue
                
                # 检查是否有关联的产线
                production_lines_count = await ProductionLine.filter(
                    tenant_id=tenant_id,
                    workshop_id=workshop.id,
                    deleted_at__isnull=True
                ).count()
                
                if production_lines_count > 0:
                    failed_records.append({
                        "uuid": workshop_uuid,
                        "code": workshop.code,
                        "name": workshop.name,
                        "reason": f"车间下存在 {production_lines_count} 条产线，无法删除"
                    })
                    continue
                
                # 软删除
                workshop.deleted_at = timezone.now()
                await workshop.save()
                
                success_records.append({
                    "uuid": workshop_uuid,
                    "code": workshop.code,
                    "name": workshop.name
                })
            except Exception as e:
                logger.exception(f"批量删除车间失败 (uuid: {workshop_uuid}): {str(e)}")
                failed_records.append({
                    "uuid": workshop_uuid,
                    "reason": f"删除失败: {str(e)}"
                })
        
        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
    
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
        
        # 检查编码是否已存在（包括软删除的记录）
        code_upper = data.code.upper() if data.code else None
        
        # 先尝试精确匹配活跃记录
        existing_active = await ProductionLine.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"产线编码 {data.code} 已存在")
        
        # 检查是否存在相同编码的软删除记录（精确匹配）
        existing_deleted = await ProductionLine.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录，更新其数据
            existing_deleted.deleted_at = None
            existing_deleted.name = data.name
            existing_deleted.description = data.description
            existing_deleted.workshop_id = data.workshop_id
            existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
            await existing_deleted.save()
            return ProductionLineResponse.model_validate(existing_deleted)
        
        # 如果不区分大小写的匹配（防止编码大小写不一致的问题）
        # 注意：即使 code 已经是大写，也要检查，因为数据库中可能有不同大小写的记录
        if code_upper:
            # 查询所有可能的匹配（使用模糊查询，然后手动过滤）
            all_possible = await ProductionLine.filter(
                tenant_id=tenant_id,
                code__icontains=code_upper
            ).all()
            
            # 手动精确匹配（不区分大小写）
            for record in all_possible:
                if record.code and record.code.upper() == code_upper:
                    if record.deleted_at is None:
                        raise ValidationError(f"产线编码 {data.code} 已存在（编码大小写不一致：{record.code}）")
                    else:
                        # 找到软删除记录，恢复它
                        existing_deleted = record
                        existing_deleted.deleted_at = None
                        existing_deleted.name = data.name
                        existing_deleted.description = data.description
                        existing_deleted.workshop_id = data.workshop_id
                        existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
                        # 统一使用新传入的编码
                        existing_deleted.code = data.code
                        await existing_deleted.save()
                        return ProductionLineResponse.model_validate(existing_deleted)
        
        # 创建新产线
        try:
            production_line = await ProductionLine.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束或主键冲突错误
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str or "pkey" in error_str:
                from loguru import logger
                logger.debug(f"产线编码 {data.code} 创建时发生 IntegrityError，尝试查找软删除记录: {error_str}")
                
                # 再次全面检查是否有软删除记录（可能在并发情况下被创建，或查询时遗漏）
                # 先尝试精确匹配
                existing_deleted_retry = await ProductionLine.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=False
                ).first()
                
                if existing_deleted_retry:
                    logger.info(f"找到软删除的产线记录，恢复: {data.code}")
                    # 恢复软删除的记录
                    existing_deleted_retry.deleted_at = None
                    existing_deleted_retry.name = data.name
                    existing_deleted_retry.description = data.description
                    existing_deleted_retry.workshop_id = data.workshop_id
                    existing_deleted_retry.is_active = data.is_active if hasattr(data, 'is_active') else True
                    await existing_deleted_retry.save()
                    return ProductionLineResponse.model_validate(existing_deleted_retry)
                
                # 如果不区分大小写的匹配（更全面的搜索）
                # 直接查询所有记录（包括软删除的），然后手动过滤，确保不遗漏
                if code_upper:
                    # 查询所有记录（不限制 deleted_at），然后手动过滤
                    all_records = await ProductionLine.filter(
                        tenant_id=tenant_id
                    ).all()
                    
                    logger.debug(f"查询到 {len(all_records)} 条产线记录（包括软删除的）")
                    
                    for record in all_records:
                        if record.code and record.code.upper() == code_upper:
                            if record.deleted_at is not None:
                                logger.info(f"找到软删除的产线记录（大小写不一致），恢复: {record.code} -> {data.code}")
                                # 恢复软删除的记录
                                record.deleted_at = None
                                record.name = data.name
                                record.description = data.description
                                record.workshop_id = data.workshop_id
                                record.is_active = data.is_active if hasattr(data, 'is_active') else True
                                # 统一使用新传入的编码
                                record.code = data.code
                                await record.save()
                                return ProductionLineResponse.model_validate(record)
                            else:
                                # 如果找到活跃记录，说明有并发问题
                                logger.warning(f"发现活跃的产线记录（大小写不一致）: {record.code}，但之前检查未找到")
                                raise ValidationError(f"产线编码 {data.code} 已存在（编码大小写不一致：{record.code}）")
                
                # 如果仍然找不到软删除记录，检查是否有活跃记录（可能是并发创建）
                existing_active_retry = await ProductionLine.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=True
                ).first()
                
                if existing_active_retry:
                    logger.warning(f"发现活跃的产线记录: {data.code}，但之前检查未找到（可能是并发创建）")
                    raise ValidationError(f"产线编码 {data.code} 已存在")
                
                # 如果仍然找不到任何记录，可能是数据库约束问题
                logger.error(f"产线编码 {data.code} 创建失败，IntegrityError: {error_str}，但未找到任何匹配记录")
                raise ValidationError(f"产线编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        
        try:
            await production_line.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"产线编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
    
    @staticmethod
    async def batch_delete_production_lines(
        tenant_id: int,
        production_line_uuids: List[str]
    ) -> dict:
        """
        批量删除产线（软删除）
        
        Args:
            tenant_id: 租户ID
            production_line_uuids: 产线UUID列表
            
        Returns:
            dict: 包含成功和失败记录的字典
                {
                    "success_count": int,
                    "failed_count": int,
                    "success_records": List[dict],
                    "failed_records": List[dict]
                }
        """
        from tortoise import timezone
        from loguru import logger
        
        success_records = []
        failed_records = []
        
        for production_line_uuid in production_line_uuids:
            try:
                # 查找产线
                production_line = await ProductionLine.filter(
                    tenant_id=tenant_id,
                    uuid=production_line_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not production_line:
                    failed_records.append({
                        "uuid": production_line_uuid,
                        "reason": f"产线 {production_line_uuid} 不存在"
                    })
                    continue
                
                # 检查是否有关联的工位
                workstations_count = await Workstation.filter(
                    tenant_id=tenant_id,
                    production_line_id=production_line.id,
                    deleted_at__isnull=True
                ).count()
                
                if workstations_count > 0:
                    failed_records.append({
                        "uuid": production_line_uuid,
                        "code": production_line.code,
                        "name": production_line.name,
                        "reason": f"产线下存在 {workstations_count} 个工位，无法删除"
                    })
                    continue
                
                # 软删除
                production_line.deleted_at = timezone.now()
                await production_line.save()
                
                success_records.append({
                    "uuid": production_line_uuid,
                    "code": production_line.code,
                    "name": production_line.name
                })
            except Exception as e:
                logger.exception(f"批量删除产线失败 (uuid: {production_line_uuid}): {str(e)}")
                failed_records.append({
                    "uuid": production_line_uuid,
                    "reason": f"删除失败: {str(e)}"
                })
        
        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
    
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
        
        # 检查编码是否已存在（包括软删除的记录）
        code_upper = data.code.upper() if data.code else None
        
        # 先尝试精确匹配活跃记录
        existing_active = await Workstation.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing_active:
            raise ValidationError(f"工位编码 {data.code} 已存在")
        
        # 检查是否存在相同编码的软删除记录（精确匹配）
        existing_deleted = await Workstation.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()
        
        if existing_deleted:
            # 恢复软删除的记录，更新其数据
            existing_deleted.deleted_at = None
            existing_deleted.name = data.name
            existing_deleted.description = data.description
            existing_deleted.production_line_id = data.production_line_id
            existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
            await existing_deleted.save()
            return WorkstationResponse.model_validate(existing_deleted)
        
        # 如果不区分大小写的匹配（防止编码大小写不一致的问题）
        # 注意：即使 code 已经是大写，也要检查，因为数据库中可能有不同大小写的记录
        if code_upper:
            # 查询所有可能的匹配（使用模糊查询，然后手动过滤）
            all_possible = await Workstation.filter(
                tenant_id=tenant_id,
                code__icontains=code_upper
            ).all()
            
            # 手动精确匹配（不区分大小写）
            for record in all_possible:
                if record.code and record.code.upper() == code_upper:
                    if record.deleted_at is None:
                        raise ValidationError(f"工位编码 {data.code} 已存在（编码大小写不一致：{record.code}）")
                    else:
                        # 找到软删除记录，恢复它
                        existing_deleted = record
                        existing_deleted.deleted_at = None
                        existing_deleted.name = data.name
                        existing_deleted.description = data.description
                        existing_deleted.production_line_id = data.production_line_id
                        existing_deleted.is_active = data.is_active if hasattr(data, 'is_active') else True
                        # 统一使用新传入的编码
                        existing_deleted.code = data.code
                        await existing_deleted.save()
                        return WorkstationResponse.model_validate(existing_deleted)
        
        # 创建新工位
        try:
            workstation = await Workstation.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束或主键冲突错误
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str or "pkey" in error_str:
                from loguru import logger
                logger.debug(f"工位编码 {data.code} 创建时发生 IntegrityError，尝试查找软删除记录: {error_str}")
                
                # 再次全面检查是否有软删除记录（可能在并发情况下被创建，或查询时遗漏）
                # 先尝试精确匹配
                existing_deleted_retry = await Workstation.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=False
                ).first()
                
                if existing_deleted_retry:
                    logger.info(f"找到软删除的工位记录，恢复: {data.code}")
                    # 恢复软删除的记录
                    existing_deleted_retry.deleted_at = None
                    existing_deleted_retry.name = data.name
                    existing_deleted_retry.description = data.description
                    existing_deleted_retry.production_line_id = data.production_line_id
                    existing_deleted_retry.is_active = data.is_active if hasattr(data, 'is_active') else True
                    await existing_deleted_retry.save()
                    return WorkstationResponse.model_validate(existing_deleted_retry)
                
                # 如果不区分大小写的匹配（更全面的搜索）
                # 直接查询所有记录（包括软删除的），然后手动过滤，确保不遗漏
                if code_upper:
                    # 查询所有记录（不限制 deleted_at），然后手动过滤
                    all_records = await Workstation.filter(
                        tenant_id=tenant_id
                    ).all()
                    
                    logger.debug(f"查询到 {len(all_records)} 条工位记录（包括软删除的）")
                    
                    for record in all_records:
                        if record.code and record.code.upper() == code_upper:
                            if record.deleted_at is not None:
                                logger.info(f"找到软删除的工位记录（大小写不一致），恢复: {record.code} -> {data.code}")
                                # 恢复软删除的记录
                                record.deleted_at = None
                                record.name = data.name
                                record.description = data.description
                                record.production_line_id = data.production_line_id
                                record.is_active = data.is_active if hasattr(data, 'is_active') else True
                                # 统一使用新传入的编码
                                record.code = data.code
                                await record.save()
                                return WorkstationResponse.model_validate(record)
                            else:
                                # 如果找到活跃记录，说明有并发问题
                                logger.warning(f"发现活跃的工位记录（大小写不一致）: {record.code}，但之前检查未找到")
                                raise ValidationError(f"工位编码 {data.code} 已存在（编码大小写不一致：{record.code}）")
                
                # 如果仍然找不到软删除记录，检查是否有活跃记录（可能是并发创建）
                existing_active_retry = await Workstation.filter(
                    tenant_id=tenant_id,
                    code=data.code,
                    deleted_at__isnull=True
                ).first()
                
                if existing_active_retry:
                    logger.warning(f"发现活跃的工位记录: {data.code}，但之前检查未找到（可能是并发创建）")
                    raise ValidationError(f"工位编码 {data.code} 已存在")
                
                # 如果仍然找不到任何记录，可能是数据库约束问题
                logger.error(f"工位编码 {data.code} 创建失败，IntegrityError: {error_str}，但未找到任何匹配记录")
                raise ValidationError(f"工位编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        
        try:
            await workstation.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"工位编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
    
    @staticmethod
    async def batch_delete_workstations(
        tenant_id: int,
        workstation_uuids: List[str]
    ) -> dict:
        """
        批量删除工位（软删除）
        
        Args:
            tenant_id: 租户ID
            workstation_uuids: 工位UUID列表
            
        Returns:
            dict: 包含成功和失败记录的字典
                {
                    "success_count": int,
                    "failed_count": int,
                    "success_records": List[dict],
                    "failed_records": List[dict]
                }
        """
        from tortoise import timezone
        from loguru import logger
        
        success_records = []
        failed_records = []
        
        for workstation_uuid in workstation_uuids:
            try:
                # 查找工位
                workstation = await Workstation.filter(
                    tenant_id=tenant_id,
                    uuid=workstation_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not workstation:
                    failed_records.append({
                        "uuid": workstation_uuid,
                        "reason": f"工位 {workstation_uuid} 不存在"
                    })
                    continue
                
                # 软删除（工位没有下级关联，可以直接删除）
                workstation.deleted_at = timezone.now()
                await workstation.save()
                
                success_records.append({
                    "uuid": workstation_uuid,
                    "code": workstation.code,
                    "name": workstation.name
                })
            except Exception as e:
                logger.exception(f"批量删除工位失败 (uuid: {workstation_uuid}): {str(e)}")
                failed_records.append({
                    "uuid": workstation_uuid,
                    "reason": f"删除失败: {str(e)}"
                })
        
        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
    
    # ==================== 级联查询相关方法 ====================
    
    @staticmethod
    async def get_factory_tree(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List["WorkshopTreeResponse"]:
        """
        获取工厂数据树形结构（车间→产线→工位）
        
        返回完整的工厂层级结构，用于级联选择等场景。
        
        Args:
            tenant_id: 租户ID
            is_active: 是否只查询启用的数据（可选）
            
        Returns:
            List[WorkshopTreeResponse]: 车间树形列表，每个车间包含产线列表，每个产线包含工位列表
        """
        # 延迟导入避免循环依赖
        from apps.master_data.schemas.factory_schemas import (
            WorkshopTreeResponse,
            ProductionLineTreeResponse,
            WorkstationTreeResponse
        )
        
        # 查询所有车间
        workshop_query = Workshop.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            workshop_query = workshop_query.filter(is_active=is_active)
        
        workshops = await workshop_query.order_by("code").all()
        
        # 查询所有产线
        production_line_query = ProductionLine.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            production_line_query = production_line_query.filter(is_active=is_active)
        
        production_lines = await production_line_query.prefetch_related("workshop").order_by("code").all()
        
        # 查询所有工位
        workstation_query = Workstation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            workstation_query = workstation_query.filter(is_active=is_active)
        
        workstations = await workstation_query.prefetch_related("production_line").order_by("code").all()
        
        # 构建工位映射（按产线ID分组）
        workstation_map: dict[int, List[WorkstationTreeResponse]] = {}
        for workstation in workstations:
            line_id = workstation.production_line_id
            if line_id not in workstation_map:
                workstation_map[line_id] = []
            workstation_map[line_id].append(WorkstationTreeResponse.model_validate(workstation))
        
        # 构建产线映射（按车间ID分组）
        production_line_map: dict[int, List[ProductionLineTreeResponse]] = {}
        for production_line in production_lines:
            workshop_id = production_line.workshop_id
            if workshop_id not in production_line_map:
                production_line_map[workshop_id] = []
            
            # 获取该产线的工位列表
            line_workstations = workstation_map.get(production_line.id, [])
            
            # 创建产线响应对象（包含工位列表）
            line_response = ProductionLineTreeResponse.model_validate(production_line)
            line_response.workstations = line_workstations
            production_line_map[workshop_id].append(line_response)
        
        # 构建车间树形结构
        result: List[WorkshopTreeResponse] = []
        for workshop in workshops:
            # 获取该车间的产线列表
            workshop_production_lines = production_line_map.get(workshop.id, [])
            
            # 创建车间响应对象（包含产线列表）
            workshop_response = WorkshopTreeResponse.model_validate(workshop)
            workshop_response.production_lines = workshop_production_lines
            result.append(workshop_response)
        
        return result

