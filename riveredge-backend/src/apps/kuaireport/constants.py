from enum import Enum


class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class ReportCategory(str, Enum):
    SYSTEM = "system"   # 系统预置报表（管理员维护）
    CUSTOM = "custom"   # 用户自制报表


class ChartType(str, Enum):
    TABLE = "table"       # 表格
    LINE = "line"         # 折线图
    BAR = "bar"           # 柱状图
    PIE = "pie"           # 饼图
    AREA = "area"         # 面积图
    SCATTER = "scatter"   # 散点图
    CARD = "card"         # 指标卡


class DataSourceType(str, Enum):
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"
    SQLSERVER = "sqlserver"
    ORACLE = "oracle"
    API = "api"
    STATIC = "static"
    INTERNAL = "internal"  # 本地/内置数据库
