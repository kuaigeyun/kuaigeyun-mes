"""快视觉模型：Agent、检测、相机、方案、复核。"""

from __future__ import annotations

import secrets

from tortoise import fields

from core.models.base import BaseModel


def _generate_device_token() -> str:
    return secrets.token_urlsafe(32)


class VisionAgent(BaseModel):
    """边缘视觉节点（device_token 入站鉴权）。"""

    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="节点编码")
    name = fields.CharField(max_length=100, description="节点名称")
    device_token = fields.CharField(max_length=64, default=_generate_device_token, description="上报鉴权 token")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    last_heartbeat_at = fields.DatetimeField(null=True, description="上次心跳")
    config_version = fields.IntField(default=1, description="配置版本")
    run_mode = fields.CharField(
        max_length=30, default="local_pipeline", description="external_forward|local_pipeline"
    )
    agent_version = fields.CharField(max_length=40, null=True, description="边缘程序版本")
    last_error = fields.TextField(null=True, description="最近错误")
    buffer_pending_count = fields.IntField(default=0, description="本地缓冲条数")
    disk_free_mb = fields.IntField(null=True, description="磁盘剩余 MB")
    last_ops_alert_at = fields.DatetimeField(null=True, description="最近运维告警时刻")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_agents"
        table_description = "快视觉 - 边缘节点"
        unique_together = (("tenant_id", "code"),)
        indexes = [
            ("device_token",),
            ("tenant_id", "is_enabled"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionInspectionEvent(BaseModel):
    """一次视觉检测事件。"""

    tenant_id = fields.IntField(description="租户ID")
    event_id = fields.CharField(max_length=100, description="幂等业务键")
    agent_id = fields.IntField(null=True, description="边缘节点 ID")
    occurred_at = fields.DatetimeField(description="检测业务时刻")
    judgment = fields.CharField(max_length=20, description="OK|NG|UNKNOWN")
    confidence = fields.DecimalField(max_digits=8, decimal_places=4, null=True, description="置信度 0-1")
    recipe_code = fields.CharField(max_length=50, null=True, description="方案编码")
    recipe_version = fields.CharField(max_length=30, null=True, description="方案版本")
    station_code = fields.CharField(max_length=50, null=True, description="工位编码")
    camera_code = fields.CharField(max_length=50, null=True, description="相机编码")
    work_order_code = fields.CharField(max_length=50, null=True, description="工单号")
    operation_code = fields.CharField(max_length=50, null=True, description="工序编码")
    batch_no = fields.CharField(max_length=100, null=True, description="批次号")
    duration_ms = fields.IntField(null=True, description="推理耗时毫秒")
    step_results = fields.JSONField(null=True, description="步骤明细 JSON")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_inspection_events"
        table_description = "快视觉 - 检测事件"
        unique_together = (("tenant_id", "event_id"),)
        indexes = [
            ("tenant_id", "occurred_at"),
            ("tenant_id", "judgment"),
            ("tenant_id", "station_code"),
            ("tenant_id", "recipe_code"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionMeasurement(BaseModel):
    """检测测量值。"""

    tenant_id = fields.IntField(description="租户ID")
    event_id = fields.IntField(description="检测事件主键 ID")
    name = fields.CharField(max_length=80, description="测量名")
    value = fields.DecimalField(max_digits=18, decimal_places=6, null=True, description="数值")
    unit = fields.CharField(max_length=20, null=True, description="单位")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_measurements"
        table_description = "快视觉 - 测量值"
        indexes = [
            ("tenant_id", "event_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionInspectionImage(BaseModel):
    """检测原图对象存储引用。"""

    tenant_id = fields.IntField(description="租户ID")
    event_id = fields.IntField(description="检测事件主键 ID")
    object_key = fields.CharField(max_length=500, description="对象存储键")
    label = fields.CharField(max_length=80, null=True, description="角度/ROI 标签")
    sort_order = fields.IntField(default=0, description="排序")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_inspection_images"
        table_description = "快视觉 - 检测原图"
        indexes = [
            ("tenant_id", "event_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionCamera(BaseModel):
    """相机台账。"""

    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="相机编码")
    name = fields.CharField(max_length=100, description="相机名称")
    sdk_type = fields.CharField(max_length=40, description="SDK 类型")
    serial_no = fields.CharField(max_length=100, null=True, description="序列号")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_cameras"
        table_description = "快视觉 - 相机"
        unique_together = (("tenant_id", "code"),)
        indexes = [("tenant_id", "is_enabled")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionStationBind(BaseModel):
    """相机与工位绑定。"""

    tenant_id = fields.IntField(description="租户ID")
    camera_id = fields.IntField(description="相机主键")
    station_code = fields.CharField(max_length=50, description="工位编码")
    plant_code = fields.CharField(max_length=50, null=True, description="厂区编码")
    workshop_code = fields.CharField(max_length=50, null=True, description="车间编码")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_station_binds"
        table_description = "快视觉 - 相机工位绑定"
        indexes = [
            ("tenant_id", "camera_id"),
            ("tenant_id", "station_code"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionRecipe(BaseModel):
    """视觉方案头。"""

    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="方案编码")
    name = fields.CharField(max_length=100, description="方案名称")
    recipe_type = fields.CharField(max_length=40, description="thickness_measure|step_compliance")
    review_threshold = fields.DecimalField(
        max_digits=8, decimal_places=4, null=True, description="低于此置信度进复核"
    )
    default_camera_code = fields.CharField(max_length=50, null=True, description="默认相机编码")
    trigger_mode = fields.CharField(
        max_length=20, default="manual", description="manual|interval|gpio"
    )
    trigger_interval_seconds = fields.IntField(null=True, description="间隔触发秒数")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_recipes"
        table_description = "快视觉 - 视觉方案"
        unique_together = (("tenant_id", "code"),)
        indexes = [("tenant_id", "recipe_type"), ("tenant_id", "is_enabled")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionRecipeVersion(BaseModel):
    """方案版本。"""

    tenant_id = fields.IntField(description="租户ID")
    recipe_id = fields.IntField(description="方案主键")
    version = fields.CharField(max_length=30, description="版本号")
    status = fields.CharField(max_length=20, description="draft|published|obsolete")
    params = fields.JSONField(null=True, description="类型参数 JSON")
    model_artifact_id = fields.IntField(null=True, description="绑定模型制品 ID")
    require_model = fields.BooleanField(default=False, description="发布时是否必须绑定模型")
    published_at = fields.DatetimeField(null=True, description="发布时间")
    published_by = fields.IntField(null=True, description="发布人")
    published_by_name = fields.CharField(max_length=100, null=True, description="发布人姓名")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_recipe_versions"
        table_description = "快视觉 - 方案版本"
        unique_together = (("tenant_id", "recipe_id", "version"),)
        indexes = [("tenant_id", "recipe_id", "status")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionModelArtifact(BaseModel):
    """模型制品（ONNX 等）。"""

    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="模型编码")
    name = fields.CharField(max_length=100, description="模型名称")
    framework = fields.CharField(max_length=30, default="onnx", description="框架")
    object_key = fields.CharField(max_length=500, description="对象存储键或文件 UUID")
    checksum = fields.CharField(max_length=128, description="文件校验和")
    input_width = fields.IntField(null=True, description="输入宽")
    input_height = fields.IntField(null=True, description="输入高")
    label_map = fields.JSONField(null=True, description="标签映射")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_model_artifacts"
        table_description = "快视觉 - 模型制品"
        unique_together = (("tenant_id", "code"),)
        indexes = [("tenant_id", "is_enabled"), ("tenant_id", "checksum")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionSampleSet(BaseModel):
    """样本集（按方案收集）。"""

    tenant_id = fields.IntField(description="租户ID")
    code = fields.CharField(max_length=50, description="样本集编码")
    name = fields.CharField(max_length=100, description="样本集名称")
    recipe_code = fields.CharField(max_length=50, null=True, description="关联方案编码")
    is_enabled = fields.BooleanField(default=True, description="是否启用")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_sample_sets"
        table_description = "快视觉 - 样本集"
        unique_together = (("tenant_id", "code"),)
        indexes = [("tenant_id", "recipe_code"), ("tenant_id", "is_enabled")]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionSampleItem(BaseModel):
    """样本条目。"""

    tenant_id = fields.IntField(description="租户ID")
    sample_set_id = fields.IntField(description="样本集主键")
    label = fields.CharField(max_length=30, description="OK|NG|boundary|其它")
    object_key = fields.CharField(max_length=500, description="图片对象键")
    source_event_id = fields.IntField(null=True, description="来源检测事件主键")
    source_event_uuid = fields.CharField(max_length=36, null=True, description="来源事件 UUID")
    remark = fields.TextField(null=True, description="备注")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_sample_items"
        table_description = "快视觉 - 样本条目"
        indexes = [
            ("tenant_id", "sample_set_id"),
            ("tenant_id", "label"),
            ("tenant_id", "source_event_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionReviewTask(BaseModel):
    """人工复核任务。"""

    tenant_id = fields.IntField(description="租户ID")
    event_id = fields.IntField(description="检测事件主键")
    status = fields.CharField(max_length=20, description="pending|done")
    original_judgment = fields.CharField(max_length=20, description="原判定")
    reviewed_judgment = fields.CharField(max_length=20, null=True, description="复核后判定")
    reason = fields.TextField(null=True, description="复核原因")
    reviewed_at = fields.DatetimeField(null=True, description="复核时刻")
    reviewed_by = fields.IntField(null=True, description="复核人")
    reviewed_by_name = fields.CharField(max_length=100, null=True, description="复核人姓名")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_review_tasks"
        table_description = "快视觉 - 复核任务"
        indexes = [
            ("tenant_id", "status"),
            ("tenant_id", "event_id"),
        ]

    class PydanticMeta:
        exclude = ["deleted_at"]


class VisionSettings(BaseModel):
    """租户级视觉配置（一行一租户）。"""

    tenant_id = fields.IntField(description="租户ID")
    require_published_recipe = fields.BooleanField(
        default=False, description="入站是否要求已发布方案版本"
    )
    offline_timeout_seconds = fields.IntField(default=60, description="心跳离线判定秒数")
    image_retention_days = fields.IntField(default=90, description="原图保留天数")
    event_retention_days = fields.IntField(default=180, description="事件保留天数")
    buffer_alert_threshold = fields.IntField(default=50, description="本地缓冲告警条数")
    disk_alert_mb = fields.IntField(default=1024, description="磁盘剩余低于该 MB 告警")
    deleted_at = fields.DatetimeField(null=True)

    class Meta:
        table = "apps_kuaivision_settings"
        table_description = "快视觉 - 租户配置"
        unique_together = (("tenant_id",),)

    class PydanticMeta:
        exclude = ["deleted_at"]
