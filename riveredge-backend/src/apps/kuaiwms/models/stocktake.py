"""
盘点单模型模块

定义盘点单数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class Stocktake(BaseModel):
    """
    盘点单模型
    
    用于管理库存盘点，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        stocktake_no: 盘点单编号（组织内唯一）
        stocktake_date: 盘点日期
        warehouse_id: 仓库ID（关联master-data）
        location_id: 库位ID（关联master-data，可选，为空表示全库盘点）
        status: 盘点状态（草稿、进行中、已完成、已关闭）
        stocktake_type: 盘点类型（全盘、抽盘、循环盘点）
        stocktake_items: 盘点明细（JSON格式）
        difference_amount: 差异金额
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "seed_kuaiwms_stocktakes"
        indexes = [
            ("tenant_id",),
            ("stocktake_no",),
            ("uuid",),
            ("status",),
            ("warehouse_id",),
            ("location_id",),
            ("stocktake_date",),
            ("created_at",),
        ]
        unique_together = [("tenant_id", "stocktake_no")]
    
    # 主键
    id = fields.IntField(pk=True, description="主键ID")
    
    # 基本信息
    stocktake_no = fields.CharField(max_length=50, description="盘点单编号（组织内唯一）")
    stocktake_date = fields.DatetimeField(description="盘点日期")
    warehouse_id = fields.IntField(description="仓库ID（关联master-data）")
    location_id = fields.IntField(null=True, description="库位ID（关联master-data，可选，为空表示全库盘点）")
    
    # 盘点状态
    status = fields.CharField(max_length=50, default="草稿", description="盘点状态（草稿、进行中、已完成、已关闭）")
    
    # 盘点类型
    stocktake_type = fields.CharField(max_length=50, default="全盘", description="盘点类型（全盘、抽盘、循环盘点）")
    
    # 盘点明细（JSON格式存储）
    stocktake_items = fields.JSONField(null=True, description="盘点明细（JSON格式）")
    
    # 差异金额
    difference_amount = fields.DecimalField(max_digits=18, decimal_places=2, default=0, description="差异金额")
    
    # 备注
    remark = fields.TextField(null=True, description="备注")
    
    # 负责人
    owner_id = fields.IntField(null=True, description="负责人ID（用户ID）")
    
    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")
    
    def __str__(self):
        """字符串表示"""
        return f"{self.stocktake_no} - {self.stocktake_type}"
