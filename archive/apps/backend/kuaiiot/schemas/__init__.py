"""
IOT模块 Schema

导出所有数据采集相关的 Schema。
"""

from apps.kuaiiot.schemas.device_data_collection_schemas import (
    DeviceDataCollectionBase,
    DeviceDataCollectionCreate,
    DeviceDataCollectionUpdate,
    DeviceDataCollectionResponse,
)
from apps.kuaiiot.schemas.sensor_configuration_schemas import (
    SensorConfigurationBase,
    SensorConfigurationCreate,
    SensorConfigurationUpdate,
    SensorConfigurationResponse,
)
from apps.kuaiiot.schemas.sensor_data_schemas import (
    SensorDataBase,
    SensorDataCreate,
    SensorDataUpdate,
    SensorDataResponse,
)
from apps.kuaiiot.schemas.real_time_monitoring_schemas import (
    RealTimeMonitoringBase,
    RealTimeMonitoringCreate,
    RealTimeMonitoringUpdate,
    RealTimeMonitoringResponse,
)
from apps.kuaiiot.schemas.data_alert_schemas import (
    DataAlertBase,
    DataAlertCreate,
    DataAlertUpdate,
    DataAlertResponse,
)

__all__ = [
    "DeviceDataCollectionBase",
    "DeviceDataCollectionCreate",
    "DeviceDataCollectionUpdate",
    "DeviceDataCollectionResponse",
    "SensorConfigurationBase",
    "SensorConfigurationCreate",
    "SensorConfigurationUpdate",
    "SensorConfigurationResponse",
    "SensorDataBase",
    "SensorDataCreate",
    "SensorDataUpdate",
    "SensorDataResponse",
    "RealTimeMonitoringBase",
    "RealTimeMonitoringCreate",
    "RealTimeMonitoringUpdate",
    "RealTimeMonitoringResponse",
    "DataAlertBase",
    "DataAlertCreate",
    "DataAlertUpdate",
    "DataAlertResponse",
]

