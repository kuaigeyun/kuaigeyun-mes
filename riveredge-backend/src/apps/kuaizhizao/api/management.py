from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from pydantic import BaseModel, Field

from core.api.deps.access import AuthContext, get_auth_context, require_permission_codes
from core.api.deps.deps import get_current_tenant
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from core.services.logging.operation_log_service import OperationLogService
from infra.models.user import User
from infra.api.deps.deps import get_current_user
from apps.kuaizhizao.services.reset_data_service import ResetDataService
from apps.kuaizhizao.services.flow_data_generate_service import (
    DEFAULT_INTERVAL_MAX,
    DEFAULT_INTERVAL_MIN,
    DEFAULT_REPORTING_BATCHES_MAX,
    DEFAULT_REPORTING_BATCHES_MIN,
    STEP_DEFAULT_ROLE_CODES,
    STEP_KEYS,
    FlowDataGenerateService,
    FlowGenerateRequest,
    IntervalConfig,
    parse_intervals,
    parse_reporting_batches,
    parse_step_operators,
    parse_work_schedule,
)
from apps.kuaizhizao.services.equipment_ops_data_generate_service import (
    EquipmentOpsDataGenerateService,
    parse_equipment_ops_generate_request,
)
from apps.common.audit_actor import operator_name_from_user

router = APIRouter(prefix="/management", tags=["App - Kuaige Zhizao - App Management"])

RESET_PERMISSION = "kuaizhizao:app-management:reset-data"
FLOW_GENERATE_PERMISSION = "kuaizhizao:app-management:flow-generate"
_TOKEN_TTL_SECONDS = 300


class ResetDataRequest(BaseModel):
    confirmation_token: str = Field(..., min_length=16, description="二次确认 token（先调用 prepare）")


class ResetDataPrepareResponse(BaseModel):
    confirmation_token: str
    expires_in: int = _TOKEN_TTL_SECONDS
    message: str = "请在有效期内携带 confirmation_token 再次确认重置"


class IntervalBody(BaseModel):
    min_seconds: int = Field(DEFAULT_INTERVAL_MIN, ge=1, le=86400 * 30)
    max_seconds: int = Field(DEFAULT_INTERVAL_MAX, ge=1, le=86400 * 30)


class WorkScheduleBody(BaseModel):
    weekdays: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4])
    start_time: str = "09:00"
    end_time: str = "18:00"
    lookback_days: int = 14


class StepOperatorBody(BaseModel):
    mode: str = Field(
        "random_role",
        description=(
            "fixed | random_role | random_department | random_team | "
            "operation_assigned | equipment_assigned | scheme_assigned | current"
        ),
    )
    user_id: Optional[int] = Field(None, gt=0)
    role_code: Optional[str] = Field(None, description="角色编码，空则用步骤默认角色")
    department_id: Optional[int] = Field(None, gt=0, description="部门 ID（按部门随机）")
    work_group_id: Optional[int] = Field(None, gt=0, description="工作小组 ID（小组随机）")


class ReportingBatchBody(BaseModel):
    min_batches: int = Field(DEFAULT_REPORTING_BATCHES_MIN, ge=1, le=20)
    max_batches: int = Field(DEFAULT_REPORTING_BATCHES_MAX, ge=1, le=20)


class FlowGenerateBody(BaseModel):
    source_type: str = Field("sales_order", description="来源：sales_order | sales_forecast")
    sales_order_id: Optional[int] = Field(None, gt=0)
    sales_forecast_id: Optional[int] = Field(None, gt=0)
    warehouse_id: Optional[int] = Field(None, gt=0)
    anchor_at: Optional[datetime] = None
    default_interval: IntervalBody = Field(default_factory=IntervalBody)
    intervals: dict[str, IntervalBody] = Field(default_factory=dict)
    steps: dict[str, bool] = Field(default_factory=dict)
    step_operators: dict[str, StepOperatorBody] = Field(default_factory=dict)
    reporting_batches: ReportingBatchBody = Field(default_factory=ReportingBatchBody)
    work_schedule: Optional[WorkScheduleBody] = None
    use_work_schedule: bool = False


def _assert_admin_gate(auth: AuthContext, *, action: str) -> None:
    """租户管理员或平台管理员方可执行（与权限码叠加）。"""
    if auth.is_tenant_admin or auth.is_infra_admin:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "FORBIDDEN",
            "message": f"仅组织管理员或平台管理员可{action}",
            "details": {"reason": "require_tenant_admin"},
        },
    )


def _assert_reset_gate(auth: AuthContext) -> None:
    _assert_admin_gate(auth, action="重置快制造业务数据")


