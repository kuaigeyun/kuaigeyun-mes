"""
客户来料登记数据模型模块

定义客户来料登记和条码映射规则数据模型，支持一维码/二维码扫码识别、条码解析、条码映射等。

Author: Luigi Lu
Date: 2025-01-04
"""

from tortoise import fields
from core.models.base import BaseModel


class BarcodeMappingRule(BaseModel):
    """
    条码映射规则模型

    用于配置客户来料条码到内部物料的映射规则。

    Attributes:
        id: 主键ID（自增ID，内部使用）
        uuid: 业务ID（UUID，对外暴露，安全且唯一，继承自BaseModel）
        tenant_id: 组织ID（用于多组织数据隔离，继承自BaseModel）
        code: 映射规则编码
        name: 映射规则名称
        customer_id: 客户ID（可选，如果为空则适用于所有客户）
        customer_name: 客户名称（可选）
        barcode_pattern: 条码模式（正则表达式）
        barcode_type: 条码类型（1d/2d）
        material_id: 映射到的物料ID
        material_code: 映射到的物料编码
        material_name: 映射到的物料名称
        parsing_rule: 解析规则（JSON格式，定义如何从条码中提取信息）
        is_enabled: 是否启用
        priority: 优先级（数字越大优先级越高）
        remarks: 备注
        created_by: 创建人ID
        created_by_name: 创建人姓名
        updated_by: 更新人ID
        updated_by_name: 更新人姓名
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_barcode_mapping_rules"
        indexes = [
            ("tenant_id",),
            ("customer_id",),
            ("material_id",),
            ("is_enabled",),
            ("priority",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 业务编码
    code = fields.CharField(max_length=50, description="映射规则编码")
    name = fields.CharField(max_length=200, description="映射规则名称")

    # 客户信息（可选）
    customer_id = fields.IntField(null=True, description="客户ID（可选，如果为空则适用于所有客户）")
    customer_name = fields.CharField(max_length=200, null=True, description="客户名称（可选）")

    # 条码信息
    barcode_pattern = fields.CharField(max_length=500, description="条码模式（正则表达式）")
    barcode_type = fields.CharField(max_length=10, default="1d", description="条码类型（1d/2d）")

    # 映射信息
    material_id = fields.IntField(description="映射到的物料ID")
    material_code = fields.CharField(max_length=50, description="映射到的物料编码")
    material_name = fields.CharField(max_length=200, description="映射到的物料名称")

    # 解析规则（JSON格式）
    parsing_rule = fields.JSONField(null=True, description="解析规则（JSON格式，定义如何从条码中提取信息）")

    # 状态
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    priority = fields.IntField(default=0, description="优先级（数字越大优先级越高）")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.name} - {self.barcode_pattern}"


class CustomerMaterialRegistration(BaseModel):
    """
    客户来料登记模型

    用于记录客户来料登记信息，包括条码识别、物料映射等。

    Attributes:
        id: 主键ID
        uuid: 业务ID
        tenant_id: 组织ID
        registration_code: 登记编码
        customer_id: 客户ID
        customer_name: 客户名称
        barcode: 客户条码（一维码或二维码）
        barcode_type: 条码类型（1d/2d）
        parsed_data: 解析后的数据（JSON格式）
        mapped_material_id: 映射到的物料ID
        mapped_material_code: 映射到的物料编码
        mapped_material_name: 映射到的物料名称
        mapping_rule_id: 使用的映射规则ID（关联BarcodeMappingRule）
        quantity: 来料数量
        registration_date: 登记日期
        registered_by: 登记人ID
        registered_by_name: 登记人姓名
        warehouse_id: 入库仓库ID（可选）
        warehouse_name: 入库仓库名称（可选）
        status: 状态（pending/processed/cancelled）
        processed_at: 处理时间
        remarks: 备注
        deleted_at: 删除时间（软删除）
    """

    class Meta:
        """
        模型元数据
        """
        table = "apps_kuaizhizao_customer_material_registrations"
        indexes = [
            ("tenant_id",),
            ("customer_id",),
            ("barcode",),
            ("mapped_material_id",),
            ("registration_date",),
            ("status",),
            ("created_at",),
        ]

    # 主键
    id = fields.IntField(pk=True, description="主键ID")

    # 业务编码
    registration_code = fields.CharField(max_length=50, description="登记编码")

    # 客户信息
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称")

    # 条码信息
    barcode = fields.CharField(max_length=500, description="客户条码（一维码或二维码）")
    barcode_type = fields.CharField(max_length=10, default="1d", description="条码类型（1d/2d）")
    parsed_data = fields.JSONField(null=True, description="解析后的数据（JSON格式）")

    # 映射信息
    mapped_material_id = fields.IntField(null=True, description="映射到的物料ID")
    mapped_material_code = fields.CharField(max_length=50, null=True, description="映射到的物料编码")
    mapped_material_name = fields.CharField(max_length=200, null=True, description="映射到的物料名称")
    mapping_rule_id = fields.IntField(null=True, description="使用的映射规则ID（关联BarcodeMappingRule）")

    # 来料信息
    quantity = fields.DecimalField(max_digits=12, decimal_places=2, description="来料数量")
    registration_date = fields.DatetimeField(description="登记日期")

    # 登记人信息
    registered_by = fields.IntField(description="登记人ID")
    registered_by_name = fields.CharField(max_length=100, description="登记人姓名")

    # 入库信息（可选）
    warehouse_id = fields.IntField(null=True, description="入库仓库ID（可选）")
    warehouse_name = fields.CharField(max_length=200, null=True, description="入库仓库名称（可选）")

    # 状态
    status = fields.CharField(max_length=20, default="pending", description="状态（pending/processed/cancelled）")
    processed_at = fields.DatetimeField(null=True, description="处理时间")

    # 备注
    remarks = fields.TextField(null=True, description="备注")

    # 软删除字段
    deleted_at = fields.DatetimeField(null=True, description="删除时间（软删除）")

    def __str__(self):
        """字符串表示"""
        return f"{self.registration_code} - {self.customer_name}"

