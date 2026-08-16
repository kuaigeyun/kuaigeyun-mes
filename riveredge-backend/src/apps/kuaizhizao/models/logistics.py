"""
快制造物流管理模型

承运商、车辆、驾驶员、货运单、轨迹、回执、运费单。
"""

from tortoise import fields

from core.models.base import BaseModel


class LogisticsCarrier(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, db_index=True, description="承运商编码")
    name = fields.CharField(max_length=200, description="承运商名称")
    carrier_type = fields.CharField(max_length=30, default="express", description="类型 express/truck/ltl")
    contact_name = fields.CharField(max_length=100, null=True, description="联系人")
    contact_phone = fields.CharField(max_length=50, null=True, description="联系电话")
    service_hotline = fields.CharField(max_length=50, null=True, description="官方服务热线")
    settlement_method = fields.CharField(max_length=50, null=True, description="结算方式")
    supplier_id = fields.IntField(null=True, description="关联快财务供应商ID")
    remark = fields.TextField(null=True, description="备注")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_logistics_carriers"
        indexes = [("tenant_id",), ("code",), ("is_enabled",)]


class Vehicle(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    plate_number = fields.CharField(max_length=30, db_index=True, description="车牌号")
    vehicle_type = fields.CharField(max_length=50, null=True, description="车型")
    load_capacity = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="载重吨")
    volume_capacity = fields.DecimalField(max_digits=12, decimal_places=2, null=True, description="容积")
    ownership = fields.CharField(max_length=20, default="internal", description="归属 internal/external")
    carrier_id = fields.IntField(null=True, description="外部车辆关联承运商")
    status = fields.CharField(max_length=20, default="idle", description="状态 idle/in_transit/maintenance/disabled")
    remark = fields.TextField(null=True, description="备注")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_vehicles"
        indexes = [("tenant_id",), ("plate_number",), ("ownership",), ("status",)]


class Driver(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, db_index=True, description="驾驶员编码")
    name = fields.CharField(max_length=100, description="姓名")
    phone = fields.CharField(max_length=50, null=True, description="电话")
    license_number = fields.CharField(max_length=50, null=True, description="驾照号")
    ownership = fields.CharField(max_length=20, default="internal", description="归属 internal/external")
    carrier_id = fields.IntField(null=True, description="外部驾驶员关联承运商")
    user_id = fields.IntField(null=True, description="内部员工用户ID")
    default_vehicle_id = fields.IntField(null=True, description="默认车辆ID")
    remark = fields.TextField(null=True, description="备注")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_drivers"
        indexes = [("tenant_id",), ("code",), ("ownership",)]


