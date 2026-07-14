"""
工作小组服务模块

提供工作小组的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional, Dict
from tortoise.exceptions import IntegrityError
from tortoise.models import Q

from apps.master_data.models.factory import WorkGroup, WorkGroupMember
from apps.master_data.schemas.work_group_schemas import (
    WorkGroupCreate,
    WorkGroupUpdate,
    WorkGroupResponse,
    WorkGroupMemberItem,
    WorkGroupMemberResponse,
    WorkGroupListResult,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError

from apps.master_data.services.master_data_list_core import (
    apply_master_crud_list_filters,
    resolve_master_crud_order_clause as _work_group_order_clause,
)
from infra.models.user import User
from apps.common.audit_actor import apply_create_audit, apply_restore_audit, apply_update_audit


class WorkGroupService:
    """工作小组服务"""

    @staticmethod
    async def _resolve_employee_name(tenant_id: int, employee_id: int) -> str:
        """根据员工ID解析员工姓名"""
        from infra.models.user import User
        user = await User.filter(id=employee_id, tenant_id=tenant_id).first()
        return user.full_name if user else str(employee_id)

    @staticmethod
    async def create_work_group(
        tenant_id: int,
        data: WorkGroupCreate,
        current_user: Optional[User] = None,
    ) -> WorkGroupResponse:
        """创建工作小组"""
        existing_active = await WorkGroup.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()

        if existing_active:
            raise ValidationError(f"工作小组编码 {data.code} 已存在")

        existing_deleted = await WorkGroup.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=False
        ).first()

        if existing_deleted:
            existing_deleted.deleted_at = None
            existing_deleted.name = data.name
            existing_deleted.description = data.description
            existing_deleted.is_active = data.is_active
            if current_user:
                apply_restore_audit(existing_deleted, current_user)
            await existing_deleted.save()
            work_group = existing_deleted
            await WorkGroupMember.filter(work_group_id=work_group.id).delete()
        else:
            create_data = data.model_dump(by_alias=False, exclude={"members"})
            if current_user:
                apply_create_audit(create_data, current_user)
            work_group = await WorkGroup.create(tenant_id=tenant_id, **create_data)

        members = getattr(data, "members", None) or []
        for i, m in enumerate(members):
            item = m if isinstance(m, WorkGroupMemberItem) else WorkGroupMemberItem(**m)
            emp_name = item.employee_name
            if not emp_name:
                emp_name = await WorkGroupService._resolve_employee_name(tenant_id, item.employee_id)
            await WorkGroupMember.create(
                tenant_id=tenant_id,
                work_group_id=work_group.id,
                employee_id=item.employee_id,
                employee_name=emp_name,
                performance_weight=item.performance_weight,
                sort_order=item.sort_order if hasattr(item, "sort_order") else i,
                created_by=int(current_user.id) if current_user else None,
                created_by_name=(current_user.full_name or current_user.username or "").strip() if current_user else None,
                updated_by=int(current_user.id) if current_user else None,
                updated_by_name=(current_user.full_name or current_user.username or "").strip() if current_user else None,
            )

        return await WorkGroupService.get_work_group_by_uuid(tenant_id, work_group.uuid)

    @staticmethod
    async def get_work_group_by_uuid(
        tenant_id: int,
        work_group_uuid: str
    ) -> WorkGroupResponse:
        """根据UUID获取工作小组"""
        work_group = await WorkGroup.filter(
            tenant_id=tenant_id,
            uuid=work_group_uuid,
            deleted_at__isnull=True
        ).prefetch_related("members").first()

        if not work_group:
            raise NotFoundError(f"工作小组 {work_group_uuid} 不存在")

        members_data = []
        for m in work_group.members:
            if m.deleted_at:
                continue
            members_data.append(WorkGroupMemberResponse(
                id=m.id,
                work_group_id=work_group.id,
                employee_id=m.employee_id,
                employee_name=m.employee_name,
                performance_weight=m.performance_weight,
                sort_order=m.sort_order,
                created_by_name=m.created_by_name,
                updated_by_name=m.updated_by_name,
            ))

        members_data.sort(key=lambda x: x.sort_order)
        resp = WorkGroupResponse.model_validate(work_group)
        return resp.model_copy(update={"members": members_data})

    @staticmethod
    async def list_work_groups(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        code: Optional[str] = None,
        name: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
        sort_field: Optional[str] = None,
        sort_order: Optional[str] = None,
    ) -> WorkGroupListResult:
        """获取工作小组列表（分页 total + 排序）"""
        query = WorkGroup.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if is_active is not None:
            query = query.filter(is_active=is_active)

        query, order_expr = apply_master_crud_list_filters(
            query,
            keyword=keyword,
            code=code,
            name=name,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
            sort_field=sort_field,
            sort_order=sort_order,
            default_sort_col="code",
        )

        total = await query.count()
        work_groups = await query.offset(skip).limit(limit).order_by(order_expr).prefetch_related("members").all()
        result: List[WorkGroupResponse] = []
        for wg in work_groups:
            members_data = [
                WorkGroupMemberResponse(
                    id=m.id,
                    work_group_id=wg.id,
                    employee_id=m.employee_id,
                    employee_name=m.employee_name,
                    performance_weight=m.performance_weight,
                    sort_order=m.sort_order,
                    created_by_name=m.created_by_name,
                    updated_by_name=m.updated_by_name,
                )
                for m in wg.members if m.deleted_at is None
            ]
            members_data.sort(key=lambda x: x.sort_order)
            resp = WorkGroupResponse.model_validate(wg)
            result.append(resp.model_copy(update={"members": members_data}))
        return WorkGroupListResult(items=result, total=total)

    @staticmethod
    async def update_work_group(
        tenant_id: int,
        work_group_uuid: str,
        data: WorkGroupUpdate,
        current_user: Optional[User] = None,
    ) -> WorkGroupResponse:
        """更新工作小组"""
        work_group = await WorkGroup.filter(
            tenant_id=tenant_id,
            uuid=work_group_uuid,
            deleted_at__isnull=True
        ).first()

        if not work_group:
            raise NotFoundError(f"工作小组 {work_group_uuid} 不存在")

        if data.code and data.code != work_group.code:
            existing = await WorkGroup.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            if existing:
                raise ValidationError(f"工作小组编码 {data.code} 已存在")

        update_data = data.model_dump(exclude_unset=True, exclude={"members"}, by_alias=False)
        for key, value in update_data.items():
            setattr(work_group, key, value)
        if current_user:
            apply_update_audit(work_group, current_user)

        try:
            await work_group.save()
        except IntegrityError as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"工作小组编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise

        members = getattr(data, "members", None)
        if members is not None:
            await WorkGroupMember.filter(work_group_id=work_group.id).delete()
            for i, m in enumerate(members):
                item = m if isinstance(m, WorkGroupMemberItem) else WorkGroupMemberItem(**m)
                emp_name = item.employee_name
                if not emp_name:
                    emp_name = await WorkGroupService._resolve_employee_name(tenant_id, item.employee_id)
                await WorkGroupMember.create(
                    tenant_id=tenant_id,
                    work_group_id=work_group.id,
                    employee_id=item.employee_id,
                    employee_name=emp_name,
                    performance_weight=item.performance_weight,
                    sort_order=item.sort_order if hasattr(item, "sort_order") else i,
                    created_by=int(current_user.id) if current_user else None,
                    created_by_name=(current_user.full_name or current_user.username or "").strip() if current_user else None,
                    updated_by=int(current_user.id) if current_user else None,
                    updated_by_name=(current_user.full_name or current_user.username or "").strip() if current_user else None,
                )

        return await WorkGroupService.get_work_group_by_uuid(tenant_id, work_group.uuid)

    @staticmethod
    async def delete_work_group(
        tenant_id: int,
        work_group_uuid: str
    ) -> None:
        """删除工作小组（软删除）"""
        work_group = await WorkGroup.filter(
            tenant_id=tenant_id,
            uuid=work_group_uuid,
            deleted_at__isnull=True
        ).first()

        if not work_group:
            raise NotFoundError(f"工作小组 {work_group_uuid} 不存在")

        from tortoise import timezone
        work_group.deleted_at = timezone.now()
        await work_group.save()

    @staticmethod
    async def batch_delete_work_groups(
        tenant_id: int,
        work_group_uuids: List[str]
    ) -> dict:
        """批量删除工作小组（软删除）"""
        from tortoise import timezone
        from loguru import logger

        success_records = []
        failed_records = []

        unique_uuids = list(dict.fromkeys(work_group_uuids))

        for work_group_uuid in unique_uuids:
            try:
                work_group = await WorkGroup.filter(
                    tenant_id=tenant_id,
                    uuid=work_group_uuid,
                    deleted_at__isnull=True
                ).first()

                if not work_group:
                    # 幂等删除：记录不存在时视作已完成，无需计入失败
                    continue

                work_group.deleted_at = timezone.now()
                await work_group.save()
                success_records.append({"uuid": work_group_uuid})
            except Exception as e:
                logger.exception(f"删除工作小组 {work_group_uuid} 失败: {e}")
                failed_records.append({
                    "uuid": work_group_uuid,
                    "reason": str(e)
                })

        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }
