"""
绩效数据服务模块

提供绩效数据的业务逻辑处理（假期、技能），支持多组织隔离。
"""

from typing import List, Optional, Dict, Any, Set, Tuple
from datetime import date, timedelta
import uuid as uuid_mod

from loguru import logger
from tortoise.exceptions import IntegrityError

from apps.master_data.models.performance import Holiday, Skill
from apps.master_data.schemas.performance_schemas import (
    HolidayCreate, HolidayUpdate, HolidayResponse,
    HolidayCnImportRequest, HolidayCnImportResult,
    SkillCreate, SkillUpdate, SkillResponse
)
from apps.common.audit_actor import apply_create_audit, apply_update_audit
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.models.user import User

HOLIDAY_TYPE_LEGAL = "法定节假日"
HOLIDAY_TYPE_WEEKEND = "周休"

_REST_MODE_PRESETS: Dict[str, List[int]] = {
    "double": [5, 6],  # 周六、周日
    "single": [6],  # 周日
}

_HOLIDAY_CN_URLS = (
    "https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/{year}.json",
    "https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/{year}.json",
)


class PerformanceService:
    """绩效数据服务"""
    
    # ==================== 假期相关方法 ====================

    @staticmethod
    async def _fetch_holiday_cn_year(year: int) -> Dict[str, Any]:
        """拉取 holiday-cn 单年 JSON；jsDelivr 优先，失败再试 GitHub raw。"""
        from infra.infrastructure.http import get_http_client

        client = get_http_client()
        last_error: Optional[Exception] = None
        for template in _HOLIDAY_CN_URLS:
            url = template.format(year=year)
            try:
                resp = await client.get(url, timeout=15.0)
                if resp.status_code == 404:
                    last_error = ValidationError(f"未找到 {year} 年法定节假日数据")
                    continue
                resp.raise_for_status()
                data = resp.json()
                if not isinstance(data, dict) or "days" not in data:
                    raise ValidationError(f"{year} 年法定节假日数据格式无效")
                return data
            except ValidationError:
                raise
            except Exception as exc:
                last_error = exc
                logger.warning("拉取 holiday-cn {} 失败: {}", url, exc)
        if isinstance(last_error, ValidationError):
            raise last_error
        raise ValidationError(
            f"无法获取 {year} 年中国法定节假日数据，请稍后重试"
        )

    @staticmethod
    def _resolve_rest_weekdays(rest_mode: str, rest_weekdays: Optional[List[int]]) -> List[int]:
        mode = (rest_mode or "double").strip().lower()
        if mode in _REST_MODE_PRESETS:
            return list(_REST_MODE_PRESETS[mode])
        if mode != "custom":
            raise ValidationError("休息制度仅支持 double / single / custom")
        if not rest_weekdays:
            raise ValidationError("自定义休息制度须指定 rest_weekdays")
        cleaned: List[int] = []
        for d in rest_weekdays:
            try:
                wi = int(d)
            except (TypeError, ValueError) as exc:
                raise ValidationError("rest_weekdays 须为 0–6 的整数") from exc
            if wi < 0 or wi > 6:
                raise ValidationError("rest_weekdays 须为 0–6（周一=0 … 周日=6）")
            if wi not in cleaned:
                cleaned.append(wi)
        if not cleaned:
            raise ValidationError("自定义休息制度至少选择一个休息日")
        return cleaned

    @staticmethod
    def _iter_year_dates(year: int):
        cur = date(year, 1, 1)
        end = date(year, 12, 31)
        while cur <= end:
            yield cur
            cur += timedelta(days=1)

    @staticmethod
    async def import_cn_holidays(
        tenant_id: int,
        data: HolidayCnImportRequest,
        operator: Optional[User] = None,
    ) -> HolidayCnImportResult:
        """
        导入中国法定节假日 + 按周休规则生成休息日。
        调休上班日不写入；同日已有假期则跳过。
        """
        year = int(data.year)
        rest_weekdays = PerformanceService._resolve_rest_weekdays(
            data.rest_mode, data.rest_weekdays
        )

        # 跨文件：year 与 year-1，只保留公历 year 内日期
        days_by_date: Dict[str, Dict[str, Any]] = {}
        fetch_years = [year]
        if year > 2007:
            fetch_years.append(year - 1)
        year_prefix = f"{year}-"
        for y in fetch_years:
            payload = await PerformanceService._fetch_holiday_cn_year(y)
            for day in payload.get("days") or []:
                if not isinstance(day, dict):
                    continue
                d = str(day.get("date") or "").strip()
                if not d.startswith(year_prefix):
                    continue
                days_by_date[d] = day

        legal_candidates: Dict[date, str] = {}
        makeup_workdays: Set[date] = set()
        for d_str, day in days_by_date.items():
            try:
                d = date.fromisoformat(d_str)
            except ValueError:
                continue
            is_off = bool(day.get("isOffDay"))
            name = str(day.get("name") or "").strip() or "法定节假日"
            if is_off:
                legal_candidates[d] = name
            else:
                makeup_workdays.add(d)

        weekend_candidates: List[date] = []
        for d in PerformanceService._iter_year_dates(year):
            if d.weekday() not in rest_weekdays:
                continue
            if d in makeup_workdays:
                continue
            if d in legal_candidates:
                continue
            weekend_candidates.append(d)

        pending: List[Tuple[date, str, str, str]] = []
        # (holiday_date, name, holiday_type, description)
        for d, name in sorted(legal_candidates.items()):
            pending.append((d, name, HOLIDAY_TYPE_LEGAL, f"{year}年中国法定节假日（holiday-cn）"))
        for d in weekend_candidates:
            pending.append((d, HOLIDAY_TYPE_WEEKEND, HOLIDAY_TYPE_WEEKEND, f"{year}年周休"))

        if not pending:
            raise ValidationError(f"{year} 年没有可导入的休息日")

        existing_dates = set(
            await Holiday.filter(
                tenant_id=tenant_id,
                holiday_date__gte=date(year, 1, 1),
                holiday_date__lte=date(year, 12, 31),
                deleted_at__isnull=True,
            ).values_list("holiday_date", flat=True)
        )

        created = 0
        skipped = 0
        failed = 0
        for holiday_date, name, holiday_type, description in pending:
            if holiday_date in existing_dates:
                skipped += 1
                continue
            create_data: Dict[str, Any] = {
                "uuid": str(uuid_mod.uuid4()),
                "name": name,
                "holiday_date": holiday_date,
                "holiday_type": holiday_type,
                "description": description,
                "is_active": True,
            }
            apply_create_audit(create_data, operator)
            try:
                await Holiday.create(tenant_id=tenant_id, **create_data)
                existing_dates.add(holiday_date)
                created += 1
            except Exception as exc:
                failed += 1
                logger.warning(
                    "导入假期失败 tenant={} date={}: {}",
                    tenant_id,
                    holiday_date,
                    exc,
                )

        return HolidayCnImportResult(
            year=year,
            created=created,
            skipped=skipped,
            failed=failed,
            legal_count=len(legal_candidates),
            weekend_count=len(weekend_candidates),
        )

    @staticmethod
    async def create_holiday(
        tenant_id: int,
        data: HolidayCreate,
        operator: Optional[User] = None,
    ) -> HolidayResponse:
        """
        创建假期
        
        Args:
            tenant_id: 租户ID
            data: 假期创建数据
            
        Returns:
            HolidayResponse: 创建的假期对象
            
        Raises:
            ValidationError: 当同一日期已存在假期时抛出
        """
        # 检查同一日期是否已存在假期
        existing = await Holiday.filter(
            tenant_id=tenant_id,
            holiday_date=data.holiday_date,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"日期 {data.holiday_date} 已存在假期")
        
        # 创建假期（by_alias=False 得到 snake_case 供 ORM 使用）
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        apply_create_audit(create_data, operator)
        holiday = await Holiday.create(
            tenant_id=tenant_id,
            **create_data
        )
        
        return HolidayResponse.model_validate(holiday)
    
    @staticmethod
    async def get_holiday_by_uuid(
        tenant_id: int,
        holiday_uuid: str
    ) -> HolidayResponse:
        """
        根据UUID获取假期
        
        Args:
            tenant_id: 租户ID
            holiday_uuid: 假期UUID
            
        Returns:
            HolidayResponse: 假期对象
            
        Raises:
            NotFoundError: 当假期不存在时抛出
        """
        holiday = await Holiday.filter(
            tenant_id=tenant_id,
            uuid=holiday_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not holiday:
            raise NotFoundError(f"假期 {holiday_uuid} 不存在")
        
        return HolidayResponse.model_validate(holiday)
    
    @staticmethod
    async def list_holidays(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        holiday_type: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> dict:
        from apps.master_data.services.performance_list_core import apply_holiday_list_filters

        query = Holiday.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        start_str = start_date.isoformat() if start_date else None
        end_str = end_date.isoformat() if end_date else None
        query, order_clause = apply_holiday_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            holiday_type=holiday_type,
            start_date=start_str,
            end_date=end_str,
            is_active=is_active,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        holidays = await query.order_by(order_clause).offset(skip).limit(limit).all()
        items = [HolidayResponse.model_validate(h) for h in holidays]
        return {"items": items, "total": total}
    
    @staticmethod
    async def update_holiday(
        tenant_id: int,
        holiday_uuid: str,
        data: HolidayUpdate,
        operator: Optional[User] = None,
    ) -> HolidayResponse:
        """
        更新假期
        
        Args:
            tenant_id: 租户ID
            holiday_uuid: 假期UUID
            data: 假期更新数据
            
        Returns:
            HolidayResponse: 更新后的假期对象
            
        Raises:
            NotFoundError: 当假期不存在时抛出
            ValidationError: 当同一日期已存在其他假期时抛出
        """
        holiday = await Holiday.filter(
            tenant_id=tenant_id,
            uuid=holiday_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not holiday:
            raise NotFoundError(f"假期 {holiday_uuid} 不存在")
        
        # 如果更新日期，检查同一日期是否已存在其他假期
        if data.holiday_date and data.holiday_date != holiday.holiday_date:
            existing = await Holiday.filter(
                tenant_id=tenant_id,
                holiday_date=data.holiday_date,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"日期 {data.holiday_date} 已存在假期")
        
        # 更新字段（by_alias=False 得到 snake_case 供 ORM 使用）
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(holiday, key, value)
        apply_update_audit(holiday, operator)
        await holiday.save()
        
        return HolidayResponse.model_validate(holiday)
    
    @staticmethod
    async def delete_holiday(
        tenant_id: int,
        holiday_uuid: str
    ) -> None:
        """
        删除假期（软删除）
        
        Args:
            tenant_id: 租户ID
            holiday_uuid: 假期UUID
            
        Raises:
            NotFoundError: 当假期不存在时抛出
        """
        holiday = await Holiday.filter(
            tenant_id=tenant_id,
            uuid=holiday_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not holiday:
            raise NotFoundError(f"假期 {holiday_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        holiday.deleted_at = timezone.now()
        await holiday.save()
    
    # ==================== 技能相关方法 ====================
    
    @staticmethod
    async def create_skill(
        tenant_id: int,
        data: SkillCreate,
        operator: Optional[User] = None,
    ) -> SkillResponse:
        """
        创建技能
        
        Args:
            tenant_id: 租户ID
            data: 技能创建数据
            
        Returns:
            SkillResponse: 创建的技能对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await Skill.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"技能编码 {data.code} 已存在")
        
        # 创建技能（by_alias=False 得到 snake_case 供 ORM 使用）
        create_data = data.model_dump(by_alias=False) if hasattr(data, "model_dump") else data.dict()
        apply_create_audit(create_data, operator)
        try:
            skill = await Skill.create(
                tenant_id=tenant_id,
                **create_data
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"技能编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return SkillResponse.model_validate(skill)
    
    @staticmethod
    async def get_skill_by_uuid(
        tenant_id: int,
        skill_uuid: str
    ) -> SkillResponse:
        """
        根据UUID获取技能
        
        Args:
            tenant_id: 租户ID
            skill_uuid: 技能UUID
            
        Returns:
            SkillResponse: 技能对象
            
        Raises:
            NotFoundError: 当技能不存在时抛出
        """
        skill = await Skill.filter(
            tenant_id=tenant_id,
            uuid=skill_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not skill:
            raise NotFoundError(f"技能 {skill_uuid} 不存在")
        
        return SkillResponse.model_validate(skill)
    
    @staticmethod
    async def list_skills(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None,
        keyword: Optional[str] = None,
        order_by: Optional[str] = None,
        created_start_date: Optional[str] = None,
        created_end_date: Optional[str] = None,
        updated_start_date: Optional[str] = None,
        updated_end_date: Optional[str] = None,
    ) -> dict:
        from apps.master_data.services.performance_list_core import apply_skill_list_filters

        query = Skill.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        query, order_clause = apply_skill_list_filters(
            query,
            keyword=keyword,
            order_by=order_by,
            category=category,
            is_active=is_active,
            created_start_date=created_start_date,
            created_end_date=created_end_date,
            updated_start_date=updated_start_date,
            updated_end_date=updated_end_date,
        )
        total = await query.count()
        skills = await query.order_by(order_clause).offset(skip).limit(limit).all()
        items = [SkillResponse.model_validate(s) for s in skills]
        return {"items": items, "total": total}
    
    @staticmethod
    async def update_skill(
        tenant_id: int,
        skill_uuid: str,
        data: SkillUpdate,
        operator: Optional[User] = None,
    ) -> SkillResponse:
        """
        更新技能
        
        Args:
            tenant_id: 租户ID
            skill_uuid: 技能UUID
            data: 技能更新数据
            
        Returns:
            SkillResponse: 更新后的技能对象
            
        Raises:
            NotFoundError: 当技能不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        skill = await Skill.filter(
            tenant_id=tenant_id,
            uuid=skill_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not skill:
            raise NotFoundError(f"技能 {skill_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != skill.code:
            existing = await Skill.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"技能编码 {data.code} 已存在")
        
        # 更新字段（by_alias=False 得到 snake_case 供 ORM 使用）
        update_data = data.model_dump(exclude_unset=True, by_alias=False) if hasattr(data, "model_dump") else data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(skill, key, value)
        apply_update_audit(skill, operator)
        
        try:
            await skill.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"技能编码 {data.code or skill.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return SkillResponse.model_validate(skill)
    
    @staticmethod
    async def delete_skill(
        tenant_id: int,
        skill_uuid: str
    ) -> None:
        """
        删除技能（软删除）
        
        Args:
            tenant_id: 租户ID
            skill_uuid: 技能UUID
            
        Raises:
            NotFoundError: 当技能不存在时抛出
        """
        skill = await Skill.filter(
            tenant_id=tenant_id,
            uuid=skill_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not skill:
            raise NotFoundError(f"技能 {skill_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        skill.deleted_at = timezone.now()
        await skill.save()

