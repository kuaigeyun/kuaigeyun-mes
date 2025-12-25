"""
会计科目服务模块

提供会计科目的业务逻辑处理，支持多组织隔离。
按照中国财务规范设计。
"""

from typing import List, Optional
from apps.kuaiacc.models.account_subject import AccountSubject
from apps.kuaiacc.schemas.account_subject_schemas import (
    AccountSubjectCreate, AccountSubjectUpdate, AccountSubjectResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class AccountSubjectService:
    """会计科目服务"""
    
    @staticmethod
    async def create_account_subject(
        tenant_id: int,
        data: AccountSubjectCreate
    ) -> AccountSubjectResponse:
        """
        创建会计科目
        
        Args:
            tenant_id: 租户ID
            data: 科目创建数据
            
        Returns:
            AccountSubjectResponse: 创建的科目对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await AccountSubject.filter(
            tenant_id=tenant_id,
            subject_code=data.subject_code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"科目编码 {data.subject_code} 已存在")
        
        # 创建科目
        subject = await AccountSubject.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return AccountSubjectResponse.model_validate(subject)
    
    @staticmethod
    async def get_account_subject_by_uuid(
        tenant_id: int,
        subject_uuid: str
    ) -> AccountSubjectResponse:
        """
        根据UUID获取会计科目
        
        Args:
            tenant_id: 租户ID
            subject_uuid: 科目UUID
            
        Returns:
            AccountSubjectResponse: 科目对象
            
        Raises:
            NotFoundError: 当科目不存在时抛出
        """
        subject = await AccountSubject.filter(
            tenant_id=tenant_id,
            uuid=subject_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not subject:
            raise NotFoundError(f"会计科目 {subject_uuid} 不存在")
        
        return AccountSubjectResponse.model_validate(subject)
    
    @staticmethod
    async def list_account_subjects(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        subject_type: Optional[str] = None,
        status: Optional[str] = None,
        parent_id: Optional[int] = None
    ) -> List[AccountSubjectResponse]:
        """
        获取会计科目列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            subject_type: 科目类型（过滤）
            status: 状态（过滤）
            parent_id: 父科目ID（过滤）
            
        Returns:
            List[AccountSubjectResponse]: 科目列表
        """
        query = AccountSubject.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if subject_type:
            query = query.filter(subject_type=subject_type)
        if status:
            query = query.filter(status=status)
        if parent_id is not None:
            query = query.filter(parent_id=parent_id)
        
        subjects = await query.offset(skip).limit(limit).all()
        
        return [AccountSubjectResponse.model_validate(subject) for subject in subjects]
    
    @staticmethod
    async def update_account_subject(
        tenant_id: int,
        subject_uuid: str,
        data: AccountSubjectUpdate
    ) -> AccountSubjectResponse:
        """
        更新会计科目
        
        Args:
            tenant_id: 租户ID
            subject_uuid: 科目UUID
            data: 科目更新数据
            
        Returns:
            AccountSubjectResponse: 更新后的科目对象
            
        Raises:
            NotFoundError: 当科目不存在时抛出
        """
        subject = await AccountSubject.filter(
            tenant_id=tenant_id,
            uuid=subject_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not subject:
            raise NotFoundError(f"会计科目 {subject_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(subject, key, value)
        
        await subject.save()
        
        return AccountSubjectResponse.model_validate(subject)
    
    @staticmethod
    async def delete_account_subject(
        tenant_id: int,
        subject_uuid: str
    ) -> None:
        """
        删除会计科目（软删除）
        
        Args:
            tenant_id: 租户ID
            subject_uuid: 科目UUID
            
        Raises:
            NotFoundError: 当科目不存在时抛出
        """
        subject = await AccountSubject.filter(
            tenant_id=tenant_id,
            uuid=subject_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not subject:
            raise NotFoundError(f"会计科目 {subject_uuid} 不存在")
        
        # 检查是否有子科目
        children = await AccountSubject.filter(
            tenant_id=tenant_id,
            parent_id=subject.id,
            deleted_at__isnull=True
        ).count()
        
        if children > 0:
            raise ValidationError(f"会计科目 {subject.subject_code} 存在子科目，无法删除")
        
        # 软删除
        from datetime import datetime
        subject.deleted_at = datetime.now()
        await subject.save()

