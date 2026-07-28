"""
质量管理 API（质检中心、质检方案、质检标准）

与 production-execution-reporting 分离，使用 manifest 中质量管理模块权限。
"""

from datetime import datetime
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, Query, status as http_status, Path, HTTPException, Body
from fastapi.responses import JSONResponse
from loguru import logger

from apps.kuaizhizao.api._kuaizhizao_route_access import require_kuaizhizao_module_access
from apps.kuaizhizao.schemas.inspection_plan import (
    InspectionPlanCreate,
    InspectionPlanUpdate,
    InspectionPlanResponse,
    InspectionPlanListResponse,
    InspectionPlanListEnvelope,
)
from apps.kuaizhizao.schemas.quality import (
    QualityStandardCreate,
    QualityStandardUpdate,
    QualityStandardResponse,
    QualityStandardListResponse,
)
from apps.kuaizhizao.services.inspection_plan_list_core import INSPECTION_PLAN_SORTABLE_FIELDS
from apps.kuaizhizao.services.inspection_plan_service import InspectionPlanService
from apps.kuaizhizao.services.quality_service import FinishedGoodsInspectionService
from apps.kuaizhizao.services.quality_standard_service import QualityStandardService
from core.api.deps import get_current_user, get_current_tenant
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

dashboard_router = APIRouter(
    tags=["App - Kuaige Zhizao - Quality Management Dashboard"],
    dependencies=[Depends(require_kuaizhizao_module_access("quality-management-dashboard"))],
)

plans_router = APIRouter(
    tags=["App - Kuaige Zhizao - Quality Management Plans"],
    dependencies=[Depends(require_kuaizhizao_module_access("quality-management-inspection-plans"))],
)

router = APIRouter()


def _http_exception_with_trace(
    status_code: int,
    message: str,
    route: str,
    tenant_id: Optional[int] = None,
) -> HTTPException:
    trace_id = uuid.uuid4().hex
    logger.warning(
        "quality_management_api_error trace_id={} tenant_id={} route={} status_code={} message={}",
        trace_id,
        tenant_id,
        route,
        status_code,
        message,
    )
    return HTTPException(
        status_code=status_code,
        detail={"message": message, "trace_id": trace_id},
    )


