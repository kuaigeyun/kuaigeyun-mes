"""
实例安装登记模型

平台级表，记录可选遥测登记（构建来源元数据，不含业务数据）。
"""

from tortoise import fields

from infra.models.base import BaseModel


class InstallRegistration(BaseModel):
    """可选实例登记记录（tenant_id 恒为 NULL）。"""

    class Meta:
        table = "infra_install_registrations"
        indexes = [
            ("build_git_remote",),
            ("build_git_remote_is_official",),
            ("last_seen_at",),
        ]

    id = fields.IntField(pk=True, description="主键ID")
    install_instance_id = fields.CharField(
        max_length=36,
        unique=True,
        description="部署实例 UUID（.env INSTALL_INSTANCE_ID）",
    )
    git_commit = fields.CharField(max_length=40, null=True, description="短 commit")
    build_time = fields.CharField(max_length=40, null=True, description="构建时间 ISO UTC")
    provenance_status = fields.CharField(max_length=50, description="构建来源状态")
    app_version = fields.CharField(max_length=50, null=True, description="应用版本")
    build_git_remote = fields.CharField(max_length=500, null=True, description="来源 git remote")
    build_git_branch = fields.CharField(max_length=200, null=True, description="来源 git 分支")
    build_git_remote_is_official = fields.BooleanField(
        default=False,
        description="remote 是否匹配官方仓库",
    )
    host_hint = fields.CharField(max_length=200, null=True, description="可选主机提示")
    first_seen_at = fields.DatetimeField(description="首次登记时间")
    last_seen_at = fields.DatetimeField(description="最近登记时间")
    register_count = fields.IntField(default=1, description="登记次数")
    last_register_ip = fields.CharField(max_length=64, null=True, description="最近登记 IP")
