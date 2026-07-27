"""
模具管理服务模块

提供模具 CRUD 与校验/保养提醒等操作；领用/归还见 mold_ops_service。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Optional
from datetime import datetime, date
import math
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from apps.kuaizhizao.models.mold import Mold, MoldCalibration
from apps.kuaizhizao.models.mold_ops import MoldMaintenanceScheme, MoldSchemeBinding
from apps.kuaizhizao.schemas.mold import (
    MoldCreate,
    MoldUpdate,
    MoldCalibrationCreate,
)
from apps.common.audit_actor import apply_create_audit
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User
from core.utils.timezone_utils import resolve_business_datetime


class MoldService:
    """
    模具管理服务类
    
    提供模具的 CRUD 操作。
    """
    
    @staticmethod
    async def create_mold(
        tenant_id: int,
        data: MoldCreate,
        created_by: Optional[int] = None
    ) -> Mold:
        """
        创建模具
        
        Args:
            tenant_id: 组织ID
            data: 模具创建数据
            created_by: 创建人ID（可选）
            
        Returns:
            Mold: 创建的模具对象
            
        Raises:
            ValidationError: 当模具编码已存在时抛出
        """
        try:
            # 如果没有提供编码，自动生成
            if not data.code:
                try:
                    data.code = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="MOLD_CODE",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    timestamp = resolve_business_datetime().strftime("%Y%m%d%H%M%S")
                    data.code = f"MD{timestamp}"
            
            mold = Mold(
                tenant_id=tenant_id,
                **data.model_dump(exclude_none=True)
            )
            actor = None
            if created_by is not None:
                actor = await User.filter(id=created_by, tenant_id=tenant_id).first()
            apply_create_audit(mold, actor)
            await mold.save()
            return mold
        except IntegrityError:
            raise ValidationError(f"模具编码 {data.code} 已存在")
    
    @staticmethod
    async def get_mold_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> Mold:
        """
        根据UUID获取模具
        
        Args:
            tenant_id: 组织ID
            uuid: 模具UUID
            
        Returns:
            Mold: 模具对象
            
        Raises:
            NotFoundError: 当模具不存在时抛出
        """
        mold = await Mold.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not mold:
            raise NotFoundError("模具不存在")
        
        return mold
    
    @staticmethod
    async def list_molds(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        status: Optional[str] = None,
        is_active: Optional[bool] = None,
        search: Optional[str] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[Mold], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            MOLD_LEDGER_SORTABLE_FIELDS,
            apply_equipment_created_date_range,
            apply_equipment_keyword_filter,
            apply_equipment_updated_date_range,
            pick_search_keyword,
            resolve_equipment_list_order_by,
        )

        query = Mold.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if type:
            query = query.filter(type=type)
        if status:
            query = query.filter(status=status)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        query = apply_equipment_keyword_filter(
            query,
            pick_search_keyword(keyword, search),
            ["code", "name"],
        )
        query = apply_equipment_created_date_range(
            query,
            start_date=created_start_date,
            end_date=created_end_date,
        )
        query = apply_equipment_updated_date_range(
            query,
            start_date=updated_start_date,
            end_date=updated_end_date,
        )
        total = await query.count()
        order_clause = resolve_equipment_list_order_by(
            order_by,
            MOLD_LEDGER_SORTABLE_FIELDS,
            "-updated_at",
        )
        molds = await query.offset(skip).limit(limit).order_by(order_clause)
        return molds, total
    
    @staticmethod
    async def update_mold(
        tenant_id: int,
        uuid: str,
        data: MoldUpdate
    ) -> Mold:
        """
        更新模具
        
        Args:
            tenant_id: 组织ID
            uuid: 模具UUID
            data: 模具更新数据
            
        Returns:
            Mold: 更新后的模具对象
            
        Raises:
            NotFoundError: 当模具不存在时抛出
            ValidationError: 当模具编码已存在时抛出
        """
        mold = await MoldService.get_mold_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        
        # 如果更新了编码，检查是否重复
        if 'code' in update_data and update_data['code'] != mold.code:
            existing = await Mold.filter(
                tenant_id=tenant_id,
                code=update_data['code'],
                deleted_at__isnull=True
            ).first()
            if existing and existing.uuid != mold.uuid:
                raise ValidationError(f"模具编码 {update_data['code']} 已存在")
        
        # 更新字段
        for key, value in update_data.items():
            setattr(mold, key, value)
        
        await mold.save()
        return mold
    
    @staticmethod
    async def delete_mold(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除模具（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 模具UUID
            
        Raises:
            NotFoundError: 当模具不存在时抛出
        """
        mold = await MoldService.get_mold_by_uuid(tenant_id, uuid)
        
        # 软删除
        mold.deleted_at = resolve_business_datetime()
        await mold.save()


