from enum import Enum

class ReportStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"

class DataSourceType(str, Enum):
    SQL = "SQL"
    API = "API"
    STATIC = "STATIC"
