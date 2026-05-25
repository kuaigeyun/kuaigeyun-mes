"""
STP 装配体导入 BOM 服务
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Dict, List, Set, Tuple

from apps.master_data.models.drawing import EngineeringDrawing
from apps.master_data.models.material import Material
from apps.master_data.schemas.drawing_schemas import (
    DrawingStepBomImportRequest,
    DrawingStepBomImportResponse,
    StepBomMaterialBrief,
)
from apps.master_data.schemas.material_schemas import BOMBatchImport, BOMBatchImportItem, MaterialCreate
from apps.master_data.services.drawing_service import DrawingService, _to_response
from apps.master_data.services.material_code_service import MaterialCodeService
from apps.master_data.services.material_service import MaterialService
from core.services.file.file_service import FileService
from infra.exceptions.exceptions import NotFoundError, ValidationError


def _sanitize_step_material_code(name: str, prefix: str = "STP-") -> str:
    base = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", (name or "").strip().upper())
    base = re.sub(r"-+", "-", base).strip("-") or "PART"
    return f"{prefix}{base}" if prefix else base


class DrawingStepBomService:
    @staticmethod
    async def import_step_bom(
        tenant_id: int,
        drawing_uuid: str,
        data: DrawingStepBomImportRequest,
    ) -> DrawingStepBomImportResponse:
        drawing = await DrawingService._get_active_or_404(tenant_id, drawing_uuid)

        file_meta = await FileService.get_file_by_uuid(tenant_id, drawing.file_uuid)
        ext = (file_meta.file_extension or "").lower().lstrip(".")
        if ext not in ("stp", "step"):
            raise ValidationError("主文件不是 STP/STEP，无法导入装配 BOM")

        if drawing.drawing_type != "assembly":
            raise ValidationError("仅装配图支持 STP 导入 BOM，请将图纸类型设为装配图")

        root_material = await Material.filter(
            tenant_id=tenant_id,
            id=data.root_material_id,
            deleted_at__isnull=True,
        ).first()
        if not root_material or not root_material.main_code:
            raise ValidationError("根物料不存在或缺少主编码")

        node_map = {n.key: n for n in data.nodes}
        needed_keys: Set[str] = set()
        for edge in data.edges:
            if edge.child_key not in node_map:
                raise ValidationError(f"缺少子节点定义: {edge.child_key}")
            needed_keys.add(edge.child_key)
            if edge.parent_key != "root" and edge.parent_key not in node_map:
                raise ValidationError(f"缺少父节点定义: {edge.parent_key}")
            if edge.parent_key != "root":
                needed_keys.add(edge.parent_key)

        key_to_material: Dict[str, Material] = {}
        materials_created: List[StepBomMaterialBrief] = []
        match_counter = {"count": 0}

        async def resolve_material_for_key(key: str) -> Material:
            if key in key_to_material:
                return key_to_material[key]

            node = node_map.get(key)
            if not node:
                raise ValidationError(f"未知装配节点: {key}")

            if node.material_id:
                mat = await Material.filter(
                    tenant_id=tenant_id,
                    id=node.material_id,
                    deleted_at__isnull=True,
                ).first()
                if not mat:
                    raise ValidationError(f"节点 {node.name} 指定的物料不存在")
                key_to_material[key] = mat
                match_counter["count"] += 1
                return mat

            code_candidates: List[str] = []
            if node.material_code and node.material_code.strip():
                code_candidates.append(node.material_code.strip())
            code_candidates.append(_sanitize_step_material_code(node.name, data.material_code_prefix))
            code_candidates.append(_sanitize_step_material_code(node.name, ""))

            for code in code_candidates:
                if not code:
                    continue
                existing = await MaterialCodeService.get_material_by_code(tenant_id=tenant_id, code=code)
                if existing:
                    key_to_material[key] = existing
                    match_counter["count"] += 1
                    return existing

            mat_by_name = await Material.filter(
                tenant_id=tenant_id,
                name=node.name.strip(),
                deleted_at__isnull=True,
            ).first()
            if mat_by_name:
                key_to_material[key] = mat_by_name
                match_counter["count"] += 1
                return mat_by_name

            if not data.create_missing_materials:
                raise ValidationError(f"节点 {node.name} 未匹配到物料，且未开启自动建料")

            base_code = code_candidates[0]
            final_code = base_code
            suffix = 1
            while await Material.filter(
                tenant_id=tenant_id,
                main_code=final_code,
                deleted_at__isnull=True,
            ).exists():
                final_code = f"{base_code}-{suffix}"
                suffix += 1

            source_type = "Make" if node.has_children else "Buy"
            create_data = MaterialCreate(
                main_code=final_code,
                name=node.name.strip(),
                group_id=data.default_group_id,
                base_unit=data.default_unit,
                source_type=source_type,
                description=(
                    f"来源图纸 {drawing.code} Rev.{drawing.revision} / STP节点 {node.name}"
                ),
                is_active=True,
            )
            created = await MaterialService.create_material(tenant_id, create_data)
            mat = await Material.filter(tenant_id=tenant_id, id=created.id).first()
            if not mat:
                raise ValidationError(f"自动创建物料失败: {node.name}")
            key_to_material[key] = mat
            materials_created.append(
                StepBomMaterialBrief(
                    id=mat.id,
                    uuid=mat.uuid,
                    main_code=mat.main_code or final_code,
                    name=mat.name,
                )
            )
            return mat

        for key in sorted(needed_keys, key=lambda k: (node_map[k].name if k in node_map else k)):
            await resolve_material_for_key(key)

        root_code = root_material.main_code
        key_to_code: Dict[str, str] = {k: (m.main_code or "") for k, m in key_to_material.items()}

        bom_items: List[BOMBatchImportItem] = []
        for edge in data.edges:
            parent_code = root_code if edge.parent_key == "root" else key_to_code.get(edge.parent_key)
            child_code = key_to_code.get(edge.child_key)
            if not parent_code or not child_code:
                raise ValidationError(f"BOM 边映射失败: {edge.parent_key} -> {edge.child_key}")
            child_node = node_map[edge.child_key]
            issue_method = "pick" if child_node.has_children else "backflush"
            bom_items.append(
                BOMBatchImportItem(
                    parent_code=parent_code,
                    component_code=child_code,
                    quantity=Decimal(str(edge.quantity)),
                    unit=data.default_unit,
                    issue_method=issue_method,
                    remark=f"STP:{edge.child_name}",
                )
            )

        batch_data = BOMBatchImport(
            items=bom_items,
            version=data.version,
            description=f"由图纸 {drawing.code} Rev.{drawing.revision} STP 装配导入",
            version_remark="STP assembly import",
        )
        created_boms = await MaterialService.batch_import_bom(tenant_id, batch_data)

        from datetime import datetime, timezone

        drawing.linked_bom_material_id = root_material.id
        drawing.linked_bom_version = data.version
        drawing.last_step_bom_import_at = datetime.now(timezone.utc)
        await drawing.save()

        drawing_resp = await _to_response(tenant_id, drawing)
        return DrawingStepBomImportResponse(
            root_material_id=root_material.id,
            version=data.version,
            bom_items_created=len(created_boms),
            materials_created=materials_created,
            materials_matched=match_counter["count"],
            bom_designer_path=(
                f"/apps/master-data/process/engineering-bom/designer"
                f"?materialId={root_material.id}&version={data.version}"
            ),
            drawing=drawing_resp,
        )
