"""
设备管理服务模块

提供设备的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from tortoise.exceptions import IntegrityError

from apps.kuaizhizao.models.equipment import Equipment, EquipmentCalibration
from apps.kuaizhizao.models.equipment_status_monitor import EquipmentStatusHistory
from apps.kuaizhizao.models.equipment_fault import EquipmentFault, EquipmentRepair
from apps.kuaizhizao.models.maintenance_plan import MaintenanceExecution
from apps.kuaizhizao.models.equipment_point_inspection import EquipmentPointInspectionRecord
from apps.kuaizhizao.schemas.equipment import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentCalibrationCreate,
    EquipmentCalibrationCreateWithEquipment,
)
from apps.common.audit_actor import apply_create_audit
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User


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
        """创建设备"""
        try:
            if not data.code:
                try:
                    data.code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="EQUIPMENT_CODE",
                        context=None
                    )
                except ValidationError:
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.code = f"EQ{timestamp}"
            
            equipment = Equipment(
                tenant_id=tenant_id,
                **data.model_dump(exclude_none=True)
            )
            actor = None
            if created_by is not None:
                actor = await User.filter(id=created_by, tenant_id=tenant_id).first()
            apply_create_audit(equipment, actor)
            await equipment.save()
            return equipment
        except IntegrityError:
            raise ValidationError(f"设备编码 {data.code} 已存在")
    
    @staticmethod
    async def get_equipment_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> Equipment:
        """根据UUID获取设备"""
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
        """根据编码获取设备"""
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
        equipment_nature: Optional[str] = None,
        status: Optional[str] = None,
        is_active: Optional[bool] = None,
        workshop_id: Optional[int] = None,
        production_line_id: Optional[int] = None,
        workstation_id: Optional[int] = None,
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[Equipment], int]:
        """获取设备列表"""
        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_LEDGER_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        query = Equipment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if type:
            query = query.filter(type=type)
        if category:
            query = query.filter(category=category)
        if equipment_nature:
            query = query.filter(equipment_nature=equipment_nature)
        if status:
            query = query.filter(status=status)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        if workshop_id is not None:
            query = query.filter(workshop_id=workshop_id)
        if production_line_id is not None:
            query = query.filter(production_line_id=production_line_id)
        if workstation_id:
            query = query.filter(workstation_id=workstation_id)
        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["code", "name", "serial_number"],
        )
        query = apply_equipment_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        query = apply_equipment_updated_date_range(
            query,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )
        total = await query.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            EQUIPMENT_LEDGER_SORTABLE_FIELDS,
            "-updated_at",
        )
        equipment_list = await query.offset(skip).limit(limit).order_by(order_clause)
        return equipment_list, total
    
    @staticmethod
    async def update_equipment(
        tenant_id: int,
        uuid: str,
        data: EquipmentUpdate
    ) -> Equipment:
        """更新设备"""
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        if 'code' in update_data and update_data['code'] != equipment.code:
            existing = await EquipmentService.get_equipment_by_code(
                tenant_id, update_data['code']
            )
            if existing and existing.uuid != equipment.uuid:
                raise ValidationError(f"设备编码 {update_data['code']} 已存在")
        for key, value in update_data.items():
            setattr(equipment, key, value)
        await equipment.save()
        return equipment
    
    @staticmethod
    async def delete_equipment(
        tenant_id: int,
        uuid: str
    ) -> None:
        """删除设备"""
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, uuid)
        equipment.deleted_at = datetime.now()
        await equipment.save()

    @staticmethod
    async def _apply_calibration_to_equipment(
        equipment: Equipment,
        calibration_date,
        expiry_date,
    ) -> None:
        """更新设备上次/下次校验日期"""
        from datetime import timedelta

        equipment.last_calibration_date = calibration_date
        if expiry_date:
            equipment.next_calibration_date = expiry_date
        elif equipment.calibration_period:
            equipment.next_calibration_date = calibration_date + timedelta(days=equipment.calibration_period)
        await equipment.save()

    @staticmethod
    async def create_equipment_calibration(
        tenant_id: int,
        equipment_uuid: str,
        data: EquipmentCalibrationCreate,
        current_user: Optional[User] = None,
    ) -> EquipmentCalibration:
        """创建设备校验记录"""
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, equipment_uuid)
        calib = EquipmentCalibration(
            tenant_id=tenant_id,
            equipment_id=equipment.id,
            equipment_uuid=equipment.uuid,
            calibration_date=data.calibration_date,
            result=data.result,
            certificate_no=data.certificate_no,
            expiry_date=data.expiry_date,
            attachment_uuid=data.attachment_uuid,
            attachments=data.attachments,
            remark=data.remark,
        )
        apply_create_audit(calib, current_user)
        await calib.save()
        await EquipmentService._apply_calibration_to_equipment(
            equipment, data.calibration_date, data.expiry_date
        )
        return calib

    @staticmethod
    async def list_all_calibrations(
        tenant_id: int,
        equipment_uuid: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        calibration_start_date: Optional[str] = None,
        calibration_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[EquipmentCalibration], int]:
        """获取全量设备校验记录列表（支持按设备筛选）"""
        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_CALIBRATION_SORTABLE_FIELDS,
            apply_asset_workflow_list_filters,
        )

        query = EquipmentCalibration.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if equipment_uuid:
            equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, equipment_uuid)
            query = query.filter(equipment_id=equipment.id)
        query, order_clause = apply_asset_workflow_list_filters(
            query,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=EQUIPMENT_CALIBRATION_SORTABLE_FIELDS,
            keyword_fields=["certificate_no", "result"],
            date_field="calibration_date",
            date_start=calibration_start_date,
            date_end=calibration_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by(order_clause)
        return list(items), total

    @staticmethod
    async def list_calibration_alerts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        due_type: Optional[str] = None,
    ) -> tuple[List[dict], int]:
        """设备检定到期提醒（7 天内到期或已逾期）"""
        from datetime import date

        today = date.today()
        equipments = await Equipment.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
            needs_calibration=True,
        )
        results: List[dict] = []
        for eq in equipments:
            if not eq.next_calibration_date:
                continue
            delta = (eq.next_calibration_date - today).days
            if delta > 7:
                continue
            rtype = "overdue" if delta < 0 else "due_soon"
            if due_type and rtype != due_type:
                continue
            results.append({
                "equipment_uuid": eq.uuid,
                "equipment_code": eq.code,
                "equipment_name": eq.name,
                "reminder_type": "calibration",
                "due_type": rtype,
                "due_date": eq.next_calibration_date,
                "days_until_due": delta,
                "calibration_period": eq.calibration_period,
                "last_calibration_date": eq.last_calibration_date,
            })
        results.sort(key=lambda x: (0 if x["due_type"] == "overdue" else 1, x["days_until_due"]))
        total = len(results)
        return results[skip : skip + limit], total

    @staticmethod
    async def get_equipment_lifecycle_log(
        tenant_id: int,
        equipment_uuid: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        获取设备全生命周期履历
        聚合各模块记录：状态变更、故障、维修、保养、点检、校准。
        """
        equipment = await EquipmentService.get_equipment_by_uuid(tenant_id, equipment_uuid)
        equipment_id = equipment.id
        logs = []
        
        # 1. 状态变更记录
        items = await EquipmentStatusHistory.filter(tenant_id=tenant_id, equipment_id=equipment_id).limit(limit).all()
        for item in items:
            logs.append({"type": "status_change", "time": item.status_changed_at, "title": f"状态变更: {item.from_status} -> {item.to_status}", "content": item.reason or "", "operator": item.changed_by_name})
            
        # 2. 故障记录
        items = await EquipmentFault.filter(tenant_id=tenant_id, equipment_id=equipment_id).limit(limit).all()
        for item in items:
            logs.append({"type": "fault", "time": item.fault_date, "title": f"故障上报: {item.fault_type}", "content": item.fault_description, "operator": item.reporter_name, "status": item.status})
            
        # 3. 维修记录
        items = await EquipmentRepair.filter(tenant_id=tenant_id, equipment_id=equipment_id).limit(limit).all()
        for item in items:
            logs.append({"type": "repair", "time": item.repair_date, "title": f"设备维修: {item.repair_type}", "content": item.repair_description, "operator": item.repairer_name, "result": item.repair_result})
            
        # 4. 保养记录
        items = await MaintenanceExecution.filter(tenant_id=tenant_id, equipment_id=equipment_id).limit(limit).all()
        for item in items:
            logs.append({"type": "maintenance", "time": item.execution_date, "title": f"设备保养: {item.execution_no}", "content": item.execution_content, "operator": item.executor_name, "result": item.execution_result})
            
        # 5. 点检记录
        items = await EquipmentPointInspectionRecord.filter(tenant_id=tenant_id, equipment_id=equipment_id).limit(limit).all()
        for item in items:
            logs.append({"type": "inspection", "time": item.inspection_date, "title": "日常点检", "content": f"结果: {'异常' if item.has_abnormality else '正常'} - {item.abnormality_description or ''}", "operator": item.inspector_name})
            
        # 6. 校准记录
        items = await EquipmentCalibration.filter(tenant_id=tenant_id, equipment_id=equipment_id).limit(limit).all()
        for item in items:
            logs.append({"type": "calibration", "time": item.calibration_date, "title": "设备校准/计量", "content": f"结果: {item.result}, 证书号: {item.certificate_no or '无'}", "operator": ""})

        logs.sort(key=lambda x: x["time"] if x["time"] else datetime.min, reverse=True)
        return logs[:limit]
