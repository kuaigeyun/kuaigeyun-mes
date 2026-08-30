"""
官方接口库模型

平台级表，仅在 kuaigeyun.com 官方 SaaS 落库；私有部署经固定地址拉取/提交。
"""

from __future__ import annotations

from tortoise import fields

from infra.models.base import BaseModel


class OfficialApiLibraryPack(BaseModel):
    """官方接口库包（tenant_id 恒为 NULL）。"""

    class Meta:
        table = "infra_official_api_library_packs"
        indexes = [
            ("status",),
            ("connector_type",),
            ("category_name",),
            ("created_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    pack_id = fields.CharField(max_length=80, unique=True, description="接口包唯一键")
    name = fields.CharField(max_length=100, description="接口包名称")
    description = fields.TextField(null=True, description="接口包说明")
    connector_type = fields.CharField(max_length=50, description="所需应用连接器类型")
    category_name = fields.CharField(max_length=50, description="分类名称")
    category_code = fields.CharField(max_length=50, description="分类代码")
    category_description = fields.CharField(max_length=200, null=True, description="分类说明")
    status = fields.CharField(
        max_length=20,
        default="published",
        description="状态：published / rejected",
    )
    items = fields.JSONField(description="接口条目列表（定义快照，不含连接器密钥）")
    submitter_hint = fields.CharField(max_length=200, null=True, description="提交方提示（可选）")
    source_host_hint = fields.CharField(max_length=200, null=True, description="来源主机提示（可选）")
