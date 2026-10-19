"""厚度 / 步骤本地判定（P2 实验室 mock）。"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class PipelineResult:
    event_id: str
    judgment: str
    confidence: float
    recipe_code: str
    recipe_version: str
    camera_code: str | None
    station_code: str | None
    duration_ms: int
    measurements: list[dict[str, Any]]
    step_results: dict[str, Any] | None
    image_refs: list[str]
    occurred_at: str


def _now_wall() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def run_thickness(
    recipe: dict[str, Any],
    *,
    thickness_mm: float,
    station_code: str | None = None,
    image_refs: list[str] | None = None,
) -> PipelineResult:
    started = time.perf_counter()
    params = recipe.get("params") or {}
    tol_min = float(params.get("tol_min") if params.get("tol_min") is not None else 1.45)
    tol_max = float(params.get("tol_max") if params.get("tol_max") is not None else 1.60)
    unit = str(params.get("unit") or "mm")
    ok = tol_min <= float(thickness_mm) <= tol_max
    judgment = "OK" if ok else "NG"
    duration_ms = int((time.perf_counter() - started) * 1000)
    return PipelineResult(
        event_id=str(uuid.uuid4()),
        judgment=judgment,
        confidence=0.99,
        recipe_code=str(recipe["code"]),
        recipe_version=str(recipe["version"]),
        camera_code=recipe.get("default_camera_code"),
        station_code=station_code,
        duration_ms=max(duration_ms, 1),
        measurements=[{"name": "thickness_mm", "value": float(thickness_mm), "unit": unit}],
        step_results=None,
        image_refs=list(image_refs or []),
        occurred_at=_now_wall(),
    )


def run_step_compliance(
    recipe: dict[str, Any],
    *,
    missing_last: bool = False,
    station_code: str | None = None,
    image_refs: list[str] | None = None,
) -> PipelineResult:
    started = time.perf_counter()
    params = recipe.get("params") or {}
    steps = list(params.get("steps") or [])
    fail_if_any_missing = bool(params.get("fail_if_any_missing", True))
    per_step: list[dict[str, Any]] = []
    any_missing = False
    for idx, step in enumerate(steps):
        name = str((step or {}).get("name") or f"step_{idx + 1}")
        required = bool((step or {}).get("required", True))
        missing = bool(missing_last and idx == len(steps) - 1)
        if missing and required:
            any_missing = True
            per_step.append({"name": name, "required": required, "ok": False, "reason": "missing"})
        else:
            per_step.append({"name": name, "required": required, "ok": True, "reason": None})
    if not steps:
        judgment = "UNKNOWN"
        confidence = 0.5
    elif any_missing and fail_if_any_missing:
        judgment = "NG"
        confidence = 0.95
    else:
        judgment = "OK"
        confidence = 0.97
    duration_ms = int((time.perf_counter() - started) * 1000)
    return PipelineResult(
        event_id=str(uuid.uuid4()),
        judgment=judgment,
        confidence=confidence,
        recipe_code=str(recipe["code"]),
        recipe_version=str(recipe["version"]),
        camera_code=recipe.get("default_camera_code"),
        station_code=station_code,
        duration_ms=max(duration_ms, 1),
        measurements=[
            {"name": f"step_{i + 1}_ok", "value": 1 if s["ok"] else 0, "unit": None}
            for i, s in enumerate(per_step)
        ],
        step_results={"steps": per_step, "fail_if_any_missing": fail_if_any_missing},
        image_refs=list(image_refs or []),
        occurred_at=_now_wall(),
    )


def to_ingest_payload(result: PipelineResult) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "event_id": result.event_id,
        "occurred_at": result.occurred_at,
        "judgment": result.judgment,
        "confidence": result.confidence,
        "recipe_code": result.recipe_code,
        "recipe_version": result.recipe_version,
        "camera_code": result.camera_code,
        "station_code": result.station_code,
        "duration_ms": result.duration_ms,
        "measurements": result.measurements,
        "image_refs": result.image_refs,
    }
    if result.step_results is not None:
        payload["step_results"] = result.step_results
    return payload
