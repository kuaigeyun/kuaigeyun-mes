"""
委外退货业务服务模块

委外成品不合格退回供应商，扣减库存。
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_work_order import (
    OutsourceMaterialReceipt,
    OutsourceProductReturn,
    OutsourceWorkOrder,
)
from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceProductReturnCreate,
    OutsourceProductReturnPreviewLine,
    OutsourceProductReturnPreviewResponse,
    OutsourceProductReturnResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


class OutsourceProductReturnService(AppBaseService[OutsourceProductReturn]):
    def __init__(self):
        super().__init__(OutsourceProductReturn)

    async def _sum_returns_by_receipt(
        self,
        tenant_id: int,
        receipt_ids: List[int],
    ) -> Dict[int, Decimal]:
        if not receipt_ids:
            return {}
        rows = await OutsourceProductReturn.filter(
            tenant_id=tenant_id,
            outsource_material_receipt_id__in=receipt_ids,
            deleted_at__isnull=True,
            status="completed",
        ).all()
        totals: Dict[int, Decimal] = {}
        for row in rows:
            rid = int(row.outsource_material_receipt_id or 0)
            if rid <= 0:
                continue
            totals[rid] = totals.get(rid, Decimal("0")) + Decimal(str(row.quantity or 0))
        return totals

    async def get_return_preview(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
    ) -> OutsourceProductReturnPreviewResponse:
        owo = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=outsource_work_order_id,
            deleted_at__isnull=True,
        ).first()
        if not owo:
            raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")

        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            assert_outsource_work_order_capability,
        )

        assert_outsource_work_order_capability(owo, "push_outsource_product_return")

        receipts = await OutsourceMaterialReceipt.filter(
            tenant_id=tenant_id,
            outsource_work_order_id=outsource_work_order_id,
            deleted_at__isnull=True,
            status="completed",
        ).order_by("-created_at").all()

        returned_by_receipt = await self._sum_returns_by_receipt(
            tenant_id, [int(r.id) for r in receipts if r.id]
        )

        lines: List[OutsourceProductReturnPreviewLine] = []
        for receipt in receipts:
            received = Decimal(str(receipt.quantity or 0))
            returned = returned_by_receipt.get(int(receipt.id), Decimal("0"))
            returnable = max(Decimal("0"), received - returned)
            if returnable <= 0:
                continue
            lines.append(
                OutsourceProductReturnPreviewLine(
                    receipt_id=int(receipt.id),
                    receipt_code=receipt.code,
                    product_code=owo.product_code or "",
                    product_name=owo.product_name or "",
                    unit=receipt.unit or owo.unit or "件",
                    received_quantity=received,
                    returned_quantity=returned,
                    returnable_quantity=returnable,
                    warehouse_id=receipt.warehouse_id,
                    warehouse_name=receipt.warehouse_name,
                )
            )

        message = None
        if not lines:
            message = "该委外工单暂无可退货的收货明细"

        return OutsourceProductReturnPreviewResponse(
            outsource_work_order_id=owo.id,
            outsource_work_order_code=owo.code,
            lines=lines,
            message=message,
        )

    async def _resolve_receipt_for_return(
        self,
        tenant_id: int,
        return_data: OutsourceProductReturnCreate,
    ) -> OutsourceMaterialReceipt:
        if return_data.outsource_material_receipt_id:
            receipt = await OutsourceMaterialReceipt.filter(
                tenant_id=tenant_id,
                id=return_data.outsource_material_receipt_id,
                outsource_work_order_id=return_data.outsource_work_order_id,
                deleted_at__isnull=True,
                status="completed",
            ).first()
            if not receipt:
                raise NotFoundError(f"委外收货单ID {return_data.outsource_material_receipt_id} 不存在")
            return receipt

        preview = await self.get_return_preview(tenant_id, return_data.outsource_work_order_id)
        if not preview.lines:
            raise ValidationError("该委外工单暂无可关联的收货单")
        line = preview.lines[0]
        receipt = await OutsourceMaterialReceipt.filter(
            tenant_id=tenant_id,
            id=line.receipt_id,
            deleted_at__isnull=True,
        ).first()
        if not receipt:
            raise NotFoundError(f"委外收货单ID {line.receipt_id} 不存在")
        return receipt

    async def _validate_return_quantity(
        self,
        tenant_id: int,
        return_data: OutsourceProductReturnCreate,
        receipt: OutsourceMaterialReceipt,
    ) -> None:
        returned_map = await self._sum_returns_by_receipt(tenant_id, [int(receipt.id)])
        returnable = Decimal(str(receipt.quantity or 0)) - returned_map.get(int(receipt.id), Decimal("0"))
        if returnable <= 0:
            raise ValidationError("该收货单已无可退数量")
        if return_data.quantity > returnable:
            raise ValidationError(f"退货数量不能超过可退数量 {returnable}")

    async def create_product_return(
        self,
        tenant_id: int,
        return_data: OutsourceProductReturnCreate,
        created_by: int,
    ) -> OutsourceProductReturnResponse:
        async with in_transaction():
            owo = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=return_data.outsource_work_order_id,
                deleted_at__isnull=True,
            ).first()
            if not owo:
                raise NotFoundError(f"委外工单ID {return_data.outsource_work_order_id} 不存在")

            from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
                assert_outsource_work_order_capability,
            )

            assert_outsource_work_order_capability(owo, "push_outsource_product_return")

            receipt = await self._resolve_receipt_for_return(tenant_id, return_data)
            await self._validate_return_quantity(tenant_id, return_data, receipt)

            if not receipt.warehouse_id:
                raise ValidationError("关联收货单缺少仓库信息，无法扣减库存")

            code = return_data.code
            if not code:
                today = datetime.now().strftime("%Y%m%d")
                existing_codes = await OutsourceProductReturn.filter(
                    tenant_id=tenant_id,
                    code__startswith=f"OPR-{today}",
                    deleted_at__isnull=True,
                ).order_by("-code").limit(1).values_list("code", flat=True)
                if existing_codes:
                    last_code = existing_codes[0]
                    last_seq = int(last_code.split("-")[-1]) if last_code.split("-")[-1].isdigit() else 0
                    seq = last_seq + 1
                else:
                    seq = 1
                code = f"OPR-{today}-{seq:04d}"
            else:
                existing = await OutsourceProductReturn.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    raise ValidationError(f"委外退货单编码 {code} 已存在")

            user_info = await self.get_user_info(created_by)
            now = datetime.now()
            product_return = await OutsourceProductReturn.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                outsource_work_order_id=return_data.outsource_work_order_id,
                outsource_work_order_code=return_data.outsource_work_order_code,
                outsource_material_receipt_id=int(receipt.id),
                quantity=return_data.quantity,
                unit=return_data.unit,
                return_reason=return_data.return_reason,
                status="completed",
                returned_at=now,
                returned_by=created_by,
                returned_by_name=user_info["name"],
                remarks=return_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            owo.received_quantity = max(
                Decimal("0"),
                (owo.received_quantity or Decimal("0")) - return_data.quantity,
            )
            owo.qualified_quantity = max(
                Decimal("0"),
                (owo.qualified_quantity or Decimal("0")) - return_data.quantity,
            )
            await owo.save()

            from apps.kuaizhizao.services.inventory_service import InventoryService

            product_id = owo.product_id
            if not product_id:
                raise ValidationError("委外工单缺少产品信息，无法扣减库存")

            await InventoryService.decrease_stock(
                tenant_id=tenant_id,
                material_id=product_id,
                quantity=return_data.quantity,
                warehouse_id=int(receipt.warehouse_id),
                batch_no=receipt.batch_number,
                source_type="outsource_product_return",
                source_doc_id=product_return.id,
                source_doc_code=code,
            )

            logger.info(f"创建委外退货单成功: {code}")
            await product_return.refresh_from_db()
            return OutsourceProductReturnResponse.model_validate(product_return)

    async def list_product_returns(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        outsource_work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[OutsourceProductReturnResponse]:
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if outsource_work_order_id:
            query &= Q(outsource_work_order_id=outsource_work_order_id)
        if status:
            query &= Q(status=status)
        if keyword:
            query &= Q(code__icontains=keyword)

        rows = await OutsourceProductReturn.filter(query).order_by("-created_at").offset(skip).limit(limit).all()
        from apps.kuaizhizao.services.document_action_policy.enricher import enrich_inbound_hub_list_capabilities
        responses = [OutsourceProductReturnResponse.model_validate(row) for row in rows]
        item_counts = {int(r.id): 1 for r in rows}
        return enrich_inbound_hub_list_capabilities(
            rows, responses, "outsource_product_return", item_counts=item_counts
        )

    async def get_product_return(
        self,
        tenant_id: int,
        return_id: int,
    ) -> OutsourceProductReturnResponse:
        row = await OutsourceProductReturn.filter(
            tenant_id=tenant_id,
            id=return_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"委外退货单ID {return_id} 不存在")
        return OutsourceProductReturnResponse.model_validate(row)
