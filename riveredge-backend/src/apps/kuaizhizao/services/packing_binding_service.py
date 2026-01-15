"""
装箱打包绑定业务服务模块

提供装箱打包绑定记录相关的业务逻辑处理，包括装箱绑定、产品序列号绑定、包装物料绑定等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.packing_binding import PackingBinding
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.schemas.packing_binding import (
    PackingBindingCreateFromReceipt,
    PackingBindingUpdate,
    PackingBindingResponse,
    PackingBindingListResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class PackingBindingService(AppBaseService[PackingBinding]):
    """
    装箱打包绑定服务类

    处理装箱打包绑定记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(PackingBinding)

    async def create_packing_binding_from_receipt(
        self,
        tenant_id: int,
        receipt_id: int,
        binding_data: PackingBindingCreateFromReceipt,
        bound_by: int
    ) -> PackingBindingResponse:
        """
        从成品入库单创建装箱绑定记录

        Args:
            tenant_id: 组织ID
            receipt_id: 成品入库单ID
            binding_data: 装箱绑定创建数据
            bound_by: 绑定人ID

        Returns:
            PackingBindingResponse: 创建的装箱绑定记录信息

        Raises:
            NotFoundError: 成品入库单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取成品入库单
            receipt = await FinishedGoodsReceipt.get_or_none(
                id=receipt_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not receipt:
                raise NotFoundError(f"成品入库单不存在: {receipt_id}")

            # 获取产品信息
            product_code = binding_data.product_code or f"PROD{binding_data.product_id}"
            product_name = binding_data.product_name or f"产品{binding_data.product_id}"

            # 获取包装物料信息（如果提供了包装物料ID）
            packing_material_code = binding_data.packing_material_code
            packing_material_name = binding_data.packing_material_name
            if binding_data.packing_material_id and not packing_material_code:
                # TODO: 从物料服务获取包装物料信息
                packing_material_code = f"PACK{binding_data.packing_material_id}"
                packing_material_name = packing_material_name or f"包装物料{binding_data.packing_material_id}"

            # 获取绑定人信息
            user_info = await self.get_user_info(bound_by)

            # 如果未提供箱号，自动生成箱号
            box_no = binding_data.box_no
            if not box_no:
                # 使用编码生成服务生成箱号
                today = datetime.now().strftime("%Y%m%d")
                try:
                    box_no = await self.generate_code(
                        tenant_id=tenant_id,
                        code_type="BOX_CODE",
                        prefix=f"BOX{today}"
                    )
                except Exception:
                    # 如果编码规则不存在，使用简单格式生成
                    # 获取当前日期和序号
                    existing_count = await PackingBinding.filter(
                        tenant_id=tenant_id,
                        finished_goods_receipt_id=receipt_id,
                        deleted_at__isnull=True
                    ).count()
                    box_no = f"BOX{today}{str(existing_count + 1).zfill(4)}"

            # 创建装箱绑定记录
            packing_binding = await PackingBinding.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                finished_goods_receipt_id=receipt_id,
                product_id=binding_data.product_id,
                product_code=product_code,
                product_name=product_name,
                product_serial_no=binding_data.product_serial_no,
                packing_material_id=binding_data.packing_material_id,
                packing_material_code=packing_material_code,
                packing_material_name=packing_material_name,
                packing_quantity=binding_data.packing_quantity,
                box_no=box_no,
                binding_method=binding_data.binding_method,
                barcode=binding_data.barcode,
                bound_by=bound_by,
                bound_by_name=user_info["name"],
                bound_at=binding_data.bound_at or datetime.now(),
                remarks=binding_data.remarks,
            )

            return PackingBindingResponse.model_validate(packing_binding)

    async def get_packing_bindings_by_receipt(
        self,
        tenant_id: int,
        receipt_id: int
    ) -> List[PackingBindingListResponse]:
        """
        根据成品入库单ID获取装箱绑定记录列表

        Args:
            tenant_id: 组织ID
            receipt_id: 成品入库单ID

        Returns:
            List[PackingBindingListResponse]: 装箱绑定记录列表
        """
        bindings = await PackingBinding.filter(
            tenant_id=tenant_id,
            finished_goods_receipt_id=receipt_id,
            deleted_at__isnull=True
        ).order_by('-bound_at')

        return [PackingBindingListResponse.model_validate(binding) for binding in bindings]

    async def delete_packing_binding(
        self,
        tenant_id: int,
        binding_id: int
    ) -> None:
        """
        删除装箱绑定记录（软删除）

        Args:
            tenant_id: 组织ID
            binding_id: 装箱绑定记录ID

        Raises:
            NotFoundError: 装箱绑定记录不存在
        """
        binding = await PackingBinding.get_or_none(
            id=binding_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not binding:
            raise NotFoundError(f"装箱绑定记录不存在: {binding_id}")

        # 软删除
        binding.deleted_at = datetime.now()
        await binding.save()

