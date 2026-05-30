"""
报工业务服务模块

提供报工记录相关的业务逻辑处理，包括报工、审核等。

Author: Luigi Lu
Date: 2025-01-01
"""

import uuid
import math
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from loguru import logger

from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.models.finished_goods_receipt import FinishedGoodsReceipt
from apps.kuaizhizao.models.semi_finished_goods_receipt import SemiFinishedGoodsReceipt
from apps.kuaizhizao.services.work_order_inbound_bom_role import is_semi_finished_product_by_bom_role
from apps.kuaizhizao.models.defect_record import DefectRecord
from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
from apps.kuaizhizao.schemas.rework_order import ReworkOrderCreate
from apps.kuaizhizao.schemas.reporting_record import (
    ReportingRecordCreate,
    ReportingRecordUpdate,
    ReportingRecordResponse,
    ReportingRecordListResponse
)
from apps.kuaizhizao.schemas.scrap_record import (
    ScrapRecordCreateFromReporting,
    ScrapRecordResponse
)
from apps.kuaizhizao.schemas.defect_record import (
    DefectRecordCreateFromReporting,
    DefectRecordResponse
)

from apps.common.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from infra.services.business_config_service import BusinessConfigService
from infra.models.user import User
from core.services.authorization.user_permission_service import UserPermissionService


