"""
工单业务服务模块

提供工单相关的业务逻辑处理，包括CRUD操作、状态流转等。

Author: Luigi Lu
Date: 2025-01-01
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction
from core.timezone_utils import now_utc

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderResponse,
    WorkOrderListResponse,
    WorkOrderSplitRequest,
    WorkOrderSplitResponse,
    WorkOrderOperationCreate,
    WorkOrderOperationUpdate,
    WorkOrderOperationResponse,
    WorkOrderOperationsUpdateRequest,
    WorkOrderFreezeRequest,
    WorkOrderUnfreezeRequest,
    WorkOrderPriorityRequest,
    WorkOrderBatchPriorityRequest,
    WorkOrderMergeRequest,
    WorkOrderMergeResponse,
    WorkOrderOperationDispatch,
    DefectTypeMinimal,
    DefaultOperatorSnapshot,
    WorkOrderKittingAnalysisResponse,
    MaterialKittingItem,
    MaterialLocationInfo,
)
from apps.kuaizhizao.utils.bom_helper import calculate_material_requirements_from_bom
from apps.kuaizhizao.utils.inventory_helper import (
    get_material_available_quantity,
    get_material_detailed_locations,
)
from apps.kuaizhizao.models.reporting_record import ReportingRecord
from apps.kuaizhizao.models.production_picking import ProductionPicking
from apps.kuaizhizao.models.production_picking_item import ProductionPickingItem
from apps.kuaizhizao.models.scrap_record import ScrapRecord
from apps.kuaizhizao.services.document_timing_service import DocumentTimingService
from apps.master_data.models.material import Material, MaterialGroup
from apps.master_data.models.process import ProcessRoute, Operation, SOP
from apps.master_data.models.factory import Workshop, WorkCenter, Workstation, WorkGroup
from apps.kuaizhizao.models.equipment import Equipment
from apps.master_data.services.process_service import batch_get_operation_defect_types_via_table
from core.services.business.code_generation_service import CodeGenerationService
from apps.kuaizhizao.utils.material_source_helper import (
    get_material_source_type,
    validate_material_source_config,
    get_material_source_config,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_OUTSOURCE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_PHANTOM,
    SOURCE_TYPE_CONFIGURE,
)
from loguru import logger
from infra.services.business_config_service import BusinessConfigService
from infra.models.user import User


async def _batch_default_operators_snapshots_by_master_operation_id(
    tenant_id: int,
    master_operation_ids: List[int],
) -> Dict[int, List[DefaultOperatorSnapshot]]:
    """按 master Operation.id 批量解析工序档案中的默认生产人员（含 uuid，供前端下拉与默认选中）。"""
    if not master_operation_ids:
        return {}
    uniq = list({int(x) for x in master_operation_ids if x is not None})
    if not uniq:
        return {}
    master_ops = await Operation.filter(
        tenant_id=tenant_id,
        id__in=uniq,
        deleted_at__isnull=True,
    ).all()
    all_user_ids: List[int] = []
    raw_ids_by_master: Dict[int, List[int]] = {}
    for mo in master_ops:
        raw = getattr(mo, "default_operator_ids", None) or []
        ids: List[int] = []
        if isinstance(raw, list):
            for x in raw:
                try:
                    ids.append(int(x))
                except (TypeError, ValueError):
                    continue
        raw_ids_by_master[mo.id] = ids
        all_user_ids.extend(ids)
    uid_set = list({i for i in all_user_ids if i})
    users = (
        await User.filter(
            tenant_id=tenant_id,
            id__in=uid_set,
            deleted_at__isnull=True,
        ).all()
        if uid_set
        else []
    )
    user_by_id = {u.id: u for u in users}
    out: Dict[int, List[DefaultOperatorSnapshot]] = {}
    for mo in master_ops:
        snaps: List[DefaultOperatorSnapshot] = []
        for uid in raw_ids_by_master.get(mo.id, []):
            u = user_by_id.get(uid)
            if not u:
                continue
            snaps.append(
                DefaultOperatorSnapshot(
                    id=u.id,
                    uuid=str(getattr(u, "uuid", "") or ""),
                    name=str(u.full_name or u.username or str(u.id)),
                )
            )
        out[mo.id] = snaps
    return out


async def _resolve_sales_order_snapshot_fields(
    tenant_id: int,
    sales_order_id: Optional[int],
    sales_order_code: Optional[str],
    sales_order_name: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """仅有 sales_order_id 时从销售订单主表补全编号/名称，便于列表与详情展示。"""
    if not sales_order_id:
        return sales_order_code, sales_order_name
    if sales_order_code and sales_order_name:
        return sales_order_code, sales_order_name
    so = await SalesOrder.get_or_none(
        id=sales_order_id,
        tenant_id=tenant_id,
        deleted_at__isnull=True,
    )
    if not so:
        return sales_order_code, sales_order_name
    code = sales_order_code or so.order_code
    name = sales_order_name or (
        f"{so.order_code} · {so.customer_name}" if so.customer_name else so.order_code
    )
    return code, name


def _max_reportable_quantity_for_op(work_order: WorkOrder, op: WorkOrderOperation) -> Decimal:
    from apps.kuaizhizao.services.over_report_rules import max_completed_quantity_for_plan, tuple_from_model

    plan_qty = work_order.quantity or Decimal("0")
    om, ov = tuple_from_model(op)
    return max_completed_quantity_for_plan(plan_qty, om, ov)


def _material_shortage_block_applies(block_level: int, stage: str) -> bool:
    """缺料拦截级别是否命中当前阶段。"""
    stage_map = {
        "release": 1,
        "operation_start": 2,
        "reporting": 3,
    }
    required_level = stage_map.get(stage, 999)
    return int(block_level or 0) >= required_level


class WorkOrderService(AppBaseService[WorkOrder]):
    """
    工单服务类

    处理工单相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(WorkOrder)

    async def _is_work_order_param_enabled(self, tenant_id: int, key: str, default: bool = False) -> bool:
        config = await BusinessConfigService().get_business_config(tenant_id)
        return bool(
            config.get("parameters", {})
            .get("work_order", {})
            .get(key, default)
        )

    @staticmethod
    async def has_confirmed_picking_for_work_order(tenant_id: int, work_order_id: int) -> bool:
        confirmed_statuses = ["已领料", "已确认", "confirmed", "picked"]
        return await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status__in=confirmed_statuses,
            deleted_at__isnull=True,
        ).exists()

    async def _match_process_route_for_material(
        self,
        tenant_id: int,
        material_id: int
    ) -> Optional[ProcessRoute]:
        """
        为物料自动匹配工艺路线
        
        匹配规则（优先级从高到低）：
        1. 物料直接绑定的工艺路线（process_route_id）
        2. 物料所属分组绑定的工艺路线（material_group.process_route_id）
        3. 物料来源配置中的工艺路线（source_config.process_route_id）
        
        Args:
            tenant_id: 组织ID
            material_id: 物料ID
            
        Returns:
            Optional[ProcessRoute]: 匹配到的工艺路线，如果未匹配到则返回None
        """
        # 1. 优先检查物料直接绑定的工艺路线
        material = await Material.get_or_none(
            id=material_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if not material:
            return None
        
        if material.process_route_id:
            process_route = await ProcessRoute.get_or_none(
                id=material.process_route_id,
                tenant_id=tenant_id,
                is_active=True,
                deleted_at__isnull=True
            )
            if process_route:
                logger.info(f"物料 {material.main_code or material.code} 使用直接绑定的工艺路线: {process_route.code}")
                return process_route
        
        # 2. 检查物料分组绑定的工艺路线
        if material.group_id:
            material_group = await MaterialGroup.get_or_none(
                id=material.group_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            
            if material_group and material_group.process_route_id:
                process_route = await ProcessRoute.get_or_none(
                    id=material_group.process_route_id,
                    tenant_id=tenant_id,
                    is_active=True,
                    deleted_at__isnull=True
                )
                if process_route:
                    logger.info(f"物料 {material.main_code or material.code} 使用分组绑定的工艺路线: {process_route.code}")
                    return process_route
        
        # 3. 检查 source_config 中的工艺路线（物料来源配置可能单独存储）
        source_config = material.source_config or {}
        pr_id = source_config.get("process_route_id")
        if pr_id:
            process_route = await ProcessRoute.get_or_none(
                id=pr_id,
                tenant_id=tenant_id,
                is_active=True,
                deleted_at__isnull=True
            )
            if process_route:
                logger.info(f"物料 {material.main_code or material.code} 使用 source_config 中的工艺路线: {process_route.code}")
                return process_route
        
        logger.warning(f"物料 {material.main_code or material.code} 未找到匹配的工艺路线")
        return None

    async def _generate_work_order_operations_from_route(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        process_route: ProcessRoute,
        created_by: int
    ) -> List[WorkOrderOperation]:
        """
        根据工艺路线自动生成工单工序单
        
        Args:
            tenant_id: 组织ID
            work_order: 工单对象
            process_route: 工艺路线对象
            created_by: 创建人ID
            
        Returns:
            List[WorkOrderOperation]: 生成的工单工序单列表
        """
        if not process_route.operation_sequence:
            logger.warning(f"工艺路线 {process_route.code} 没有工序序列")
            return []
        
        # 获取创建人信息
        user_info = await self.get_user_info(created_by)
        
        # 解析工序序列（支持多种前端保存格式）
        sequence_data = process_route.operation_sequence
        operation_list = []
        
        if isinstance(sequence_data, list):
            # 列表格式：[{"operation_id": 1, "sequence": 1, ...}, ...] 或 [{"uuid": "..."}, ...]
            for item in sequence_data:
                if isinstance(item, dict):
                    op_id = item.get("operation_id") or item.get("operationId")
                    op_uuid = item.get("uuid") or item.get("operation_uuid")
                    sequence = item.get("sequence", len(operation_list) + 1)
                    operation_list.append({
                        "operation_id": op_id,
                        "operation_uuid": op_uuid,
                        "sequence": sequence,
                        "extra_data": item  # 保存额外数据（如workshop_id, work_center_id等）
                    })
        elif isinstance(sequence_data, dict):
            # 字典格式：{"operations": [...], "sequence": [...]}（前端工艺路线页面保存格式）
            if "operations" in sequence_data and isinstance(sequence_data["operations"], list):
                ops = sequence_data["operations"]
                seq_uuids = sequence_data.get("sequence")
                # 前端格式：{"sequence": [uuid1, uuid2], "operations": [{uuid, code, name}, ...]}，两者顺序一致
                if isinstance(seq_uuids, list) and seq_uuids:
                    for idx, op_uuid in enumerate(seq_uuids, 1):
                        op_obj = next((o for o in ops if isinstance(o, dict) and (o.get("uuid") or o.get("operation_uuid")) == op_uuid), None)
                        if op_obj:
                            op_id = op_obj.get("operation_id") or op_obj.get("operationId")
                            operation_list.append({
                                "operation_id": op_id,
                                "operation_uuid": op_uuid if isinstance(op_uuid, str) else (op_obj.get("uuid") or op_obj.get("operation_uuid")),
                                "sequence": idx,
                                "extra_data": op_obj
                            })
                        elif isinstance(op_uuid, str):
                            operation_list.append({
                                "operation_id": None,
                                "operation_uuid": op_uuid,
                                "sequence": idx,
                                "extra_data": {}
                            })
                else:
                    for idx, op_obj in enumerate(ops, 1):
                        if isinstance(op_obj, dict):
                            op_id = op_obj.get("operation_id") or op_obj.get("operationId")
                            op_uuid = op_obj.get("uuid") or op_obj.get("operation_uuid")
                            operation_list.append({
                                "operation_id": op_id,
                                "operation_uuid": op_uuid,
                                "sequence": op_obj.get("sequence", idx),
                                "extra_data": op_obj
                            })
            elif "sequence" in sequence_data and isinstance(sequence_data["sequence"], list):
                # 仅 sequence 数组（UUID 列表）
                for idx, op_uuid in enumerate(sequence_data["sequence"], 1):
                    if isinstance(op_uuid, str):
                        operation_list.append({
                            "operation_id": None,
                            "operation_uuid": op_uuid,
                            "sequence": idx,
                            "extra_data": {}
                        })
            elif "operation_ids" in sequence_data or "operationIds" in sequence_data:
                op_ids = sequence_data.get("operation_ids") or sequence_data.get("operationIds", [])
                for idx, op_id in enumerate(op_ids, 1):
                    operation_list.append({
                        "operation_id": op_id,
                        "operation_uuid": None,
                        "sequence": idx,
                        "extra_data": {}
                    })
            else:
                # 键值对格式
                for key, value in sequence_data.items():
                    if isinstance(value, dict):
                        op_id = value.get("operation_id") or value.get("operationId") or (int(key) if key.isdigit() else None)
                        op_uuid = value.get("uuid") or value.get("operation_uuid")
                        sequence = value.get("sequence", len(operation_list) + 1)
                        operation_list.append({
                            "operation_id": op_id,
                            "operation_uuid": op_uuid,
                            "sequence": sequence,
                            "extra_data": value
                        })
                    else:
                        op_id = int(key) if key.isdigit() else None
                        if op_id:
                            operation_list.append({
                                "operation_id": op_id,
                                "operation_uuid": None,
                                "sequence": len(operation_list) + 1,
                                "extra_data": {}
                            })
        
        # 按序列排序
        operation_list.sort(key=lambda x: x["sequence"])
        
        # 解析 UUID 为 operation_id（前端可能只存 uuid）
        op_uuids = [op["operation_uuid"] for op in operation_list if op.get("operation_uuid") and not op.get("operation_id")]
        if op_uuids:
            ops_by_uuid = await Operation.filter(
                uuid__in=op_uuids,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            uuid_to_id = {o.uuid: o.id for o in ops_by_uuid}
            for op in operation_list:
                if not op.get("operation_id") and op.get("operation_uuid"):
                    op["operation_id"] = uuid_to_id.get(op["operation_uuid"])
        
        # 获取所有工序信息
        operation_ids = [op["operation_id"] for op in operation_list if op["operation_id"]]
        operations = await Operation.filter(
            id__in=operation_ids,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).all()
        
        operation_map = {op.id: op for op in operations}

        # 批量获取默认资源名称
        all_user_ids = set()
        all_team_ids = set()
        all_workshop_ids = set()
        all_work_center_ids = set()
        all_station_ids = set()
        all_eq_ids = set()

        for op in operations:
            if op.default_operator_ids: all_user_ids.update(op.default_operator_ids)
            if op.default_team_ids: all_team_ids.update(op.default_team_ids)
            if op.default_workshop_ids: all_workshop_ids.update(op.default_workshop_ids)
            if op.default_work_center_ids: all_work_center_ids.update(op.default_work_center_ids)
            if hasattr(op, "default_station_ids") and op.default_station_ids: all_station_ids.update(op.default_station_ids)
            if op.default_equipment_ids: all_eq_ids.update(op.default_equipment_ids)

        user_names = {u.id: (u.full_name or u.username) for u in await User.filter(id__in=list(all_user_ids)).all()} if all_user_ids else {}
        team_names = {t.id: t.name for t in await WorkGroup.filter(id__in=list(all_team_ids)).all()} if all_team_ids else {}
        workshop_names = {w.id: w.name for w in await Workshop.filter(id__in=list(all_workshop_ids)).all()} if all_workshop_ids else {}
        center_names = {c.id: c.name for c in await WorkCenter.filter(id__in=list(all_work_center_ids)).all()} if all_work_center_ids else {}
        station_names = {s.id: s.name for s in await Workstation.filter(id__in=list(all_station_ids)).all()} if all_station_ids else {}
        eq_names = {e.id: e.name for e in await Equipment.filter(id__in=list(all_eq_ids)).all()} if all_eq_ids else {}

        from apps.kuaizhizao.services.over_report_rules import (
            OVER_REPORT_NONE,
            merge_over_report_layers,
            tuple_from_model,
            parse_over_report_from_extra,
            extra_has_over_report_keys,
        )

        material_row = await Material.get_or_none(
            id=work_order.product_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        mat_t = tuple_from_model(material_row)
        route_def_t = tuple_from_model(process_route)
        wo_head_t = tuple_from_model(work_order)
        
        # 计算计划时间
        planned_start = work_order.planned_start_date or datetime.now()
        current_time = planned_start
        
        # 创建工单工序单
        work_order_operations = []
        for op_data in operation_list:
            op_id = op_data["operation_id"]
            if op_id not in operation_map:
                logger.warning(f"工序ID {op_id} 不存在，跳过")
                continue
            
            operation = operation_map[op_id]
            extra_data = op_data.get("extra_data", {})
            
            # 默认资源绑定逻辑：工艺路线实例数据 > 工序主数据默认设置 > 工单整单设置
            workshop_id = extra_data.get("workshop_id") or (operation.default_workshop_ids[0] if operation.default_workshop_ids else None) or work_order.workshop_id
            workshop_name = extra_data.get("workshop_name") or workshop_names.get(workshop_id) or work_order.workshop_name
            
            work_center_id = extra_data.get("work_center_id") or (operation.default_work_center_ids[0] if operation.default_work_center_ids else None) or work_order.work_center_id
            work_center_name = extra_data.get("work_center_name") or center_names.get(work_center_id) or work_order.work_center_name

            assigned_worker_id = extra_data.get("assigned_worker_id") or (operation.default_operator_ids[0] if operation.default_operator_ids else None)
            assigned_worker_name = extra_data.get("assigned_worker_name") or user_names.get(assigned_worker_id)

            assigned_team_id = extra_data.get("assigned_team_id") or (operation.default_team_ids[0] if operation.default_team_ids else None)
            assigned_team_name = extra_data.get("assigned_team_name") or team_names.get(assigned_team_id)

            assigned_station_id = extra_data.get("assigned_station_id") or (getattr(operation, "default_station_ids", [])[0] if getattr(operation, "default_station_ids", None) else None)
            assigned_station_name = extra_data.get("assigned_station_name") or station_names.get(assigned_station_id)

            assigned_equipment_id = extra_data.get("assigned_equipment_id") or (operation.default_equipment_ids[0] if operation.default_equipment_ids else None)
            assigned_equipment_name = extra_data.get("assigned_equipment_name") or eq_names.get(assigned_equipment_id)

            standard_time = extra_data.get("standard_time")
            setup_time = extra_data.get("setup_time")
            
            # 从额外数据中获取报工类型；跳转由工单/路线级控制；节点工序仅来自路线序列项
            reporting_type = extra_data.get("reporting_type") or extra_data.get("reportingType") or "quantity"
            allow_jump = False
            is_node = extra_data.get("is_node_operation")
            if is_node is None:
                is_node = extra_data.get("isNodeOperation")
            is_node = bool(is_node) if is_node is not None else False

            step_explicit = extra_has_over_report_keys(extra_data)
            step_t = parse_over_report_from_extra(extra_data)
            line_t = (OVER_REPORT_NONE, Decimal("0"))
            orm, orv = merge_over_report_layers(
                mat_t,
                tuple_from_model(operation),
                route_def_t,
                step_t,
                step_explicit,
                wo_head_t,
                line_t,
                False,
            )
            
            # 计算计划时间
            # 准备时间
            setup_hours = float(setup_time) if setup_time else 0
            # 标准工时（小时/件）
            standard_hours_per_unit = float(standard_time) if standard_time else 0
            # 总工时 = 准备时间 + 标准工时 * 数量
            total_hours = setup_hours + (standard_hours_per_unit * float(work_order.quantity))
            
            from datetime import timedelta
            planned_start_date = current_time
            planned_end_date = current_time + timedelta(hours=total_hours)
            
            # 创建工序单
            work_order_op = await WorkOrderOperation.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                work_order_id=work_order.id,
                work_order_code=work_order.code,
                operation_id=operation.id,
                operation_code=operation.code,
                operation_name=operation.name,
                sequence=op_data["sequence"],
                workshop_id=workshop_id,
                workshop_name=workshop_name,
                work_center_id=work_center_id,
                work_center_name=work_center_name,
                assigned_worker_id=assigned_worker_id,
                assigned_worker_name=assigned_worker_name,
                assigned_team_id=assigned_team_id,
                assigned_team_name=assigned_team_name,
                assigned_station_id=assigned_station_id,
                assigned_station_name=assigned_station_name,
                assigned_equipment_id=assigned_equipment_id,
                assigned_equipment_name=assigned_equipment_name,
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                standard_time=Decimal(str(standard_hours_per_unit)) if standard_hours_per_unit else None,
                setup_time=Decimal(str(setup_hours)) if setup_hours else None,
                reporting_type=reporting_type,
                allow_jump=allow_jump,
                is_node_operation=is_node,
                over_report_mode=orm,
                over_report_value=orv,
                status='pending',
                created_by=created_by,
                created_by_name=user_info["name"],
            )
            
            work_order_operations.append(work_order_op)
            
            # 下一道工序的开始时间 = 当前工序的结束时间
            current_time = planned_end_date
        
        # 更新工单的计划结束时间（最后一道工序的结束时间）
        if work_order_operations:
            last_op = work_order_operations[-1]
            work_order.planned_end_date = last_op.planned_end_date
            await work_order.save()
        
        logger.info(f"为工单 {work_order.code} 自动生成了 {len(work_order_operations)} 个工序单")
        return work_order_operations

    async def compute_and_apply_operation_planned_times(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        operations: List[WorkOrderOperation],
        updated_by: Optional[int] = None,
    ) -> None:
        """
        根据工单计划开始时间和工序工时，推算并更新各工序的计划时间（供排程服务复用）

        Args:
            tenant_id: 组织ID
            work_order: 工单（需有 planned_start_date）
            operations: 工序列表（需按 sequence 排序）
            updated_by: 更新人ID（可选）
        """
        if not operations:
            return
        planned_start = work_order.planned_start_date or datetime.now()
        current_time = planned_start
        quantity = float(work_order.planned_quantity or work_order.quantity or 1)

        for op in sorted(operations, key=lambda x: x.sequence):
            setup_hours = float(op.setup_time) if op.setup_time else 0
            standard_hours_per_unit = float(op.standard_time) if op.standard_time else 0
            total_hours = setup_hours + (standard_hours_per_unit * quantity)
            if total_hours <= 0:
                total_hours = 1.0

            planned_start_date = current_time
            planned_end_date = current_time + timedelta(hours=total_hours)

            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                id=op.id,
            ).update(
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
            )
            current_time = planned_end_date

        last_op = operations[-1] if operations else None
        if last_op:
            wo_planned_end = current_time
            await WorkOrder.filter(tenant_id=tenant_id, id=work_order.id).update(
                planned_end_date=wo_planned_end,
                updated_by=updated_by,
            )

    async def create_work_order(
        self,
        tenant_id: int,
        work_order_data: WorkOrderCreate,
        created_by: int,
        allow_draft: bool = False
    ) -> WorkOrderResponse:
        """
        创建工单

        Args:
            tenant_id: 组织ID
            work_order_data: 工单创建数据
            created_by: 创建人ID

        Returns:
            WorkOrderResponse: 创建的工单信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 处理工单编码
            # 1. 如果提供了 code，验证唯一性并使用（手工填写）
            # 2. 如果未提供 code 但提供了 code_rule，使用编码规则生成
            # 3. 如果两者都未提供，抛出验证错误
            code = work_order_data.code
            # 获取 code_rule（如果 Schema 中有定义）
            code_rule = getattr(work_order_data, 'code_rule', None)
            
            if code:
                # 手工填写编码，验证唯一性
                existing = await WorkOrder.filter(
                    tenant_id=tenant_id,
                    code=code,
                    deleted_at__isnull=True
                ).first()
                
                if existing:
                    raise ValidationError(f"工单编码 {code} 已存在")
            elif code_rule:
                # 使用编码规则生成编码
                # 构建上下文变量
                today = datetime.now().strftime("%Y%m%d")
                context = {"prefix": f"WO{today}"}
                
                code = await CodeGenerationService.generate_code(
                    tenant_id=tenant_id,
                    rule_code=code_rule,
                    context=context
                )
            else:
                raise ValidationError("必须提供 code 或 code_rule")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 处理产品/物料信息
            # 1. 如果提供了 product_id，验证物料是否存在并获取编码和名称
            # 2. 如果未提供 product_id，则根据 product_code 查找物料
            product_id = work_order_data.product_id
            product_code = work_order_data.product_code
            product_name = work_order_data.product_name
            
            if product_id:
                # 验证物料是否存在
                material = await Material.filter(
                    tenant_id=tenant_id,
                    id=product_id,
                    deleted_at__isnull=True
                ).first()
                
                if not material:
                    raise ValidationError(f"物料ID {product_id} 不存在")
                
                if not material.is_active:
                    raise ValidationError(f"物料ID {product_id} 已停用")
                
                # 使用物料的实际编码和名称（覆盖用户提供的内容）
                product_code = material.code
                product_name = material.name
            elif product_code:
                # 根据 product_code 查找物料
                material = await Material.filter(
                    tenant_id=tenant_id,
                    code=product_code,
                    deleted_at__isnull=True
                ).first()
                
                if not material:
                    raise ValidationError(f"物料编码 {product_code} 不存在")
                
                if not material.is_active:
                    raise ValidationError(f"物料编码 {product_code} 已停用")
                
                product_id = material.id
                product_code = material.code
                if not product_name:
                    product_name = material.name
            else:
                raise ValidationError("必须提供 product_id 或 product_code")

            # 物料来源验证（核心功能，新增）
            # 1. 获取物料来源类型
            source_type = await get_material_source_type(tenant_id, product_id)
            
            # 2. 验证物料来源配置完整性
            if source_type:
                validation_passed, validation_errors = await validate_material_source_config(
                    tenant_id=tenant_id,
                    material_id=product_id,
                    source_type=source_type
                )
                
                # 3. 根据物料来源类型验证是否可以创建工单（allow_draft 时跳过验证，生成草稿由下游补全）
                if not allow_draft:
                    if source_type == SOURCE_TYPE_MAKE:
                        # 自制件：必须有BOM和工艺路线
                        if not validation_passed:
                            error_msg = f"自制件物料来源验证失败，无法创建工单：\n" + "\n".join(validation_errors)
                            logger.warning(f"工单创建失败 - {error_msg}")
                            raise ValidationError(error_msg)
                    elif source_type == SOURCE_TYPE_OUTSOURCE:
                        # 委外件：必须有委外供应商和委外工序（验证失败时不允许创建工单）
                        if not validation_passed:
                            error_msg = f"委外件物料来源验证失败，无法创建工单：\n" + "\n".join(validation_errors)
                            logger.warning(f"工单创建失败 - {error_msg}")
                            raise ValidationError(error_msg)
                elif source_type == SOURCE_TYPE_BUY:
                    # 采购件：不生成生产工单（应该生成采购订单）
                    error_msg = f"采购件不应创建生产工单，物料: {product_code} ({product_name})，请使用采购订单功能"
                    logger.warning(f"工单创建失败 - {error_msg}")
                    raise ValidationError(error_msg)
                elif source_type == SOURCE_TYPE_PHANTOM:
                    # 虚拟件：不生成工单（直接展开到下层物料）
                    error_msg = f"虚拟件不应创建工单，物料: {product_code} ({product_name})，虚拟件会自动展开到下层物料"
                    logger.warning(f"工单创建失败 - {error_msg}")
                    raise ValidationError(error_msg)
                elif source_type == SOURCE_TYPE_CONFIGURE:
                    # 配置件：必须提供属性以确定具体 BOM 配置
                    variant_attrs = getattr(work_order_data, "variant_attributes", None)
                    if not variant_attrs or not isinstance(variant_attrs, dict) or len(variant_attrs) == 0:
                        error_msg = f"配置件必须提供属性（variant_attributes），物料: {product_code} ({product_name})，例如 {{\"color\":\"red\",\"size\":\"M\"}}"
                        logger.warning(f"工单创建失败 - {error_msg}")
                        raise ValidationError(error_msg)
                
                logger.info(f"物料来源验证通过，物料: {product_code} ({product_name}), 来源类型: {source_type}")
            else:
                # 如果没有物料来源类型，默认按自制件处理（向后兼容）
                logger.warning(f"物料 {product_code} 未配置物料来源类型，默认按自制件处理")

            # 来源工艺路线与工序跳转（路线级默认 + 工单快照）
            operations_input = getattr(work_order_data, "operations", None) or []
            has_manual_ops = bool(operations_input and len(operations_input) > 0)
            explicit_pr_id = getattr(work_order_data, "process_route_id", None)

            process_route_resolved: Optional[ProcessRoute] = None
            if explicit_pr_id is not None:
                process_route_resolved = await ProcessRoute.get_or_none(
                    id=explicit_pr_id,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True,
                )
                if not process_route_resolved:
                    raise ValidationError(f"工艺路线不存在或未启用: id={explicit_pr_id}")

            if not process_route_resolved and not has_manual_ops:
                process_route_resolved = await self._match_process_route_for_material(
                    tenant_id=tenant_id,
                    material_id=product_id,
                )

            wo_jump_req = getattr(work_order_data, "allow_operation_jump", None)
            if wo_jump_req is None:
                wo_allow_jump = bool(
                    getattr(process_route_resolved, "allow_operation_jump", False)
                ) if process_route_resolved else False
            else:
                wo_allow_jump = bool(wo_jump_req)

            stored_pr_id: Optional[int] = explicit_pr_id
            if stored_pr_id is None and process_route_resolved and not has_manual_ops:
                stored_pr_id = process_route_resolved.id

            resolved_so_code, resolved_so_name = await _resolve_sales_order_snapshot_fields(
                tenant_id,
                work_order_data.sales_order_id,
                work_order_data.sales_order_code,
                work_order_data.sales_order_name,
            )

            # 创建工单
            work_order = await WorkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=work_order_data.name,
                product_id=product_id,
                product_code=product_code,
                product_name=product_name,
                quantity=work_order_data.quantity,
                production_mode=work_order_data.production_mode,
                sales_order_id=work_order_data.sales_order_id,
                sales_order_code=resolved_so_code,
                sales_order_name=resolved_so_name,
                workshop_id=work_order_data.workshop_id,
                workshop_name=work_order_data.workshop_name,
                work_center_id=work_order_data.work_center_id,
                work_center_name=work_order_data.work_center_name,
                status=work_order_data.status,
                priority=work_order_data.priority,
                planned_start_date=work_order_data.planned_start_date,
                planned_end_date=work_order_data.planned_end_date,
                actual_start_date=work_order_data.actual_start_date,
                actual_end_date=work_order_data.actual_end_date,
                completed_quantity=work_order_data.completed_quantity,
                qualified_quantity=work_order_data.qualified_quantity,
                unqualified_quantity=work_order_data.unqualified_quantity,
                variant_attributes=getattr(work_order_data, "variant_attributes", None),
                configurable_selections=getattr(work_order_data, "configurable_selections", None),
                remarks=work_order_data.remarks,
                allow_operation_jump=wo_allow_jump,
                process_route_id=stored_pr_id,
                over_report_mode=getattr(work_order_data, "over_report_mode", None) or "none",
                over_report_value=getattr(work_order_data, "over_report_value", None) or Decimal("0"),
                created_by=created_by,
                created_by_name=user_info["name"],
            )

            # 记录"创建"节点开始时间（必须在同一事务内，失败时需抛出以触发回滚）
            try:
                timing_service = DocumentTimingService()
                await timing_service.record_node_start(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order.id,
                    document_code=work_order.code,
                    node_name="创建",
                    node_code="created",
                    operator_id=created_by,
                    operator_name=user_info["name"],
                )
            except Exception as e:
                # 节点时间记录失败会导致事务中止，必须重新抛出，否则后续工序单创建会报"当前事务被终止"
                logger.warning(f"记录工单创建节点时间失败: {e}")
                raise

            # 处理工序单（如果提供了 operations，使用提供的工序；否则自动匹配工艺路线）
            operations = getattr(work_order_data, 'operations', None)
            
            if operations and len(operations) > 0:
                # 使用提供的工序创建工单工序单
                try:
                    user_info = await self.get_user_info(created_by)
                    work_order_operations = []
                    
                    # 计算计划时间
                    planned_start = work_order.planned_start_date or datetime.now()
                    current_time = planned_start
                    
                    from apps.kuaizhizao.services.over_report_rules import (
                        OVER_REPORT_NONE,
                        merge_over_report_layers,
                        tuple_from_model,
                        normalize_over_report_mode,
                        to_decimal,
                    )

                    mat_t = tuple_from_model(material)
                    route_empty = (OVER_REPORT_NONE, Decimal("0"))
                    wo_head_t = tuple_from_model(work_order)

                    for idx, op_data in enumerate(operations, 1):
                        # 验证工序是否存在
                        operation = await Operation.get_or_none(
                            id=op_data.operation_id,
                            tenant_id=tenant_id,
                            deleted_at__isnull=True
                        )
                        
                        if not operation:
                            raise ValidationError(f"工序ID {op_data.operation_id} 不存在")
                        
                        # 使用提供的工序数据，如果没有则使用默认值
                        sequence = op_data.sequence if op_data.sequence else idx
                        workshop_id = op_data.workshop_id or work_order.workshop_id
                        workshop_name = op_data.workshop_name or work_order.workshop_name
                        work_center_id = op_data.work_center_id or work_order.work_center_id
                        work_center_name = op_data.work_center_name or work_order.work_center_name
                        
                        # 计算计划时间（如果有标准工时）
                        planned_start_date = op_data.planned_start_date or current_time
                        planned_end_date = op_data.planned_end_date
                        
                        if not planned_end_date and op_data.standard_time:
                            # 根据标准工时计算结束时间
                            from datetime import timedelta
                            standard_hours = float(op_data.standard_time)
                            setup_hours = float(op_data.setup_time) if op_data.setup_time else 0
                            total_hours = setup_hours + (standard_hours * float(work_order.quantity))
                            planned_end_date = planned_start_date + timedelta(hours=total_hours)
                        elif not planned_end_date:
                            # 如果没有标准工时，默认1小时
                            from datetime import timedelta
                            planned_end_date = planned_start_date + timedelta(hours=1)
                        
                        # 创建工序单：报工类型可覆盖；跳转由工单级控制；节点仅来自开单传入
                        rt = getattr(op_data, "reporting_type", None)
                        if rt is None:
                            rt = operation.reporting_type or "quantity"
                        aj = False
                        ino = getattr(op_data, "is_node_operation", None)
                        if ino is not None:
                            ino = bool(ino)
                        else:
                            ino = False

                        fs = getattr(op_data, "model_fields_set", set()) or set()
                        line_explicit = bool(fs & {"over_report_mode", "over_report_value"})
                        if line_explicit:
                            line_t = (
                                normalize_over_report_mode(getattr(op_data, "over_report_mode", None)),
                                to_decimal(getattr(op_data, "over_report_value", None)),
                            )
                        else:
                            line_t = (OVER_REPORT_NONE, Decimal("0"))
                        orm, orv = merge_over_report_layers(
                            mat_t,
                            tuple_from_model(operation),
                            route_empty,
                            route_empty,
                            False,
                            wo_head_t,
                            line_t,
                            line_explicit,
                        )

                        work_order_op = await WorkOrderOperation.create(
                            tenant_id=tenant_id,
                            uuid=str(uuid.uuid4()),
                            work_order_id=work_order.id,
                            work_order_code=work_order.code,
                            operation_id=operation.id,
                            operation_code=operation.code,
                            operation_name=operation.name,
                            sequence=sequence,
                            workshop_id=workshop_id,
                            workshop_name=workshop_name,
                            work_center_id=work_center_id,
                            work_center_name=work_center_name,
                            planned_start_date=planned_start_date,
                            planned_end_date=planned_end_date,
                            standard_time=op_data.standard_time,
                            setup_time=op_data.setup_time,
                            remarks=op_data.remarks,
                            reporting_type=rt,
                            allow_jump=aj,
                            is_node_operation=ino,
                            over_report_mode=orm,
                            over_report_value=orv,
                            status='pending',
                            created_by=created_by,
                            created_by_name=user_info["name"],
                        )
                        
                        work_order_operations.append(work_order_op)
                        current_time = planned_end_date
                    
                    # 更新工单的计划结束时间（最后一道工序的结束时间）
                    if work_order_operations:
                        last_op = work_order_operations[-1]
                        work_order.planned_end_date = last_op.planned_end_date
                        await work_order.save()
                    
                    logger.info(f"工单 {work_order.code} 已创建 {len(work_order_operations)} 个工序单（使用提供的工序）")
                except Exception as e:
                    logger.error(f"为工单 {work_order.code} 创建工序单失败: {e}", exc_info=True)
                    raise ValidationError(f"创建工序单失败: {str(e)}")
            else:
                # 自动按已解析工艺路线生成工序单
                try:
                    if process_route_resolved:
                        await self._generate_work_order_operations_from_route(
                            tenant_id=tenant_id,
                            work_order=work_order,
                            process_route=process_route_resolved,
                            created_by=created_by
                        )
                        logger.info(
                            f"工单 {work_order.code} 已自动生成工序单（基于工艺路线: {process_route_resolved.code}）"
                        )
                    else:
                        logger.warning(f"工单 {work_order.code} 未找到匹配的工艺路线，未自动生成工序单")
                except Exception as e:
                    # 自动生成工序单失败不影响工单创建，记录日志
                    logger.error(f"为工单 {work_order.code} 自动生成工序单失败: {e}", exc_info=True)

            return WorkOrderResponse.model_validate(work_order)

    async def get_work_order_by_id(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> WorkOrderResponse:
        """
        根据ID获取工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID

        Returns:
            WorkOrderResponse: 工单信息

        Raises:
            NotFoundError: 工单不存在
        """
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
        response = WorkOrderResponse.model_validate(work_order)
        # 获取 UniLifecycle 里程碑历史
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_work_order_lifecycle,
            get_document_milestones
        )
        milestones = await get_document_milestones(tenant_id, "work_order", work_order_id)
        response.lifecycle = get_work_order_lifecycle(work_order, milestones=milestones)
        # 制造模式定义在物料主数据：工单 product_id 即本单制造的产品物料，从其 source_config 读取
        if work_order.product_id:
            product = await Material.get_or_none(
                id=work_order.product_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )
            if product and product.source_config and isinstance(product.source_config, dict):
                response.manufacturing_mode = product.source_config.get("manufacturing_mode") or "fabrication"
            else:
                response.manufacturing_mode = "fabrication"
        else:
            response.manufacturing_mode = "fabrication"
        if work_order.sales_order_id and not work_order.sales_order_code:
            rc, rn = await _resolve_sales_order_snapshot_fields(
                tenant_id,
                work_order.sales_order_id,
                work_order.sales_order_code,
                work_order.sales_order_name,
            )
            response.sales_order_code = rc
            response.sales_order_name = rn
        return response

    async def list_work_orders(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        code: Optional[str] = None,
        name: Optional[str] = None,
        product_name: Optional[str] = None,
        production_mode: Optional[str] = None,
        status: Optional[str] = None,
        workshop_id: Optional[int] = None,
        work_center_id: Optional[int] = None,
        assigned_worker_id: Optional[int] = None,
        keyword: Optional[str] = None,
        planned_start_from: Optional[str] = None,
        planned_start_to: Optional[str] = None,
        planned_end_from: Optional[str] = None,
        planned_end_to: Optional[str] = None,
        order_by: Optional[str] = None,
        include_operations: bool = False,
        include_readiness: bool = True,
        include_scores: bool = False,
    ) -> Tuple[List[WorkOrderListResponse], int]:
        """
        获取工单列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            code: 工单编码（模糊搜索）
            name: 工单名称（模糊搜索）
            product_name: 产品名称（模糊搜索）
            production_mode: 生产模式
            status: 工单状态
            workshop_id: 车间ID
            work_center_id: 工作中心ID
            keyword: 关键词搜索（工单编码、名称、产品名称）
            planned_start_from/to: 计划开始日期范围
            planned_end_from/to: 计划结束日期范围
            order_by: 排序，如 code、-created_at
            include_readiness: 为 False 时跳过 BOM 齐套与库存计算（列表页首屏可快一个数量级）

        Returns:
            Tuple[List[WorkOrderListResponse], int]: (工单列表, 总数)
        """
        from tortoise.expressions import Q
        from datetime import datetime

        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True  # 只查询未删除的工单
        )

        # 添加筛选条件
        if code:
            query = query.filter(code__icontains=code)
        if name:
            query = query.filter(name__icontains=name)
        if product_name:
            query = query.filter(product_name__icontains=product_name)
        if production_mode:
            query = query.filter(production_mode=production_mode)
        if status:
            query = query.filter(status=status)
        if workshop_id:
            query = query.filter(workshop_id=workshop_id)
        if work_center_id:
            query = query.filter(work_center_id=work_center_id)
        if assigned_worker_id:
            # 筛选有工序分配给该员工的工单
            wo_ids = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_worker_id=assigned_worker_id,
                deleted_at__isnull=True
            ).values_list("work_order_id", flat=True)
            wo_id_set = set(wo_ids)
            if wo_id_set:
                query = query.filter(id__in=wo_id_set)
            else:
                query = query.filter(id__in=[])  # 无匹配
        if keyword and str(keyword).strip():
            kw = keyword.strip()
            query = query.filter(
                Q(code__icontains=kw) | Q(name__icontains=kw) | Q(product_name__icontains=kw) | Q(product_code__icontains=kw)
            )
        if planned_start_from:
            try:
                dt = datetime.strptime(planned_start_from[:10], "%Y-%m-%d").date()
                query = query.filter(planned_start_date__gte=dt)
            except (ValueError, TypeError):
                pass
        if planned_start_to:
            try:
                dt = datetime.strptime(planned_start_to[:10], "%Y-%m-%d").date()
                query = query.filter(planned_start_date__lte=dt)
            except (ValueError, TypeError):
                pass
        if planned_end_from:
            try:
                dt = datetime.strptime(planned_end_from[:10], "%Y-%m-%d").date()
                query = query.filter(planned_end_date__gte=dt)
            except (ValueError, TypeError):
                pass
        if planned_end_to:
            try:
                dt = datetime.strptime(planned_end_to[:10], "%Y-%m-%d").date()
                query = query.filter(planned_end_date__lte=dt)
            except (ValueError, TypeError):
                pass

        # 获取总数（用于分页）
        total = await query.count()

        # 排序
        order_clause = order_by if order_by else "-created_at"
        work_orders = await query.offset(skip).limit(limit).order_by(order_clause).all()

        # 制造模式：定义在「产品物料」主数据的 source_config；工单通过 product_id（本单制造对象）关联物料后读取，与 get_work_order_by_id 一致
        product_ids = list({wo.product_id for wo in work_orders if wo.product_id})
        manufacturing_mode_by_product: dict[int, str] = {}
        if product_ids:
            materials = await Material.filter(
                tenant_id=tenant_id,
                id__in=product_ids,
                deleted_at__isnull=True,
            ).only("id", "source_config")
            for m in materials:
                sc = m.source_config or {}
                if isinstance(sc, dict):
                    manufacturing_mode_by_product[m.id] = sc.get("manufacturing_mode") or "fabrication"
                else:
                    manufacturing_mode_by_product[m.id] = "fabrication"

        # 列表展示：仅有 sales_order_id、缺编号/名称时，批量补全销售订单快照（历史数据或下推未写冗余字段）
        so_ids_missing_label = list(
            {
                wo.sales_order_id
                for wo in work_orders
                if wo.sales_order_id and not getattr(wo, "sales_order_code", None)
            }
        )
        so_snapshot_map: dict[int, tuple[str, str]] = {}
        if so_ids_missing_label:
            sos = await SalesOrder.filter(
                tenant_id=tenant_id,
                id__in=so_ids_missing_label,
                deleted_at__isnull=True,
            ).only("id", "order_code", "customer_name")
            for so in sos:
                so_snapshot_map[so.id] = (
                    so.order_code,
                    f"{so.order_code} · {so.customer_name}" if so.customer_name else so.order_code,
                )

        # 批量预取 created_by_name（消除 N+1）
        created_by_ids = [wo.created_by for wo in work_orders if wo.created_by and not wo.created_by_name]
        user_name_map: dict[int, str] = {}
        if created_by_ids:
            from infra.models.user import User
            users = await User.filter(id__in=list(set(created_by_ids))).values_list("id", "full_name", "username")
            for uid, full_name, username in users:
                user_name_map[uid] = (full_name or username or "未知用户") if (full_name or username) else "未知用户"

        # 批量预取工序（include_operations 时消除 N+1）
        operations_map: dict[int, list] = {}
        if include_operations and work_orders:
            wo_ids = [wo.id for wo in work_orders]
            if wo_ids:
                all_ops = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id__in=wo_ids,
                    deleted_at__isnull=True
                ).order_by("work_order_id", "sequence").all()
                for op in all_ops:
                    operations_map.setdefault(op.work_order_id, []).append({
                        "id": op.id,
                        "operation_name": op.operation_name,
                        "sequence": op.sequence,
                        "planned_start_date": op.planned_start_date,
                        "planned_end_date": op.planned_end_date,
                        "assigned_equipment_name": op.assigned_equipment_name,
                        "assigned_mold_name": op.assigned_mold_name,
                        "assigned_tool_name": op.assigned_tool_name,
                    })

        # 齐套率：每行 BOM 展开 + 库存汇总，列表页可关闭以换取首屏速度
        wo_requirements_map: dict[int, list] = {}
        all_comp_ids = set()
        inventory_map: dict = {}
        if include_readiness:
            for wo in work_orders:
                if wo.status in ['draft', 'released', 'in_progress']:
                    try:
                        variant_attrs = getattr(wo, "variant_attributes", None)
                        cfg_selections = getattr(wo, "configurable_selections", None)
                        # 转换配置位字典
                        if cfg_selections and isinstance(cfg_selections, dict):
                            try:
                                cfg_selections = {str(k): int(v) for k, v in cfg_selections.items() if v is not None}
                            except (TypeError, ValueError):
                                cfg_selections = None

                        # 与 get_work_order_kitting_analysis / 库位与叫料 一致：齐套按「不拆中间自制件子 BOM」展开，
                        # 否则列表会把子阶物料逐行计入，多数无独立库存 → 齐套率虚低（如 5/12≈41.67%）。
                        requirements = await calculate_material_requirements_from_bom(
                            tenant_id=tenant_id,
                            material_id=wo.product_id,
                            required_quantity=float(wo.quantity),
                            only_approved=True,
                            variant_attributes=variant_attrs,
                            configurable_selections=cfg_selections,
                            for_kitting_analysis=True,
                        )
                        wo_requirements_map[wo.id] = requirements
                        for r in requirements:
                            all_comp_ids.add(r.component_id)
                    except Exception:
                        continue

            from apps.kuaizhizao.utils.inventory_helper import batch_get_material_inventory
            inventory_map = await batch_get_material_inventory(tenant_id, list(all_comp_ids))

        # 转换为响应格式
        result = []
        result_dicts: list[dict] = []
        work_orders_to_update = []

        for wo in work_orders:
            try:
                # 确定创建人名称
                if not wo.created_by_name and wo.created_by:
                    wo.created_by_name = user_name_map.get(wo.created_by, "未知用户")
                    work_orders_to_update.append(wo)

                item_dict = WorkOrderListResponse.model_validate(wo).model_dump()

                if include_readiness:
                    requirements = wo_requirements_map.get(wo.id)
                    if requirements is not None:
                        total_vars = len(requirements)
                        shortage_vars = 0
                        for r in requirements:
                            available = inventory_map.get(r.component_id, Decimal("0"))
                            if available < Decimal(str(r.gross_requirement)):
                                shortage_vars += 1

                        ready_vars = total_vars - shortage_vars
                        item_dict["readiness_rate"] = round((ready_vars / total_vars * 100), 2) if total_vars > 0 else 100.0
                    else:
                        if wo.status == 'completed':
                            item_dict["readiness_rate"] = 100.0
                        elif wo.status == 'cancelled':
                            item_dict["readiness_rate"] = 0.0
                else:
                    item_dict["readiness_rate"] = None

                if include_operations:
                    item_dict["operations"] = operations_map.get(wo.id, [])

                # product_id → 工单制造的产品物料 → 该物料档案上的制造模式
                item_dict["manufacturing_mode"] = manufacturing_mode_by_product.get(
                    wo.product_id, "fabrication"
                ) if wo.product_id else "fabrication"

                if wo.sales_order_id and not item_dict.get("sales_order_code"):
                    snap = so_snapshot_map.get(wo.sales_order_id)
                    if snap:
                        item_dict["sales_order_code"] = snap[0]
                        item_dict["sales_order_name"] = snap[1]

                result_dicts.append(item_dict)
            except Exception as e:
                logger.error(f"处理工单 {wo.id} 数据失败: {str(e)}")
                continue

        if include_scores and result_dicts:
            from apps.kuaizhizao.services.work_order_score_service import WorkOrderScoreService
            await WorkOrderScoreService().attach_scores_to_list_items(tenant_id, result_dicts)

        for item_dict in result_dicts:
            try:
                result.append(WorkOrderListResponse.model_validate(item_dict))
            except Exception as e:
                logger.error(f"工单列表响应校验失败: {str(e)}")
                continue

        # 批量更新 created_by_name 为空的工单（性能优化：使用 bulk_update 减少数据库往返）
        if work_orders_to_update:
            await WorkOrder.bulk_update(work_orders_to_update, fields=["created_by_name"])

        return result, total

    async def get_work_order_count(
        self,
        tenant_id: int,
        code: Optional[str] = None,
        name: Optional[str] = None,
        product_name: Optional[str] = None,
        production_mode: Optional[str] = None,
        status: Optional[str] = None,
        workshop_id: Optional[int] = None,
        work_center_id: Optional[int] = None,
        assigned_worker_id: Optional[int] = None,
    ) -> int:
        """
        获取工单总数（用于分页）

        Args:
            tenant_id: 组织ID
            code: 工单编码（模糊搜索）
            name: 工单名称（模糊搜索）
            product_name: 产品名称（模糊搜索）
            production_mode: 生产模式
            status: 工单状态
            workshop_id: 车间ID
            work_center_id: 工作中心ID
            assigned_worker_id: 分配员工ID

        Returns:
            int: 工单总数
        """
        query = WorkOrder.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True  # 只查询未删除的工单
        )

        # 添加筛选条件（与 list_work_orders 保持一致）
        if code:
            query = query.filter(code__icontains=code)
        if name:
            query = query.filter(name__icontains=name)
        if product_name:
            query = query.filter(product_name__icontains=product_name)
        if production_mode:
            query = query.filter(production_mode=production_mode)
        if status:
            query = query.filter(status=status)
        if workshop_id:
            query = query.filter(workshop_id=workshop_id)
        if work_center_id:
            query = query.filter(work_center_id=work_center_id)
        if assigned_worker_id:
            from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
            wo_ids = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                assigned_worker_id=assigned_worker_id,
                deleted_at__isnull=True
            ).values_list("work_order_id", flat=True)
            wo_id_set = set(wo_ids)
            if wo_id_set:
                query = query.filter(id__in=wo_id_set)
            else:
                query = query.filter(id__in=[])

        return await query.count()

    async def update_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        work_order_data: WorkOrderUpdate,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        更新工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            work_order_data: 工单更新数据
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            update_data = work_order_data.model_dump(exclude_unset=True)

            if "process_route_id" in update_data:
                new_pr_id = update_data.pop("process_route_id")
                old_pr_id = getattr(work_order, "process_route_id", None)
                if new_pr_id != old_pr_id:
                    if work_order.status != "draft":
                        raise BusinessLogicError("仅草稿状态的工单可修改来源工艺路线")
                    rc = await ReportingRecord.filter(
                        tenant_id=tenant_id,
                        work_order_id=work_order_id,
                    ).count()
                    if rc > 0:
                        raise BusinessLogicError("已有报工记录，不能更换来源工艺路线")
                    existing_ops = await WorkOrderOperation.filter(
                        tenant_id=tenant_id,
                        work_order_id=work_order_id,
                        deleted_at__isnull=True,
                    ).all()
                    if any(getattr(o, "status", None) != "pending" for o in existing_ops):
                        raise BusinessLogicError("存在非待开始工序，不能更换来源工艺路线")
                    if new_pr_id is None:
                        if existing_ops:
                            raise BusinessLogicError("存在工序时不能清空来源工艺路线")
                    else:
                        pr = await ProcessRoute.get_or_none(
                            id=new_pr_id,
                            tenant_id=tenant_id,
                            deleted_at__isnull=True,
                        )
                        if not pr:
                            raise NotFoundError(f"工艺路线不存在: id={new_pr_id}")
                        now = now_utc()
                        for op in existing_ops:
                            op.deleted_at = now
                            await op.save()
                        await self._generate_work_order_operations_from_route(
                            tenant_id=tenant_id,
                            work_order=work_order,
                            process_route=pr,
                            created_by=updated_by,
                        )
                    update_data["process_route_id"] = new_pr_id
                else:
                    update_data["process_route_id"] = new_pr_id

            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=updated_by,
                **update_data
            )

            return WorkOrderResponse.model_validate(work_order)

    async def batch_update_dates(
        self,
        tenant_id: int,
        updates: list,
        updated_by: int,
    ) -> None:
        """
        批量更新工单计划日期（甘特图拖拽后持久化）

        Args:
            tenant_id: 组织ID
            updates: 更新项列表，每项包含 work_order_id、planned_start_date、planned_end_date
            updated_by: 更新人ID
        """
        if not updates:
            return
        async with in_transaction():
            for item in updates[:50]:  # 单次最多 50 条
                wo_id = item.work_order_id if hasattr(item, 'work_order_id') else item.get('work_order_id')
                start = item.planned_start_date if hasattr(item, 'planned_start_date') else item.get('planned_start_date')
                end = item.planned_end_date if hasattr(item, 'planned_end_date') else item.get('planned_end_date')
                if not wo_id or not start or not end:
                    continue
                wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=wo_id)
                if wo:
                    wo.planned_start_date = start
                    wo.planned_end_date = end
                    wo.updated_by = updated_by
                    await wo.save()

    async def batch_update_operation_dates(
        self,
        tenant_id: int,
        updates: list,
        updated_by: int,
    ) -> None:
        """
        批量更新工序计划日期（工序级派工，甘特图拖拽工序后持久化）

        Args:
            tenant_id: 组织ID
            updates: 更新项列表，每项包含 operation_id、planned_start_date、planned_end_date
            updated_by: 更新人ID
        """
        if not updates:
            return
        async with in_transaction():
            for item in updates[:50]:
                op_id = item.operation_id if hasattr(item, 'operation_id') else item.get('operation_id')
                start = item.planned_start_date if hasattr(item, 'planned_start_date') else item.get('planned_start_date')
                end = item.planned_end_date if hasattr(item, 'planned_end_date') else item.get('planned_end_date')
                if not op_id or not start or not end:
                    continue
                op = await WorkOrderOperation.get_or_none(tenant_id=tenant_id, id=op_id)
                if op:
                    await WorkOrderOperation.filter(tenant_id=tenant_id, id=op_id).update(
                        planned_start_date=start,
                        planned_end_date=end,
                    )
                    wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=op.work_order_id)
                    if wo:
                        ops = await WorkOrderOperation.filter(
                            tenant_id=tenant_id,
                            work_order_id=op.work_order_id,
                            deleted_at__isnull=True,
                        ).order_by("sequence").all()
                        wo_start = min(
                            (o.planned_start_date for o in ops if o.planned_start_date),
                            default=wo.planned_start_date,
                        )
                        wo_end = max(
                            (o.planned_end_date for o in ops if o.planned_end_date),
                            default=wo.planned_end_date,
                        )
                        if wo_start and wo_end:
                            await WorkOrder.filter(tenant_id=tenant_id, id=op.work_order_id).update(
                                planned_start_date=wo_start,
                                planned_end_date=wo_end,
                                updated_by=updated_by,
                            )

    async def delete_work_order(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> None:
        """
        删除工单（软删除）

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许删除的工单状态
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            def validate_work_order(wo):
                """验证工单是否可以删除"""
                # 允许删除草稿、已取消或已下达但未执行的工单
                if wo.status == 'released':
                    # 已下达但未开始执行（无实际开始时间且无产出）
                    if wo.actual_start_date or (wo.completed_quantity and wo.completed_quantity > 0):
                        raise ValidationError("已开始执行的工单不能删除")
                elif wo.status not in ['draft', 'cancelled']:
                    raise ValidationError("只能删除草稿、已取消或未执行的工单")

            validate_work_order(work_order)

            # 检查是否有报工记录（包括待审核的）
            reporting_count = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id
            ).count()
            
            if reporting_count > 0:
                raise ValidationError("工单存在相关的报工记录，不允许删除")

            now = now_utc()

            # 级联软删除工单工序
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True
            ).update(deleted_at=now)

            # 软删除工单
            await WorkOrder.filter(
                tenant_id=tenant_id,
                id=work_order_id
            ).update(deleted_at=now)

    async def check_material_shortage(
        self,
        tenant_id: int,
        work_order_id: int,
        warehouse_id: Optional[int] = None
    ) -> dict:
        """
        检查工单缺料情况

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            warehouse_id: 仓库ID（可选，如果为None则查询所有仓库）

        Returns:
            dict: 缺料检测结果，包含：
            - has_shortage: 是否有缺料
            - shortage_items: 缺料明细列表
            - total_shortage_count: 缺料物料总数
        """
        work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

        # 获取BOM物料需求（配置件时传入 variant_attributes，配置位时传入 configurable_selections）
        try:
            variant_attrs = getattr(work_order, "variant_attributes", None)
            cfg_selections = getattr(work_order, "configurable_selections", None)
            if cfg_selections and isinstance(cfg_selections, dict):
                try:
                    cfg_selections = {str(k): int(v) for k, v in cfg_selections.items() if v is not None}
                except (TypeError, ValueError):
                    cfg_selections = None
            material_requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=work_order.product_id,
                required_quantity=float(work_order.quantity),
                only_approved=True,
                variant_attributes=variant_attrs,
                configurable_selections=cfg_selections,
            )
        except NotFoundError:
            # 如果没有BOM，返回无缺料
            logger.warning(f"工单 {work_order.code} 的产品 {work_order.product_id} 没有BOM，跳过缺料检测")
            return {
                "has_shortage": False,
                "shortage_items": [],
                "total_shortage_count": 0
            }

        shortage_items = []
        
        # 检查每个物料的需求和库存
        for requirement in material_requirements:
            # 获取可用库存
            available_quantity = await get_material_available_quantity(
                tenant_id=tenant_id,
                material_id=requirement.component_id,
                warehouse_id=warehouse_id
            )
            
            # 计算缺料数量
            shortage_quantity = max(Decimal(0), Decimal(str(requirement.net_requirement)) - available_quantity)
            
            if shortage_quantity > 0:
                shortage_items.append({
                    "material_id": requirement.component_id,
                    "material_code": requirement.component_code,
                    "material_name": requirement.component_name,
                    "required_quantity": float(requirement.net_requirement),
                    "available_quantity": float(available_quantity),
                    "shortage_quantity": float(shortage_quantity),
                    "unit": requirement.unit
                })

        return {
            "has_shortage": len(shortage_items) > 0,
            "shortage_items": shortage_items,
            "total_shortage_count": len(shortage_items),
            "work_order_id": work_order_id,
            "work_order_code": work_order.code,
            "work_order_name": work_order.name
        }

    async def release_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        released_by: int,
        check_shortage: bool = True
    ) -> WorkOrderResponse:
        """
        下达工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            released_by: 下达人ID
            check_shortage: 是否在下达前检查缺料（默认：True）

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许下达的工单状态
            BusinessLogicError: 存在缺料时抛出（如果check_shortage=True）
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            if work_order.status != 'draft':
                raise ValidationError("只能下达草稿状态的工单")

            # 检查缺料（按参数开关 + 缺料拦截级别在“下达”阶段是否生效）
            block_level = await BusinessConfigService().get_material_shortage_block_level(tenant_id)
            if check_shortage and _material_shortage_block_applies(block_level, "release"):
                shortage_result = await self.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id
                )
                if shortage_result.get("has_shortage"):
                    shortage_items = shortage_result.get("shortage_items") or []
                    total_shortage_count = int(shortage_result.get("total_shortage_count") or len(shortage_items) or 0)
                    shortage_materials = ", ".join([
                        f"{item['material_name']}(缺{item['shortage_quantity']}{item['unit']})"
                        for item in shortage_items[:3]
                    ])
                    raise BusinessLogicError(
                        f"工单存在缺料，无法下达。缺料物料：{shortage_materials}"
                        + (f"等{total_shortage_count}种物料" if total_shortage_count > 3 else "")
                    )

            # 更新状态
            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=released_by,
                status='released'
            )

            # 记录节点时间
            try:
                timing_service = DocumentTimingService()
                # 结束"创建"节点
                await timing_service.record_node_end(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order_id,
                    node_code="created",
                    operator_id=released_by,
                )
                # 开始"下达"节点
                released_by_info = await self.get_user_info(released_by)
                await timing_service.record_node_start(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order_id,
                    document_code=work_order.code,
                    node_name="下达",
                    node_code="released",
                    operator_id=released_by,
                    operator_name=released_by_info["name"],
                )
            except Exception as e:
                # 节点时间记录失败不影响主流程，记录日志
                logger.warning(f"记录工单下达节点时间失败: {e}")

            return WorkOrderResponse.model_validate(work_order)

    async def update_work_order_status(
        self,
        tenant_id: int,
        work_order_id: int,
        status: str,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        更新工单状态

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            status: 新状态
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息
        """
        work_order = await self.update_with_user(
            tenant_id=tenant_id,
            record_id=work_order_id,
            updated_by=updated_by,
            status=status
        )
        return WorkOrderResponse.model_validate(work_order)

    async def check_delayed_work_orders(
        self,
        tenant_id: int,
        days_threshold: int = 0,
        status: Optional[str] = None
    ) -> List[dict]:
        """
        检查延期工单

        Args:
            tenant_id: 组织ID
            days_threshold: 延期天数阈值（默认0，即只要超过计划结束日期就算延期）
            status: 工单状态过滤（可选）

        Returns:
            List[dict]: 延期工单列表，每个元素包含：
            - work_order_id: 工单ID
            - work_order_code: 工单编码
            - work_order_name: 工单名称
            - planned_end_date: 计划结束日期
            - actual_end_date: 实际结束日期
            - delay_days: 延期天数
            - status: 工单状态
        """
        now = datetime.now(timezone.utc)
        query = WorkOrder.filter(
            tenant_id=tenant_id
        )

        # 状态过滤
        if status:
            query = query.filter(status=status)
        else:
            # 默认只查询未完成的工单
            query = query.filter(status__in=['released', 'in_progress'])

        # 查询有计划结束日期的工单，过期判断在 Python 侧统一时区后处理
        query = query.filter(
            planned_end_date__isnull=False,
        )

        work_orders = await query.all()
        delayed_orders = []

        for wo in work_orders:
            if wo.planned_end_date:
                planned_end = wo.planned_end_date
                # 统一时间基准，避免 naive / aware datetime 直接相减导致 TypeError
                if planned_end.tzinfo is None:
                    planned_end = planned_end.replace(tzinfo=timezone.utc)
                else:
                    planned_end = planned_end.astimezone(timezone.utc)
                if planned_end >= now:
                    continue

                # 计算延期天数
                if wo.actual_end_date:
                    # 如果已完工，使用实际结束日期
                    actual_end = wo.actual_end_date
                    if actual_end.tzinfo is None:
                        actual_end = actual_end.replace(tzinfo=timezone.utc)
                    else:
                        actual_end = actual_end.astimezone(timezone.utc)
                    delay_days = (actual_end - planned_end).days
                else:
                    # 如果未完工，使用当前日期
                    delay_days = (now - planned_end).days

                # 如果超过阈值，加入列表
                if delay_days > days_threshold:
                    delayed_orders.append({
                        "work_order_id": wo.id,
                        "work_order_code": wo.code,
                        "work_order_name": wo.name,
                        "product_name": wo.product_name,
                        "planned_end_date": wo.planned_end_date.isoformat() if wo.planned_end_date else None,
                        "actual_end_date": wo.actual_end_date.isoformat() if wo.actual_end_date else None,
                        "delay_days": delay_days,
                        "status": wo.status,
                        "priority": wo.priority
                    })

        # 按延期天数降序排序
        delayed_orders.sort(key=lambda x: x["delay_days"], reverse=True)
        return delayed_orders

    async def analyze_delay_reasons(
        self,
        tenant_id: int,
        work_order_id: Optional[int] = None
    ) -> dict:
        """
        分析延期原因

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID（可选，如果为None则分析所有延期工单）

        Returns:
            dict: 延期原因分析结果，包含：
            - total_delayed: 延期工单总数
            - delay_reasons: 延期原因统计
            - work_orders: 延期工单详情列表
        """
        if work_order_id:
            # 分析单个工单
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            delayed_orders = await self.check_delayed_work_orders(
                tenant_id=tenant_id,
                status=work_order.status
            )
            # 过滤出指定工单
            delayed_orders = [wo for wo in delayed_orders if wo["work_order_id"] == work_order_id]
        else:
            # 分析所有延期工单
            delayed_orders = await self.check_delayed_work_orders(tenant_id=tenant_id)

        # 分析延期原因
        delay_reasons = {
            "material_shortage": 0,  # 缺料
            "capacity_shortage": 0,  # 产能不足
            "quality_issue": 0,  # 质量问题
            "planning_issue": 0,  # 计划问题
            "other": 0  # 其他
        }

        # TODO: 根据实际业务逻辑分析延期原因
        # 这里可以根据工单的关联数据（如缺料记录、报工记录、检验记录等）来判断延期原因
        for order in delayed_orders:
            # 简化实现：根据工单状态和延期天数推断原因
            if order["status"] == "released":
                # 已下达但未开始，可能是缺料或产能问题
                delay_reasons["material_shortage"] += 1
            elif order["status"] == "in_progress":
                # 进行中但延期，可能是产能或质量问题
                if order["delay_days"] > 7:
                    delay_reasons["capacity_shortage"] += 1
                else:
                    delay_reasons["planning_issue"] += 1
            else:
                delay_reasons["other"] += 1

        return {
            "total_delayed": len(delayed_orders),
            "delay_reasons": delay_reasons,
            "work_orders": delayed_orders
        }

    async def split_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        split_data: WorkOrderSplitRequest,
        created_by: int
    ) -> WorkOrderSplitResponse:
        """
        拆分工单

        支持按数量拆分。按工序拆分功能暂未实现。

        Args:
            tenant_id: 组织ID
            work_order_id: 原工单ID
            split_data: 拆分数据
            created_by: 创建人ID

        Returns:
            WorkOrderSplitResponse: 拆分结果

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误（如已报工不能拆分）
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "split", False):
                raise BusinessLogicError("当前组织未开启工单拆分能力，请在参数设置中开启“工单拆分”")

            # 获取原工单
            original_work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 检查工单状态（只能拆分草稿或已下达状态的工单）
            if original_work_order.status not in ['draft', 'released']:
                raise BusinessLogicError(f"只能拆分草稿或已下达状态的工单，当前状态：{original_work_order.status}")

            # 检查是否已报工（只能拆分未报工部分）
            reporting_records = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                status='approved',
                deleted_at__isnull=True
            ).all()

            if reporting_records:
                # 计算已报工数量
                total_reported = sum(Decimal(str(r.qualified_quantity)) for r in reporting_records)
                if total_reported > 0:
                    raise BusinessLogicError(f"工单已有报工记录（已报工数量：{total_reported}），不能拆分。只能拆分未报工的工单。")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            split_work_orders = []

            if split_data.split_type == 'quantity':
                # 按数量拆分
                if split_data.split_quantities:
                    # 指定每个拆分工单的数量
                    quantities = split_data.split_quantities
                    total_split_quantity = sum(quantities)
                    
                    if total_split_quantity > original_work_order.quantity:
                        raise ValidationError(f"拆分工单数量总和（{total_split_quantity}）不能大于原工单数量（{original_work_order.quantity}）")
                    
                    if total_split_quantity < original_work_order.quantity:
                        raise ValidationError(f"拆分工单数量总和（{total_split_quantity}）必须等于原工单数量（{original_work_order.quantity}）")
                    
                    for idx, quantity in enumerate(quantities, 1):
                        if quantity <= 0:
                            raise ValidationError(f"拆分数量必须大于0，第{idx}个拆分工单数量：{quantity}")
                        
                        # 生成拆分工单编码
                        split_code = f"{original_work_order.code}-{idx:03d}"
                        
                        # 创建拆分工单
                        split_work_order = await WorkOrder.create(
                            tenant_id=tenant_id,
                            uuid=str(uuid.uuid4()),
                            code=split_code,
                            name=f"{original_work_order.name}-拆分{idx}",
                            product_id=original_work_order.product_id,
                            product_code=original_work_order.product_code,
                            product_name=original_work_order.product_name,
                            quantity=quantity,
                            production_mode=original_work_order.production_mode,
                            sales_order_id=original_work_order.sales_order_id,
                            sales_order_code=original_work_order.sales_order_code,
                            sales_order_name=original_work_order.sales_order_name,
                            workshop_id=original_work_order.workshop_id,
                            workshop_name=original_work_order.workshop_name,
                            work_center_id=original_work_order.work_center_id,
                            work_center_name=original_work_order.work_center_name,
                            status=original_work_order.status,
                            priority=original_work_order.priority,
                            planned_start_date=original_work_order.planned_start_date,
                            planned_end_date=original_work_order.planned_end_date,
                            remarks=split_data.remarks or f"从工单{original_work_order.code}拆分",
                            created_by=created_by,
                            created_by_name=user_info["name"],
                        )
                        split_work_orders.append(split_work_order)
                
                elif split_data.split_count:
                    # 等量拆分
                    if split_data.split_count <= 1:
                        raise ValidationError("拆分数量必须大于1")
                    
                    split_quantity = original_work_order.quantity / Decimal(str(split_data.split_count))
                    
                    # 验证是否能整除
                    if split_quantity * split_data.split_count != original_work_order.quantity:
                        raise ValidationError(f"原工单数量（{original_work_order.quantity}）不能被拆分数（{split_data.split_count}）整除")
                    
                    for idx in range(1, split_data.split_count + 1):
                        # 生成拆分工单编码
                        split_code = f"{original_work_order.code}-{idx:03d}"
                        
                        # 创建拆分工单
                        split_work_order = await WorkOrder.create(
                            tenant_id=tenant_id,
                            uuid=str(uuid.uuid4()),
                            code=split_code,
                            name=f"{original_work_order.name}-拆分{idx}",
                            product_id=original_work_order.product_id,
                            product_code=original_work_order.product_code,
                            product_name=original_work_order.product_name,
                            quantity=split_quantity,
                            production_mode=original_work_order.production_mode,
                            sales_order_id=original_work_order.sales_order_id,
                            sales_order_code=original_work_order.sales_order_code,
                            sales_order_name=original_work_order.sales_order_name,
                            workshop_id=original_work_order.workshop_id,
                            workshop_name=original_work_order.workshop_name,
                            work_center_id=original_work_order.work_center_id,
                            work_center_name=original_work_order.work_center_name,
                            status=original_work_order.status,
                            priority=original_work_order.priority,
                            planned_start_date=original_work_order.planned_start_date,
                            planned_end_date=original_work_order.planned_end_date,
                            remarks=split_data.remarks or f"从工单{original_work_order.code}拆分",
                            created_by=created_by,
                            created_by_name=user_info["name"],
                        )
                        split_work_orders.append(split_work_order)
                else:
                    raise ValidationError("按数量拆分时必须提供split_quantities或split_count")
            
            elif split_data.split_type == 'operation':
                # 按工序拆分（TODO: 需要工序模型支持，暂时返回错误）
                raise ValidationError("按工序拆分功能暂未实现，请使用按数量拆分")
            else:
                raise ValidationError(f"不支持的拆分类型：{split_data.split_type}")

            # 更新原工单状态为已取消（拆分后原工单不再使用）
            original_work_order.status = 'cancelled'
            original_work_order.updated_by = created_by
            original_work_order.updated_by_name = user_info["name"]
            await original_work_order.save()

            # 建立原工单→拆分工单的 DocumentRelation（支持单据追溯）
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                for split_wo in split_work_orders:
                    try:
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=original_work_order.id,
                                source_code=original_work_order.code,
                                source_name=original_work_order.name,
                                target_type="work_order",
                                target_id=split_wo.id,
                                target_code=split_wo.code,
                                target_name=split_wo.name,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单拆分",
                            ),
                            created_by=created_by,
                        )
                    except BusinessLogicError:
                        pass  # 关联已存在，忽略
            except Exception as e:
                logger.warning("建立工单拆分关联失败: %s", e)

            logger.info(f"工单 {original_work_order.code} 拆分为 {len(split_work_orders)} 个工单")

            return WorkOrderSplitResponse(
                original_work_order_id=original_work_order.id,
                original_work_order_code=original_work_order.code,
                split_work_orders=[WorkOrderResponse.model_validate(wo) for wo in split_work_orders],
                total_count=len(split_work_orders),
            )

    async def _resolve_manufacturing_mode(self, tenant_id: int, product_id: Optional[int]) -> str:
        """product_id 为工单制造对象对应物料 id；制造模式定义在该物料 source_config，与 get_work_order_by_id 一致。"""
        if not product_id:
            return "fabrication"
        product = await Material.get_or_none(
            id=product_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        )
        if product and product.source_config and isinstance(product.source_config, dict):
            return product.source_config.get("manufacturing_mode") or "fabrication"
        return "fabrication"

    async def get_work_order_operations(
        self,
        tenant_id: int,
        work_order_id: int,
        *,
        include_meta: bool = False,
    ) -> Union[List[WorkOrderOperationResponse], Dict[str, Any]]:
        """
        获取工单工序列表（含物料汇总，供工序卡片人机料法展示）

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            include_meta: 为 True 时返回 {"manufacturing_mode", "operations"}，减少列表行展开时的二次 HTTP。

        Returns:
            工序列表，或带 manufacturing_mode 的字典（include_meta=True 时）
        """
        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True
        )
        if not work_order:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        plan_qty = float(work_order.quantity or 1)

        # 已领料物料种类数（首道工序用）
        picked_material_count = 0
        pickings = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status="已领料",
            deleted_at__isnull=True
        ).all()
        if pickings:
            picking_ids = [p.id for p in pickings]
            items = await ProductionPickingItem.filter(
                tenant_id=tenant_id,
                picking_id__in=picking_ids
            ).all()
            material_ids = set()
            for it in items:
                if it.material_id and (float(it.picked_quantity or 0) > 0):
                    material_ids.add(it.material_id)
            picked_material_count = len(material_ids)

        # 按工序汇总报废数量
        scrap_records = await ScrapRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            status__in=["draft", "confirmed"],
            deleted_at__isnull=True
        ).all()
        scrap_by_op = {}
        for sr in scrap_records:
            k = sr.operation_id
            scrap_by_op[k] = scrap_by_op.get(k, Decimal("0")) + (sr.scrap_quantity or Decimal("0"))

        operations = await WorkOrderOperation.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True
        ).order_by('sequence').all()

        master_op_ids = [op.operation_id for op in operations if op.operation_id is not None]
        defect_by_master_op = await batch_get_operation_defect_types_via_table(master_op_ids)

        # 批量查询工序关联的 SOP（法）
        op_ids = [op.operation_id for op in operations]
        sops = await SOP.filter(
            tenant_id=tenant_id,
            operation_id__in=op_ids,
            is_active=True,
            deleted_at__isnull=True
        ).all()
        sop_by_op = {s.operation_id: s for s in sops}

        default_snap_by_master = await _batch_default_operators_snapshots_by_master_operation_id(
            tenant_id, op_ids
        )

        prev_qualified = Decimal(str(plan_qty))
        result = []
        for idx, op in enumerate(operations):
            defect_types_raw = defect_by_master_op.get(op.operation_id, [])
            defect_types = [DefectTypeMinimal(uuid=dt["uuid"], code=dt["code"], name=dt["name"]) for dt in defect_types_raw]
            op_data = {f: getattr(op, f, None) for f in WorkOrderOperationResponse.model_fields if hasattr(op, f)}
            op_data["defect_types"] = defect_types

            qualified = op.qualified_quantity or Decimal("0")
            # 物料剩余：上道合格 - 本道合格；首道为 计划 - 本道合格
            material_remaining = prev_qualified - qualified
            if material_remaining < 0:
                material_remaining = Decimal("0")
            op_data["material_remaining"] = material_remaining

            op_data["material_scrap_qty"] = scrap_by_op.get(op.operation_id)

            if idx == 0 and picked_material_count > 0:
                op_data["material_picked_count"] = picked_material_count

            next_op = operations[idx + 1] if idx + 1 < len(operations) else None
            op_data["next_op_planned_qty"] = qualified
            op_data["next_op_has_reporting"] = bool(next_op and (next_op.completed_quantity or 0) > 0) if next_op else None

            sop = sop_by_op.get(op.operation_id)
            if sop:
                op_data["sop_id"] = sop.id
                op_data["sop_uuid"] = getattr(sop, "uuid", None)
                op_data["sop_name"] = sop.name

            op_data["max_reportable_quantity"] = _max_reportable_quantity_for_op(work_order, op)
            op_data["default_operators"] = default_snap_by_master.get(op.operation_id, [])

            prev_qualified = qualified
            result.append(WorkOrderOperationResponse.model_validate(op_data))
        if include_meta:
            mm = await self._resolve_manufacturing_mode(tenant_id, work_order.product_id)
            return {"manufacturing_mode": mm, "operations": result}
        return result

    async def update_work_order_operations(
        self,
        tenant_id: int,
        work_order_id: int,
        operations_data: WorkOrderOperationsUpdateRequest,
        updated_by: int
    ) -> list[WorkOrderOperationResponse]:
        """
        更新工单工序

        支持工序的增删改和顺序调整。已报工的工序不允许修改。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            operations_data: 工序数据
            updated_by: 更新人ID

        Returns:
            list[WorkOrderOperationResponse]: 更新后的工单工序列表

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 数据验证失败
            BusinessLogicError: 业务逻辑错误（如已报工工序不能修改）
        """
        async with in_transaction():
            # 获取原工单
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 检查工单状态（允许修改草稿、已下达或执行中的工单）
            # 执行中的工单只能修改未报工的工序
            if work_order.status not in ['draft', 'released', 'in_progress']:
                raise BusinessLogicError(f"只能修改草稿、已下达或执行中状态的工单工序，当前状态：{work_order.status}")

            # 获取现有工序
            existing_operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True
            ).all()

            # 检查已报工的工序
            reported_operation_ids = set()
            for op in existing_operations:
                # 检查该工序是否有已审核的报工记录
                reporting_records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    operation_id=op.operation_id,
                    status='approved',
                    deleted_at__isnull=True
                ).all()
                
                if reporting_records:
                    reported_operation_ids.add(op.id)

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            from apps.kuaizhizao.services.over_report_rules import (
                OVER_REPORT_NONE,
                merge_over_report_layers,
                tuple_from_model,
                normalize_over_report_mode,
                to_decimal,
            )

            material_row = await Material.get_or_none(
                id=work_order.product_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True,
            )
            mat_t = tuple_from_model(material_row)
            route_empty = (OVER_REPORT_NONE, Decimal("0"))
            wo_head_t = tuple_from_model(work_order)

            # 构建新工序ID集合（用于判断哪些工序需要删除）
            new_operation_ids = {op.id for op in existing_operations if op.id not in reported_operation_ids}
            updated_operation_ids = set()

            # 处理工序更新和新增
            for idx, op_data in enumerate(operations_data.operations, 1):
                # 检查是否是要更新的现有工序（通过sequence匹配，且未报工）
                existing_op = None
                for eop in existing_operations:
                    if eop.sequence == op_data.sequence and eop.id not in reported_operation_ids:
                        existing_op = eop
                        break

                if existing_op:
                    # 更新现有工序
                    if existing_op.id in reported_operation_ids:
                        raise BusinessLogicError(f"工序 {existing_op.operation_name} 已有报工记录，不能修改")

                    op_id_changed = existing_op.operation_id != op_data.operation_id
                    # 更新工序信息
                    existing_op.operation_id = op_data.operation_id
                    existing_op.operation_code = op_data.operation_code
                    existing_op.operation_name = op_data.operation_name
                    existing_op.sequence = op_data.sequence
                    existing_op.workshop_id = op_data.workshop_id
                    existing_op.workshop_name = op_data.workshop_name
                    existing_op.work_center_id = op_data.work_center_id
                    existing_op.work_center_name = op_data.work_center_name
                    existing_op.planned_start_date = op_data.planned_start_date
                    existing_op.planned_end_date = op_data.planned_end_date
                    existing_op.standard_time = op_data.standard_time
                    existing_op.setup_time = op_data.setup_time
                    existing_op.remarks = op_data.remarks
                    master_op = None
                    if op_id_changed:
                        master_op = await Operation.get_or_none(
                            tenant_id=tenant_id,
                            id=op_data.operation_id,
                            deleted_at__isnull=True,
                        )
                    if getattr(op_data, "reporting_type", None) is not None:
                        existing_op.reporting_type = op_data.reporting_type or "quantity"
                    elif op_id_changed and master_op:
                        existing_op.reporting_type = master_op.reporting_type or "quantity"
                    existing_op.allow_jump = False
                    if getattr(op_data, "is_node_operation", None) is not None:
                        existing_op.is_node_operation = bool(op_data.is_node_operation)
                    elif op_id_changed:
                        existing_op.is_node_operation = False
                    fs_or = getattr(op_data, "model_fields_set", set()) or set()
                    if fs_or & {"over_report_mode", "over_report_value"}:
                        existing_op.over_report_mode = normalize_over_report_mode(
                            getattr(op_data, "over_report_mode", None)
                        )
                        existing_op.over_report_value = to_decimal(getattr(op_data, "over_report_value", None))
                    elif op_id_changed and master_op:
                        orm, orv = merge_over_report_layers(
                            mat_t,
                            tuple_from_model(master_op),
                            route_empty,
                            route_empty,
                            False,
                            wo_head_t,
                            (OVER_REPORT_NONE, Decimal("0")),
                            False,
                        )
                        existing_op.over_report_mode = orm
                        existing_op.over_report_value = orv
                    existing_op.updated_by = updated_by
                    existing_op.updated_by_name = user_info["name"]
                    await existing_op.save()
                    updated_operation_ids.add(existing_op.id)
                else:
                    # 创建新工序（报工类型、跳转、节点自工序档案继承）
                    master_op = await Operation.get_or_none(
                        tenant_id=tenant_id,
                        id=op_data.operation_id,
                        deleted_at__isnull=True,
                    )
                    reporting_type = op_data.reporting_type if getattr(op_data, "reporting_type", None) is not None else None
                    if reporting_type is None:
                        reporting_type = (master_op.reporting_type or "quantity") if master_op else "quantity"
                    allow_jump_new = False
                    is_node_new = (
                        bool(op_data.is_node_operation)
                        if getattr(op_data, "is_node_operation", None) is not None
                        else False
                    )
                    fs_new = getattr(op_data, "model_fields_set", set()) or set()
                    line_explicit = bool(fs_new & {"over_report_mode", "over_report_value"})
                    if line_explicit:
                        line_t = (
                            normalize_over_report_mode(getattr(op_data, "over_report_mode", None)),
                            to_decimal(getattr(op_data, "over_report_value", None)),
                        )
                    else:
                        line_t = (OVER_REPORT_NONE, Decimal("0"))
                    orm, orv = merge_over_report_layers(
                        mat_t,
                        tuple_from_model(master_op),
                        route_empty,
                        route_empty,
                        False,
                        wo_head_t,
                        line_t,
                        line_explicit,
                    )
                    new_op = await WorkOrderOperation.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        work_order_id=work_order_id,
                        work_order_code=work_order.code,
                        operation_id=op_data.operation_id,
                        operation_code=op_data.operation_code,
                        operation_name=op_data.operation_name,
                        sequence=op_data.sequence,
                        workshop_id=op_data.workshop_id,
                        workshop_name=op_data.workshop_name,
                        work_center_id=op_data.work_center_id,
                        work_center_name=op_data.work_center_name,
                        planned_start_date=op_data.planned_start_date,
                        planned_end_date=op_data.planned_end_date,
                        standard_time=op_data.standard_time,
                        setup_time=op_data.setup_time,
                        reporting_type=reporting_type,
                        allow_jump=allow_jump_new,
                        is_node_operation=is_node_new,
                        over_report_mode=orm,
                        over_report_value=orv,
                        status='pending',
                        remarks=op_data.remarks,
                        created_by=updated_by,
                        created_by_name=user_info["name"],
                    )
                    updated_operation_ids.add(new_op.id)

            # 删除未更新的未报工工序
            for op in existing_operations:
                if op.id not in updated_operation_ids and op.id not in reported_operation_ids:
                    op.deleted_at = now_utc()
                    op.updated_by = updated_by
                    op.updated_by_name = user_info["name"]
                    await op.save()

            # 重新计算工单计划结束时间（基于所有工序的计划时间）
            operations = await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                deleted_at__isnull=True
            ).order_by('planned_end_date').all()

            if operations and operations[-1].planned_end_date:
                work_order.planned_end_date = operations[-1].planned_end_date
                work_order.updated_by = updated_by
                work_order.updated_by_name = user_info["name"]
                await work_order.save()

            logger.info(f"工单 {work_order.code} 的工序已更新")

            # 返回更新后的工序列表
            return await self.get_work_order_operations(tenant_id, work_order_id)

    async def dispatch_work_order_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        dispatch_data: WorkOrderOperationDispatch,
        dispatched_by: int
    ) -> WorkOrderOperationResponse:
        """
        派工工单工序

        分配工序给具体的人员或设备。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            operation_id: 工单工序ID
            dispatch_data: 派工数据
            dispatched_by: 派工人ID

        Returns:
            WorkOrderOperationResponse: 更新后的工单工序
        """
        async with in_transaction():
            # 获取工单工序
            work_order_operation = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                id=operation_id,
                deleted_at__isnull=True
            )

            if not work_order_operation:
                raise NotFoundError(f"工单工序不存在: 工单ID={work_order_id}, 工序ID={operation_id}")

            # 获取派工人信息
            user_info = await self.get_user_info(dispatched_by)

            # 更新派工信息（车间/工作中心仅当请求体显式包含对应字段时更新，兼容旧客户端）
            dispatch_patch = dispatch_data.model_dump(exclude_unset=True)
            if "workshop_id" in dispatch_patch or "workshop_name" in dispatch_patch:
                work_order_operation.workshop_id = dispatch_data.workshop_id
                work_order_operation.workshop_name = dispatch_data.workshop_name
            if "work_center_id" in dispatch_patch or "work_center_name" in dispatch_patch:
                work_order_operation.work_center_id = dispatch_data.work_center_id
                work_order_operation.work_center_name = dispatch_data.work_center_name
            work_order_operation.assigned_worker_id = dispatch_data.assigned_worker_id
            work_order_operation.assigned_worker_name = dispatch_data.assigned_worker_name
            work_order_operation.assigned_team_id = dispatch_data.assigned_team_id
            work_order_operation.assigned_team_name = dispatch_data.assigned_team_name
            work_order_operation.assigned_station_id = dispatch_data.assigned_station_id
            work_order_operation.assigned_station_name = dispatch_data.assigned_station_name
            work_order_operation.assigned_equipment_id = dispatch_data.assigned_equipment_id
            work_order_operation.assigned_equipment_name = dispatch_data.assigned_equipment_name
            work_order_operation.assigned_mold_id = dispatch_data.assigned_mold_id
            work_order_operation.assigned_mold_name = dispatch_data.assigned_mold_name
            work_order_operation.assigned_tool_id = dispatch_data.assigned_tool_id
            work_order_operation.assigned_tool_name = dispatch_data.assigned_tool_name
            work_order_operation.assigned_at = datetime.now()
            work_order_operation.assigned_by = dispatched_by
            work_order_operation.assigned_by_name = user_info["name"]
            
            if dispatch_data.remarks:
                work_order_operation.remarks = dispatch_data.remarks

            await work_order_operation.save()

            logger.info(f"工单 {work_order_operation.work_order_code} 的工序 {work_order_operation.operation_name} 已派工")

            wo = await WorkOrder.get_or_none(
                tenant_id=tenant_id,
                id=work_order_operation.work_order_id,
                deleted_at__isnull=True,
            )
            if not wo:
                raise NotFoundError("工单不存在")
            op_payload = {
                f: getattr(work_order_operation, f, None)
                for f in WorkOrderOperationResponse.model_fields
                if hasattr(work_order_operation, f)
            }
            op_payload["max_reportable_quantity"] = _max_reportable_quantity_for_op(wo, work_order_operation)
            dmap = await _batch_default_operators_snapshots_by_master_operation_id(
                tenant_id, [work_order_operation.operation_id]
            )
            op_payload["default_operators"] = dmap.get(work_order_operation.operation_id, [])
            return WorkOrderOperationResponse.model_validate(op_payload)

    async def start_work_order_operation(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        started_by: int
    ) -> WorkOrderOperationResponse:
        """
        开始工单工序

        将工序状态从 pending 更新为 in_progress，并记录实际开始时间。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            operation_id: 工单工序ID（不是工序模板的ID）
            started_by: 开始人ID

        Returns:
            WorkOrderOperationResponse: 更新后的工单工序

        Raises:
            NotFoundError: 工单或工序不存在
            BusinessLogicError: 业务逻辑错误（如工序状态不正确）
        """
        async with in_transaction():
            # 获取工单
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 冻结态禁止开工
            if getattr(work_order, "is_frozen", False):
                raise BusinessLogicError(f"工单已冻结，不能开工。冻结原因：{getattr(work_order, 'freeze_reason', None) or '无'}")

            biz_cfg = BusinessConfigService()
            manufacturing_mode = await self._resolve_manufacturing_mode(tenant_id, work_order.product_id)
            is_assembly_mode = str(manufacturing_mode or "").strip().lower() == "assembly"

            # 开工领料规则：
            # - 工艺型（fabrication）：允许不领料开工（不受“开工前需确认领料”策略限制）
            # - 装配型（assembly）：由流程设置「开工前必须确认领料」控制是否必须先确认领料
            if is_assembly_mode:
                policy = await biz_cfg.get_work_order_picking_policy(tenant_id)
                if policy.get("require_confirmed_picking_before_operation_start", False):
                    has_confirmed = await self.has_confirmed_picking_for_work_order(tenant_id, work_order_id)
                    if not has_confirmed:
                        raise BusinessLogicError("装配型工单未确认领料，禁止开工：请先确认该工单的领料单")

            block_level = await BusinessConfigService().get_material_shortage_block_level(tenant_id)
            if _material_shortage_block_applies(block_level, "operation_start"):
                shortage_result = await self.check_material_shortage(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id
                )
                if shortage_result.get("has_shortage"):
                    shortage_items = shortage_result.get("shortage_items") or []
                    total_shortage_count = int(shortage_result.get("total_shortage_count") or len(shortage_items) or 0)
                    shortage_materials = ", ".join([
                        f"{item['material_name']}(缺{item['shortage_quantity']}{item['unit']})"
                        for item in shortage_items[:3]
                    ])
                    raise BusinessLogicError(
                        "工单存在缺料，无法开工。缺料物料："
                        + shortage_materials
                        + (
                            f"等{total_shortage_count}种物料"
                            if total_shortage_count > 3
                            else ""
                        )
                    )

            # 检查工单状态
            if work_order.status not in ['released', 'in_progress']:
                raise BusinessLogicError(f"只能开始已下达或进行中的工单的工序，当前工单状态：{work_order.status}")

            # 获取工单工序
            work_order_operation = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                id=operation_id,
                deleted_at__isnull=True
            )

            if not work_order_operation:
                raise NotFoundError(f"工单工序不存在: 工单ID={work_order_id}, 工序ID={operation_id}")

            # 检查工序状态
            if work_order_operation.status != 'pending':
                raise BusinessLogicError(f"只能开始待开始状态的工序，当前状态：{work_order_operation.status}")

            # 检查跳转规则：工单或工序任一方允许跳转则放宽；节点工序在允许跳转时仍不可跳过
            from apps.kuaizhizao.services.operation_jump_rules import (
                effective_allow_jump,
                validate_start_respects_node_operations,
            )

            allow_jump = effective_allow_jump(work_order, work_order_operation)

            if not allow_jump:
                # 只检查上一道工序：只要有产出即可开始（报工数量由 reporting_service 校验不超过上一道完工数）
                previous_operations = await WorkOrderOperation.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    sequence__lt=work_order_operation.sequence,
                    deleted_at__isnull=True
                ).order_by('-sequence').limit(1).all()

                if previous_operations:
                    prev_op = previous_operations[0]
                    if (prev_op.completed_quantity or 0) <= 0:
                        raise BusinessLogicError(f"前序工序 {prev_op.operation_name} 尚无产出，不能开始当前工序")
            else:
                await validate_start_respects_node_operations(
                    tenant_id, work_order_id, work_order_operation
                )

            # 获取开始人信息
            user_info = await self.get_user_info(started_by)

            # 更新工序状态
            work_order_operation.status = 'in_progress'
            work_order_operation.actual_start_date = datetime.now()
            work_order_operation.updated_by = started_by
            work_order_operation.updated_by_name = user_info["name"]
            await work_order_operation.save()

            # 如果工单状态是 released，更新为 in_progress
            if work_order.status == 'released':
                work_order.status = 'in_progress'
                work_order.actual_start_date = work_order.actual_start_date or datetime.now()
                work_order.updated_by = started_by
                work_order.updated_by_name = user_info["name"]
                await work_order.save()

            op_payload = {
                f: getattr(work_order_operation, f, None)
                for f in WorkOrderOperationResponse.model_fields
                if hasattr(work_order_operation, f)
            }
            op_payload["max_reportable_quantity"] = _max_reportable_quantity_for_op(work_order, work_order_operation)
            dmap = await _batch_default_operators_snapshots_by_master_operation_id(
                tenant_id, [work_order_operation.operation_id]
            )
            op_payload["default_operators"] = dmap.get(work_order_operation.operation_id, [])
            return WorkOrderOperationResponse.model_validate(op_payload)

    async def freeze_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        freeze_data: WorkOrderFreezeRequest,
        frozen_by: int
    ) -> WorkOrderResponse:
        """
        冻结工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            freeze_data: 冻结数据（包含冻结原因）
            frozen_by: 冻结人ID

        Returns:
            WorkOrderResponse: 冻结后的工单信息

        Raises:
            NotFoundError: 工单不存在
            BusinessLogicError: 工单已冻结或状态不允许冻结
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 检查工单是否已冻结
            if work_order.is_frozen:
                raise BusinessLogicError("工单已冻结，不能重复冻结")

            # 获取冻结人信息
            user_info = await self.get_user_info(frozen_by)

            # 更新冻结信息
            work_order.is_frozen = True
            work_order.freeze_reason = freeze_data.freeze_reason
            work_order.frozen_at = datetime.now()
            work_order.frozen_by = frozen_by
            work_order.frozen_by_name = user_info["name"]
            work_order.updated_by = frozen_by
            work_order.updated_by_name = user_info["name"]
            await work_order.save()

            logger.info(f"工单 {work_order.code} 已冻结，原因：{freeze_data.freeze_reason}")

            return WorkOrderResponse.model_validate(work_order)

    async def unfreeze_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        unfreeze_data: WorkOrderUnfreezeRequest,
        unfrozen_by: int
    ) -> WorkOrderResponse:
        """
        解冻工单

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            unfreeze_data: 解冻数据（可选解冻原因）
            unfrozen_by: 解冻人ID

        Returns:
            WorkOrderResponse: 解冻后的工单信息

        Raises:
            NotFoundError: 工单不存在
            BusinessLogicError: 工单未冻结
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 检查工单是否已冻结
            if not work_order.is_frozen:
                raise BusinessLogicError("工单未冻结，不能解冻")

            # 获取解冻人信息
            user_info = await self.get_user_info(unfrozen_by)

            # 清除冻结信息（保留冻结历史记录，可通过freeze_reason等字段查看）
            work_order.is_frozen = False
            # 保留freeze_reason、frozen_at、frozen_by等字段作为历史记录
            work_order.updated_by = unfrozen_by
            work_order.updated_by_name = user_info["name"]
            await work_order.save()

            logger.info(f"工单 {work_order.code} 已解冻")

            return WorkOrderResponse.model_validate(work_order)

    async def set_work_order_priority(
        self,
        tenant_id: int,
        work_order_id: int,
        priority_data: WorkOrderPriorityRequest,
        updated_by: int
    ) -> WorkOrderResponse:
        """
        设置工单优先级

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            priority_data: 优先级数据
            updated_by: 更新人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 优先级值无效
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "priority", False):
                raise BusinessLogicError("当前组织未开启工单优先级能力，请在参数设置中开启“工单优先级”")

            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 验证优先级值
            valid_priorities = ['low', 'normal', 'high', 'urgent']
            if priority_data.priority not in valid_priorities:
                raise ValidationError(f"优先级值无效，必须是以下之一：{', '.join(valid_priorities)}")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 更新优先级
            work_order.priority = priority_data.priority
            work_order.updated_by = updated_by
            work_order.updated_by_name = user_info["name"]
            await work_order.save()

            logger.info(f"工单 {work_order.code} 优先级已设置为 {priority_data.priority}")

            from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                dispatch_work_order_score_recalc,
            )
            await dispatch_work_order_score_recalc(work_order_id, include_kitting=False)

            return WorkOrderResponse.model_validate(work_order)

    async def batch_set_work_order_priority(
        self,
        tenant_id: int,
        batch_data: WorkOrderBatchPriorityRequest,
        updated_by: int
    ) -> List[WorkOrderResponse]:
        """
        批量设置工单优先级

        Args:
            tenant_id: 组织ID
            batch_data: 批量优先级数据
            updated_by: 更新人ID

        Returns:
            List[WorkOrderResponse]: 更新后的工单信息列表

        Raises:
            ValidationError: 优先级值无效或工单ID列表为空
            NotFoundError: 部分工单不存在
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "priority", False):
                raise BusinessLogicError("当前组织未开启工单优先级能力，请在参数设置中开启“工单优先级”")

            # 验证优先级值
            valid_priorities = ['low', 'normal', 'high', 'urgent']
            if batch_data.priority not in valid_priorities:
                raise ValidationError(f"优先级值无效，必须是以下之一：{', '.join(valid_priorities)}")

            if not batch_data.work_order_ids:
                raise ValidationError("工单ID列表不能为空")

            # 获取更新人信息
            user_info = await self.get_user_info(updated_by)

            # 批量更新工单优先级
            updated_work_orders = []
            for work_order_id in batch_data.work_order_ids:
                work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
                work_order.priority = batch_data.priority
                work_order.updated_by = updated_by
                work_order.updated_by_name = user_info["name"]
                await work_order.save()
                updated_work_orders.append(WorkOrderResponse.model_validate(work_order))

            logger.info(f"批量设置 {len(updated_work_orders)} 个工单的优先级为 {batch_data.priority}")

            from apps.kuaizhizao.workflows.functions.work_order_score_workflow import (
                dispatch_work_order_score_recalc,
            )
            for work_order_id in batch_data.work_order_ids:
                await dispatch_work_order_score_recalc(work_order_id, include_kitting=False)

            return updated_work_orders

    async def get_work_order_kitting_analysis(
        self,
        tenant_id: int,
        work_order_id: int
    ) -> WorkOrderKittingAnalysisResponse:
        """
        获取工单齐套性分析

        逻辑：
        1. 展开 BOM 需求
        2. 统计已领料数量
        3. 获取实时库位库存（主仓 + 线边仓）
        4. 计算齐套状态
        """
        from tortoise.functions import Sum

        # 1. 获取工单
        wo = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
        if not wo:
            raise NotFoundError(f"工单不存在: {work_order_id}")

        # 2. 从 BOM 计算物料需求
        try:
            requirements = await calculate_material_requirements_from_bom(
                tenant_id=tenant_id,
                material_id=wo.product_id,
                required_quantity=float(wo.quantity),
                only_approved=True,
                variant_attributes=wo.variant_attributes,
                configurable_selections=wo.configurable_selections,
                for_kitting_analysis=True,
            )
        except Exception as e:
            logger.warning(f"BOM 展开失败: {e}")
            requirements = []

        if not requirements:
            return WorkOrderKittingAnalysisResponse(
                work_order_id=work_order_id,
                work_order_code=wo.code,
                kitting_rate=Decimal("0"),
                status="no_bom",
                items=[]
            )

        # 3. 聚合分析
        analysis_items = []
        total_items = len(requirements)
        fully_kitted_count = 0

        # 领料单明细未声明 ForeignKey，不能使用 picking__work_order_id；明细表亦无 deleted_at
        picking_ids = await ProductionPicking.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            deleted_at__isnull=True,
        ).values_list("id", flat=True)
        picking_id_list = list(picking_ids) if picking_ids else []

        for req in requirements:
            # 3.1 获取已领料数量 (从 ProductionPickingItem 汇总)
            # 状态为“已领料”或“已确认”的视为已下线到车间/线边
            if not picking_id_list:
                picked_qty = Decimal("0")
            else:
                # Tortoise QuerySet 无 Django 式 .aggregate()，用 annotate + values 汇总
                agg_rows = await ProductionPickingItem.filter(
                    tenant_id=tenant_id,
                    picking_id__in=picking_id_list,
                    material_id=req.component_id,
                    status__in=["已领料", "已确认", "picked", "confirmed"],
                ).annotate(total=Sum("picked_quantity")).values("total")
                raw_total = (agg_rows[0]["total"] if agg_rows else None) or 0
                picked_qty = Decimal(str(raw_total))

            # 3.2 获取实时库位分布
            locations_data = await get_material_detailed_locations(tenant_id, req.component_id)
            locations: List[MaterialLocationInfo] = []
            for loc in locations_data:
                try:
                    qv = loc.get("quantity")
                    locations.append(
                        MaterialLocationInfo(
                            warehouse_id=int(loc.get("warehouse_id") or 0),
                            warehouse_name=str(loc.get("warehouse_name") or ""),
                            batch_no=loc.get("batch_no"),
                            quantity=Decimal(str(qv)) if qv is not None else Decimal("0"),
                            storage_location_code=loc.get("storage_location_code"),
                        )
                    )
                except Exception as exc:
                    logger.warning(f"齐套分析库位行解析跳过: {loc} err={exc}")

            # 3.3 计算按仓库类型的汇总库存
            main_warehouse_qty = Decimal("0")
            line_side_qty = Decimal("0")
            
            # 这里简单通过名称或 warehouse_id 判断（生产实务中通常 warehouse_id 段位不同或有辅助字段）
            # 我们在 inventory_helper 里标记了 wh_id=0 为主仓，>0 且匹配类型为线边仓
            for loc in locations_data:
                try:
                    q = Decimal(str(loc.get("quantity") or 0))
                except Exception:
                    q = Decimal("0")
                if loc.get("storage_location_code") == "线边位":
                    line_side_qty += q
                else:
                    main_warehouse_qty += q

            required_qty = Decimal(str(req.gross_requirement))
            shortage_qty = required_qty - picked_qty
            if shortage_qty < 0:
                shortage_qty = Decimal("0")

            # 3.4 判定状态
            # 可用总量 = 已领 + 线边 + 主仓
            total_available = picked_qty + line_side_qty + main_warehouse_qty
            
            if total_available >= required_qty:
                item_status = "fully_kitted"
                fully_kitted_count += 1
            elif total_available > picked_qty:
                item_status = "partial"
            else:
                item_status = "shortage"

            analysis_items.append(MaterialKittingItem(
                material_id=req.component_id,
                material_code=req.component_code,
                material_name=req.component_name,
                material_unit=req.unit,
                required_quantity=required_qty,
                picked_quantity=picked_qty,
                shortage_quantity=shortage_qty,
                main_warehouse_available=main_warehouse_qty,
                line_side_available=line_side_qty,
                status=item_status,
                locations=locations
            ))

        # 4. 汇总
        kitting_rate = Decimal(str(round(fully_kitted_count / total_items * 100, 2))) if total_items > 0 else Decimal("100")
        
        overall_status = "fully_kitted"
        if kitting_rate < 100:
            overall_status = "partial" if kitting_rate > 0 else "shortage"

        return WorkOrderKittingAnalysisResponse(
            work_order_id=work_order_id,
            work_order_code=wo.code,
            kitting_rate=kitting_rate,
            status=overall_status,
            items=analysis_items
        )

    async def merge_work_orders(
        self,
        tenant_id: int,
        merge_data: WorkOrderMergeRequest,
        created_by: int
    ) -> WorkOrderMergeResponse:
        """
        合并工单

        Args:
            tenant_id: 组织ID
            merge_data: 合并数据
            created_by: 创建人ID

        Returns:
            WorkOrderMergeResponse: 合并结果

        Raises:
            ValidationError: 数据验证失败
            NotFoundError: 工单不存在
            BusinessLogicError: 业务逻辑错误（如不能合并）
        """
        async with in_transaction():
            if not await self._is_work_order_param_enabled(tenant_id, "merge", False):
                raise BusinessLogicError("当前组织未开启工单合并能力，请在参数设置中开启“工单合并”")

            if len(merge_data.work_order_ids) < 2:
                raise ValidationError("至少需要2个工单才能合并")

            # 获取所有要合并的工单
            work_orders = []
            for work_order_id in merge_data.work_order_ids:
                work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
                work_orders.append(work_order)

            # 验证合并规则1：只能合并相同产品的工单
            first_product_id = work_orders[0].product_id
            for work_order in work_orders[1:]:
                if work_order.product_id != first_product_id:
                    raise BusinessLogicError(f"只能合并相同产品的工单，工单 {work_order.code} 的产品与第一个工单不同")

            # 验证合并规则2：只能合并相同状态的工单（draft/released）
            first_status = work_orders[0].status
            if first_status not in ['draft', 'released']:
                raise BusinessLogicError(f"只能合并草稿或已下达状态的工单，第一个工单状态为：{first_status}")
            
            for work_order in work_orders[1:]:
                if work_order.status != first_status:
                    raise BusinessLogicError(f"只能合并相同状态的工单，工单 {work_order.code} 的状态与第一个工单不同")

            # 验证合并规则3：不能合并已报工的工单
            for work_order in work_orders:
                reporting_records = await ReportingRecord.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    status='approved',
                    deleted_at__isnull=True
                ).all()
                if reporting_records:
                    total_reported = sum(Decimal(str(r.qualified_quantity)) for r in reporting_records)
                    if total_reported > 0:
                        raise BusinessLogicError(f"工单 {work_order.code} 已有报工记录（已报工数量：{total_reported}），不能合并")

            # 验证合并规则4：不能合并已冻结的工单
            for work_order in work_orders:
                if work_order.is_frozen:
                    raise BusinessLogicError(f"工单 {work_order.code} 已冻结，不能合并")

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 计算合并后的数量（累加）
            total_quantity = sum(work_order.quantity for work_order in work_orders)

            # 生成合并后工单编码
            today = datetime.now().strftime("%Y%m%d")
            merged_code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="WORK_ORDER_CODE",
                prefix=f"WO{today}"
            )

            # 构建原工单编码列表（用于备注和响应）
            original_codes = [wo.code for wo in work_orders]
            original_ids = [wo.id for wo in work_orders]

            # 构建合并备注
            merge_remarks = f"由工单 {', '.join(original_codes)} 合并而成"
            if merge_data.remarks:
                merge_remarks = f"{merge_remarks}。{merge_data.remarks}"

            # 创建合并后的工单（以第一个工单的信息为基础）
            first_work_order = work_orders[0]
            merged_work_order = await WorkOrder.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=merged_code,
                name=f"{first_work_order.name}（合并）",
                product_id=first_work_order.product_id,
                product_code=first_work_order.product_code,
                product_name=first_work_order.product_name,
                quantity=total_quantity,
                production_mode=first_work_order.production_mode,
                sales_order_id=first_work_order.sales_order_id,
                sales_order_code=first_work_order.sales_order_code,
                sales_order_name=first_work_order.sales_order_name,
                workshop_id=first_work_order.workshop_id,
                workshop_name=first_work_order.workshop_name,
                work_center_id=first_work_order.work_center_id,
                work_center_name=first_work_order.work_center_name,
                status=first_status,
                priority=first_work_order.priority,
                planned_start_date=first_work_order.planned_start_date,
                planned_end_date=first_work_order.planned_end_date,
                remarks=merge_remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            # 更新原工单状态为cancelled
            for work_order in work_orders:
                work_order.status = 'cancelled'
                work_order.updated_by = created_by
                work_order.updated_by_name = user_info["name"]
                await work_order.save()

            # 建立原工单→合并工单 的 DocumentRelation（支持单据追溯）
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                for work_order in work_orders:
                    try:
                        await rel_svc.create_relation(
                            tenant_id=tenant_id,
                            relation_data=DocumentRelationCreate(
                                source_type="work_order",
                                source_id=work_order.id,
                                source_code=work_order.code,
                                source_name=work_order.name,
                                target_type="work_order",
                                target_id=merged_work_order.id,
                                target_code=merged_work_order.code,
                                target_name=merged_work_order.name,
                                relation_type="source",
                                relation_mode="push",
                                relation_desc="工单合并",
                            ),
                            created_by=created_by,
                        )
                    except Exception as wo_rel_e:
                        logger.warning("创建工单合并单据关联失败(工单%s): %s", work_order.code, wo_rel_e)
            except Exception as e:
                logger.warning("创建工单合并单据关联失败: %s", e)

            logger.info(f"成功合并 {len(work_orders)} 个工单（{', '.join(original_codes)}）为新工单 {merged_code}")

            return WorkOrderMergeResponse(
                merged_work_order=WorkOrderResponse.model_validate(merged_work_order),
                original_work_order_ids=original_ids,
                original_work_order_codes=original_codes,
            )

    async def revoke_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        revoked_by: int
    ) -> WorkOrderResponse:
        """
        撤回工单（从已下达或指定结束状态撤回为草稿状态）

        撤回条件：
        - 工单状态为 'released'（已下达）或 'completed'（已完成且为指定结束）
        - 工单没有产生过报工记录

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            revoked_by: 撤回人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许撤回的工单状态
            BusinessLogicError: 工单已有报工记录，不允许撤回
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)

            # 检查工单状态：只能撤回已下达、执行中或已完成（且为指定结束）的工单
            if work_order.status not in ['released', 'in_progress', 'completed']:
                raise ValidationError(f"当前工单状态不支持撤回，当前状态：{work_order.status}")

            # 如果是已完成状态，必须是指定结束的工单才能撤回
            if work_order.status == 'completed' and not work_order.manually_completed:
                raise ValidationError("只能撤回指定结束的工单，正常完成的工单不允许撤回")

            # 检查是否有报工记录
            reporting_records = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id
            ).all()

            if reporting_records:
                raise BusinessLogicError("工单已有报工记录，不允许撤回。只能撤回未报工的工单。")

            # 兜底保护：检查是否有产出（即便报工记录缺失）
            completed_qty = work_order.completed_quantity or Decimal("0")
            if completed_qty > 0:
                raise BusinessLogicError("工单已有完工数量，不允许撤回。")

            # 保存原始状态用于节点时间记录
            original_status = work_order.status

            # 更新状态为草稿，并重置实际执行时间
            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=revoked_by,
                status='draft',
                manually_completed=False,  # 清除指定结束标记
                actual_start_date=None,
                actual_end_date=None
            )

            # 同步重置所有工序的状态和时间
            await WorkOrderOperation.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id
            ).update(
                status='pending',
                actual_start_date=None,
                actual_end_date=None,
                completed_quantity=0,
                qualified_quantity=0,
                unqualified_quantity=0
            )

            # 记录节点时间
            try:
                timing_service = DocumentTimingService()
                # 结束"下达"节点（如果存在）
                if original_status == 'released':
                    await timing_service.record_node_end(
                        tenant_id=tenant_id,
                        document_type="work_order",
                        document_id=work_order_id,
                        node_code="released",
                        operator_id=revoked_by,
                    )
                elif original_status == 'completed':
                    await timing_service.record_node_end(
                        tenant_id=tenant_id,
                        document_type="work_order",
                        document_id=work_order_id,
                        node_code="completed",
                        operator_id=revoked_by,
                    )
            except Exception as e:
                # 节点时间记录失败不影响主流程，记录日志
                logger.warning(f"记录工单撤回节点时间失败: {e}")

            logger.info(f"工单 {work_order.code} 已撤回为草稿状态")
            return WorkOrderResponse.model_validate(work_order)

    async def manually_complete_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        completed_by: int
    ) -> WorkOrderResponse:
        """
        指定结束工单

        将工单状态改为已完成，并标记为指定结束。

        Args:
            tenant_id: 组织ID
            work_order_id: 工单ID
            completed_by: 完成人ID

        Returns:
            WorkOrderResponse: 更新后的工单信息

        Raises:
            NotFoundError: 工单不存在
            ValidationError: 不允许指定结束的工单状态
        """
        async with in_transaction():
            work_order = await self.get_by_id(tenant_id, work_order_id, raise_if_not_found=True)
            previous_status = str(getattr(work_order, "status", "") or "")

            # 检查工单状态：不能对已取消的工单指定结束
            if previous_status == 'cancelled':
                raise ValidationError("已取消的工单不能指定结束")

            # 仅允许对已下达/执行中的工单做指定结束；草稿及其他异常状态应先规范到可执行状态。
            allowed_statuses = {"released", "in_progress", "completed"}
            if previous_status not in allowed_statuses:
                raise ValidationError("只能对已下达或进行中的工单指定结束")

            # 如果已经是已完成状态，直接返回
            if previous_status == 'completed':
                return WorkOrderResponse.model_validate(work_order)

            # 更新状态为已完成，并标记为指定结束
            from datetime import datetime
            work_order = await self.update_with_user(
                tenant_id=tenant_id,
                record_id=work_order_id,
                updated_by=completed_by,
                status='completed',
                manually_completed=True,
                actual_end_date=datetime.now()  # 设置实际结束时间
            )

            # 记录节点时间
            try:
                timing_service = DocumentTimingService()
                # 结束当前节点（如果存在）
                if previous_status in ['released', 'in_progress']:
                    current_node = 'released' if previous_status == 'released' else 'in_progress'
                    await timing_service.record_node_end(
                        tenant_id=tenant_id,
                        document_type="work_order",
                        document_id=work_order_id,
                        node_code=current_node,
                        operator_id=completed_by,
                    )
                # 开始"完成"节点
                completed_by_info = await self.get_user_info(completed_by)
                await timing_service.record_node_start(
                    tenant_id=tenant_id,
                    document_type="work_order",
                    document_id=work_order_id,
                    document_code=work_order.code,
                    node_name="完成",
                    node_code="completed",
                    operator_id=completed_by,
                    operator_name=completed_by_info["name"],
                )
            except Exception as e:
                # 节点时间记录失败不影响主流程，记录日志
                logger.warning(f"记录工单指定结束节点时间失败: {e}")

            logger.info(f"工单 {work_order.code} 已指定结束")
            return WorkOrderResponse.model_validate(work_order)
