"""
设备故障维修服务模块

提供设备故障和维修记录的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from tortoise.exceptions import IntegrityError
from loguru import logger

from apps.kuaizhizao.models.equipment_fault import EquipmentFault, EquipmentRepair
from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.services.spare_part_service import SparePartService
from apps.kuaizhizao.schemas.equipment_fault import (
    EquipmentFaultCreate,
    EquipmentFaultUpdate,
    EquipmentRepairCreate,
    EquipmentRepairUpdate,
)
from apps.common.audit_actor import apply_create_audit
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime

# 故障/维修驱动设备状态时，下列主数据状态不被覆盖
_EQUIPMENT_STATUS_PROTECTED = frozenset({"停用", "报废", "校验中"})
_OPEN_FAULT_STATUSES = ("待处理", "处理中")


async def sync_equipment_status_from_faults(
    tenant_id: int,
    equipment_id: int,
) -> Optional[str]:
    """
    按未闭环故障 / 进行中维修同步设备主数据状态（唯一真源）。

    规则：
    - 当前状态为停用/报废/校验中 → 不动
    - 存在进行中维修 → 维修中
    - 否则存在待处理/处理中故障 → 故障
    - 否则 → 正常
    """
    equipment = await Equipment.filter(
        tenant_id=tenant_id,
        id=equipment_id,
        deleted_at__isnull=True,
    ).first()
    if not equipment:
        return None
    current = str(equipment.status or "")
    if current in _EQUIPMENT_STATUS_PROTECTED:
        return current

    has_active_repair = await EquipmentRepair.filter(
        tenant_id=tenant_id,
        equipment_id=equipment_id,
        status="进行中",
        deleted_at__isnull=True,
    ).exists()
    if has_active_repair:
        target = "维修中"
    else:
        has_open_fault = await EquipmentFault.filter(
            tenant_id=tenant_id,
            equipment_id=equipment_id,
            status__in=list(_OPEN_FAULT_STATUSES),
            deleted_at__isnull=True,
        ).exists()
        target = "故障" if has_open_fault else "正常"

    if current != target:
        equipment.status = target
        await equipment.save()
        logger.info(
            "equipment_status_synced_from_faults tenant_id={} equipment_id={} {} -> {}",
            tenant_id,
            equipment_id,
            current,
            target,
        )
    return target


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
                    timestamp = resolve_business_datetime().strftime("%Y%m%d%H%M%S")
                    data.fault_no = f"FT{timestamp}"
            
            fault = EquipmentFault(
                tenant_id=tenant_id,
                equipment_id=equipment.id,
                equipment_uuid=equipment.uuid,
                equipment_name=equipment.name,
                **data.model_dump(exclude_none=True, exclude={'equipment_uuid'})
            )
            reporter = None
            if created_by:
                reporter = await User.filter(id=created_by, tenant_id=tenant_id).first()
            apply_create_audit(fault, reporter)
            await fault.save()

            from apps.kuaizhizao.services.equipment_mobile_notification import notify_equipment_fault_reported

            try:
                await notify_equipment_fault_reported(
                    tenant_id=tenant_id,
                    fault=fault,
                    reporter=reporter,
                )
            except Exception as exc:
                logger.warning("设备报修通知派发失败 tenant={}: {}", tenant_id, exc)

            await sync_equipment_status_from_faults(tenant_id, equipment.id)
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
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        fault_start_date: Optional[str] = None,
        fault_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        uuid: Optional[str] = None,
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
        if uuid:
            query = query.filter(uuid=uuid.strip())

        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_FAULT_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["fault_no", "equipment_code", "equipment_name", "fault_description"],
        )
        query = apply_equipment_document_date_range(
            query,
            date_field="fault_date",
            start_date=fault_start_date,
            end_date=fault_end_date,
        )
        query = apply_equipment_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )

        total = await query.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            EQUIPMENT_FAULT_SORTABLE_FIELDS,
            "-fault_date",
        )
        faults = await query.offset(skip).limit(limit).order_by(order_clause)
        
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
        if "status" in update_data:
            await sync_equipment_status_from_faults(tenant_id, fault.equipment_id)
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
        equipment_id = fault.equipment_id
        
        # 软删除
        fault.deleted_at = resolve_business_datetime()
        await fault.save()
        await sync_equipment_status_from_faults(tenant_id, equipment_id)


class EquipmentRepairService:
    """
    设备维修记录服务类
    
    提供设备维修记录的 CRUD 操作。
    """

    # 维修状态 → 关联故障单状态（列表「当前阶段」读故障 status）
    _REPAIR_TO_FAULT_STATUS = {
        "进行中": "处理中",
        "已完成": "已修复",
    }
    _FAULT_TERMINAL = frozenset({"已关闭"})

    @classmethod
    async def _sync_linked_fault_status(
        cls,
        *,
        tenant_id: int,
        equipment_fault: Optional[EquipmentFault],
        repair_status: Optional[str],
    ) -> None:
        """维修创建/更新后回写关联故障单阶段，避免列表仍显示「待处理」。"""
        if not equipment_fault or not repair_status:
            return
        target = cls._REPAIR_TO_FAULT_STATUS.get(repair_status)
        if not target:
            return
        if equipment_fault.status in cls._FAULT_TERMINAL:
            return
        if equipment_fault.status == target:
            return
        # 已修复后不因「进行中」回退
        if equipment_fault.status == "已修复" and target == "处理中":
            return
        equipment_fault.status = target
        if target == "已修复":
            equipment_fault.repair_required = False
        await equipment_fault.save()
        logger.info(
            "equipment_repair_synced_fault tenant_id={} fault_uuid={} repair_status={} fault_status={}",
            tenant_id,
            equipment_fault.uuid,
            repair_status,
            target,
        )
    
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
                    timestamp = resolve_business_datetime().strftime("%Y%m%d%H%M%S")
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
            if created_by is not None:
                actor = await User.filter(id=created_by).first()
                apply_create_audit(repair, actor)
            await repair.save()
            await EquipmentRepairService._sync_linked_fault_status(
                tenant_id=tenant_id,
                equipment_fault=equipment_fault,
                repair_status=repair.status,
            )
            # 故障状态未变时 _sync 会提前返回；创建维修后仍需按进行中维修刷新设备状态
            await sync_equipment_status_from_faults(tenant_id, equipment.id)
            if data.repair_parts:
                await SparePartService().apply_parts_usage(
                    tenant_id,
                    data.repair_parts,
                    rel_type="equipment_repair",
                    rel_id=repair.id,
                    operator_id=data.repairer_id or created_by,
                    operator_name=data.repairer_name,
                )
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
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        repair_start_date: Optional[str] = None,
        repair_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
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

        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_REPAIR_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_document_date_range,
            apply_equipment_keyword_filter,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["repair_no", "equipment_name", "repairer_name", "repair_description"],
        )
        query = apply_equipment_document_date_range(
            query,
            date_field="repair_date",
            start_date=repair_start_date,
            end_date=repair_end_date,
        )
        query = apply_equipment_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )

        total = await query.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            EQUIPMENT_REPAIR_SORTABLE_FIELDS,
            "-repair_date",
        )
        repairs = await query.offset(skip).limit(limit).order_by(order_clause)
        
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

        if "status" in update_data:
            if repair.equipment_fault_uuid:
                linked_fault = await EquipmentFault.filter(
                    tenant_id=tenant_id,
                    uuid=repair.equipment_fault_uuid,
                    deleted_at__isnull=True,
                ).first()
                await EquipmentRepairService._sync_linked_fault_status(
                    tenant_id=tenant_id,
                    equipment_fault=linked_fault,
                    repair_status=repair.status,
                )
            # 已取消等不映射故障状态的路径也需刷新设备状态
            await sync_equipment_status_from_faults(tenant_id, repair.equipment_id)
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
        equipment_id = repair.equipment_id
        
        # 软删除
        repair.deleted_at = resolve_business_datetime()
        await repair.save()
        await sync_equipment_status_from_faults(tenant_id, equipment_id)

