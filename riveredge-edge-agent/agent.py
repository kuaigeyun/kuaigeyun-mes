#!/usr/bin/env python3
"""快数采 Edge Agent 参考实现：Modbus TCP 轮询 + 断网缓冲 + 心跳热更新。"""

from __future__ import annotations

import json
import sqlite3
import struct
import sys
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import yaml
from pymodbus.client import ModbusTcpClient

AGENT_VERSION = "1.0.0"
BATCH_MAX_ITEMS = 100


@dataclass
class LocalConfig:
    base_url: str
    device_token: str
    edge_config_code: str
    poll_interval_seconds: int = 5
    heartbeat_interval_seconds: int = 30
    buffer_db_path: str = "buffer.db"
    agent_version: str = AGENT_VERSION


class BufferStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._init_db()

    def _init_db(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS pending_ingest (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    payload_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )

    def enqueue(self, idempotency_key: str, payload: dict[str, Any]) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR IGNORE INTO pending_ingest (idempotency_key, payload_json, created_at) VALUES (?, ?, ?)",
                (idempotency_key, json.dumps(payload, ensure_ascii=False), _utc_now_iso()),
            )

    def pending_count(self) -> int:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT COUNT(*) FROM pending_ingest").fetchone()
            return int(row[0] if row else 0)

    def fetch_batch(self, limit: int = BATCH_MAX_ITEMS) -> list[tuple[int, str, dict[str, Any]]]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT id, idempotency_key, payload_json FROM pending_ingest ORDER BY id ASC LIMIT ?",
                (limit,),
            ).fetchall()
        return [(int(row[0]), str(row[1]), json.loads(str(row[2]))) for row in rows]

    def delete_ids(self, ids: list[int]) -> None:
        if not ids:
            return
        placeholders = ",".join("?" for _ in ids)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(f"DELETE FROM pending_ingest WHERE id IN ({placeholders})", ids)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _load_local_config(path: str) -> LocalConfig:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    base_url = str(data.get("base_url") or "").strip().rstrip("/")
    device_token = str(data.get("device_token") or "").strip()
    edge_config_code = str(data.get("edge_config_code") or "").strip()
    if not base_url or not device_token or not edge_config_code:
        raise ValueError("config.yaml 必须配置 base_url、device_token、edge_config_code")
    return LocalConfig(
        base_url=base_url,
        device_token=device_token,
        edge_config_code=edge_config_code,
        poll_interval_seconds=int(data.get("poll_interval_seconds") or 5),
        heartbeat_interval_seconds=int(data.get("heartbeat_interval_seconds") or 30),
        buffer_db_path=str(data.get("buffer_db_path") or "buffer.db"),
        agent_version=str(data.get("agent_version") or AGENT_VERSION),
    )


