"""
快制造售后服务模块模型

装机档案、维修单、服务派工、备件申领、服务结算、客户回访。
"""

from tortoise import fields

from core.models.base import BaseModel


class ServiceAsset(BaseModel):
    """装机档案（保修卡）"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    asset_code = fields.CharField(max_length=50, db_index=True, description="资产编码")
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    material_id = fields.IntField(null=True, description="产品物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="产品编码")
    material_name = fields.CharField(max_length=200, null=True, description="产品名称")
    material_spec = fields.CharField(max_length=200, null=True, description="规格型号")
    serial_number = fields.CharField(max_length=100, null=True, description="序列号")

    sales_order_id = fields.IntField(null=True, description="来源销售订单ID")
    sales_order_code = fields.CharField(max_length=50, null=True, description="来源销售订单编码")
    sales_delivery_id = fields.IntField(null=True, description="来源销售出库单ID")
    sales_delivery_code = fields.CharField(max_length=50, null=True, description="来源销售出库单编码")
    install_execution_id = fields.IntField(null=True, description="来源安装执行单ID")
    install_execution_code = fields.CharField(max_length=50, null=True, description="来源安装执行单编码")

    install_address = fields.CharField(max_length=500, null=True, description="安装地址")
    accepted_at = fields.DatetimeField(null=True, description="验收日期")
    warranty_start_at = fields.DatetimeField(null=True, description="保修起始")
    warranty_end_at = fields.DatetimeField(null=True, description="保修截止")
    warranty_months = fields.IntField(null=True, description="保修月数")
    warranty_policy = fields.CharField(max_length=100, null=True, description="保修策略")

    # 在用 / 停用 / 报废
    status = fields.CharField(max_length=20, default="在用", description="状态")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_service_assets"
        indexes = [
            ("tenant_id", "asset_code"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "serial_number"),
            ("tenant_id", "status"),
        ]


class RepairOrder(BaseModel):
    """维修单"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    order_code = fields.CharField(max_length=50, db_index=True, description="维修单号")
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    after_sales_ticket_id = fields.IntField(null=True, description="来源售后工单ID")
    after_sales_ticket_code = fields.CharField(max_length=50, null=True, description="来源售后工单编码")
    service_asset_id = fields.IntField(null=True, description="装机档案ID")
    service_asset_code = fields.CharField(max_length=50, null=True, description="装机档案编码")

    # 现场 / 返厂
    repair_mode = fields.CharField(max_length=20, default="现场", description="维修方式")
    fault_category = fields.CharField(max_length=100, null=True, description="故障分类")
    fault_description = fields.TextField(description="故障描述")
    diagnosis_result = fields.TextField(null=True, description="诊断结果")
    resolution = fields.TextField(null=True, description="处理结果")

    # 保内 / 保外 / 待判定
    warranty_status = fields.CharField(max_length=20, default="待判定", description="保内保外")
    warranty_override_reason = fields.TextField(null=True, description="改判原因")

    labor_cost = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="人工费")
    travel_cost = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="差旅费")
    spare_part_cost = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="备件费")
    outsource_cost = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="外协费")
    total_cost = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="费用合计")

    # 待派工 / 维修中 / 待验收 / 已关闭
    status = fields.CharField(max_length=20, default="待派工", description="状态")
    site_address = fields.CharField(max_length=500, null=True, description="现场地址")

    reported_at = fields.DatetimeField(description="报修时间")
    closed_at = fields.DatetimeField(null=True, description="关闭时间")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_repair_orders"
        indexes = [
            ("tenant_id", "order_code"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
            ("tenant_id", "after_sales_ticket_id"),
            ("tenant_id", "service_asset_id"),
        ]


class RepairOrderItem(BaseModel):
    """维修单备件明细"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    repair_order_id = fields.IntField(description="维修单ID")
    line_no = fields.IntField(description="行号")

    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="规格")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")
    quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="数量")
    unit_price = fields.DecimalField(max_digits=14, decimal_places=4, null=True, description="单价")
    amount = fields.DecimalField(max_digits=16, decimal_places=4, null=True, description="金额")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_repair_order_items"
        indexes = [("tenant_id", "repair_order_id")]


class ServiceDispatchOrder(BaseModel):
    """服务派工单"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    dispatch_code = fields.CharField(max_length=50, db_index=True, description="派工单号")
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    source_type = fields.CharField(max_length=30, description="来源类型 install_execution/repair_order")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")

    engineer_id = fields.IntField(null=True, description="工程师用户ID")
    engineer_name = fields.CharField(max_length=100, null=True, description="工程师姓名")
    planned_start_at = fields.DatetimeField(null=True, description="计划开始")
    planned_end_at = fields.DatetimeField(null=True, description="计划结束")
    actual_start_at = fields.DatetimeField(null=True, description="实际开始")
    actual_end_at = fields.DatetimeField(null=True, description="实际结束")

    site_address = fields.CharField(max_length=500, null=True, description="服务地址")
    # 待接单 / 已接单 / 到场 / 完工 / 已取消
    status = fields.CharField(max_length=20, default="待接单", description="状态")
    checkin_at = fields.DatetimeField(null=True, description="到场签到时间")
    checkin_location = fields.CharField(max_length=200, null=True, description="签到地点")
    completion_notes = fields.TextField(null=True, description="完工说明")
    attachments = fields.JSONField(null=True, description="现场照片附件")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_service_dispatch_orders"
        indexes = [
            ("tenant_id", "dispatch_code"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
            ("tenant_id", "source_type", "source_id"),
            ("tenant_id", "engineer_id"),
        ]


class AfterSalesSparePartRequisition(BaseModel):
    """售后备件申领单"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    requisition_code = fields.CharField(max_length=50, db_index=True, description="申领单号")
    source_type = fields.CharField(max_length=30, description="来源类型 repair_order/install_execution")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")

    warehouse_id = fields.IntField(null=True, description="出库仓库ID")
    warehouse_name = fields.CharField(max_length=100, null=True, description="出库仓库名称")
    other_outbound_id = fields.IntField(null=True, description="关联其他出库单ID")
    other_outbound_code = fields.CharField(max_length=50, null=True, description="关联其他出库单编码")

    # 草稿 / 待审核 / 已审核 / 已驳回
    status = fields.CharField(max_length=20, default="草稿", description="状态")
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    reviewed_at = fields.DatetimeField(null=True, description="审核时间")
    review_remarks = fields.TextField(null=True, description="审核备注")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_after_sales_spare_part_requisitions"
        indexes = [
            ("tenant_id", "requisition_code"),
            ("tenant_id", "status"),
            ("tenant_id", "source_type", "source_id"),
        ]


class AfterSalesSparePartRequisitionItem(BaseModel):
    """售后备件申领明细"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    requisition_id = fields.IntField(description="申领单ID")
    line_no = fields.IntField(description="行号")

    material_id = fields.IntField(null=True, description="物料ID")
    material_code = fields.CharField(max_length=50, null=True, description="物料编码")
    material_name = fields.CharField(max_length=200, null=True, description="物料名称")
    material_spec = fields.CharField(max_length=200, null=True, description="规格")
    material_unit = fields.CharField(max_length=20, null=True, description="单位")
    quantity = fields.DecimalField(max_digits=14, decimal_places=4, default=0, description="数量")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_after_sales_spare_part_requisition_items"
        indexes = [("tenant_id", "requisition_id")]


class ServiceSettlement(BaseModel):
    """服务结算单"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    settlement_code = fields.CharField(max_length=50, db_index=True, description="结算单号")
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    warranty_free_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="保内免收")
    chargeable_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="保外应收")
    total_amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="合计金额")

    # 草稿 / 待审核 / 已审核
    status = fields.CharField(max_length=20, default="草稿", description="状态")
    reviewer_id = fields.IntField(null=True, description="审核人ID")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    reviewed_at = fields.DatetimeField(null=True, description="审核时间")
    review_remarks = fields.TextField(null=True, description="审核备注")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_service_settlements"
        indexes = [
            ("tenant_id", "settlement_code"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "status"),
        ]


class ServiceSettlementItem(BaseModel):
    """服务结算明细"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")
    settlement_id = fields.IntField(description="结算单ID")
    line_no = fields.IntField(description="行号")

    source_type = fields.CharField(max_length=30, description="来源类型 repair_order/install_execution")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")
    warranty_status = fields.CharField(max_length=20, null=True, description="保内保外")
    amount = fields.DecimalField(max_digits=16, decimal_places=4, default=0, description="金额")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_service_settlement_items"
        indexes = [("tenant_id", "settlement_id")]


class CustomerReturnVisit(BaseModel):
    """客户回访"""

    id = fields.IntField(pk=True, description="主键ID")
    tenant_id = fields.IntField(description="租户ID")

    visit_code = fields.CharField(max_length=50, db_index=True, description="回访单号")
    customer_id = fields.IntField(description="客户ID")
    customer_name = fields.CharField(max_length=200, description="客户名称快照")

    source_type = fields.CharField(max_length=30, description="来源类型 after_sales_ticket/repair_order")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")

    visit_method = fields.CharField(max_length=30, default="电话", description="回访方式")
    satisfaction_score = fields.IntField(null=True, description="满意度评分1-5")
    feedback = fields.TextField(null=True, description="客户反馈")
    visitor_id = fields.IntField(null=True, description="回访人ID")
    visitor_name = fields.CharField(max_length=100, null=True, description="回访人姓名")
    visited_at = fields.DatetimeField(description="回访时间")
    notes = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_customer_return_visits"
        indexes = [
            ("tenant_id", "visit_code"),
            ("tenant_id", "customer_id"),
            ("tenant_id", "source_type", "source_id"),
        ]
