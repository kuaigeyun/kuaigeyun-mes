"""
销售漏斗服务模块

提供销售漏斗的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Dict, Optional
from decimal import Decimal
from apps.kuaicrm.models.opportunity import Opportunity
from infra.exceptions.exceptions import NotFoundError


class SalesFunnelService:
    """销售漏斗服务"""
    
    @staticmethod
    async def get_funnel_view(
        tenant_id: int,
        owner_id: Optional[int] = None,
        customer_id: Optional[int] = None
    ) -> Dict:
        """
        获取销售漏斗视图
        
        Args:
            tenant_id: 租户ID
            owner_id: 负责人（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            Dict: 漏斗视图数据（各阶段数量、金额、转化率）
        """
        query = Opportunity.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="进行中"
        )
        
        if owner_id:
            query = query.filter(owner_id=owner_id)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        opportunities = await query.all()
        
        # 定义阶段
        stages = ["初步接触", "需求确认", "方案报价", "商务谈判", "成交"]
        
        # 统计各阶段数据
        stage_data = {}
        total_amount = Decimal("0")
        total_count = len(opportunities)
        
        for stage in stages:
            stage_oppos = [o for o in opportunities if o.stage == stage]
            stage_count = len(stage_oppos)
            stage_amount = sum(o.amount or Decimal("0") for o in stage_oppos)
            total_amount += stage_amount
            
            stage_data[stage] = {
                "count": stage_count,
                "amount": float(stage_amount),
                "avg_amount": float(stage_amount / stage_count) if stage_count > 0 else 0
            }
        
        # 计算转化率
        conversion_rates = {}
        prev_count = total_count
        for stage in stages:
            current_count = stage_data[stage]["count"]
            if prev_count > 0:
                conversion_rate = (current_count / prev_count) * 100
            else:
                conversion_rate = 0
            conversion_rates[stage] = float(conversion_rate)
            prev_count = current_count
        
        return {
            "stages": stage_data,
            "conversion_rates": conversion_rates,
            "total_count": total_count,
            "total_amount": float(total_amount)
        }
    
    @staticmethod
    async def analyze_stage(
        tenant_id: int,
        stage: str,
        owner_id: Optional[int] = None
    ) -> Dict:
        """
        分析阶段数据
        
        Args:
            tenant_id: 租户ID
            stage: 商机阶段
            owner_id: 负责人（过滤）
            
        Returns:
            Dict: 阶段分析数据
        """
        query = Opportunity.filter(
            tenant_id=tenant_id,
            stage=stage,
            deleted_at__isnull=True
        )
        
        if owner_id:
            query = query.filter(owner_id=owner_id)
        
        opportunities = await query.all()
        
        if not opportunities:
            return {
                "stage": stage,
                "count": 0,
                "amount": 0,
                "avg_amount": 0,
                "avg_probability": 0
            }
        
        total_amount = sum(o.amount or Decimal("0") for o in opportunities)
        total_probability = sum(o.probability or Decimal("0") for o in opportunities)
        
        return {
            "stage": stage,
            "count": len(opportunities),
            "amount": float(total_amount),
            "avg_amount": float(total_amount / len(opportunities)),
            "avg_probability": float(total_probability / len(opportunities))
        }
    
    @staticmethod
    async def calculate_conversion_rate(
        tenant_id: int,
        from_stage: str,
        to_stage: str,
        owner_id: Optional[int] = None
    ) -> float:
        """
        计算转化率
        
        Args:
            tenant_id: 租户ID
            from_stage: 起始阶段
            to_stage: 目标阶段
            owner_id: 负责人（过滤）
            
        Returns:
            float: 转化率（0-100）
        """
        # 这里简化处理，实际应该基于历史数据计算
        # TODO: 实现基于历史数据的转化率计算
        
        query = Opportunity.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if owner_id:
            query = query.filter(owner_id=owner_id)
        
        from_count = await query.filter(stage=from_stage).count()
        to_count = await query.filter(stage=to_stage).count()
        
        if from_count == 0:
            return 0.0
        
        return (to_count / from_count) * 100
    
    @staticmethod
    async def forecast_sales(
        tenant_id: int,
        owner_id: Optional[int] = None,
        forecast_period: str = "month"
    ) -> Dict:
        """
        销售预测
        
        Args:
            tenant_id: 租户ID
            owner_id: 负责人（过滤）
            forecast_period: 预测周期（week, month, quarter, year）
            
        Returns:
            Dict: 销售预测数据
        """
        query = Opportunity.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="进行中"
        )
        
        if owner_id:
            query = query.filter(owner_id=owner_id)
        
        opportunities = await query.all()
        
        # 基于成交概率计算预测金额
        forecast_amount = Decimal("0")
        for oppo in opportunities:
            if oppo.amount and oppo.probability:
                forecast_amount += oppo.amount * (oppo.probability / Decimal("100"))
        
        return {
            "forecast_period": forecast_period,
            "forecast_amount": float(forecast_amount),
            "opportunity_count": len(opportunities),
            "avg_probability": float(sum(o.probability or Decimal("0") for o in opportunities) / len(opportunities)) if opportunities else 0
        }
    
    @staticmethod
    async def analyze_bottleneck(
        tenant_id: int,
        owner_id: Optional[int] = None
    ) -> Dict:
        """
        分析瓶颈阶段
        
        Args:
            tenant_id: 租户ID
            owner_id: 负责人（过滤）
            
        Returns:
            Dict: 瓶颈分析数据
        """
        query = Opportunity.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
            status="进行中"
        )
        
        if owner_id:
            query = query.filter(owner_id=owner_id)
        
        opportunities = await query.all()
        
        # 计算各阶段停留时间（简化处理）
        stages = ["初步接触", "需求确认", "方案报价", "商务谈判"]
        stage_avg_days = {}
        
        from datetime import datetime, timedelta
        for stage in stages:
            stage_oppos = [o for o in opportunities if o.stage == stage]
            if stage_oppos:
                # 简化计算：基于创建时间到现在的天数
                total_days = sum(
                    (datetime.utcnow() - o.created_at).days 
                    for o in stage_oppos
                )
                stage_avg_days[stage] = total_days / len(stage_oppos) if stage_oppos else 0
            else:
                stage_avg_days[stage] = 0
        
        # 找出停留时间最长的阶段（瓶颈）
        bottleneck_stage = max(stage_avg_days.items(), key=lambda x: x[1])[0] if stage_avg_days else None
        
        return {
            "stage_avg_days": stage_avg_days,
            "bottleneck_stage": bottleneck_stage,
            "bottleneck_days": stage_avg_days.get(bottleneck_stage, 0) if bottleneck_stage else 0
        }
