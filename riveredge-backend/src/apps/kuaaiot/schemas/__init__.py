"""
IOT Schema 模块

导出所有IOT相关的Schema。
"""

from .device_data_collection_schemas import (
    DeviceDataCollectionBase,
    DeviceDataCollectionCreate,
    DeviceDataCollectionUpdate,
    DeviceDataCollectionResponse,
)
from .sensor_data_schemas import (
    SensorDataBase,
    SensorDataCreate,
    SensorDataUpdate,
    SensorDataResponse,
)
from .real_time_monitoring_schemas import (
    RealTimeMonitoringBase,
    RealTimeMonitoringCreate,
    RealTimeMonitoringUpdate,
    RealTimeMonitoringResponse,
)
from .data_interface_schemas import (
    DataInterfaceBase,
    DataInterfaceCreate,
    DataInterfaceUpdate,
    DataInterfaceResponse,
)

__all__ = [
    "DeviceDataCollectionBase",
    "DeviceDataCollectionCreate",
    "DeviceDataCollectionUpdate",
    "DeviceDataCollectionResponse",
    "SensorDataBase",
    "SensorDataCreate",
    "SensorDataUpdate",
    "SensorDataResponse",
    "RealTimeMonitoringBase",
    "RealTimeMonitoringCreate",
    "RealTimeMonitoringUpdate",
    "RealTimeMonitoringResponse",
    "DataInterfaceBase",
    "DataInterfaceCreate",
    "DataInterfaceUpdate",
    "DataInterfaceResponse",
]

