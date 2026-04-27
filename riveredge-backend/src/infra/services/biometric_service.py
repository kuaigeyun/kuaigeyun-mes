"""
生物识别服务模块

实现 WebAuthn 注册和验证逻辑。
"""

import json
from typing import Any, Dict, Optional, List
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    RegistrationSelection,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AuthenticatorAttachment,
)
from webauthn.helpers import bytes_to_base64url, base64url_to_bytes

from infra.models.user import User
from infra.models.biometric import WebAuthnCredential
from infra.exceptions.exceptions import ValidationError, AuthenticationError


class BiometricService:
    def __init__(self, rp_id: str, rp_name: str, origin: str):
        self.rp_id = rp_id
        self.rp_name = rp_name
        self.origin = origin

    async def get_registration_options(self, user: User) -> Dict[str, Any]:
        """
        生成注册选项
        """
        # 获取已有的凭据 ID 列表，避免重复注册同一个设备
        existing_credentials = await WebAuthnCredential.filter(user=user).values_list("credential_id", flat=True)
        exclude_credentials = [
            {"id": bytes_to_base64url(cred_id), "type": "public-key"} for cred_id in existing_credentials
        ]

        options = generate_registration_options(
            rp_id=self.rp_id,
            rp_name=self.rp_name,
            user_id=str(user.id).encode("utf-8"),
            user_name=user.username,
            user_display_name=user.full_name or user.username,
            attestation_conveyance_preference="none",
            authenticator_selection=AuthenticatorSelectionCriteria(
                authenticator_attachment=None,  # 允许平台和跨平台
                user_verification=UserVerificationRequirement.PREFERRED,
            ),
            exclude_credentials=exclude_credentials,
        )
        
        return json.loads(options_to_json(options))

    async def verify_registration(self, user: User, registration_response: Dict[str, Any], challenge: str, device_name: Optional[str] = None) -> WebAuthnCredential:
        """
        验证注册响应并存储凭据
        """
        try:
            verification = verify_registration_response(
                credential=registration_response,
                expected_challenge=base64url_to_bytes(challenge),
                expected_origin=self.origin,
                expected_rp_id=self.rp_id,
                require_user_verification=False, # 可以根据安全策略调整
            )
            
            # 存储凭据
            credential = await WebAuthnCredential.create(
                user=user,
                credential_id=verification.credential_id,
                public_key=verification.public_key,
                sign_count=verification.sign_count,
                transports=registration_response.get("response", {}).get("transports", []),
                device_name=device_name or "Unknown Device"
            )
            return credential
            
        except Exception as e:
            raise ValidationError(f"Biometric registration failed: {str(e)}")

    async def get_authentication_options(self, user: Optional[User] = None) -> Dict[str, Any]:
        """
        生成验证选项
        """
        allow_credentials = []
        if user:
            existing_credentials = await WebAuthnCredential.filter(user=user)
            allow_credentials = [
                {"id": bytes_to_base64url(cred.credential_id), "type": "public-key", "transports": cred.transports} 
                for cred in existing_credentials
            ]

        options = generate_authentication_options(
            rp_id=self.rp_id,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.PREFERRED,
        )
        
        return json.loads(options_to_json(options))

    async def verify_authentication(self, authentication_response: Dict[str, Any], challenge: str) -> WebAuthnCredential:
        """
        验证认证响应
        """
        credential_id_base64 = authentication_response.get("id")
        if not credential_id_base64:
            raise ValidationError("Credential ID is missing in authentication response")
            
        credential_id = base64url_to_bytes(credential_id_base64)
        
        # 查找匹配的凭据
        credential = await WebAuthnCredential.filter(credential_id=credential_id).prefetch_related("user").first()
        if not credential:
            raise AuthenticationError("No matching biometric credential found")
            
        if not credential.user.is_active:
            raise AuthenticationError("User is inactive")
            
        try:
            verification = verify_authentication_response(
                credential=authentication_response,
                expected_challenge=base64url_to_bytes(challenge),
                expected_origin=self.origin,
                expected_rp_id=self.rp_id,
                credential_public_key=credential.public_key,
                credential_current_sign_count=credential.sign_count,
                require_user_verification=False,
            )
            
            # 更新签名计数
            credential.sign_count = verification.new_sign_count
            await credential.save()
            
            return credential
            
        except Exception as e:
            raise AuthenticationError(f"Biometric authentication failed: {str(e)}")
