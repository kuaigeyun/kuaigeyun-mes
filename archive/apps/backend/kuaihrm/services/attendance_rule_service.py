"""
考勤规则服务模块

提供考勤规则的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaihrm.models.attendance import AttendanceRule
from apps.kuaihrm.schemas.attendance_rule_schemas import (
    AttendanceRuleCreate, AttendanceRuleUpdate, AttendanceRuleResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AttendanceRuleService:
    """考勤规则服务"""
    
    @staticmethod
    async def create_attendance_rule(
        tenant_id: int,
        data: AttendanceRuleCreate
    ) -> AttendanceRuleResponse:
        """创建考勤规则"""
        existing = await AttendanceRule.filter(
            tenant_id=tenant_id,
            rule_code=data.rule_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"规则编码 {data.rule_code} 已存在")
        
        rule = await AttendanceRule.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return AttendanceRuleResponse.model_validate(rule)
    
    @staticmethod
    async def get_attendance_rule_by_uuid(
        tenant_id: int,
        rule_uuid: str
    ) -> AttendanceRuleResponse:
        """根据UUID获取考勤规则"""
        rule = await AttendanceRule.filter(
            tenant_id=tenant_id,
            uuid=rule_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not rule:
            raise NotFoundError(f"考勤规则 {rule_uuid} 不存在")
        
        return AttendanceRuleResponse.model_validate(rule)
    
    @staticmethod
    async def list_attendance_rules(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        rule_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[AttendanceRuleResponse]:
        """获取考勤规则列表"""
        query = AttendanceRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if rule_type:
            query = query.filter(rule_type=rule_type)
        if status:
            query = query.filter(status=status)
        
        rules = await query.offset(skip).limit(limit).all()
        
        return [AttendanceRuleResponse.model_validate(r) for r in rules]
    
    @staticmethod
    async def update_attendance_rule(
        tenant_id: int,
        rule_uuid: str,
        data: AttendanceRuleUpdate
    ) -> AttendanceRuleResponse:
        """更新考勤规则"""
        rule = await AttendanceRule.filter(
            tenant_id=tenant_id,
            uuid=rule_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not rule:
            raise NotFoundError(f"考勤规则 {rule_uuid} 不存在")
        
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(rule, key, value)
        
        await rule.save()
        
        return AttendanceRuleResponse.model_validate(rule)
    
    @staticmethod
    async def delete_attendance_rule(
        tenant_id: int,
        rule_uuid: str
    ) -> None:
        """删除考勤规则（软删除）"""
        rule = await AttendanceRule.filter(
            tenant_id=tenant_id,
            uuid=rule_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not rule:
            raise NotFoundError(f"考勤规则 {rule_uuid} 不存在")
        
        from datetime import datetime
        rule.deleted_at = datetime.now()
        await rule.save()

