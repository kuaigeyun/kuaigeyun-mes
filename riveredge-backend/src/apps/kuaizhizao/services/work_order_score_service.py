"""
工单综合打分服务

规则加权分 + CR 交期项，支持排程 / 备料不同权重 profile。
"""

from __future__ import annotations

from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from loguru import logger

from apps.kuaizhizao.models.sales_order import SalesOrder
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_score import WorkOrderScore
from apps.kuaizhizao.schemas.work_order_score import (
    WorkOrderScoreConfigResponse,
    WorkOrderScoreProfile,
    WorkOrderScoreProfileWeights,
    WorkOrderScoreResponse,
)
from core.services.base import BaseService
from infra.services.business_config_service import BusinessConfigService

SCORE_CONFIG_VERSION = "default-v1"
STALE_MINUTES_DEFAULT = 30
VALID_SCENARIOS = ("scheduling", "picking")

PRIORITY_SCORE_MAP = {
    "urgent": 100.0,
    "high": 75.0,
    "normal": 50.0,
    "low": 25.0,
}

DEFAULT_PROFILES: Dict[str, Dict[str, Any]] = {
    "scheduling": {
        "weights": {
            "manual_priority": 0.25,
            "due_urgency": 0.35,
            "demand_urgency": 0.15,
            "kitting_readiness": 0.20,
            "plan_fidelity": 0.05,
        },
        "kitting_mode": "direct",
    },
    "picking": {
        "weights": {
            "manual_priority": 0.20,
            "due_urgency": 0.25,
            "demand_urgency": 0.15,
            "kitting_readiness": 0.40,
            "plan_fidelity": 0.0,
        },
        "kitting_mode": "invert",
    },
}


