import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Any, Dict
from apps.base_service import AppBaseService
from apps.kuaireport.models.report import Report
from apps.kuaireport.schemas.report import ReportCreate, ReportUpdate
from apps.kuaireport.constants import ReportCategory
from infra.exceptions.exceptions import NotFoundError, AuthorizationError


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
            category=ReportCategory.SYSTEM,
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
            category=ReportCategory.CUSTOM,
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
        if payload.get("category") == ReportCategory.CUSTOM:
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
            }
        except ImportError:
            return {"data": [], "total": 0, "success": True, "message": "数据集服务未配置"}
        except Exception as e:
            return {"data": [], "total": 0, "success": False, "message": str(e)}

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
            "share_expires_at": expires_at.isoformat() if expires_at else None,
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
