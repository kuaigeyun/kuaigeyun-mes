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
    
    async def start_approval_flow(
        self,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        business_mode: Optional[str] = None,
        demand_type: Optional[str] = None
    ) -> ApprovalFlowResponse:
        """
        启动审核流程
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            entity_id: 实体ID
            business_mode: 业务模式（可选）
            demand_type: 需求类型（可选）
            
        Returns:
            ApprovalFlowResponse: 启动的审核流程
        """
        # 获取适用的审核流程
        flow = await self.get_approval_flow_for_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            business_mode=business_mode,
            demand_type=demand_type
        )
        
        if not flow:
            raise NotFoundError(f"未找到适用于 {entity_type} 的审核流程")
        
        # 检查是否已经启动过审核流程
        existing_record = await ApprovalRecord.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
            flow_id=flow.id
        ).first()
        
        if existing_record:
            raise BusinessLogicError(f"实体 {entity_type}:{entity_id} 已启动审核流程")
        
        return flow
    
    async def execute_approval(
        self,
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        approver_id: int,
        approver_name: str,
        approval_result: str,
        approval_comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        执行审核
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            entity_id: 实体ID
            approver_id: 审核人ID
            approver_name: 审核人姓名
            approval_result: 审核结果（通过/驳回）
            approval_comment: 审核意见（可选）
            
        Returns:
            Dict: 审核结果，包含流程状态、是否完成等信息
        """
        async with in_transaction():
            # 获取审核流程
            records = await ApprovalRecord.filter(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id
            ).order_by('-approval_time').all()
            
            if not records:
                raise NotFoundError(f"实体 {entity_type}:{entity_id} 未启动审核流程")
            
            # 获取流程信息
            flow_id = records[0].flow_id
            flow = await ApprovalFlow.get_or_none(id=flow_id)
            if not flow:
                raise NotFoundError(f"审核流程不存在: {flow_id}")
            
            # 获取流程步骤
            steps = await ApprovalFlowStep.filter(
                tenant_id=tenant_id,
                flow_id=flow_id
            ).order_by('step_order').all()
            
            if not steps:
                raise ValidationError(f"审核流程 {flow.flow_code} 没有配置步骤")
            
            # 确定当前步骤
            current_step = self._get_current_step(records, steps)
            if not current_step:
                raise BusinessLogicError("审核流程已完成或已驳回")
            
            # 验证审核人是否有权限审核当前步骤
            if not self._can_approve(current_step, approver_id):
                raise BusinessLogicError(f"审核人 {approver_name} 无权审核当前步骤")
            
            # 创建审核记录
            approval_record = await ApprovalRecord.create(
                tenant_id=tenant_id,
                entity_type=entity_type,
                entity_id=entity_id,
                flow_id=flow_id,
                flow_code=flow.flow_code,
                step_order=current_step.step_order,
                step_name=current_step.step_name,
                approver_id=approver_id,
                approver_name=approver_name,
                approval_result=approval_result,
                approval_comment=approval_comment,
                approval_time=datetime.now(),
                flow_status="进行中"
            )
            
            # 判断当前步骤是否完成
            step_completed = await self._check_step_completed(
                tenant_id, entity_id, current_step, records + [approval_record]
            )
            
            # 判断整个流程是否完成
            flow_completed = False
            flow_rejected = False
            
            if approval_result == "驳回":
                flow_rejected = True
                # 更新所有记录的状态为已驳回
                await ApprovalRecord.filter(
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    entity_id=entity_id
                ).update(flow_status="已驳回")
            elif step_completed:
                # 检查是否还有下一步
                next_step = self._get_next_step(current_step, steps)
                if not next_step:
                    # 流程完成
                    flow_completed = True
                    await ApprovalRecord.filter(
                        tenant_id=tenant_id,
                        entity_type=entity_type,
                        entity_id=entity_id
                    ).update(flow_status="已完成")
            
            return {
                "approval_record_id": approval_record.id,
                "step_completed": step_completed,
                "flow_completed": flow_completed,
                "flow_rejected": flow_rejected,
                "current_step": current_step.step_order if current_step else None,
                "next_step": next_step.step_order if step_completed and not flow_completed else None
            }
    
    def _get_current_step(
        self,
        records: List[ApprovalRecord],
        steps: List[ApprovalFlowStep]
    ) -> Optional[ApprovalFlowStep]:
        """获取当前审核步骤"""
        if not records:
            return steps[0] if steps else None
        
        # 检查是否有驳回的记录
        rejected_records = [r for r in records if r.approval_result == "驳回"]
        if rejected_records:
            return None  # 已驳回，无当前步骤
        
        # 检查已完成的最大步骤
        completed_steps = set(r.step_order for r in records if r.approval_result == "通过")
        
        # 找到第一个未完成的步骤
        for step in steps:
            if step.step_order not in completed_steps:
                return step
        
        return None  # 所有步骤都已完成
    
    def _get_next_step(
        self,
        current_step: ApprovalFlowStep,
        steps: List[ApprovalFlowStep]
    ) -> Optional[ApprovalFlowStep]:
        """获取下一步骤"""
        for step in steps:
            if step.step_order > current_step.step_order:
                return step
        return None
    
    def _can_approve(
        self,
        step: ApprovalFlowStep,
        approver_id: int
    ) -> bool:
        """检查审核人是否有权限审核当前步骤"""
        approver_config = step.approver_config
        
        # 如果配置了审核人ID列表
        if "approver_ids" in approver_config:
            approver_ids = approver_config["approver_ids"]
            if isinstance(approver_ids, list):
                return approver_id in approver_ids
        
        # 如果配置了角色
        if "roles" in approver_config:
            # TODO: 实现角色检查逻辑
            pass
        
        # 默认允许（实际应该根据业务规则配置）
        return True
    
    async def _check_step_completed(
        self,
        tenant_id: int,
        entity_id: int,
        step: ApprovalFlowStep,
        all_records: List[ApprovalRecord]
    ) -> bool:
        """检查步骤是否完成"""
        # 获取当前步骤的所有审核记录
        step_records = [
            r for r in all_records
            if r.step_order == step.step_order and r.approval_result == "通过"
        ]
        
        if step.approval_mode == "sequential":
            # 顺序审核：只需要一个通过即可
            return len(step_records) >= 1
        elif step.approval_mode == "parallel_all":
            # 会签：所有审核人都必须通过
            approver_ids = step.approver_config.get("approver_ids", [])
            if isinstance(approver_ids, list):
                approved_ids = set(r.approver_id for r in step_records)
                return approved_ids.issuperset(set(approver_ids))
        elif step.approval_mode == "parallel_any":
            # 或签：任意一个通过即可
            return len(step_records) >= 1
        
        return False
    
    async def get_approval_records(
        self,
        tenant_id: int,
        entity_type: str,
        entity_id: int
    ) -> List[Dict[str, Any]]:
        """
        获取审核历史记录
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            entity_id: 实体ID
            
        Returns:
            List[Dict]: 审核记录列表
        """
        records = await ApprovalRecord.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by('approval_time').all()
        
        result = []
        for record in records:
            result.append({
                "id": record.id,
                "uuid": str(record.uuid),
                "flow_id": record.flow_id,
                "flow_code": record.flow_code,
                "step_order": record.step_order,
                "step_name": record.step_name,
                "approver_id": record.approver_id,
                "approver_name": record.approver_name,
                "approval_result": record.approval_result,
                "approval_comment": record.approval_comment,
                "approval_time": record.approval_time.isoformat() if record.approval_time else None,
                "flow_status": record.flow_status,
            })
        
        return result
    
    async def get_approval_status(
        self,
        tenant_id: int,
        entity_type: str,
        entity_id: int
    ) -> Dict[str, Any]:
        """
        获取审核状态
        
        Args:
            tenant_id: 租户ID
            entity_type: 实体类型
            entity_id: 实体ID
            
        Returns:
            Dict: 审核状态信息
        """
        records = await ApprovalRecord.filter(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id
        ).order_by('-approval_time').all()
        
        if not records:
            return {
                "has_flow": False,
                "flow_status": None,
                "current_step": None,
                "records_count": 0
            }
        
        # 获取流程信息
        flow_id = records[0].flow_id
        flow = await ApprovalFlow.get_or_none(id=flow_id)
        
        if flow:
            steps = await ApprovalFlowStep.filter(
                tenant_id=tenant_id,
                flow_id=flow_id
            ).order_by('step_order').all()
            
            current_step = self._get_current_step(records, steps)
        else:
            current_step = None
        
        # 确定流程状态
        flow_status = records[0].flow_status if records else None
        
        return {
            "has_flow": True,
            "flow_id": flow_id,
            "flow_code": flow.flow_code if flow else None,
            "flow_name": flow.flow_name if flow else None,
            "flow_status": flow_status,
            "current_step": current_step.step_order if current_step else None,
            "current_step_name": current_step.step_name if current_step else None,
            "records_count": len(records),
            "is_completed": flow_status == "已完成",
            "is_rejected": flow_status == "已驳回"
        }
