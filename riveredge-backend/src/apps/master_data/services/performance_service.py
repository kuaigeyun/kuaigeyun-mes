"""
绩效数据服务模块

提供绩效数据的业务逻辑处理（假期、技能），支持多组织隔离。
"""

from typing import List, Optional
from datetime import date

from apps.master_data.models.performance import Holiday, Skill
from apps.master_data.schemas.performance_schemas import (
    HolidayCreate, HolidayUpdate, HolidayResponse,
    SkillCreate, SkillUpdate, SkillResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PerformanceService:
    """绩效数据服务"""
    
    # ==================== 假期相关方法 ====================
    
    @staticmethod
    async def create_holiday(
        tenant_id: int,
        data: HolidayCreate
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
        
        # 创建假期
        holiday = await Holiday.create(
            tenant_id=tenant_id,
            **data.dict()
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
        is_active: Optional[bool] = None
    ) -> List[HolidayResponse]:
        """
        获取假期列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            holiday_type: 假期类型（可选，用于过滤）
            start_date: 开始日期（可选，用于过滤）
            end_date: 结束日期（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[HolidayResponse]: 假期列表
        """
        query = Holiday.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if holiday_type is not None:
            query = query.filter(holiday_type=holiday_type)
        
        if start_date is not None:
            query = query.filter(holiday_date__gte=start_date)
        
        if end_date is not None:
            query = query.filter(holiday_date__lte=end_date)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        holidays = await query.offset(skip).limit(limit).order_by("holiday_date").all()
        
        return [HolidayResponse.model_validate(h) for h in holidays]
    
    @staticmethod
    async def update_holiday(
        tenant_id: int,
        holiday_uuid: str,
        data: HolidayUpdate
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
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(holiday, key, value)
        
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
        data: SkillCreate
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
        
        # 创建技能
        skill = await Skill.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
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
        is_active: Optional[bool] = None
    ) -> List[SkillResponse]:
        """
        获取技能列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            category: 技能分类（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[SkillResponse]: 技能列表
        """
        query = Skill.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if category is not None:
            query = query.filter(category=category)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        skills = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [SkillResponse.model_validate(s) for s in skills]
    
    @staticmethod
    async def update_skill(
        tenant_id: int,
        skill_uuid: str,
        data: SkillUpdate
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
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(skill, key, value)
        
        await skill.save()
        
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

