"""
委外发料业务服务模块

提供委外发料相关的业务逻辑处理。

根据功能点2.1.10：委外工单管理（核心功能，新增）

Author: Auto (AI Assistant)
Date: 2026-01-16
"""

import uuid
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.base_service import AppBaseService
from apps.kuaizhizao.models.outsource_work_order import OutsourceMaterialIssue, OutsourceWorkOrder
from apps.kuaizhizao.schemas.outsource_work_order import (
    OutsourceMaterialIssueCreate,
    OutsourceMaterialIssueUpdate,
    OutsourceMaterialIssueResponse,
)
from loguru import logger


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
        async with in_transaction():
            # 验证委外工单是否存在
            outsource_work_order = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                id=issue_data.outsource_work_order_id,
                deleted_at__isnull=True
            ).first()

            if not outsource_work_order:
                raise NotFoundError(f"委外工单ID {issue_data.outsource_work_order_id} 不存在")

            # 处理编码
            code = issue_data.code
            if not code:
                # 自动生成编码（格式：OWI-日期-序号）
                today = datetime.now().strftime("%Y%m%d")
                existing_codes = await OutsourceMaterialIssue.filter(
                    tenant_id=tenant_id,
                    code__startswith=f"OWI-{today}",
                    deleted_at__isnull=True
                ).order_by("-code").limit(1).values_list("code", flat=True)
                
                if existing_codes:
                    last_code = existing_codes[0]
                    last_seq = int(last_code.split("-")[-1]) if last_code.split("-")[-1].isdigit() else 0
                    seq = last_seq + 1
                else:
                    seq = 1
                
                code = f"OWI-{today}-{seq:04d}"
            else:
                # 验证编码唯一性
                existing = await OutsourceMaterialIssue.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True
                ).first()
                
                if existing:
                    raise ValidationError(f"委外发料单编码 {code} 已存在")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建委外发料单
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
                status=issue_data.status,
                issued_at=issue_data.issued_at,
                remarks=issue_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            # 更新委外工单的已发料数量
            outsource_work_order.issued_quantity = (
                (outsource_work_order.issued_quantity or Decimal("0")) + issue_data.quantity
            )
            await outsource_work_order.save()

            # TODO: 更新库存（待库存服务实现后补充）
            # await inventory_service.decrease_stock(...)

            logger.info(f"创建委外发料单成功: {code}")
            
            return OutsourceMaterialIssueResponse.model_validate(material_issue)

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

        return [OutsourceMaterialIssueResponse.model_validate(issue) for issue in issues]

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

        return OutsourceMaterialIssueResponse.model_validate(issue)

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
        
        return OutsourceMaterialIssueResponse.model_validate(issue)
