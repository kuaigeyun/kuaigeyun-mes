"""
数据验证 API 模块

提供基础数据完整性验证的 RESTful API 接口，用于MES创建工单前的数据校验。
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException as FastAPIHTTPException, Query, status
from typing import Any, Optional, Annotated
from loguru import logger

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from apps.master_data.services.validation_service import DataValidationService, ValidationResult
from pydantic import BaseModel
from typing import List


class ValidationResponse(BaseModel):
    """验证响应 Schema"""

    is_valid: bool = True
    errors: List[str] = []
    warnings: List[str] = []

    class Config:
        from_attributes = True


router = APIRouter(prefix="/validation", tags=["Data Validation"])


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str = "/validation",
    tenant_id: Optional[int] = None,
) -> FastAPIHTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "master_data_validation_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return FastAPIHTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


def HTTPException(*, status_code: int, detail: Any, **kwargs) -> FastAPIHTTPException:
    message = detail.get("message") if isinstance(detail, dict) else str(detail)
    return _http_exception_with_trace(status_code, message)


# ==================== 数据验证接口 ====================

@router.get("/product/{product_id}/for-work-order", response_model=ValidationResponse, summary="验证产品是否可以用于创建工单")
async def validate_product_for_work_order(
    product_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    验证产品是否可以用于创建工单

    检查产品是否存在、是否启用，以及相关的基础数据（BOM、工艺路线）完整性。
    用于MES创建工单前的数据验证。

    - **product_id**: 产品ID

    返回结构：
    ```json
    {
      "isValid": true,
      "errors": [],
      "warnings": [
        "产品 P001 没有BOM数据",
        "产品 P001 没有关联的工艺路线"
      ]
    }
    ```

    错误示例：
    ```json
    {
      "isValid": false,
      "errors": [
        "产品ID 123 不存在",
        "产品 P001 - 测试产品 未启用"
      ],
      "warnings": []
    }
    ```
    """
    try:
        result = await DataValidationService.validate_product_for_work_order(tenant_id, product_id)
        return ValidationResponse(
            is_valid=result.is_valid,
            errors=result.errors,
            warnings=result.warnings
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"验证产品数据时发生错误: {str(e)}"
        )


@router.get("/process-route/{process_route_id}/for-work-order", response_model=ValidationResponse, summary="验证工艺路线是否可以用于创建工单")
async def validate_process_route_for_work_order(
    process_route_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    验证工艺路线是否可以用于创建工单

    检查工艺路线是否存在、是否启用，以及相关工序数据的完整性。
    用于MES创建工单前的数据验证。

    - **process_route_id**: 工艺路线ID

    返回结构同上。
    """
    try:
        result = await DataValidationService.validate_process_route_for_work_order(tenant_id, process_route_id)
        return ValidationResponse(
            is_valid=result.is_valid,
            errors=result.errors,
            warnings=result.warnings
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"验证工艺路线数据时发生错误: {str(e)}"
        )


@router.get("/work-order-data-integrity", response_model=ValidationResponse, summary="验证工单数据的完整性")
async def validate_work_order_data_integrity(
    product_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)],
    process_route_id: Optional[int] = Query(None, description="工艺路线ID（可选）")
):
    """
    验证工单数据的完整性

    这是MES创建工单前的主要验证接口，综合验证产品和工艺路线的数据完整性。

    - **product_id**: 产品ID
    - **process_route_id**: 工艺路线ID（可选，如果指定则额外验证）

    返回结构：
    ```json
    {
      "isValid": false,
      "errors": [
        "产品 P001 关联的工艺路线ID 456 不存在",
        "工艺路线 ROUTE001 中引用的工序ID 789 不存在"
      ],
      "warnings": [
        "产品 P001 没有BOM数据"
      ]
    }
    ```
    """
    try:
        result = await DataValidationService.validate_work_order_data_integrity(
            tenant_id, product_id, process_route_id
        )
        return ValidationResponse(
            is_valid=result.is_valid,
            errors=result.errors,
            warnings=result.warnings
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"验证工单数据完整性时发生错误: {str(e)}"
        )
