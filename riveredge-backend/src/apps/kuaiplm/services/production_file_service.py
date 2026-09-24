"""生产文件中心服务（R-06）。

复用 INF-05 版本可见性；PE 用 PRODUCTION 受众，研发工具保留历史给制定方/全局总查看。
不重建产品固件（R-15），不替代 R-16。
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Sequence

from tortoise.transactions import in_transaction

from apps.common.audit_actor import apply_create_audit, apply_update_audit
from apps.common.base_service import AppBaseService
from apps.kuaiplm.constants.production_file import (
    ACCESS_ACTIONS,
    CATALOG_KINDS,
    CATALOG_PE,
    CATALOG_RD,
    FILE_TYPES,
    PE_FILE_TYPES,
    RD_FILE_TYPES,
    VERSION_STATUSES,
)
from apps.kuaiplm.models.production_file import (
    ProductionFile,
    ProductionFileAccessLog,
    ProductionFileVersion,
)
from apps.kuaiplm.models.rd_project import RdProject
from apps.kuaiplm.schemas.production_file import (
    ProductionFileAccessLogListResponse,
    ProductionFileAccessLogResponse,
    ProductionFileAccessRequest,
    ProductionFileCreate,
    ProductionFileDownloadResponse,
    ProductionFileIssueRequest,
    ProductionFileListResponse,
    ProductionFileResponse,
    ProductionFileReviseRequest,
    ProductionFileUpdate,
    ProductionFileVersionListResponse,
    ProductionFileVersionResponse,
)
from apps.kuaiplm.utils.firmware_version import is_firmware_file_uuid
from core.services.approval.approval_instance_service import ApprovalInstanceService
from core.services.file.file_service import FileService
from core.services.approval.audit_binding_service import AuditBindingService
from core.services.file.document_version_policy import (
    DOCUMENT_GLOBAL_VIEW_PERMISSION,
    DocumentVersionAudience,
    can_view_historical_versions,
    filter_version_rows,
    resolve_audience,
)
from core.utils.timezone_utils import resolve_business_datetime
from infra.exceptions.exceptions import BusinessLogicError, NotFoundError, ValidationError
from infra.models.user import User

AUDIT_NODE = "production_file"
RESOURCE_PREFIX = "kuaiplm:production-file:"


def _bump_version(current: str) -> str:
    raw = (current or "A0").strip() or "A0"
    m = re.match(r"^([A-Za-z]+)(\d+)$", raw)
    if m:
        return f"{m.group(1)}{int(m.group(2)) + 1}"
    return f"{raw}.1"


def _version_policy_row(ver: Any) -> Dict[str, Any]:
    return {
        "id": getattr(ver, "id", None),
        "file_id": getattr(ver, "file_id", None),
        "file_code": getattr(ver, "file_code", None),
        "version": getattr(ver, "version", None),
        "status": getattr(ver, "status", None),
        "is_effective": bool(getattr(ver, "is_effective", False)),
        "is_latest_effective": bool(getattr(ver, "is_effective", False)),
        "is_production_effective": bool(getattr(ver, "is_production_effective", False)),
        "title": getattr(ver, "title", None),
        "file_uuid": getattr(ver, "file_uuid", None),
        "file_name": getattr(ver, "file_name", None),
        "change_summary": getattr(ver, "change_summary", None),
        "effective_at": getattr(ver, "effective_at", None),
        "obsolete_at": getattr(ver, "obsolete_at", None),
        "created_by": getattr(ver, "created_by", None),
        "created_by_name": getattr(ver, "created_by_name", None),
        "created_at": getattr(ver, "created_at", None),
        "updated_at": getattr(ver, "updated_at", None),
    }


def _can_manage(permission_codes: Optional[Sequence[str]]) -> bool:
    codes = {str(c or "").strip().lower() for c in (permission_codes or []) if str(c or "").strip()}
    return any(
        c.startswith(RESOURCE_PREFIX)
        and c.split(":")[-1] in {"update", "create", "approve", "publish", "execute", "obsolete"}
        for c in codes
    )


class ProductionFileService(AppBaseService[ProductionFile]):
    code_field = "file_code"
    rule_code = "KUAI_PLM_PRODUCTION_FILE_CODE"
    code_prefix = "SCWJ"

    def __init__(self) -> None:
        super().__init__(ProductionFile)
        self.model = ProductionFile

    async def _ensure_code(self, tenant_id: int, code: Optional[str]) -> str:
        raw = (code or "").strip()
        if raw:
            return raw
        return await self.generate_code(tenant_id, self.rule_code, prefix=self.code_prefix)

    async def _get_row(self, tenant_id: int, file_id: int) -> ProductionFile:
        row = await ProductionFile.filter(
            tenant_id=tenant_id, id=file_id, deleted_at__isnull=True
        ).first()
        if not row:
            raise NotFoundError("生产文件不存在")
        return row

    async def _require_project(self, tenant_id: int, project_id: int) -> RdProject:
        project = await RdProject.filter(
            tenant_id=tenant_id, id=project_id, deleted_at__isnull=True
        ).first()
        if not project:
            raise ValidationError("研发项目不存在")
        return project

    async def _resolve_project_snapshot(
        self,
        tenant_id: int,
        *,
        project_id: Optional[int],
        project_code: Optional[str],
        project_name: Optional[str],
    ) -> tuple[Optional[int], str, str]:
        if project_id is not None:
            project = await self._require_project(tenant_id, int(project_id))
            return project.id, project.project_code, project.project_name
        code = str(project_code or "").strip()
        name = str(project_name or "").strip() or code
        return None, code or None, name or None

    @staticmethod
    async def _ensure_attached_file(tenant_id: int, file_uuid: Optional[str]) -> None:
        uid = str(file_uuid or "").strip()
        if not uid:
            return
        try:
            await FileService.get_file_by_uuid(tenant_id, uid)
        except NotFoundError as exc:
            raise ValidationError("文件不存在，请重新上传") from exc

    def _validate_catalog_fields(
        self,
        *,
        catalog_kind: str,
        file_type: str,
        process_code: Optional[str],
        product_model: Optional[str],
    ) -> None:
        if catalog_kind not in CATALOG_KINDS:
            raise ValidationError("非法目录策略")
        if file_type not in FILE_TYPES:
            raise ValidationError("非法文件类型")
        if catalog_kind == CATALOG_PE:
            if file_type not in PE_FILE_TYPES:
                raise ValidationError("PE 生产软件类型不匹配")
            if not (process_code or "").strip():
                raise ValidationError("PE 生产软件须填写工序")
            if not (product_model or "").strip():
                raise ValidationError("PE 生产软件须填写产品型号")
        else:
            if file_type not in RD_FILE_TYPES:
                raise ValidationError("研发工具/产测类型不匹配")

    async def _current_version_row(
        self, tenant_id: int, file_id: int, version: str
    ) -> Optional[ProductionFileVersion]:
        return await ProductionFileVersion.filter(
            tenant_id=tenant_id,
            file_id=file_id,
            version=version,
            deleted_at__isnull=True,
        ).first()

    async def create(
        self, tenant_id: int, payload: ProductionFileCreate, user: User
    ) -> ProductionFileResponse:
        data = payload.model_dump(exclude_unset=False)
        catalog_kind = str(data["catalog_kind"]).strip()
        file_type = str(data["file_type"]).strip()
        self._validate_catalog_fields(
            catalog_kind=catalog_kind,
            file_type=file_type,
            process_code=data.get("process_code"),
            product_model=data.get("product_model"),
        )
        project_id: Optional[int] = None
        project_code: Optional[str] = None
        project_name: Optional[str] = None
        if catalog_kind == CATALOG_RD:
            project_id, project_code, project_name = await self._resolve_project_snapshot(
                tenant_id,
                project_id=data.get("project_id"),
                project_code=data.get("project_code"),
                project_name=data.get("project_name"),
            )

        file_code = await self._ensure_code(tenant_id, data.get("file_code"))
        exists = await ProductionFile.filter(
            tenant_id=tenant_id, file_code=file_code, deleted_at__isnull=True
        ).exists()
        if exists:
            raise BusinessLogicError("生产文件单号已存在")

        if catalog_kind == CATALOG_PE:
            clash = await ProductionFile.filter(
                tenant_id=tenant_id,
                catalog_kind=CATALOG_PE,
                process_code=(data.get("process_code") or "").strip(),
                product_model=(data.get("product_model") or "").strip(),
                file_type=file_type,
                deleted_at__isnull=True,
            ).exists()
            if clash:
                raise BusinessLogicError("同工序同型号同类型已有生产文件目录，请升版")

        version = (data.get("version") or "A0").strip() or "A0"
        await self._ensure_attached_file(tenant_id, data.get("file_uuid"))
        row = ProductionFile(
            tenant_id=tenant_id,
            file_code=file_code,
            catalog_kind=catalog_kind,
            file_type=file_type,
            title=data["title"],
            process_code=(data.get("process_code") or None),
            process_name=(data.get("process_name") or None),
            product_model=(data.get("product_model") or None),
            project_id=project_id,
            project_code=project_code,
            project_name=project_name,
            release_date=data.get("release_date"),
            version=version,
            status="draft",
            file_uuid=data.get("file_uuid"),
            file_name=data.get("file_name"),
            checksum=data.get("checksum"),
            change_summary=data.get("change_summary"),
            remarks=data.get("remarks"),
        )
        apply_create_audit(row, user)
        await row.save()
        await ProductionFileVersion.create(
            tenant_id=tenant_id,
            file_id=row.id,
            file_code=row.file_code,
            version=row.version,
            status="draft",
            is_effective=False,
            is_production_effective=False,
            title=row.title,
            file_type=row.file_type,
            release_date=row.release_date,
            file_uuid=row.file_uuid,
            file_name=row.file_name,
            checksum=row.checksum,
            change_summary=row.change_summary,
            created_by=row.created_by,
            created_by_name=row.created_by_name,
            updated_by=row.updated_by,
            updated_by_name=row.updated_by_name,
        )
        return ProductionFileResponse.model_validate(row)

    async def list(
        self,
        tenant_id: int,
        *,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
        catalog_kind: Optional[str] = None,
        file_type: Optional[str] = None,
        process_code: Optional[str] = None,
        product_model: Optional[str] = None,
        project_id: Optional[int] = None,
        production_view: bool = False,
        current_user_id: Optional[int] = None,
        permission_codes: Optional[List[str]] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> ProductionFileListResponse:
        if catalog_kind and catalog_kind not in CATALOG_KINDS:
            raise ValidationError("非法目录策略")
        if status and status not in VERSION_STATUSES:
            raise ValidationError(f"非法状态: {status}")
        if file_type and file_type not in FILE_TYPES:
            raise ValidationError("非法文件类型")

        codes = {
            str(c or "").strip().lower() for c in (permission_codes or []) if str(c or "").strip()
        }
        is_global = DOCUMENT_GLOBAL_VIEW_PERMISSION in codes
        manage = _can_manage(permission_codes)

        query = ProductionFile.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if catalog_kind:
            query = query.filter(catalog_kind=catalog_kind)
        if file_type:
            query = query.filter(file_type=file_type)
        if process_code:
            query = query.filter(process_code=process_code)
        if product_model:
            query = query.filter(product_model__icontains=product_model)
        if project_id:
            query = query.filter(project_id=project_id)

        if production_view:
            query = query.filter(status="effective")
        elif status:
            query = query.filter(status=status)
        elif not is_global and not manage:
            from tortoise.expressions import Q

            query = query.filter(
                Q(status="effective")
                | Q(
                    status__in=["draft", "pending", "rejected"],
                    created_by=current_user_id,
                )
            )

        if keyword:
            query = query.filter(title__icontains=keyword)

        total = await query.count()
        rows = await query.order_by("-updated_at", "-id").offset(skip).limit(limit)
        return ProductionFileListResponse(
            items=[ProductionFileResponse.model_validate(r) for r in rows],
            total=total,
        )

    async def get(self, tenant_id: int, file_id: int) -> ProductionFileResponse:
        row = await self._get_row(tenant_id, file_id)
        return ProductionFileResponse.model_validate(row)

    async def update(
        self, tenant_id: int, file_id: int, payload: ProductionFileUpdate, user: User
    ) -> ProductionFileResponse:
        row = await self._get_row(tenant_id, file_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或驳回记录可编辑")
        data = payload.model_dump(exclude_unset=True)
        if "file_type" in data and data["file_type"]:
            if row.catalog_kind == CATALOG_PE and data["file_type"] not in PE_FILE_TYPES:
                raise ValidationError("PE 生产软件类型不匹配")
            if row.catalog_kind == CATALOG_RD and data["file_type"] not in RD_FILE_TYPES:
                raise ValidationError("研发工具/产测类型不匹配")
        if "file_uuid" in data:
            await self._ensure_attached_file(tenant_id, data.get("file_uuid"))
        for key, value in data.items():
            setattr(row, key, value)
        apply_update_audit(row, user)
        await row.save()
        ver = await self._current_version_row(tenant_id, row.id, row.version)
        if ver and ver.status in {"draft", "rejected"}:
            for key in (
                "title",
                "file_type",
                "release_date",
                "file_uuid",
                "file_name",
                "checksum",
                "change_summary",
            ):
                if key in data:
                    setattr(ver, key, data[key])
            if "version" in data and data["version"] and data["version"] != ver.version:
                clash = await ProductionFileVersion.filter(
                    tenant_id=tenant_id,
                    file_id=row.id,
                    version=data["version"],
                    deleted_at__isnull=True,
                ).exclude(id=ver.id).exists()
                if clash:
                    raise BusinessLogicError("版本号已存在")
                ver.version = data["version"]
                row.version = data["version"]
                await row.save()
            apply_update_audit(ver, user)
            await ver.save()
        return ProductionFileResponse.model_validate(row)

    async def submit(
        self, tenant_id: int, file_id: int, user: User
    ) -> ProductionFileResponse:
        row = await self._get_row(tenant_id, file_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或驳回可提交")
        if not row.file_uuid:
            raise ValidationError("提交前须上传文件")
        await self._ensure_attached_file(tenant_id, row.file_uuid)
        now = resolve_business_datetime()
        row.status = "pending"
        row.submitted_at = now
        apply_update_audit(row, user)
        await row.save()
        ver = await self._current_version_row(tenant_id, row.id, row.version)
        if ver:
            ver.status = "pending"
            apply_update_audit(ver, user)
            await ver.save()

        approval_instance = None
        if await AuditBindingService.is_audit_enabled(tenant_id, AUDIT_NODE):
            approval_instance = await ApprovalInstanceService.start_approval_for_node(
                tenant_id=tenant_id,
                user_id=user.id,
                node_key=AUDIT_NODE,
                entity_type="production_file",
                entity_id=row.id,
                entity_uuid=str(row.uuid),
                title=f"生产文件审核 {row.file_code} {row.version}",
                content=row.title,
                business_type=row.catalog_kind,
                send_notification=True,
            )
            if approval_instance is None:
                raise ValidationError(
                    f"审核已开启但未找到可用审批流程，请检查 {AUDIT_NODE} 绑定"
                )
        from apps.kuaiplm.services.plm_audit_flow_sync import submit_instance_auto_passed
        from apps.kuaiplm.services.plm_pending_approval_reminder_service import (
            ENTITY_PRODUCTION_FILE,
            PlmPendingApprovalReminderService,
        )

        await PlmPendingApprovalReminderService.sync_after_submit(
            tenant_id,
            entity_type=ENTITY_PRODUCTION_FILE,
            entity_id=row.id,
            entity_uuid=str(row.uuid),
            submitted_at=row.submitted_at,
            doc_code=row.file_code,
            title=row.title or row.file_code,
            project_code=row.project_code,
            doc_label="生产文件 ",
        )

        if submit_instance_auto_passed(approval_instance):
            return await self.approve(tenant_id, file_id, user)
        return ProductionFileResponse.model_validate(row)

    async def approve(
        self, tenant_id: int, file_id: int, user: User
    ) -> ProductionFileResponse:
        """审核通过即生效；PE 切换生产下发版，旧生产版对生产方不可见。"""
        row = await self._get_row(tenant_id, file_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审记录可通过")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type="production_file",
            entity_id=file_id,
            doc_label="生产文件",
            verb="审核",
        )
        now = resolve_business_datetime()
        from tortoise.expressions import Q

        async with in_transaction():
            ver = await self._current_version_row(tenant_id, row.id, row.version)
            if not ver:
                raise BusinessLogicError("缺少当前版本链记录")
            if not ver.file_uuid:
                raise ValidationError("审核通过前须上传文件")
            await self._ensure_attached_file(tenant_id, ver.file_uuid)
            old_versions = (
                await ProductionFileVersion.filter(
                    tenant_id=tenant_id,
                    file_id=row.id,
                    deleted_at__isnull=True,
                )
                .exclude(id=ver.id)
                .filter(
                    Q(is_effective=True)
                    | Q(is_production_effective=True)
                    | Q(status="effective")
                )
            )
            for old in old_versions:
                old.is_effective = False
                old.is_production_effective = False
                if old.status == "effective":
                    old.status = "obsolete"
                    old.obsolete_at = now
                apply_update_audit(old, user)
                await old.save()

            ver.status = "effective"
            ver.is_effective = True
            # PE / 研发：当前生产下发均标生产生效；研发历史仍对制定方/全局可见
            ver.is_production_effective = True
            ver.effective_at = now
            apply_update_audit(ver, user)
            await ver.save()

            row.status = "effective"
            row.approved_at = now
            row.file_uuid = ver.file_uuid
            row.file_name = ver.file_name
            row.checksum = ver.checksum
            row.change_summary = ver.change_summary
            row.release_date = ver.release_date
            apply_update_audit(row, user)
            await row.save()
        from apps.kuaiplm.services.plm_pending_approval_reminder_service import (
            ENTITY_PRODUCTION_FILE,
            PlmPendingApprovalReminderService,
        )

        await PlmPendingApprovalReminderService.sync_after_terminal(
            tenant_id,
            entity_type=ENTITY_PRODUCTION_FILE,
            entity_id=file_id,
            reason="审核通过",
        )
        return ProductionFileResponse.model_validate(row)

    async def reject(
        self, tenant_id: int, file_id: int, user: User
    ) -> ProductionFileResponse:
        row = await self._get_row(tenant_id, file_id)
        if row.status != "pending":
            raise BusinessLogicError("仅待审记录可驳回")
        from apps.kuaiplm.services.plm_audit_flow_sync import assert_plm_manual_approval_action

        await assert_plm_manual_approval_action(
            tenant_id,
            audit_node=AUDIT_NODE,
            entity_type="production_file",
            entity_id=file_id,
            doc_label="生产文件",
            verb="驳回",
        )
        row.status = "rejected"
        apply_update_audit(row, user)
        await row.save()
        ver = await self._current_version_row(tenant_id, row.id, row.version)
        if ver:
            ver.status = "rejected"
            ver.is_effective = False
            ver.is_production_effective = False
            apply_update_audit(ver, user)
            await ver.save()
        from apps.kuaiplm.services.plm_pending_approval_reminder_service import (
            ENTITY_PRODUCTION_FILE,
            PlmPendingApprovalReminderService,
        )

        await PlmPendingApprovalReminderService.sync_after_terminal(
            tenant_id,
            entity_type=ENTITY_PRODUCTION_FILE,
            entity_id=file_id,
            reason="已驳回",
        )
        return ProductionFileResponse.model_validate(row)

    async def revise(
        self,
        tenant_id: int,
        file_id: int,
        payload: ProductionFileReviseRequest,
        user: User,
    ) -> ProductionFileResponse:
        row = await self._get_row(tenant_id, file_id)
        if row.status != "effective":
            raise BusinessLogicError("仅现行有效文件可升版")
        new_version = (payload.version or "").strip() or _bump_version(row.version)
        clash = await ProductionFileVersion.filter(
            tenant_id=tenant_id,
            file_id=row.id,
            version=new_version,
            deleted_at__isnull=True,
        ).exists()
        if clash:
            raise BusinessLogicError(f"版本号已存在: {new_version}")

        data = payload.model_dump(exclude_unset=True)
        if "file_uuid" in data:
            file_uuid = data.get("file_uuid")
            file_name = data.get("file_name")
        elif is_firmware_file_uuid(row.file_uuid):
            file_uuid = row.file_uuid
            file_name = row.file_name
        else:
            file_uuid = None
            file_name = None
        if file_uuid:
            await self._ensure_attached_file(tenant_id, file_uuid)
        async with in_transaction():
            await ProductionFileVersion.create(
                tenant_id=tenant_id,
                file_id=row.id,
                file_code=row.file_code,
                version=new_version,
                status="draft",
                is_effective=False,
                is_production_effective=False,
                title=data.get("title") or row.title,
                file_type=row.file_type,
                release_date=data.get("release_date") or row.release_date,
                file_uuid=file_uuid,
                file_name=file_name,
                checksum=data.get("checksum") if "checksum" in data else row.checksum,
                change_summary=data.get("change_summary"),
                created_by=user.id,
                created_by_name=getattr(user, "display_name", None)
                or getattr(user, "username", None),
                updated_by=user.id,
                updated_by_name=getattr(user, "display_name", None)
                or getattr(user, "username", None),
            )
            row.version = new_version
            row.status = "draft"
            if "title" in data and data["title"]:
                row.title = data["title"]
            if "release_date" in data:
                row.release_date = data["release_date"]
            row.file_uuid = file_uuid
            row.file_name = file_name
            if "checksum" in data:
                row.checksum = data["checksum"]
            if "change_summary" in data:
                row.change_summary = data["change_summary"]
            apply_update_audit(row, user)
            await row.save()
        return ProductionFileResponse.model_validate(row)

    async def obsolete(
        self, tenant_id: int, file_id: int, user: User
    ) -> ProductionFileResponse:
        row = await self._get_row(tenant_id, file_id)
        if row.status != "effective":
            raise BusinessLogicError("仅现行有效文件可作废")
        now = resolve_business_datetime()
        row.status = "obsolete"
        row.obsolete_at = now
        apply_update_audit(row, user)
        await row.save()
        versions = await ProductionFileVersion.filter(
            tenant_id=tenant_id,
            file_id=row.id,
            deleted_at__isnull=True,
            status="effective",
        )
        for ver in versions:
            ver.status = "obsolete"
            ver.is_effective = False
            ver.is_production_effective = False
            ver.obsolete_at = now
            apply_update_audit(ver, user)
            await ver.save()
        return ProductionFileResponse.model_validate(row)

    async def delete(self, tenant_id: int, file_id: int, user: User) -> None:
        row = await self._get_row(tenant_id, file_id)
        if row.status not in {"draft", "rejected"}:
            raise BusinessLogicError("仅草稿或驳回可删除")
        now = resolve_business_datetime()
        row.deleted_at = now
        apply_update_audit(row, user)
        await row.save()

    def _resolve_list_audience(
        self,
        row: ProductionFile,
        *,
        current_user_id: Optional[int],
        permission_codes: Optional[List[str]],
        production_view: bool,
    ) -> DocumentVersionAudience:
        is_author = bool(
            current_user_id is not None
            and getattr(row, "created_by", None) is not None
            and int(row.created_by) == int(current_user_id)
        )
        # PE 生产视图强制 PRODUCTION；研发工具生产下载也走 PRODUCTION（仅最新）
        return resolve_audience(
            permission_codes=permission_codes,
            is_author=is_author,
            production_context=production_view,
        )

    async def list_versions(
        self,
        tenant_id: int,
        file_id: int,
        *,
        current_user_id: Optional[int] = None,
        permission_codes: Optional[List[str]] = None,
        production_view: bool = False,
    ) -> ProductionFileVersionListResponse:
        row = await self._get_row(tenant_id, file_id)
        versions = await ProductionFileVersion.filter(
            tenant_id=tenant_id,
            file_id=file_id,
            deleted_at__isnull=True,
        ).order_by("-id")
        policy_rows = [_version_policy_row(v) for v in versions]
        audience = self._resolve_list_audience(
            row,
            current_user_id=current_user_id,
            permission_codes=permission_codes,
            production_view=production_view
            or (row.catalog_kind == CATALOG_PE and not _can_manage(permission_codes)),
        )
        # PE 无维护权默认按生产受众；全局总查看仍走 resolve
        codes = {
            str(c or "").strip().lower() for c in (permission_codes or []) if str(c or "").strip()
        }
        if (
            row.catalog_kind == CATALOG_PE
            and DOCUMENT_GLOBAL_VIEW_PERMISSION not in codes
            and not _can_manage(permission_codes)
            and not (
                current_user_id is not None
                and row.created_by is not None
                and int(row.created_by) == int(current_user_id)
            )
        ):
            audience = DocumentVersionAudience.PRODUCTION

        visible = filter_version_rows(
            policy_rows,
            audience=audience,
            current_user_id=current_user_id,
        )
        id_set = {v.get("id") for v in visible}
        items = [
            ProductionFileVersionResponse.model_validate(v)
            for v in versions
            if v.id in id_set
        ]
        return ProductionFileVersionListResponse(
            items=items,
            total=len(items),
            audience=audience.value,
            can_view_history=can_view_historical_versions(audience),
        )

    async def _assert_version_visible(
        self,
        tenant_id: int,
        file_id: int,
        version_id: int,
        *,
        user: User,
        permission_codes: Optional[List[str]],
        production_view: bool = False,
    ) -> ProductionFileVersion:
        listed = await self.list_versions(
            tenant_id,
            file_id,
            current_user_id=user.id,
            permission_codes=permission_codes,
            production_view=production_view,
        )
        for item in listed.items:
            if item.id == version_id:
                ver = await ProductionFileVersion.filter(
                    tenant_id=tenant_id, id=version_id, deleted_at__isnull=True
                ).first()
                if not ver:
                    raise NotFoundError("版本不存在")
                return ver
        raise BusinessLogicError("无权访问该历史版本")

    async def resolve_download(
        self,
        tenant_id: int,
        file_id: int,
        user: User,
        *,
        version_id: Optional[int] = None,
        permission_codes: Optional[List[str]] = None,
        production_view: bool = False,
    ) -> ProductionFileDownloadResponse:
        row = await self._get_row(tenant_id, file_id)
        if version_id is not None:
            ver = await self._assert_version_visible(
                tenant_id,
                file_id,
                version_id,
                user=user,
                permission_codes=permission_codes,
                production_view=production_view,
            )
        else:
            ver = await self._current_version_row(tenant_id, row.id, row.version)
            if not ver:
                raise NotFoundError("版本不存在")
            visible = await self.list_versions(
                tenant_id,
                file_id,
                current_user_id=user.id,
                permission_codes=permission_codes,
                production_view=production_view,
            )
            if ver.id not in {item.id for item in visible.items}:
                raise BusinessLogicError("无权下载该文件")
        if not ver.file_uuid:
            raise ValidationError("该版本尚未上传文件")
        await self._ensure_attached_file(tenant_id, ver.file_uuid)

        from core.services.file.file_preview_service import FilePreviewService

        preview_url = await FilePreviewService.generate_simple_preview_url(
            file_uuid=str(ver.file_uuid).strip(),
            tenant_id=tenant_id,
        )
        log = ProductionFileAccessLog(
            tenant_id=tenant_id,
            file_id=row.id,
            file_code=row.file_code,
            version_id=ver.id,
            version=ver.version,
            action="download",
            actor_user_id=user.id,
            actor_name=getattr(user, "display_name", None) or getattr(user, "username", None),
        )
        apply_create_audit(log, user)
        await log.save()
        return ProductionFileDownloadResponse(
            preview_url=preview_url,
            file_name=ver.file_name,
            version_id=ver.id,
        )

    async def record_access(
        self,
        tenant_id: int,
        file_id: int,
        payload: ProductionFileAccessRequest,
        user: User,
        *,
        permission_codes: Optional[List[str]] = None,
        production_view: bool = False,
    ) -> ProductionFileAccessLogResponse:
        row = await self._get_row(tenant_id, file_id)
        action = (payload.action or "").strip().lower()
        if action not in {"view", "download"}:
            raise ValidationError("非法访问动作")
        version_id = payload.version_id
        if version_id is None:
            ver = await self._current_version_row(tenant_id, row.id, row.version)
            if not ver:
                raise NotFoundError("版本不存在")
            version_id = ver.id
        ver = await self._assert_version_visible(
            tenant_id,
            file_id,
            version_id,
            user=user,
            permission_codes=permission_codes,
            production_view=production_view,
        )
        if action == "download" and not ver.file_uuid:
            raise ValidationError("该版本无附件可下载")
        if action == "download":
            await self._ensure_attached_file(tenant_id, ver.file_uuid)
        log = ProductionFileAccessLog(
            tenant_id=tenant_id,
            file_id=row.id,
            file_code=row.file_code,
            version_id=ver.id,
            version=ver.version,
            action=action,
            actor_user_id=user.id,
            actor_name=getattr(user, "display_name", None) or getattr(user, "username", None),
            remark=payload.remark,
        )
        apply_create_audit(log, user)
        await log.save()
        return ProductionFileAccessLogResponse.model_validate(log)

    async def issue(
        self,
        tenant_id: int,
        file_id: int,
        payload: ProductionFileIssueRequest,
        user: User,
        *,
        permission_codes: Optional[List[str]] = None,
    ) -> ProductionFileResponse:
        row = await self._get_row(tenant_id, file_id)
        if row.status != "effective":
            raise BusinessLogicError("仅现行有效文件可发放")
        version_id = payload.version_id
        if version_id is None:
            ver = await self._current_version_row(tenant_id, row.id, row.version)
            if not ver:
                raise NotFoundError("版本不存在")
            version_id = ver.id
        ver = await self._assert_version_visible(
            tenant_id,
            file_id,
            version_id,
            user=user,
            permission_codes=permission_codes,
            production_view=False,
        )
        # PE：禁止向生产发放非生产生效版
        if row.catalog_kind == CATALOG_PE and not ver.is_production_effective:
            raise BusinessLogicError("PE 生产软件仅可发放当前生产版本")
        now = resolve_business_datetime()
        names = payload.receiver_names.strip()
        row.issued_by = user.id
        row.issued_by_name = getattr(user, "display_name", None) or getattr(user, "username", None)
        row.issued_at = now
        row.receiver_names = names
        apply_update_audit(row, user)
        await row.save()
        log = ProductionFileAccessLog(
            tenant_id=tenant_id,
            file_id=row.id,
            file_code=row.file_code,
            version_id=ver.id,
            version=ver.version,
            action="issue",
            actor_user_id=user.id,
            actor_name=row.issued_by_name,
            receiver_names=names,
            remark=payload.remark,
        )
        apply_create_audit(log, user)
        await log.save()
        return ProductionFileResponse.model_validate(row)

    async def list_access_logs(
        self,
        tenant_id: int,
        file_id: int,
        *,
        action: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> ProductionFileAccessLogListResponse:
        await self._get_row(tenant_id, file_id)
        if action and action not in ACCESS_ACTIONS:
            raise ValidationError("非法访问动作")
        query = ProductionFileAccessLog.filter(
            tenant_id=tenant_id, file_id=file_id, deleted_at__isnull=True
        )
        if action:
            query = query.filter(action=action)
        total = await query.count()
        rows = await query.order_by("-created_at", "-id").offset(skip).limit(limit)
        return ProductionFileAccessLogListResponse(
            items=[ProductionFileAccessLogResponse.model_validate(r) for r in rows],
            total=total,
        )
