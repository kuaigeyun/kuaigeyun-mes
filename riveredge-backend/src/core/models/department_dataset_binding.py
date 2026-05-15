"""部门管理与数据集的关联配置（从数据集同步部门树）。"""

from tortoise import fields

from .base import BaseModel


class DepartmentDatasetBinding(BaseModel):
    """每个租户一条：一个数据集 + 结果列映射；无参执行拉全量后 upsert 部门。"""

    id = fields.IntField(pk=True, description="主键")

    class Meta:
        table = "core_department_dataset_binding"
        table_description = "部门管理 - 数据集关联"
        indexes = [("tenant_id",)]

    dataset_uuid = fields.CharField(max_length=36, null=True, description="关联的数据集 UUID")
    department_name_column = fields.CharField(max_length=128, null=True, description="部门名称列名")
    department_code_column = fields.CharField(max_length=128, null=True, description="部门代码列名（可选）")
    parent_ref_column = fields.CharField(
        max_length=128,
        null=True,
        description="上级部门引用列（可选；与导入一致，按名称或代码匹配已有部门）",
    )
    description_column = fields.CharField(max_length=128, null=True, description="描述/备注列名（可选）")
    # 历史字段：不再通过 API/前端配置，保存绑定时常量置空；同步逻辑不读取。
    sort_order_column = fields.CharField(max_length=128, null=True, description="（已弃用）排序列名")
    is_active_column = fields.CharField(max_length=128, null=True, description="（已弃用）是否启用列名")