class CloudClient:
    def __init__(self, local: LocalConfig) -> None:
        self.local = local
        self.runtime_spec: dict[str, Any] | None = None
        self.config_version: int | None = None

    def _url(self, path: str) -> str:
        if path.startswith("http"):
            return path
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{self.local.base_url}{path}"

    def pull_runtime_config(self) -> dict[str, Any]:
        path = f"/api/v1/apps/kuaiiot/edge-runtime/{self.local.device_token}/config/{self.local.edge_config_code}"
        with httpx.Client(timeout=20.0) as client:
            response = client.get(self._url(path))
            response.raise_for_status()
            spec = response.json()
        self.runtime_spec = spec
        self.config_version = int(spec.get("config_version") or 1)
        return spec

    def heartbeat(self, buffer_pending_count: int) -> dict[str, Any]:
        if not self.runtime_spec:
            raise RuntimeError("runtime spec 未加载")
        path = str(self.runtime_spec.get("heartbeat_path") or "")
        payload = {
            "edge_config_code": self.local.edge_config_code,
            "config_version": self.config_version,
            "agent_version": self.local.agent_version,
            "buffer_pending_count": buffer_pending_count,
            "status": "online",
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(self._url(path), json=payload)
            response.raise_for_status()
            return response.json()

    def submit_command_result(
        self,
        command_uuid: str,
        *,
        success: bool,
        result: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> dict[str, Any]:
        if not self.runtime_spec:
            raise RuntimeError("runtime spec 未加载")
        path = str(self.runtime_spec.get("command_result_path") or "")
        payload = {
            "command_uuid": command_uuid,
            "success": success,
            "result": result,
            "error_message": error_message,
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(self._url(path), json=payload)
            response.raise_for_status()
            return response.json()

    def ingest(self, tags: dict[str, Any], timestamp: str, idempotency_key: str | None = None) -> dict[str, Any]:
        if not self.runtime_spec:
            raise RuntimeError("runtime spec 未加载")
        path = str(self.runtime_spec.get("ingest_path") or "")
        payload: dict[str, Any] = {"tags": tags, "timestamp": timestamp}
        if idempotency_key:
            payload["idempotency_key"] = idempotency_key
        with httpx.Client(timeout=20.0) as client:
            response = client.post(self._url(path), json=payload)
            response.raise_for_status()
            return response.json()

    def ingest_batch(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.runtime_spec:
            raise RuntimeError("runtime spec 未加载")
        path = str(self.runtime_spec.get("batch_ingest_path") or "")
        with httpx.Client(timeout=30.0) as client:
            response = client.post(self._url(path), json={"items": items})
            response.raise_for_status()
            return response.json()


def _decode_register(raw: Any, data_type: str, scale: float = 1.0) -> Any:
    if raw is None:
        return None
    dtype = data_type.lower()
    if dtype == "bool":
        return bool(int(raw))
    if dtype == "int16":
        value = struct.unpack(">h", struct.pack(">H", int(raw) & 0xFFFF))[0]
        return value * scale
    if dtype == "uint16":
        return int(raw) * scale
    if dtype == "int32":
        hi = int(raw[0]) if isinstance(raw, (list, tuple)) else int(raw) >> 16
        lo = int(raw[1]) if isinstance(raw, (list, tuple)) else int(raw) & 0xFFFF
        packed = struct.pack(">HH", hi & 0xFFFF, lo & 0xFFFF)
        value = struct.unpack(">i", packed)[0]
        return value * scale
    if dtype == "uint32":
        hi = int(raw[0]) if isinstance(raw, (list, tuple)) else int(raw) >> 16
        lo = int(raw[1]) if isinstance(raw, (list, tuple)) else int(raw) & 0xFFFF
        packed = struct.pack(">HH", hi & 0xFFFF, lo & 0xFFFF)
        value = struct.unpack(">I", packed)[0]
        return value * scale
    if dtype == "float32":
        if isinstance(raw, (list, tuple)):
            packed = struct.pack(">HH", int(raw[0]) & 0xFFFF, int(raw[1]) & 0xFFFF)
        else:
            packed = struct.pack(">I", int(raw) & 0xFFFFFFFF)
        value = struct.unpack(">f", packed)[0]
        return round(value * scale, 6)
    raise ValueError(f"unsupported data_type: {data_type}")


def _encode_register(value: Any, data_type: str, scale: float = 1.0) -> int | list[int]:
    dtype = data_type.lower()
    if dtype == "bool":
        return 1 if bool(value) else 0
    if dtype in {"int16", "uint16"}:
        scaled = int(float(value) / scale)
        if dtype == "int16":
            return struct.unpack(">H", struct.pack(">h", scaled))[0]
        return scaled & 0xFFFF
    if dtype in {"int32", "uint32", "float32"}:
        if dtype == "float32":
            packed = struct.pack(">f", float(value) / scale)
            hi, lo = struct.unpack(">HH", packed)
            return [hi, lo]
        scaled = int(float(value) / scale)
        if dtype == "int32":
            packed = struct.pack(">i", scaled)
        else:
            packed = struct.pack(">I", scaled & 0xFFFFFFFF)
        hi, lo = struct.unpack(">HH", packed)
        return [hi, lo]
    raise ValueError(f"unsupported data_type: {data_type}")


class ModbusPoller:
    def __init__(self, protocol: str, config: dict[str, Any]) -> None:
        self.protocol = protocol
        self.config = config
        self.client: ModbusTcpClient | None = None

    def connect(self) -> None:
        if self.protocol != "modbus_tcp":
            raise RuntimeError(f"当前 Agent 仅实现 modbus_tcp，收到 {self.protocol}")
        host = str(self.config.get("host") or "127.0.0.1")
        port = int(self.config.get("port") or 502)
        self.client = ModbusTcpClient(host=host, port=port)
        if not self.client.connect():
            raise ConnectionError(f"无法连接 Modbus {host}:{port}")

    def close(self) -> None:
        if self.client:
            self.client.close()
            self.client = None

    def poll_tags(self) -> dict[str, Any]:
        if not self.client:
            raise RuntimeError("Modbus 未连接")
        unit_id = int(self.config.get("unit_id") or 1)
        tags: dict[str, Any] = {}
        for item in self.config.get("registers") or []:
            tag_key = str(item.get("tag_key") or "").strip()
            if not tag_key:
                continue
            address = int(item.get("address"))
            data_type = str(item.get("data_type") or "uint16").lower()
            scale = float(item.get("scale") or 1.0)
            count = 2 if data_type in {"int32", "uint32", "float32"} else 1
            result = self.client.read_holding_registers(address=address, count=count, device_id=unit_id)
            if result.isError():
                raise RuntimeError(f"读取寄存器失败 tag={tag_key} address={address}: {result}")
            raw = result.registers if count > 1 else result.registers[0]
            tags[tag_key] = _decode_register(raw, data_type, scale)
        return tags

    def execute_command(self, command: dict[str, Any]) -> dict[str, Any]:
        if not self.client:
            raise RuntimeError("Modbus 未连接")
        edge_action = command.get("edge_action") or {}
        if not isinstance(edge_action, dict):
            raise ValueError("edge_action 无效")
        action_type = str(edge_action.get("type") or "modbus_write")
        if action_type != "modbus_write":
            raise ValueError(f"unsupported edge_action.type: {action_type}")
        params = command.get("params") or {}
        param_key = str(edge_action.get("param_key") or "value")
        raw_value = params.get(param_key)
        if raw_value is None:
            raise ValueError(f"缺少参数: {param_key}")
        address = int(edge_action.get("address"))
        data_type = str(edge_action.get("data_type") or "uint16").lower()
        scale = float(edge_action.get("scale") or 1.0)
        unit_id = int(self.config.get("unit_id") or 1)
        encoded = _encode_register(raw_value, data_type, scale)
        if isinstance(encoded, list):
            result = self.client.write_registers(address=address, values=encoded, device_id=unit_id)
        else:
            result = self.client.write_register(address=address, value=int(encoded), device_id=unit_id)
        if result.isError():
            raise RuntimeError(f"写入寄存器失败 address={address}: {result}")
        return {"address": address, "value": raw_value}


class EdgeAgent:
    def __init__(self, local: LocalConfig) -> None:
        self.local = local
        self.cloud = CloudClient(local)
        self.buffer = BufferStore(local.buffer_db_path)
        self.poller: ModbusPoller | None = None
        self.last_heartbeat_at = 0.0

    def reload_runtime(self) -> None:
        spec = self.cloud.pull_runtime_config()
        protocol = str(spec.get("protocol") or "")
        config = dict(spec.get("config") or {})
        if self.poller:
            self.poller.close()
        self.poller = ModbusPoller(protocol, config)
        self.poller.connect()
        print(f"runtime config loaded protocol={protocol} version={self.cloud.config_version}")

    def flush_buffer(self) -> None:
        while True:
            batch = self.buffer.fetch_batch(BATCH_MAX_ITEMS)
            if not batch:
                return
            items = []
            for _, idempotency_key, payload in batch:
                items.append(
                    {
                        "tags": payload["tags"],
                        "timestamp": payload["timestamp"],
                        "idempotency_key": idempotency_key,
                    }
                )
            try:
                self.cloud.ingest_batch(items)
            except Exception as exc:
                print(f"batch flush failed: {exc}")
                return
            self.buffer.delete_ids([row_id for row_id, _, _ in batch])
            print(f"flushed buffered items={len(batch)}")

    def publish_tags(self, tags: dict[str, Any]) -> None:
        timestamp = _utc_now_iso()
        try:
            self.cloud.ingest(tags, timestamp)
            self.flush_buffer()
        except Exception as exc:
            idempotency_key = f"buf-{uuid.uuid4().hex}"
            self.buffer.enqueue(idempotency_key, {"tags": tags, "timestamp": timestamp})
            print(f"ingest failed, buffered: {exc}")

    def maybe_heartbeat(self) -> None:
        now = time.time()
        if now - self.last_heartbeat_at < self.local.heartbeat_interval_seconds:
            return
        self.last_heartbeat_at = now
        try:
            result = self.cloud.heartbeat(self.buffer.pending_count())
            if result.get("config_changed"):
                print("config changed, reloading runtime spec")
                self.reload_runtime()
            for command in result.get("pending_commands") or []:
                if not isinstance(command, dict):
                    continue
                command_uuid = str(command.get("command_uuid") or "")
                if not command_uuid:
                    continue
                try:
                    if not self.poller:
                        self.reload_runtime()
                    exec_result = self.poller.execute_command(command)
                    self.cloud.submit_command_result(command_uuid, success=True, result=exec_result)
                    print(f"command executed: {command_uuid}")
                except Exception as exc:
                    self.cloud.submit_command_result(command_uuid, success=False, error_message=str(exc))
                    print(f"command failed: {command_uuid} {exc}")
        except Exception as exc:
            print(f"heartbeat failed: {exc}")

    def run(self) -> None:
        self.reload_runtime()
        while True:
            try:
                if not self.poller:
                    self.reload_runtime()
                tags = self.poller.poll_tags()
                if tags:
                    self.publish_tags(tags)
                self.maybe_heartbeat()
            except Exception as exc:
                print(f"poll loop error: {exc}")
            time.sleep(max(self.local.poll_interval_seconds, 1))


def main() -> None:
    config_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    local = _load_local_config(config_path)
    EdgeAgent(local).run()


if __name__ == "__main__":
    main()
