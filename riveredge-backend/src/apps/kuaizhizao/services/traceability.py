"""
追溯服务模块

提供物料批次的正向和反向追溯功能。

Author: AI Assistant
Date: 2024-05-20
"""

from typing import List, Dict, Set, Optional
from apps.kuaizhizao.models.material_binding import MaterialBinding


class TraceabilityService:
    """
    追溯服务类
    """

    async def get_trace_graph(self, batch_no: str, direction: str = "both") -> Dict:
        """
        获取追溯图谱
        
        Args:
            batch_no: 批次号
            direction: 追溯方向 ('forward', 'backward', 'both')
            
        Returns:
            Dict: 包含 nodes 和 edges 的图谱数据
        """
        nodes = {}
        edges = []
        visited = set()
        work_order_ids: Set[int] = set()
        tenant_ids: Set[int] = set()

        binding = await MaterialBinding.filter(batch_no=batch_no).first()
        if binding and binding.tenant_id:
            tenant_ids.add(binding.tenant_id)

        # 初始节点
        nodes[batch_no] = {
            "id": batch_no,
            "label": batch_no,
            "type": "batch"
        }

        if direction in ["forward", "both"]:
            await self._trace_forward(batch_no, nodes, edges, visited, work_order_ids, tenant_ids)
        
        # 重置 visited 以便反向追溯
        visited = set()
        if direction in ["backward", "both"]:
            await self._trace_backward(batch_no, nodes, edges, visited, work_order_ids, tenant_ids)

        if work_order_ids:
            for tid in tenant_ids or {None}:
                await self._append_quality_nodes_for_work_orders(
                    tenant_id=tid,
                    work_order_ids=work_order_ids,
                    nodes=nodes,
                    edges=edges,
                )

        return {
            "nodes": list(nodes.values()),
            "edges": edges
        }

    async def get_trace_graph_by_work_order(self, tenant_id: int, work_order_id: int) -> Dict:
        """按工单获取追溯图谱（含检验/不合格节点）。"""
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.services.work_order_tracking_service import WorkOrderTrackingService

        wo = await WorkOrder.get_or_none(id=work_order_id, deleted_at__isnull=True)
        if not wo:
            return {"nodes": [], "edges": []}

        wo_node_id = f"WO-{wo.code}"
        nodes = {
            wo_node_id: {
                "id": wo_node_id,
                "label": f"工单: {wo.code}",
                "type": "work_order",
                "data": {
                    "work_order_id": wo.id,
                    "batch_no": WorkOrderTrackingService.effective_batch_no(wo),
                    "serial_no": WorkOrderTrackingService.effective_serial_no(wo),
                    "tracking_mode": getattr(wo, "tracking_mode", None),
                },
            }
        }
        edges: List[Dict] = []
        await self._append_quality_nodes_for_work_orders(
            tenant_id=tenant_id or wo.tenant_id,
            work_order_ids={work_order_id},
            nodes=nodes,
            edges=edges,
        )
        return {"nodes": list(nodes.values()), "edges": edges}

    async def _append_quality_nodes_for_work_orders(
        self,
        tenant_id: Optional[int],
        work_order_ids: Set[int],
        nodes: Dict,
        edges: List,
    ) -> None:
        """为已知工单补充检验单与不合格品节点。"""
        if not work_order_ids:
            return

        from apps.kuaizhizao.models.process_inspection import ProcessInspection
        from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
        from apps.kuaizhizao.models.defect_record import DefectRecord

        wo_filter = {"work_order_id__in": list(work_order_ids), "deleted_at__isnull": True}
        if tenant_id:
            wo_filter["tenant_id"] = tenant_id

        proc_inspections = await ProcessInspection.filter(**wo_filter).all()
        for insp in proc_inspections:
            node_id = f"PI-{insp.inspection_code}"
            wo_node_id = f"WO-{insp.work_order_code}"
            if node_id not in nodes:
                nodes[node_id] = {
                    "id": node_id,
                    "label": f"过程检验: {insp.inspection_code}",
                    "type": "process_inspection",
                    "data": {
                        "inspection_id": insp.id,
                        "quality_status": insp.quality_status,
                        "operation_name": insp.operation_name,
                    },
                }
            if wo_node_id in nodes:
                edge_key = (wo_node_id, node_id)
                if not any(e.get("source") == wo_node_id and e.get("target") == node_id for e in edges):
                    edges.append({"source": wo_node_id, "target": node_id, "label": "过程检验"})

        fg_inspections = await FinishedGoodsInspection.filter(**wo_filter).all()
        for insp in fg_inspections:
            node_id = f"FGI-{insp.inspection_code}"
            wo_node_id = f"WO-{insp.work_order_code}"
            if node_id not in nodes:
                nodes[node_id] = {
                    "id": node_id,
                    "label": f"成品检验: {insp.inspection_code}",
                    "type": "finished_goods_inspection",
                    "data": {
                        "inspection_id": insp.id,
                        "quality_status": insp.quality_status,
                    },
                }
            if wo_node_id in nodes:
                if not any(e.get("source") == wo_node_id and e.get("target") == node_id for e in edges):
                    edges.append({"source": wo_node_id, "target": node_id, "label": "成品检验"})

        defects = await DefectRecord.filter(**wo_filter).all()
        for defect in defects:
            node_id = f"DF-{defect.code}"
            wo_node_id = f"WO-{defect.work_order_code}" if defect.work_order_code else None
            if node_id not in nodes:
                nodes[node_id] = {
                    "id": node_id,
                    "label": f"不合格: {defect.code}",
                    "type": "defect_record",
                    "data": {
                        "defect_id": defect.id,
                        "disposition": defect.disposition,
                        "defect_quantity": float(defect.defect_quantity),
                    },
                }
            if wo_node_id and wo_node_id in nodes:
                if not any(e.get("source") == wo_node_id and e.get("target") == node_id for e in edges):
                    edges.append({"source": wo_node_id, "target": node_id, "label": "不合格品"})

    async def _trace_forward(
        self, current_batch: str, nodes: Dict, edges: List, visited: Set, work_order_ids: Set, tenant_ids: Set
    ):
        """
        正向追溯（原料 -> 成品）
        """
        if current_batch in visited:
            return
        visited.add(current_batch)

        feedings = await MaterialBinding.filter(
            batch_no=current_batch, 
            binding_type="feeding"
        ).all()

        for feeding in feedings:
            wo_node_id = f"WO-{feeding.work_order_code}"
            if feeding.work_order_id:
                work_order_ids.add(feeding.work_order_id)
            if feeding.tenant_id:
                tenant_ids.add(feeding.tenant_id)
            
            if wo_node_id not in nodes:
                nodes[wo_node_id] = {
                    "id": wo_node_id,
                    "label": f"工单: {feeding.work_order_code}",
                    "type": "work_order",
                    "data": {
                        "work_order_id": feeding.work_order_id,
                        "work_order_code": feeding.work_order_code,
                        "operation_name": feeding.operation_name
                    }
                }
            
            edges.append({
                "source": current_batch,
                "target": wo_node_id,
                "label": "投料"
            })

            dischargings = await MaterialBinding.filter(
                work_order_id=feeding.work_order_id,
                binding_type="discharging"
            ).all()

            for discharging in dischargings:
                if not discharging.batch_no:
                    continue
                    
                output_batch = discharging.batch_no
                
                if output_batch not in nodes:
                    nodes[output_batch] = {
                        "id": output_batch,
                        "label": output_batch,
                        "type": "batch",
                        "data": {
                            "material_name": discharging.material_name,
                            "material_code": discharging.material_code
                        }
                    }
                
                edges.append({
                    "source": wo_node_id,
                    "target": output_batch,
                    "label": "产出"
                })

                await self._trace_forward(output_batch, nodes, edges, visited, work_order_ids, tenant_ids)

    async def _trace_backward(
        self, current_batch: str, nodes: Dict, edges: List, visited: Set, work_order_ids: Set, tenant_ids: Set
    ):
        """
        反向追溯（成品 -> 原料）
        """
        if current_batch in visited:
            return
        visited.add(current_batch)

        dischargings = await MaterialBinding.filter(
            batch_no=current_batch,
            binding_type="discharging"
        ).all()

        for discharging in dischargings:
            wo_node_id = f"WO-{discharging.work_order_code}"
            if discharging.work_order_id:
                work_order_ids.add(discharging.work_order_id)
            if discharging.tenant_id:
                tenant_ids.add(discharging.tenant_id)
            
            if wo_node_id not in nodes:
                nodes[wo_node_id] = {
                    "id": wo_node_id,
                    "label": f"工单: {discharging.work_order_code}",
                    "type": "work_order",
                    "data": {
                        "work_order_id": discharging.work_order_id,
                        "operation_name": discharging.operation_name
                    }
                }
            
            edges.append({
                "source": wo_node_id,
                "target": current_batch,
                "label": "产出"
            })

            feedings = await MaterialBinding.filter(
                work_order_id=discharging.work_order_id,
                binding_type="feeding"
            ).all()

            for feeding in feedings:
                if not feeding.batch_no:
                    continue
                
                input_batch = feeding.batch_no
                
                if input_batch not in nodes:
                    nodes[input_batch] = {
                        "id": input_batch,
                        "label": input_batch,
                        "type": "batch",
                        "data": {
                            "material_name": feeding.material_name,
                            "material_code": feeding.material_code
                        }
                    }
                
                edges.append({
                    "source": input_batch,
                    "target": wo_node_id,
                    "label": "投料"
                })

                await self._trace_backward(input_batch, nodes, edges, visited, work_order_ids, tenant_ids)
