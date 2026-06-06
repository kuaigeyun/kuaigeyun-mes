"""
平台许可证中心服务。

提供平台级 License Key 的创建、查询、撤销、校验能力。
"""

from __future__ import annotations

import hashlib
import os
import secrets
from base64 import urlsafe_b64encode
from typing import Any, Dict, List, Optional
from uuid import uuid4

from core.utils.timezone_utils import now_utc
from infra.infrastructure.database.database import get_db_connection
from infra.schemas.license_center import PlatformLicenseCreateRequest


class LicenseCenterService:
    TABLE_NAME = "infra_license_keys"
    ACTIVATION_TABLE_NAME = "infra_license_key_activations"

    @staticmethod
    def _get_fernet():
        from cryptography.fernet import Fernet

        secret = os.getenv("RIVEREDGE_LICENSE_KEY_ENCRYPTION_SECRET", "riveredge-license-key-encryption-secret")
        key = urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
        return Fernet(key)

    @staticmethod
    def _digest_license_key(license_key: str) -> str:
        salt = os.getenv("RIVEREDGE_LICENSE_KEY_SALT", "riveredge-license-key-salt")
        payload = f"{salt}:{license_key.strip()}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def _encrypt_license_key(cls, license_key: str) -> str:
        token = cls._get_fernet().encrypt(license_key.strip().encode("utf-8"))
        return token.decode("utf-8")

    @classmethod
    def _decrypt_license_key(cls, encrypted_value: str) -> str:
        raw = cls._get_fernet().decrypt(encrypted_value.encode("utf-8"))
        return raw.decode("utf-8")

    @staticmethod
    def generate_license_key(app_code: Optional[str] = None) -> str:
        """
        生成可读性较好的 License Key。
        示例：RVR-KUAIAI-AB12CD34-EF56GH78
        """
        normalized_app_code = (app_code or "GLOBAL").strip().upper().replace("-", "")
        app_segment = (normalized_app_code[:8] or "GLOBAL")
        seg1 = secrets.token_hex(4).upper()
        seg2 = secrets.token_hex(4).upper()
        return f"RVR-{app_segment}-{seg1}-{seg2}"

    @classmethod
    async def _ensure_table(cls) -> None:
        conn = await get_db_connection()
        try:
            await conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {cls.TABLE_NAME} (
                    id SERIAL PRIMARY KEY,
                    uuid VARCHAR(50) NOT NULL UNIQUE,
                    app_code VARCHAR(64) NOT NULL DEFAULT '*',
                    alias VARCHAR(120),
                    key_digest VARCHAR(64) NOT NULL,
                    key_last4 VARCHAR(8) NOT NULL,
                    key_ciphertext TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    remark TEXT,
                    created_by INTEGER,
                    max_activations INTEGER NOT NULL DEFAULT 1,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    revoked_at TIMESTAMP WITH TIME ZONE
                );
                """
            )
            await conn.execute(
                f"ALTER TABLE {cls.TABLE_NAME} ADD COLUMN IF NOT EXISTS key_ciphertext TEXT;"
            )
            await conn.execute(
                f"ALTER TABLE {cls.TABLE_NAME} ADD COLUMN IF NOT EXISTS max_activations INTEGER NOT NULL DEFAULT 1;"
            )
            await conn.execute(
                f"""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_{cls.TABLE_NAME}_app_digest
                ON {cls.TABLE_NAME}(app_code, key_digest);
                """
            )
            await conn.execute(
                f"""
                CREATE INDEX IF NOT EXISTS idx_{cls.TABLE_NAME}_app_active
                ON {cls.TABLE_NAME}(app_code, is_active);
                """
            )
            await conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {cls.ACTIVATION_TABLE_NAME} (
                    id SERIAL PRIMARY KEY,
                    license_uuid VARCHAR(50) NOT NULL,
                    tenant_id INTEGER NOT NULL,
                    app_code VARCHAR(64) NOT NULL,
                    activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    UNIQUE(license_uuid, tenant_id)
                );
                """
            )
            await conn.execute(
                f"""
                CREATE INDEX IF NOT EXISTS idx_{cls.ACTIVATION_TABLE_NAME}_license_uuid
                ON {cls.ACTIVATION_TABLE_NAME}(license_uuid);
                """
            )
        finally:
            await conn.close()

    @classmethod
    async def create_license(
        cls,
        data: PlatformLicenseCreateRequest,
        created_by: Optional[int] = None,
    ) -> Dict[str, Any]:
        await cls._ensure_table()
        digest = cls._digest_license_key(data.license_key)
        encrypted = cls._encrypt_license_key(data.license_key)
        conn = await get_db_connection()
        try:
            row = await conn.fetchrow(
                f"""
                INSERT INTO {cls.TABLE_NAME}
                  (uuid, app_code, alias, key_digest, key_last4, key_ciphertext, is_active, remark, created_by, max_activations, created_at, updated_at)
                VALUES
                  ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10, $10)
                ON CONFLICT (app_code, key_digest) DO UPDATE SET
                  alias = EXCLUDED.alias,
                  remark = EXCLUDED.remark,
                  key_ciphertext = EXCLUDED.key_ciphertext,
                  is_active = TRUE,
                  max_activations = EXCLUDED.max_activations,
                  revoked_at = NULL,
                  updated_at = EXCLUDED.updated_at
                RETURNING uuid, app_code, alias, key_last4, is_active, remark, created_by, max_activations, created_at, updated_at, revoked_at;
                """,
                str(uuid4()),
                (data.app_code or "*").strip() or "*",
                (data.alias or None),
                digest,
                data.license_key.strip()[-4:],
                encrypted,
                (data.remark or None),
                created_by,
                data.max_activations,
                now_utc(),
            )
            result = dict(row)
            result["current_activations"] = 0
            return result
        finally:
            await conn.close()

    @classmethod
    async def list_licenses(
        cls,
        app_code: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        await cls._ensure_table()
        conditions = ["1=1"]
        params: List[Any] = []
        idx = 1
        if app_code:
            conditions.append(f"app_code = ${idx}")
            params.append(app_code)
            idx += 1
        if is_active is not None:
            conditions.append(f"is_active = ${idx}")
            params.append(is_active)
            idx += 1

        conn = await get_db_connection()
        try:
            rows = await conn.fetch(
                f"""
                SELECT
                  lk.uuid,
                  lk.app_code,
                  lk.alias,
                  lk.key_last4,
                  lk.is_active,
                  lk.remark,
                  lk.created_by,
                  lk.max_activations,
                  lk.created_at,
                  lk.updated_at,
                  lk.revoked_at,
                  COALESCE(act.current_activations, 0) AS current_activations
                FROM {cls.TABLE_NAME} lk
                LEFT JOIN (
                  SELECT license_uuid, COUNT(*)::int AS current_activations
                  FROM {cls.ACTIVATION_TABLE_NAME}
                  GROUP BY license_uuid
                ) act ON act.license_uuid = lk.uuid
                WHERE {' AND '.join(conditions)}
                ORDER BY lk.is_active DESC, lk.updated_at DESC, lk.id DESC
                """,
                *params,
            )
            return [dict(item) for item in rows]
        finally:
            await conn.close()

    @classmethod
    async def revoke_license(cls, uuid: str) -> Optional[Dict[str, Any]]:
        await cls._ensure_table()
        conn = await get_db_connection()
        try:
            row = await conn.fetchrow(
                f"""
                UPDATE {cls.TABLE_NAME}
                SET is_active = FALSE, revoked_at = $2, updated_at = $2
                WHERE uuid = $1
                RETURNING uuid, app_code, alias, key_last4, is_active, remark, created_by, max_activations, created_at, updated_at, revoked_at;
                """,
                uuid,
                now_utc(),
            )
            if not row:
                return None
            result = dict(row)
            result["current_activations"] = await conn.fetchval(
                f"SELECT COUNT(*)::int FROM {cls.ACTIVATION_TABLE_NAME} WHERE license_uuid = $1",
                uuid,
            ) or 0
            return result
        finally:
            await conn.close()

    @classmethod
    async def verify_license_key(cls, app_code: str, license_key: str) -> bool:
        await cls._ensure_table()
        digest = cls._digest_license_key(license_key)
        conn = await get_db_connection()
        try:
            matched = await conn.fetchval(
                f"""
                SELECT 1
                FROM {cls.TABLE_NAME}
                WHERE is_active = TRUE
                  AND key_digest = $1
                  AND app_code IN ($2, '*')
                LIMIT 1
                """,
                digest,
                app_code,
            )
            return bool(matched)
        finally:
            await conn.close()

    @classmethod
    async def get_plain_license_key(cls, uuid: str) -> Optional[str]:
        await cls._ensure_table()
        conn = await get_db_connection()
        try:
            row = await conn.fetchrow(
                f"SELECT key_ciphertext FROM {cls.TABLE_NAME} WHERE uuid = $1 LIMIT 1",
                uuid,
            )
            if not row:
                return None
            ciphertext = row.get("key_ciphertext")
            if not ciphertext:
                return None
            return cls._decrypt_license_key(ciphertext)
        finally:
            await conn.close()

    @classmethod
    async def consume_license_key(cls, app_code: str, license_key: str, tenant_id: int) -> bool:
        """
        消费许可证（防多人滥用）：
        - 同租户重复激活视为幂等成功；
        - 超过 max_activations 时拒绝。
        """
        await cls._ensure_table()
        digest = cls._digest_license_key(license_key)
        conn = await get_db_connection()
        try:
            row = await conn.fetchrow(
                f"""
                SELECT uuid, app_code, max_activations
                FROM {cls.TABLE_NAME}
                WHERE is_active = TRUE
                  AND key_digest = $1
                  AND app_code IN ($2, '*')
                ORDER BY CASE WHEN app_code = $2 THEN 0 ELSE 1 END
                LIMIT 1
                """,
                digest,
                app_code,
            )
            if not row:
                return False

            license_uuid = row["uuid"]
            exists = await conn.fetchval(
                f"""
                SELECT 1 FROM {cls.ACTIVATION_TABLE_NAME}
                WHERE license_uuid = $1 AND tenant_id = $2
                LIMIT 1
                """,
                license_uuid,
                tenant_id,
            )
            if exists:
                return True

            current_count = await conn.fetchval(
                f"SELECT COUNT(*)::int FROM {cls.ACTIVATION_TABLE_NAME} WHERE license_uuid = $1",
                license_uuid,
            ) or 0
            if current_count >= int(row["max_activations"] or 1):
                return False

            await conn.execute(
                f"""
                INSERT INTO {cls.ACTIVATION_TABLE_NAME}(license_uuid, tenant_id, app_code, activated_at)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (license_uuid, tenant_id) DO NOTHING
                """,
                license_uuid,
                tenant_id,
                app_code,
                now_utc(),
            )
            return True
        finally:
            await conn.close()

    @classmethod
    async def rotate_license_key(cls, uuid: str) -> Optional[Dict[str, Any]]:
        """
        重置许可证密钥（生成新 Key 并覆盖摘要/密文）。
        返回包含新明文 key 的结果，仅用于平台管理员一次性复制。
        """
        await cls._ensure_table()
        conn = await get_db_connection()
        try:
            target = await conn.fetchrow(
                f"SELECT uuid, app_code, alias, remark, created_by, max_activations, is_active FROM {cls.TABLE_NAME} WHERE uuid = $1 LIMIT 1",
                uuid,
            )
            if not target:
                return None

            app_code = target["app_code"] or "*"
            new_key = cls.generate_license_key(app_code=app_code)
            digest = cls._digest_license_key(new_key)
            encrypted = cls._encrypt_license_key(new_key)
            now = now_utc()

            row = await conn.fetchrow(
                f"""
                UPDATE {cls.TABLE_NAME}
                SET key_digest = $2,
                    key_last4 = $3,
                    key_ciphertext = $4,
                    updated_at = $5
                WHERE uuid = $1
                RETURNING uuid, app_code, alias, key_last4, is_active, remark, created_by, max_activations, created_at, updated_at, revoked_at;
                """,
                uuid,
                digest,
                new_key[-4:],
                encrypted,
                now,
            )
            if not row:
                return None
            result = dict(row)
            result["current_activations"] = await conn.fetchval(
                f"SELECT COUNT(*)::int FROM {cls.ACTIVATION_TABLE_NAME} WHERE license_uuid = $1",
                uuid,
            ) or 0
            result["license_key"] = new_key
            return result
        finally:
            await conn.close()

