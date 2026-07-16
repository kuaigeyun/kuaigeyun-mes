"""
物料健康检查服务

检查物料基本信息完备度/合理性，以及疑似一物多码、多物一码、相似重复。
"""

from __future__ import annotations

import re
import uuid
from collections import defaultdict
from typing import Any, Dict, List, Optional, Set, Tuple

from tortoise.expressions import Q, F

from apps.master_data.models.material import Material, MaterialGroup
from apps.master_data.models.material_code_alias import MaterialCodeAlias
from apps.master_data.schemas.material_health_schemas import (
    MaterialHealthCheckResponse,
    MaterialHealthIssue,
    MaterialHealthMaterialRef,
    MaterialHealthSummary,
)
from apps.kuaizhizao.utils.material_source_helper import (
    SOURCE_TYPE_MAKE,
    SOURCE_TYPE_BUY,
    SOURCE_TYPE_OUTSOURCE,
)


def _norm_code(value: Optional[str]) -> str:
    return (value or "").strip().upper()


def _norm_text(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _material_ref(m: Material) -> MaterialHealthMaterialRef:
    return MaterialHealthMaterialRef(
        uuid=str(m.uuid),
        mainCode=m.main_code or m.code or "",
        name=m.name or "",
        specification=m.specification,
    )


class MaterialHealthService:
    @staticmethod
    async def _resolve_group_ids(tenant_id: int, group_id: int) -> List[int]:
        async def collect(parent_id: int) -> List[int]:
            ids = [parent_id]
            child_ids = await MaterialGroup.filter(
                tenant_id=tenant_id,
                parent_id=parent_id,
                deleted_at__isnull=True,
            ).values_list("id", flat=True)
            for child_id in child_ids:
                ids.extend(await collect(child_id))
            return ids

        return await collect(group_id)

    @staticmethod
    async def _load_materials(
        tenant_id: int,
        group_id: Optional[int],
        masters_only: bool,
    ) -> List[Material]:
        query = Material.filter(tenant_id=tenant_id, deleted_at__isnull=True)
        if group_id is not None:
            group_ids = await MaterialHealthService._resolve_group_ids(tenant_id, group_id)
            query = query.filter(group_id__in=group_ids)
        if masters_only:
            query = query.filter(Q(variant_managed=False) | Q(code=F("main_code")))
        return await query.prefetch_related("group", "process_route").all()

    @staticmethod
    def _check_completeness(m: Material) -> List[Tuple[str, str, str]]:
        """返回 (severity, field, message)"""
        findings: List[Tuple[str, str, str]] = []

        if not (m.name or "").strip():
            findings.append(("error", "name", "物料名称为空"))
        elif len((m.name or "").strip()) < 2:
            findings.append(("warning", "name", "物料名称过短，建议补充完整品名"))

        if not (m.base_unit or "").strip():
            findings.append(("error", "baseUnit", "基础单位未填写"))

        if m.group_id is None:
            findings.append(("warning", "groupId", "未归属物料分组，不利于编码与报表归类"))

        if not (m.source_type or "").strip():
            findings.append(("error", "sourceType", "未设置物料来源类型（自制/采购/委外等）"))

        if not (m.specification or "").strip():
            findings.append(("info", "specification", "规格为空，同类物料不易区分"))

        if m.batch_managed and not m.default_batch_rule_id:
            findings.append(("warning", "defaultBatchRuleId", "已启用批号管理但未配置默认批号规则"))

        if m.serial_managed and not m.default_serial_rule_id:
            findings.append(("warning", "defaultSerialRuleId", "已启用序列号管理但未配置默认序列号规则"))

        if m.source_type == SOURCE_TYPE_MAKE and not m.process_route_id:
            findings.append(("warning", "processRouteId", "自制件建议配置默认工艺路线"))

        if m.source_type == SOURCE_TYPE_BUY:
            defaults = m.defaults or {}
            if not defaults.get("defaultSuppliers"):
                findings.append(("info", "defaults.defaultSuppliers", "采购件建议配置默认供应商"))

        if m.source_type == SOURCE_TYPE_OUTSOURCE:
            source_config = m.source_config or {}
            if not source_config.get("outsource_supplier_id"):
                findings.append(("warning", "sourceConfig.outsourceSupplierId", "委外件缺少委外供应商配置"))

        weight = getattr(m, "weight", None)
        if weight is not None and float(weight) < 0:
            findings.append(("error", "weight", "重量为负数，请核对"))

        return findings

    @staticmethod
    def _check_reasonableness(m: Material) -> List[Tuple[str, str, str]]:
        findings: List[Tuple[str, str, str]] = []
        name = (m.name or "").strip()
        spec = (m.specification or "").strip()

        if name and spec and name.lower() == spec.lower():
            findings.append(("warning", "specification", "规格与名称完全相同，可能未单独维护规格"))

        unit = (m.base_unit or "").strip()
        if unit and len(unit) > 8:
            findings.append(("info", "baseUnit", "基础单位名称较长，请确认是否为标准计量单位"))

        main_code = (m.main_code or "").strip()
        if main_code and name and main_code.lower() == name.lower():
            findings.append(("info", "mainCode", "主编码与名称相同，建议编码体现分类与流水规则"))

        return findings

    @staticmethod
    async def run_health_check(
        tenant_id: int,
        group_id: Optional[int] = None,
        masters_only: bool = True,
    ) -> MaterialHealthCheckResponse:
        materials = await MaterialHealthService._load_materials(tenant_id, group_id, masters_only)
        material_by_id: Dict[int, Material] = {m.id: m for m in materials}
        material_ids = list(material_by_id.keys())

        aliases: List[MaterialCodeAlias] = []
        if material_ids:
            aliases = await MaterialCodeAlias.filter(
                tenant_id=tenant_id,
                material_id__in=material_ids,
                deleted_at__isnull=True,
            ).all()

        issues: List[MaterialHealthIssue] = []

        # --- 完备度 / 合理性（按物料） ---
        for m in materials:
            for severity, field, message in MaterialHealthService._check_completeness(m):
                issues.append(
                    MaterialHealthIssue(
                        id=uuid.uuid4().hex,
                        category="completeness" if field not in ("specification",) else "completeness",
                        severity=severity,  # type: ignore[arg-type]
                        title=message,
                        description=f"物料 {m.main_code} - {m.name}",
                        materials=[_material_ref(m)],
                        field=field,
                    )
                )
            for severity, field, message in MaterialHealthService._check_reasonableness(m):
                issues.append(
                    MaterialHealthIssue(
                        id=uuid.uuid4().hex,
                        category="reasonableness",
                        severity=severity,  # type: ignore[arg-type]
                        title=message,
                        description=f"物料 {m.main_code} - {m.name}",
                        materials=[_material_ref(m)],
                        field=field,
                    )
                )

        # --- 多物一码：同一主编码对应多条物料 ---
        main_code_groups: Dict[str, List[Material]] = defaultdict(list)
        for m in materials:
            code = _norm_code(m.main_code or m.code)
            if code:
                main_code_groups[code].append(m)

        for code, group in main_code_groups.items():
            if len(group) <= 1:
                continue
            issues.append(
                MaterialHealthIssue(
                    id=uuid.uuid4().hex,
                    category="duplicate_many_one_code",
                    severity="error",
                    title=f"主编码「{group[0].main_code}」被 {len(group)} 条物料共用",
                    description="同一主编码对应多条物料记录，可能导致库存与单据引用混乱。",
                    materials=[_material_ref(x) for x in group],
                    field="mainCode",
                )
            )

        # --- 部门/别名编码跨物料冲突 ---
        alias_code_map: Dict[str, Set[int]] = defaultdict(set)
        for alias in aliases:
            code = _norm_code(alias.code)
            if code:
                alias_code_map[code].add(alias.material_id)

        main_codes_set = {_norm_code(m.main_code or m.code) for m in materials if (m.main_code or m.code)}

        for code, mat_ids in alias_code_map.items():
            if len(mat_ids) <= 1:
                continue
            mats = [material_by_id[mid] for mid in mat_ids if mid in material_by_id]
            if len(mats) <= 1:
                continue
            issues.append(
                MaterialHealthIssue(
                    id=uuid.uuid4().hex,
                    category="duplicate_many_one_code",
                    severity="error",
                    title=f"别名编码「{code}」被 {len(mats)} 条物料共用",
                    description="不同物料使用了相同的部门/别名编码，属于疑似多物一码。",
                    materials=[_material_ref(x) for x in mats],
                    field="codeAliases",
                )
            )

        # 别名与别的主编码撞码
        for alias in aliases:
            code = _norm_code(alias.code)
            if not code:
                continue
            owner = material_by_id.get(alias.material_id)
            if not owner:
                continue
            owner_main = _norm_code(owner.main_code or owner.code)
            if code == owner_main:
                continue
            for m in materials:
                other_main = _norm_code(m.main_code or m.code)
                if m.id != owner.id and other_main == code:
                    issues.append(
                        MaterialHealthIssue(
                            id=uuid.uuid4().hex,
                            category="duplicate_one_many_codes",
                            severity="warning",
                            title=f"物料 {owner.main_code} 的别名「{alias.code}」与其他物料主编码相同",
                            description="一物多码：同一编码既作为 A 物料别名，又作为 B 物料主编码。",
                            materials=[_material_ref(owner), _material_ref(m)],
                            field="codeAliases",
                        )
                    )

        # --- 一物多码：同名同规格同单位但主编码不同 ---
        identity_groups: Dict[str, List[Material]] = defaultdict(list)
        for m in materials:
            key = "|".join([
                _norm_text(m.name),
                _norm_text(m.specification),
                _norm_text(m.base_unit),
            ])
            if not _norm_text(m.name):
                continue
            identity_groups[key].append(m)

        for key, group in identity_groups.items():
            codes = {_norm_code(x.main_code or x.code) for x in group if _norm_code(x.main_code or x.code)}
            if len(group) <= 1 or len(codes) <= 1:
                continue
            sample = group[0]
            issues.append(
                MaterialHealthIssue(
                    id=uuid.uuid4().hex,
                    category="duplicate_one_many_codes",
                    severity="warning",
                    title=f"「{sample.name}」存在 {len(codes)} 个不同主编码",
                    description="名称、规格、单位一致但主编码不同，疑似同一物料重复建档（一物多码）。",
                    materials=[_material_ref(x) for x in group],
                    field="mainCode",
                )
            )

        # --- 相似物料（名称高度相似，规格相同） ---
        spec_name_groups: Dict[str, List[Material]] = defaultdict(list)
        for m in materials:
            if not (m.specification or "").strip():
                continue
            spec_name_groups[_norm_text(m.specification)].append(m)

        reported_pairs: Set[Tuple[int, int]] = set()
        for spec_key, group in spec_name_groups.items():
            if len(group) < 2 or not spec_key:
                continue
            for i, a in enumerate(group):
                for b in group[i + 1 :]:
                    pair = tuple(sorted((a.id, b.id)))
                    if pair in reported_pairs:
                        continue
                    na, nb = _norm_text(a.name), _norm_text(b.name)
                    if na == nb:
                        continue
                    similar = na in nb or nb in na or na[:4] == nb[:4]
                    if not similar:
                        continue
                    reported_pairs.add(pair)
                    issues.append(
                        MaterialHealthIssue(
                            id=uuid.uuid4().hex,
                            category="duplicate_similar",
                            severity="info",
                            title=f"规格相同且名称相似的物料：{a.main_code} / {b.main_code}",
                            description=f"规格均为「{a.specification}」，名称分别为「{a.name}」与「{b.name}」，请确认是否重复。",
                            materials=[_material_ref(a), _material_ref(b)],
                            field="name",
                        )
                    )

        completeness_count = sum(1 for i in issues if i.category in ("completeness", "reasonableness"))
        duplicate_count = sum(
            1 for i in issues if i.category.startswith("duplicate")
        )

        total = len(materials)
        affected_materials: Set[str] = set()
        for issue in issues:
            for mat in issue.materials:
                affected_materials.add(mat.uuid)

        if total == 0:
            health_score = 100
        else:
            penalty = min(100, completeness_count * 2 + duplicate_count * 5)
            health_score = max(0, 100 - int(penalty * 100 / max(total, 1) / 3))

        return MaterialHealthCheckResponse(
            summary=MaterialHealthSummary(
                totalMaterials=total,
                issueCount=len(issues),
                completenessCount=completeness_count,
                duplicateCount=duplicate_count,
                healthScore=health_score,
            ),
            issues=issues,
        )