def _to_flow_request(body: FlowGenerateBody) -> FlowGenerateRequest:
    source = (body.source_type or "sales_order").strip().lower()
    if source in ("sales_forecast", "forecast"):
        source = "sales_forecast"
    else:
        source = "sales_order"
    if source == "sales_forecast" and not body.sales_forecast_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择销售预测",
        )
    if source == "sales_order" and not body.sales_order_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择销售订单",
        )
    intervals_raw = {
        k: {"min_seconds": v.min_seconds, "max_seconds": v.max_seconds}
        for k, v in (body.intervals or {}).items()
    }
    schedule_raw = body.work_schedule.model_dump() if body.work_schedule else None
    return FlowGenerateRequest(
        source_type=source,
        sales_order_id=body.sales_order_id,
        sales_forecast_id=body.sales_forecast_id,
        warehouse_id=body.warehouse_id,
        anchor_at=body.anchor_at,
        intervals=parse_intervals(intervals_raw),
        default_interval=IntervalConfig(
            min_seconds=body.default_interval.min_seconds,
            max_seconds=body.default_interval.max_seconds,
        ).clamp(),
        steps=dict(body.steps or {}),
        step_operators=parse_step_operators(
            {
                k: v.model_dump()
                for k, v in (body.step_operators or {}).items()
            }
        ),
        reporting_batches=parse_reporting_batches(body.reporting_batches.model_dump()),
        work_schedule=parse_work_schedule(schedule_raw),
        use_work_schedule=bool(body.use_work_schedule),
    )


@router.post(
    "/reset-data/prepare",
    response_model=ResetDataPrepareResponse,
    summary="Prepare reset-data confirmation token",
    dependencies=[Depends(require_permission_codes(RESET_PERMISSION))],
)
async def prepare_reset_app_data(
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """签发短时二次确认 token；真正删除须再调 /reset-data。"""
    _assert_reset_gate(auth)
    token = ResetDataService.issue_confirmation_token(
        tenant_id=tenant_id,
        operator_id=current_user.id,
        ttl_seconds=_TOKEN_TTL_SECONDS,
    )
    return ResetDataPrepareResponse(confirmation_token=token, expires_in=_TOKEN_TTL_SECONDS)


@router.post(
    "/reset-data",
    summary="Reset app data (Kuaige Zhizao)",
    dependencies=[Depends(require_permission_codes(RESET_PERMISSION))],
)
async def reset_app_data(
    body: ResetDataRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
):
    """
    重置快制造模块的所有业务数据。

    安全机制：
    1. 必须登录且属于对应租户。
    2. 权限码 kuaizhizao:app-management:reset-data + 组织/平台管理员门禁。
    3. 二次确认 token（先调 /reset-data/prepare）。
    4. 自动触发一重全量备份。
    5. 物理删除所有业务表，并写入操作日志。
    """
    _assert_reset_gate(auth)
    try:
        ResetDataService.verify_confirmation_token(
            tenant_id=tenant_id,
            operator_id=current_user.id,
            token=body.confirmation_token,
            ttl_seconds=_TOKEN_TTL_SECONDS,
        )
        result = await ResetDataService.reset_kuaizhizao_data(tenant_id, current_user.id)
        try:
            await OperationLogService.create_operation_log(
                tenant_id=tenant_id,
                user_id=current_user.id,
                operation_type="reset_data",
                operation_module="kuaizhizao.app-management",
                operation_object_type="tenant_business_data",
                operation_object_id=tenant_id,
                operation_content=(
                    f"物理删除快制造业务数据: success={result.get('success')} "
                    f"message={result.get('message')}"
                ),
                request_method="POST",
                request_path="/management/reset-data",
            )
        except Exception as log_exc:
            logger.error(f"重置数据操作日志写入失败（删除已执行）: {log_exc}")
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"重置快制造数据失败: {e}")
        return {"success": False, "message": str(e)}


