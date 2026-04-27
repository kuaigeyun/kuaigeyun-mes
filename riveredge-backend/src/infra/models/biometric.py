"""
生物识别凭据模型模块

定义用于 WebAuthn 身份验证的凭据模型。
"""

from tortoise import fields
from infra.models.base import BaseModel


class WebAuthnCredential(BaseModel):
    """
    WebAuthn 凭据模型
    
    存储用户的公共密钥凭据，用于生物识别（指纹、人脸）登录。
    """
    user = fields.ForeignKeyField(
        "models.User", 
        related_name="webauthn_credentials",
        on_delete=fields.CASCADE,
        description="关联用户"
    )
    credential_id = fields.BinaryField(description="凭据 ID (Credential ID)")
    public_key = fields.BinaryField(description="公共密钥 (Public Key)")
    sign_count = fields.IntField(default=0, description="签名计数器 (Signature Count)")
    transports = fields.JSONField(null=True, description="支持的传输方式 (Transports)")
    device_name = fields.CharField(max_length=255, null=True, description="设备名称")
    
    class Meta:
        table = "core_webauthn_credentials"
        app = "models"
        indexes = [
            ("user_id",),
            ("credential_id",),
        ]

    def __str__(self) -> str:
        return f"<WebAuthnCredential(id={self.id}, user_id={self.user_id}, device={self.device_name})>"
