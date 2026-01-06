"""
单据节点耗时统计服务模块

提供单据节点耗时统计相关的业务逻辑处理，包括节点时间记录、耗时计算等。

Author: Luigi Lu
Date: 2025-01-15
"""

from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal

from apps.kuaizhizao.models.document_node_timing import DocumentNodeTiming
from apps.kuaizhizao.schemas.document_node_timing import (
    DocumentNodeTimingCreate,
    DocumentNodeTimingResponse,
    DocumentNodeTimingListResponse,
    DocumentTimingSummaryResponse,
)
from apps.base_service import AppBaseService
from core.services.system.working_hours_config_service import WorkingHoursConfigService


class DocumentTimingService(AppBaseService[DocumentNodeTiming]):
    """
    单据节点耗时统计服务类

    处理单据节点耗时统计相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(DocumentNodeTiming)

    async def record_node_start(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        document_code: str,
        node_name: str,
        node_code: str,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> DocumentNodeTimingResponse:
        """
        记录节点开始时间

        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            document_code: 单据编码
            node_name: 节点名称
            node_code: 节点编码
            operator_id: 操作人ID
            operator_name: 操作人姓名

        Returns:
            DocumentNodeTimingResponse: 创建的节点记录信息
        """
        # 检查是否已存在该节点的开始记录
        existing = await DocumentNodeTiming.filter(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            node_code=node_code,
            start_time__isnull=False,
            end_time__isnull=True,
        ).first()

        if existing:
            # 如果已存在未结束的记录，直接返回
            return DocumentNodeTimingResponse.model_validate(existing)

        # 创建新的节点记录
        timing = await DocumentNodeTiming.create(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            document_code=document_code,
            node_name=node_name,
            node_code=node_code,
            start_time=datetime.now(),
            operator_id=operator_id,
            operator_name=operator_name,
        )

        return DocumentNodeTimingResponse.model_validate(timing)

    async def record_node_end(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
        node_code: str,
        operator_id: Optional[int] = None,
        operator_name: Optional[str] = None,
    ) -> DocumentNodeTimingResponse:
        """
        记录节点结束时间

        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID
            node_code: 节点编码
            operator_id: 操作人ID
            operator_name: 操作人姓名

        Returns:
            DocumentNodeTimingResponse: 更新的节点记录信息
        """
        # 查找未结束的节点记录
        timing = await DocumentNodeTiming.filter(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
            node_code=node_code,
            start_time__isnull=False,
            end_time__isnull=True,
        ).first()

        if not timing:
            raise ValueError(f"未找到节点 {node_code} 的开始记录")

        # 更新结束时间
        end_time = datetime.now()
        timing.end_time = end_time

        # 计算耗时
        if timing.start_time:
            duration = end_time - timing.start_time
            timing.duration_seconds = int(duration.total_seconds())
            
            # 计算排除非工作时间的耗时
            working_hours_service = WorkingHoursConfigService()
            timing.duration_hours = await working_hours_service.calculate_working_hours(
                tenant_id=tenant_id,
                start_time=timing.start_time,
                end_time=end_time,
            )

        timing.operator_id = operator_id
        timing.operator_name = operator_name
        await timing.save()

        return DocumentNodeTimingResponse.model_validate(timing)

    async def get_document_timing(
        self,
        tenant_id: int,
        document_type: str,
        document_id: int,
    ) -> DocumentTimingSummaryResponse:
        """
        获取单据的耗时汇总

        Args:
            tenant_id: 租户ID
            document_type: 单据类型
            document_id: 单据ID

        Returns:
            DocumentTimingSummaryResponse: 单据耗时汇总信息
        """
        # 获取单据的所有节点记录
        timings = await DocumentNodeTiming.filter(
            tenant_id=tenant_id,
            document_type=document_type,
            document_id=document_id,
        ).order_by('start_time')

        if not timings:
            raise ValueError("未找到单据的节点记录")

        # 计算总耗时
        total_seconds = sum(t.duration_seconds or 0 for t in timings if t.duration_seconds)
        total_hours = sum(t.duration_hours or Decimal('0') for t in timings if t.duration_hours)

        # 获取单据编码
        document_code = timings[0].document_code if timings else ""

        return DocumentTimingSummaryResponse(
            document_type=document_type,
            document_id=document_id,
            document_code=document_code,
            total_duration_seconds=total_seconds if total_seconds > 0 else None,
            total_duration_hours=total_hours if total_hours > 0 else None,
            nodes=[DocumentNodeTimingResponse.model_validate(t) for t in timings],
        )

    async def list_documents_with_timing(
        self,
        tenant_id: int,
        document_type: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[DocumentTimingSummaryResponse]:
        """
        获取有耗时记录的单据列表

        Args:
            tenant_id: 租户ID
            document_type: 单据类型筛选（可选）
            skip: 跳过数量
            limit: 限制数量

        Returns:
            List[DocumentTimingSummaryResponse]: 单据耗时汇总列表
        """
        # 获取所有有节点记录的单据（去重）
        query = DocumentNodeTiming.filter(tenant_id=tenant_id)
        if document_type:
            query = query.filter(document_type=document_type)

        # 获取所有节点记录
        all_timings = await query.order_by('-start_time').offset(skip).limit(limit * 10)  # 多取一些以应对去重

        # 按单据分组
        documents_map: dict[str, DocumentTimingSummaryResponse] = {}
        for timing in all_timings:
            key = f"{timing.document_type}_{timing.document_id}"
            if key not in documents_map:
                documents_map[key] = DocumentTimingSummaryResponse(
                    document_type=timing.document_type,
                    document_id=timing.document_id,
                    document_code=timing.document_code,
                    total_duration_seconds=0,
                    total_duration_hours=Decimal('0'),
                    nodes=[],
                )
            documents_map[key].nodes.append(DocumentNodeTimingResponse.model_validate(timing))

        # 计算每个单据的总耗时
        result = []
        for doc in list(documents_map.values())[:limit]:
            total_seconds = sum(n.duration_seconds or 0 for n in doc.nodes if n.duration_seconds)
            total_hours = sum(n.duration_hours or Decimal('0') for n in doc.nodes if n.duration_hours)
            doc.total_duration_seconds = total_seconds if total_seconds > 0 else None
            doc.total_duration_hours = total_hours if total_hours > 0 else None
            result.append(doc)

        return result

    async def get_document_efficiency(
        self,
        tenant_id: int,
        document_type: Optional[str] = None,
        date_start: Optional[datetime] = None,
        date_end: Optional[datetime] = None,
    ) -> dict:
        """
        获取单据执行效率分析

        Args:
            tenant_id: 租户ID
            document_type: 单据类型筛选（可选）
            date_start: 开始日期（可选）
            date_end: 结束日期（可选）

        Returns:
            dict: 效率分析结果，包含：
            - average_duration_hours: 平均耗时（小时）
            - bottleneck_nodes: 瓶颈节点列表
            - optimization_suggestions: 优化建议列表
            - node_statistics: 节点统计信息
        """
        # 构建查询条件
        query = DocumentNodeTiming.filter(
            tenant_id=tenant_id,
            duration_hours__isnull=False,
        )
        if document_type:
            query = query.filter(document_type=document_type)
        if date_start:
            query = query.filter(start_time__gte=date_start)
        if date_end:
            query = query.filter(start_time__lte=date_end)

        # 获取所有节点记录
        timings = await query.all()

        if not timings:
            return {
                "average_duration_hours": None,
                "bottleneck_nodes": [],
                "optimization_suggestions": [],
                "node_statistics": [],
            }

        # 计算平均耗时
        total_hours = sum(t.duration_hours or Decimal('0') for t in timings if t.duration_hours)
        total_count = len([t for t in timings if t.duration_hours])
        average_duration_hours = float(total_hours / total_count) if total_count > 0 else 0

        # 按节点统计
        node_stats = {}
        for timing in timings:
            if not timing.duration_hours:
                continue
            node_code = timing.node_code
            if node_code not in node_stats:
                node_stats[node_code] = {
                    "node_code": node_code,
                    "node_name": timing.node_name,
                    "count": 0,
                    "total_hours": Decimal('0'),
                    "avg_hours": Decimal('0'),
                    "max_hours": Decimal('0'),
                    "min_hours": Decimal('999999'),
                }
            stats = node_stats[node_code]
            stats["count"] += 1
            stats["total_hours"] += timing.duration_hours
            if timing.duration_hours > stats["max_hours"]:
                stats["max_hours"] = timing.duration_hours
            if timing.duration_hours < stats["min_hours"]:
                stats["min_hours"] = timing.duration_hours

        # 计算每个节点的平均耗时
        node_statistics = []
        for node_code, stats in node_stats.items():
            stats["avg_hours"] = stats["total_hours"] / stats["count"] if stats["count"] > 0 else Decimal('0')
            node_statistics.append({
                "node_code": node_code,
                "node_name": stats["node_name"],
                "count": stats["count"],
                "avg_hours": float(stats["avg_hours"]),
                "max_hours": float(stats["max_hours"]),
                "min_hours": float(stats["min_hours"]),
            })

        # 按平均耗时排序，找出瓶颈节点（耗时最长的前3个）
        node_statistics.sort(key=lambda x: x["avg_hours"], reverse=True)
        bottleneck_nodes = node_statistics[:3] if len(node_statistics) > 3 else node_statistics

        # 生成优化建议
        optimization_suggestions = []
        if bottleneck_nodes:
            for node in bottleneck_nodes:
                if node["avg_hours"] > average_duration_hours * 1.5:  # 超过平均值的1.5倍
                    optimization_suggestions.append({
                        "type": "bottleneck",
                        "node_name": node["node_name"],
                        "current_avg_hours": node["avg_hours"],
                        "suggestion": f"节点'{node['node_name']}'平均耗时{node['avg_hours']:.2f}小时，超过平均值，建议优化流程或增加资源。",
                    })

        # 检查是否有异常长的耗时
        for node in node_statistics:
            if node["max_hours"] > node["avg_hours"] * 2:  # 最大值超过平均值2倍
                optimization_suggestions.append({
                    "type": "outlier",
                    "node_name": node["node_name"],
                    "max_hours": node["max_hours"],
                    "avg_hours": node["avg_hours"],
                    "suggestion": f"节点'{node['node_name']}'存在异常耗时（最长{node['max_hours']:.2f}小时），建议检查异常单据。",
                })

        return {
            "average_duration_hours": average_duration_hours,
            "bottleneck_nodes": bottleneck_nodes,
            "optimization_suggestions": optimization_suggestions,
            "node_statistics": node_statistics,
        }

