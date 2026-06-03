"""
物料产品工艺配置（单表聚合）

按物料存储工艺路线指派、工序序列与工时、工序资源、计件单价等，避免拆散在多张业务表上分别维护。
"""

from tortoise import fields

from infra.models.base import BaseModel


class MaterialProductProcess(BaseModel):
    """物料产品工艺配置（每物料一行）"""

    class Meta:
        table = "apps_master_data_material_product_process"
        table_description = "基础数据管理 - 物料产品工艺"
        indexes = [
            ("tenant_id",),
            ("material_id",),
            ("uuid",),
        ]
        unique_together = [("tenant_id", "material_id")]

    id = fields.IntField(pk=True, description="主键ID")
    material_id = fields.IntField(description="物料ID")
    process_route_id = fields.IntField(null=True, description="工艺路线ID")
    allow_operation_jump = fields.BooleanField(default=False, description="是否允许工序跳转")
    lines = fields.JSONField(default=list, description="工序行 JSON 数组")

    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        return f"MaterialProductProcess material_id={self.material_id}"
