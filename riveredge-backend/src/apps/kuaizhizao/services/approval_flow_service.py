"""
审核流程服务模块

提供审核流程配置和管理的业务逻辑。

Author: Luigi Lu
Date: 2025-01-14
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from loguru import logger

from apps.kuaizhizao.models.approval_flow import ApprovalFlow, ApprovalFlowStep, ApprovalRecord
from apps.kuaizhizao.schemas.approval_flow import (
    ApprovalFlowCreate,
    ApprovalFlowUpdate,
    ApprovalFlowResponse,
    ApprovalFlowStepResponse,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from tortoise.transactions import in_transaction


class ApprovalFlowService:
    """审核流程服务"""
    
    async def create_approval_flow(
        self,
        tenant_id: int,
        flow_data: ApprovalFlowCreate,
        created_by: int
    ) -> ApprovalFlowResponse:
        """
        创建审核流程
        
        Args:
            tenant_id: 租户ID
            flow_data: 流程数据
            created_by: 创建人ID
            
        Returns:
            ApprovalFlowResponse: 创建的流程响应
        """
        async with in_transaction():
            # 检查流程编码是否已存在
            existing = await ApprovalFlow.filter(
                tenant_id=tenant_id,
                flow_code=flow_data.flow_code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"流程编码 {flow_data.flow_code} 已存在")
            
            # 创建流程
            flow = await ApprovalFlow.create(
                tenant_id=tenant_id,
                flow_code=flow_data.flow_code,
                flow_name=flow_data.flow_name,
                entity_type=flow_data.entity_type,
                business_mode=flow_data.business_mode,
                demand_type=flow_data.demand_type,
                is_active=flow_data.is_active,
                description=flow_data.description,
                created_by=created_by,
            )
            
            # 创建流程步骤
            steps = []
            for step_data in flow_data.steps:
                step = await ApprovalFlowStep.create(
                    tenant_id=tenant_id,
                    flow_id=flow.id,
                    step_order=step_data.step_order,
                    step_name=step_data.step_name,
                    approval_mode=step_data.approval_mode,
                    approver_config=step_data.approver_config,
                    approval_conditions=step_data.approval_conditions,
                    is_required=step_data.is_required,
                    description=step_data.description,
                )
                steps.append(step)
            
            # 返回响应
            return await self._build_flow_response(flow, steps)
    
    async def get_approval_flow_by_id(
        self,
        tenant_id: int,
        flow_id: int
    ) -> ApprovalFlowResponse:
        """
        根据ID获取审核流程
        
        Args:
            tenant_id: 租户ID
            flow_id: 流程ID
            
        Returns:
            ApprovalFlowResponse: 流程响应
        """
        flow = await ApprovalFlow.get_or_none(tenant_id=tenant_id, id=flow_id)
        if not flow:
            raise NotFoundError(f"审核流程不存在: {flow_id}")
        
        steps = await ApprovalFlowStep.filter(
            tenant_id=tenant_id,
            flow_id=flow_id
        ).order_by('step_order').all()
        
        return await self._build_flow_response(flow, steps)
    
    async def _build_flow_response(
        self,
        flow: ApprovalFlow,
        steps: List[ApprovalFlowStep]
    ) -> ApprovalFlowResponse:
        """构建流程响应对象"""
        step_responses = [
            ApprovalFlowStepResponse.model_validate(step) for step in steps
        ]
        
        return ApprovalFlowResponse(
            id=flow.id,
            uuid=str(flow.uuid),
            tenant_id=flow.tenant_id,
            flow_code=flow.flow_code,
            flow_name=flow.flow_name,
            entity_type=flow.entity_type,
            business_mode=flow.business_mode,
            demand_type=flow.demand_type,
            is_active=flow.is_active,
            description=flow.description,
            created_at=flow.created_at,
            updated_at=flow.updated_at,
            created_by=flow.created_by,
            updated_by=flow.updated_by,
            steps=step_responses
        )
    
    async def list_approval_flows(
        self,
        tenant_id: int,
        entity_type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[ApprovalFlowResponse]:
        """
        获取审核流程列表
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型（可选）
            is_active: 是否启用（可选）
            
        Returns:
            List[ApprovalFlowResponse]: 流程列表
        """
        query = ApprovalFlow.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        
        if entity_type:
            query = query.filter(entity_type=entity_type)
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        flows = await query.order_by('-created_at').all()
        
        result = []
        for flow in flows:
            steps = await ApprovalFlowStep.filter(
                tenant_id=tenant_id,
                flow_id=flow.id
            ).order_by('step_order').all()
            result.append(await self._build_flow_response(flow, steps))
        
        return result
    
    async def get_approval_flow_for_entity(
        self,
        tenant_id: int,
        entity_type: str,
        business_mode: Optional[str] = None,
        demand_type: Optional[str] = None
    ) -> Optional[ApprovalFlowResponse]:
        """
        根据实体类型获取适用的审核流程
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            business_mode: 业务模式（可选）
            demand_type: 需求类型（可选）
            
        Returns:
            Optional[ApprovalFlowResponse]: 适用的流程，如果没有则返回None
        """
        # 查询启用的流程，按优先级匹配
        query = ApprovalFlow.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            is_active=True,
            deleted_at__isnull=True
        )
        
        flows = await query.all()
        
        # 匹配最精确的流程
        best_match = None
        best_score = 0
        
        for flow in flows:
            score = 0
            # 如果业务模式匹配，加分
            if business_mode and flow.business_mode == business_mode:
                score += 2
            # 如果需求类型匹配，加分
            if demand_type and flow.demand_type == demand_type:
                score += 2
            # 如果都没有指定，也匹配（通用流程）
            if not flow.business_mode and not flow.demand_type:
                score = 1
            
            if score > best_score:
                best_score = score
                best_match = flow
        
        if best_match:
            steps = await ApprovalFlowStep.filter(
                tenant_id=tenant_id,
                flow_id=best_match.id
            ).order_by('step_order').all()
            return await self._build_flow_response(best_match, steps)
        
        return None
