"""
邀请码服务模块

提供邀请码的生成、验证和使用操作。
"""

import secrets
import string
from typing import Optional, List
from datetime import datetime
from tortoise.exceptions import IntegrityError

from core.models.invitation_code import InvitationCode
from core.schemas.invitation_code import InvitationCodeCreate, InvitationCodeUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InvitationCodeService:
    """
    邀请码服务类
    
    提供邀请码的生成、验证和使用操作。
    """
    
    @staticmethod
    def _generate_code(length: int = 16) -> str:
        """
        生成随机邀请码
        
        Args:
            length: 邀请码长度（默认 16）
            
        Returns:
            str: 生成的邀请码
        """
        alphabet = string.ascii_uppercase + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(length))
    
    @staticmethod
    async def create_invitation_code(
        tenant_id: int,
        data: InvitationCodeCreate
    ) -> InvitationCode:
        """
        创建邀请码
        
        Args:
            tenant_id: 组织ID
            data: 邀请码创建数据
            
        Returns:
            InvitationCode: 创建的邀请码对象
            
        Raises:
            ValidationError: 当生成唯一邀请码失败时抛出
        """
        # 生成唯一邀请码（最多尝试 10 次）
        max_attempts = 10
        for attempt in range(max_attempts):
            code = InvitationCodeService._generate_code()
            exists = await InvitationCode.exists(
                code=code,
                deleted_at__isnull=True
            )
            if not exists:
                break
        else:
            raise ValidationError("无法生成唯一邀请码，请重试")
        
        try:
            invitation_code = InvitationCode(
                tenant_id=tenant_id,
                code=code,
                **data.model_dump()
            )
            await invitation_code.save()
            return invitation_code
        except IntegrityError:
            raise ValidationError("邀请码创建失败，请重试")
    
    @staticmethod
    async def get_invitation_code_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> InvitationCode:
        """
        根据UUID获取邀请码
        
        Args:
            tenant_id: 组织ID
            uuid: 邀请码UUID
            
        Returns:
            InvitationCode: 邀请码对象
            
        Raises:
            NotFoundError: 当邀请码不存在时抛出
        """
        invitation_code = await InvitationCode.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not invitation_code:
            raise NotFoundError("邀请码不存在")
        
        return invitation_code
    
    @staticmethod
    async def list_invitation_codes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[InvitationCode]:
        """
        获取邀请码列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[InvitationCode]: 邀请码列表
        """
        query = InvitationCode.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.offset(skip).limit(limit).order_by("-created_at")
    
    @staticmethod
    async def update_invitation_code(
        tenant_id: int,
        uuid: str,
        data: InvitationCodeUpdate
    ) -> InvitationCode:
        """
        更新邀请码
        
        Args:
            tenant_id: 组织ID
            uuid: 邀请码UUID
            data: 邀请码更新数据
            
        Returns:
            InvitationCode: 更新后的邀请码对象
            
        Raises:
            NotFoundError: 当邀请码不存在时抛出
        """
        invitation_code = await InvitationCodeService.get_invitation_code_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(invitation_code, key, value)
        
        await invitation_code.save()
        return invitation_code
    
    @staticmethod
    async def delete_invitation_code(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除邀请码（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 邀请码UUID
            
        Raises:
            NotFoundError: 当邀请码不存在时抛出
        """
        invitation_code = await InvitationCodeService.get_invitation_code_by_uuid(tenant_id, uuid)
        
        # 软删除
        invitation_code.deleted_at = datetime.now()
        await invitation_code.save()
    
    @staticmethod
    async def validate_invitation_code(code: str) -> InvitationCode:
        """
        验证邀请码（不增加使用次数）
        
        Args:
            code: 邀请码
            
        Returns:
            InvitationCode: 邀请码对象
            
        Raises:
            ValidationError: 当邀请码不存在或无效时抛出
        """
        invitation_code = await InvitationCode.get_or_none(
            code=code,
            deleted_at__isnull=True
        )
        
        if not invitation_code:
            raise ValidationError("邀请码不存在")
        
        if not invitation_code.is_valid():
            raise ValidationError("邀请码无效或已过期")
        
        return invitation_code
    
    @staticmethod
    async def use_invitation_code(code: str) -> InvitationCode:
        """
        使用邀请码（增加使用次数）
        
        Args:
            code: 邀请码
            
        Returns:
            InvitationCode: 邀请码对象
            
        Raises:
            ValidationError: 当邀请码不存在或无效时抛出
        """
        invitation_code = await InvitationCodeService.validate_invitation_code(code)
        invitation_code.use()
        await invitation_code.save()
        return invitation_code

