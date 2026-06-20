import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Any, Dict
from apps.common.base_service import AppBaseService
from apps.kuaireport.models.report import Report
from apps.kuaireport.schemas.report import ReportCreate, ReportUpdate
from apps.kuaireport.constants import ReportCategory
from core.utils.timezone_utils import to_api_isoformat
from infra.exceptions.exceptions import NotFoundError, AuthorizationError


def _coerce_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return 0.0


def _compute_uni_report_summary(config: Dict[str, Any], rows: List[Any]) -> Dict[str, float]:
    """根据 report_config.extra.uni_report 与 fields 聚合 summary"""
    if not rows:
        return {}
    extra = config.get("extra") or {}
    uni = extra.get("uni_report") or {}
    summary_fields: List[str] = list(uni.get("summaryFields") or [])
    if not summary_fields:
        for f in config.get("fields") or []:
            if isinstance(f, dict) and f.get("aggregate") == "sum":
                summary_fields.append(str(f.get("field")))
    if not summary_fields:
        return {}
    summary: Dict[str, float] = {}
    for field in summary_fields:
        summary[field] = sum(
            _coerce_float(row.get(field) if isinstance(row, dict) else getattr(row, field, None))
            for row in rows
        )
    return summary


class ReportService(AppBaseService[Report]):
    def __init__(self):
        super().__init__(Report)

    # ── 查询 ────────────────────────────────────────────────────

    async def list_system_reports(
        self, tenant_id: int, skip: int = 0, limit: int = 100
    ) -> Dict[str, Any]:
        """获取系统预置报表列表"""
        qs = self.model.filter(
            tenant_id=tenant_id,
            category=ReportCategory.SYSTEM.value,
            is_system=True,
        )
        total = await qs.count()
        data = await qs.offset(skip).limit(limit).order_by("name")
        return {"data": data, "total": total, "success": True}

    async def list_user_reports(
        self, tenant_id: int, user_id: int, skip: int = 0, limit: int = 100
    ) -> Dict[str, Any]:
        """获取当前用户的自制报表列表"""
        qs = self.model.filter(
            tenant_id=tenant_id,
            category=ReportCategory.CUSTOM.value,
            owner_id=user_id,
        )
        total = await qs.count()
        data = await qs.offset(skip).limit(limit).order_by("-updated_at")
        return {"data": data, "total": total, "success": True}

    async def list(
        self, tenant_id: int, skip: int = 0, limit: int = 100
    ) -> Dict[str, Any]:
        """获取全部报表（管理员用）"""
        total = await self.model.filter(tenant_id=tenant_id).count()
        data = await self.list_all(tenant_id, skip, limit)
        return {"data": data, "total": total, "success": True}

    # ── 创建 / 更新 / 删除 ──────────────────────────────────────

    async def create(
        self, tenant_id: int, data: ReportCreate, created_by: int
    ) -> Report:
        """创建报表"""
        payload = data.model_dump()
        # report_config 是嵌套 Pydantic 对象，需转为 dict
        if payload.get("report_config"):
            payload["report_config"] = payload["report_config"]
        # 自制报表自动设置 owner
        if payload.get("category") == ReportCategory.CUSTOM.value:
            payload["owner_id"] = created_by
        return await self.create_with_user(tenant_id, created_by, **payload)

    async def update(
        self, tenant_id: int, id: int, data: ReportUpdate, updated_by: int,
        user_id: Optional[int] = None
    ) -> Report:
        """更新报表（系统报表不允许普通用户修改）"""
        report = await self.model.get_or_none(tenant_id=tenant_id, id=id)
        if not report:
            raise NotFoundError("报表未找到")
        if report.is_system and user_id is not None:
            raise AuthorizationError("系统报表不允许修改")
        payload = data.model_dump(exclude_unset=True)
        return await self.update_with_user(tenant_id, id, updated_by, **payload)

    async def delete(
        self, tenant_id: int, id: int, user_id: Optional[int] = None
    ) -> bool:
        """删除报表（系统报表不允许普通用户删除）"""
        report = await self.model.get_or_none(tenant_id=tenant_id, id=id)
        if not report:
            raise NotFoundError("报表", str(id))
        if report.is_system and user_id is not None:
            raise AuthorizationError("系统报表不允许删除")
        return await self.delete_with_validation(tenant_id, id, soft_delete=False)

    # ── 数据执行 ─────────────────────────────────────────────────

    async def execute_report(
        self, tenant_id: int, report_id: int, filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        根据报表配置执行动态查询（对接系统级数据集）
        """
        report = await self.model.get_or_none(tenant_id=tenant_id, id=report_id)
        if not report:
            raise NotFoundError("报表", str(report_id))

        config = report.report_config
        if not config:
            return {"data": [], "total": 0, "success": True}

        dataset_uuid = config.get("dataset_uuid")
        dataset_code = config.get("dataset_code")

        if not dataset_uuid and not dataset_code:
            return {"data": [], "total": 0, "success": True}

        try:
            from uuid import UUID
            from core.services.data.dataset_service import DatasetService
            from core.schemas.dataset import ExecuteQueryRequest

            dataset_service = DatasetService()
            execute_request = ExecuteQueryRequest(
                parameters=filters,
                limit=config.get("page_size", 100),
                offset=0,
            )

            if dataset_uuid:
                result = await dataset_service.execute_query(
                    tenant_id=tenant_id,
                    dataset_uuid=UUID(str(dataset_uuid)),
                    execute_request=execute_request,
                )
            elif dataset_code:
                result = await dataset_service.query_dataset_by_code(
                    tenant_id=tenant_id,
                    dataset_code=dataset_code,
                    parameters=filters,
                    limit=execute_request.limit,
                    offset=execute_request.offset,
                )
            else:
                return {"data": [], "total": 0, "success": True}

            return {
                "data": result.data,
                "total": result.total or len(result.data),
                "success": result.success,
                "columns": result.columns,
                "error": result.error,
                "summary": _compute_uni_report_summary(config, result.data or []),
            }
        except ImportError:
            return {"data": [], "total": 0, "success": True, "message": "数据集服务未配置"}
        except Exception as e:
            return {"data": [], "total": 0, "success": False, "message": str(e)}

    async def get_dataset_fields(
        self,
        tenant_id: int,
        *,
        dataset_uuid: Optional[str] = None,
        dataset_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """获取数据集字段元数据（供 ReportDesigner 配置字段映射）"""
        from uuid import UUID
        from core.services.data.dataset_service import DatasetService
        from core.schemas.dataset import ExecuteQueryRequest

        if not dataset_uuid and not dataset_code:
            return {"fields": [], "success": True}

        dataset_service = DatasetService()
        display_columns: List[Dict[str, Any]] = []

        try:
            if dataset_uuid:
                dataset = await dataset_service.get_dataset_by_uuid(
                    tenant_id=tenant_id, dataset_uuid=UUID(str(dataset_uuid))
                )
                display = getattr(dataset, "display_config", None) or {}
                raw_cols = display.get("columns") if isinstance(display, dict) else None
                if isinstance(raw_cols, list) and raw_cols:
                    for col in raw_cols:
                        if isinstance(col, dict) and col.get("field"):
                            display_columns.append({
                                "field": col["field"],
                                "label": col.get("label") or col["field"],
                                "visible": col.get("visible", True),
                                "format": col.get("format"),
                            })
                        elif isinstance(col, str):
                            display_columns.append({"field": col, "label": col, "visible": True})
                    return {"fields": display_columns, "success": True}
        except Exception:
            pass

        execute_request = ExecuteQueryRequest(parameters={}, limit=1, offset=0)
        try:
            if dataset_uuid:
                result = await dataset_service.execute_query(
                    tenant_id=tenant_id,
                    dataset_uuid=UUID(str(dataset_uuid)),
                    execute_request=execute_request,
                )
            elif dataset_code:
                result = await dataset_service.query_dataset_by_code(
                    tenant_id=tenant_id,
                    dataset_code=str(dataset_code),
                    parameters={},
                    limit=1,
                    offset=0,
                )
            else:
                return {"fields": [], "success": True}

            columns = result.columns or []
            if not columns and result.data and isinstance(result.data[0], dict):
                columns = list(result.data[0].keys())
            fields = [{"field": c, "label": c, "visible": True} for c in columns]
            return {"fields": fields, "success": True}
        except Exception as e:
            return {"fields": [], "success": False, "message": str(e)}

    # ── 分享 ─────────────────────────────────────────────────────

    async def share(
        self, tenant_id: int, report_id: int, expires_days: Optional[int] = 30
    ) -> Dict[str, Any]:
        """生成分享链接"""
        report = await self.model.get_or_none(tenant_id=tenant_id, id=report_id)
        if not report:
            raise NotFoundError("报表", str(report_id))
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(days=expires_days) if expires_days else None
        report.is_shared = True
        report.share_token = token
        report.share_expires_at = expires_at
        await report.save()
        return {
            "share_token": token,
            "share_expires_at": to_api_isoformat(expires_at) if expires_at else None,
            "is_shared": True,
        }

    async def unshare(self, tenant_id: int, report_id: int) -> None:
        """取消分享"""
        report = await self.model.get_or_none(tenant_id=tenant_id, id=report_id)
        if not report:
            raise NotFoundError("报表", str(report_id))
        report.is_shared = False
        report.share_token = None
        report.share_expires_at = None
        await report.save()

    async def get_by_share_token(self, token: str) -> Optional[Report]:
        """通过分享令牌获取报表（公开，无需登录）"""
        report = await self.model.get_or_none(share_token=token)
        if not report:
            return None
        if report.share_expires_at and report.share_expires_at < datetime.utcnow():
            return None
        return report

    async def execute_report_by_share_token(
        self, token: str, filters: Dict[str, Any]
    ) -> Dict[str, Any]:
        """通过分享令牌执行报表查询（公开）"""
        report = await self.get_by_share_token(token)
        if not report:
            return {"data": [], "total": 0, "success": False, "message": "分享链接无效或已过期"}
        return await self.execute_report(report.tenant_id, report.id, filters)
