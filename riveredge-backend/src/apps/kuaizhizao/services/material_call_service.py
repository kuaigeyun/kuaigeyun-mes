"""
叫料请求服务模块

提供叫料请求相关的业务处理逻辑。
"""

import uuid
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from tortoise.transactions import in_transaction

from apps.base_service import AppBaseService
from infra.models.user import User
from apps.kuaizhizao.models.material_call_request import MaterialCallRequest
from apps.kuaizhizao.schemas.material_call import (
    MaterialCallRequestCreate,
    MaterialCallRequestUpdate,
    MaterialCallRequestResponse,
    MaterialCallRequestListResponse,
)
from core.timezone_utils import now_utc
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from core.services.business.code_generation_service import CodeGenerationService


def _user_display_name(user: User) -> str:
    """展示用姓名：优先 full_name，否则 username（User 无 name 字段）。"""
    fn = user.full_name
    if fn and str(fn).strip():
        return str(fn).strip()
    return user.username


class MaterialCallService(AppBaseService[MaterialCallRequest]):
    """叫料请求服务类"""

    def __init__(self):
        super().__init__(MaterialCallRequest)

    def _next_material_call_code(self) -> str:
        """生成唯一叫料单号（同日多条不冲突）"""
        return f"MC{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"

    async def create_call_request(
        self,
        tenant_id: int,
        create_data: MaterialCallRequestCreate,
        user: User
    ) -> MaterialCallRequestResponse:
        """发起叫料请求"""
        ct = (create_data.call_type or "SINGLE_MATERIAL").strip()
        if ct == "SINGLE_MATERIAL":
            reason = (create_data.call_reason or "").strip()
            if not reason:
                raise ValidationError("单物料叫料须选择叫料原因")
        async with in_transaction():
            code = self._next_material_call_code()
            call_req = await MaterialCallRequest.create(
                tenant_id=tenant_id,
                code=code,
                caller_id=user.id,
                caller_name=_user_display_name(user),
                **create_data.model_dump(exclude={"caller_id", "caller_name"})
            )

            return MaterialCallRequestResponse.model_validate(call_req)

    async def batch_create_from_work_order_kitting(
        self,
        tenant_id: int,
        work_order_id: int,
        user: User,
    ) -> List[MaterialCallRequestResponse]:
        """
        整单叫料：按工单齐套分析，对 shortage_quantity > 0 的物料逐条生成叫料（call_type=FULL_ORDER）。
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        analysis = await WorkOrderService().get_work_order_kitting_analysis(tenant_id, work_order_id)
        created: List[MaterialCallRequestResponse] = []
        for item in analysis.items:
            shortage = item.shortage_quantity
            if shortage is None or shortage <= Decimal("0"):
                continue
            create_data = MaterialCallRequestCreate(
                work_order_id=analysis.work_order_id,
                work_order_code=analysis.work_order_code,
                material_id=item.material_id,
                material_code=item.material_code,
                material_name=item.material_name,
                material_unit=item.material_unit,
                requested_quantity=shortage,
                call_type="FULL_ORDER",
                priority="normal",
                remarks="工单整单叫料（按 BOM 齐套缺料）",
                caller_id=user.id,
                caller_name=_user_display_name(user),
            )
            created.append(await self.create_call_request(tenant_id, create_data, user))
        if not created:
            raise ValidationError("当前工单齐套分析无缺料行，无需整单叫料")
        return created

    async def list_call_requests(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 20,
        status: Optional[str] = None,
        work_order_id: Optional[int] = None,
        material_id: Optional[int] = None
    ) -> List[MaterialCallRequestResponse]:
        """查询叫料请求列表"""
        query = MaterialCallRequest.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        
        if status:
            query = query.filter(status=status)
        if work_order_id:
            query = query.filter(work_order_id=work_order_id)
        if material_id:
            query = query.filter(material_id=material_id)

        requests = await query.offset(skip).limit(limit).order_by("-created_at")
        return [MaterialCallRequestResponse.model_validate(r) for r in requests]

    async def update_call_request(
        self,
        tenant_id: int,
        call_id: int,
        update_data: MaterialCallRequestUpdate,
        user: User
    ) -> MaterialCallRequestResponse:
        """更新叫料请求（处理状态/数量等）"""
        async with in_transaction():
            call_req = await MaterialCallRequest.get_or_none(tenant_id=tenant_id, id=call_id)
            if not call_req:
                raise NotFoundError(f"叫料请求不存在: {call_id}")

            data = update_data.model_dump(exclude_unset=True)
            
            # 如果状态变更为 completed，记录完成时间
            if data.get("status") == "completed" and call_req.status != "completed":
                data["completed_at"] = now_utc()
                if not data.get("delivered_quantity"):
                    data["delivered_quantity"] = call_req.requested_quantity
                # 记录处理人
                data["handler_id"] = user.id
                data["handler_name"] = _user_display_name(user)
            
            elif data.get("status") == "processing" and call_req.status == "pending":
                data["handler_id"] = user.id
                data["handler_name"] = _user_display_name(user)

            for key, value in data.items():
                setattr(call_req, key, value)
            
            await call_req.save()

            return MaterialCallRequestResponse.model_validate(call_req)

    async def cancel_call_request(
        self,
        tenant_id: int,
        call_id: int,
        updated_by: int
    ) -> bool:
        """取消叫料请求"""
        call_req = await MaterialCallRequest.get_or_none(tenant_id=tenant_id, id=call_id)
        if not call_req:
            raise NotFoundError(f"叫料请求不存在: {call_id}")
        
        if call_req.status in ["processing", "completed"]:
            raise BusinessLogicError(f"当前状态 {call_req.status} 不允许取消")

        call_req.status = "cancelled"
        call_req.updated_by = updated_by
        await call_req.save()
        return True
