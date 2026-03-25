"""
叫料请求服务模块

提供叫料请求相关的业务处理逻辑。
"""

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
    MaterialCallRequestListResponse
)
from core.timezone_utils import now_utc
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from core.services.business.code_generation_service import CodeGenerationService


class MaterialCallService(AppBaseService[MaterialCallRequest]):
    """叫料请求服务类"""

    def __init__(self):
        super().__init__(MaterialCallRequest)

    async def create_call_request(
        self,
        tenant_id: int,
        create_data: MaterialCallRequestCreate,
        user: User
    ) -> MaterialCallRequestResponse:
        """发起叫料请求"""
        async with in_transaction():
            # 1. 生成单号
            today = datetime.now().strftime("%Y%m%d")
            code = f"MC{today}"
            # 简化单号生成，实际可使用 CodeGenerationService
            
            # 2. 创建记录
            call_req = await MaterialCallRequest.create(
                tenant_id=tenant_id,
                code=code,
                caller_id=user.id,
                caller_name=user.name or user.username,
                **create_data.model_dump(exclude={"caller_id", "caller_name"})
            )

            return MaterialCallRequestResponse.model_validate(call_req)

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
                data["handler_name"] = user.name or user.username
            
            elif data.get("status") == "processing" and call_req.status == "pending":
                data["handler_id"] = user.id
                data["handler_name"] = user.name or user.username

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
