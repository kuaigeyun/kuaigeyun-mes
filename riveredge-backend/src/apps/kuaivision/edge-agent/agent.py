#!/usr/bin/env python3
"""快视觉 Edge Agent：拉配置、心跳、本地 pipeline、断网续传。"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import yaml

from pipeline import run_step_compliance, run_thickness, to_ingest_payload

AGENT_VERSION = "0.2.0"
BATCH_MAX = 100


@dataclass
class LocalConfig:
    base_url: str
    device_token: str
    heartbeat_interval_seconds: int = 15
    config_pull_interval_seconds: int = 20
    pipeline_tick_seconds: int = 2
    buffer_db_path: str = "buffer.db"
    agent_version: str = AGENT_VERSION
    mock_thickness_values: list[float] = field(default_factory=lambda: [1.40, 1.52, 1.70])
    mock_step_missing_last: bool = True
    mock_image_dir: str = "samples"


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
                    event_id TEXT NOT NULL UNIQUE,
                    payload_json TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
                """
            )

    def enqueue(self, event_id: str, payload: dict[str, Any]) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT OR IGNORE INTO pending_ingest (event_id, payload_json, created_at) VALUES (?, ?, ?)",
                (event_id, json.dumps(payload, ensure_ascii=False), time.time()),
            )

    def pending_count(self) -> int:
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT COUNT(*) FROM pending_ingest").fetchone()
            return int(row[0] if row else 0)

    def fetch_batch(self, limit: int = BATCH_MAX) -> list[tuple[int, dict[str, Any]]]:
        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT id, payload_json FROM pending_ingest ORDER BY id ASC LIMIT ?",
                (limit,),
            ).fetchall()
        return [(int(r[0]), json.loads(str(r[1]))) for r in rows]

    def delete_ids(self, ids: list[int]) -> None:
        if not ids:
            return
        placeholders = ",".join("?" for _ in ids)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(f"DELETE FROM pending_ingest WHERE id IN ({placeholders})", ids)


def _load_local_config(path: str) -> LocalConfig:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    base_url = str(data.get("base_url") or "").strip().rstrip("/")
    device_token = str(data.get("device_token") or "").strip()
    if not base_url or not device_token:
        raise ValueError("config.yaml 必须配置 base_url、device_token")
    values = data.get("mock_thickness_values") or [1.40, 1.52, 1.70]
    return LocalConfig(
        base_url=base_url,
        device_token=device_token,
        heartbeat_interval_seconds=int(data.get("heartbeat_interval_seconds") or 15),
        config_pull_interval_seconds=int(data.get("config_pull_interval_seconds") or 20),
        pipeline_tick_seconds=int(data.get("pipeline_tick_seconds") or 2),
        buffer_db_path=str(data.get("buffer_db_path") or "buffer.db"),
        agent_version=str(data.get("agent_version") or AGENT_VERSION),
        mock_thickness_values=[float(v) for v in values],
        mock_step_missing_last=bool(data.get("mock_step_missing_last", True)),
        mock_image_dir=str(data.get("mock_image_dir") or "samples"),
    )


class CloudClient:
    def __init__(self, local: LocalConfig) -> None:
        self.local = local
        self.last_error: str | None = None

    def _url(self, path: str) -> str:
        if not path.startswith("/"):
            path = f"/{path}"
        return f"{self.local.base_url}{path}"

    def pull_config(self) -> dict[str, Any]:
        path = f"/api/v1/apps/kuaivision/edge/{self.local.device_token}/config"
        with httpx.Client(timeout=20.0) as client:
            response = client.get(self._url(path))
            response.raise_for_status()
            return response.json()

    def heartbeat(self, *, buffer_pending_count: int, disk_free_mb: int | None) -> dict[str, Any]:
        path = f"/api/v1/apps/kuaivision/edge/{self.local.device_token}/heartbeat"
        payload = {
            "agent_version": self.local.agent_version,
            "last_error": self.last_error,
            "buffer_pending_count": buffer_pending_count,
            "disk_free_mb": disk_free_mb,
        }
        with httpx.Client(timeout=20.0) as client:
            response = client.post(self._url(path), json=payload)
            response.raise_for_status()
            return response.json()

    def ingest(self, payload: dict[str, Any]) -> dict[str, Any]:
        path = f"/api/v1/apps/kuaivision/ingest/{self.local.device_token}"
        with httpx.Client(timeout=20.0) as client:
            response = client.post(self._url(path), json=payload)
            response.raise_for_status()
            return response.json()

    def ingest_batch(self, items: list[dict[str, Any]]) -> dict[str, Any]:
        path = f"/api/v1/apps/kuaivision/ingest/{self.local.device_token}/batch"
        with httpx.Client(timeout=30.0) as client:
            response = client.post(self._url(path), json={"items": items})
            response.raise_for_status()
            return response.json()


def _disk_free_mb(path: str) -> int | None:
    try:
        usage = shutil.disk_usage(Path(path).resolve().parent if Path(path).parent.name else ".")
        return int(usage.free / (1024 * 1024))
    except Exception:
        return None


def _station_for_camera(cloud_cfg: dict[str, Any], camera_code: str | None) -> str | None:
    if not camera_code:
        return None
    for cam in cloud_cfg.get("cameras") or []:
        if cam.get("code") == camera_code:
            return cam.get("station_code")
    return None


def _image_refs(local: LocalConfig) -> list[str]:
    root = Path(local.mock_image_dir)
    if not root.is_dir():
        return []
    files = sorted(p for p in root.iterdir() if p.is_file())
    if not files:
        return []
    return [f"local://{files[0].as_posix()}"]


