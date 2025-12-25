"""
MI Schema 模块

导出所有MI相关的Schema。
"""

from .production_dashboard_schemas import (
    ProductionDashboardBase,
    ProductionDashboardCreate,
    ProductionDashboardUpdate,
    ProductionDashboardResponse,
)
from .oee_analysis_schemas import (
    OEEAnalysisBase,
    OEEAnalysisCreate,
    OEEAnalysisUpdate,
    OEEAnalysisResponse,
)
from .process_parameter_optimization_schemas import (
    ProcessParameterOptimizationBase,
    ProcessParameterOptimizationCreate,
    ProcessParameterOptimizationUpdate,
    ProcessParameterOptimizationResponse,
)
from .quality_prediction_analysis_schemas import (
    QualityPredictionAnalysisBase,
    QualityPredictionAnalysisCreate,
    QualityPredictionAnalysisUpdate,
    QualityPredictionAnalysisResponse,
)
from .system_performance_analysis_schemas import (
    SystemPerformanceAnalysisBase,
    SystemPerformanceAnalysisCreate,
    SystemPerformanceAnalysisUpdate,
    SystemPerformanceAnalysisResponse,
)

__all__ = [
    "ProductionDashboardBase",
    "ProductionDashboardCreate",
    "ProductionDashboardUpdate",
    "ProductionDashboardResponse",
    "OEEAnalysisBase",
    "OEEAnalysisCreate",
    "OEEAnalysisUpdate",
    "OEEAnalysisResponse",
    "ProcessParameterOptimizationBase",
    "ProcessParameterOptimizationCreate",
    "ProcessParameterOptimizationUpdate",
    "ProcessParameterOptimizationResponse",
    "QualityPredictionAnalysisBase",
    "QualityPredictionAnalysisCreate",
    "QualityPredictionAnalysisUpdate",
    "QualityPredictionAnalysisResponse",
    "SystemPerformanceAnalysisBase",
    "SystemPerformanceAnalysisCreate",
    "SystemPerformanceAnalysisUpdate",
    "SystemPerformanceAnalysisResponse",
]

