"""
设计评审服务模块

提供设计评审的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaipdm.models.design_review import DesignReview
from apps.kuaipdm.schemas.design_review_schemas import (
    DesignReviewCreate, DesignReviewUpdate, DesignReviewResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class DesignReviewService:
    """设计评审服务"""
    
    @staticmethod
    async def create_design_review(
        tenant_id: int,
        data: DesignReviewCreate
    ) -> DesignReviewResponse:
        """
        创建设计评审
        
        Args:
            tenant_id: 租户ID
            data: 评审创建数据
            
        Returns:
            DesignReviewResponse: 创建的评审对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await DesignReview.filter(
            tenant_id=tenant_id,
            review_no=data.review_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"评审编号 {data.review_no} 已存在")
        
        # 创建评审
        review = await DesignReview.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DesignReviewResponse.model_validate(review)
    
    @staticmethod
    async def get_design_review_by_uuid(
        tenant_id: int,
        review_uuid: str
    ) -> DesignReviewResponse:
        """
        根据UUID获取设计评审
        
        Args:
            tenant_id: 租户ID
            review_uuid: 评审UUID
            
        Returns:
            DesignReviewResponse: 评审对象
            
        Raises:
            NotFoundError: 当评审不存在时抛出
        """
        review = await DesignReview.filter(
            tenant_id=tenant_id,
            uuid=review_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not review:
            raise NotFoundError(f"设计评审 {review_uuid} 不存在")
        
        return DesignReviewResponse.model_validate(review)
    
    @staticmethod
    async def list_design_reviews(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        review_type: Optional[str] = None
    ) -> List[DesignReviewResponse]:
        """
        获取设计评审列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 评审状态（过滤）
            review_type: 评审类型（过滤）
            
        Returns:
            List[DesignReviewResponse]: 评审列表
        """
        query = DesignReview.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if review_type:
            query = query.filter(review_type=review_type)
        
        reviews = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [DesignReviewResponse.model_validate(review) for review in reviews]
    
    @staticmethod
    async def update_design_review(
        tenant_id: int,
        review_uuid: str,
        data: DesignReviewUpdate
    ) -> DesignReviewResponse:
        """
        更新设计评审
        
        Args:
            tenant_id: 租户ID
            review_uuid: 评审UUID
            data: 评审更新数据
            
        Returns:
            DesignReviewResponse: 更新后的评审对象
            
        Raises:
            NotFoundError: 当评审不存在时抛出
        """
        review = await DesignReview.filter(
            tenant_id=tenant_id,
            uuid=review_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not review:
            raise NotFoundError(f"设计评审 {review_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(review, key, value)
        
        await review.save()
        
        return DesignReviewResponse.model_validate(review)
    
    @staticmethod
    async def delete_design_review(
        tenant_id: int,
        review_uuid: str
    ) -> None:
        """
        删除设计评审（软删除）
        
        Args:
            tenant_id: 租户ID
            review_uuid: 评审UUID
            
        Raises:
            NotFoundError: 当评审不存在时抛出
        """
        review = await DesignReview.filter(
            tenant_id=tenant_id,
            uuid=review_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not review:
            raise NotFoundError(f"设计评审 {review_uuid} 不存在")
        
        review.deleted_at = datetime.utcnow()
        await review.save()
