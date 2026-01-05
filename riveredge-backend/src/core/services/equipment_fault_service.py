"""
设备故障维修服务模块

提供设备故障和维修记录的 CRUD 操作。

Author: Luigi Lu
Date: 2025-01-15
"""

from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from tortoise.exceptions import IntegrityError

from core.models.equipment_fault import EquipmentFault, EquipmentRepair
from core.models.equipment import Equipment
from core.schemas.equipment_fault import (
    EquipmentFaultCreate,
    EquipmentFaultUpdate,
    EquipmentRepairCreate,
    EquipmentRepairUpdate,
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class EquipmentFaultService:
    """
    设备故障记录服务类
    
    提供设备故障记录的 CRUD 操作。
    """
    
    @staticmethod
    async def create_equipment_fault(
        tenant_id: int,
        data: EquipmentFaultCreate,
        created_by: Optional[int] = None
    ) -> EquipmentFault:
        """
        创建设备故障记录
        
        Args:
            tenant_id: 组织ID
            data: 设备故障记录创建数据
            created_by: 创建人ID（可选）
            
        Returns:
            EquipmentFault: 创建设备故障记录对象
            
        Raises:
            ValidationError: 当设备不存在或故障记录编号已存在时抛出
        """
        try:
            # 验证设备是否存在
            equipment = await Equipment.filter(
                tenant_id=tenant_id,
                uuid=data.equipment_uuid,
                deleted_at__isnull=True
            ).first()
            
            if not equipment:
                raise ValidationError(f"设备不存在: {data.equipment_uuid}")
            
            # 如果没有提供故障记录编号，自动生成
            if not data.fault_no:
                try:
                    data.fault_no = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="equipment_fault_code",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.fault_no = f"FT{timestamp}"
            
            fault = EquipmentFault(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_name=equipment.name,
                **data.model_dump(exclude_none=True, exclude={'equipment_uuid'})
            )
            await fault.save()
            return fault
        except IntegrityError:
            raise ValidationError(f"设备故障记录编号 {data.fault_no} 已存在")
    
    @staticmethod
    async def get_equipment_fault_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> EquipmentFault:
        """
        根据UUID获取设备故障记录
        
        Args:
            tenant_id: 组织ID
            uuid: 设备故障记录UUID
            
        Returns:
            EquipmentFault: 设备故障记录对象
            
        Raises:
            NotFoundError: 当设备故障记录不存在时抛出
        """
        fault = await EquipmentFault.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not fault:
            raise NotFoundError("设备故障记录不存在")
        
        return fault
    
    @staticmethod
    async def list_equipment_faults(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        equipment_uuid: Optional[str] = None,
        status: Optional[str] = None,
        fault_type: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[List[EquipmentFault], int]:
        """
        获取设备故障记录列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            equipment_uuid: 设备UUID（可选）
            status: 故障状态（可选）
            fault_type: 故障类型（可选）
            search: 搜索关键词（可选，搜索故障记录编号）
            
        Returns:
            tuple[List[EquipmentFault], int]: 设备故障记录列表和总数量
        """
        query = EquipmentFault.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 筛选条件
        if equipment_uuid:
            query = query.filter(equipment_uuid=equipment_uuid)
        if status:
            query = query.filter(status=status)
        if fault_type:
            query = query.filter(fault_type=fault_type)
        
        # 搜索条件
        if search:
            query = query.filter(fault_no__icontains=search)
        
        # 获取总数量
        total = await query.count()
        
        # 获取列表
        faults = await query.offset(skip).limit(limit).order_by("-fault_date")
        
        return faults, total
    
    @staticmethod
    async def update_equipment_fault(
        tenant_id: int,
        uuid: str,
        data: EquipmentFaultUpdate
    ) -> EquipmentFault:
        """
        更新设备故障记录
        
        Args:
            tenant_id: 组织ID
            uuid: 设备故障记录UUID
            data: 设备故障记录更新数据
            
        Returns:
            EquipmentFault: 更新后的设备故障记录对象
            
        Raises:
            NotFoundError: 当设备故障记录不存在时抛出
        """
        fault = await EquipmentFaultService.get_equipment_fault_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        
        # 更新字段
        for key, value in update_data.items():
            setattr(fault, key, value)
        
        await fault.save()
        return fault
    
    @staticmethod
    async def delete_equipment_fault(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除设备故障记录（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 设备故障记录UUID
            
        Raises:
            NotFoundError: 当设备故障记录不存在时抛出
        """
        fault = await EquipmentFaultService.get_equipment_fault_by_uuid(tenant_id, uuid)
        
        # 软删除
        fault.deleted_at = datetime.now()
        await fault.save()


class EquipmentRepairService:
    """
    设备维修记录服务类
    
    提供设备维修记录的 CRUD 操作。
    """
    
    @staticmethod
    async def create_equipment_repair(
        tenant_id: int,
        data: EquipmentRepairCreate,
        created_by: Optional[int] = None
    ) -> EquipmentRepair:
        """
        创建设备维修记录
        
        Args:
            tenant_id: 组织ID
            data: 设备维修记录创建数据
            created_by: 创建人ID（可选）
            
        Returns:
            EquipmentRepair: 创建设备维修记录对象
            
        Raises:
            ValidationError: 当设备不存在或维修记录编号已存在时抛出
        """
        try:
            # 验证设备是否存在
            equipment = await Equipment.filter(
                tenant_id=tenant_id,
                uuid=data.equipment_uuid,
                deleted_at__isnull=True
            ).first()
            
            if not equipment:
                raise ValidationError(f"设备不存在: {data.equipment_uuid}")
            
            # 如果关联了设备故障，验证设备故障是否存在
            equipment_fault = None
            if data.equipment_fault_uuid:
                equipment_fault = await EquipmentFault.filter(
                    tenant_id=tenant_id,
                    uuid=data.equipment_fault_uuid,
                    deleted_at__isnull=True
                ).first()
                
                if not equipment_fault:
                    raise ValidationError(f"设备故障记录不存在: {data.equipment_fault_uuid}")
            
            # 如果没有提供维修记录编号，自动生成
            if not data.repair_no:
                try:
                    data.repair_no = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="equipment_repair_code",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.repair_no = f"RP{timestamp}"
            
            repair = EquipmentRepair(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_name=equipment.name,
                equipment_fault_id=equipment_fault.id if equipment_fault else None,
                equipment_fault_uuid=equipment_fault.uuid if equipment_fault else None,
                **data.model_dump(exclude_none=True, exclude={'equipment_uuid', 'equipment_fault_uuid'})
            )
            await repair.save()
            return repair
        except IntegrityError:
            raise ValidationError(f"设备维修记录编号 {data.repair_no} 已存在")
    
    @staticmethod
    async def get_equipment_repair_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> EquipmentRepair:
        """
        根据UUID获取设备维修记录
        
        Args:
            tenant_id: 组织ID
            uuid: 设备维修记录UUID
            
        Returns:
            EquipmentRepair: 设备维修记录对象
            
        Raises:
            NotFoundError: 当设备维修记录不存在时抛出
        """
        repair = await EquipmentRepair.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not repair:
            raise NotFoundError("设备维修记录不存在")
        
        return repair
    
    @staticmethod
    async def list_equipment_repairs(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        equipment_uuid: Optional[str] = None,
        equipment_fault_uuid: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[List[EquipmentRepair], int]:
        """
        获取设备维修记录列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            equipment_uuid: 设备UUID（可选）
            equipment_fault_uuid: 设备故障UUID（可选）
            status: 维修状态（可选）
            search: 搜索关键词（可选，搜索维修记录编号）
            
        Returns:
            tuple[List[EquipmentRepair], int]: 设备维修记录列表和总数量
        """
        query = EquipmentRepair.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 筛选条件
        if equipment_uuid:
            query = query.filter(equipment_uuid=equipment_uuid)
        if equipment_fault_uuid:
            query = query.filter(equipment_fault_uuid=equipment_fault_uuid)
        if status:
            query = query.filter(status=status)
        
        # 搜索条件
        if search:
            query = query.filter(repair_no__icontains=search)
        
        # 获取总数量
        total = await query.count()
        
        # 获取列表
        repairs = await query.offset(skip).limit(limit).order_by("-repair_date")
        
        return repairs, total
    
    @staticmethod
    async def update_equipment_repair(
        tenant_id: int,
        uuid: str,
        data: EquipmentRepairUpdate
    ) -> EquipmentRepair:
        """
        更新设备维修记录
        
        Args:
            tenant_id: 组织ID
            uuid: 设备维修记录UUID
            data: 设备维修记录更新数据
            
        Returns:
            EquipmentRepair: 更新后的设备维修记录对象
            
        Raises:
            NotFoundError: 当设备维修记录不存在时抛出
        """
        repair = await EquipmentRepairService.get_equipment_repair_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        
        # 更新字段
        for key, value in update_data.items():
            setattr(repair, key, value)
        
        await repair.save()
        return repair
    
    @staticmethod
    async def delete_equipment_repair(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除设备维修记录（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 设备维修记录UUID
            
        Raises:
            NotFoundError: 当设备维修记录不存在时抛出
        """
        repair = await EquipmentRepairService.get_equipment_repair_by_uuid(tenant_id, uuid)
        
        # 软删除
        repair.deleted_at = datetime.now()
        await repair.save()

