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

        # 初始节点
        nodes[batch_no] = {
            "id": batch_no,
            "label": batch_no,
            "type": "batch"
        }

        if direction in ["forward", "both"]:
            await self._trace_forward(batch_no, nodes, edges, visited)
        
        # 重置 visited 以便反向追溯
        visited = set()
        if direction in ["backward", "both"]:
            await self._trace_backward(batch_no, nodes, edges, visited)

        return {
            "nodes": list(nodes.values()),
            "edges": edges
        }

    async def _trace_forward(self, current_batch: str, nodes: Dict, edges: List, visited: Set):
        """
        正向追溯（原料 -> 成品）
        """
        if current_batch in visited:
            return
        visited.add(current_batch)

        # 1. 查找该批次作为原料被投料的记录 (feeding)
        feedings = await MaterialBinding.filter(
            batch_no=current_batch, 
            binding_type="feeding"
        ).all()

        for feeding in feedings:
            wo_node_id = f"WO-{feeding.work_order_code}"
            
            # 添加工单节点
            if wo_node_id not in nodes:
                nodes[wo_node_id] = {
                    "id": wo_node_id,
                    "label": f"工单: {feeding.work_order_code}",
                    "type": "work_order",
                    "data": {
                        "work_order_id": feeding.work_order_id,
                        "operation_name": feeding.operation_name
                    }
                }
            
            # 添加边: 原料批次 -> 工单
            edges.append({
                "source": current_batch,
                "target": wo_node_id,
                "label": "投料"
            })

            # 2. 查找该工单产出的记录 (discharging)
            dischargings = await MaterialBinding.filter(
                work_order_id=feeding.work_order_id,
                binding_type="discharging"
            ).all()

            for discharging in dischargings:
                if not discharging.batch_no:
                    continue
                    
                output_batch = discharging.batch_no
                
                # 添加产出批次节点
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
                
                # 添加边: 工单 -> 产出批次
                edges.append({
                    "source": wo_node_id,
                    "target": output_batch,
                    "label": "产出"
                })

                # 递归追溯
                await self._trace_forward(output_batch, nodes, edges, visited)

    async def _trace_backward(self, current_batch: str, nodes: Dict, edges: List, visited: Set):
        """
        反向追溯（成品 -> 原料）
        """
        if current_batch in visited:
            return
        visited.add(current_batch)

        # 1. 查找该批次作为产出被记录的记录 (discharging)
        # 这意味着它是某个工单产出的
        dischargings = await MaterialBinding.filter(
            batch_no=current_batch,
            binding_type="discharging"
        ).all()

        for discharging in dischargings:
            wo_node_id = f"WO-{discharging.work_order_code}"
            
            # 添加工单节点
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
            
            # 添加边: 工单 -> 产出批次 (反向展示时，逻辑上流向是 工单->批次，但追溯是反向的)
            # 在图谱中通常还是展示流向，即 工单 -> current_batch
            # 这里我们需要确保边的方向一致性，即始终表示"流动"方向
            # 所以即便是反向追溯，边的方向还是：原料 -> 工单 -> 成品
            edges.append({
                "source": wo_node_id,
                "target": current_batch,
                "label": "产出"
            })

            # 2. 查找该工单投料的记录 (feeding)
            feedings = await MaterialBinding.filter(
                work_order_id=discharging.work_order_id,
                binding_type="feeding"
            ).all()

            for feeding in feedings:
                if not feeding.batch_no:
                    continue
                
                input_batch = feeding.batch_no
                
                # 添加原料批次节点
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
                
                # 添加边: 原料批次 -> 工单
                edges.append({
                    "source": input_batch,
                    "target": wo_node_id,
                    "label": "投料"
                })

                # 递归追溯
                await self._trace_backward(input_batch, nodes, edges, visited)