class FreightOrder(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    order_code = fields.CharField(max_length=50, db_index=True, description="货运单号")
    business_direction = fields.CharField(max_length=30, description="业务方向 sales_outbound/purchase_inbound")
    transport_mode = fields.CharField(max_length=30, default="external_carrier", description="承运方式")
    carrier_id = fields.IntField(null=True, description="承运商ID")
    carrier_name = fields.CharField(max_length=200, null=True, description="承运商名称")
    vehicle_id = fields.IntField(null=True, description="车辆ID")
    vehicle_plate = fields.CharField(max_length=30, null=True, description="车牌号")
    driver_id = fields.IntField(null=True, description="驾驶员ID")
    driver_name = fields.CharField(max_length=100, null=True, description="驾驶员姓名")
    driver_phone = fields.CharField(max_length=50, null=True, description="驾驶员电话")
    tracking_number = fields.CharField(max_length=100, null=True, description="运单号")
    sender_phone = fields.CharField(max_length=50, null=True, description="发件人手机号")
    recipient_phone = fields.CharField(max_length=50, null=True, description="收件人手机号")
    origin_address = fields.TextField(null=True, description="发货地址")
    destination_address = fields.TextField(null=True, description="收货地址")
    origin_lng = fields.FloatField(null=True, description="发货地址经度")
    origin_lat = fields.FloatField(null=True, description="发货地址纬度")
    destination_lng = fields.FloatField(null=True, description="收货地址经度")
    destination_lat = fields.FloatField(null=True, description="收货地址纬度")
    planned_depart_at = fields.DatetimeField(null=True, description="计划发运时间")
    planned_arrive_at = fields.DatetimeField(null=True, description="计划到达时间")
    actual_depart_at = fields.DatetimeField(null=True, description="实际发运时间")
    actual_arrive_at = fields.DatetimeField(null=True, description="实际到达时间")
    status = fields.CharField(max_length=20, default="draft", description="状态")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_freight_orders"
        indexes = [("tenant_id",), ("order_code",), ("business_direction",), ("status",), ("tracking_number",)]


class FreightOrderSource(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    freight_order_id = fields.IntField(description="货运单ID")
    source_type = fields.CharField(max_length=50, description="来源类型")
    source_id = fields.IntField(description="来源单据ID")
    source_code = fields.CharField(max_length=50, description="来源单据编码")
    partner_name = fields.CharField(max_length=200, null=True, description="客户或供应商名称")

    class Meta:
        table = "apps_kuaizhizao_freight_order_sources"
        indexes = [("tenant_id",), ("freight_order_id",), ("source_type", "source_id")]


class FreightTrackingEvent(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    freight_order_id = fields.IntField(description="货运单ID")
    event_type = fields.CharField(max_length=30, description="节点类型")
    event_time = fields.DatetimeField(description="节点时间")
    location = fields.CharField(max_length=200, null=True, description="地点")
    lng = fields.FloatField(null=True, description="地点经度")
    lat = fields.FloatField(null=True, description="地点纬度")
    remark = fields.TextField(null=True, description="备注")
    operator_id = fields.IntField(null=True, description="操作人ID")
    operator_name = fields.CharField(max_length=100, null=True, description="操作人姓名")

    class Meta:
        table = "apps_kuaizhizao_freight_tracking_events"
        indexes = [("tenant_id",), ("freight_order_id",), ("event_time",)]


class FreightOrderReceipt(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    freight_order_id = fields.IntField(description="货运单ID")
    signed_by = fields.CharField(max_length=100, description="签收人")
    signed_at = fields.DatetimeField(description="签收时间")
    receipt_result = fields.CharField(max_length=30, default="full", description="签收结果 full/partial/reject")
    remark = fields.TextField(null=True, description="备注")
    attachments = fields.JSONField(null=True, description="附件")

    class Meta:
        table = "apps_kuaizhizao_freight_order_receipts"
        indexes = [("tenant_id",), ("freight_order_id",)]


class FreightBill(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    bill_code = fields.CharField(max_length=50, db_index=True, description="运费单号")
    carrier_id = fields.IntField(description="承运商ID")
    carrier_name = fields.CharField(max_length=200, description="承运商名称")
    period_start = fields.DateField(null=True, description="结算期起")
    period_end = fields.DateField(null=True, description="结算期止")
    total_amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="总金额")
    status = fields.CharField(max_length=20, default="draft", description="单据状态")
    review_status = fields.CharField(max_length=20, default="draft", description="审核状态")
    reviewer_id = fields.IntField(null=True, description="审核人")
    reviewer_name = fields.CharField(max_length=100, null=True, description="审核人姓名")
    reviewed_at = fields.DatetimeField(null=True, description="审核时间")
    payable_id = fields.IntField(null=True, description="关联应付单ID")
    payable_code = fields.CharField(max_length=50, null=True, description="关联应付单号")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True, description="删除时间")

    class Meta:
        table = "apps_kuaizhizao_freight_bills"
        indexes = [("tenant_id",), ("bill_code",), ("carrier_id",), ("review_status",)]


class FreightBillItem(BaseModel):
    tenant_id = fields.IntField(description="租户ID")
    freight_bill_id = fields.IntField(description="运费单ID")
    freight_order_id = fields.IntField(description="货运单ID")
    freight_order_code = fields.CharField(max_length=50, description="货运单号")
    fee_type = fields.CharField(max_length=30, default="base", description="费用类型")
    amount = fields.DecimalField(max_digits=14, decimal_places=2, default=0, description="金额")
    remark = fields.TextField(null=True, description="备注")

    class Meta:
        table = "apps_kuaizhizao_freight_bill_items"
        indexes = [("tenant_id",), ("freight_bill_id",), ("freight_order_id",)]
