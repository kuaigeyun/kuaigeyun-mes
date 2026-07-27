"""
设备点检业务服务模块

处理设备点检计划、记录以及异常触发逻辑。

Author: Antigravity (RiverEdge Agent)
Date: 2026-03-26
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, date
from apps.kuaizhizao.models.equipment_point_inspection import EquipmentPointInspectionPlan, EquipmentPointInspectionRecord
from apps.kuaizhizao.models.equipment import Equipment
from apps.kuaizhizao.services.equipment_fault_service import EquipmentFaultService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime


class EquipmentPointInspectionService:
    """
    设备点检服务类
    """
    def __init__(self):
        self.fault_service = EquipmentFaultService()

    async def create_inspection_record(self, tenant_id: int, data: Dict[str, Any]) -> EquipmentPointInspectionRecord:
        """
        创建点检记录并处理异常报修
        """
        equipment_id = data.get("equipment_id")
        equipment = await Equipment.filter(id=equipment_id, tenant_id=tenant_id).first()
        if not equipment:
            raise NotFoundError(f"设备不存在: {equipment_id}")

        # 创建记录
        record = await EquipmentPointInspectionRecord.create(
            tenant_id=tenant_id,
            record_no=f"INSP-{resolve_business_datetime().strftime('%Y%m%d%H%M%S')}",
            equipment_id=equipment_id,
            equipment_uuid=equipment.uuid,
            inspection_date=data.get("inspection_date") or date.today(),
            inspector_id=data.get("inspector_id"),
            inspector_name=data.get("inspector_name"),
            results=data.get("results", {}),
            has_abnormality=data.get("has_abnormality", False),
            abnormality_description=data.get("abnormality_description"),
            remark=data.get("remark")
        )

        # 如果发现异常，自动触发设备报修流程
        if record.has_abnormality:
            # 调用故障服务
            fault_data = {
                "equipment_id": record.equipment_id,
                "fault_date": resolve_business_datetime(),
                "fault_type": "点检异常",
                "fault_description": f"点检记录 {record.record_no} 发现异常: {record.abnormality_description}",
                "fault_level": "一般",
                "reporter_id": record.inspector_id,
                "reporter_name": record.inspector_name,
                "status": "待处理"
            }
            fault = await self.fault_service.create_fault_record(tenant_id, fault_data)
            record.fault_report_uuid = fault.uuid
            await record.save()

        return record

    async def get_equipment_inspection_history(self, tenant_id: int, equipment_id: int) -> List[EquipmentPointInspectionRecord]:
        """
        查询设备的点检历史
        """
        return await EquipmentPointInspectionRecord.filter(
            tenant_id=tenant_id,
            equipment_id=equipment_id,
            deleted_at__isnull=True
        ).order_by("-inspection_date").all()