class VisionEdgeAgent:
    def __init__(self, local: LocalConfig) -> None:
        self.local = local
        self.cloud = CloudClient(local)
        self.buffer = BufferStore(local.buffer_db_path)
        self.cloud_cfg: dict[str, Any] | None = None
        self.config_version: int = 0
        self._thickness_idx = 0
        self._last_trigger: dict[str, float] = {}

    def _ensure_models(self, cfg: dict[str, Any]) -> None:
        cache_dir = Path("model_cache")
        cache_dir.mkdir(parents=True, exist_ok=True)
        for recipe in cfg.get("recipes") or []:
            model = recipe.get("model")
            if not model:
                continue
            checksum = str(model.get("checksum") or "").strip()
            code = str(model.get("code") or "model").strip()
            if not checksum:
                continue
            marker = cache_dir / f"{code}.{checksum[:16]}.ready"
            if marker.exists():
                continue
            # P3：云侧仅下发元数据；现场用 object_key 自行取文件。此处落盘元数据供 ORT 接入。
            meta_path = cache_dir / f"{code}.{checksum[:16]}.json"
            meta_path.write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")
            marker.write_text("ok", encoding="utf-8")
            print(f"[model] cached meta code={code} checksum={checksum[:16]}…")

    def refresh_config(self) -> None:
        cfg = self.cloud.pull_config()
        self.cloud_cfg = cfg
        self.config_version = int(cfg.get("config_version") or 1)
        self._ensure_models(cfg)
        print(f"[config] version={self.config_version} recipes={len(cfg.get('recipes') or [])}")

    def flush_buffer(self) -> None:
        batch = self.buffer.fetch_batch()
        if not batch:
            return
        ids = [i for i, _ in batch]
        items = [p for _, p in batch]
        try:
            res = self.cloud.ingest_batch(items)
            self.buffer.delete_ids(ids)
            self.cloud.last_error = None
            print(f"[flush] batch={len(items)} result={res}")
        except Exception as exc:
            self.cloud.last_error = f"flush: {exc}"
            print(f"[flush] failed: {exc}")

    def submit(self, payload: dict[str, Any]) -> None:
        event_id = str(payload.get("event_id") or "")
        try:
            res = self.cloud.ingest(payload)
            self.cloud.last_error = None
            print(f"[ingest] event={event_id} result={res}")
        except Exception as exc:
            self.buffer.enqueue(event_id, payload)
            self.cloud.last_error = f"ingest: {exc}"
            print(f"[ingest] buffered event={event_id} err={exc}")

    def maybe_run_pipelines(self) -> None:
        if not self.cloud_cfg:
            return
        run_mode = str(self.cloud_cfg.get("run_mode") or "local_pipeline")
        if run_mode == "external_forward":
            return
        now = time.time()
        for recipe in self.cloud_cfg.get("recipes") or []:
            code = str(recipe.get("code") or "")
            trigger = str(recipe.get("trigger_mode") or "manual")
            if trigger == "manual":
                continue
            interval = int(recipe.get("trigger_interval_seconds") or 5)
            if trigger == "gpio":
                # P2：软件模拟为短间隔 interval
                interval = max(interval, 3)
            last = self._last_trigger.get(code, 0.0)
            if now - last < max(interval, 1):
                continue
            self._last_trigger[code] = now
            self._run_one(recipe)

    def _run_one(self, recipe: dict[str, Any]) -> None:
        rtype = str(recipe.get("recipe_type") or "")
        camera = recipe.get("default_camera_code")
        station = _station_for_camera(self.cloud_cfg or {}, camera)
        images = _image_refs(self.local)
        if rtype == "thickness_measure":
            values = self.local.mock_thickness_values or [1.52]
            thickness = values[self._thickness_idx % len(values)]
            self._thickness_idx += 1
            result = run_thickness(
                recipe, thickness_mm=thickness, station_code=station, image_refs=images
            )
        elif rtype == "step_compliance":
            result = run_step_compliance(
                recipe,
                missing_last=self.local.mock_step_missing_last,
                station_code=station,
                image_refs=images,
            )
        else:
            print(f"[pipeline] skip unknown type={rtype}")
            return
        self.submit(to_ingest_payload(result))

    def tick_heartbeat(self) -> None:
        try:
            res = self.cloud.heartbeat(
                buffer_pending_count=self.buffer.pending_count(),
                disk_free_mb=_disk_free_mb(self.local.buffer_db_path),
            )
            remote_ver = int(res.get("config_version") or self.config_version)
            if remote_ver != self.config_version:
                print(f"[heartbeat] config bump {self.config_version} -> {remote_ver}")
                self.refresh_config()
        except Exception as exc:
            self.cloud.last_error = f"heartbeat: {exc}"
            print(f"[heartbeat] failed: {exc}")

    def run_forever(self) -> None:
        self.refresh_config()
        last_hb = 0.0
        last_cfg = time.time()
        print(f"[agent] started version={self.local.agent_version}")
        while True:
            now = time.time()
            try:
                self.flush_buffer()
                if now - last_cfg >= self.local.config_pull_interval_seconds:
                    self.refresh_config()
                    last_cfg = now
                if now - last_hb >= self.local.heartbeat_interval_seconds:
                    self.tick_heartbeat()
                    last_hb = now
                self.maybe_run_pipelines()
            except KeyboardInterrupt:
                print("[agent] stopped")
                return
            except Exception:
                self.cloud.last_error = traceback.format_exc(limit=3)
                print(f"[agent] loop error:\n{self.cloud.last_error}")
            time.sleep(max(self.local.pipeline_tick_seconds, 1))


def main() -> int:
    cfg_path = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    local = _load_local_config(cfg_path)
    VisionEdgeAgent(local).run_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
