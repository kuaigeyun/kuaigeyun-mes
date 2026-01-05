"""
模具管理服务模块

提供模具和模具使用记录的 CRUD 操作。

Author: Luigi Lu
Date: 2026-01-05
"""

from typing import List, Optional
from datetime import datetime
from tortoise.exceptions import IntegrityError

from apps.kuaizhizao.models.mold import Mold, MoldUsage
from apps.kuaizhizao.schemas.mold import (
    MoldCreate,
    MoldUpdate,
    MoldUsageCreate,
    MoldUsageUpdate,
)
from core.services.business.code_generation_service import CodeGenerationService
from infra.exceptions.exceptions import NotFoundError, ValidationError


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
                        rule_code="mold_code",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.code = f"MD{timestamp}"
            
            mold = Mold(
                tenant_id=tenant_id,
                **data.model_dump(exclude_none=True)
            )
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
        search: Optional[str] = None
    ) -> tuple[List[Mold], int]:
        """
        获取模具列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 模具类型（可选）
            status: 模具状态（可选）
            is_active: 是否启用（可选）
            search: 搜索关键词（可选，搜索编码、名称）
            
        Returns:
            tuple[List[Mold], int]: 模具列表和总数量
        """
        query = Mold.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 筛选条件
        if type:
            query = query.filter(type=type)
        if status:
            query = query.filter(status=status)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        # 搜索条件
        if search:
            query = query.filter(
                code__icontains=search
            ) | query.filter(
                name__icontains=search
            )
        
        # 获取总数量
        total = await query.count()
        
        # 获取列表
        molds = await query.offset(skip).limit(limit).order_by("-created_at")
        
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
        mold.deleted_at = datetime.now()
        await mold.save()


class MoldUsageService:
    """
    模具使用记录服务类
    
    提供模具使用记录的 CRUD 操作。
    """
    
    @staticmethod
    async def create_mold_usage(
        tenant_id: int,
        data: MoldUsageCreate,
        created_by: Optional[int] = None
    ) -> MoldUsage:
        """
        创建模具使用记录
        
        Args:
            tenant_id: 组织ID
            data: 模具使用记录创建数据
            created_by: 创建人ID（可选）
            
        Returns:
            MoldUsage: 创建的模具使用记录对象
            
        Raises:
            ValidationError: 当模具不存在或使用记录编号已存在时抛出
        """
        try:
            # 验证模具是否存在
            mold = await Mold.filter(
                tenant_id=tenant_id,
                uuid=data.mold_uuid,
                deleted_at__isnull=True
            ).first()
            
            if not mold:
                raise ValidationError(f"模具不存在: {data.mold_uuid}")
            
            # 如果没有提供使用记录编号，自动生成
            if not data.usage_no:
                try:
                    data.usage_no = await CodeGenerationService.generate_code(
                        tenant_id=tenant_id,
                        rule_code="mold_usage_code",
                        context=None
                    )
                except ValidationError:
                    # 如果编码规则不存在，使用默认编码格式
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    data.usage_no = f"MU{timestamp}"
            
            usage = MoldUsage(
                tenant_id=tenant_id,
                mold_id=mold.id,
                mold_uuid=mold.uuid,
                mold_name=mold.name,
                mold_code=mold.code,
                **data.model_dump(exclude_none=True, exclude={'mold_uuid'})
            )
            await usage.save()
            
            # 更新模具的累计使用次数
            mold.total_usage_count += data.usage_count
            await mold.save()
            
            return usage
        except IntegrityError:
            raise ValidationError(f"模具使用记录编号 {data.usage_no} 已存在")
    
    @staticmethod
    async def get_mold_usage_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> MoldUsage:
        """
        根据UUID获取模具使用记录
        
        Args:
            tenant_id: 组织ID
            uuid: 模具使用记录UUID
            
        Returns:
            MoldUsage: 模具使用记录对象
            
        Raises:
            NotFoundError: 当模具使用记录不存在时抛出
        """
        usage = await MoldUsage.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not usage:
            raise NotFoundError("模具使用记录不存在")
        
        return usage
    
    @staticmethod
    async def list_mold_usages(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        mold_uuid: Optional[str] = None,
        source_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> tuple[List[MoldUsage], int]:
        """
        获取模具使用记录列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            mold_uuid: 模具UUID（可选）
            source_type: 来源类型（可选）
            status: 使用状态（可选）
            search: 搜索关键词（可选，搜索使用记录编号）
            
        Returns:
            tuple[List[MoldUsage], int]: 模具使用记录列表和总数量
        """
        query = MoldUsage.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 筛选条件
        if mold_uuid:
            query = query.filter(mold_uuid=mold_uuid)
        if source_type:
            query = query.filter(source_type=source_type)
        if status:
            query = query.filter(status=status)
        
        # 搜索条件
        if search:
            query = query.filter(usage_no__icontains=search)
        
        # 获取总数量
        total = await query.count()
        
        # 获取列表
        usages = await query.offset(skip).limit(limit).order_by("-usage_date")
        
        return usages, total
    
    @staticmethod
    async def update_mold_usage(
        tenant_id: int,
        uuid: str,
        data: MoldUsageUpdate
    ) -> MoldUsage:
        """
        更新模具使用记录
        
        Args:
            tenant_id: 组织ID
            uuid: 模具使用记录UUID
            data: 模具使用记录更新数据
            
        Returns:
            MoldUsage: 更新后的模具使用记录对象
            
        Raises:
            NotFoundError: 当模具使用记录不存在时抛出
        """
        usage = await MoldUsageService.get_mold_usage_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True, exclude_none=True)
        
        # 如果更新了使用次数，需要更新模具的累计使用次数
        if 'usage_count' in update_data and update_data['usage_count'] != usage.usage_count:
            mold = await Mold.get(id=usage.mold_id)
            mold.total_usage_count = mold.total_usage_count - usage.usage_count + update_data['usage_count']
            await mold.save()
        
        # 更新字段
        for key, value in update_data.items():
            setattr(usage, key, value)
        
        await usage.save()
        return usage
    
    @staticmethod
    async def delete_mold_usage(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除模具使用记录（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 模具使用记录UUID
            
        Raises:
            NotFoundError: 当模具使用记录不存在时抛出
        """
        usage = await MoldUsageService.get_mold_usage_by_uuid(tenant_id, uuid)
        
        # 更新模具的累计使用次数
        mold = await Mold.get(id=usage.mold_id)
        mold.total_usage_count = max(0, mold.total_usage_count - usage.usage_count)
        await mold.save()
        
        # 软删除
        usage.deleted_at = datetime.now()
        await usage.save()