class WorkOrderScoreService(BaseService):
    """工单综合打分引擎"""

    def __init__(self) -> None:
        super().__init__(WorkOrderScore)
        self._config_service = BusinessConfigService()

    async def is_score_enabled(self, tenant_id: int) -> bool:
        config = await self._config_service.get_business_config(tenant_id)
        wo_params = config.get("parameters", {}).get("work_order", {})
        return bool(wo_params.get("score_enabled", True))

    async def get_score_config(self, tenant_id: int) -> WorkOrderScoreConfigResponse:
        config = await self._config_service.get_business_config(tenant_id)
        wo_params = config.get("parameters", {}).get("work_order", {})
        raw_profiles = wo_params.get("score_profiles") or DEFAULT_PROFILES
        stale_minutes = int(wo_params.get("score_stale_minutes") or STALE_MINUTES_DEFAULT)
        profiles: Dict[str, WorkOrderScoreProfile] = {}
        for scenario in VALID_SCENARIOS:
            raw = raw_profiles.get(scenario) or DEFAULT_PROFILES[scenario]
            weights_raw = raw.get("weights") or DEFAULT_PROFILES[scenario]["weights"]
            profiles[scenario] = WorkOrderScoreProfile(
                weights=WorkOrderScoreProfileWeights(**weights_raw),
                kitting_mode=raw.get("kitting_mode") or DEFAULT_PROFILES[scenario]["kitting_mode"],
            )
        return WorkOrderScoreConfigResponse(
            score_enabled=bool(wo_params.get("score_enabled", True)),
            stale_minutes=stale_minutes,
            profiles=profiles,
        )

    async def _get_profile(self, tenant_id: int, scenario: str) -> WorkOrderScoreProfile:
        cfg = await self.get_score_config(tenant_id)
        return cfg.profiles.get(scenario) or WorkOrderScoreProfile(
            weights=WorkOrderScoreProfileWeights(**DEFAULT_PROFILES[scenario]["weights"]),
            kitting_mode=DEFAULT_PROFILES[scenario]["kitting_mode"],
        )

    @staticmethod
    def _rank_band(score: float) -> str:
        if score >= 80:
            return "A"
        if score >= 60:
            return "B"
        return "C"

    @staticmethod
    def _normalize_weights(weights: Dict[str, float]) -> Dict[str, float]:
        positive = {k: max(float(v), 0.0) for k, v in weights.items() if float(v) > 0}
        total = sum(positive.values())
        if total <= 0:
            return {k: 1.0 / len(weights) for k in weights}
        return {k: v / total for k, v in positive.items()}

    @staticmethod
    def _manual_priority_score(priority: Optional[str]) -> Tuple[float, Any]:
        raw = priority or "normal"
        return PRIORITY_SCORE_MAP.get(raw, 50.0), raw

    @staticmethod
    def _due_urgency_score(
        due_date: Optional[datetime],
        remaining_hours: float = 8.0,
    ) -> Tuple[float, Optional[float]]:
        if not due_date:
            return 50.0, None
        today = date.today()
        due = due_date.date() if isinstance(due_date, datetime) else due_date
        days_until = (due - today).days
        if days_until < 0:
            return 100.0, 0.0
        remaining_days = max(days_until, 0.5)
        remaining_proc_days = max(remaining_hours / 24.0, 0.25)
        critical_ratio = remaining_days / remaining_proc_days
        if critical_ratio <= 0:
            score = 100.0
        elif critical_ratio >= 2.0:
            score = 20.0
        else:
            score = min(100.0, max(20.0, 100.0 - critical_ratio * 40.0))
        if days_until <= 7:
            linear = min(100.0, 100.0 - days_until * 8.0)
            score = max(score, linear)
        return score, round(critical_ratio, 4)

    @staticmethod
    def _plan_fidelity_score(planned_start: Optional[datetime]) -> float:
        if not planned_start:
            return 50.0
        days = (planned_start.date() - date.today()).days
        if days < 0:
            return 90.0
        if 0 <= days <= 3:
            return 80.0 + min(20.0, (3 - days) * 5.0)
        return 40.0

    @staticmethod
    def _kitting_dimension_score(kitting_rate: Optional[float], kitting_mode: str) -> float:
        rate = float(kitting_rate if kitting_rate is not None else 50.0)
        rate = min(100.0, max(0.0, rate))
        if kitting_mode == "invert":
            return 100.0 - rate
        return rate

    async def _resolve_demand_due_date(
        self,
        tenant_id: int,
        work_order: WorkOrder,
    ) -> Optional[datetime]:
        if work_order.production_mode == "MTO" and work_order.sales_order_id:
            so = await SalesOrder.get_or_none(
                tenant_id=tenant_id,
                id=work_order.sales_order_id,
                deleted_at__isnull=True,
            )
            if so and so.delivery_date:
                return datetime.combine(so.delivery_date, datetime.min.time())
        return work_order.planned_end_date

    async def _resolve_kitting_rate(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        kitting_rate: Optional[float],
        include_kitting: bool,
    ) -> Optional[float]:
        if kitting_rate is not None:
            return kitting_rate
        if not include_kitting:
            return None
        try:
            from apps.kuaizhizao.services.work_order_service import WorkOrderService

            kitting = await WorkOrderService().get_work_order_kitting_analysis(tenant_id, work_order.id)
            return float(kitting.kitting_rate)
        except Exception as e:
            logger.warning(f"工单 {work_order.id} 齐套率计算失败，使用默认分: {e}")
            return None

    async def compute_score(
        self,
        tenant_id: int,
        work_order: WorkOrder,
        scenario: str,
        *,
        kitting_rate: Optional[float] = None,
        include_kitting: bool = True,
    ) -> WorkOrderScoreResponse:
        profile = await self._get_profile(tenant_id, scenario)
        weights = self._normalize_weights(profile.weights.model_dump())

        breakdown: Dict[str, Dict[str, Any]] = {}
        composite = 0.0

        mp_score, mp_raw = self._manual_priority_score(work_order.priority)
        mp_weight = weights.get("manual_priority", 0.0)
        mp_weighted = mp_score * mp_weight
        breakdown["manual_priority"] = {
            "raw": mp_raw,
            "score": round(mp_score, 2),
            "weight": round(mp_weight, 4),
            "weighted": round(mp_weighted, 2),
        }
        composite += mp_weighted

        due_date = work_order.planned_end_date
        due_score, cr = self._due_urgency_score(due_date)
        due_weight = weights.get("due_urgency", 0.0)
        due_weighted = due_score * due_weight
        breakdown["due_urgency"] = {
            "score": round(due_score, 2),
            "weight": round(due_weight, 4),
            "weighted": round(due_weighted, 2),
            "critical_ratio": cr,
        }
        composite += due_weighted

        demand_due = await self._resolve_demand_due_date(tenant_id, work_order)
        demand_score, demand_cr = self._due_urgency_score(demand_due)
        demand_weight = weights.get("demand_urgency", 0.0)
        demand_weighted = demand_score * demand_weight
        breakdown["demand_urgency"] = {
            "raw": demand_due.isoformat() if demand_due else None,
            "score": round(demand_score, 2),
            "weight": round(demand_weight, 4),
            "weighted": round(demand_weighted, 2),
            "critical_ratio": demand_cr,
        }
        composite += demand_weighted

        resolved_kitting = await self._resolve_kitting_rate(
            tenant_id, work_order, kitting_rate, include_kitting
        )
        kitting_score = self._kitting_dimension_score(resolved_kitting, profile.kitting_mode)
        kitting_weight = weights.get("kitting_readiness", 0.0)
        kitting_weighted = kitting_score * kitting_weight
        breakdown["kitting_readiness"] = {
            "raw": resolved_kitting,
            "score": round(kitting_score, 2),
            "weight": round(kitting_weight, 4),
            "weighted": round(kitting_weighted, 2),
            "kitting_mode": profile.kitting_mode,
        }
        composite += kitting_weighted

        plan_score = self._plan_fidelity_score(work_order.planned_start_date)
        plan_weight = weights.get("plan_fidelity", 0.0)
        plan_weighted = plan_score * plan_weight
        breakdown["plan_fidelity"] = {
            "score": round(plan_score, 2),
            "weight": round(plan_weight, 4),
            "weighted": round(plan_weighted, 2),
        }
        composite += plan_weighted

        composite = round(min(100.0, max(0.0, composite)), 2)
        now = datetime.now()
        return WorkOrderScoreResponse(
            work_order_id=work_order.id,
            scenario=scenario,
            composite_score=composite,
            rank_band=self._rank_band(composite),
            breakdown=breakdown,
            computed_at=now,
            config_version=SCORE_CONFIG_VERSION,
        )

    async def _persist_score(self, tenant_id: int, score: WorkOrderScoreResponse) -> WorkOrderScore:
        payload = {
            "composite_score": Decimal(str(score.composite_score)),
            "rank_band": score.rank_band,
            "breakdown": score.breakdown,
            "config_version": score.config_version,
            "computed_at": score.computed_at,
        }
        existing = await WorkOrderScore.get_or_none(
            tenant_id=tenant_id,
            work_order_id=score.work_order_id,
            scenario=score.scenario,
        )
        if existing:
            for key, val in payload.items():
                setattr(existing, key, val)
            await existing.save()
            return existing
        return await WorkOrderScore.create(
            tenant_id=tenant_id,
            work_order_id=score.work_order_id,
            scenario=score.scenario,
            **payload,
        )

    def _is_stale(self, computed_at: Optional[datetime], stale_minutes: int) -> bool:
        if not computed_at:
            return True
        return datetime.now() - computed_at > timedelta(minutes=stale_minutes)

    async def get_score(
        self,
        tenant_id: int,
        work_order_id: int,
        scenario: str = "scheduling",
        *,
        refresh_if_stale: bool = False,
        include_kitting: bool = True,
    ) -> Optional[WorkOrderScoreResponse]:
        if scenario not in VALID_SCENARIOS:
            scenario = "scheduling"
        if not await self.is_score_enabled(tenant_id):
            return None

        cfg = await self.get_score_config(tenant_id)
        cached = await WorkOrderScore.get_or_none(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            scenario=scenario,
        )
        if cached and not (refresh_if_stale and self._is_stale(cached.computed_at, cfg.stale_minutes)):
            return WorkOrderScoreResponse(
                work_order_id=work_order_id,
                scenario=scenario,
                composite_score=float(cached.composite_score),
                rank_band=cached.rank_band or self._rank_band(float(cached.composite_score)),
                breakdown=cached.breakdown or {},
                computed_at=cached.computed_at,
                config_version=cached.config_version or SCORE_CONFIG_VERSION,
            )

        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            return None

        score = await self.compute_score(
            tenant_id, work_order, scenario, include_kitting=include_kitting
        )
        await self._persist_score(tenant_id, score)
        return score

    async def refresh_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        scenarios: Optional[List[str]] = None,
        *,
        include_kitting: bool = True,
    ) -> List[WorkOrderScoreResponse]:
        if not await self.is_score_enabled(tenant_id):
            return []
        work_order = await WorkOrder.get_or_none(
            tenant_id=tenant_id,
            id=work_order_id,
            deleted_at__isnull=True,
        )
        if not work_order:
            return []
        target_scenarios = scenarios or list(VALID_SCENARIOS)
        results: List[WorkOrderScoreResponse] = []
        for scenario in target_scenarios:
            if scenario not in VALID_SCENARIOS:
                continue
            score = await self.compute_score(
                tenant_id, work_order, scenario, include_kitting=include_kitting
            )
            await self._persist_score(tenant_id, score)
            results.append(score)
        return results

    async def batch_refresh(
        self,
        tenant_id: int,
        work_order_ids: Optional[List[int]] = None,
        scenarios: Optional[List[str]] = None,
        *,
        include_kitting: bool = False,
    ) -> Dict[str, Any]:
        if not await self.is_score_enabled(tenant_id):
            return {"refreshed": 0, "skipped": True}

        if work_order_ids:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=work_order_ids,
                deleted_at__isnull=True,
            ).all()
        else:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                status__in=["draft", "released", "in_progress"],
                deleted_at__isnull=True,
            ).all()

        target_scenarios = scenarios or list(VALID_SCENARIOS)
        refreshed = 0
        for wo in work_orders:
            for scenario in target_scenarios:
                if scenario not in VALID_SCENARIOS:
                    continue
                score = await self.compute_score(
                    tenant_id, wo, scenario, include_kitting=include_kitting
                )
                await self._persist_score(tenant_id, score)
                refreshed += 1
        return {"refreshed": refreshed, "work_order_count": len(work_orders)}

    async def batch_get_scores(
        self,
        tenant_id: int,
        work_order_ids: List[int],
        scenario: str,
    ) -> Dict[int, WorkOrderScoreResponse]:
        if not work_order_ids:
            return {}
        if not await self.is_score_enabled(tenant_id):
            return {}
        rows = await WorkOrderScore.filter(
            tenant_id=tenant_id,
            work_order_id__in=work_order_ids,
            scenario=scenario,
        ).all()
        result: Dict[int, WorkOrderScoreResponse] = {}
        for row in rows:
            result[row.work_order_id] = WorkOrderScoreResponse(
                work_order_id=row.work_order_id,
                scenario=scenario,
                composite_score=float(row.composite_score),
                rank_band=row.rank_band or self._rank_band(float(row.composite_score)),
                breakdown=row.breakdown or {},
                computed_at=row.computed_at,
                config_version=row.config_version or SCORE_CONFIG_VERSION,
            )
        return result

    async def batch_get_or_compute(
        self,
        tenant_id: int,
        work_order_ids: List[int],
        scenario: str,
        *,
        refresh_if_stale: bool = True,
        include_kitting: bool = False,
    ) -> Dict[int, float]:
        """返回 work_order_id -> composite_score，供排序使用。"""
        if not work_order_ids or not await self.is_score_enabled(tenant_id):
            return {}

        cfg = await self.get_score_config(tenant_id)
        cached_map = await self.batch_get_scores(tenant_id, work_order_ids, scenario)
        scores: Dict[int, float] = {}
        missing_or_stale: List[int] = []

        for wo_id in work_order_ids:
            cached = cached_map.get(wo_id)
            if cached and not (
                refresh_if_stale and self._is_stale(cached.computed_at, cfg.stale_minutes)
            ):
                scores[wo_id] = cached.composite_score
            else:
                missing_or_stale.append(wo_id)

        if missing_or_stale:
            work_orders = await WorkOrder.filter(
                tenant_id=tenant_id,
                id__in=missing_or_stale,
                deleted_at__isnull=True,
            ).all()
            for wo in work_orders:
                score = await self.compute_score(
                    tenant_id, wo, scenario, include_kitting=include_kitting
                )
                await self._persist_score(tenant_id, score)
                scores[wo.id] = score.composite_score

        return scores

    async def attach_scores_to_list_items(
        self,
        tenant_id: int,
        items: List[Dict[str, Any]],
    ) -> None:
        if not items or not await self.is_score_enabled(tenant_id):
            return
        wo_ids = [item["id"] for item in items if item.get("id")]
        scheduling = await self.batch_get_scores(tenant_id, wo_ids, "scheduling")
        picking = await self.batch_get_scores(tenant_id, wo_ids, "picking")
        for item in items:
            sid = item.get("id")
            if sid in scheduling:
                item["scheduling_score"] = scheduling[sid].composite_score
                item["scheduling_rank_band"] = scheduling[sid].rank_band
                item["scheduling_score_breakdown"] = scheduling[sid].breakdown
            if sid in picking:
                item["picking_score"] = picking[sid].composite_score
                item["picking_rank_band"] = picking[sid].rank_band
                item["picking_score_breakdown"] = picking[sid].breakdown
