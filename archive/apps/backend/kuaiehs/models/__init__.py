"""
EHS模块模型

导出所有环境健康安全管理相关的模型。
"""

from apps.kuaiehs.models.environment import (
    EnvironmentMonitoring,
    EmissionManagement,
    EnvironmentalCompliance,
    EnvironmentalIncident,
)
from apps.kuaiehs.models.health import (
    OccupationalHealthCheck,
    OccupationalDisease,
    HealthRecord,
)
from apps.kuaiehs.models.safety import (
    SafetyTraining,
    SafetyInspection,
    SafetyHazard,
    SafetyIncident,
)
from apps.kuaiehs.models.compliance import (
    Regulation,
    ComplianceCheck,
    ComplianceReport,
)

__all__ = [
    "EnvironmentMonitoring",
    "EmissionManagement",
    "EnvironmentalCompliance",
    "EnvironmentalIncident",
    "OccupationalHealthCheck",
    "OccupationalDisease",
    "HealthRecord",
    "SafetyTraining",
    "SafetyInspection",
    "SafetyHazard",
    "SafetyIncident",
    "Regulation",
    "ComplianceCheck",
    "ComplianceReport",
]

