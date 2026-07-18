"""
工位终端 LOGO 授权 KEY 激活账本（只记账，不持有签发密钥）。

真伪校验与签发仅在闭源工位客户端 / KEY 生成工具完成。
本服务只按 key_digest + device_id 记录占用名额。
"""

from __future__ import annotations

import re
from typing import Any, Dict

from core.utils.timezone_utils import now_utc
from infra.infrastructure.database.database import get_db_connection

DIGEST_RE = re.compile(r"^[0-9a-f]{64}$")


class StationLogoLicenseService:
    LICENSE_TABLE = "infra_station_logo_licenses"
    ACTIVATION_TABLE = "infra_station_logo_activations"

    @classmethod
    async def _ensure_tables(cls) -> None:
        conn = await get_db_connection()
        try:
            await conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {cls.LICENSE_TABLE} (
                    id SERIAL PRIMARY KEY,
                    key_digest VARCHAR(64) NOT NULL UNIQUE,
                    key_last4 VARCHAR(8) NOT NULL,
                    max_activations INTEGER NOT NULL DEFAULT 1,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
                );
                """
            )
            await conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {cls.ACTIVATION_TABLE} (
                    id SERIAL PRIMARY KEY,
                    license_id INTEGER NOT NULL REFERENCES {cls.LICENSE_TABLE}(id) ON DELETE CASCADE,
                    device_id VARCHAR(64) NOT NULL,
                    activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    UNIQUE(license_id, device_id)
                );
                """
            )
            await conn.execute(
                f"""
                CREATE INDEX IF NOT EXISTS idx_{cls.ACTIVATION_TABLE}_license_id
                ON {cls.ACTIVATION_TABLE}(license_id);
                """
            )
        finally:
            await conn.close()

    @classmethod
    async def activate(
        cls,
        *,
        key_digest: str,
        device_id: str,
        max_activations: int,
        key_last4: str = "",
    ) -> Dict[str, Any]:
        """
        记账激活：
        - 首次见到 digest：写入 max_activations（此后不再接受客户端改大）
        - 同 device 重复：幂等成功
        - 新 device 超出台数：拒绝
        """
        digest = (key_digest or "").strip().lower()
        if not DIGEST_RE.match(digest):
            return {
                "ok": False,
                "reason": "bad_digest",
                "message": "KEY 摘要无效",
            }

        device = (device_id or "").strip()
        if not device or len(device) > 64:
            return {
                "ok": False,
                "reason": "bad_device",
                "message": "设备标识无效",
            }

        try:
            max_uses = int(max_activations)
        except (TypeError, ValueError):
            max_uses = 0
        if max_uses < 1 or max_uses > 255:
            return {
                "ok": False,
                "reason": "bad_quota",
                "message": "可用台数无效",
            }

        last4 = re.sub(r"[^0-9A-Za-z]", "", (key_last4 or ""))[-4:].upper() or "----"
        ts = now_utc()

        await cls._ensure_tables()
        conn = await get_db_connection()
        try:
            async with conn.transaction():
                row = await conn.fetchrow(
                    f"""
                    SELECT id, max_activations, is_active
                    FROM {cls.LICENSE_TABLE}
                    WHERE key_digest = $1
                    FOR UPDATE
                    """,
                    digest,
                )
                if not row:
                    row = await conn.fetchrow(
                        f"""
                        INSERT INTO {cls.LICENSE_TABLE}
                          (key_digest, key_last4, max_activations, is_active, created_at, updated_at)
                        VALUES ($1, $2, $3, TRUE, $4, $4)
                        RETURNING id, max_activations, is_active
                        """,
                        digest,
                        last4,
                        max_uses,
                        ts,
                    )

                if not row or not row["is_active"]:
                    return {
                        "ok": False,
                        "reason": "revoked",
                        "message": "KEY 已停用",
                        "max_activations": max_uses,
                        "current_activations": 0,
                    }

                license_id = int(row["id"])
                # 首次入库后的台数为账本真源，忽略后续客户端改大
                stored_max = int(row["max_activations"])

                existing = await conn.fetchval(
                    f"""
                    SELECT id FROM {cls.ACTIVATION_TABLE}
                    WHERE license_id = $1 AND device_id = $2
                    LIMIT 1
                    """,
                    license_id,
                    device,
                )
                if existing:
                    await conn.execute(
                        f"""
                        UPDATE {cls.ACTIVATION_TABLE}
                        SET last_seen_at = $2
                        WHERE id = $1
                        """,
                        existing,
                        ts,
                    )
                    current = await conn.fetchval(
                        f"SELECT COUNT(*)::int FROM {cls.ACTIVATION_TABLE} WHERE license_id = $1",
                        license_id,
                    )
                    return {
                        "ok": True,
                        "reason": "already_activated",
                        "message": "本机已授权",
                        "max_activations": stored_max,
                        "current_activations": int(current or 0),
                    }

                current = await conn.fetchval(
                    f"SELECT COUNT(*)::int FROM {cls.ACTIVATION_TABLE} WHERE license_id = $1",
                    license_id,
                )
                current_n = int(current or 0)
                if current_n >= stored_max:
                    return {
                        "ok": False,
                        "reason": "quota_exceeded",
                        "message": f"KEY 已达使用上限（{stored_max} 台）",
                        "max_activations": stored_max,
                        "current_activations": current_n,
                    }

                await conn.execute(
                    f"""
                    INSERT INTO {cls.ACTIVATION_TABLE}
                      (license_id, device_id, activated_at, last_seen_at)
                    VALUES ($1, $2, $3, $3)
                    """,
                    license_id,
                    device,
                    ts,
                )
                return {
                    "ok": True,
                    "reason": "activated",
                    "message": "授权成功",
                    "max_activations": stored_max,
                    "current_activations": current_n + 1,
                }
        finally:
            await conn.close()