@dashboard_router.get("/quality/inspection-center-summary", summary="QC center dashboard summary")
async def get_inspection_center_summary(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    data = await FinishedGoodsInspectionService().get_inspection_center_summary(tenant_id=tenant_id)
    return JSONResponse(content=data, status_code=http_status.HTTP_200_OK)


@dashboard_router.get("/quality/anomalies", summary="List quality anomaly records")
async def get_quality_anomalies(
    inspection_type: Optional[str] = Query(None, description="检验类型（incoming/process/finished）"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（仅用于来料检验）"),
    limit: int = Query(100, ge=1, le=500, description="返回条数上限"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    anomalies = await FinishedGoodsInspectionService().get_quality_anomalies(
        tenant_id=tenant_id,
        inspection_type=inspection_type,
        start_date=start_date,
        end_date=end_date,
        material_id=material_id,
        supplier_id=supplier_id,
        limit=limit,
    )
    return JSONResponse(
        content={"total": len(anomalies), "anomalies": anomalies},
        status_code=http_status.HTTP_200_OK,
    )


@dashboard_router.get("/quality/statistics", summary="Quality analytics")
async def get_quality_statistics(
    inspection_type: Optional[str] = Query(None, description="检验类型（incoming/process/finished）"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    supplier_id: Optional[int] = Query(None, description="供应商ID（仅用于来料检验）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    stats = await FinishedGoodsInspectionService().get_quality_statistics(
        tenant_id=tenant_id,
        inspection_type=inspection_type,
        start_date=start_date,
        end_date=end_date,
        material_id=material_id,
        supplier_id=supplier_id,
    )
    return JSONResponse(content=stats, status_code=http_status.HTTP_200_OK)


@plans_router.post("/quality-standards", response_model=QualityStandardResponse, summary="Create quality standard")
async def create_quality_standard(
    standard: QualityStandardCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityStandardResponse:
    try:
        return await QualityStandardService().create_quality_standard(
            tenant_id=tenant_id,
            standard_data=standard,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/quality-standards", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards", tenant_id)


@plans_router.get("/quality-standards", response_model=List[QualityStandardListResponse], summary="List quality standards")
async def list_quality_standards(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    standard_type: Optional[str] = Query(None, description="标准类型（incoming/process/finished）"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    standard_code: Optional[str] = Query(None, description="标准编码（模糊搜索）"),
    standard_name: Optional[str] = Query(None, description="标准名称（模糊搜索）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[QualityStandardListResponse]:
    try:
        return await QualityStandardService().list_quality_standards(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            standard_type=standard_type,
            material_id=material_id,
            is_active=is_active,
            standard_code=standard_code,
            standard_name=standard_name,
        )
    except Exception as e:
        logger.error(f"获取质检标准列表失败: {str(e)}")
        raise _http_exception_with_trace(500, f"获取列表失败: {str(e)}", "/quality-standards", tenant_id)


@plans_router.get("/quality-standards/{standard_id}", response_model=QualityStandardResponse, summary="Get quality standard")
async def get_quality_standard(
    standard_id: int = Path(..., description="质检标准ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityStandardResponse:
    try:
        return await QualityStandardService().get_quality_standard_by_id(
            tenant_id=tenant_id,
            standard_id=standard_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards/{standard_id}", tenant_id)


@plans_router.put("/quality-standards/{standard_id}", response_model=QualityStandardResponse, summary="Update quality standard")
async def update_quality_standard(
    standard_id: int = Path(..., description="质检标准ID"),
    standard: QualityStandardUpdate = Body(..., description="质检标准更新数据"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> QualityStandardResponse:
    try:
        return await QualityStandardService().update_quality_standard(
            tenant_id=tenant_id,
            standard_id=standard_id,
            standard_data=standard,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards/{standard_id}", tenant_id)


@plans_router.delete("/quality-standards/{standard_id}", summary="Delete quality standard")
async def delete_quality_standard(
    standard_id: int = Path(..., description="质检标准ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    try:
        await QualityStandardService().delete_quality_standard(
            tenant_id=tenant_id,
            standard_id=standard_id,
        )
        return JSONResponse(
            content={"message": "质检标准删除成功"},
            status_code=http_status.HTTP_200_OK,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/quality-standards/{standard_id}", tenant_id)


@plans_router.get(
    "/quality-standards/by-material/{material_id}",
    response_model=List[QualityStandardListResponse],
    summary="List quality standards by material",
)
async def get_standards_by_material(
    material_id: int = Path(..., description="物料ID"),
    standard_type: Optional[str] = Query(None, description="标准类型（incoming/process/finished）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[QualityStandardListResponse]:
    try:
        return await QualityStandardService().get_standards_by_material(
            tenant_id=tenant_id,
            material_id=material_id,
            standard_type=standard_type,
        )
    except Exception as e:
        logger.error(f"根据物料ID获取质检标准失败: {str(e)}")
        raise _http_exception_with_trace(
            500,
            f"获取标准失败: {str(e)}",
            "/quality-standards/by-material/{material_id}",
            tenant_id,
        )


@plans_router.post("/inspection-plans", response_model=InspectionPlanResponse, summary="Create inspection plan")
async def create_inspection_plan(
    plan: InspectionPlanCreate,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanResponse:
    try:
        return await InspectionPlanService().create_inspection_plan(
            tenant_id=tenant_id,
            plan_data=plan,
            created_by=current_user.id,
        )
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inspection-plans", tenant_id)
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans", tenant_id)


@plans_router.get("/inspection-plans", response_model=InspectionPlanListEnvelope, summary="List inspection plans")
async def list_inspection_plans(
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="限制数量"),
    plan_type: Optional[str] = Query(None, description="方案类型（incoming/process/finished）"),
    material_id: Optional[int] = Query(None, description="物料ID"),
    operation_id: Optional[int] = Query(None, description="工序ID（过程检验时筛选）"),
    is_active: Optional[bool] = Query(None, description="是否启用"),
    plan_code: Optional[str] = Query(None, description="方案编码（模糊搜索）"),
    plan_name: Optional[str] = Query(None, description="方案名称（模糊搜索）"),
    keyword: Optional[str] = Query(None, description="模糊搜索（编码、名称）"),
    created_start_date: Optional[str] = Query(None, description="创建开始日期 YYYY-MM-DD"),
    created_end_date: Optional[str] = Query(None, description="创建结束日期 YYYY-MM-DD"),
    updated_start_date: Optional[str] = Query(None, description="更新开始日期 YYYY-MM-DD"),
    updated_end_date: Optional[str] = Query(None, description="更新结束日期 YYYY-MM-DD"),
    order_by: Optional[str] = Query(None, description="排序字段（前缀-表示降序）"),
    include_steps: bool = Query(False, description="是否包含检验步骤"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanListEnvelope:
    safe_order_by = None
    if order_by:
        field = order_by.lstrip("-")
        if field in INSPECTION_PLAN_SORTABLE_FIELDS:
            safe_order_by = order_by
    try:
        return await InspectionPlanService().list_inspection_plans(
            tenant_id=tenant_id,
            skip=skip,
            limit=limit,
            plan_type=plan_type,
            material_id=material_id,
            operation_id=operation_id,
            is_active=is_active,
            plan_code=plan_code,
            plan_name=plan_name,
            keyword=keyword,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            order_by=safe_order_by,
            include_steps=include_steps,
        )
    except Exception as e:
        logger.error(f"获取质检方案列表失败: {str(e)}")
        raise _http_exception_with_trace(500, f"获取列表失败: {str(e)}", "/inspection-plans", tenant_id)


@plans_router.get("/inspection-plans/{plan_id}", response_model=InspectionPlanResponse, summary="Get inspection plan")
async def get_inspection_plan(
    plan_id: int = Path(..., description="质检方案ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanResponse:
    try:
        return await InspectionPlanService().get_inspection_plan_by_id(
            tenant_id=tenant_id,
            plan_id=plan_id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans/{plan_id}", tenant_id)


@plans_router.put("/inspection-plans/{plan_id}", response_model=InspectionPlanResponse, summary="Update inspection plan")
async def update_inspection_plan(
    plan_id: int = Path(..., description="质检方案ID"),
    plan: InspectionPlanUpdate = Body(..., description="质检方案更新数据"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> InspectionPlanResponse:
    try:
        return await InspectionPlanService().update_inspection_plan(
            tenant_id=tenant_id,
            plan_id=plan_id,
            plan_data=plan,
            updated_by=current_user.id,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans/{plan_id}", tenant_id)
    except ValidationError as e:
        raise _http_exception_with_trace(400, str(e), "/inspection-plans/{plan_id}", tenant_id)


@plans_router.delete("/inspection-plans/{plan_id}", summary="Delete inspection plan")
async def delete_inspection_plan(
    plan_id: int = Path(..., description="质检方案ID"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> JSONResponse:
    try:
        await InspectionPlanService().delete_inspection_plan(
            tenant_id=tenant_id,
            plan_id=plan_id,
        )
        return JSONResponse(
            content={"message": "质检方案删除成功"},
            status_code=http_status.HTTP_200_OK,
        )
    except NotFoundError as e:
        raise _http_exception_with_trace(404, str(e), "/inspection-plans/{plan_id}", tenant_id)


@plans_router.get(
    "/inspection-plans/by-material/{material_id}",
    response_model=List[InspectionPlanListResponse],
    summary="List inspection plans by material",
)
async def get_inspection_plans_by_material(
    material_id: int = Path(..., description="物料ID"),
    plan_type: Optional[str] = Query(None, description="方案类型（incoming/process/finished）"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
) -> List[InspectionPlanListResponse]:
    try:
        return await InspectionPlanService().get_plans_by_material(
            tenant_id=tenant_id,
            material_id=material_id,
            plan_type=plan_type,
        )
    except Exception as e:
        logger.error(f"根据物料ID获取质检方案失败: {str(e)}")
        raise _http_exception_with_trace(
            500,
            f"获取方案失败: {str(e)}",
            "/inspection-plans/by-material/{material_id}",
            tenant_id,
        )


router.include_router(dashboard_router)
router.include_router(plans_router)
