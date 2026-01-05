"""
设备管理服务模块

提供设备的 CRUD 操作。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Optional
from datetime import datetime
from tortoise.exceptions import IntegrityError

from core.models.equipment import Equipment
from core.schemas.equipment import EquipmentCreate, EquipmentUpdate
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EquipmentService:
    """
    设备管理服务类
    
    提供设备的 CRUD 操作。
    """
    
    @staticmethod
    async def create_equipment(
        tenant_id: int,
        data: EquipmentCreate,
        created_by: Optional[int] = None
    ) -> Equipment:
        """
        创建设备
        
        Args:
            tenant_id: 组织ID
            data: 设备创建数据
            created_by: 创建人ID（可选）
            
        Returns:
            Equipment: 创建的设备对象
            
        Raises:
            ValidationError: 当设备编码已存在时抛出
        """
        try:
            # 如果没有提供编码，自动生成
            if not data.code:
                try:
                    data.code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="equipment_code",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    from datetime import datetime
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.code = f"EQ{timestamp}"
            
            equipment = Equipment(
                tenant_id=tenant_id,
                **data.model_dump(exclude_none=True)
            )
            await equipment.save()
            return equipment
        except IntegrityError:
            raise ValidationError(f"设备编码 {data.code} 已存在")
    
    @staticmethod
    async def get_equipment_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> Equipment:
        """
        根据UUID获取设备
        
        Args:
            tenant_id: 组织ID
            uuid: 设备UUID
            
        Returns:
            Equipment: 设备对象
            
        Raises:
            NotFoundError: 当设备不存在时抛出
        """
        equipment = await Equipment.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not equipment:
            raise NotFoundError("设备不存在")
        
        return equipment
    
    @staticmethod
    async def get_equipment_by_code(
        tenant_id: int,
        code: str
    ) -> Optional[Equipment]:
        """
        根据编码获取设备
        
        Args:
            tenant_id: 组织ID
            code: 设备编码
            
        Returns:
            Equipment: 设备对象，如果不存在返回 None
        """
        return await Equipment.filter(
            tenant_id=tenant_id,
            code=code,
            deleted_at__isnull=True
        ).first()
    
    @staticmethod
    async def list_equipment(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        is_active: Optional[bool] = None,
        workstation_id: Optional[int] = None,
        search: Optional[str] = None
    ) -> tuple[List[Equipment], int]:
        """
        获取设备列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 设备类型（可选）
            category: 设备分类（可选）
            status: 设备状态（可选）
            is_active: 是否启用（可选）
            workstation_id: 工位ID（可选）
            search: 搜索关键词（可选，搜索编码、名称）
            
        Returns:
            tuple[List[Equipment], int]: 设备列表和总数量
        """
        query = Equipment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 筛选条件
        if type:
            query = query.filter(type=type)
        if category:
            query = query.filter(category=category)
        if status:
            query = query.filter(status=status)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if workstation_id:
            query = query.filter(workstation_id=workstation_id)
        
        # 搜索条件
        if search:
            query = query.filter(
                code__icontains=search
            ) | query.filter(
                name__icontains=search
            )
        
        # 获取总数量
        total = await query.count()
        
        # 获取列表
        equipment_list = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return equipment_list, total
    
    @staticmethod
    async def update_equipment(
        tenant_id: int,
        uuid: str,
        data: EquipmentUpdate
    ) -> Equipment:
        """
        更新设备
        
        Args:
            tenant_id: 组织ID
            uuid: 设备UUID
            data: 设备更新数据
            
        Returns:
            Equipment: 更新后的设备对象
            
        Raises:
            NotFoundError: 当设备不存在时抛出
            ValidationError: 当设备编码已存在时抛出
        """
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        
        # 如果更新了编码，检查是否重复
        if 'code' in update_data and update_data['code'] != equipment.code:
            existing = await EquipmentService.get_equipment_by_code(
                tenant_id, update_data['code']
            )
            if existing and existing.uuid != equipment.uuid:
                raise ValidationError(f"设备编码 {update_data['code']} 已存在")
        
        # 更新字段
        for key, value in update_data.items():
            setattr(equipment, key, value)
        
        await equipment.save()
        return equipment
    
    @staticmethod
    async def delete_equipment(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除设备（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 设备UUID
            
        Raises:
            NotFoundError: 当设备不存在时抛出
        """
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        
        # 软删除
        equipment.deleted_at = datetime.now()
        await equipment.save()

