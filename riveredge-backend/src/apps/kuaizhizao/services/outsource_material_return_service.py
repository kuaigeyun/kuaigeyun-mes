"""
委外退料业务服务模块

供应商退回未使用的委外发料原料，增加库存。
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_work_order import (
    OutsourceMaterialIssue,
    OutsourceMaterialReturn,
    OutsourceWorkOrder,
)
from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceMaterialReturnCreate,
    OutsourceMaterialReturnPreviewLine,
    OutsourceMaterialReturnPreviewResponse,
    OutsourceMaterialReturnResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger


class OutsourceMaterialReturnService(AppBaseService[OutsourceMaterialReturn]):
    def __init__(self):
        super().__init__(OutsourceMaterialReturn)

    async def _sum_returns_by_issue(
        self,
        tenant_id: int,
        issue_ids: List[int],
    ) -> Dict[int, Decimal]:
        if not issue_ids:
            return {}
        rows = await OutsourceMaterialReturn.filter(
            tenant_id=tenant_id,
            outsource_material_issue_id__in=issue_ids,
            deleted_at__isnull=True,
            status="completed",
        ).all()
        totals: Dict[int, Decimal] = {}
        for row in rows:
            iid = int(row.outsource_material_issue_id or 0)
            if iid <= 0:
                continue
            totals[iid] = totals.get(iid, Decimal("0")) + Decimal(str(row.quantity or 0))
        return totals

    async def get_return_preview(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
    ) -> OutsourceMaterialReturnPreviewResponse:
        owo = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=outsource_work_order_id,
            deleted_at__isnull=True,
        ).first()
        if not owo:
            raise NotFoundError(f"委外工单ID {outsource_work_order_id} 不存在")

        issues = await OutsourceMaterialIssue.filter(
            tenant_id=tenant_id,
            outsource_work_order_id=outsource_work_order_id,
            deleted_at__isnull=True,
            status="completed",
        ).order_by("-created_at").all()

        returned_by_issue = await self._sum_returns_by_issue(
            tenant_id, [int(i.id) for i in issues if i.id]
        )

        lines: List[OutsourceMaterialReturnPreviewLine] = []
        for issue in issues:
            issued = Decimal(str(issue.quantity or 0))
            returned = returned_by_issue.get(int(issue.id), Decimal("0"))
            returnable = max(Decimal("0"), issued - returned)
            if returnable <= 0:
                continue
            lines.append(
                OutsourceMaterialReturnPreviewLine(
                    issue_id=int(issue.id),
                    issue_code=issue.code,
                    material_id=int(issue.material_id),
                    material_code=issue.material_code,
                    material_name=issue.material_name,
                    unit=issue.unit,
                    issued_quantity=issued,
                    returned_quantity=returned,
                    returnable_quantity=returnable,
                )
            )

        message = None
        if not lines:
            message = "该委外工单暂无可退料的发料明细"

        return OutsourceMaterialReturnPreviewResponse(
            outsource_work_order_id=owo.id,
            outsource_work_order_code=owo.code,
            lines=lines,
            message=message,
        )

    async def _validate_return_quantity(
        self,
        tenant_id: int,
        return_data: OutsourceMaterialReturnCreate,
    ) -> None:
        if return_data.outsource_material_issue_id:
            issue = await OutsourceMaterialIssue.filter(
                tenant_id=tenant_id,
                id=return_data.outsource_material_issue_id,
                outsource_work_order_id=return_data.outsource_work_order_id,
                deleted_at__isnull=True,
                status="completed",
            ).first()
            if not issue:
                raise NotFoundError(f"委外发料单ID {return_data.outsource_material_issue_id} 不存在")
            if int(issue.material_id) != int(return_data.material_id):
                raise ValidationError("退料物料与发料单物料不一致")
            returned_map = await self._sum_returns_by_issue(tenant_id, [int(issue.id)])
            returnable = Decimal(str(issue.quantity or 0)) - returned_map.get(int(issue.id), Decimal("0"))
            if return_data.quantity > returnable:
                raise ValidationError(f"退料数量不能超过可退数量 {returnable}")
            return

        preview = await self.get_return_preview(tenant_id, return_data.outsource_work_order_id)
        total_returnable = sum(
            (line.returnable_quantity for line in preview.lines if int(line.material_id) == int(return_data.material_id)),
            Decimal("0"),
        )
        if total_returnable <= 0:
            raise ValidationError("该物料在该委外工单下无可退数量")
        if return_data.quantity > total_returnable:
            raise ValidationError(f"退料数量不能超过可退数量 {total_returnable}")

    async def create_material_return(
        self,
        tenant_id: int,
        return_data: OutsourceMaterialReturnCreate,
        created_by: int,
    ) -> OutsourceMaterialReturnResponse:
        async with in_transaction():
            owo = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=return_data.outsource_work_order_id,
                deleted_at__isnull=True,
            ).first()
            if not owo:
                raise NotFoundError(f"委外工单ID {return_data.outsource_work_order_id} 不存在")

            await self._validate_return_quantity(tenant_id, return_data)

            code = return_data.code
            if not code:
                today = datetime.now().strftime("%Y%m%d")
                existing_codes = await OutsourceMaterialReturn.filter(
                    tenant_id=tenant_id,
                    code__startswith=f"OMR-{today}",
                    deleted_at__isnull=True,
                ).order_by("-code").limit(1).values_list("code", flat=True)
                if existing_codes:
                    last_code = existing_codes[0]
                    last_seq = int(last_code.split("-")[-1]) if last_code.split("-")[-1].isdigit() else 0
                    seq = last_seq + 1
                else:
                    seq = 1
                code = f"OMR-{today}-{seq:04d}"
            else:
                existing = await OutsourceMaterialReturn.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    raise ValidationError(f"委外退料单编码 {code} 已存在")

            user_info = await self.get_user_info(created_by)
            now = datetime.now()
            material_return = await OutsourceMaterialReturn.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                outsource_work_order_id=return_data.outsource_work_order_id,
                outsource_work_order_code=return_data.outsource_work_order_code,
                outsource_material_issue_id=return_data.outsource_material_issue_id,
                material_id=return_data.material_id,
                material_code=return_data.material_code,
                material_name=return_data.material_name,
                quantity=return_data.quantity,
                unit=return_data.unit,
                warehouse_id=return_data.warehouse_id,
                warehouse_name=return_data.warehouse_name,
                location_id=return_data.location_id,
                batch_number=return_data.batch_number,
                status="completed",
                returned_at=now,
                returned_by=created_by,
                returned_by_name=user_info["name"],
                remarks=return_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            owo.issued_quantity = max(
                Decimal("0"),
                (owo.issued_quantity or Decimal("0")) - return_data.quantity,
            )
            await owo.save()

            from apps.kuaizhizao.services.inventory_service import InventoryService

            await InventoryService.increase_stock(
                tenant_id=tenant_id,
                material_id=return_data.material_id,
                quantity=return_data.quantity,
                warehouse_id=return_data.warehouse_id,
                batch_no=return_data.batch_number,
                source_type="outsource_material_return",
                source_doc_id=material_return.id,
                source_doc_code=code,
            )

            logger.info(f"创建委外退料单成功: {code}")
            await material_return.refresh_from_db()
            return OutsourceMaterialReturnResponse.model_validate(material_return)

    async def list_material_returns(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        outsource_work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[OutsourceMaterialReturnResponse]:
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)
        if outsource_work_order_id:
            query &= Q(outsource_work_order_id=outsource_work_order_id)
        if status:
            query &= Q(status=status)
        if keyword:
            query &= Q(code__icontains=keyword) | Q(material_name__icontains=keyword)

        rows = await OutsourceMaterialReturn.filter(query).order_by("-created_at").offset(skip).limit(limit).all()
        from apps.kuaizhizao.services.document_action_policy.enricher import enrich_inbound_hub_list_capabilities
        responses = [OutsourceMaterialReturnResponse.model_validate(row) for row in rows]
        return enrich_inbound_hub_list_capabilities(rows, responses, "outsource_material_return")

    async def get_material_return(
        self,
        tenant_id: int,
        return_id: int,
    ) -> OutsourceMaterialReturnResponse:
        row = await OutsourceMaterialReturn.filter(
            tenant_id=tenant_id,
            id=return_id,
            deleted_at__isnull=True,
        ).first()
        if not row:
            raise NotFoundError(f"委外退料单ID {return_id} 不存在")
        return OutsourceMaterialReturnResponse.model_validate(row)
