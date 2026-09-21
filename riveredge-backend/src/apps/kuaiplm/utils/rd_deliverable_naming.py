"""研发交付物目录与文件名校验（26.9.1 P1）。

失败即报 ValidationError，禁止静默改名或读侧补丁。
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from infra.exceptions.exceptions import ValidationError

# 交付物类型 → 命名规则 profile key
PART_SPEC_TYPES = frozenset({"part_spec", "component_spec"})
SOFTWARE_SPEC_TYPES = frozenset({"software_spec", "sw_spec"})
SCHEMATIC_GERBER_TYPES = frozenset({"schematic", "gerber", "schematic_gerber"})
DRAWING_3D_TYPES = frozenset({"drawing_3d", "3d_drawing"})
DRAWING_2D_TYPES = frozenset({"drawing_2d", "2d_drawing", "drawing_cad", "drawing_pdf"})
TEST_REPORT_TYPES = frozenset({"test_report", "test"})

_VERSION_SUFFIX_RE = re.compile(
    r"[_\-\s]?[vV]?([A-Z]\d{1,2}|[Rr]\d{1,3}|\d+\.\d+)\s*$"
)
_MATERIAL_CODE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-\.]{2,79}$")


def _require_material_code(material_code: Optional[str], *, label: str) -> str:
    code = (material_code or "").strip()
    if not code:
        raise ValidationError(f"{label}须填写关联料号")
    if not _MATERIAL_CODE_RE.match(code):
        raise ValidationError(f"{label}料号格式不合法: {code}")
    return code


def _require_version_suffix(file_name: Optional[str], *, label: str) -> None:
    name = (file_name or "").strip()
    if not name:
        raise ValidationError(f"{label}须上传文件并填写文件名")
    base = name.rsplit(".", 1)[0] if "." in name else name
    if not _VERSION_SUFFIX_RE.search(base):
        raise ValidationError(f"{label}文件名须带版本后缀（如 _A1 / _R02 / _1.0）: {name}")


def validate_deliverable_catalog(
    *,
    deliverable_type: Optional[str],
    material_code: Optional[str],
    legacy_material_code: Optional[str],
    file_name: Optional[str],
    project_code: Optional[str] = None,
    naming_rules: Optional[Dict[str, Any]] = None,
) -> None:
    """按交付物类型校验料号目录与文件名；naming_rules 来自行业 profile。"""
    dtype = (deliverable_type or "").strip().lower()
    if not dtype:
        return

    rules = naming_rules or {}
    if dtype in PART_SPEC_TYPES or dtype in rules.get("part_spec_types", []):
        _require_material_code(material_code, label="部品规格书")
        if legacy_material_code:
            legacy = legacy_material_code.strip()
            if legacy and not _MATERIAL_CODE_RE.match(legacy):
                raise ValidationError(f"沿用旧料号格式不合法: {legacy}")
        if file_name:
            code = material_code.strip()
            if code not in file_name and not file_name.startswith(code):
                raise ValidationError(f"部品规格书文件名须以料号 {code} 开头或在路径中包含该料号")
        return

    if dtype in TEST_REPORT_TYPES or dtype in rules.get("test_report_types", []):
        _require_material_code(material_code, label="测试报告")
        if legacy_material_code:
            legacy = legacy_material_code.strip()
            if legacy and not _MATERIAL_CODE_RE.match(legacy):
                raise ValidationError(f"沿用旧料号格式不合法: {legacy}")
        return

    if dtype in SOFTWARE_SPEC_TYPES or dtype in rules.get("software_spec_types", []):
        _require_version_suffix(file_name, label="软件规格书")
        pcode = (project_code or "").strip()
        if pcode and file_name and not file_name.startswith(pcode):
            raise ValidationError(f"软件规格书文件名须以项目代号 {pcode} 开头")
        return

    if dtype in SCHEMATIC_GERBER_TYPES or dtype in rules.get("schematic_gerber_types", []):
        _require_version_suffix(file_name, label="原理图/Gerber")
        if material_code:
            code = material_code.strip()
            if file_name and code not in file_name:
                raise ValidationError(f"原理图/Gerber 文件名须包含 PCB 料号 {code}")
        elif project_code:
            pcode = project_code.strip()
            if file_name and not file_name.startswith(pcode):
                raise ValidationError(f"原理图/Gerber 文件名须以项目代号 {pcode} 开头")
        return

    if dtype in DRAWING_3D_TYPES or dtype in DRAWING_2D_TYPES:
        _require_version_suffix(file_name, label="结构图纸")
