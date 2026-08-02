from enum import Enum


class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class ReportCategory(str, Enum):
    SYSTEM = "system"   # 系统预置报表（管理员维护）
    CUSTOM = "custom"   # 用户自制报表


class ChartType(str, Enum):
    """图表类型（与前端 ChartWidget 对齐，单一数据源）"""
    TABLE = "table"       # 表格
    LINE = "line"         # 折线图
    BAR = "bar"           # 柱状图
    COLUMN = "column"     # 柱状图（垂直，与 bar 区分方向）
    PIE = "pie"           # 饼图
    AREA = "area"         # 面积图
    SCATTER = "scatter"   # 散点图
    CARD = "card"         # 指标卡
    RADAR = "radar"       # 雷达图
    GAUGE = "gauge"       # 仪表盘
    LIQUID = "liquid"     # 水球图
    DUAL_AXES = "dualAxes"  # 双轴图


class DataSourceType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLSERVER = "sqlserver"
    ORACLE = "oracle"
    API = "api"
    STATIC = "static"
    INTERNAL = "internal"  # 本地/内置数据库
