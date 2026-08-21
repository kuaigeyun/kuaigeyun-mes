"""
辐条轮毂总装模块 — 数据模型

承载"铝合金轮毂 + 花毂筒 + 变位器 + 钢丝 + 弹头"五种部件的总装业务:
- SpokeWheelAssembly: 总装记录(每完成一次总装一条)
- SpokeWheelConcentricityCheck: 同心度检测记录(百分表 3 个读数,3 个值极差 ≤ 0.8mm 合格)

注: 业务主流程(工单/工艺路线/委外/质检/入库)沿用 master_data + kuaizhizao 现成模块,
本模块只承载"总装调试"专属数据。
"""
from tortoise import fields
from core.models.base import BaseModel


class SpokeWheelAssembly(BaseModel):
    """辐条轮毂总装记录"""

    class Meta:
        table = "apps_spoke_wheel_assemblies"
        table_description = "辐条轮毂总装记录"

    code = fields.CharField(max_length=50, db_index=True, description="总装单号(租户内唯一)")
    # 关联 MES 现成对象(不强外键,留 id 给上层 JOIN 拼接展示)
    work_order_id = fields.IntField(null=True, db_index=True, description="工单ID")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单编码")
    product_material_id = fields.IntField(null=True, db_index=True, description="辐条轮毂物料ID")
    product_material_code = fields.CharField(max_length=50, null=True, description="辐条轮毂编码")
    product_material_name = fields.CharField(max_length=200, null=True, description="辐条轮毂名称")
    # 5 个部件齐套
    hub_assembled = fields.BooleanField(default=False, description="铝合金轮毂已固定")
    hub_barrel_assembled = fields.BooleanField(default=False, description="花毂筒已固定")
    hub_assembled_at = fields.DatetimeField(null=True, description="轮毂+花毂筒总装完成时间")
    # 调试工装 + 3 个百分表
    fixture_dial_count = fields.IntField(default=3, description="百分表数量(默认 3)")
    # 状态
    status = fields.CharField(
        max_length=20,
        default="draft",
        description="draft=待装配, fixed=已固定 4 等份, debugging=调试中, qc_passed=同心度合格, qc_failed=同心度不合格, completed=总装完成",
    )
    # 同步装配/调试人员
    assembler_id = fields.IntField(null=True, description="装配工 ID")
    assembler_name = fields.CharField(max_length=100, null=True, description="装配工姓名")
    debugger_id = fields.IntField(null=True, description="调试工 ID")
    debugger_name = fields.CharField(max_length=100, null=True, description="调试工姓名")
    inspector_id = fields.IntField(null=True, description="最终质检员 ID")
    inspector_name = fields.CharField(max_length=100, null=True, description="最终质检员姓名")
    # 时间戳
    fixed_at = fields.DatetimeField(null=True, description="4 等份固定完成时间")
    debug_started_at = fields.DatetimeField(null=True, description="调试开始时间")
    debug_completed_at = fields.DatetimeField(null=True, description="调试完成时间")
    completed_at = fields.DatetimeField(null=True, description="总装完成时间")
    # 备注 + JSON 字段(灵活扩展)
    remarks = fields.TextField(null=True, description="备注")
    extra = fields.JSONField(null=True, description="扩展字段(钢丝弹头数量等)")
    # 同步检查汇总(冗余存储便于查询)
    final_max_deviation_mm = fields.DecimalField(max_digits=10, decimal_places=4, null=True, description="最终同心度极差(mm)")
    final_qc_passed = fields.BooleanField(null=True, description="最终同心度是否合格")


class SpokeWheelConcentricityCheck(BaseModel):
    """同心度检测记录 — 3 个百分表读数"""

    class Meta:
        table = "apps_spoke_wheel_concentricity_checks"
        table_description = "同心度检测 - 3 个百分表读数,极差 ≤ tolerance 视为合格"

    assembly_id = fields.IntField(db_index=True, description="所属总装记录 ID")
    assembly_code = fields.CharField(max_length=50, db_index=True, description="总装单号(冗余)")
    # 3 个百分表读数 (单位: mm)
    dial_1_value = fields.DecimalField(max_digits=10, decimal_places=4, description="百分表 1 读数(mm)")
    dial_2_value = fields.DecimalField(max_digits=10, decimal_places=4, description="百分表 2 读数(mm)")
    dial_3_value = fields.DecimalField(max_digits=10, decimal_places=4, description="百分表 3 读数(mm)")
    # 自动计算字段(由 service 在 create 时算)
    max_deviation_mm = fields.DecimalField(max_digits=10, decimal_places=4, description="极差 = max(dial) - min(dial),mm")
    tolerance_mm = fields.DecimalField(max_digits=10, decimal_places=4, default=0.8, description="允差阈值 mm")
    is_qualified = fields.BooleanField(description="是否合格: 极差 ≤ tolerance 视为合格")
    # 录入元数据
    inspector_id = fields.IntField(null=True, description="录入人 ID")
    inspector_name = fields.CharField(max_length=100, null=True, description="录入人姓名")
    remarks = fields.TextField(null=True, description="备注(可记录返工/调整情况)")
    measured_at = fields.DatetimeField(null=True, description="测量时间")
    # BaseModel 没自动创建人字段,显式补上(与 kuaizhizao 模型对齐)
    created_by = fields.IntField(null=True, description="创建人ID")
    created_by_name = fields.CharField(max_length=100, null=True, description="创建人姓名")
    updated_by = fields.IntField(null=True, description="更新人ID")
    updated_by_name = fields.CharField(max_length=100, null=True, description="更新人姓名")