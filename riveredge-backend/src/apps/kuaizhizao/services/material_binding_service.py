"""
物料绑定业务服务模块

提供物料绑定记录相关的业务逻辑处理，包括上料绑定、下料绑定等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from typing import List, Optional
from decimal import Decimal

from loguru import logger
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.material_binding import MaterialBinding
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.schemas.material_binding import (
    MaterialBindingCreateFromReporting,
    MaterialBindingResponse,
    MaterialBindingListResponse,
)
from apps.kuaizhizao.services.inventory_service import InventoryService
from apps.master_data.models.material import Material

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from core.utils.timezone_utils import resolve_business_datetime


class MaterialBindingService(AppBaseService[MaterialBinding]):
    """
    物料绑定服务类

    处理物料绑定记录相关的所有业务逻辑。
    """

    SOURCE_TYPE = "material_binding"
    MOVEMENT_TYPE = "material_binding"

    def __init__(self):
        super().__init__(MaterialBinding)

    @staticmethod
    def _binding_idempotency_key(binding_id: int, action: str) -> str:
        return f"material_binding:{binding_id}:{action}"

    @staticmethod
    async def _resolve_material(tenant_id: int, material_id: int) -> Material:
        material = await Material.get_or_none(
            id=material_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if not material:
            raise ValidationError(f"物料不存在: {material_id}")
        return material

    @staticmethod
    def _material_code_name(material: Material) -> tuple[str, str]:
        code = str(getattr(material, "main_code", None) or getattr(material, "code", None) or "").strip()
        name = str(getattr(material, "name", None) or "").strip()
        if not code:
            raise ValidationError(f"物料编码未配置: {material.id}")
        if not name:
            raise ValidationError(f"物料名称未配置: {material.id}")
        return code, name

    @staticmethod
    def _optional_stock_kwargs(binding_data) -> dict:
        """复用 inventory_service 参数校验口径，透传序列号/权属等可选字段。"""
        kwargs: dict = {}
        serial_nos = getattr(binding_data, "serial_nos", None)
        if serial_nos:
            kwargs["serial_nos"] = list(serial_nos)
        ownership_type = getattr(binding_data, "ownership_type", None)
        if ownership_type is not None:
            kwargs["ownership_type"] = ownership_type
        customer_id = getattr(binding_data, "customer_id", None)
        if customer_id is not None:
            kwargs["customer_id"] = customer_id
        location_id = getattr(binding_data, "location_id", None)
        location_code = getattr(binding_data, "location_code", None)
        if location_id is not None:
            kwargs["location_id"] = location_id
        if location_code is not None:
            kwargs["location_code"] = location_code
        return kwargs

    async def create_material_binding_from_reporting(
        self,
        tenant_id: int,
        reporting_record_id: int,
        binding_data: MaterialBindingCreateFromReporting,
        bound_by: int
    ) -> MaterialBindingResponse:
        """
        从报工记录创建物料绑定记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            binding_data: 物料绑定创建数据
            bound_by: 绑定人ID

        Returns:
            MaterialBindingResponse: 创建的物料绑定记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            material = await self._resolve_material(tenant_id, binding_data.material_id)
            material_code, material_name = self._material_code_name(material)

            user_info = await self.get_user_info(bound_by)

            warehouse_name = None
            if binding_data.warehouse_id:
                from apps.master_data.models.warehouse import Warehouse

                warehouse = await Warehouse.get_or_none(
                    tenant_id=tenant_id,
                    id=binding_data.warehouse_id,
                    is_active=True,
                    deleted_at__isnull=True,
                )
                if not warehouse:
                    raise ValidationError(f"仓库不存在或未启用: {binding_data.warehouse_id}")
                warehouse_name = str(getattr(warehouse, "name", "") or "").strip()
                if not warehouse_name:
                    raise ValidationError(f"仓库名称未配置: {binding_data.warehouse_id}")

            bound_at = getattr(binding_data, "bound_at", None) or resolve_business_datetime()

            material_binding = await MaterialBinding.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                binding_type=binding_data.binding_type,
                material_id=binding_data.material_id,
                material_code=material_code,
                material_name=material_name,
                quantity=binding_data.quantity,
                warehouse_id=binding_data.warehouse_id,
                warehouse_name=warehouse_name,
                location_id=binding_data.location_id,
                location_code=binding_data.location_code,
                batch_no=binding_data.batch_no,
                barcode=binding_data.barcode,
                binding_method=binding_data.binding_method,
                bound_by=bound_by,
                bound_by_name=user_info["name"],
                bound_at=bound_at,
                remarks=binding_data.remarks,
            )

            # 库存过账（失败则整个事务回滚，绑定记录不会提交）
            qty = Decimal(str(binding_data.quantity or 0))
            if qty <= 0:
                raise ValidationError(f"绑定数量必须大于0: {qty}")

            binding_type = str(binding_data.binding_type or "").strip().lower()
            stock_extra = self._optional_stock_kwargs(binding_data)
            idem_key = self._binding_idempotency_key(material_binding.id, "create")

            common = dict(
                tenant_id=tenant_id,
                material_id=binding_data.material_id,
                quantity=qty,
                warehouse_id=binding_data.warehouse_id,
                batch_no=binding_data.batch_no,
                source_type=self.SOURCE_TYPE,
                source_doc_id=material_binding.id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                movement_type=self.MOVEMENT_TYPE,
                operator_id=bound_by,
                remark=f"material_binding:create:{binding_type}",
                idempotency_key=idem_key,
                **stock_extra,
            )

            if binding_type == "feeding":
                dec_kwargs = {
                    k: v for k, v in common.items()
                    if k not in ("location_id", "location_code")
                }
                await InventoryService._decrease_stock_no_atomic(**dec_kwargs)
            elif binding_type == "discharging":
                await InventoryService._increase_stock_no_atomic(**common)
            else:
                raise ValidationError(f"不支持的绑定类型: {binding_data.binding_type}")

            logger.info(
                f"物料绑定记录已创建并过账: {material_binding.id}, "
                f"类型: {binding_type}, 物料ID: {binding_data.material_id}, 数量: {qty}"
            )

            return MaterialBindingResponse.model_validate(material_binding)

    async def get_material_bindings_by_reporting_record(
        self,
        tenant_id: int,
        reporting_record_id: int
    ) -> List[MaterialBindingListResponse]:
        """
        根据报工记录ID获取物料绑定记录列表

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID

        Returns:
            List[MaterialBindingListResponse]: 物料绑定记录列表
        """
        bindings = await MaterialBinding.filter(
            tenant_id=tenant_id,
            reporting_record_id=reporting_record_id,
            deleted_at__isnull=True
        ).order_by('-bound_at')

        return [MaterialBindingListResponse.model_validate(binding) for binding in bindings]

    async def delete_material_binding(
        self,
        tenant_id: int,
        binding_id: int,
        operator_id: Optional[int] = None,
    ) -> None:
        """
        删除物料绑定记录（软删除）并反向调整库存

        Args:
            tenant_id: 组织ID
            binding_id: 物料绑定记录ID
            operator_id: 操作人ID（可选，用于库存台账）

        Raises:
            NotFoundError: 物料绑定记录不存在
        """
        async with in_transaction():
            binding = await MaterialBinding.get_or_none(
                id=binding_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not binding:
                raise NotFoundError(f"物料绑定记录不存在: {binding_id}")

            op_id = operator_id if operator_id is not None else binding.bound_by
            binding_type = str(binding.binding_type or "").strip().lower()
            qty = Decimal(str(binding.quantity or 0))
            if qty <= 0:
                raise ValidationError(f"绑定数量无效，无法反向过账: {qty}")

            # 先软删除，再反向过账（同事务；库存失败则整笔回滚）
            binding.deleted_at = resolve_business_datetime()
            await binding.save()

            idem_key = self._binding_idempotency_key(binding.id, "delete")
            common = dict(
                tenant_id=tenant_id,
                material_id=binding.material_id,
                quantity=qty,
                warehouse_id=binding.warehouse_id,
                batch_no=binding.batch_no,
                source_type=self.SOURCE_TYPE,
                source_doc_id=binding.id,
                work_order_id=binding.work_order_id,
                work_order_code=binding.work_order_code,
                movement_type=self.MOVEMENT_TYPE,
                operator_id=op_id,
                remark=f"material_binding:delete:{binding_type}",
                idempotency_key=idem_key,
            )

            if binding_type == "feeding":
                # 上料删除 → 库存回补
                await InventoryService._increase_stock_no_atomic(
                    **common,
                    location_id=binding.location_id,
                    location_code=binding.location_code,
                )
            elif binding_type == "discharging":
                # 下料删除 → 库存扣回
                await InventoryService._decrease_stock_no_atomic(**common)
            else:
                raise ValidationError(f"不支持的绑定类型: {binding.binding_type}")

            logger.info(
                f"物料绑定已软删除并反向过账: {binding_id}, 类型: {binding_type}, 数量: {qty}"
            )
