"""
审批实例管理服务模块

提供审批实例的 CRUD 操作和审批操作功能。
统一入口：start_approval、get_approval_status、execute_approval 供业务单据调用。
"""

import asyncio
from typing import Optional, List, Dict, Any, Union
from uuid import UUID
from datetime import datetime
from loguru import logger

from core.models.approval_history import ApprovalHistory

from tortoise.exceptions import IntegrityError

from core.models.approval_instance import ApprovalInstance
from core.models.approval_process import ApprovalProcess
from core.models.approval_task import ApprovalTask
from core.models.department import Department
from core.models.role import Role
from core.models.user_role import UserRole
from core.schemas.approval_instance import ApprovalInstanceCreate, ApprovalInstanceUpdate, ApprovalInstanceAction
from core.services.messaging.message_service import MessageService
from core.schemas.message_template import SendMessageRequest
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ApprovalInstanceService:
    """
    审批实例管理服务类
    
    提供审批实例的 CRUD 操作和审批操作功能。
    """
    
    @staticmethod
    async def create_approval_instance(
        tenant_id: int,
        user_id: int,
        data: ApprovalInstanceCreate
    ) -> ApprovalInstance:
        """
        创建审批实例（提交审批）
        
        Args:
            tenant_id: 组织ID
            user_id: 提交人ID
            data: 审批实例创建数据
            
        Returns:
            ApprovalInstance: 创建的审批实例对象
            
        Raises:
            ValidationError: 当流程不存在时抛出
        """
        # 获取审批流程
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            uuid=str(data.process_uuid),
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not process:
            raise NotFoundError("审批流程不存在或未启用")
        
        try:
            approval_instance = ApprovalInstance(
                tenant_id=tenant_id,
                process=process,
                title=data.title,
                content=data.content,
                data=data.data,
                status="pending",
                submitter_id=user_id,
                submitted_at=datetime.now()
            )
            await approval_instance.save()
            
            # 异步发送消息通知
            import asyncio
            asyncio.create_task(
                ApprovalInstanceService._send_approval_submitted_notification(
                    tenant_id=tenant_id,
                    approval_instance=approval_instance,
                    process=process
                )
            )
            
            # 触发审批工作流事件
            from core.inngest.client import inngest_client
            from inngest import Event
            
            try:
                await inngest_client.send(
                    Event(
                        name="approval/submit",
                        data={
                            "tenant_id": tenant_id,
                            "approval_id": str(approval_instance.uuid),
                            "process_id": str(process.uuid),
                        }
                    )
                )
            except Exception as e:
                # 如果 Inngest 事件发送失败，记录错误但不影响审批实例创建
                from loguru import logger
                logger.error(f"发送审批工作流事件失败: {e}")
            
            return approval_instance
        except IntegrityError:
            raise ValidationError("创建审批实例失败")

    # ========== 统一入口：供业务单据调用 ==========

    @staticmethod
    async def start_approval(
        tenant_id: int,
        user_id: int,
        process_code: str,
        entity_type: str,
        entity_id: int,
        entity_uuid: str,
        title: str,
        content: Optional[str] = None,
    ) -> Optional[ApprovalInstance]:
        """
        按 process_code 启动审批流程（统一入口）

        若流程不存在则返回 None，调用方走简单审核；若流程存在则创建实例并返回。

        Args:
            tenant_id: 租户ID
            user_id: 提交人ID
            process_code: 流程代码（如 demand_approval、purchase_order_approval、sales_order_approval）
            entity_type: 实体类型
            entity_id: 实体ID
            entity_uuid: 实体UUID
            title: 审批标题
            content: 审批内容（可选）

        Returns:
            ApprovalInstance 或 None（流程不存在时）
        """
        process = await ApprovalProcess.filter(
            tenant_id=tenant_id,
            code=process_code,
            is_active=True,
            deleted_at__isnull=True,
        ).first()

        if not process:
            return None

        data = ApprovalInstanceCreate(
            process_uuid=str(process.uuid),
            title=title,
            content=content or "",
            data={
                "entity_type": entity_type,
                "entity_id": entity_id,
                "entity_uuid": entity_uuid,
            },
        )
        return await ApprovalInstanceService.create_approval_instance(
            tenant_id=tenant_id, user_id=user_id, data=data
        )

    @staticmethod
    async def get_approval_status(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
    ) -> Dict[str, Any]:
        """
        按 entity_type + entity_id 获取审批状态（统一入口）

        Returns:
            {
                has_flow: bool,
                status: str | None,  # pending | approved | rejected | cancelled
                current_node: str | None,
                tasks: list,
                history: list,
            }
        """
        # 查询 data 中包含 entity_type 和 entity_id 的实例（最近一条）
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(100)

        instance = None
        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and d.get("entity_id") == entity_id:
                instance = inst
                break

        if not instance:
            return {"has_flow": False, "status": None, "current_node": None, "tasks": [], "history": []}

        tasks = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
        ).order_by("-created_at").all()

        history = await ApprovalHistory.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
        ).order_by("action_at").all()

        return {
            "has_flow": True,
            "status": instance.status,
            "current_node": instance.current_node,
            "current_approver_id": instance.current_approver_id,
            "tasks": [
                {
                    "uuid": str(t.uuid),
                    "node_id": t.node_id,
                    "approver_id": t.approver_id,
                    "status": t.status,
                    "action_at": t.action_at.isoformat() if t.action_at else None,
                    "comment": t.comment,
                }
                for t in tasks
            ],
            "history": [
                {
                    "action": h.action,
                    "action_by": h.action_by,
                    "action_at": h.action_at.isoformat() if h.action_at else None,
                    "comment": h.comment,
                }
                for h in history
            ],
        }

    @staticmethod
    async def execute_approval(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        approver_id: int,
        approved: bool,
        comment: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        按 entity 执行审批（统一入口）

        查找该 entity 的待办任务，调用 perform_task_action。

        Returns:
            {"success": bool, "flow_completed": bool, "flow_rejected": bool, "instance": ApprovalInstance}
        """
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            status="pending",
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(100)

        instance = None
        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and d.get("entity_id") == entity_id:
                instance = inst
                break

        if not instance:
            raise NotFoundError(f"实体 {entity_type}:{entity_id} 未找到待审批的流程实例")

        task = await ApprovalTask.filter(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            approver_id=approver_id,
            status="pending",
        ).first()

        if not task:
            raise ValidationError("您没有该审批任务或任务已处理")

        action = ApprovalInstanceAction(
            action="approve" if approved else "reject",
            comment=comment,
        )
        updated = await ApprovalInstanceService.perform_task_action(
            tenant_id=tenant_id,
            task_uuid=str(task.uuid),
            user_id=approver_id,
            action_data=action,
        )

        return {
            "success": True,
            "flow_completed": updated.status in ("approved", "rejected"),
            "flow_rejected": updated.status == "rejected",
            "instance": updated,
        }

    @staticmethod
    async def cancel_approval(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
        operator_id: int,
    ) -> bool:
        """
        取消/撤回审批流程（统一入口）
        若存在待审批的实例则取消，返回 True；否则返回 False。
        """
        instance = await ApprovalInstanceService.get_instance_by_entity(
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        if not instance or instance.status != "pending":
            return False
        instance.status = "cancelled"
        instance.completed_at = datetime.now()
        instance.current_node = None
        instance.current_approver_id = None
        await instance.save()
        logger.info(f"审批流程已取消: {entity_type}:{entity_id}")
        return True

    @staticmethod
    async def get_instance_by_entity(
        tenant_id: int,
        entity_type: str,
        entity_id: int,
    ) -> Optional[ApprovalInstance]:
        """按 entity 查找审批实例（最近一条）"""
        instances = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).prefetch_related("process").order_by("-created_at").limit(100)

        for inst in instances:
            d = inst.data or {}
            if d.get("entity_type") == entity_type and d.get("entity_id") == entity_id:
                return inst
        return None

    @staticmethod
    async def get_approval_instance_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> ApprovalInstance:
        """
        根据UUID获取审批实例
        
        Args:
            tenant_id: 组织ID
            uuid: 审批实例UUID
            
        Returns:
            ApprovalInstance: 审批实例对象
            
        Raises:
            NotFoundError: 当审批实例不存在时抛出
        """
        approval_instance = await ApprovalInstance.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).prefetch_related("process").first()
        
        if not approval_instance:
            raise NotFoundError("审批实例不存在")
        
        return approval_instance
    
    @staticmethod
    async def list_approval_instances(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        submitter_id: Optional[int] = None,
        current_approver_id: Optional[int] = None
    ) -> List[ApprovalInstance]:
        """
        获取审批实例列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            status: 审批状态筛选
            submitter_id: 提交人ID筛选
            current_approver_id: 当前审批人ID筛选
            
        Returns:
            List[ApprovalInstance]: 审批实例列表
        """
        query = ApprovalInstance.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        
        if submitter_id:
            query = query.filter(submitter_id=submitter_id)
        
        if current_approver_id:
            query = query.filter(current_approver_id=current_approver_id)
        
        return await query.prefetch_related("process").order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_approval_instance(
        tenant_id: int,
        uuid: str,
        data: ApprovalInstanceUpdate
    ) -> ApprovalInstance:
        """
        更新审批实例
        
        Args:
            tenant_id: 组织ID
            uuid: 审批实例UUID
            data: 审批实例更新数据
            
        Returns:
            ApprovalInstance: 更新后的审批实例对象
            
        Raises:
            NotFoundError: 当审批实例不存在时抛出
        """
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(approval_instance, key, value)
        
        await approval_instance.save()
        return approval_instance
    
    @staticmethod
    async def delete_approval_instance(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除审批实例（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 审批实例UUID
            
        Raises:
            NotFoundError: 当审批实例不存在时抛出
        """
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, uuid)
        approval_instance.deleted_at = datetime.now()
        await approval_instance.save()
    
    @staticmethod
    async def perform_task_action(
        tenant_id: int,
        task_uuid: str,
        user_id: int,
        action_data: ApprovalInstanceAction
    ) -> ApprovalInstance:
        """
        执行审批任务操作（同意、拒绝、转交）
        
        Args:
            tenant_id: 组织ID
            task_uuid: 审批任务UUID
            user_id: 操作人ID
            action_data: 审批操作数据
            
        Returns:
            ApprovalInstance: 更新后的审批实例对象
        """
        # 获取任务
        task = await ApprovalTask.filter(
            tenant_id=tenant_id,
            uuid=task_uuid,
            approver_id=user_id,
            status="pending"
        ).prefetch_related("approval_instance__process").first()
        
        if not task:
            raise NotFoundError("任务不存在或已处理")
            
        instance = task.approval_instance
        if instance.status != "pending":
            raise ValidationError("审批流程已结束")
            
        # 更新任务状态
        task.status = "approved" if action_data.action == "approve" else "rejected"
        task.action_at = datetime.now()
        task.comment = action_data.comment
        await task.save()
        
        # 记录审批历史
        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=instance.id,
            action=action_data.action,
            action_by=user_id,
            comment=action_data.comment,
            from_node=instance.current_node,
            to_node=instance.current_node,
            from_approver_id=user_id,
            to_approver_id=None
        )
        
        # 检查节点是否完成
        node_completed, instance_status = await ApprovalInstanceService._check_node_completion(instance, action_data.action)
        
        if node_completed:
            if instance_status == "rejected":
                # 全盘拒绝
                instance.status = "rejected"
                instance.completed_at = datetime.now()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                
                # 取消该节点其他待办任务
                await ApprovalTask.filter(
                    approval_instance_id=instance.id,
                    node_id=instance.current_node,
                    status="pending"
                ).update(status="cancelled")
            else:
                # 节点通过，寻找下一个节点
                next_node = ApprovalInstanceService._get_next_node(
                    instance.process.nodes, instance.current_node, instance=instance
                )
                if not next_node:
                    instance.status = "approved"
                    instance.completed_at = datetime.now()
                    instance.current_node = None
                    instance.current_approver_id = None
                    await instance.save()
                else:
                    next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
                    if next_type == "end":
                        instance.status = "approved"
                        instance.completed_at = datetime.now()
                        instance.current_node = None
                        instance.current_approver_id = None
                        await instance.save()
                    else:
                        instance.current_node = next_node.get("id")
                        await instance.save()
                        await ApprovalInstanceService._create_node_tasks(tenant_id, instance, next_node)
            
            # 触发业务回调
            if instance.status in ["approved", "rejected"]:
                await ApprovalInstanceService._handle_approval_completion(tenant_id, instance)

        return instance

    @staticmethod
    async def _create_node_tasks(tenant_id: int, instance: ApprovalInstance, node: dict) -> List[ApprovalTask]:
        """
        为节点创建审批任务。start/end 不建任务；condition 不建任务，按条件选边后递归下一节点；cc 不建任务，发通知并推进到下一节点再递归。
        """
        node_type = node.get("type") or (node.get("data") or {}).get("type")
        node_id = node.get("id")

        if node_type == "start" or node_type == "end":
            return []

        if node_type == "condition":
            # 条件节点：不创建任务，按 instance.data 与节点 conditions 选一条出边，推进到下一节点再递归
            nodes_config = (instance.process.nodes or {}) if instance.process else {}
            next_node = ApprovalInstanceService._get_next_node(
                nodes_config, node_id, instance=instance
            )
            if not next_node:
                instance.status = "approved"
                instance.completed_at = datetime.now()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
            if next_type == "end":
                instance.status = "approved"
                instance.completed_at = datetime.now()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            instance.current_node = next_node.get("id")
            await instance.save()
            return await ApprovalInstanceService._create_node_tasks(tenant_id, instance, next_node)

        if node_type == "cc":
            # 抄送节点：不创建审批任务，可选通知抄送人，然后推进到下一节点
            try:
                approvers = await ApprovalInstanceService._resolve_node_approvers(node, instance)
                if approvers:
                    asyncio.create_task(
                        ApprovalInstanceService._send_cc_notification(
                            tenant_id=tenant_id,
                            instance=instance,
                            node=node,
                            approver_ids=approvers,
                        )
                    )
            except Exception as e:
                logger.warning("抄送通知发送失败: %s", e)
            next_node = ApprovalInstanceService._get_next_node(
                instance.process.nodes, node_id, instance=instance
            )
            if not next_node:
                instance.status = "approved"
                instance.completed_at = datetime.now()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            next_type = next_node.get("type") or (next_node.get("data") or {}).get("type")
            if next_type == "end":
                instance.status = "approved"
                instance.completed_at = datetime.now()
                instance.current_node = None
                instance.current_approver_id = None
                await instance.save()
                return []
            instance.current_node = next_node.get("id")
            await instance.save()
            return await ApprovalInstanceService._create_node_tasks(tenant_id, instance, next_node)

        approvers = await ApprovalInstanceService._resolve_node_approvers(node, instance)
        tasks = []
        for approver_id in approvers:
            task = await ApprovalTask.create(
                tenant_id=tenant_id,
                approval_instance=instance,
                node_id=node_id,
                approver_id=approver_id,
                status="pending",
            )
            tasks.append(task)

        if approvers:
            instance.current_approver_id = approvers[0]
            await instance.save()

        return tasks

    @staticmethod
    async def _resolve_approver_ids_from_identifiers(
        tenant_id: int,
        identifiers: List[Union[str, int]],
        by_uuid: bool,
    ) -> List[int]:
        """
        将审批人标识（UUID 或 user id）解析为 User.id 列表。
        by_uuid=True 时 identifiers 为 UUID 字符串，否则为 int user id。
        """
        if not identifiers:
            return []
        ids: List[int] = []
        for x in identifiers:
            if x is None:
                continue
            if by_uuid:
                try:
                    u = await User.filter(
                        tenant_id=tenant_id,
                        uuid=str(x).strip(),
                        deleted_at__isnull=True,
                        is_active=True,
                    ).first()
                    if u:
                        ids.append(u.id)
                except Exception:
                    pass
            else:
                try:
                    uid = int(x)
                    if uid > 0:
                        ids.append(uid)
                except (TypeError, ValueError):
                    pass
        return list(dict.fromkeys(ids))  # 去重保持顺序

    @staticmethod
    async def _resolve_node_approvers(node: dict, instance: ApprovalInstance) -> List[int]:
        """
        解析节点审批人。兼容前端 camelCase（approverType, approverIds）与后端 snake_case。
        支持：user（指定用户）、role（角色）、department（部门负责人）、manager（直属上级，用部门负责人）。
        """
        node_data = node.get("data", {})
        approver_type = (
            node_data.get("approverType")
            or node_data.get("approver_type")
            or "user"
        )
        approver_ids_raw = (
            node_data.get("approverIds")
            or node_data.get("approver_ids")
            or node_data.get("user_ids")
            or []
        )
        if not approver_ids_raw and "approver_id" in node_data:
            approver_ids_raw = [node_data["approver_id"]]

        tenant_id = instance.tenant_id
        submitter_id = instance.submitter_id

        if approver_type == "user":
            # 支持 UUID 或 user id
            is_uuid = all(
                isinstance(x, str) and len(str(x).strip()) >= 32
                for x in approver_ids_raw if x is not None
            )
            ids = await ApprovalInstanceService._resolve_approver_ids_from_identifiers(
                tenant_id, approver_ids_raw or [], by_uuid=is_uuid
            )
            if ids:
                return ids
            return [submitter_id]

        if approver_type == "role":
            # approverIds 存角色 UUID，解析该角色下所有用户
            try:
                role_uuids = [str(x).strip() for x in approver_ids_raw if x]
                if not role_uuids:
                    return [submitter_id]
                roles = await Role.filter(
                    tenant_id=tenant_id,
                    uuid__in=role_uuids,
                    deleted_at__isnull=True,
                    is_active=True,
                ).all()
                if not roles:
                    logger.warning("审批节点配置的角色未找到，回退到提交人")
                    return [submitter_id]
                role_ids = [r.id for r in roles]
                ur = await UserRole.filter(role_id__in=role_ids).values_list("user_id", flat=True)
                user_ids = list(dict.fromkeys(ur))
                if user_ids:
                    return user_ids
            except Exception as e:
                logger.warning("解析角色审批人失败: %s，回退到提交人", e)
            return [submitter_id]

        if approver_type == "department":
            # 提交人所在部门的负责人
            try:
                submitter = await User.filter(
                    id=submitter_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if submitter and getattr(submitter, "department_id", None):
                    dept = await Department.filter(
                        id=submitter.department_id,
                        tenant_id=tenant_id,
                        deleted_at__isnull=True,
                    ).first()
                    if dept and getattr(dept, "manager_id", None):
                        return [dept.manager_id]
            except Exception as e:
                logger.warning("解析部门负责人失败: %s，回退到提交人", e)
            return [submitter_id]

        if approver_type == "manager":
            # 直属上级：中小企业实践用部门负责人
            try:
                submitter = await User.filter(
                    id=submitter_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if submitter and getattr(submitter, "department_id", None):
                    dept = await Department.filter(
                        id=submitter.department_id,
                        tenant_id=tenant_id,
                        deleted_at__isnull=True,
                    ).first()
                    if dept and getattr(dept, "manager_id", None):
                        return [dept.manager_id]
            except Exception as e:
                logger.warning("解析直属上级失败: %s，回退到提交人", e)
            return [submitter_id]

        # optional 等未实现类型回退到提交人
        return [submitter_id]

    @staticmethod
    async def _check_node_completion(instance: ApprovalInstance, last_action: str) -> (bool, str):
        """
        检查节点是否完成
        返回: (是否完成, 建议状态)
        """
        node_id = instance.current_node
        process_nodes = instance.process.nodes or {}
        
        # 查找当前节点配置
        current_node_config = None
        for node in process_nodes.get("nodes", []):
            if node.get("id") == node_id:
                current_node_config = node
                break
                
        if not current_node_config:
            return True, "approved"

        data = current_node_config.get("data", {})
        approval_type = data.get("approvalType") or data.get("approval_type") or "OR"  # AND 会签, OR 或签
        
        # 获取该节点所有任务
        tasks = await ApprovalTask.filter(approval_instance=instance, node_id=node_id).all()
        
        if last_action == "reject":
            return True, "rejected" # 只要有一个拒绝，立即节点拒绝
            
        if approval_type == "OR":
            # 或签：只要有一个同意，即完成
            if any(t.status == "approved" for t in tasks):
                return True, "approved"
        else:
            # 会签：所有人都必须同意
            if all(t.status == "approved" for t in tasks):
                return True, "approved"
                
        return False, "pending"

    @staticmethod
    async def perform_approval_action(
        tenant_id: int,
        uuid: str,
        user_id: int,
        action: ApprovalInstanceAction
    ) -> ApprovalInstance:
        """执行审批操作（兼容旧接口）"""
        approval_instance = await ApprovalInstanceService.get_approval_instance_by_uuid(tenant_id, uuid)
        
        # 兼容逻辑：如果系统已生成任务，则转发到任务处理函数
        tasks_count = await ApprovalTask.filter(tenant_id=tenant_id, approval_instance_id=approval_instance.id, status="pending").count()
        if tasks_count > 0:
            task = await ApprovalTask.filter(tenant_id=tenant_id, approval_instance_id=approval_instance.id, approver_id=user_id, status="pending").first()
            if task:
                return await ApprovalInstanceService.perform_task_action(tenant_id, str(task.uuid), user_id, action)
            raise ValidationError("您没有该审批的任务")
            
        # 验证操作权限（仅针对无任务系统的情况）
        if approval_instance.status != "pending":
            raise ValidationError("审批实例已完成，无法操作")
        
        if approval_instance.current_approver_id != user_id:
            raise ValidationError("您不是当前审批人，无法操作")
            
        # 记录操作前的状态用于后续通知和历史
        old_node = approval_instance.current_node
        old_approver_id = approval_instance.current_approver_id
        old_status = approval_instance.status
        old_current_approver_id = approval_instance.current_approver_id
        
        # 获取审批流程
        await approval_instance.fetch_related('process')
        process = approval_instance.process
        
        # 执行操作
        if action.action == "approve":
            next_node = ApprovalInstanceService._get_next_node(
                process.nodes, approval_instance.current_node, instance=approval_instance
            )
            if next_node:
                approval_instance.current_node = next_node.get("id")
                approval_instance.current_approver_id = ApprovalInstanceService._get_node_approver(next_node, approval_instance)
                approval_instance.status = "pending"
            else:
                approval_instance.status = "approved"
                approval_instance.completed_at = datetime.now()
                approval_instance.current_node = None
                approval_instance.current_approver_id = None
        elif action.action == "reject":
            approval_instance.status = "rejected"
            approval_instance.completed_at = datetime.now()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action.action == "cancel":
            approval_instance.status = "cancelled"
            approval_instance.completed_at = datetime.now()
            approval_instance.current_node = None
            approval_instance.current_approver_id = None
        elif action.action == "transfer":
            if not action.transfer_to_user_id:
                raise ValidationError("转交操作必须指定目标用户")
            approval_instance.current_approver_id = action.transfer_to_user_id
        
        await approval_instance.save()
        
        # 记录审批历史
        await ApprovalInstanceService._create_approval_history(
            tenant_id=tenant_id,
            approval_instance_id=approval_instance.id,
            action=action.action,
            action_by=user_id,
            comment=action.comment,
            from_node=old_node,
            to_node=approval_instance.current_node,
            from_approver_id=old_approver_id,
            to_approver_id=approval_instance.current_approver_id
        )
        
        # 如果审批完成（approved/rejected），触发业务回调
        if approval_instance.status in ["approved", "rejected"]:
            await ApprovalInstanceService._handle_approval_completion(
                tenant_id=tenant_id,
                approval_instance=approval_instance
            )
        
        # 异步发送消息通知
        import asyncio
        asyncio.create_task(
            ApprovalInstanceService._send_approval_action_notification(
                tenant_id=tenant_id,
                approval_instance=approval_instance,
                action=action,
                user_id=user_id,
                old_status=old_status,
                old_current_approver_id=old_current_approver_id
            )
        )
        
        # 触发审批操作事件
        from core.inngest.client import inngest_client
        from inngest import Event
        
        try:
            event_data = {
                "tenant_id": tenant_id,
                "approval_id": str(approval_instance.uuid),
                "action": action.action,
                "user_id": user_id,
            }
            if action.comment:
                event_data["comment"] = action.comment
            if action.transfer_to_user_id:
                event_data["transfer_to_user_id"] = action.transfer_to_user_id
            
            await inngest_client.send(
                Event(
                    name="approval/action",
                    data=event_data
                )
            )
        except Exception as e:
            # 如果 Inngest 事件发送失败，记录错误但不影响审批操作
            from loguru import logger
            logger.error(f"发送审批操作事件失败: {e}")
        
        return approval_instance

    @staticmethod
    async def _send_cc_notification(
        tenant_id: int,
        instance: ApprovalInstance,
        node: dict,
        approver_ids: List[int],
    ) -> None:
        """抄送节点：给抄送人发站内/邮件通知（可选）。"""
        try:
            await instance.fetch_related("process")
            process = instance.process
            node_label = (node.get("data") or {}).get("label") or "抄送"
            for uid in approver_ids[:50]:  # 限制人数
                u = await User.filter(
                    id=uid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                ).first()
                if u and getattr(u, "email", None):
                    await MessageService.send_message(
                        tenant_id=tenant_id,
                        request=SendMessageRequest(
                            type="internal",
                            recipient=u.email,
                            subject=f"抄送：{instance.title}",
                            content=f"您被抄送审批「{instance.title}」，节点：{node_label}，流程：{process.name}。",
                        ),
                    )
        except Exception as e:
            logger.warning("抄送通知失败: %s", e)

    @staticmethod
    async def _send_approval_submitted_notification(
        tenant_id: int,
        approval_instance: ApprovalInstance,
        process: ApprovalProcess
    ) -> None:
        """
        发送审批提交通知
        
        Args:
            tenant_id: 组织ID
            approval_instance: 审批实例
            process: 审批流程
        """
        try:
            # 获取提交人信息
            submitter = await User.filter(
                id=approval_instance.submitter_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not submitter or not submitter.email:
                return
            
            # 发送消息给提交人
            await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=submitter.email,
                    subject=f"审批已提交：{approval_instance.title}",
                    content=f"您提交的审批「{approval_instance.title}」已成功提交，流程：{process.name}。请等待审批。",
                )
            )
            
            # 如果有当前审批人，发送消息给审批人
            if approval_instance.current_approver_id:
                approver = await User.filter(
                    id=approval_instance.current_approver_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if approver and approver.email:
                    await MessageService.send_message(
                        tenant_id=tenant_id,
                        request=SendMessageRequest(
                            type="internal",
                            recipient=approver.email,
                            subject=f"待审批：{approval_instance.title}",
                            content=f"您有一个待审批的申请：{approval_instance.title}，提交人：{submitter.full_name or submitter.username}，流程：{process.name}。",
                        )
                    )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"发送审批提交通知失败: {str(e)}")
    
    @staticmethod
    async def _send_approval_action_notification(
        tenant_id: int,
        approval_instance: ApprovalInstance,
        action: ApprovalInstanceAction,
        user_id: int,
        old_status: str,
        old_current_approver_id: Optional[int]
    ) -> None:
        """
        发送审批操作通知
        
        Args:
            tenant_id: 组织ID
            approval_instance: 审批实例
            action: 审批操作
            user_id: 操作人ID
            old_status: 旧状态
            old_current_approver_id: 旧审批人ID
        """
        try:
            await approval_instance.fetch_related('process')
            process = approval_instance.process
            
            # 获取提交人信息
            submitter = await User.filter(
                id=approval_instance.submitter_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not submitter or not submitter.email:
                return
            
            # 获取操作人信息
            operator = await User.filter(
                id=user_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            # 根据操作类型发送不同的消息
            action_text = {
                "approve": "已通过",
                "reject": "已拒绝",
                "cancel": "已取消",
                "transfer": "已转交"
            }.get(action.action, action.action)
            
            # 发送消息给提交人
            comment_text = f"，备注：{action.comment}" if action.comment else ""
            operator_name = operator.full_name or operator.username if operator else "系统"
            
            await MessageService.send_message(
                tenant_id=tenant_id,
                request=SendMessageRequest(
                    type="internal",
                    recipient=submitter.email,
                    subject=f"审批{action_text}：{approval_instance.title}",
                    content=f"您的审批「{approval_instance.title}」已被{operator_name}{action_text}{comment_text}。流程：{process.name}。",
                )
            )
            
            # 如果审批完成（approved/rejected/cancelled），发送完成通知
            if approval_instance.status in ["approved", "rejected", "cancelled"]:
                status_text = {
                    "approved": "已通过",
                    "rejected": "已拒绝",
                    "cancelled": "已取消"
                }.get(approval_instance.status, approval_instance.status)
                
                await MessageService.send_message(
                    tenant_id=tenant_id,
                    request=SendMessageRequest(
                        type="internal",
                        recipient=submitter.email,
                        subject=f"审批完成：{approval_instance.title}",
                        content=f"您的审批「{approval_instance.title}」已完成，结果：{status_text}。流程：{process.name}。",
                    )
                )
            
            # 如果有新的审批人（转交或进入下一节点），发送消息给新审批人
            if approval_instance.current_approver_id and \
               approval_instance.current_approver_id != old_current_approver_id and \
               approval_instance.status == "pending":
                new_approver = await User.filter(
                    id=approval_instance.current_approver_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if new_approver and new_approver.email:
                    await MessageService.send_message(
                        tenant_id=tenant_id,
                        request=SendMessageRequest(
                            type="internal",
                            recipient=new_approver.email,
                            subject=f"待审批：{approval_instance.title}",
                            content=f"您有一个待审批的申请：{approval_instance.title}，提交人：{submitter.full_name or submitter.username}，流程：{process.name}。",
                        )
                    )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"发送审批操作通知失败: {str(e)}")
    
    @staticmethod
    def _evaluate_conditions(instance: ApprovalInstance, conditions: List[Dict[str, Any]]) -> int:
        """
        按顺序评估条件，返回第一条满足条件的下标；若无满足则返回 0（默认第一条出边）。
        条件项：{ "field": str, "operator": str, "value": any }，instance.data 提供字段值。
        """
        if not conditions:
            return 0
        data = instance.data or {}
        for i, cond in enumerate(conditions):
            if not isinstance(cond, dict):
                continue
            field = cond.get("field")
            operator = cond.get("operator")
            value = cond.get("value")
            if field is None:
                continue
            actual = data.get(field)
            try:
                if operator == "==" or operator == "eq":
                    if actual == value or str(actual) == str(value):
                        return i
                elif operator == "!=" or operator == "ne":
                    if actual != value and str(actual) != str(value):
                        return i
                elif operator in (">", "gt"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual > value:
                                return i
                elif operator in ("<", "lt"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual < value:
                                return i
                elif operator in (">=", "gte"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual >= value:
                                return i
                elif operator in ("<=", "lte"):
                    if actual is not None and value is not None:
                        if (isinstance(actual, (int, float)) and isinstance(value, (int, float))) or (
                            isinstance(actual, str) and isinstance(value, str)
                        ):
                            if actual <= value:
                                return i
                elif operator == "contains":
                    if value is not None and actual is not None and str(value) in str(actual):
                        return i
            except (TypeError, ValueError):
                continue
        return 0

    @staticmethod
    def _get_start_node(nodes: dict) -> Optional[dict]:
        """
        获取起始节点。支持 ProFlow 格式：nodes = { "nodes": [...], "edges": [...] }。
        """
        if not nodes:
            return None
        node_list = nodes.get("nodes", [])
        if not node_list:
            return None
        for node in node_list:
            if not isinstance(node, dict):
                continue
            if node.get("type") == "start" or node.get("id") == "start":
                return node
        return node_list[0] if node_list else None

    @staticmethod
    def _get_next_node(
        nodes: dict,
        current_node_id: Optional[str],
        instance: Optional[ApprovalInstance] = None,
    ) -> Optional[dict]:
        """
        获取下一个节点。支持 ProFlow 格式；当前节点为 condition 时按 instance.data 与 conditions 选边。
        """
        if not nodes or not current_node_id:
            return None
        node_list = nodes.get("nodes", [])
        edges = nodes.get("edges", []) or []
        out_edges = [e for e in edges if isinstance(e, dict) and e.get("source") == current_node_id]
        if not out_edges:
            return None

        current_node = next((n for n in node_list if isinstance(n, dict) and n.get("id") == current_node_id), None)
        node_type = (current_node or {}).get("type") if isinstance(current_node, dict) else None

        # 条件节点：按条件选一条出边
        if node_type == "condition" and instance and current_node:
            data = current_node.get("data", {})
            conditions = data.get("conditions") or data.get("condition_list") or []
            edge_index = ApprovalInstanceService._evaluate_conditions(instance, conditions)
            if 0 <= edge_index < len(out_edges):
                next_node_id = out_edges[edge_index].get("target")
            else:
                next_node_id = out_edges[0].get("target")
        else:
            next_node_id = out_edges[0].get("target")

        if not next_node_id:
            return None
        next_node = next((n for n in node_list if isinstance(n, dict) and n.get("id") == next_node_id), None)
        return next_node
    
    @staticmethod
    def _get_node_approver(node: dict, approval_instance: ApprovalInstance) -> Optional[int]:
        """
        获取节点审批人
        
        Args:
            node: 节点配置
            approval_instance: 审批实例
            
        Returns:
            Optional[int]: 审批人ID
        """
        if not isinstance(node, dict):
            return None
        
        # 从节点配置中获取审批人
        approver_config = node.get("approver", {})
        if isinstance(approver_config, dict):
            # 支持多种审批人配置方式
            if "user_id" in approver_config:
                return approver_config["user_id"]
            elif "role_id" in approver_config:
                # TODO: 根据角色获取用户
                pass
            elif "department_id" in approver_config:
                # TODO: 根据部门获取用户
                pass
        
        # 如果节点配置中没有审批人，使用提交人作为默认审批人（临时方案）
        return approval_instance.submitter_id
    
    @staticmethod
    async def _create_approval_history(
        tenant_id: int,
        approval_instance_id: int,
        action: str,
        action_by: int,
        comment: Optional[str] = None,
        from_node: Optional[str] = None,
        to_node: Optional[str] = None,
        from_approver_id: Optional[int] = None,
        to_approver_id: Optional[int] = None
    ) -> None:
        """
        创建审批历史记录
        
        Args:
            tenant_id: 组织ID
            approval_instance_id: 审批实例ID
            action: 操作类型
            action_by: 操作人ID
            comment: 审批意见
            from_node: 来源节点
            to_node: 目标节点
            from_approver_id: 原审批人ID
            to_approver_id: 新审批人ID
        """
        try:
            await ApprovalHistory.create(
                tenant_id=tenant_id,
                approval_instance_id=approval_instance_id,
                action=action,
                action_by=action_by,
                action_at=datetime.now(),
                comment=comment,
                from_node=from_node,
                to_node=to_node,
                from_approver_id=from_approver_id,
                to_approver_id=to_approver_id
            )
        except Exception as e:
            # 记录历史失败不影响审批操作
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"创建审批历史记录失败: {str(e)}")
    
    @staticmethod
    async def _handle_approval_completion(
        tenant_id: int,
        approval_instance: ApprovalInstance
    ) -> None:
        """
        处理审批完成后的业务回调（统一处理 demand、purchase_order、sales_order）
        """
        try:
            data = approval_instance.data or {}
            entity_type = data.get("entity_type")
            entity_id = data.get("entity_id")
            entity_uuid = data.get("entity_uuid")

            if not entity_type:
                return

            # 获取最后审批人（从 ApprovalHistory）
            last_history = (
                await ApprovalHistory.filter(
                    tenant_id=tenant_id,
                    approval_instance_id=approval_instance.id,
                )
                .order_by("-action_at")
                .first()
            )
            approver_id = last_history.action_by if last_history else approval_instance.submitter_id

            if entity_type == "sales_order":
                from apps.kuaizhizao.models.sales_order import SalesOrder
                order = await SalesOrder.filter(tenant_id=tenant_id, uuid=entity_uuid, deleted_at__isnull=True).first()
                if order:
                    from apps.kuaizhizao.services.sales_order_service import SalesOrderService
                    service = SalesOrderService()
                    if approval_instance.status == "approved":
                        await service.approve_sales_order(
                            tenant_id=tenant_id,
                            sales_order_id=order.id,
                            approved_by=approver_id,
                        )
                    elif approval_instance.status == "rejected":
                        await service.reject_sales_order(
                            tenant_id=tenant_id,
                            sales_order_id=order.id,
                            approved_by=approver_id,
                            rejection_reason="审批驳回",
                        )
                    logger.info(f"销售订单 {order.id} 审批回调完成: {approval_instance.status}")

            elif entity_type == "demand":
                from apps.kuaizhizao.models.demand import Demand
                from apps.kuaizhizao.constants import DemandStatus, ReviewStatus
                from infra.models.user import User
                demand = await Demand.get_or_none(tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True)
                if demand:
                    approver = await User.get_or_none(id=approver_id)
                    approver_name = approver.name if approver else f"用户{approver_id}"
                    remark = "审批通过" if approval_instance.status == "approved" else "审批驳回"
                    await Demand.filter(tenant_id=tenant_id, id=entity_id).update(
                        reviewer_id=approver_id,
                        reviewer_name=approver_name,
                        review_time=datetime.now(),
                        review_status=ReviewStatus.APPROVED.value if approval_instance.status == "approved" else ReviewStatus.REJECTED.value,
                        review_remarks=remark,
                        status=DemandStatus.AUDITED.value if approval_instance.status == "approved" else DemandStatus.REJECTED.value,
                        updated_by=approver_id,
                    )
                    logger.info(f"需求 {entity_id} 审批回调完成: {approval_instance.status}")

            elif entity_type == "purchase_order":
                from apps.kuaizhizao.models.purchase_order import PurchaseOrder
                from apps.kuaizhizao.constants import ReviewStatus, DocumentStatus
                from infra.models.user import User
                order = await PurchaseOrder.get_or_none(tenant_id=tenant_id, id=entity_id, deleted_at__isnull=True)
                if order:
                    approver = await User.get_or_none(id=approver_id)
                    approver_name = approver.name if approver else f"用户{approver_id}"
                    remark = "审批通过" if approval_instance.status == "approved" else "审批驳回"
                    await PurchaseOrder.filter(tenant_id=tenant_id, id=entity_id).update(
                        reviewer_id=approver_id,
                        reviewer_name=approver_name,
                        review_time=datetime.now(),
                        review_status=ReviewStatus.APPROVED.value if approval_instance.status == "approved" else ReviewStatus.REJECTED.value,
                        review_remarks=remark,
                        status=DocumentStatus.AUDITED.value if approval_instance.status == "approved" else DocumentStatus.REJECTED.value,
                        updated_by=approver_id,
                    )
                    logger.info(f"采购订单 {entity_id} 审批回调完成: {approval_instance.status}")

        except Exception as e:
            logger.error(f"处理审批完成回调失败: {str(e)}")

