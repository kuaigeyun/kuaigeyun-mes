"""
页面指标配置模型模块

定义页面与指标型数据集的绑定关系。
职责单一：页面路径 -> 指标型数据集 code，不承载菜单等职责。
"""

from tortoise import fields
from .base import BaseModel


class PageMetricConfig(BaseModel):
    """
    页面指标配置

    页面路径与指标型数据集（multi_metric）的绑定。
    一个页面仅绑定一个 multi_metric 数据集，一次请求返回该页全部指标。
    """

    id = fields.IntField(pk=True, description="主键")
    # uuid 字段由 BaseModel 提供
    # tenant_id 字段由 BaseModel 提供

    page_path = fields.CharField(
        max_length=255,
        description="页面路由，如 /apps/kuaizhizao/sales-orders",
    )
    dataset_code = fields.CharField(
        max_length=50,
        description="指标型数据集 code（multi_metric）",
    )
    sort_order = fields.IntField(default=0, description="排序")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    class Meta:
        table = "core_page_metric_config"
        indexes = [
            ("tenant_id",),
            ("page_path",),
        ]
        unique_together = [("tenant_id", "page_path")]

    def __str__(self):
        return f"{self.page_path} -> {self.dataset_code}"
