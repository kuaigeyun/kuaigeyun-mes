"""
保密文件库：租户级二次密码与解锁令牌。

保密 category（如 company-seal）在文件管理浏览/改删时须验证二次密码。
打印等服务端受信路径仍直接读文件，不经此库。
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt

from core.services.system.site_setting_service import SiteSettingService
from infra.domain.security.security import hash_password, verify_password
from infra.config.infra_config import infra_settings as settings
from core.utils.timezone_utils import now_utc

# 侧栏虚拟分组（非 DB category）
FILE_PRIVATE_FILES_GROUP_KEY = "@private-files"

# 文件管理页操作保密文件时须携带 scope + 解锁令牌；单据等业务上传/预览不走此 scope
FILE_MANAGER_VAULT_SCOPE = "file-manager"
VAULT_SCOPE_HEADER = "X-Private-Vault-Scope"

# 归入「保密文件」的 category；扩展时同步前端 fileUploadCategories
PRIVATE_FILE_CATEGORIES = frozenset({"company-seal"})

_SETTINGS_HASH_KEY = "private_files_password_hash"
_VAULT_TOKEN_PURPOSE = "private_file_vault"
_VAULT_TOKEN_EXPIRES_SECONDS = 30 * 60


class PrivateFileVaultService:
    """租户保密文件二次密码与解锁会话。"""

    @staticmethod
    def is_private_category(category: Optional[str]) -> bool:
        raw = (category or "").strip()
        if not raw:
            return False
        if raw == FILE_PRIVATE_FILES_GROUP_KEY:
            return True
        return raw in PRIVATE_FILE_CATEGORIES

    @staticmethod
    async def _get_password_hash(tenant_id: int) -> str:
        merged = await SiteSettingService.get_settings_with_platform_fallback(tenant_id)
        return str(merged.get(_SETTINGS_HASH_KEY) or "").strip()

    @staticmethod
    async def _save_password_hash(tenant_id: int, password_hash: str) -> None:
        from core.schemas.site_setting import SiteSettingUpdate

        await SiteSettingService.update_settings(
            tenant_id,
            SiteSettingUpdate(settings={_SETTINGS_HASH_KEY: password_hash}),
        )

    @staticmethod
    async def get_status(tenant_id: int) -> Dict[str, Any]:
        configured = bool(await PrivateFileVaultService._get_password_hash(tenant_id))
        return {
            "configured": configured,
            "categories": sorted(PRIVATE_FILE_CATEGORIES),
        }

    @staticmethod
    async def set_password(tenant_id: int, password: str) -> None:
        pwd = (password or "").strip()
        if len(pwd) < 4:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="保密文件密码至少 4 位",
            )
        existing = await PrivateFileVaultService._get_password_hash(tenant_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="保密文件密码已设置，请使用修改密码",
            )
        await PrivateFileVaultService._save_password_hash(tenant_id, hash_password(pwd))

    @staticmethod
    async def change_password(
        tenant_id: int,
        old_password: str,
        new_password: str,
    ) -> None:
        existing = await PrivateFileVaultService._get_password_hash(tenant_id)
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="尚未设置保密文件密码",
            )
        if not verify_password((old_password or "").strip(), existing):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="原密码不正确",
            )
        new_pwd = (new_password or "").strip()
        if len(new_pwd) < 4:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="新密码至少 4 位",
            )
        await PrivateFileVaultService._save_password_hash(tenant_id, hash_password(new_pwd))

    @staticmethod
    def issue_unlock_token(tenant_id: int, user_id: int) -> Dict[str, Any]:
        now = now_utc()
        payload = {
            "purpose": _VAULT_TOKEN_PURPOSE,
            "tenant_id": tenant_id,
            "sub": str(user_id),
            "iat": now,
            "exp": now + timedelta(seconds=_VAULT_TOKEN_EXPIRES_SECONDS),
        }
        secret = getattr(settings, "JWT_SECRET_KEY", getattr(settings, "SECRET_KEY", "your-secret-key"))
        token = jwt.encode(payload, secret, algorithm=getattr(settings, "JWT_ALGORITHM", "HS256"))
        return {
            "token": token,
            "expires_in": _VAULT_TOKEN_EXPIRES_SECONDS,
        }

    @staticmethod
    async def unlock(tenant_id: int, user_id: int, password: str) -> Dict[str, Any]:
        stored = await PrivateFileVaultService._get_password_hash(tenant_id)
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="尚未设置保密文件密码，请先在文件管理中设置",
            )
        if not verify_password((password or "").strip(), stored):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="保密文件密码不正确",
            )
        return PrivateFileVaultService.issue_unlock_token(tenant_id, user_id)

    @staticmethod
    def verify_unlock_token(token: Optional[str], tenant_id: int, user_id: int) -> bool:
        raw = (token or "").strip()
        if not raw:
            return False
        secret = getattr(settings, "JWT_SECRET_KEY", getattr(settings, "SECRET_KEY", "your-secret-key"))
        try:
            payload = jwt.decode(
                raw,
                secret,
                algorithms=[getattr(settings, "JWT_ALGORITHM", "HS256")],
            )
        except JWTError:
            return False
        if payload.get("purpose") != _VAULT_TOKEN_PURPOSE:
            return False
        if int(payload.get("tenant_id") or 0) != int(tenant_id):
            return False
        if str(payload.get("sub") or "") != str(user_id):
            return False
        return True

    @staticmethod
    def is_file_manager_vault_scope(scope: Optional[str]) -> bool:
        return (scope or "").strip().lower() == FILE_MANAGER_VAULT_SCOPE

    @staticmethod
    async def assert_file_manager_vault_access(
        tenant_id: int,
        user_id: int,
        vault_token: Optional[str],
        vault_scope: Optional[str],
        *,
        category: Optional[str] = None,
        file_category: Optional[str] = None,
    ) -> None:
        """仅文件管理页对保密 category 的上传/改删须二次密码；单据等业务路径不传 scope。"""
        if not PrivateFileVaultService.is_file_manager_vault_scope(vault_scope):
            return
        await PrivateFileVaultService.assert_vault_access(
            tenant_id,
            user_id,
            vault_token,
            category=category,
            file_category=file_category,
        )

    @staticmethod
    async def assert_private_list_vault_access(
        tenant_id: int,
        user_id: int,
        vault_token: Optional[str],
        *,
        category: Optional[str] = None,
    ) -> None:
        """浏览保密文件目录（列表）须二次密码；仅文件管理使用。"""
        if not PrivateFileVaultService.is_private_category(category):
            return
        await PrivateFileVaultService.assert_vault_access(
            tenant_id,
            user_id,
            vault_token,
            category=category,
        )

    @staticmethod
    async def assert_vault_access(
        tenant_id: int,
        user_id: int,
        vault_token: Optional[str],
        *,
        category: Optional[str] = None,
        file_category: Optional[str] = None,
    ) -> None:
        """保密 category / 文件须携带有效解锁令牌。"""
        needs_vault = PrivateFileVaultService.is_private_category(category) or (
            file_category and PrivateFileVaultService.is_private_category(file_category)
        )
        if not needs_vault:
            return
        if PrivateFileVaultService.verify_unlock_token(vault_token, tenant_id, user_id):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="访问保密文件须先验证二次密码",
        )