class MoldCalibrationService:
    """
    模具校验记录服务类

    提供模具校验记录的 list、create 操作。
    """

    @staticmethod
    async def list_calibrations(
        tenant_id: int,
        mold_uuid: str,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[List[MoldCalibration], int]:
        """
        获取模具校验记录列表

        Args:
            tenant_id: 组织ID
            mold_uuid: 模具UUID
            skip: 跳过数量
            limit: 限制数量

        Returns:
            tuple[list[MoldCalibration], int]: 校验记录列表和总数量
        """
        mold = await MoldService.get_mold_by_uuid(tenant_id, mold_uuid)
        query = MoldCalibration.filter(
            tenant_id=tenant_id,
            mold_id=mold.id,
            deleted_at__isnull=True,
        )
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by("-calibration_date")
        return list(items), total

    @staticmethod
    async def create_calibration(
        tenant_id: int,
        data: MoldCalibrationCreate,
        current_user: Optional[User] = None,
    ) -> MoldCalibration:
        """
        创建模具校验记录

        Args:
            tenant_id: 组织ID
            data: 校验记录创建数据
            current_user: 当前用户（写入审计字段）

        Returns:
            MoldCalibration: 创建的校验记录对象

        Raises:
            ValidationError: 当模具不存在时抛出
        """
        mold = await MoldService.get_mold_by_uuid(tenant_id, data.mold_uuid)
        calib = MoldCalibration(
            tenant_id=tenant_id,
            mold_id=mold.id,
            mold_uuid=mold.uuid,
            calibration_date=data.calibration_date,
            result=data.result,
            certificate_no=data.certificate_no,
            expiry_date=data.expiry_date,
            remark=data.remark,
        )
        apply_create_audit(calib, current_user)
        await calib.save()

        # 更新模具上次/下次校验日期
        mold.last_calibration_date = data.calibration_date
        if data.expiry_date:
            mold.next_calibration_date = data.expiry_date
        elif mold.calibration_period:
            from datetime import timedelta
            mold.next_calibration_date = data.calibration_date + timedelta(days=mold.calibration_period)
        await mold.save()
        return calib

    @staticmethod
    async def list_all_calibrations(
        tenant_id: int,
        mold_uuid: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
        keyword: Optional[str] = None,
        search: Optional[str] = None,
        order_by: Optional[str] = None,
        calibration_start_date: Optional[str] = None,
        calibration_end_date: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> tuple[List[MoldCalibration], int]:
        from apps.kuaizhizao.services.equipment_list_core import (
            EQUIPMENT_CALIBRATION_SORTABLE_FIELDS,
            apply_asset_workflow_list_filters,
        )

        query = MoldCalibration.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if mold_uuid:
            query = query.filter(mold_uuid=mold_uuid)
        query, order_clause = apply_asset_workflow_list_filters(
            query,
            keyword=keyword,
            search=search,
            order_by=order_by,
            allowed_fields=EQUIPMENT_CALIBRATION_SORTABLE_FIELDS,
            keyword_fields=["certificate_no", "result"],
            date_field="calibration_date",
            date_start=calibration_start_date,
            date_end=calibration_end_date,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        items = await query.offset(skip).limit(limit).order_by(order_clause)
        return list(items), total


class MoldMaintenanceReminderService:
    """
    模具保养提醒服务（基于使用次数或方案按天触发）
    """

    @staticmethod
    async def _get_scheme_for_mold(tenant_id: int, mold: Mold) -> Optional[MoldMaintenanceScheme]:
        scheme_id = mold.maintenance_scheme_id
        if not scheme_id:
            binding = await MoldSchemeBinding.filter(
                tenant_id=tenant_id,
                mold_id=mold.id,
                scheme_type="maintenance",
                deleted_at__isnull=True,
            ).order_by("id").first()
            if binding:
                scheme_id = binding.scheme_id
        if not scheme_id:
            return None
        return await MoldMaintenanceScheme.filter(
            tenant_id=tenant_id,
            id=scheme_id,
            deleted_at__isnull=True,
            is_active=True,
        ).first()

    @staticmethod
    async def list_reminders(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        reminder_type: Optional[str] = None,
    ) -> tuple[List[dict], int]:
        molds = await Mold.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            is_active=True,
        ).all()
        results = []
        today = date.today()

        for mold in molds:
            scheme = await MoldMaintenanceReminderService._get_scheme_for_mold(tenant_id, mold)
            trigger_type = scheme.trigger_type if scheme else "usage_count"
            interval = mold.maintenance_interval
            if scheme and scheme.trigger_interval_usage:
                interval = scheme.trigger_interval_usage

            if trigger_type == "days":
                interval_days = scheme.trigger_interval_days if scheme else mold.maintenance_interval
                if not interval_days or interval_days <= 0:
                    continue
                last_date = mold.last_maintenance_date
                if not last_date:
                    days_since = interval_days
                    rtype = "overdue"
                else:
                    days_since = (today - last_date).days
                    if days_since >= interval_days:
                        rtype = "overdue"
                    elif days_since >= max(1, int(interval_days * 0.9)):
                        rtype = "due_soon"
                    else:
                        continue
                if reminder_type and rtype != reminder_type:
                    continue
                results.append({
                    "mold_uuid": mold.uuid,
                    "mold_code": mold.code,
                    "mold_name": mold.name,
                    "trigger_type": "days",
                    "total_usage_count": mold.total_usage_count or 0,
                    "maintenance_interval": interval,
                    "next_maintenance_at_count": None,
                    "usages_until_due": None,
                    "last_maintenance_date": last_date,
                    "days_since_maintenance": days_since,
                    "trigger_interval_days": interval_days,
                    "reminder_type": rtype,
                })
            else:
                if not interval or interval <= 0:
                    continue
                total = mold.total_usage_count or 0
                next_at = math.ceil(total / interval) * interval if total > 0 else interval
                usages_until = next_at - total
                if usages_until <= 0:
                    rtype = "overdue"
                elif usages_until <= max(5, int(interval * 0.1)):
                    rtype = "due_soon"
                else:
                    continue
                if reminder_type and rtype != reminder_type:
                    continue
                results.append({
                    "mold_uuid": mold.uuid,
                    "mold_code": mold.code,
                    "mold_name": mold.name,
                    "trigger_type": "usage_count",
                    "total_usage_count": total,
                    "maintenance_interval": interval,
                    "next_maintenance_at_count": next_at,
                    "usages_until_due": usages_until,
                    "last_maintenance_date": mold.last_maintenance_date,
                    "days_since_maintenance": (
                        (today - mold.last_maintenance_date).days
                        if mold.last_maintenance_date else None
                    ),
                    "trigger_interval_days": scheme.trigger_interval_days if scheme else None,
                    "reminder_type": rtype,
                })

        results.sort(key=lambda x: (0 if x["reminder_type"] == "overdue" else 1, x.get("usages_until_due") or 0))
        total_count = len(results)
        items = results[skip : skip + limit]
        return items, total_count

