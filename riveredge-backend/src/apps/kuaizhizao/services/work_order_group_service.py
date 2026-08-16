"""
工单组服务：创建工单组、按需求行 BOM 树下推成员工单。
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from loguru import logger

from apps.common.audit_actor import audit_response_fields
from apps.common.base_service import AppBaseService
from apps.kuaizhizao.models.demand_computation import DemandComputation
from apps.kuaizhizao.models.demand_computation_item import DemandComputationItem
from apps.kuaizhizao.models.outsource_work_order import OutsourceWorkOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_group import WorkOrderGroup
from apps.kuaizhizao.utils.material_source_helper import (
    SOURCE_TYPE_CONFIGURE,
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_OUTSOURCE,
)
from apps.kuaizhizao.utils.work_order_group_bom_tree import (
    allocate_suggested_quantity,
    flatten_production_tree,
    quantize_qty,
    tree_has_direct_supply,
)
from infra.exceptions.exceptions import BusinessLogicError, ValidationError


class WorkOrderGroupService(AppBaseService):
    """工单组业务逻辑。"""

    async def should_group_by_demand_item(self, tenant_id: int) -> bool:
        from infra.services.business_config_service import BusinessConfigService

        cfg = await BusinessConfigService().get_business_config(tenant_id)
        wo_cfg = (cfg.get("parameters") or {}).get("work_order") or {}
        if "group_by_demand_item" in wo_cfg:
            return bool(wo_cfg.get("group_by_demand_item"))
        return True

    async def list_groups_by_computation(
        self,
        tenant_id: int,
        computation_id: int,
    ) -> List[Dict[str, Any]]:
        groups = await WorkOrderGroup.filter(
            tenant_id=tenant_id,
            demand_computation_id=computation_id,
            deleted_at__isnull=True,
        ).order_by("id").all()
        result = []
        for g in groups:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                work_order_group_id=g.id,
                deleted_at__isnull=True,
            ).all()
            outsource = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                work_order_group_id=g.id,
                deleted_at__isnull=True,
            ).all()
            result.append(await self._group_to_dict(g, work_orders, outsource))
        return result

    async def get_group_detail(
        self,
        tenant_id: int,
        group_id: int,
    ) -> Dict[str, Any]:
        group = await WorkOrderGroup.get_or_none(
            tenant_id=tenant_id, id=group_id, deleted_at__isnull=True
        )
        if not group:
            from infra.exceptions.exceptions import NotFoundError

            raise NotFoundError(f"工单组不存在: {group_id}")
        work_orders = await WorkOrder.filter(
            tenant_id=tenant_id,
            work_order_group_id=group_id,
            deleted_at__isnull=True,
        ).order_by("bom_parent_work_order_id", "id").all()
        outsource = await OutsourceWorkOrder.filter(
            tenant_id=tenant_id,
            work_order_group_id=group_id,
            deleted_at__isnull=True,
        ).all()
        return await self._group_to_dict(group, work_orders, outsource)

    async def _group_to_dict(
        self,
        group: WorkOrderGroup,
        work_orders: List[WorkOrder],
        outsource: List[OutsourceWorkOrder],
    ) -> Dict[str, Any]:
        wo_nodes = [
            {
                "id": wo.id,
                "code": wo.code,
                "product_id": wo.product_id,
                "product_code": wo.product_code,
                "product_name": wo.product_name,
                "quantity": float(wo.quantity or 0),
                "status": wo.status,
                "group_role": wo.group_role,
                "bom_parent_work_order_id": wo.bom_parent_work_order_id,
                "supply_mode": wo.supply_mode,
                "readiness_rate": float(wo.readiness_rate) if wo.readiness_rate is not None else None,
                "kind": "work_order",
            }
            for wo in work_orders
        ]
        owo_nodes = [
            {
                "id": o.id,
                "code": o.code,
                "product_id": o.product_id,
                "product_code": o.product_code,
                "product_name": o.product_name,
                "quantity": float(o.quantity or 0),
                "status": o.status,
                "group_role": o.group_role,
                "bom_parent_work_order_id": o.bom_parent_work_order_id,
                "supply_mode": o.supply_mode,
                "kind": "outsource_work_order",
            }
            for o in outsource
        ]
        min_readiness = None
        rates = [n["readiness_rate"] for n in wo_nodes if n["readiness_rate"] is not None]
        if rates:
            min_readiness = min(rates)
        return {
            "id": group.id,
            "uuid": str(group.uuid),
            "group_code": group.group_code,
            "group_name": group.group_name,
            "root_demand_item_id": group.root_demand_item_id,
            "root_material_id": group.root_material_id,
            "root_material_code": group.root_material_code,
            "root_material_name": group.root_material_name,
            "demand_computation_id": group.demand_computation_id,
            "demand_id": group.demand_id,
            "sales_order_id": group.sales_order_id,
            "status": group.status,
            "has_direct_supply": group.has_direct_supply,
            "root_work_order_id": group.root_work_order_id,
            "member_count": group.member_count,
            "min_readiness_rate": min_readiness,
            "members": wo_nodes + owo_nodes,
            "created_at": group.created_at,
            "updated_at": getattr(group, "updated_at", None),
            **audit_response_fields(group),
        }

    async def generate_groups_from_computation(
        self,
        tenant_id: int,
        computation: DemandComputation,
        items: List[DemandComputationItem],
        created_by: int,
        *,
        generate_mode: str,
        allow_draft: bool,
        failed_validation_material_ids: Set[int],
        already_pushed_keys: Set[Tuple[Optional[int], int]],
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        按 demand_item_bom_trees 生成工单组及成员工单。
        already_pushed_keys: (demand_item_id, material_id) 已下推键集合。
        """
        trees = computation.demand_item_bom_trees or []
        if not trees:
            raise BusinessLogicError(
                "需求计算缺少需求行 BOM 生产树，请重新执行 MRP 后再下推工单组。"
            )

        item_by_material: Dict[int, DemandComputationItem] = {i.material_id: i for i in items}
        work_orders: List[Dict[str, Any]] = []
        outsource_work_orders: List[Dict[str, Any]] = []
        groups_created: List[Dict[str, Any]] = []

        from apps.kuaizhizao.services.demand_computation_service import DemandComputationService

        dc_service = DemandComputationService()

        for tree in trees:
            demand_item_id = tree.get("demand_item_id")
            if demand_item_id is None:
                continue
            group_result = await self._generate_one_group(
                tenant_id=tenant_id,
                computation=computation,
                tree=tree,
                item_by_material=item_by_material,
                created_by=created_by,
                generate_mode=generate_mode,
                allow_draft=allow_draft,
                failed_validation_material_ids=failed_validation_material_ids,
                already_pushed_keys=already_pushed_keys,
                dc_service=dc_service,
            )
            if group_result:
                groups_created.append(group_result["group"])
                work_orders.extend(group_result["work_orders"])
                outsource_work_orders.extend(group_result["outsource_work_orders"])

        return {
            "work_order_groups": groups_created,
            "work_orders": work_orders,
            "outsource_work_orders": outsource_work_orders,
        }

    async def _generate_one_group(
        self,
        tenant_id: int,
        computation: DemandComputation,
        tree: Dict[str, Any],
        item_by_material: Dict[int, DemandComputationItem],
        created_by: int,
        *,
        generate_mode: str,
        allow_draft: bool,
        failed_validation_material_ids: Set[int],
        already_pushed_keys: Set[Tuple[Optional[int], int]],
        dc_service: Any,
    ) -> Optional[Dict[str, Any]]:
        demand_item_id = int(tree["demand_item_id"])
        nodes = flatten_production_tree(tree)
        wo_nodes = [
            n for n in nodes
            if n.get("source_type") in (SOURCE_TYPE_MAKE, SOURCE_TYPE_CONFIGURE, SOURCE_TYPE_OUTSOURCE)
            and float(n.get("required_quantity") or 0) > 0
        ]
        if not wo_nodes:
            return None

        if generate_mode == "purchase_only":
            return None

        pending = [
            n for n in wo_nodes
            if (demand_item_id, int(n["material_id"])) not in already_pushed_keys
        ]
        if not pending:
            return None

        group_code = await self.generate_code(tenant_id, "WORK_ORDER_CODE", prefix="WG")
        group = await WorkOrderGroup.create(
            tenant_id=tenant_id,
            group_code=group_code,
            group_name=f"{tree.get('material_name')} 工单组",
            root_demand_item_id=demand_item_id,
            root_material_id=int(tree["material_id"]),
            root_material_code=tree.get("material_code") or "",
            root_material_name=tree.get("material_name") or "",
            demand_id=computation.demand_id,
            demand_computation_id=computation.id,
            sales_order_id=await self._resolve_sales_order_id(tenant_id, computation),
            status="draft",
            has_direct_supply=tree_has_direct_supply(tree),
            created_by=created_by,
        )

        material_to_wo_id: Dict[int, int] = {}
        work_orders: List[Dict[str, Any]] = []
        outsource_work_orders: List[Dict[str, Any]] = []
        member_count = 0

        for node in pending:
            mid = int(node["material_id"])
            comp_item = item_by_material.get(mid)
            if not comp_item:
                continue

            total_gross = float(comp_item.gross_requirement or comp_item.required_quantity or 0)
            total_suggested = float(comp_item.suggested_work_order_quantity or 0)
            qty = allocate_suggested_quantity(
                float(node.get("required_quantity") or 0),
                total_gross,
                total_suggested,
            )
            qty_dec = quantize_qty(qty)
            if qty_dec <= 0:
                continue

            st = node.get("source_type")
            if generate_mode == "outsource_only" and st != SOURCE_TYPE_OUTSOURCE:
                continue

            parent_material_id = node.get("parent_material_id")
            bom_parent_wo_id = (
                material_to_wo_id.get(int(parent_material_id))
                if parent_material_id is not None
                else None
            )
            bom_level = int(node.get("bom_level") or 0)
            group_role = "root" if bom_level == 0 else (
                "outsource_component" if st == SOURCE_TYPE_OUTSOURCE else "component"
            )
            supply_mode = node.get("supply_mode") or "stocked"

            agg_item = self._synthetic_item(comp_item, qty_dec)
            allow_draft_for_item = allow_draft and mid in failed_validation_material_ids

            if st == SOURCE_TYPE_OUTSOURCE:
                wo_info = await dc_service._create_outsource_work_order_from_item(
                    tenant_id=tenant_id,
                    computation=computation,
                    item=agg_item,
                    created_by=created_by,
                    allow_draft=allow_draft_for_item,
                )
                await OutsourceWorkOrder.filter(tenant_id=tenant_id, id=wo_info["id"]).update(
                    work_order_group_id=group.id,
                    bom_parent_work_order_id=bom_parent_wo_id,
                    group_role=group_role,
                    demand_item_id=demand_item_id,
                    supply_mode=supply_mode,
                )
                outsource_work_orders.append(wo_info)
            else:
                wo_info = await dc_service._create_work_order_from_item(
                    tenant_id=tenant_id,
                    computation=computation,
                    item=agg_item,
                    created_by=created_by,
                    allow_draft=allow_draft_for_item,
                )
                await WorkOrder.filter(tenant_id=tenant_id, id=wo_info["id"]).update(
                    work_order_group_id=group.id,
                    bom_parent_work_order_id=bom_parent_wo_id,
                    group_role=group_role,
                    demand_item_id=demand_item_id,
                    supply_mode=supply_mode,
                )
                material_to_wo_id[mid] = wo_info["id"]
                work_orders.append(wo_info)
                if bom_level == 0:
                    await WorkOrderGroup.filter(tenant_id=tenant_id, id=group.id).update(
                        root_work_order_id=wo_info["id"]
                    )

            already_pushed_keys.add((demand_item_id, mid))
            member_count += 1

        await WorkOrderGroup.filter(tenant_id=tenant_id, id=group.id).update(
            member_count=member_count
        )
        group.member_count = member_count

        return {
            "group": {
                "id": group.id,
                "group_code": group.group_code,
                "root_material_name": group.root_material_name,
                "member_count": member_count,
            },
            "work_orders": work_orders,
            "outsource_work_orders": outsource_work_orders,
        }

    @staticmethod
    def _synthetic_item(item: DemandComputationItem, qty: Decimal) -> Any:
        return type("_SyntheticItem", (), {
            "material_id": item.material_id,
            "material_code": item.material_code,
            "material_name": item.material_name,
            "material_spec": item.material_spec,
            "material_unit": item.material_unit,
            "material_source_type": item.material_source_type,
            "material_source_config": item.material_source_config,
            "suggested_work_order_quantity": qty,
            "production_start_date": item.production_start_date,
            "production_completion_date": item.production_completion_date,
        })()

    async def _resolve_sales_order_id(
        self, tenant_id: int, computation: DemandComputation
    ) -> Optional[int]:
        if computation.business_mode not in ("MTO", "ATO"):
            return None
        from apps.kuaizhizao.models.demand import Demand

        demand = await Demand.get_or_none(tenant_id=tenant_id, id=computation.demand_id)
        if demand and getattr(demand, "source_type", None) == "sales_order":
            return getattr(demand, "source_id", None)
        return None

    async def collect_pushed_keys(
        self, tenant_id: int, computation_id: int
    ) -> Set[Tuple[Optional[int], int]]:
        """已下推的 (demand_item_id, material_id) 键；legacy 工单仅有 material 维度。"""
        from apps.kuaizhizao.models.document_relation import DocumentRelation

        keys: Set[Tuple[Optional[int], int]] = set()
        rels = await DocumentRelation.filter(
            tenant_id=tenant_id,
            source_type="demand_computation",
            source_id=computation_id,
        ).all()
        for rel in rels:
            if rel.target_type == "work_order":
                wo = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, id=rel.target_id, deleted_at__isnull=True
                )
                if wo:
                    keys.add((wo.demand_item_id, wo.product_id))
                    if wo.demand_item_id is None:
                        keys.add((None, wo.product_id))
            elif rel.target_type == "outsource_work_order":
                owo = await OutsourceWorkOrder.get_or_none(
                    tenant_id=tenant_id, id=rel.target_id, deleted_at__isnull=True
                )
                if owo:
                    keys.add((owo.demand_item_id, owo.product_id))
                    if owo.demand_item_id is None:
                        keys.add((None, owo.product_id))
        return keys

    async def merge_work_orders_into_group(
        self,
        tenant_id: int,
        *,
        work_order_ids: List[int],
        root_work_order_id: Optional[int],
        created_by: int,
        remarks: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        将多张已存在的生产工单编入同一工单组（不取消、不合并数量）。
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        wo_svc = WorkOrderService()
        if not await wo_svc._is_work_order_param_enabled(tenant_id, "merge", False):
            raise BusinessLogicError(
                "当前组织未开启工单合并能力，请在参数设置中开启「工单合并」"
            )

        unique_ids = list(dict.fromkeys(int(i) for i in work_order_ids))
        if len(unique_ids) < 2:
            raise ValidationError("至少需要 2 张工单才能合并为组工单")

        work_orders: List[WorkOrder] = []
        for wo_id in unique_ids:
            wo = await WorkOrder.get_or_none(
                tenant_id=tenant_id, id=wo_id, deleted_at__isnull=True
            )
            if not wo:
                raise ValidationError(f"工单不存在: {wo_id}")
            work_orders.append(wo)

        virtual_root = root_work_order_id is None
        root_wo: Optional[WorkOrder] = None
        if not virtual_root:
            if int(root_work_order_id) not in unique_ids:
                raise ValidationError("组成品工单须在已选工单列表中")
            root_wo = next(wo for wo in work_orders if wo.id == int(root_work_order_id))
        else:
            work_orders.sort(key=lambda w: str(w.code or w.id or ""))
            root_wo = work_orders[0]

        blocked_statuses = {"cancelled", "completed", "已取消", "已完成"}
        for wo in work_orders:
            if wo.parent_work_order_id is not None:
                raise BusinessLogicError(
                    f"工单 {wo.code} 为拆分子工单，请在其主工单上操作或改选主工单"
                )
            if wo.work_order_group_id is not None:
                raise BusinessLogicError(f"工单 {wo.code} 已属于工单组，请先移出或改选")
            if (wo.status or "") in blocked_statuses:
                raise BusinessLogicError(f"工单 {wo.code} 状态为 {wo.status}，不能编入组工单")
            if wo.is_frozen:
                raise BusinessLogicError(f"工单 {wo.code} 已冻结，不能编入组工单")

        group_code = await self.generate_code(tenant_id, "WORK_ORDER_CODE", prefix="WG")
        remarks_text = (remarks or "").strip()
        if remarks_text:
            group_name = remarks_text
        elif virtual_root:
            group_name = f"平级工单组（{len(work_orders)} 张）"
        else:
            group_name = f"{root_wo.product_name or root_wo.product_code or '工单'} 工单组"

        group = await WorkOrderGroup.create(
            tenant_id=tenant_id,
            group_code=group_code,
            group_name=group_name,
            root_demand_item_id=None,
            root_material_id=int(root_wo.product_id),
            root_material_code=root_wo.product_code or "",
            root_material_name=root_wo.product_name or "",
            demand_id=None,
            demand_computation_id=None,
            sales_order_id=root_wo.sales_order_id,
            status="draft",
            has_direct_supply=False,
            root_work_order_id=None if virtual_root else root_wo.id,
            member_count=len(work_orders),
            remarks=None,
            created_by=created_by,
        )

        codes: List[str] = []
        for wo in work_orders:
            if virtual_root:
                role = "component"
            else:
                role = "root" if wo.id == root_wo.id else "component"
            await WorkOrder.filter(tenant_id=tenant_id, id=wo.id).update(
                work_order_group_id=group.id,
                group_role=role,
                bom_parent_work_order_id=None,
            )
            codes.append(wo.code or str(wo.id))

        logger.info(
            "work_order_group_manual_merge tenant={} group={} members={}",
            tenant_id,
            group_code,
            codes,
        )

        return {
            "work_order_group_id": group.id,
            "group_code": group.group_code,
            "work_order_ids": unique_ids,
            "work_order_codes": codes,
        }

    async def create_peer_group_work_orders(
        self,
        tenant_id: int,
        *,
        items: List[Dict[str, Any]],
        group_name: Optional[str] = None,
        production_mode: str = "MTS",
        sales_order_id: Optional[int] = None,
        planned_start_date: Optional[Any] = None,
        planned_end_date: Optional[Any] = None,
        created_by: int,
    ) -> Dict[str, Any]:
        """
        新建平级组工单：按明细批量创建生产工单并编入同一虚拟工单组。
        """
        from apps.kuaizhizao.schemas.work_order import WorkOrderCreate
        from apps.kuaizhizao.services.work_order_service import WorkOrderService

        if len(items) < 2:
            raise ValidationError("平级组工单至少需要 2 条明细")

        wo_svc = WorkOrderService()
        work_order_ids: List[int] = []

        for idx, item in enumerate(items):
            product_id = int(item["product_id"])
            quantity = item.get("quantity")
            if quantity is None or Decimal(str(quantity)) <= 0:
                raise ValidationError(f"第 {idx + 1} 行计划数量须大于 0")

            item_pr = item.get("process_route_id")
            item_jump = item.get("allow_operation_jump")
            item_orm = str(item.get("over_report_mode") or "none")
            item_orv = Decimal(str(item.get("over_report_value") or 0))

            create_data = WorkOrderCreate(
                code_rule="WORK_ORDER_CODE",
                product_id=product_id,
                quantity=Decimal(str(quantity)),
                production_mode=production_mode or "MTS",
                sales_order_id=sales_order_id,
                priority=str(item.get("priority") or "normal"),
                planned_start_date=planned_start_date,
                planned_end_date=planned_end_date,
                process_route_id=int(item_pr) if item_pr is not None else None,
                allow_operation_jump=item_jump,
                over_report_mode=item_orm,
                over_report_value=item_orv,
                operations=None,
            )
            created = await wo_svc.create_work_order(
                tenant_id=tenant_id,
                work_order_data=create_data,
                created_by=created_by,
            )
            if created.id is None:
                raise BusinessLogicError(f"第 {idx + 1} 行工单创建失败")
            work_order_ids.append(int(created.id))

        return await self.merge_work_orders_into_group(
            tenant_id=tenant_id,
            work_order_ids=work_order_ids,
            root_work_order_id=None,
            created_by=created_by,
            remarks=group_name,
        )

    async def dissolve_work_order_groups(
        self,
        tenant_id: int,
        *,
        work_order_group_ids: List[int],
        updated_by: int,
    ) -> Dict[str, Any]:
        """
        解除编组：解除组内工单/委外单与组的关联，软删除组记录；不取消、不删除工单。
        """
        from apps.kuaizhizao.services.work_order_service import WorkOrderService
        from tortoise import timezone

        wo_svc = WorkOrderService()
        if not await wo_svc._is_work_order_param_enabled(tenant_id, "merge", False):
            raise BusinessLogicError(
                "当前组织未开启工单合并能力，请在参数设置中开启「工单合并」"
            )

        unique_gids = list(dict.fromkeys(int(i) for i in work_order_group_ids))
        dissolved: List[Dict[str, Any]] = []

        for gid in unique_gids:
            group = await WorkOrderGroup.get_or_none(
                tenant_id=tenant_id, id=gid, deleted_at__isnull=True
            )
            if not group:
                raise ValidationError(f"工单组不存在: {gid}")

            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                work_order_group_id=gid,
                deleted_at__isnull=True,
            ).all()
            outsource_orders = await OutsourceWorkOrder.filter(
                tenant_id=tenant_id,
                work_order_group_id=gid,
                deleted_at__isnull=True,
            ).all()

            for wo in work_orders:
                if wo.is_frozen:
                    raise BusinessLogicError(
                        f"工单 {wo.code} 已冻结，请先解冻后再解除编组"
                    )

            if work_orders:
                await WorkOrder.filter(
                    tenant_id=tenant_id,
                    work_order_group_id=gid,
                    deleted_at__isnull=True,
                ).update(work_order_group_id=None, group_role=None)
            if outsource_orders:
                await OutsourceWorkOrder.filter(
                    tenant_id=tenant_id,
                    work_order_group_id=gid,
                    deleted_at__isnull=True,
                ).update(work_order_group_id=None, group_role=None)

            group.deleted_at = timezone.now()
            group.updated_by = updated_by
            group.member_count = 0
            group.status = "cancelled"
            await group.save()

            logger.info(
                "work_order_group_dissolved tenant={} group={} work_orders={} outsource={}",
                tenant_id,
                group.group_code,
                len(work_orders),
                len(outsource_orders),
            )
            dissolved.append(
                {
                    "work_order_group_id": gid,
                    "group_code": group.group_code,
                    "group_name": (group.group_name or "").strip() or None,
                    "work_order_count": len(work_orders),
                    "outsource_count": len(outsource_orders),
                }
            )

        return {"groups": dissolved}