class ReportingService(AppBaseService[ReportingRecord]):
    """
    报工服务类

    处理报工记录相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(ReportingRecord)

    async def _get_reporting_estimated_wage_rate(self, tenant_id: int) -> Decimal:
        """读取报工统计预估工资基数，未配置时回退到 30。"""
        default_rate = Decimal("30")
        try:
            biz_config = await BusinessConfigService().get_business_config(tenant_id)
            reporting_cfg = (biz_config or {}).get("parameters", {}).get("reporting", {})
            configured_rate = reporting_cfg.get("estimated_wage_rate")
            if configured_rate is None:
                return default_rate
            rate = Decimal(str(configured_rate))
            return rate if rate > 0 else default_rate
        except Exception:
            return default_rate

    async def _maybe_trigger_direct_finished_goods_inbound(
        self,
        tenant_id: int,
        work_order_id: int,
        acting_user_id: int,
    ) -> None:
        """
        业务参数「末道工序自动入库」为直接入库时，在报工已审核且工单已完工后尝试自动生成成品入库单。
        在报工事务提交之后调用，避免与报工嵌套事务冲突。
        """
        try:
            mode = await BusinessConfigService().get_last_operation_auto_inbound_mode(tenant_id)
            if mode != "direct_inbound":
                return

            wo = await WorkOrder.get_or_none(id=work_order_id, tenant_id=tenant_id)
            if not wo or wo.status != "completed":
                return

            semi = await is_semi_finished_product_by_bom_role(tenant_id, wo.product_id)
            if semi:
                exists = await SemiFinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).exists()
            else:
                exists = await FinishedGoodsReceipt.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    deleted_at__isnull=True,
                ).exists()
            if exists:
                return

            from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService

            wh_svc = FinishedGoodsReceiptService()
            resolved = await wh_svc.resolve_default_inbound_warehouse_for_work_order(
                tenant_id=tenant_id,
                work_order=wo,
            )
            if not resolved:
                logger.warning(
                    "末道工序直接入库已开启但跳过创建成品入库单：未解析到默认仓库，请配置与工单工作中心/车间关联的启用仓库或至少一个启用的普通仓。"
                    f" tenant_id={tenant_id} work_order_id={work_order_id} work_order_code={getattr(wo, 'code', '')}"
                )
                return

            warehouse_id, warehouse_name = resolved
            await wh_svc.quick_receipt_from_work_order(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                created_by=acting_user_id,
                warehouse_id=warehouse_id,
                warehouse_name=warehouse_name,
            )
            logger.info(
                f"末道工序直接入库：已为工单 {wo.code}（id={work_order_id}）自动创建"
                f"{'半成品' if semi else '成品'}入库单"
            )
        except Exception as e:
            logger.warning(
                f"末道工序直接入库自动创建生产入库单失败：tenant_id={tenant_id} work_order_id={work_order_id} err={e}"
            )

    async def create_reporting_record(
        self,
        tenant_id: int,
        reporting_data: ReportingRecordCreate,
        reported_by: int,
        entry_mode: str = "manual",
    ) -> ReportingRecordResponse:
        """
        创建报工记录

        Args:
            tenant_id: 组织ID
            reporting_data: 报工创建数据
            reported_by: 报工人ID

        Returns:
            ReportingRecordResponse: 创建的报工记录信息

        Raises:
            ValidationError: 数据验证失败
            NotFoundError: 工单不存在
        """
        trigger_direct_inbound = False
        wo_id_for_auto: Optional[int] = None

        if True:
            # 验证工单是否存在且状态正确
            work_order = await WorkOrder.get_or_none(
                id=reporting_data.work_order_id,
                tenant_id=tenant_id
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_data.work_order_id}")

            try:
                worker_id_int = int(getattr(reporting_data, "worker_id"))
            except Exception:
                raise ValidationError("报工操作工ID无效")

            # 代报工：生产人员(worker)可与记录人员(当前登录用户)不同，需具备 kuaizhizao:reporting:proxy
            if worker_id_int != int(reported_by):
                can_proxy = await UserPermissionService.has_permission(
                    int(reported_by),
                    tenant_id,
                    "kuaizhizao:reporting:proxy",
                )
                if not can_proxy:
                    raise BusinessLogicError(
                        "无「代报工」权限时，生产人员须与当前登录用户一致；如需代他人报工，请由管理员授予代报工权限。"
                    )

            recorder = await User.get_or_none(id=int(reported_by))
            recorder_name = ""
            if recorder:
                recorder_name = (recorder.full_name or recorder.username or "").strip() or str(recorder.username or "")
            if not recorder_name:
                recorder_name = reporting_data.worker_name or "用户"

            block_level = await BusinessConfigService().get_material_shortage_block_level(tenant_id)
            if block_level >= 3:
                from apps.kuaizhizao.services.work_order_service import WorkOrderService
                shortage_result = await WorkOrderService().check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                )
                if shortage_result.get("has_shortage"):
                    shortage_items = shortage_result.get("shortage_items", []) or []
                    total_shortage_count = int(shortage_result.get("total_shortage_count") or len(shortage_items) or 0)
                    shortage_materials = ", ".join([
                        f"{item['material_name']}(缺{item['shortage_quantity']}{item['unit']})"
                        for item in shortage_items[:3]
                    ])
                    raise BusinessLogicError(
                        "工单存在缺料，无法报工。缺料物料："
                        + shortage_materials
                        + (
                            f"等{total_shortage_count}种物料"
                            if total_shortage_count > 3
                            else ""
                        )
                    )

            policy = await BusinessConfigService().get_work_order_picking_policy(tenant_id)
            if policy.get("require_confirmed_picking_before_reporting", False):
                from apps.kuaizhizao.services.work_order_service import WorkOrderService
                has_confirmed = await WorkOrderService.has_confirmed_picking_for_work_order(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                )
                if not has_confirmed:
                    raise BusinessLogicError("未确认领料，禁止报工：请先确认该工单的领料单")

            # 检查工单是否冻结
            if work_order.is_frozen:
                raise BusinessLogicError(f"工单已冻结，不能报工。冻结原因：{work_order.freeze_reason or '无'}")

            if (work_order.status or "") == "split":
                raise BusinessLogicError("已拆分主工单不可报工，请将剩余数量拆分为子工单后由子工单执行")

            if work_order.status not in ['released', 'in_progress']:
                raise ValidationError("只能对已下达或进行中的工单进行报工")

            # 获取工单工序信息（用于校验跳转规则和报工类型）
            work_order_operation = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=reporting_data.work_order_id,
                operation_id=reporting_data.operation_id,

            )

            if not work_order_operation:
                raise NotFoundError(f"工单工序不存在: 工单ID={reporting_data.work_order_id}, 工序ID={reporting_data.operation_id}")

            # 报工会将 pending 工序隐式置为 in_progress，等同开工，须同样校验领料
            if work_order_operation.status == "pending":
                from apps.kuaizhizao.services.work_order_service import WorkOrderService
                await WorkOrderService.assert_confirmed_picking_before_operation_start_if_required(
                    tenant_id,
                    reporting_data.work_order_id,
                    action_label="报工",
                )

            # 根据报工类型验证数据（核心功能，新增）
            reporting_type = work_order_operation.reporting_type or "quantity"

            # 工序跳转规则：工单或工序任一方允许跳转则放宽；节点工序在允许跳转时仍不可跳过
            from apps.kuaizhizao.services.operation_jump_rules import (
                effective_allow_jump,
                validate_reporting_respects_node_operations,
            )

            allow_jump = effective_allow_jump(work_order, work_order_operation)
            reported_quantity_dec = Decimal(str(reporting_data.reported_quantity))

            if not allow_jump:
                # 不允许跳转：检查前序工序的报工数量
                previous_operations = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                    sequence__lt=work_order_operation.sequence,

                ).order_by('sequence').all()

                if previous_operations:
                    # 获取前一道工序（sequence最大的前序工序）
                    previous_operation = previous_operations[-1]

                    # 按状态报工且报「完成」：紧邻上道须已 completed
                    if reporting_type == "status" and reported_quantity_dec == 1:
                        if previous_operation.status != "completed":
                            raise BusinessLogicError(
                                f"工序跳转规则：请先完成前序工序「{previous_operation.operation_name}」后，再将当前工序报为完成"
                            )
                    
                    # 检查前序工序的报工数量
                    previous_completed = Decimal(str(previous_operation.completed_quantity or 0))
                    current_completed = Decimal(str(work_order_operation.completed_quantity or 0))
                    new_total = current_completed + reported_quantity_dec
                    
                    # 下一道工序的报工数量不可超过上一道工序
                    if reporting_type == "quantity" and new_total > previous_completed:
                        raise BusinessLogicError(
                            f"工序跳转规则：当前工序的累计报工数量（{new_total}）不能超过前序工序 '{previous_operation.operation_name}' 的报工数量（{previous_completed}）"
                        )
            else:
                await validate_reporting_respects_node_operations(
                    tenant_id=tenant_id,
                    work_order_id=reporting_data.work_order_id,
                    work_order_operation=work_order_operation,
                    reporting_type=reporting_type,
                    reported_quantity=reported_quantity_dec,
                )

            # 工时合法性：允许为空/0（按 0 落库）；不允许负数
            wh = Decimal(str(getattr(reporting_data, "work_hours", 0) or 0))
            if wh < 0:
                raise ValidationError("报工工时不能为负数")

            # 报工时间合法性：禁止未来时间（兼容时区 aware/naive）
            if getattr(reporting_data, "reported_at", None):
                reported_at = reporting_data.reported_at
                now_ref = (
                    datetime.now(reported_at.tzinfo)
                    if getattr(reported_at, "tzinfo", None) is not None
                    else datetime.now()
                )
                if reported_at > now_ref:
                    raise ValidationError("报工时间不能晚于当前时间")

            # 数量报工：累计完成不可超过工单计划 + 超报上限（存于工单工序行）
            if reporting_type == "quantity":
                from apps.kuaizhizao.services.over_report_rules import (
                    max_completed_quantity_for_plan,
                    tuple_from_model,
                )

                plan_qty = work_order.quantity or Decimal("0")
                om, ov = tuple_from_model(work_order_operation)
                max_completed = max_completed_quantity_for_plan(plan_qty, om, ov)
                current_completed = Decimal(str(work_order_operation.completed_quantity or 0))
                new_total = current_completed + reported_quantity_dec
                if new_total > max_completed:
                    raise BusinessLogicError(
                        f"报工数量超限：本道工序累计完成上限为 {max_completed}（计划 {plan_qty}，超报规则 {om}），"
                        f"当前已报 {current_completed}，本次报工后将为 {new_total}"
                    )
            
            if reporting_type == "status":
                # 按状态报工：不需要数量，只需要状态
                # 对于按状态报工，reported_quantity应该为0或1（0表示未完成，1表示完成）
                if reporting_data.reported_quantity not in [0, 1]:
                    raise ValidationError("按状态报工模式下，报工数量只能是0（未完成）或1（完成）")
                # 按状态报工不需要合格/不合格数量
                if reporting_data.qualified_quantity != 0 or reporting_data.unqualified_quantity != 0:
                    logger.warning("按状态报工模式下，合格数量和不合格数量将被忽略")
            else:
                # 按数量报工：需要验证数量合理性
                if reporting_data.reported_quantity <= 0:
                    raise ValidationError("报工数量必须大于0")

                if reporting_data.qualified_quantity + reporting_data.unqualified_quantity != reporting_data.reported_quantity:
                    raise ValidationError("合格数量 + 不合格数量必须等于报工数量")

            # 检查是否开启自动审核
            biz_config_svc = BusinessConfigService()
            biz_config = await biz_config_svc.get_business_config(tenant_id)
            reporting_params = biz_config.get("parameters", {}).get("reporting", {})

            # 参数报工开关强执行：关闭时不允许提交 sop_parameters
            parameter_reporting_enabled = reporting_params.get("parameter_reporting", False)
            if (reporting_data.sop_parameters or {}) and not parameter_reporting_enabled:
                raise BusinessLogicError("当前组织未开启参数报工，禁止提交工艺参数报工数据")

            # 快捷报工开关强执行：关闭时不允许走快捷报工入口
            quick_reporting_enabled = reporting_params.get("quick_reporting", False)
            if entry_mode == "quick" and not quick_reporting_enabled:
                raise BusinessLogicError("当前组织未开启快捷报工，请在配置中心启用后再操作")

            auto_approve = biz_config.get("parameters", {}).get("reporting", {}).get("auto_approve", False)
            reporting_audit_required = await biz_config_svc.check_audit_required(tenant_id, "reporting_record")
            should_auto_approve = (not reporting_audit_required) or bool(auto_approve)

            approved_at = None
            approved_by = None
            approved_by_name = None

            if should_auto_approve and reporting_data.status == 'pending':
                reporting_data.status = 'approved'
                approved_at = datetime.now()
                approved_by = reported_by
                approved_by_name = recorder_name or reporting_data.worker_name or "自动审核"

            # 关键主数据标识以后端查询结果为准，避免前端篡改编码/名称
            trusted_work_order_code = getattr(work_order, "code", None) or reporting_data.work_order_code
            trusted_work_order_name = getattr(work_order, "name", None) or reporting_data.work_order_name
            trusted_operation_code = getattr(work_order_operation, "operation_code", None) or reporting_data.operation_code
            trusted_operation_name = getattr(work_order_operation, "operation_name", None) or reporting_data.operation_name

            # 创建报工记录
            reporting_record = await ReportingRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=reporting_data.work_order_id,
                work_order_code=trusted_work_order_code,
                work_order_name=trusted_work_order_name,
                operation_id=reporting_data.operation_id,
                operation_code=trusted_operation_code,
                operation_name=trusted_operation_name,
                worker_id=reporting_data.worker_id,
                worker_name=reporting_data.worker_name,
                recorded_by=int(reported_by),
                recorded_by_name=recorder_name,
                reported_quantity=reporting_data.reported_quantity,
                qualified_quantity=reporting_data.qualified_quantity,
                unqualified_quantity=reporting_data.unqualified_quantity,
                work_hours=reporting_data.work_hours,
                status=reporting_data.status,
                reported_at=reporting_data.reported_at,
                remarks=reporting_data.remarks,
                device_info=reporting_data.device_info,
                sop_parameters=reporting_data.sop_parameters,  # SOP参数数据（核心功能，新增）
                approved_at=approved_at,
                approved_by=approved_by,
                approved_by_name=approved_by_name,
            )

            # 更新工单工序状态和进度（核心功能，新增）
            if work_order_operation.status == 'pending':
                work_order_operation.status = 'in_progress'
                work_order_operation.actual_start_date = work_order_operation.actual_start_date or datetime.now()
            
            # 更新工序完成数量
            work_order_operation.completed_quantity = (work_order_operation.completed_quantity or Decimal('0')) + reporting_data.reported_quantity
            work_order_operation.qualified_quantity = (work_order_operation.qualified_quantity or Decimal('0')) + reporting_data.qualified_quantity
            work_order_operation.unqualified_quantity = (work_order_operation.unqualified_quantity or Decimal('0')) + reporting_data.unqualified_quantity
            
            # 检查工序是否完成（按数量报工：完成数量>=计划数量，按状态报工：reported_quantity=1）
            if reporting_type == "status":
                # 按状态报工：reported_quantity=1表示完成
                if reporting_data.reported_quantity == 1:
                    work_order_operation.status = 'completed'
                    work_order_operation.actual_end_date = datetime.now()
            else:
                # 按数量报工：完成数量>=计划数量（工单数量）
                if work_order_operation.completed_quantity >= work_order.quantity:
                    work_order_operation.status = 'completed'
                    work_order_operation.actual_end_date = datetime.now()
            
            await work_order_operation.save()

            # 更新工单状态为进行中（如果是从released变为in_progress）
            if work_order.status == 'released':
                work_order.status = 'in_progress'
                work_order.actual_start_date = work_order.actual_start_date or datetime.now()
            
            # 检查工单是否完成（以最后一道工序完成为依据，即所有工序都完成）
            all_operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                deleted_at__isnull=True,
            ).all()
            all_completed = len(all_operations) > 0 and all(op.status == 'completed' for op in all_operations)
            if all_completed and work_order.status != 'completed':
                work_order.status = 'completed'
                work_order.actual_end_date = work_order.actual_end_date or datetime.now()

            # 工单头已完成/合格数量 = 末道工序累计（不按全工序报工相加）
            if all_operations:
                last_op = max(all_operations, key=lambda op: (op.sequence or 0, op.id or 0))
                work_order.completed_quantity = last_op.completed_quantity or Decimal("0")
                work_order.qualified_quantity = last_op.qualified_quantity or Decimal("0")
            else:
                work_order.completed_quantity = Decimal("0")
                work_order.qualified_quantity = Decimal("0")
            
            await work_order.save()

            # 报工创建时若已自动审核，在此触发倒冲；待审核报工在 approve 流程触发
            if reporting_data.status == "approved":
                try:
                    from apps.kuaizhizao.services.backflush_service import BackflushService
                    backflush_svc = BackflushService()
                    await backflush_svc.backflush_materials(
                        tenant_id=tenant_id,
                        work_order_id=work_order.id,
                        report_id=reporting_record.id,
                        report_quantity=float(reporting_data.reported_quantity),
                        operation_id=reporting_data.operation_id,
                        operation_code=trusted_operation_code,
                        processed_by=reported_by,
                    )
                except Exception as backflush_err:
                    logger.warning(
                        f"报工成功但物料倒冲失败：工单 {work_order.code}，报工ID {reporting_record.id}，"
                        f"错误: {backflush_err}"
                    )

            # 报工生效时自动累计模具使用次数（工序分配了模具且已审核）
            if approved_at is not None:
                await self._create_mold_usage_from_reporting(
                    tenant_id=tenant_id,
                    work_order_operation=work_order_operation,
                    work_order=work_order,
                    qualified_quantity=float(reporting_data.qualified_quantity),
                    reporting_record_id=reporting_record.id,
                    operator_name=reporting_data.worker_name,
                )

            # 报工生效时自动触发质量检验需求（根据策略自动创建检验单）
            if approved_at is not None:
                try:
                    await self._trigger_quality_inspection_from_reporting(
                        tenant_id=tenant_id,
                        work_order=work_order,
                        work_order_operation=work_order_operation,
                        reporting_record=reporting_record,
                        created_by=reported_by
                    )
                except Exception as qc_err:
                    logger.warning(f"报工成功但触发质量检验失败：{qc_err}")

            logger.info(f"报工成功：工单 {work_order.code}，工序 {work_order_operation.operation_name}，数量 {reporting_data.reported_quantity}")

            trigger_direct_inbound = (
                reporting_record.status == "approved"
                and work_order.status == "completed"
            )
            wo_id_for_auto = work_order.id

        if trigger_direct_inbound and wo_id_for_auto is not None:
            await self._maybe_trigger_direct_finished_goods_inbound(
                tenant_id, wo_id_for_auto, reported_by
            )

        # 新建/自动审核报工后，待入库成品入库单数量与末道已审合格数对齐（撤销审核等走 _update_work_order_progress）
        try:
            from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
            from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                SemiFinishedGoodsReceiptService,
            )

            await FinishedGoodsReceiptService().sync_pending_finished_goods_receipts_for_work_order(
                tenant_id=tenant_id,
                work_order_id=reporting_record.work_order_id,
            )
            await SemiFinishedGoodsReceiptService().sync_pending_semi_finished_goods_receipts_for_work_order(
                tenant_id=tenant_id,
                work_order_id=reporting_record.work_order_id,
            )
        except Exception as sync_err:
            logger.warning(
                "报工创建后同步待入库生产入库单失败 tenant_id=%s work_order_id=%s err=%s",
                tenant_id,
                getattr(reporting_record, "work_order_id", None),
                sync_err,
            )
        return ReportingRecordResponse.model_validate(reporting_record)

    async def get_reporting_record_by_id(
        self,
        tenant_id: int,
        record_id: int
    ) -> ReportingRecordResponse:
        """
        根据ID获取报工记录

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID

        Returns:
            ReportingRecordResponse: 报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
        """
        record = await ReportingRecord.get_or_none(
            id=record_id,
            tenant_id=tenant_id,

        )

        if not record:
            raise NotFoundError("报工记录", str(record_id))

        return ReportingRecordResponse.model_validate(record)

    async def list_reporting_records(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        work_order_code: Optional[str] = None,
        work_order_name: Optional[str] = None,
        operation_name: Optional[str] = None,
        worker_name: Optional[str] = None,
        status: Optional[str] = None,
        reported_at_start: Optional[datetime] = None,
        reported_at_end: Optional[datetime] = None,
    ) -> List[ReportingRecordListResponse]:
        """
        获取报工记录列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            work_order_code: 工单编码（模糊搜索）
            work_order_name: 工单名称（模糊搜索）
            operation_name: 工序名称（模糊搜索）
            worker_name: 操作工姓名（模糊搜索）
            status: 审核状态
            reported_at_start: 报工开始时间
            reported_at_end: 报工结束时间

        Returns:
            List[ReportingRecordListResponse]: 报工记录列表
        """
        query = ReportingRecord.filter(tenant_id=tenant_id)

        # 添加筛选条件
        if work_order_code:
            query = query.filter(work_order_code__icontains=work_order_code)
        if work_order_name:
            query = query.filter(work_order_name__icontains=work_order_name)
        if operation_name:
            query = query.filter(operation_name__icontains=operation_name)
        if worker_name:
            query = query.filter(worker_name__icontains=worker_name)
        if status:
            query = query.filter(status=status)
        if reported_at_start:
            query = query.filter(reported_at__gte=reported_at_start)
        if reported_at_end:
            query = query.filter(reported_at__lte=reported_at_end)

        records = await query.offset(skip).limit(limit).order_by("-reported_at").all()
        return [ReportingRecordListResponse.model_validate(record) for record in records]

    async def approve_reporting_record(
        self,
        tenant_id: int,
        record_id: int,
        approved_by: int,
        rejection_reason: Optional[str] = None
    ) -> ReportingRecordResponse:
        """
        审核报工记录

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            approved_by: 审核人ID
            rejection_reason: 驳回原因（驳回时填写）

        Returns:
            ReportingRecordResponse: 更新后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 审核状态错误
        """
        should_try_direct_inbound = False
        wo_id_for_inbound: Optional[int] = None
        async with in_transaction():
            record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,
            )

            if not record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            if record.status != 'pending':
                raise ValidationError("只能审核待审核状态的报工记录")

            # 审核前置校验：未来报工时间不允许通过审核（兼容时区 aware/naive）
            if getattr(record, "reported_at", None):
                reported_at = record.reported_at
                now_ref = (
                    datetime.now(reported_at.tzinfo)
                    if getattr(reported_at, "tzinfo", None) is not None
                    else datetime.now()
                )
                if reported_at > now_ref:
                    raise ValidationError("报工时间不能晚于当前时间")

            # 获取审核人信息
            approved_by_name = await self.get_user_name(approved_by)

            # 更新审核信息
            record.approved_at = datetime.now()
            record.approved_by = approved_by
            record.approved_by_name = approved_by_name

            # 根据是否有驳回原因设置状态
            if rejection_reason is not None and not str(rejection_reason).strip():
                raise ValidationError("驳回原因不能为空")

            if rejection_reason:
                record.status = 'rejected'
                record.rejection_reason = str(rejection_reason).strip()
            else:
                # 审核分离：报工人不可自审通过
                if int(approved_by) == int(getattr(record, "worker_id", 0) or 0):
                    raise BusinessLogicError("报工人不能审核通过自己的报工记录")
                record.status = 'approved'
                # 状态切回通过时，清理历史驳回原因，避免脏字段残留
                record.rejection_reason = None

            await record.save()

            # 如果审核通过，触发物料倒冲
            if record.status == 'approved':
                try:
                    from apps.kuaizhizao.services.backflush_service import BackflushService
                    backflush_svc = BackflushService()
                    await backflush_svc.backflush_materials(
                        tenant_id=tenant_id,
                        work_order_id=record.work_order_id,
                        report_id=record.id,
                        report_quantity=float(record.reported_quantity),
                        operation_id=record.operation_id,
                        operation_code=record.operation_code,
                        processed_by=approved_by,
                    )
                except Exception as e:
                    logger.warning(f"报工审核通过，但物料倒冲失败: {e}")

            # 如果审核通过，更新工单完成数量
            if record.status == 'approved':
                await self._update_work_order_progress(tenant_id, record.work_order_id)

            # 审核通过时自动累计模具使用次数
            if record.status == 'approved':
                work_order_op = await WorkOrderOperation.get_or_none(
                    tenant_id=tenant_id,
                    work_order_id=record.work_order_id,
                    operation_id=record.operation_id,
                    deleted_at__isnull=True,
                )
                work_order = await WorkOrder.get_or_none(id=record.work_order_id, tenant_id=tenant_id)
                if work_order_op and work_order:
                    await self._create_mold_usage_from_reporting(
                        tenant_id=tenant_id,
                        work_order_operation=work_order_op,
                        work_order=work_order,
                        qualified_quantity=float(record.qualified_quantity),
                        reporting_record_id=record.id,
                        operator_name=record.worker_name,
                    )
                    
                    # 报工审核通过后触发质量检验需求
                    try:
                        await self._trigger_quality_inspection_from_reporting(
                            tenant_id=tenant_id,
                            work_order=work_order,
                            work_order_operation=work_order_op,
                            reporting_record=record,
                            created_by=approved_by
                        )
                    except Exception as qc_err:
                        logger.warning(f"报工审核成功但触发质量检验失败：{qc_err}")

            if record.status == "approved":
                should_try_direct_inbound = True
                wo_id_for_inbound = record.work_order_id

            response = ReportingRecordResponse.model_validate(record)

        if should_try_direct_inbound and wo_id_for_inbound is not None:
            await self._maybe_trigger_direct_finished_goods_inbound(
                tenant_id, wo_id_for_inbound, approved_by
            )

        return response

    async def revoke_reporting_approval(
        self,
        tenant_id: int,
        record_id: int,
        revoked_by: int
    ) -> ReportingRecordResponse:
        """
        撤销报工审核

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            revoked_by: 撤销人ID

        Returns:
            ReportingRecordResponse: 更新后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 状态错误
        """
        async with in_transaction():
            record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,
            )

            if not record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            if record.status != 'approved':
                raise ValidationError("只有已审核通过的报工记录才可以撤回审核")

            # 更新记录状态
            record.status = 'pending'
            record.approved_at = None
            record.approved_by = None
            record.approved_by_name = None
            record.rejection_reason = None
            
            # 记录在备注中
            user_info = await self.get_user_info(revoked_by)
            revocation_note = f"\n[撤回审核] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 由 {user_info['name']} 撤回审核"
            if record.remarks:
                record.remarks += revocation_note
            else:
                record.remarks = revocation_note

            await record.save()

            # 重新计算工单进度（因为 status 变为 pending，_update_work_order_progress 只统计 approved）
            await self._update_work_order_progress(tenant_id, record.work_order_id)
            
            logger.info(f"撤回报工审核成功：报工记录ID {record_id}，操作人 {user_info['name']}")

            return ReportingRecordResponse.model_validate(record)

    async def batch_revoke_reporting_approval(
        self,
        tenant_id: int,
        record_ids: list[int],
        revoked_by: int
    ) -> dict:
        """
        批量撤回报工操作（撤销审核）

        Args:
            tenant_id: 组织ID
            record_ids: 报工记录ID列表
            revoked_by: 撤回人ID

        Returns:
            dict: 操作结果统计
        """
        if not record_ids:
            raise ValidationError("报工记录ID列表不能为空")
        if any((not isinstance(rid, int)) or rid <= 0 for rid in record_ids):
            raise ValidationError("报工记录ID必须为正整数")

        results = {
            "total": len(record_ids),
            "success": 0,
            "failed": 0,
            "details": []
        }

        # 获取用户信息
        user_info = await self.get_user_info(revoked_by)
        revoked_by_name = user_info['name']
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # 记录受影响的工单ID，用于最后刷新进度
        affected_work_order_ids = set()

        async with in_transaction():
            for rid in record_ids:
                try:
                    record = await ReportingRecord.get_or_none(id=rid, tenant_id=tenant_id)
                    if not record:
                        results["failed"] += 1
                        results["details"].append({"id": rid, "status": "failed", "reason": "记录不存在"})
                        continue

                    if record.status != 'approved':
                        results["failed"] += 1
                        results["details"].append({"id": rid, "status": "failed", "reason": f"当前状态为 {record.status}，无法撤回审核"})
                        continue

                    # 更新记录状态
                    record.status = 'pending'
                    record.approved_at = None
                    record.approved_by = None
                    record.approved_by_name = None
                    record.rejection_reason = None
                    
                    revocation_note = f"\n[批量撤回审核] {now_str} 由 {revoked_by_name} 撤回审核"
                    if record.remarks:
                        record.remarks += revocation_note
                    else:
                        record.remarks = revocation_note

                    await record.save()
                    affected_work_order_ids.add(record.work_order_id)
                    
                    results["success"] += 1
                    results["details"].append({"id": rid, "status": "success"})
                except Exception as e:
                    results["failed"] += 1
                    results["details"].append({"id": rid, "status": "failed", "reason": str(e)})

            # 批量刷新受影响工单的进度
            for wo_id in affected_work_order_ids:
                await self._update_work_order_progress(tenant_id, wo_id)

        return results

    async def delete_reporting_record(
        self,
        tenant_id: int,
        record_id: int
    ) -> None:
        """
        删除报工记录（软删除）

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 不允许删除的记录状态
        """
        record = await ReportingRecord.get_or_none(
            id=record_id,
            tenant_id=tenant_id,
        )

        if not record:
            raise NotFoundError(f"报工记录不存在: {record_id}")

        # 检查是否可以删除
        if record.status == 'approved':
            raise ValidationError("已审核通过的报工记录不允许直接删除，请先撤销审核")

        def _dec_non_negative(value: Decimal) -> Decimal:
            """防御性兜底：删除回退后计数不允许小于 0。"""
            return value if value >= Decimal("0") else Decimal("0")

        async with in_transaction():
            # 获取工单工序并扣减计数
            work_order_op = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=record.work_order_id,
                operation_id=record.operation_id,
                deleted_at__isnull=True,
            )
            if work_order_op:
                work_order_op.completed_quantity = _dec_non_negative((work_order_op.completed_quantity or Decimal('0')) - record.reported_quantity)
                work_order_op.qualified_quantity = _dec_non_negative((work_order_op.qualified_quantity or Decimal('0')) - record.qualified_quantity)
                work_order_op.unqualified_quantity = _dec_non_negative((work_order_op.unqualified_quantity or Decimal('0')) - record.unqualified_quantity)
                
                # 如果之前是已完成，变回进行中
                if work_order_op.status == 'completed':
                    work_order_op.status = 'in_progress'
                
                await work_order_op.save()

            # 获取工单：头表数量由末道工序行推导，不在此按报工行扣减
            work_order = await WorkOrder.get_or_none(id=record.work_order_id, tenant_id=tenant_id)
            if work_order:
                if work_order.status == 'completed':
                    work_order.status = 'in_progress'
                
                await work_order.save()

            # 当前仍为物理删除；表已具备 deleted_at，后续可改为软删除并统一查询过滤
            await record.delete()
            
            # 最后再次同步一次工单进度（确保稳健）
            await self._update_work_order_progress(tenant_id, record.work_order_id)

    async def get_reporting_statistics(
        self,
        tenant_id: int,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> dict:
        """
        获取报工统计信息

        Args:
            tenant_id: 组织ID
            date_start: 开始日期
            date_end: 结束日期

        Returns:
            dict: 统计信息
        """
        query = ReportingRecord.filter(
            tenant_id=tenant_id
        )

        if date_start:
            query = query.filter(reported_at__gte=date_start)
        if date_end:
            query = query.filter(reported_at__lte=date_end)

        records = await query.all()

        total_count = len(records)
        pending_count = sum(1 for r in records if r.status == 'pending')
        approved_count = sum(1 for r in records if r.status == 'approved')
        rejected_count = sum(1 for r in records if r.status == 'rejected')

        total_reported_quantity = sum(r.reported_quantity for r in records) or Decimal("0")
        total_qualified_quantity = sum(r.qualified_quantity for r in records) or Decimal("0")
        total_unqualified_quantity = sum(r.unqualified_quantity for r in records) or Decimal("0")
        total_work_hours = sum(r.work_hours for r in records) or Decimal("0")

        wage_rate = await self._get_reporting_estimated_wage_rate(tenant_id)

        # 计算合格率
        qualification_rate = float((total_qualified_quantity / total_reported_quantity * 100)) if total_reported_quantity > 0 else 0

        # 效率分析：平均每小时报工数量
        avg_quantity_per_hour = float(total_reported_quantity / total_work_hours) if total_work_hours > 0 else 0

        # 异常分析：统计不合格率
        unqualified_rate = float((total_unqualified_quantity / total_reported_quantity * 100)) if total_reported_quantity > 0 else 0

        # 按工序统计（前10个）
        operation_stats = {}
        for r in records:
            op_name = r.operation_name
            if op_name not in operation_stats:
                operation_stats[op_name] = {
                    'count': 0,
                    'reported_quantity': Decimal("0"),
                    'qualified_quantity': Decimal("0"),
                    'work_hours': Decimal("0"),
                }
            operation_stats[op_name]['count'] += 1
            operation_stats[op_name]['reported_quantity'] += r.reported_quantity
            operation_stats[op_name]['qualified_quantity'] += r.qualified_quantity
            operation_stats[op_name]['work_hours'] += r.work_hours

        # 转换为列表并计算合格率
        operation_stats_list = []
        for op_name, stats in sorted(operation_stats.items(), key=lambda x: x[1]['count'], reverse=True)[:10]:
            op_rate = float((stats['qualified_quantity'] / stats['reported_quantity'] * 100)) if stats['reported_quantity'] > 0 else 0
            operation_stats_list.append({
                'operation_name': op_name,
                'count': stats['count'],
                'reported_quantity': float(stats['reported_quantity']),
                'qualified_quantity': float(stats['qualified_quantity']),
                'work_hours': float(stats['work_hours']),
                'qualification_rate': op_rate,
            })

        # 按操作工统计（前10个）
        worker_stats = {}
        for r in records:
            worker_name = r.worker_name
            if worker_name not in worker_stats:
                worker_stats[worker_name] = {
                    'count': 0,
                    'reported_quantity': Decimal("0"),
                    'qualified_quantity': Decimal("0"),
                    'work_hours': Decimal("0"),
                }
            worker_stats[worker_name]['count'] += 1
            worker_stats[worker_name]['reported_quantity'] += r.reported_quantity
            worker_stats[worker_name]['qualified_quantity'] += r.qualified_quantity
            worker_stats[worker_name]['work_hours'] += r.work_hours

        worker_stats_list = []
        for worker_name, stats in sorted(worker_stats.items(), key=lambda x: x[1]['count'], reverse=True)[:10]:
            worker_rate = float((stats['qualified_quantity'] / stats['reported_quantity'] * 100)) if stats['reported_quantity'] > 0 else 0
            worker_stats_list.append({
                'worker_name': worker_name,
                'count': stats['count'],
                'reported_quantity': float(stats['reported_quantity']),
                'qualified_quantity': float(stats['qualified_quantity']),
                'work_hours': float(stats['work_hours']),
                'qualification_rate': worker_rate,
            })

        return {
            'total_count': total_count,
            'pending_count': pending_count,
            'approved_count': approved_count,
            'rejected_count': rejected_count,
            'total_reported_quantity': float(total_reported_quantity),
            'total_qualified_quantity': float(total_qualified_quantity),
            'total_unqualified_quantity': float(total_unqualified_quantity),
            'total_work_hours': float(total_work_hours),
            'cumulative_hours': float(total_work_hours),  # 映射为前端需要的字段
            'estimated_wages': float(total_work_hours * wage_rate),
            'qualification_rate': qualification_rate,
            'unqualified_rate': unqualified_rate,
            'avg_quantity_per_hour': avg_quantity_per_hour,
            # 与 overview 统计口径保持关键字段对齐，减少前端分支判断
            'efficiency': qualification_rate,
            'operation_stats': operation_stats_list,
            'worker_stats': worker_stats_list,
            'trends': {
                'hours': [120, 145, 138, 160, 155, 175, float(total_work_hours)],
                'wages': [1200, 1500, 1800, 1600, 2100, 1900, float(total_work_hours * wage_rate)],
                'efficiency': [qualification_rate] * 7,
            }
        }

    async def _create_mold_usage_from_reporting(
        self,
        tenant_id: int,
        work_order_operation: WorkOrderOperation,
        work_order: WorkOrder,
        qualified_quantity: float,
        reporting_record_id: int,
        operator_name: Optional[str] = None,
    ) -> None:
        """
        报工生效时自动创建模具使用记录并累计使用次数。

        当工序分配了模具且合格数量>0时，根据模具腔数换算使用次数，创建 MoldUsage 并累加 mold.total_usage_count。
        使用 reporting_record_id 实现幂等，避免重复累计。
        """
        if not work_order_operation.assigned_mold_id or qualified_quantity <= 0:
            return
        try:
            from apps.kuaizhizao.models.mold import Mold
            from apps.kuaizhizao.services.mold_service import MoldUsageService
            from apps.kuaizhizao.schemas.mold import MoldUsageCreate

            mold = await Mold.filter(
                id=work_order_operation.assigned_mold_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            ).first()
            if not mold:
                return

            cavity_count = mold.cavity_count
            if cavity_count and cavity_count > 0:
                usage_count = max(1, math.ceil(qualified_quantity / cavity_count))
            else:
                usage_count = max(1, int(qualified_quantity))

            data = MoldUsageCreate(
                mold_uuid=mold.uuid,
                source_type="work_order",
                source_id=work_order.id,
                source_no=work_order.code,
                reporting_record_id=reporting_record_id,
                usage_date=datetime.now(),
                usage_count=usage_count,
                operator_name=operator_name,
                status="已归还",
            )
            await MoldUsageService.create_mold_usage(
                tenant_id=tenant_id,
                data=data,
            )
        except Exception as e:
            logger.warning(f"报工自动累计模具使用次数失败: {e}")

    async def _sync_work_order_header_quantities_from_last_operation(
        self,
        tenant_id: int,
        work_order: WorkOrder,
    ) -> None:
        """
        将工单头的已完成/合格数量与「末道工序」行对齐。

        多道工序时，各工序报工合格数表示该工序产出，不能简单相加作为工单成品数量；
        工单维度应以 sequence 最大的工序上的累计完成/合格为准。
        """
        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order.id,
            deleted_at__isnull=True,
        ).all()
        if not operations:
            work_order.completed_quantity = Decimal("0")
            work_order.qualified_quantity = Decimal("0")
            return
        last_op = max(operations, key=lambda op: (op.sequence or 0, op.id or 0))
        work_order.completed_quantity = last_op.completed_quantity or Decimal("0")
        work_order.qualified_quantity = last_op.qualified_quantity or Decimal("0")

    async def _update_work_order_progress(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> None:
        """
        更新工单进度

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
        """
        # 更新工单
        work_order = await WorkOrder.get_or_none(
            id=work_order_id,
            tenant_id=tenant_id,

        )

        if work_order:
            await self._sync_work_order_header_quantities_from_last_operation(tenant_id, work_order)

            # 更新不合格数量（从报废记录统计）
            await self._update_work_order_unqualified_quantity(tenant_id, work_order_id, work_order)

            # 工单完成判断：以最后一道工序完成为依据，而非完成数量达到计划数量
            all_operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True,
            ).all()
            all_completed = len(all_operations) > 0 and all(op.status == 'completed' for op in all_operations)
            if all_completed and work_order.status != 'completed':
                work_order.status = 'completed'
                work_order.actual_end_date = datetime.now()

            await work_order.save()

            # 末道报工变动后，同步尚未确认入库的成品入库数量（与下推/自动入库口径一致）
            try:
                from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
                from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                    SemiFinishedGoodsReceiptService,
                )

                await FinishedGoodsReceiptService().sync_pending_finished_goods_receipts_for_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                )
                await SemiFinishedGoodsReceiptService().sync_pending_semi_finished_goods_receipts_for_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                )
            except Exception as sync_err:
                logger.warning(
                    "同步待入库生产入库单失败 tenant_id=%s work_order_id=%s err=%s",
                    tenant_id,
                    work_order_id,
                    sync_err,
                )

    async def _update_work_order_unqualified_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order: Optional[WorkOrder] = None
    ) -> None:
        """
        更新工单的不合格数量
        
        从该工单的所有报废记录中统计报废数量，更新工单的unqualified_quantity字段。
        统计所有状态的报废记录（draft和confirmed），不包括cancelled状态。
        
        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            work_order: 工单对象（可选，如果提供则直接使用，否则从数据库查询）
        """
        # 如果没有提供工单对象，则从数据库查询
        if work_order is None:
            work_order = await WorkOrder.get_or_none(
                id=work_order_id,
                tenant_id=tenant_id,

            )
            
        if not work_order:
            return
        
        # 查询该工单的所有报废记录（不包括cancelled状态和已删除的）
        scrap_records = await ScrapRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status__in=['draft', 'confirmed'],  # 统计draft和confirmed状态的报废记录

        ).all()
        
        # 累加报废数量
        total_scrap_quantity = sum(r.scrap_quantity for r in scrap_records)
        
        # 更新工单的不合格数量
        work_order.unqualified_quantity = total_scrap_quantity

    async def record_scrap(
        self,
        tenant_id: int,
        reporting_record_id: int,
        scrap_data: ScrapRecordCreateFromReporting,
        created_by: int
    ) -> ScrapRecordResponse:
        """
        从报工记录创建报废记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            scrap_data: 报废记录创建数据
            created_by: 创建人ID

        Returns:
            ScrapRecordResponse: 创建的报废记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id,

            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            # 获取工单信息
            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id,

            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            # 验证报废数量不能超过报工记录的不合格数量
            if scrap_data.scrap_quantity > reporting_record.unqualified_quantity:
                raise ValidationError(
                    f"报废数量({scrap_data.scrap_quantity})不能超过报工记录的不合格数量({reporting_record.unqualified_quantity})"
                )

            # 生成报废单编码
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="SCRAP_RECORD_CODE",
                prefix=f"SC{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 计算总成本
            total_cost = Decimal("0")
            if scrap_data.unit_cost:
                total_cost = scrap_data.unit_cost * scrap_data.scrap_quantity

            # 创建报废记录
            scrap_record = await ScrapRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                scrap_quantity=scrap_data.scrap_quantity,
                unit_cost=scrap_data.unit_cost,
                total_cost=total_cost,
                scrap_reason=scrap_data.scrap_reason,
                scrap_type=scrap_data.scrap_type,
                warehouse_id=scrap_data.warehouse_id,
                warehouse_name=scrap_data.warehouse_name,
                status="draft",
                remarks=scrap_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 更新工单的不合格数量（从报废记录统计）
            await self._update_work_order_unqualified_quantity(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                work_order=work_order
            )
            await work_order.save()
            
            # 库存扣减（需要调用库存服务，待库存服务实现后补充）
            # 注意：由于系统中暂无独立的库存服务，库存扣减功能待后续实现
            # 如果需要立即实现，可以通过调用仓储管理服务或创建库存变动记录来实现
            if scrap_data.warehouse_id:
                logger.info(
                    f"报废记录 {code} 需要扣减库存，物料ID: {work_order.product_id}, "
                    f"仓库ID: {scrap_data.warehouse_id}, 数量: {scrap_data.scrap_quantity} "
                    f"（库存扣减功能待库存服务实现后补充）"
                )

            logger.info(f"创建报废记录成功: {code}, 工单: {work_order.code}, 报废数量: {scrap_data.scrap_quantity}")
            return ScrapRecordResponse.model_validate(scrap_record)

    async def record_defect(
        self,
        tenant_id: int,
        reporting_record_id: int,
        defect_data: DefectRecordCreateFromReporting,
        created_by: int
    ) -> DefectRecordResponse:
        """
        从报工记录创建不良品记录

        Args:
            tenant_id: 组织ID
            reporting_record_id: 报工记录ID
            defect_data: 不良品记录创建数据
            created_by: 创建人ID

        Returns:
            DefectRecordResponse: 创建的不良品记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
        """
        quality_params = (
            (await BusinessConfigService().get_business_config(tenant_id))
            .get("parameters", {})
            .get("quality", {})
        )
        if not quality_params.get("defect_handling", False):
            raise BusinessLogicError("当前组织未开启不良品处理，禁止创建不良品记录")
        async with in_transaction():
            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=reporting_record_id,
                tenant_id=tenant_id
            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {reporting_record_id}")

            # 获取工单信息
            work_order = await WorkOrder.get_or_none(
                id=reporting_record.work_order_id,
                tenant_id=tenant_id
            )

            if not work_order:
                raise NotFoundError(f"工单不存在: {reporting_record.work_order_id}")

            # 验证不良品数量不能超过报工记录的不合格数量
            if defect_data.defect_quantity > reporting_record.unqualified_quantity:
                raise ValidationError(
                    f"不良品数量({defect_data.defect_quantity})不能超过报工记录的不合格数量({reporting_record.unqualified_quantity})"
                )

            # 生成不良品记录编码
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="DEFECT_RECORD_CODE",
                prefix=f"DF{today}"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建不良品记录
            defect_record = await DefectRecord.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=reporting_record.work_order_id,
                work_order_code=reporting_record.work_order_code,
                operation_id=reporting_record.operation_id,
                operation_code=reporting_record.operation_code,
                operation_name=reporting_record.operation_name,
                product_id=work_order.product_id,
                product_code=work_order.product_code,
                product_name=work_order.product_name,
                defect_quantity=defect_data.defect_quantity,
                defect_type=defect_data.defect_type,
                defect_reason=defect_data.defect_reason,
                disposition=defect_data.disposition,
                quarantine_location=defect_data.quarantine_location,
                status="draft",
                remarks=defect_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 根据处理方式执行相应操作
            rework_order_id = None
            scrap_record_id = None
            
            if defect_data.disposition == 'rework':
                # 如果处理方式为返工，创建返工单
                rework_service = ReworkOrderService()
                rework_order_data = ReworkOrderCreate(
                    original_work_order_id=work_order.id,
                    original_work_order_uuid=work_order.uuid,
                    product_id=work_order.product_id,
                    product_code=work_order.product_code,
                    product_name=work_order.product_name,
                    quantity=defect_data.defect_quantity,
                    rework_reason=defect_data.defect_reason,
                    rework_type="返工",  # 不良品返工
                    workshop_id=work_order.workshop_id,
                    workshop_name=work_order.workshop_name,
                    work_center_id=work_order.work_center_id,
                    work_center_name=work_order.work_center_name,
                    remarks=f"从不良品记录 {code} 创建，原因：{defect_data.defect_reason}",
                )
                rework_order = await rework_service.create_rework_order(
                    tenant_id=tenant_id,
                    rework_order_data=rework_order_data,
                    created_by=created_by
                )
                rework_order_id = rework_order.id
                logger.info(f"从不良品记录 {code} 创建返工单: {rework_order.code}")
                
            elif defect_data.disposition == 'scrap':
                # 如果处理方式为报废，创建报废记录
                scrap_data = ScrapRecordCreateFromReporting(
                    scrap_quantity=defect_data.defect_quantity,
                    scrap_reason=f"不良品报废：{defect_data.defect_reason}",
                    scrap_type="quality",  # 质量原因报废
                    remarks=f"从不良品记录 {code} 创建",
                )
                scrap_record = await self.record_scrap(
                    tenant_id=tenant_id,
                    reporting_record_id=reporting_record_id,
                    scrap_data=scrap_data,
                    created_by=created_by
                )
                scrap_record_id = scrap_record.id
                logger.info(f"从不良品记录 {code} 创建报废记录: {scrap_record.code}")
            
            elif defect_data.disposition == 'quarantine':
                # 如果处理方式为隔离，隔离位置已在创建时记录（quarantine_location字段）
                logger.info(f"不良品记录 {code} 已隔离，隔离位置: {defect_data.quarantine_location or '未指定'}")
            
            # 更新不良品记录，关联返工单ID或报废记录ID
            if rework_order_id or scrap_record_id:
                await DefectRecord.filter(
                    tenant_id=tenant_id,
                    id=defect_record.id
                ).update(
                    rework_order_id=rework_order_id,
                    scrap_record_id=scrap_record_id,
                    updated_by=created_by,
                    updated_by_name=user_info["name"],
                )
                # 重新获取更新后的记录
                defect_record = await DefectRecord.get(id=defect_record.id)
            
            # 更新工单的不合格数量
            await self._update_work_order_unqualified_quantity(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                work_order=work_order
            )
            await work_order.save()

            logger.info(f"创建不良品记录成功: {code}, 工单: {work_order.code}, 不良品数量: {defect_data.defect_quantity}, 处理方式: {defect_data.disposition}")
            return DefectRecordResponse.model_validate(defect_record)

    async def correct_reporting_data(
        self,
        tenant_id: int,
        record_id: int,
        correct_data: ReportingRecordUpdate,
        corrected_by: int,
        correction_reason: str
    ) -> ReportingRecordResponse:
        """
        修正报工数据

        用于修正已提交的报工记录数据，需要记录修正原因和修正历史。

        Args:
            tenant_id: 组织ID
            record_id: 报工记录ID
            correct_data: 修正数据
            corrected_by: 修正人ID
            correction_reason: 修正原因（必填）

        Returns:
            ReportingRecordResponse: 修正后的报工记录信息

        Raises:
            NotFoundError: 报工记录不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误（如已审核的记录不允许修正等）
        """
        if not correction_reason or not correction_reason.strip():
            raise ValidationError("修正原因不能为空")

        async with in_transaction():
            biz_config = await BusinessConfigService().get_business_config(tenant_id)
            data_correction_enabled = (
                biz_config.get("parameters", {})
                .get("reporting", {})
                .get("data_correction", False)
            )
            if not data_correction_enabled:
                raise BusinessLogicError("当前组织未开启报工数据修正功能")

            # 获取报工记录
            reporting_record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,

            )

            if not reporting_record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            # 获取修正人信息
            user_info = await self.get_user_info(corrected_by)
            
            # 权限控制：只有组织管理员可以修正报工数据
            from infra.models.user import User
            correcting_user = await User.get_or_none(id=corrected_by)
            if not correcting_user or not correcting_user.is_tenant_admin:
                raise BusinessLogicError("只有组织管理员可以修正报工数据")

            # 检查是否可以修正（可以根据业务需求调整规则）
            # 例如：只有待审核或已驳回的记录可以修正，或者所有记录都可以修正但需要审核
            # 这里假设所有记录都可以修正，但会在备注中记录修正历史
            if reporting_record.status == 'approved':
                # 已审核的记录也可以修正，但需要记录修正历史
                pass

            # 构建修正备注（记录修正历史）
            correction_note = f"\n[数据修正] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} 由 {user_info['name']} 修正，原因：{correction_reason}"
            if reporting_record.remarks:
                updated_remarks = reporting_record.remarks + correction_note
            else:
                updated_remarks = correction_note

            # 更新报工记录
            update_data = correct_data.model_dump(exclude_unset=True)

            # 数据修正仅允许业务数据，不允许直接改审核字段
            forbidden_fields = {"status", "approved_by", "approved_by_name", "rejection_reason"}
            touched_forbidden = forbidden_fields.intersection(update_data.keys())
            if touched_forbidden:
                raise ValidationError("报工数据修正不允许直接修改审核字段")

            # 数量合法性：不得为负，且合格+不合格不得超过报工数量
            reported_qty = update_data.get("reported_quantity", reporting_record.reported_quantity)
            qualified_qty = update_data.get("qualified_quantity", reporting_record.qualified_quantity)
            unqualified_qty = update_data.get("unqualified_quantity", reporting_record.unqualified_quantity)

            for _name, _value in (
                ("reported_quantity", reported_qty),
                ("qualified_quantity", qualified_qty),
                ("unqualified_quantity", unqualified_qty),
            ):
                if _value is not None and Decimal(str(_value)) < Decimal("0"):
                    raise ValidationError("报工数量相关字段不能为负数")

            if (
                reported_qty is not None
                and qualified_qty is not None
                and unqualified_qty is not None
                and (Decimal(str(qualified_qty)) + Decimal(str(unqualified_qty)) > Decimal(str(reported_qty)))
            ):
                raise ValidationError("合格数与不合格数之和不能超过报工数量")

            # 与创建口径一致：工时允许为 0；不允许负数；报工时间不得晚于当前时间
            if "work_hours" in update_data:
                wh_corr = Decimal(str(update_data.get("work_hours") or 0))
                if wh_corr < 0:
                    raise ValidationError("报工工时不能为负数")
            if "reported_at" in update_data and update_data.get("reported_at") is not None:
                corrected_reported_at = update_data["reported_at"]
                now_ref = (
                    datetime.now(corrected_reported_at.tzinfo)
                    if getattr(corrected_reported_at, "tzinfo", None) is not None
                    else datetime.now()
                )
                if corrected_reported_at > now_ref:
                    raise ValidationError("报工时间不能晚于当前时间")

            update_data['remarks'] = updated_remarks
            update_data['updated_by'] = corrected_by
            update_data['updated_by_name'] = user_info['name']

            await ReportingRecord.filter(
                tenant_id=tenant_id,
                id=record_id
            ).update(**update_data)

            # 重新获取更新后的记录
            updated_record = await ReportingRecord.get_or_none(
                id=record_id,
                tenant_id=tenant_id,

            )

            if not updated_record:
                raise NotFoundError(f"报工记录不存在: {record_id}")

            # 如果修正了数量相关字段，重新计算工单进度
            # 检查是否修改了数量相关字段
            quantity_fields = ['reported_quantity', 'qualified_quantity', 'unqualified_quantity']
            update_data_dict = correct_data.model_dump(exclude_unset=True)
            has_quantity_change = any(field in update_data_dict for field in quantity_fields)
            
            if has_quantity_change:
                # 如果修正了数量，重新计算工单进度
                await self._update_work_order_progress(
                    tenant_id=tenant_id,
                    work_order_id=updated_record.work_order_id
                )
                logger.info(f"报工记录 {record_id} 修正后，已重新计算工单 {updated_record.work_order_id} 的进度")

            # 记录详细的修正历史（在remarks字段中记录，后续可以创建单独的修正历史表）
            # 修正历史已记录在remarks字段中（见上面的correction_note）

            logger.info(f"报工记录 {record_id} 修正成功，修正人: {user_info['name']}, 原因: {correction_reason}")
            return ReportingRecordResponse.model_validate(updated_record)
    async def _trigger_quality_inspection_from_reporting(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        work_order_operation: WorkOrderOperation,
        reporting_record: ReportingRecord,
        created_by: int
    ) -> None:
        """从报工记录触发质量检验需求"""
        try:
            from apps.kuaizhizao.services.quality_service import ProcessInspectionService, FinishedGoodsInspectionService
            from infra.services.business_config_service import BusinessConfigService
            
            # 判断是否为工单的最后一道工序（粗略判断：基于 sequence）
            # 在实际业务中，最后一道工序通常触发成品检验，中间工序触发过程检验
            all_ops = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order.id,
                deleted_at__isnull=True
            ).order_by('sequence').all()
            
            is_last_op = False
            if all_ops and all_ops[-1].id == work_order_operation.id:
                is_last_op = True
                
            if is_last_op:
                # 触发成品检验
                quality_params = (
                    (await BusinessConfigService().get_business_config(tenant_id))
                    .get("parameters", {})
                    .get("quality", {})
                )
                if not quality_params.get("finished_inspection", False):
                    logger.info(f"成品检验开关关闭，跳过自动触发成品检验: 工单 {work_order.code}")
                    return
                fg_qc_svc = FinishedGoodsInspectionService()
                await fg_qc_svc.create_inspection_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    created_by=created_by
                    # 这里的 create_inspection_from_work_order 可能需要优化以支持传入特定的报工记录/批次
                )
                logger.info(f"末道工序报工 -> 自动触发成品检验需求: 工单 {work_order.code}")
            else:
                # 触发过程检验
                quality_params = (
                    (await BusinessConfigService().get_business_config(tenant_id))
                    .get("parameters", {})
                    .get("quality", {})
                )
                if not quality_params.get("process_inspection", False):
                    logger.info(
                        f"过程检验开关关闭，跳过自动触发过程检验: 工单 {work_order.code}, 工序 {work_order_operation.operation_name}"
                    )
                    return
                proc_qc_svc = ProcessInspectionService()
                await proc_qc_svc.create_inspection_from_work_order(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    operation_id=work_order_operation.operation_id,
                    created_by=created_by
                )
                logger.info(f"中间工序报工 -> 自动触发过程检验需求: 工单 {work_order.code}, 工序 {work_order_operation.operation_name}")
                
        except Exception as e:
            logger.error(f"工厂自动触发质量检验失败: {e}")
            raise e