@router.get(
    "/flow-generate/eligible-orders",
    summary="List eligible sales orders for flow generate",
    dependencies=[Depends(require_permission_codes(FLOW_GENERATE_PERMISSION))],
)
async def list_flow_generate_eligible_orders(
    keyword: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _assert_admin_gate(auth, action="使用流程造数")
    return await FlowDataGenerateService().list_eligible_orders(
        tenant_id, keyword=keyword, limit=limit
    )


@router.get(
    "/flow-generate/eligible-forecasts",
    summary="List eligible sales forecasts for flow generate",
    dependencies=[Depends(require_permission_codes(FLOW_GENERATE_PERMISSION))],
)
async def list_flow_generate_eligible_forecasts(
    keyword: str = Query(""),
    limit: int = Query(50, ge=1, le=200),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _assert_admin_gate(auth, action="使用流程造数")
    return await FlowDataGenerateService().list_eligible_forecasts(
        tenant_id, keyword=keyword, limit=limit
    )


@router.get(
    "/flow-generate/operator-defaults",
    summary="Default role codes for each flow-generate step",
    dependencies=[Depends(require_permission_codes(FLOW_GENERATE_PERMISSION))],
)
async def list_flow_generate_operator_defaults(
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _assert_admin_gate(auth, action="使用流程造数")
    return {
        "steps": [
            {
                "step_key": key,
                "default_role_codes": list(STEP_DEFAULT_ROLE_CODES.get(key, ())),
            }
            for key in STEP_KEYS
        ]
    }


@router.post(
    "/flow-generate/preview",
    summary="Preview flow generate timeline",
    dependencies=[Depends(require_permission_codes(FLOW_GENERATE_PERMISSION))],
)
async def preview_flow_generate(
    body: FlowGenerateBody,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _assert_admin_gate(auth, action="使用流程造数")
    try:
        return await FlowDataGenerateService().preview(tenant_id, _to_flow_request(body))
    except (NotFoundError, BusinessLogicError, ValidationError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/flow-generate",
    summary="Execute manufacturing flow data generate from sales order",
    dependencies=[Depends(require_permission_codes(FLOW_GENERATE_PERMISSION))],
)
async def execute_flow_generate(
    body: FlowGenerateBody,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _assert_admin_gate(auth, action="使用流程造数")
    try:
        result = await FlowDataGenerateService().execute(
            tenant_id=tenant_id,
            operator_id=int(current_user.id),
            req=_to_flow_request(body),
        )
        return result
    except (NotFoundError, BusinessLogicError, ValidationError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.exception("flow-generate execute failed: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"流程造数失败: {e}",
        ) from e


class EquipmentOpsGenerateBody(BaseModel):
    spot_check_plan_ids: list[int] = Field(
        default_factory=list, description="点检计划 ID 列表"
    )
    maintenance_plan_ids: list[int] = Field(
        default_factory=list, description="保养计划 ID 列表"
    )
    equipment_ids: list[int] = Field(
        default_factory=list, description="计划内设备 ID（全选或多选）"
    )
    anchor_start: Optional[datetime] = None
    anchor_end: Optional[datetime] = None
    work_schedule: Optional[WorkScheduleBody] = None
    use_work_schedule: bool = False
    auto_approve_spot_check: bool = False
    inspector_operator: StepOperatorBody = Field(
        default_factory=lambda: StepOperatorBody(mode="equipment_assigned"),
        description="点检执行人：默认计划负责人/设备点检人",
    )
    approver_operator: StepOperatorBody = Field(
        default_factory=lambda: StepOperatorBody(mode="scheme_assigned"),
        description="点检审批人：默认方案指定审核人员",
    )


def _to_equipment_ops_request(body: EquipmentOpsGenerateBody):
    return parse_equipment_ops_generate_request(body.model_dump())


@router.post(
    "/equipment-ops-generate/preview",
    summary="Preview equipment spot-check / maintenance generate",
    dependencies=[Depends(require_permission_codes(FLOW_GENERATE_PERMISSION))],
)
async def preview_equipment_ops_generate(
    body: EquipmentOpsGenerateBody,
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _assert_admin_gate(auth, action="使用设备点检保养造数")
    try:
        return await EquipmentOpsDataGenerateService().preview(
            tenant_id, _to_equipment_ops_request(body)
        )
    except (NotFoundError, BusinessLogicError, ValidationError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post(
    "/equipment-ops-generate",
    summary="Execute equipment spot-check / maintenance generate",
    dependencies=[Depends(require_permission_codes(FLOW_GENERATE_PERMISSION))],
)
async def execute_equipment_ops_generate(
    body: EquipmentOpsGenerateBody,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    auth: AuthContext = Depends(get_auth_context),
) -> dict[str, Any]:
    _assert_admin_gate(auth, action="使用设备点检保养造数")
    try:
        return await EquipmentOpsDataGenerateService().execute(
            tenant_id=tenant_id,
            operator_id=int(current_user.id),
            operator_name=operator_name_from_user(current_user),
            current_user=current_user,
            req=_to_equipment_ops_request(body),
        )
    except (NotFoundError, BusinessLogicError, ValidationError, ValueError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except Exception as e:
        logger.exception("equipment-ops-generate execute failed: {}", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"设备点检保养造数失败: {e}",
        ) from e
