"""
批号/序列号自动生成辅助模块

在入库场景中，当物料启用批号/序列号管理且用户未填写时，自动调用生成接口补全。

Author: RiverEdge Team
"""

from typing import Optional, List, Any

from apps.master_data.models.material import Material
from apps.master_data.services.material_batch_service import MaterialBatchService
from apps.master_data.services.material_serial_service import MaterialSerialService


async def ensure_batch_no_for_item(
    tenant_id: int,
    material: Material,
    item_data: Any,
    supplier_code: Optional[str] = None,
) -> Optional[str]:
    """
    确保入库明细有批号：若物料启用批号管理且 batch_number 为空，则自动生成。

    Args:
        tenant_id: 租户ID
        material: 物料对象
        item_data: 明细数据（需有 batch_number 属性）
        supplier_code: 供应商编码（可选，用于批号规则变量）

    Returns:
        批号字符串，若无需生成则返回原 batch_number
    """
    batch_number = getattr(item_data, "batch_number", None)
    if not material.batch_managed:
        return batch_number
    if batch_number and str(batch_number).strip():
        return batch_number
    batch_no = await MaterialBatchService.generate_batch_no(
        tenant_id=tenant_id,
        material_uuid=str(material.uuid),
        supplier_code=supplier_code,
    )
    return batch_no


async def ensure_serial_nos_for_item(
    tenant_id: int,
    material: Material,
    item_data: Any,
    count: int,
) -> Optional[List[str]]:
    """
    确保入库明细有序列号：若物料启用序列号管理且 serial_numbers 为空且 count>0，则自动生成。

    Args:
        tenant_id: 租户ID
        material: 物料对象
        item_data: 明细数据（需有 serial_numbers 属性）
        count: 需生成的序列号数量

    Returns:
        序列号列表，若无需生成则返回原 serial_numbers
    """
    if not material.serial_managed or count <= 0:
        return getattr(item_data, "serial_numbers", None)
    serial_numbers = getattr(item_data, "serial_numbers", None)
    if serial_numbers and isinstance(serial_numbers, list) and len(serial_numbers) >= count:
        return serial_numbers
    if serial_numbers and isinstance(serial_numbers, str):
        try:
            import json
            parsed = json.loads(serial_numbers)
            if isinstance(parsed, list) and len(parsed) >= count:
                return parsed
        except Exception:
            pass
    serial_nos = await MaterialSerialService.generate_serial_no(
        tenant_id=tenant_id,
        material_uuid=str(material.uuid),
        count=count,
    )
    return serial_nos
