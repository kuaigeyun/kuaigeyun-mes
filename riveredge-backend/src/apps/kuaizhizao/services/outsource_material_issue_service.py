"""
委外发料业务服务模块

提供委外发料相关的业务逻辑处理。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from tortoise import Tortoise

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialIssue, OutsourceWorkOrder
from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceMaterialIssueCreate,
    OutsourceMaterialIssueUpdate,
    OutsourceMaterialIssueResponse,
    OutsourceMaterialIssuePreviewResponse,
    OutsourceMaterialIssuePreviewLine,
    OutsourceMaterialIssueBatchCreate,
    OutsourceMaterialIssueBatchResponse,
)
from loguru import logger

from apps.kuaizhizao.utils.outsource_work_order_state import apply_outsource_work_order_execution_start


class OutsourceMaterialIssueService(AppBaseService[OutsourceMaterialIssue]):
    """
    委外发料服务类

    处理委外发料相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(OutsourceMaterialIssue)

    async def create_material_issue(
        self,
        tenant_id: int,
        issue_data: OutsourceMaterialIssueCreate,
        created_by: int
    ) -> OutsourceMaterialIssueResponse:
        """
        创建委外发料单

        Args:
            tenant_id: 组织ID
            issue_data: 委外发料创建数据
            created_by: 创建人ID

        Returns:
            OutsourceMaterialIssueResponse: 创建的委外发料单信息

        Raises:
            ValidationError: 数据验证失败
        """
        outsource_work_order = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            id=issue_data.outsource_work_order_id,
            deleted_at__isnull=True,
        ).first()
        if not outsource_work_order:
            raise NotFoundError(f"委外工单ID {issue_data.outsource_work_order_id} 不存在")

        from apps.kuaizhizao.services.document_action_policy.outsource_work_order import (
            assert_outsource_work_order_capability,
        )

        assert_outsource_work_order_capability(outsource_work_order, "push_outsource_issue")

        user_info = await self.get_user_info(created_by)
        stock_payload: Optional[Dict[str, Any]] = None
        response: Optional[OutsourceMaterialIssueResponse] = None

        async with in_transaction():
            conn = Tortoise.get_connection("default")
            await conn.execute_query("SET LOCAL lock_timeout = '8000'")
            locked_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=issue_data.outsource_work_order_id,
                deleted_at__isnull=True,
            ).select_for_update().first()
            if not locked_work_order:
                raise NotFoundError(f"委外工单ID {issue_data.outsource_work_order_id} 不存在")

            code = issue_data.code
            if not code:
                today = datetime.now().strftime("%Y%m%d")
                existing_codes = await OutsourceMaterialIssue.filter(
                    tenant_id=tenant_id,
                    code__startswith=f"OWI-{today}",
                    deleted_at__isnull=True,
                ).order_by("-code").limit(1).values_list("code", flat=True)
                if existing_codes:
                    last_code = existing_codes[0]
                    last_seq = int(last_code.split("-")[-1]) if last_code.split("-")[-1].isdigit() else 0
                    seq = last_seq + 1
                else:
                    seq = 1
                code = f"OWI-{today}-{seq:04d}"
            else:
                existing = await OutsourceMaterialIssue.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    raise ValidationError(f"委外发料单编码 {code} 已存在")

            now = datetime.now()
            material_issue = await OutsourceMaterialIssue.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                outsource_work_order_id=issue_data.outsource_work_order_id,
                outsource_work_order_code=issue_data.outsource_work_order_code,
                material_id=issue_data.material_id,
                material_code=issue_data.material_code,
                material_name=issue_data.material_name,
                quantity=issue_data.quantity,
                unit=issue_data.unit,
                warehouse_id=issue_data.warehouse_id,
                warehouse_name=issue_data.warehouse_name,
                location_id=issue_data.location_id,
                location_name=issue_data.location_name,
                batch_number=issue_data.batch_number,
                status="completed",
                issued_at=now,
                issued_by=created_by,
                issued_by_name=user_info["name"],
                remarks=issue_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            locked_work_order.issued_quantity = (
                (locked_work_order.issued_quantity or Decimal("0")) + issue_data.quantity
            )
            apply_outsource_work_order_execution_start(locked_work_order, now=now)
            await locked_work_order.save()

            logger.info(f"创建委外发料单成功: {code}")

            await material_issue.refresh_from_db()
            response = OutsourceMaterialIssueResponse.model_validate(material_issue)
            stock_payload = {
                "tenant_id": tenant_id,
                "material_id": issue_data.material_id,
                "quantity": issue_data.quantity,
                "warehouse_id": issue_data.warehouse_id,
                "batch_no": getattr(issue_data, "batch_number", None),
                "source_type": "outsource_material_issue",
                "source_doc_id": material_issue.id,
                "source_doc_code": code,
            }

        if stock_payload:
            from apps.kuaizhizao.services.inventory_service import InventoryService

            await InventoryService.decrease_stock(**stock_payload)
        if response is None:
            raise BusinessLogicError("委外发料创建失败")
        return response

    @staticmethod
    def _should_issue_for_outsource(issue_method: Optional[str], source_type: Optional[str]) -> bool:
        from apps.kuaizhizao.utils.issue_method_resolver import resolve_issue_method, ISSUE_METHOD_NONE

        if (source_type or "").strip() in ("Phantom", "Service"):
            return False
        return resolve_issue_method(issue_method, source_type) != ISSUE_METHOD_NONE

    async def get_issue_preview(
        self,
        tenant_id: int,
        outsource_work_order_id: int,
    ) -> OutsourceMaterialIssuePreviewResponse:
        """根据委外工单产品 BOM 生成待发料明细预览。"""
        from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
        from apps.kuaizhizao.utils.inventory_helper import batch_get_material_inventory

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

        assert_outsource_work_order_capability(owo, "push_outsource_issue")

        message: Optional[str] = None
        try:
            reqs = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=owo.product_id,
                required_quantity=float(owo.quantity or 0),
                only_approved=True,
                for_kitting_analysis=True,
            )
        except NotFoundError:
            reqs = []
            message = "产品 BOM 不存在或未审核，请先在工程 BOM 中维护"

        issue_reqs = [
            r for r in reqs
            if self._should_issue_for_outsource(
                getattr(r, "issue_method", None),
                getattr(r, "component_type", None),
            )
        ]

        existing = await OutsourceMaterialIssue.filter(
            tenant_id=tenant_id,
            outsource_work_order_id=outsource_work_order_id,
            deleted_at__isnull=True,
        ).all()
        issued_map: Dict[int, float] = {}
        for issue in existing:
            mid = int(issue.material_id)
            issued_map[mid] = issued_map.get(mid, 0.0) + float(issue.quantity or 0)

        mat_ids = [int(r.component_id) for r in issue_reqs]
        inv_map = await batch_get_material_inventory(tenant_id, mat_ids)

        lines: List[OutsourceMaterialIssuePreviewLine] = []
        for r in issue_reqs:
            mid = int(r.component_id)
            required = Decimal(str(r.net_requirement or r.gross_requirement or 0))
            issued = Decimal(str(issued_map.get(mid, 0)))
            pending = max(Decimal("0"), required - issued)
            available = Decimal(str(inv_map.get(mid, 0)))
            lines.append(
                OutsourceMaterialIssuePreviewLine(
                    material_id=mid,
                    material_code=r.component_code or "",
                    material_name=r.component_name or "",
                    unit=r.unit or "",
                    required_quantity=required,
                    issued_quantity=issued,
                    pending_quantity=pending,
                    available_quantity=available,
                    issue_method=getattr(r, "issue_method", None) or "pick",
                )
            )

        if not lines and not message:
            message = "BOM 中无需要发料的子件（虚拟件/不发料项已排除）"

        return OutsourceMaterialIssuePreviewResponse(
            outsource_work_order_id=owo.id,
            outsource_work_order_code=owo.code,
            product_name=owo.product_name,
            quantity=owo.quantity or Decimal("0"),
            lines=lines,
            message=message,
        )

    async def create_material_issues_batch(
        self,
        tenant_id: int,
        batch_data: OutsourceMaterialIssueBatchCreate,
        created_by: int,
    ) -> OutsourceMaterialIssueBatchResponse:
        """批量创建委外发料单。"""
        if not batch_data.lines:
            raise ValidationError("请至少填写一条发料明细")

        created: List[OutsourceMaterialIssueResponse] = []
        for line in batch_data.lines:
            wh_id = line.warehouse_id or batch_data.warehouse_id
            wh_name = line.warehouse_name or batch_data.warehouse_name
            issue_data = OutsourceMaterialIssueCreate(
                outsource_work_order_id=batch_data.outsource_work_order_id,
                outsource_work_order_code=batch_data.outsource_work_order_code,
                material_id=line.material_id,
                material_code=line.material_code,
                material_name=line.material_name,
                quantity=line.quantity,
                unit=line.unit,
                warehouse_id=wh_id,
                warehouse_name=wh_name,
                batch_number=line.batch_number,
                remarks=batch_data.remarks,
            )
            resp = await self.create_material_issue(
                tenant_id=tenant_id,
                issue_data=issue_data,
                created_by=created_by,
            )
            created.append(resp)

        return OutsourceMaterialIssueBatchResponse(
            created_count=len(created),
            issues=created,
        )

    async def _normalize_legacy_draft_issues(
        self, issues: List[OutsourceMaterialIssue]
    ) -> None:
        """历史数据：创建时已扣库存但状态仍为 draft，补写为 completed。"""
        for issue in issues:
            if issue.status != "draft":
                continue
            issue.status = "completed"
            if not issue.issued_at:
                issue.issued_at = issue.created_at or datetime.now()
            if not issue.issued_by:
                issue.issued_by = issue.created_by
            if not issue.issued_by_name:
                issue.issued_by_name = issue.created_by_name
            await issue.save()
            logger.info(f"补写委外发料单状态 draft->completed: {issue.code}")

    async def list_material_issues(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        outsource_work_order_id: Optional[int] = None,
        status: Optional[str] = None,
        keyword: Optional[str] = None,
    ) -> List[OutsourceMaterialIssueResponse]:
        """
        获取委外发料单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            outsource_work_order_id: 委外工单ID筛选
            status: 状态筛选
            keyword: 关键词搜索

        Returns:
            List[OutsourceMaterialIssueResponse]: 委外发料单列表
        """
        query = Q(tenant_id=tenant_id, deleted_at__isnull=True)

        if outsource_work_order_id:
            query &= Q(outsource_work_order_id=outsource_work_order_id)
        if status:
            query &= Q(status=status)
        if keyword:
            query &= (Q(code__icontains=keyword) | Q(material_name__icontains=keyword))

        issues = await OutsourceMaterialIssue.filter(query).order_by("-created_at").offset(skip).limit(limit).all()

        await self._normalize_legacy_draft_issues(issues)

        out: List[OutsourceMaterialIssueResponse] = []
        for issue in issues:
            resp = OutsourceMaterialIssueResponse.model_validate(issue)
            out.append(
                resp.model_copy(
                    update={
                        "total_quantity": float(issue.quantity or 0),
                        "total_items": 1,
                    }
                )
            )
        return out

    async def get_material_issue(
        self,
        tenant_id: int,
        issue_id: int
    ) -> OutsourceMaterialIssueResponse:
        """
        获取委外发料单详情

        Args:
            tenant_id: 组织ID
            issue_id: 委外发料单ID

        Returns:
            OutsourceMaterialIssueResponse: 委外发料单信息

        Raises:
            NotFoundError: 委外发料单不存在
        """
        issue = await OutsourceMaterialIssue.filter(
            tenant_id=tenant_id,
            id=issue_id,
            deleted_at__isnull=True
        ).first()

        if not issue:
            raise NotFoundError(f"委外发料单ID {issue_id} 不存在")

        await self._normalize_legacy_draft_issues([issue])

        resp = OutsourceMaterialIssueResponse.model_validate(issue)
        return resp.model_copy(
            update={
                "total_quantity": float(issue.quantity or 0),
                "total_items": 1,
            }
        )

    async def complete_material_issue(
        self,
        tenant_id: int,
        issue_id: int,
        completed_by: int
    ) -> OutsourceMaterialIssueResponse:
        """
        完成委外发料（更新状态为completed，记录发料时间和发料人）

        Args:
            tenant_id: 组织ID
            issue_id: 委外发料单ID
            completed_by: 完成人ID

        Returns:
            OutsourceMaterialIssueResponse: 更新后的委外发料单信息

        Raises:
            NotFoundError: 委外发料单不存在
        """
        issue = await OutsourceMaterialIssue.filter(
            tenant_id=tenant_id,
            id=issue_id,
            deleted_at__isnull=True
        ).first()

        if not issue:
            raise NotFoundError(f"委外发料单ID {issue_id} 不存在")

        if issue.status == "completed":
            raise BusinessLogicError("委外发料单已完成，不能重复完成")

        # 获取完成人信息
        user_info = await self.get_user_info(completed_by)

        # 更新状态
        issue.status = "completed"
        issue.issued_at = datetime.now()
        issue.issued_by = completed_by
        issue.issued_by_name = user_info["name"]
        issue.updated_by = completed_by
        issue.updated_by_name = user_info["name"]
        await issue.save()

        logger.info(f"完成委外发料单: {issue.code}")

        await issue.refresh_from_db()
        return OutsourceMaterialIssueResponse.model_validate(issue)
