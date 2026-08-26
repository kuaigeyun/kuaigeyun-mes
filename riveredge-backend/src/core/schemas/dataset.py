"""
数据集 Schema 模块

定义数据集相关的 Pydantic Schema，用于数据验证和序列化。
"""

from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


OUTPUT_TYPE_LIST = "list"
OUTPUT_TYPE_METRIC = "metric"
OUTPUT_TYPE_MULTI_METRIC = "multi_metric"
OUTPUT_TYPES = (OUTPUT_TYPE_LIST, OUTPUT_TYPE_METRIC, OUTPUT_TYPE_MULTI_METRIC)


class DatasetBase(BaseModel):
    """数据集基础 Schema"""
    name: str = Field(..., max_length=100, description="数据集名称")
    code: str = Field(..., max_length=50, description="数据集代码")
    description: Optional[str] = Field(None, description="数据集描述")
    query_type: str = Field(..., max_length=20, description="查询类型")
    query_config: Dict[str, Any] = Field(..., description="查询配置")
    output_type: str = Field(OUTPUT_TYPE_LIST, max_length=20, description="输出类型：list/metric/multi_metric")
    display_config: Optional[Dict[str, Any]] = Field(None, description="指标展示配置")
    is_active: bool = Field(True, description="是否启用")

    @field_validator('query_type')
    @classmethod
    def validate_query_type(cls, v):
        """验证查询类型"""
        allowed_types = ['sql', 'api']
        if v not in allowed_types:
            raise ValueError(f'查询类型必须是 {allowed_types} 之一')
        return v

    @field_validator('output_type')
    @classmethod
    def validate_output_type(cls, v):
        """验证输出类型"""
        if v not in OUTPUT_TYPES:
            raise ValueError(f'输出类型必须是 {list(OUTPUT_TYPES)} 之一')
        return v


class DatasetCreate(DatasetBase):
    """创建数据集 Schema"""
    data_source_uuid: UUID = Field(..., description="数据源UUID")
    category_uuid: Optional[UUID] = Field(None, description="所属分类 UUID（可选）")


class DatasetUpdate(BaseModel):
    """更新数据集 Schema"""
    name: Optional[str] = Field(None, max_length=100, description="数据集名称")
    code: Optional[str] = Field(None, max_length=50, description="数据集代码")
    description: Optional[str] = Field(None, description="数据集描述")
    query_type: Optional[str] = Field(None, max_length=20, description="查询类型")
    query_config: Optional[Dict[str, Any]] = Field(None, description="查询配置")
    output_type: Optional[str] = Field(None, max_length=20, description="输出类型")
    display_config: Optional[Dict[str, Any]] = Field(None, description="指标展示配置")
    is_active: Optional[bool] = Field(None, description="是否启用")
    category_uuid: Optional[UUID] = Field(None, description="所属分类 UUID（可选，传 null 清除分类）")


class DatasetResponse(DatasetBase):
    """数据集响应 Schema"""
    uuid: UUID = Field(..., description="数据集UUID")
    tenant_id: int = Field(..., description="组织ID")
    data_source_uuid: UUID = Field(..., description="数据源UUID")
    category_uuid: Optional[UUID] = Field(None, description="所属分类 UUID")
    category_name: Optional[str] = Field(None, description="所属分类名称")
    last_executed_at: Optional[datetime] = Field(None, description="最后执行时间")
    last_error: Optional[str] = Field(None, description="最后执行错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")

    model_config = ConfigDict(from_attributes=True)


class ExecuteQueryRequest(BaseModel):
    """执行查询请求 Schema"""
    parameters: Optional[Dict[str, Any]] = Field(None, description="查询参数（覆盖数据集定义）")
    limit: Optional[int] = Field(100, ge=1, le=10000, description="限制返回行数")
    offset: Optional[int] = Field(0, ge=0, description="偏移量")
    query_config: Optional[Dict[str, Any]] = Field(
        None,
        description="可选：与数据集已保存的 query_config 浅合并，仅用于本次执行（不落库），便于设计器未保存时预览",
    )
    fill_missing_sql_parameters: bool = Field(
        False,
        description=(
            "仅 SQL 数据集：为 SQL 中出现但本次未传入的命名参数（:name）补 NULL，便于零行时仍解析语句。"
            "列名探测等场景可设为 true；常规业务查询请保持 false。"
        ),
    )


class ExecuteQueryResponse(BaseModel):
    """执行查询响应 Schema"""
    success: bool = Field(..., description="查询是否成功")
    data: List[Dict[str, Any]] = Field(..., description="查询结果数据")
    total: Optional[int] = Field(None, description="总行数（如果支持）")
    columns: Optional[List[str]] = Field(None, description="列信息")
    elapsed_time: float = Field(..., description="查询耗时（秒）")
    error: Optional[str] = Field(None, description="错误信息")


class StatCardItem(BaseModel):
    """指标卡单项（供前端 ListPageTemplate 使用）"""
    key: Optional[str] = Field(None, description="数据字段 key，用于前端匹配原生统计的 trend/description")
    title: str = Field(..., description="标题")
    value: Optional[Any] = Field(None, description="数值")
    suffix: Optional[str] = Field(None, description="后缀，如「单」")
    color: Optional[str] = Field(None, description="数值颜色")
    precision: Optional[int] = Field(None, description="精度")
    formatter: Optional[str] = Field(None, description="格式化：number/currency")
    filter_key: Optional[str] = Field(None, description="点击筛选时的查询参数 key")
    filter_value: Optional[str] = Field(None, description="点击筛选时的查询参数 value")


class PageMetricsResponse(BaseModel):
    """按页面路径返回的指标卡"""
    stat_cards: List[StatCardItem] = Field(..., description="指标卡列表")
    dataset_code: Optional[str] = Field(None, description="绑定的数据集 code")

    model_config = ConfigDict(populate_by_name=True)


class PageMetricConfigCreate(BaseModel):
    """页面指标配置创建"""
    page_path: str = Field(..., max_length=255, description="页面路由")
    dataset_code: str = Field(..., max_length=50, description="指标型数据集 code")
    sort_order: int = Field(0, description="排序")


class PageMetricConfigItem(BaseModel):
    """页面指标配置项"""
    uuid: str = Field(..., description="配置UUID")
    page_path: str = Field(..., description="页面路由")
    dataset_code: str = Field(..., description="数据集 code")
    sort_order: int = Field(0, description="排序")

