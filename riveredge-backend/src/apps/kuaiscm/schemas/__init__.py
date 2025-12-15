"""
SCM Schema 模块

导出所有SCM相关的Schema。
"""

from .supply_chain_network_schemas import (
    SupplyChainNetworkBase,
    SupplyChainNetworkCreate,
    SupplyChainNetworkUpdate,
    SupplyChainNetworkResponse,
)
from .demand_forecast_schemas import (
    DemandForecastBase,
    DemandForecastCreate,
    DemandForecastUpdate,
    DemandForecastResponse,
)
from .supply_chain_risk_schemas import (
    SupplyChainRiskBase,
    SupplyChainRiskCreate,
    SupplyChainRiskUpdate,
    SupplyChainRiskResponse,
)
from .global_inventory_view_schemas import (
    GlobalInventoryViewBase,
    GlobalInventoryViewCreate,
    GlobalInventoryViewUpdate,
    GlobalInventoryViewResponse,
)

__all__ = [
    "SupplyChainNetworkBase",
    "SupplyChainNetworkCreate",
    "SupplyChainNetworkUpdate",
    "SupplyChainNetworkResponse",
    "DemandForecastBase",
    "DemandForecastCreate",
    "DemandForecastUpdate",
    "DemandForecastResponse",
    "SupplyChainRiskBase",
    "SupplyChainRiskCreate",
    "SupplyChainRiskUpdate",
    "SupplyChainRiskResponse",
    "GlobalInventoryViewBase",
    "GlobalInventoryViewCreate",
    "GlobalInventoryViewUpdate",
    "GlobalInventoryViewResponse",
]

