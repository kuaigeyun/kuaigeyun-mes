"""
供应链网络模型模块

定义供应链网络数据模型，支持多组织隔离。
"""

from tortoise import fields
from core.models.base import BaseModel


class SupplyChainNetwork(BaseModel):
    """
    供应链网络模型
    
    用于管理供应链网络结构，支持多组织隔离。
    
    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        network_no: 网络编号（组织内唯一）
        network_name: 网络名称
        node_type: 节点类型（供应商、制造商、分销商、客户等）
        node_id: 节点ID（关联master-data或其他模块）
        node_name: 节点名称
        node_code: 节点编码
        parent_node_id: 父节点ID（用于层级结构）
        parent_node_uuid: 父节点UUID
        level: 层级（1、2、3等）
        relationship_type: 关系类型（直接供应商、间接供应商、客户等）
        status: 状态（启用、停用）
        remark: 备注
        created_at: 创建时间（继承自BaseModel）
        updated_at: 更新时间（继承自BaseModel）
        deleted_at: 删除时间（软删除）
    """
    
    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaiscm_supply_chain_networks"
        indexes = [
            ("tenant_id",),
            ("network_no",),
            ("node_type",),
            ("node_id",),
            ("parent_node_id",),
            ("level",),
            ("status",),
        ]
        unique_together = [("tenant_id", "network_no")]
    
    network_no = fields.CharField(max_length=100, description="网络编号")
    network_name = fields.CharField(max_length=200, description="网络名称")
    node_type = fields.CharField(max_length=50, description="节点类型")
    node_id = fields.IntField(null=True, description="节点ID")
    node_name = fields.CharField(max_length=200, null=True, description="节点名称")
    node_code = fields.CharField(max_length=100, null=True, description="节点编码")
    parent_node_id = fields.IntField(null=True, description="父节点ID")
    parent_node_uuid = fields.CharField(max_length=36, null=True, description="父节点UUID")
    level = fields.IntField(default=1, description="层级")
    relationship_type = fields.CharField(max_length=50, null=True, description="关系类型")
    status = fields.CharField(max_length=50, default="启用", description="状态")
    remark = fields.TextField(null=True, description="备注")

