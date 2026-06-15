"""
质量管理服务模块

提供质量管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import Any, Dict, List, Optional
from datetime import datetime
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
from apps.kuaizhizao.models.process_inspection import ProcessInspection
from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection

from apps.kuaizhizao.schemas.quality import (
    # 来料检验单
    IncomingInspectionCreate, IncomingInspectionUpdate, IncomingInspectionResponse, IncomingInspectionListResponse,
    # 过程检验单
    ProcessInspectionCreate, ProcessInspectionUpdate, ProcessInspectionResponse, ProcessInspectionListResponse,
    # 成品检验单
    FinishedGoodsInspectionCreate, FinishedGoodsInspectionUpdate, FinishedGoodsInspectionResponse, FinishedGoodsInspectionListResponse,
)

from apps.common.base_service import AppBaseService
from apps.kuaizhizao.services.inspection_policy_service import (
    InspectionStage,
    get_quality_inspection_stage_toggles,
    resolve_inspection_policy,
    stage_plan_type,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from datetime import timedelta
from decimal import Decimal


async def _get_quality_policy_flags(tenant_id: int) -> tuple[bool, bool]:
    """读取质量策略开关（来料检验、过程检验）。"""
    from infra.services.business_config_service import BusinessConfigService

    cfg = await BusinessConfigService().get_business_config(tenant_id)
    quality = cfg.get("parameters", {}).get("quality", {})
    return bool(quality.get("incoming_inspection", False)), bool(quality.get("process_inspection", False))


async def _is_finished_inspection_enabled(tenant_id: int) -> bool:
    """读取成品检验开关。"""
    from infra.services.business_config_service import BusinessConfigService

    cfg = await BusinessConfigService().get_business_config(tenant_id)
    quality = cfg.get("parameters", {}).get("quality", {})
    return bool(quality.get("finished_inspection", False))


async def _is_quality_audit_required(tenant_id: int, stage_code: str) -> bool:
    """
    质检审核开关：优先读取分阶段开关，未配置时回退到总开关 quality_inspection。
    """
    from infra.services.business_config_service import BusinessConfigService

    config_service = BusinessConfigService()
    stage_required = await config_service.check_audit_required(tenant_id, stage_code)
    if stage_required:
        return True
    return await config_service.check_audit_required(tenant_id, "quality_inspection")


async def _require_iqc_stage_enabled(tenant_id: int) -> None:
    """组织级 IQC 总开关（TenantConfig）；关闭时禁止创建/下推来料检。"""
    t = await get_quality_inspection_stage_toggles(tenant_id)
    if not t.get("iqc_enabled", True):
        raise BusinessLogicError("当前组织已关闭来料检验（IQC）环节，禁止创建或下推来料检验单")


async def _require_ipqc_stage_enabled(tenant_id: int) -> None:
    """组织级 IPQC 总开关。"""
    t = await get_quality_inspection_stage_toggles(tenant_id)
    if not t.get("ipqc_enabled", True):
        raise BusinessLogicError("当前组织已关闭过程检验（IPQC）环节，禁止创建或下推过程检验单")


async def _require_fqc_stage_enabled(tenant_id: int) -> None:
    """组织级 FQC 总开关。"""
    t = await get_quality_inspection_stage_toggles(tenant_id)
    if not t.get("fqc_enabled", True):
        raise BusinessLogicError("当前组织已关闭成品检验（FQC）环节，禁止创建或下推成品检验单")


def _work_order_product_fields(work_order: Any) -> Dict[str, Any]:
    """工单产品物料字段（product_* 与历史 material_* 兼容）。"""
    from apps.kuaizhizao.services.work_order_tracking_service import WorkOrderTrackingService

    mid = getattr(work_order, "product_id", None) or getattr(work_order, "material_id", None)
    code = getattr(work_order, "product_code", None) or getattr(work_order, "material_code", None)
    name = getattr(work_order, "product_name", None) or getattr(work_order, "material_name", None)
    spec = getattr(work_order, "material_spec", None) or getattr(work_order, "product_spec", None)
    batch = WorkOrderTrackingService.effective_batch_no(work_order)
    serial = WorkOrderTrackingService.effective_serial_no(work_order)
    qty = getattr(work_order, "quantity", None) or getattr(work_order, "planned_quantity", None)
    return {
        "material_id": mid,
        "material_code": code,
        "material_name": name,
        "material_spec": spec,
        "batch_number": batch,
        "serial_number": serial,
        "planned_qty": qty,
    }


async def _resolve_inspection_template_fields(
    tenant_id: int,
    material_id: Optional[int],
    stage: InspectionStage,
    operation_id: Optional[int] = None,
    explicit_plan_id: Optional[int] = None,
    use_quality_characteristics: bool = False,
) -> Dict[str, Any]:
    """按场景解析 mode/plan_id 并填充检验项模板。"""
    from apps.kuaizhizao.models.inspection_plan import InspectionPlan, InspectionPlanStep
    from apps.kuaizhizao.models.quality_standard import QualityStandard
    from infra.exceptions.exceptions import ConflictError

    if not material_id:
        return {}

    plan_type = stage_plan_type(stage)
    mode, resolved_plan_id, _ = await resolve_inspection_policy(
        tenant_id,
        stage,
        material_id=material_id,
        operation_id=operation_id,
    )
    if mode == "none":
        return {}

    def _items_field(items_payload: dict) -> Dict[str, Any]:
        if use_quality_characteristics:
            return {"quality_characteristics": items_payload}
        return {"other_checks": items_payload}

    plan_id = explicit_plan_id or resolved_plan_id

    if mode == "plan":
        plan = None
        if plan_id:
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id, id=plan_id, deleted_at__isnull=True, is_active=True
            ).first()
            if plan and str(plan.plan_type) != plan_type:
                raise ConflictError(
                    f"质检方案 {plan.plan_code} 类型为 {plan.plan_type}，与当前场景 {stage} 所需 {plan_type} 不一致"
                )
        if not plan:
            plan = await InspectionPlan.filter(
                tenant_id=tenant_id,
                material_id=material_id,
                plan_type=plan_type,
                deleted_at__isnull=True,
                is_active=True,
            ).order_by("-created_at").first()
        if plan:
            steps = await InspectionPlanStep.filter(plan_id=plan.id).order_by("sequence").all()
            items: List[Dict[str, Any]] = []
            for step in steps:
                item: Dict[str, Any] = {
                    "sequence": step.sequence,
                    "inspection_item": step.inspection_item,
                    "inspection_method": step.inspection_method,
                    "acceptance_criteria": step.acceptance_criteria,
                    "sampling_type": step.sampling_type,
                }
                if step.quality_standard_id:
                    std = await QualityStandard.get_or_none(
                        tenant_id=tenant_id, id=step.quality_standard_id, deleted_at__isnull=True
                    )
                    if std:
                        item["standard"] = {
                            "standard_code": std.standard_code,
                            "inspection_items": std.inspection_items,
                            "acceptance_criteria": std.acceptance_criteria,
                        }
                items.append(item)
            payload = {"plan_id": plan.id, "plan_code": plan.plan_code, "items": items}
            return {
                "inspection_standard": f"{plan.plan_name} ({plan.plan_code})",
                **_items_field(payload),
            }

    if mode == "simple":
        std = await QualityStandard.filter(
            tenant_id=tenant_id,
            material_id=material_id,
            standard_type=plan_type,
            is_active=True,
            deleted_at__isnull=True,
        ).order_by("-created_at").first()
        if not std:
            std = await QualityStandard.filter(
                tenant_id=tenant_id,
                material_id__isnull=True,
                standard_type=plan_type,
                is_active=True,
                deleted_at__isnull=True,
            ).order_by("-created_at").first()
        if std:
            methods = std.inspection_methods
            first_method = methods[0] if isinstance(methods, list) and methods else None
            payload = {
                "standard_id": std.id,
                "inspection_items": std.inspection_items,
                "inspection_methods": std.inspection_methods,
                "acceptance_criteria": std.acceptance_criteria,
            }
            return {
                "inspection_standard": f"{std.standard_name} ({std.standard_code})",
                "inspection_method": first_method,
                **_items_field(payload),
            }
    return {}


def _validate_inspection_template_conduct(
    template_json: Any,
    conduct_data: Dict[str, Any],
) -> None:
    """plan 模式须逐项填写 item_results 或 measurement_data 后方可提交。"""
    from infra.exceptions.exceptions import ValidationError

    if not template_json or not isinstance(template_json, dict):
        return
    items = template_json.get("items")
    if not items or not isinstance(items, list):
        if template_json.get("plan_id"):
            item_results = conduct_data.get("item_results") or {}
            if not item_results:
                raise ValidationError("检验方案模式下须填写检验项判定结果")
        return

    measurement = conduct_data.get("measurement_data") or {}
    item_results = conduct_data.get("item_results") or {}
    missing: List[str] = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        name = item.get("inspection_item") or f"项{idx + 1}"
        key = str(idx)
        filled = (
            key in item_results and item_results[key] not in (None, "")
        ) or (
            name in measurement and measurement[name] not in (None, "")
        )
        if not filled:
            missing.append(str(name))
    if missing:
        raise ValidationError(f"请完成检验项：{'、'.join(missing)}")


def _apply_template_conduct_to_payload(
    inspection: Any,
    template_attr: str,
    inspection_data: dict,
) -> dict:
    """校验方案项并返回可写入 ORM 的 conduct 附加字段。"""
    template = getattr(inspection, template_attr, None)
    _validate_inspection_template_conduct(template, inspection_data)
    payload = {
        k: v
        for k, v in inspection_data.items()
        if k not in ("item_results",) and v is not None
    }
    if template and (
        inspection_data.get("item_results") or inspection_data.get("measurement_data")
    ):
        payload[template_attr] = _merge_template_conduct_results(template, inspection_data)
    elif "item_results" in payload:
        payload.pop("item_results", None)
    return payload


def _merge_template_conduct_results(
    template_json: Any,
    conduct_data: Dict[str, Any],
) -> Any:
    """将 conduct 的 item_results / measurement_data 写回模板 JSON 副本。"""
    if not template_json or not isinstance(template_json, dict):
        return template_json
    merged = dict(template_json)
    if conduct_data.get("item_results"):
        merged["conduct_item_results"] = conduct_data["item_results"]
    if conduct_data.get("measurement_data"):
        merged["conduct_measurement_data"] = conduct_data["measurement_data"]
    return merged


async def _maybe_create_quality_exception_from_inspection(
    tenant_id: int,
    source_type: str,
    source_id: int,
    inspected_by: int,
    problem_description: Optional[str] = None,
    severity: str = "major",
) -> None:
    """检验不合格时自动创建质量异常（幂等：同检验单不重复）。"""
    from apps.kuaizhizao.models.quality_exception import QualityException
    from apps.kuaizhizao.services.exception_service import ExceptionService

    existing = await QualityException.filter(
        tenant_id=tenant_id,
        inspection_record_id=source_id,
        inspection_source_type=source_type,
        exception_type="inspection_failure",
        status__in=["pending", "investigating", "correcting"],
        deleted_at__isnull=True,
    ).first()
    if existing:
        return

    await ExceptionService().create_from_inspection(
        tenant_id=tenant_id,
        source_type=source_type,
        source_id=source_id,
        created_by=inspected_by,
        problem_description=problem_description,
        severity=severity,
    )


async def _maybe_record_spc_samples_from_ipqc(
    tenant_id: int,
    inspection_id: int,
    inspection_code: str,
    measurement_data: Any,
    user_id: int,
) -> None:
    """IPQC 检验含测量数据时写入 SPC 样本。"""
    if not measurement_data or not isinstance(measurement_data, dict):
        return

    from apps.kuaizhizao.schemas.quality_improvement import SPCSampleCreate
    from apps.kuaizhizao.services.quality_improvement_service import SPCService

    spc_svc = SPCService()
    sample_time = datetime.now()
    for key, value in measurement_data.items():
        if value is None:
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        await spc_svc.create_sample(
            tenant_id=tenant_id,
            user_id=user_id,
            payload=SPCSampleCreate(
                characteristic_name=str(key),
                sample_time=sample_time,
                sample_value=numeric,
                source_type="process_inspection",
                source_id=inspection_id,
                source_code=inspection_code,
            ),
        )


class IncomingInspectionService(AppBaseService[IncomingInspection]):
    """来料检验单服务"""

    def __init__(self):
        super().__init__(IncomingInspection)

    async def create_incoming_inspection(self, tenant_id: int, inspection_data: IncomingInspectionCreate, created_by: int) -> IncomingInspectionResponse:
        """创建来料检验单"""
        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止创建来料检验单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")

            create_data = inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            template = await _resolve_inspection_template_fields(
                tenant_id,
                create_data.get("material_id"),
                "iqc",
            )
            for k, v in template.items():
                create_data.setdefault(k, v)
            # 检查业务配置：若无需审核，则创建时直接设为已审核（考虑中小企业实情）
            from apps.kuaizhizao.constants import ReviewStatus
            audit_required = await _is_quality_audit_required(tenant_id, "incoming_inspection")
            if not audit_required:
                create_data["review_status"] = ReviewStatus.APPROVED

            inspection = await IncomingInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **create_data
            )
            return IncomingInspectionResponse.model_validate(inspection)

    async def get_incoming_inspection_by_id(self, tenant_id: int, inspection_id: int) -> IncomingInspectionResponse:
        """根据ID获取来料检验单"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_incoming_inspection_lifecycle,
            get_document_milestones
        )

        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"来料检验单不存在: {inspection_id}")
        
        milestones = await get_document_milestones(tenant_id, "incoming_inspection", inspection_id)
        resp = IncomingInspectionResponse.model_validate(inspection)
        resp = resp.model_copy(update={"lifecycle": get_incoming_inspection_lifecycle(inspection, milestones=milestones)})
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "incoming_inspection", resp)

    async def list_incoming_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> Dict[str, Any]:
        """获取来料检验单列表"""
        query = IncomingInspection.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('supplier_id'):
            query = query.filter(supplier_id=filters['supplier_id'])
        if filters.get('material_id'):
            query = query.filter(material_id=filters['material_id'])
        if filters.get('purchase_receipt_id'):
            query = query.filter(purchase_receipt_id=filters['purchase_receipt_id'])
        if filters.get("scoped_purchase_receipt_ids") is not None:
            query = query.filter(purchase_receipt_id__in=filters["scoped_purchase_receipt_ids"])

        # 获取总数
        total = await query.count()
        
        # 获取分页数据
        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        
        # 返回前端期望的格式
        from core.services.approval.audit_record_enricher import enrich_data_payload

        return await enrich_data_payload(tenant_id, "incoming_inspection", {
            "data": [IncomingInspectionListResponse.model_validate(inspection).model_dump() for inspection in inspections],
            "total": total,
            "success": True
        })

    async def update_incoming_inspection(self, tenant_id: int, inspection_id: int, inspection_data: IncomingInspectionUpdate, updated_by: int) -> IncomingInspectionResponse:
        """更新来料检验单"""
        async with in_transaction():
            inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            update_data = inspection_data.model_dump(exclude_unset=True, exclude={'updated_by'})
            update_data['updated_by'] = updated_by

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(**update_data)
            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> IncomingInspectionResponse:
        """执行检验"""
        async with in_transaction():
            inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)

            if inspection.status != '待检验':
                raise BusinessLogicError("只有待检验状态的检验单才能执行检验")

            inspector_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity = inspection_data.get('qualified_quantity', 0)
            unqualified_quantity = inspection_data.get('unqualified_quantity', 0)

            if qualified_quantity + unqualified_quantity != inspection.inspection_quantity:
                raise ValidationError("合格数量和不合格数量之和必须等于检验数量")

            quality_status = "合格" if unqualified_quantity == 0 else "不合格"

            conduct_payload = _apply_template_conduct_to_payload(
                inspection, "other_checks", inspection_data
            )

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                qualified_quantity=qualified_quantity,
                unqualified_quantity=unqualified_quantity,
                inspection_result="已检验",
                quality_status=quality_status,
                inspector_id=inspected_by,
                inspector_name=inspector_name,
                inspection_time=datetime.now(),
                status="已检验",
                updated_by=inspected_by,
                **conduct_payload
            )

            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            
            if updated_inspection.quality_status == "不合格" and updated_inspection.unqualified_quantity > 0:
                await _maybe_create_quality_exception_from_inspection(
                    tenant_id=tenant_id,
                    source_type="incoming_inspection",
                    source_id=inspection_id,
                    inspected_by=inspected_by,
                    problem_description=inspection_data.get("nonconformance_reason")
                    or f"来料检验不合格：{updated_inspection.inspection_code}",
                )

            # 如果合格，可以增加逻辑确保其可以正式入库（如果入库单是待入库状态）
            if updated_inspection.quality_status == "合格" and updated_inspection.qualified_quantity > 0:
                try:
                    from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
                    receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=updated_inspection.purchase_receipt_id)
                    if receipt and receipt.status == "待入库":
                        logger.info(f"来料检验合格 -> 关联采购入库单 {receipt.receipt_code} 可执行确认")
                except Exception as e:
                    logger.warning(f"来料检验合格 -> 关联入库单处理失败: {e}")
            
            return updated_inspection

    async def push_to_purchase_return(self, tenant_id: int, inspection_id: int, created_by: int) -> dict:
        """来料检验不合格 -> 一键生成采购退货单"""
        async with in_transaction():
            inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            
            if inspection.quality_status != '不合格':
                raise BusinessLogicError("只有不合格的来料检验单才能下推采购退货单")
            
            if inspection.unqualified_quantity <= 0:
                raise BusinessLogicError("不合格数量为0，无需退货")

            from apps.kuaizhizao.services.warehouse_service import PurchaseReturnService
            from apps.kuaizhizao.schemas.warehouse import PurchaseReturnCreate, PurchaseReturnItemCreate
            
            return_svc = PurchaseReturnService()
            
            # 生成采购退货单
            return_data = PurchaseReturnCreate(
                supplier_id=inspection.supplier_id,
                supplier_name=inspection.supplier_name,
                purchase_receipt_id=inspection.purchase_receipt_id,
                purchase_receipt_code=inspection.purchase_receipt_code,
                return_date=datetime.now().date(),
                status="待退项",
                notes=f"由来料检验单 {inspection.inspection_code} 不合格项自动生成"
            )
            
            item_data = PurchaseReturnItemCreate(
                material_id=inspection.material_id,
                material_code=inspection.material_code,
                material_name=inspection.material_name,
                material_unit=inspection.material_unit or "个",
                return_quantity=inspection.unqualified_quantity,
                reason=inspection.nonconformance_reason or "质量检验不合格",
                batch_number=getattr(inspection, "batch_number", None)
            )
            
            ret_bill = await return_svc.create_purchase_return(
                tenant_id=tenant_id,
                return_data=return_data,
                created_by=created_by,
                items=[item_data]
            )
            
            # 建立 质检 -> 采购退货单 的关联
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                
                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="incoming_inspection",
                        source_id=inspection_id,
                        source_code=inspection.inspection_code,
                        source_name=None,
                        target_type="purchase_return",
                        target_id=ret_bill.id,
                        target_code=ret_bill.return_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="来料检验不合格生成采购退货单",
                    ),
                    created_by=created_by,
                )
            except Exception as rel_e:
                logger.warning(f"建立质检->采购退货单关联失败: {rel_e}")

            return {"return_id": ret_bill.id, "return_code": ret_bill.return_code}

    async def approve_inspection(self, tenant_id: int, inspection_id: int, approved_by: int, rejection_reason: Optional[str] = None) -> IncomingInspectionResponse:
        """审核检验单"""
        async with in_transaction():
            inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)

            if inspection.review_status != '待审核':
                raise BusinessLogicError("检验单审核状态不是待审核")

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await IncomingInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def create_inspection_from_purchase_receipt(
        self,
        tenant_id: int,
        purchase_receipt_id: int,
        created_by: int
    ) -> List[IncomingInspectionResponse]:
        """
        从采购入库单创建来料检验单
        
        为采购入库单的每个明细项创建一个来料检验单
        """
        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止从采购入库单下推来料检验")
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
        from apps.master_data.models.material import Material

        async with in_transaction():
            # 获取采购入库单
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
            if not receipt:
                raise NotFoundError(f"采购入库单不存在: {purchase_receipt_id}")
            
            # 允许「待入库」或「已入库」状态创建检验单，支持先检验后入库流程
            if receipt.status not in ('待入库', '已入库'):
                raise BusinessLogicError("只有待入库或已入库状态的采购入库单才能创建来料检验单")
            
            # 获取采购入库单明细
            receipt_items = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id,
                receipt_id=purchase_receipt_id
            ).all()
            
            if not receipt_items:
                raise BusinessLogicError("采购入库单没有明细项")

            mids = [it.material_id for it in receipt_items if it.material_id]
            mat_rows = await Material.filter(
                tenant_id=tenant_id, id__in=mids, deleted_at__isnull=True
            ).all()
            mat_by_id = {m.id: m for m in mat_rows}

            # 为每个明细项创建来料检验单
            inspections = []
            for item in receipt_items:
                # 检查是否已存在检验单
                existing = await IncomingInspection.filter(
                    tenant_id=tenant_id,
                    purchase_receipt_id=purchase_receipt_id,
                    material_id=item.material_id
                ).first()
                
                if existing:
                    # 如果已存在，跳过
                    continue

                mat = mat_by_id.get(item.material_id)
                eff, _, _reason = await resolve_inspection_policy(
                    tenant_id,
                    "iqc",
                    material_id=item.material_id,
                )
                if eff == "none":
                    continue

                template = await _resolve_inspection_template_fields(
                    tenant_id,
                    item.material_id,
                    "iqc",
                )
                
                # 创建检验单
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")
                
                inspection = await IncomingInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    purchase_receipt_id=purchase_receipt_id,
                    purchase_receipt_code=receipt.receipt_code,
                    supplier_id=receipt.supplier_id,
                    supplier_name=receipt.supplier_name,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=item.material_spec,
                    material_unit=item.material_unit,
                    inspection_quantity=item.receipt_quantity,
                    qualified_quantity=0,
                    unqualified_quantity=0,
                    inspection_result="待检验",
                    quality_status="待判定",
                    status="待检验",
                    created_by=created_by,
                    **template,
                )
                inspections.append(IncomingInspectionResponse.model_validate(inspection))

                # 建立采购入库→来料检验 的 DocumentRelation（支持单据追溯）
                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                    rel_svc = DocumentRelationNewService()
                    await rel_svc.create_relation(
                        tenant_id=tenant_id,
                        relation_data=DocumentRelationCreate(
                            source_type="purchase_receipt",
                            source_id=purchase_receipt_id,
                            source_code=receipt.receipt_code,
                            source_name=None,
                            target_type="incoming_inspection",
                            target_id=inspection.id,
                            target_code=inspection.inspection_code,
                            target_name=None,
                            relation_type="source",
                            relation_mode="push",
                            relation_desc="从采购入库单创建来料检验单",
                        ),
                        created_by=created_by,
                    )
                except Exception as rel_e:
                    logger.warning("创建采购入库→来料检验 单据关联失败: %s", rel_e)

            if not inspections:
                raise BusinessLogicError(
                    "未生成任何来料检验单：各明细可能已有检验单，或物料质检模式为无质检（与组织 IQC 总开关、业务参数「来料检验」共同生效）"
                )

            return inspections

    async def create_inspection_from_customer_material_registration(
        self,
        tenant_id: int,
        registration_id: int,
        created_by: int,
    ) -> List[IncomingInspectionResponse]:
        """从代工来料单创建来料检验单"""
        await _require_iqc_stage_enabled(tenant_id)
        incoming_enabled, _ = await _get_quality_policy_flags(tenant_id)
        if not incoming_enabled:
            raise BusinessLogicError("当前组织未开启来料检验，禁止从代工来料单下推来料检验")

        from apps.kuaizhizao.models.customer_material_registration import (
            CustomerMaterialRegistration,
            CustomerMaterialRegistrationItem,
        )
        from apps.kuaizhizao.services.customer_material_registration_service import (
            CustomerMaterialRegistrationService,
        )
        from apps.master_data.models.material import Material

        async with in_transaction():
            registration = await CustomerMaterialRegistration.get_or_none(
                tenant_id=tenant_id, id=registration_id, deleted_at__isnull=True
            )
            if not registration:
                raise NotFoundError(f"代工来料单不存在: {registration_id}")
            if registration.status not in ("pending", "processed"):
                raise BusinessLogicError("仅待入库或已入库状态的代工来料单可创建来料检验单")

            svc = CustomerMaterialRegistrationService()
            lines = await svc._effective_items(registration)
            if not lines:
                raise BusinessLogicError("代工来料单没有明细项")

            mids = [it.material_id for it in lines if it.material_id]
            mat_rows = await Material.filter(
                tenant_id=tenant_id, id__in=mids, deleted_at__isnull=True
            ).all()
            mat_by_id = {m.id: m for m in mat_rows}

            inspections = []
            for item in lines:
                existing = await IncomingInspection.filter(
                    tenant_id=tenant_id,
                    customer_material_registration_id=registration_id,
                    material_id=item.material_id,
                    deleted_at__isnull=True,
                ).first()
                if existing:
                    continue

                mat = mat_by_id.get(item.material_id)
                eff, _, _ = await resolve_inspection_policy(
                    tenant_id, "iqc", material_id=item.material_id
                )
                if eff == "none":
                    continue

                template = await _resolve_inspection_template_fields(
                    tenant_id, item.material_id, "iqc"
                )
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(
                    tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}"
                )
                inspection = await IncomingInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    source_type="customer_material_inbound",
                    customer_material_registration_id=registration_id,
                    customer_material_registration_code=registration.registration_code,
                    customer_id=registration.customer_id,
                    customer_name=registration.customer_name,
                    material_id=item.material_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    material_spec=getattr(mat, "specification", None) if mat else None,
                    material_unit=getattr(mat, "base_unit", None) or "件" if mat else "件",
                    inspection_quantity=item.quantity,
                    qualified_quantity=0,
                    unqualified_quantity=0,
                    inspection_result="待检验",
                    quality_status="待判定",
                    status="待检验",
                    created_by=created_by,
                    **template,
                )
                inspections.append(IncomingInspectionResponse.model_validate(inspection))

                try:
                    from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                    from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                    rel_svc = DocumentRelationNewService()
                    await rel_svc.create_relation(
                        tenant_id=tenant_id,
                        relation_data=DocumentRelationCreate(
                            source_type="customer_material_inbound",
                            source_id=registration_id,
                            source_code=registration.registration_code,
                            source_name=None,
                            target_type="incoming_inspection",
                            target_id=inspection.id,
                            target_code=inspection.inspection_code,
                            target_name=None,
                            relation_type="source",
                            relation_mode="push",
                            relation_desc="从代工来料单创建来料检验单",
                        ),
                        created_by=created_by,
                    )
                except Exception as rel_e:
                    logger.warning("创建代工来料→来料检验 单据关联失败: %s", rel_e)

            if not inspections:
                raise BusinessLogicError(
                    "未生成任何来料检验单：各明细可能已有检验单，或物料质检模式为无质检"
                )
            return inspections

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据导入来料检验单
        
        Args:
            tenant_id: 租户ID
            data: 二维数组数据（从uni_import组件传递）
            created_by: 创建人ID
            
        Returns:
            Dict: 导入结果
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")

        await _require_iqc_stage_enabled(tenant_id)

        # 解析表头（第一行）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射
        header_map = {
            '采购入库单号': 'purchase_receipt_code',
            '物料编码': 'material_code',
            '检验数量': 'inspection_quantity',
            '合格数量': 'qualified_quantity',
            '不合格数量': 'unqualified_quantity',
            '备注': 'notes',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header in header_map:
                header_index_map[header_map[header]] = idx
        
        if 'purchase_receipt_code' not in header_index_map or 'material_code' not in header_index_map:
            raise ValidationError("导入数据必须包含'采购入库单号'和'物料编码'字段")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        # 从第三行开始处理数据（跳过表头和示例行）
        for row_idx, row in enumerate(data[2:], start=3):
            try:
                # 获取采购入库单
                receipt_code = str(row[header_index_map['purchase_receipt_code']]).strip()
                from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
                receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, receipt_code=receipt_code)
                if not receipt:
                    raise ValidationError(f"采购入库单不存在: {receipt_code}")
                
                # 获取物料
                material_code = str(row[header_index_map['material_code']]).strip()
                from apps.master_data.models.material import Material
                material = await Material.get_or_none(tenant_id=tenant_id, material_code=material_code)
                if not material:
                    raise ValidationError(f"物料不存在: {material_code}")
                
                # 获取采购入库单明细
                from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
                receipt_item = await PurchaseReceiptItem.get_or_none(
                    tenant_id=tenant_id,
                    receipt_id=receipt.id,
                    material_id=material.id
                )
                if not receipt_item:
                    raise ValidationError(f"采购入库单中不存在该物料: {material_code}")
                
                # 检查是否已存在检验单
                existing = await IncomingInspection.filter(
                    tenant_id=tenant_id,
                    purchase_receipt_id=receipt.id,
                    material_id=material.id
                ).first()
                
                if existing:
                    continue  # 跳过已存在的检验单

                eff_iqc, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "iqc",
                    material_id=material.id,
                )
                if eff_iqc == "none":
                    continue

                # 创建检验单
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")
                
                inspection_quantity = float(row[header_index_map.get('inspection_quantity', -1)]) if header_index_map.get('inspection_quantity', -1) >= 0 and row[header_index_map.get('inspection_quantity', -1)] else receipt_item.receipt_quantity
                qualified_quantity = float(row[header_index_map.get('qualified_quantity', -1)]) if header_index_map.get('qualified_quantity', -1) >= 0 and row[header_index_map.get('qualified_quantity', -1)] else 0
                unqualified_quantity = float(row[header_index_map.get('unqualified_quantity', -1)]) if header_index_map.get('unqualified_quantity', -1) >= 0 and row[header_index_map.get('unqualified_quantity', -1)] else 0
                notes = str(row[header_index_map.get('notes', -1)]) if header_index_map.get('notes', -1) >= 0 and row[header_index_map.get('notes', -1)] else None
                
                await IncomingInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    purchase_receipt_id=receipt.id,
                    purchase_receipt_code=receipt.receipt_code,
                    supplier_id=receipt.supplier_id,
                    supplier_name=receipt.supplier_name,
                    material_id=material.id,
                    material_code=material.material_code,
                    material_name=material.material_name,
                    material_spec=material.material_spec,
                    material_unit=material.base_unit,
                    inspection_quantity=inspection_quantity,
                    qualified_quantity=qualified_quantity,
                    unqualified_quantity=unqualified_quantity,
                    inspection_result="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    quality_status="待判定" if qualified_quantity == 0 and unqualified_quantity == 0 else ("合格" if unqualified_quantity == 0 else "不合格"),
                    status="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    notes=notes,
                    created_by=created_by,
                )
                success_count += 1
            except Exception as e:
                failure_count += 1
                errors.append({
                    "row": row_idx,
                    "message": str(e)
                })
        
        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """
        导出来料检验单到Excel文件
        
        Args:
            tenant_id: 租户ID
            **filters: 过滤条件
            
        Returns:
            str: Excel文件路径
        """
        import csv
        import os
        import tempfile
        
        # 查询来料检验单
        inspections = await self.list_incoming_inspections(
            tenant_id=tenant_id,
            skip=0,
            limit=10000,
            **filters
        )
        
        # 创建导出目录
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"incoming_inspections_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        # 写入CSV文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            
            # 写入表头
            writer.writerow([
                '检验单号', '采购入库单号', '供应商', '物料编码', '物料名称',
                '检验数量', '合格数量', '不合格数量', '检验结果', '质量状态',
                '检验员', '检验时间', '审核人', '审核时间', '状态', '备注'
            ])
            
            # 写入数据
            for inspection in inspections:
                writer.writerow([
                    inspection.inspection_code,
                    inspection.purchase_receipt_code,
                    inspection.supplier_name,
                    inspection.material_code,
                    inspection.material_name,
                    str(inspection.inspection_quantity),
                    str(inspection.qualified_quantity),
                    str(inspection.unqualified_quantity),
                    inspection.inspection_result,
                    inspection.quality_status,
                    inspection.inspector_name or '',
                    inspection.inspection_time.strftime('%Y-%m-%d %H:%M:%S') if inspection.inspection_time else '',
                    inspection.reviewer_name or '',
                    inspection.review_time.strftime('%Y-%m-%d %H:%M:%S') if inspection.review_time else '',
                    inspection.status,
                    inspection.notes or '',
                ])
        
        return file_path


class ProcessInspectionService(AppBaseService[ProcessInspection]):
    """过程检验单服务"""

    def __init__(self):
        super().__init__(ProcessInspection)

    async def create_process_inspection(self, tenant_id: int, inspection_data: ProcessInspectionCreate, created_by: int) -> ProcessInspectionResponse:
        """创建过程检验单"""
        await _require_ipqc_stage_enabled(tenant_id)
        _, process_enabled = await _get_quality_policy_flags(tenant_id)
        if not process_enabled:
            raise BusinessLogicError("当前组织未开启过程检验，禁止创建过程检验单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")

            create_data = inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            template = await _resolve_inspection_template_fields(
                tenant_id,
                create_data.get("material_id"),
                "ipqc",
                operation_id=create_data.get("operation_id"),
                use_quality_characteristics=True,
            )
            for k, v in template.items():
                create_data.setdefault(k, v)
            from apps.kuaizhizao.constants import ReviewStatus
            audit_required = await _is_quality_audit_required(tenant_id, "process_inspection")
            if not audit_required:
                create_data["review_status"] = ReviewStatus.APPROVED

            inspection = await ProcessInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **create_data
            )
            return ProcessInspectionResponse.model_validate(inspection)

    async def get_process_inspection_by_id(self, tenant_id: int, inspection_id: int) -> ProcessInspectionResponse:
        """根据ID获取过程检验单"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_process_inspection_lifecycle,
            get_document_milestones
        )

        inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"过程检验单不存在: {inspection_id}")
        
        milestones = await get_document_milestones(tenant_id, "process_inspection", inspection_id)
        resp = ProcessInspectionResponse.model_validate(inspection)
        resp = resp.model_copy(update={"lifecycle": get_process_inspection_lifecycle(inspection, milestones=milestones)})
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "process_inspection", resp)

    async def list_process_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[ProcessInspectionListResponse]:
        """获取过程检验单列表"""
        query = ProcessInspection.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])
        if filters.get('operation_id'):
            query = query.filter(operation_id=filters['operation_id'])
        if filters.get("scoped_work_order_ids") is not None:
            query = query.filter(work_order_id__in=filters["scoped_work_order_ids"])

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        from core.services.approval.audit_record_enricher import enrich_items

        rows = [ProcessInspectionListResponse.model_validate(inspection) for inspection in inspections]
        return await enrich_items(tenant_id, "process_inspection", rows)

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> ProcessInspectionResponse:
        """执行过程检验"""
        async with in_transaction():
            inspection = await self.get_process_inspection_by_id(tenant_id, inspection_id)

            if inspection.status != '待检验':
                raise BusinessLogicError("只有待检验状态的检验单才能执行检验")

            inspector_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity = inspection_data.get('qualified_quantity', 0)
            unqualified_quantity = inspection_data.get('unqualified_quantity', 0)

            if qualified_quantity + unqualified_quantity != inspection.inspection_quantity:
                raise ValidationError("合格数量和不合格数量之和必须等于检验数量")

            quality_status = "合格" if unqualified_quantity == 0 else "不合格"

            conduct_payload = _apply_template_conduct_to_payload(
                inspection, "quality_characteristics", inspection_data
            )

            await ProcessInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                qualified_quantity=qualified_quantity,
                unqualified_quantity=unqualified_quantity,
                inspection_result="已检验",
                quality_status=quality_status,
                inspector_id=inspected_by,
                inspector_name=inspector_name,
                inspection_time=datetime.now(),
                status="已检验",
                updated_by=inspected_by,
                **conduct_payload
            )

            updated_inspection = await self.get_process_inspection_by_id(tenant_id, inspection_id)
            
            if updated_inspection.quality_status == "不合格" and updated_inspection.unqualified_quantity > 0:
                await _maybe_create_quality_exception_from_inspection(
                    tenant_id=tenant_id,
                    source_type="process_inspection",
                    source_id=inspection_id,
                    inspected_by=inspected_by,
                    problem_description=inspection_data.get("nonconformance_reason")
                    or f"过程检验不合格：{updated_inspection.inspection_code}",
                )

            measurement_data = inspection_data.get("measurement_data")
            if measurement_data:
                await _maybe_record_spc_samples_from_ipqc(
                    tenant_id=tenant_id,
                    inspection_id=inspection_id,
                    inspection_code=updated_inspection.inspection_code,
                    measurement_data=measurement_data,
                    user_id=inspected_by,
                )

            # 自动更新报工合格数
            if inspection.work_order_id:
                await self._update_reporting_qualified_quantity(
                    tenant_id=tenant_id,
                    work_order_id=inspection.work_order_id,
                    operation_id=inspection.operation_id,
                    qualified_quantity=qualified_quantity
                )
            
            return updated_inspection

    async def approve_inspection(
        self, tenant_id: int, inspection_id: int, approved_by: int, rejection_reason: Optional[str] = None
    ) -> ProcessInspectionResponse:
        """审核工序检验单"""
        async with in_transaction():
            inspection = await self.get_process_inspection_by_id(tenant_id, inspection_id)

            if inspection.review_status != '待审核':
                raise BusinessLogicError("工序检验单审核状态不是待审核")

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await ProcessInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            return await self.get_process_inspection_by_id(tenant_id, inspection_id)

    async def _update_reporting_qualified_quantity(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        qualified_quantity: Decimal
    ):
        """更新报工记录中的合格数量"""
        from apps.kuaizhizao.models.reporting_record import ReportingRecord
        
        # 查找对应的报工记录
        reporting = await ReportingRecord.filter(
            tenant_id=tenant_id,
            work_order_id=work_order_id,
            operation_id=operation_id,
            status='已报工'
        ).order_by('-created_at').first()
        
        if reporting:
            # 更新合格数量
            await ReportingRecord.filter(
                tenant_id=tenant_id,
                id=reporting.id
            ).update(
                qualified_quantity=qualified_quantity,
                updated_at=datetime.now()
            )
            logger.info(f"已更新报工记录合格数量: 工单{work_order_id}, 工序{operation_id}, 合格数{qualified_quantity}")

    async def create_inspection_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        operation_id: int,
        created_by: int,
        reporting_record_id: Optional[int] = None,
    ) -> ProcessInspectionResponse:
        """
        从工单和工序创建过程检验单
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            operation_id: 工序ID
            created_by: 创建人ID
            
        Returns:
            ProcessInspectionResponse: 创建的过程检验单
        """
        await _require_ipqc_stage_enabled(tenant_id)
        _, process_enabled = await _get_quality_policy_flags(tenant_id)
        if not process_enabled:
            raise BusinessLogicError("当前组织未开启过程检验，禁止从工单下推过程检验")
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.master_data.models.material import Material
        from apps.master_data.models.process import Operation as MasterOperation

        async with in_transaction():
            # 获取工单
            work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
            )
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")

            # operation_id 与报工一致：主数据工序 ID；兼容传入工单工序行主键
            woo = await WorkOrderOperation.get_or_none(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
                deleted_at__isnull=True,
            )
            master_op_id = operation_id
            if not woo:
                woo = await WorkOrderOperation.get_or_none(
                    tenant_id=tenant_id,
                    work_order_id=work_order_id,
                    id=operation_id,
                    deleted_at__isnull=True,
                )
                if woo:
                    master_op_id = int(woo.operation_id)
            if not woo:
                raise NotFoundError(
                    f"工单工序不存在: 工单ID={work_order_id}, 工序ID={operation_id}"
                )

            master_op = await MasterOperation.get_or_none(
                tenant_id=tenant_id, id=master_op_id, deleted_at__isnull=True
            )
            wf = _work_order_product_fields(work_order)
            mid = wf.get("material_id")
            mat = None
            if mid:
                mat = await Material.get_or_none(
                    tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                )

            eff, _, _reason = await resolve_inspection_policy(
                tenant_id,
                "ipqc",
                material_id=mid,
                operation_id=master_op_id,
            )
            if eff == "none":
                raise BusinessLogicError(
                    "当前工单工序未配置过程检验（工序/成品质检模式均为无质检），无需下推过程检验单"
                )

            if reporting_record_id:
                existing_by_report = await ProcessInspection.filter(
                    tenant_id=tenant_id,
                    reporting_record_id=reporting_record_id,
                    deleted_at__isnull=True,
                ).first()
                if existing_by_report:
                    return ProcessInspectionResponse.model_validate(existing_by_report)

            # 检查是否已存在检验单（与报工相同的工序主键）
            existing = await ProcessInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=master_op_id,
                status='待检验'
            ).first()
            
            if existing:
                raise BusinessLogicError("该工单和工序已存在待检验的检验单")
            
            # 创建检验单
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")
            
            # 获取报工数量作为检验数量
            from apps.kuaizhizao.models.reporting_record import ReportingRecord
            reporting = await ReportingRecord.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=master_op_id
            ).order_by('-created_at').first()
            
            planned_qty = wf.get("planned_qty") or work_order.quantity
            inspection_quantity = reporting.completed_quantity if reporting else planned_qty

            template = await _resolve_inspection_template_fields(
                tenant_id,
                wf["material_id"],
                "ipqc",
                operation_id=master_op_id,
                use_quality_characteristics=True,
            )
            
            inspection = await ProcessInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                reporting_record_id=reporting_record_id,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                operation_id=master_op_id,
                operation_code=woo.operation_code,
                operation_name=woo.operation_name,
                workshop_id=work_order.workshop_id,
                workshop_name=work_order.workshop_name,
                material_id=wf["material_id"],
                material_code=wf["material_code"],
                material_name=wf["material_name"],
                material_spec=wf["material_spec"],
                batch_number=wf["batch_number"],
                inspection_quantity=inspection_quantity,
                qualified_quantity=0,
                unqualified_quantity=0,
                inspection_result="待检验",
                quality_status="待判定",
                status="待检验",
                created_by=created_by,
                **template,
            )
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="process_inspection",
                        target_id=inspection.id,
                        target_code=inspection.inspection_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单创建过程检验单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→过程检验 单据关联失败: %s", e)
            return ProcessInspectionResponse.model_validate(inspection)

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从二维数组数据导入过程检验单"""
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        header_map = {
            '工单编码': 'work_order_code',
            '工序编码': 'operation_code',
            '检验数量': 'inspection_quantity',
            '合格数量': 'qualified_quantity',
            '不合格数量': 'unqualified_quantity',
            '备注': 'notes',
        }
        
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header in header_map:
                header_index_map[header_map[header]] = idx
        
        if 'work_order_code' not in header_index_map or 'operation_code' not in header_index_map:
            raise ValidationError("导入数据必须包含'工单编码'和'工序编码'字段")

        await _require_ipqc_stage_enabled(tenant_id)

        success_count = 0
        failure_count = 0
        errors = []

        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
        from apps.master_data.models.material import Material
        from apps.master_data.models.process import Operation as MasterOperation

        for row_idx, row in enumerate(data[2:], start=3):
            try:
                work_order_code = str(row[header_index_map['work_order_code']]).strip()
                work_order = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, code=work_order_code, deleted_at__isnull=True
                )
                if not work_order:
                    raise ValidationError(f"工单不存在: {work_order_code}")

                operation_code = str(row[header_index_map['operation_code']]).strip()
                woo = await WorkOrderOperation.get_or_none(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    operation_code=operation_code,
                    deleted_at__isnull=True,
                )
                if not woo:
                    raise ValidationError(f"工单上不存在工序编码: {operation_code}")

                master_op_id = int(woo.operation_id)
                master_op = await MasterOperation.get_or_none(
                    tenant_id=tenant_id, id=master_op_id, deleted_at__isnull=True
                )
                wf = _work_order_product_fields(work_order)
                mid = wf.get("material_id")
                mat = None
                if mid:
                    mat = await Material.get_or_none(
                        tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                    )

                eff, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "ipqc",
                    material_id=mid,
                    operation_id=master_op_id,
                )
                if eff == "none":
                    continue

                existing = await ProcessInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    operation_id=master_op_id,
                ).first()

                if existing:
                    continue

                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")

                base_qty = wf.get("planned_qty") or work_order.quantity
                inspection_quantity = (
                    float(row[header_index_map.get('inspection_quantity', -1)])
                    if header_index_map.get('inspection_quantity', -1) >= 0
                    and row[header_index_map.get('inspection_quantity', -1)]
                    else base_qty
                )
                qualified_quantity = float(row[header_index_map.get('qualified_quantity', -1)]) if header_index_map.get('qualified_quantity', -1) >= 0 and row[header_index_map.get('qualified_quantity', -1)] else 0
                unqualified_quantity = float(row[header_index_map.get('unqualified_quantity', -1)]) if header_index_map.get('unqualified_quantity', -1) >= 0 and row[header_index_map.get('unqualified_quantity', -1)] else 0
                notes = str(row[header_index_map.get('notes', -1)]) if header_index_map.get('notes', -1) >= 0 and row[header_index_map.get('notes', -1)] else None

                await ProcessInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    work_order_id=work_order.id,
                    work_order_code=work_order.code,
                    operation_id=master_op_id,
                    operation_code=woo.operation_code,
                    operation_name=woo.operation_name,
                    workshop_id=work_order.workshop_id,
                    workshop_name=work_order.workshop_name,
                    material_id=wf["material_id"],
                    material_code=wf["material_code"],
                    material_name=wf["material_name"],
                    material_spec=wf["material_spec"],
                    batch_number=wf["batch_number"],
                    inspection_quantity=inspection_quantity,
                    qualified_quantity=qualified_quantity,
                    unqualified_quantity=unqualified_quantity,
                    inspection_result="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    quality_status="待判定" if qualified_quantity == 0 and unqualified_quantity == 0 else ("合格" if unqualified_quantity == 0 else "不合格"),
                    status="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    notes=notes,
                    created_by=created_by,
                )
                success_count += 1
            except Exception as e:
                failure_count += 1
                errors.append({"row": row_idx, "message": str(e)})

        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """导出过程检验单到Excel文件"""
        import csv
        import os
        import tempfile
        
        inspections = await self.list_process_inspections(
            tenant_id=tenant_id,
            skip=0,
            limit=10000,
            **filters
        )
        
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"process_inspections_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '检验单号', '工单编码', '工序名称', '物料编码', '物料名称',
                '检验数量', '合格数量', '不合格数量', '检验结果', '质量状态',
                '检验员', '检验时间', '状态', '备注'
            ])
            
            for inspection in inspections:
                writer.writerow([
                    inspection.inspection_code,
                    inspection.work_order_code,
                    inspection.operation_name,
                    inspection.material_code,
                    inspection.material_name,
                    str(inspection.inspection_quantity),
                    str(inspection.qualified_quantity),
                    str(inspection.unqualified_quantity),
                    inspection.inspection_result,
                    inspection.quality_status,
                    inspection.inspector_name or '',
                    inspection.inspection_time.strftime('%Y-%m-%d %H:%M:%S') if inspection.inspection_time else '',
                    inspection.status,
                    inspection.notes or '',
                ])
        
        return file_path


class FinishedGoodsInspectionService(AppBaseService[FinishedGoodsInspection]):
    """成品检验单服务"""

    def __init__(self):
        super().__init__(FinishedGoodsInspection)

    async def create_finished_goods_inspection(self, tenant_id: int, inspection_data: FinishedGoodsInspectionCreate, created_by: int) -> FinishedGoodsInspectionResponse:
        """创建成品检验单"""
        await _require_fqc_stage_enabled(tenant_id)
        finished_enabled = await _is_finished_inspection_enabled(tenant_id)
        if not finished_enabled:
            raise BusinessLogicError("当前组织未开启成品检验，禁止创建成品检验单")
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

            create_data = inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            template = await _resolve_inspection_template_fields(
                tenant_id,
                create_data.get("material_id"),
                "fqc",
            )
            for k, v in template.items():
                create_data.setdefault(k, v)
            from apps.kuaizhizao.constants import ReviewStatus
            audit_required = await _is_quality_audit_required(tenant_id, "finished_goods_inspection")
            if not audit_required:
                create_data["review_status"] = ReviewStatus.APPROVED

            inspection = await FinishedGoodsInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **create_data
            )
            return FinishedGoodsInspectionResponse.model_validate(inspection)

    async def get_finished_goods_inspection_by_id(self, tenant_id: int, inspection_id: int) -> FinishedGoodsInspectionResponse:
        """根据ID获取成品检验单"""
        from apps.kuaizhizao.services.document_lifecycle_service import (
            get_finished_goods_inspection_lifecycle,
            get_document_milestones
        )

        inspection = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"成品检验单不存在: {inspection_id}")
        
        milestones = await get_document_milestones(tenant_id, "finished_goods_inspection", inspection_id)
        resp = FinishedGoodsInspectionResponse.model_validate(inspection)
        resp = resp.model_copy(update={"lifecycle": get_finished_goods_inspection_lifecycle(inspection, milestones=milestones)})
        from core.services.approval.audit_record_enricher import enrich_record

        return await enrich_record(tenant_id, "finished_goods_inspection", resp)

    async def list_finished_goods_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[FinishedGoodsInspectionListResponse]:
        """获取成品检验单列表"""
        query = FinishedGoodsInspection.filter(tenant_id=tenant_id)

        # 应用过滤条件
        if filters.get('status'):
            query = query.filter(status=filters['status'])
        if filters.get('quality_status'):
            query = query.filter(quality_status=filters['quality_status'])
        if filters.get('work_order_id'):
            query = query.filter(work_order_id=filters['work_order_id'])
        if filters.get('source_type'):
            query = query.filter(source_type=filters['source_type'])
        if filters.get("scoped_work_order_ids") is not None:
            query = query.filter(work_order_id__in=filters["scoped_work_order_ids"])

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        from core.services.approval.audit_record_enricher import enrich_items

        rows = [FinishedGoodsInspectionListResponse.model_validate(inspection) for inspection in inspections]
        return await enrich_items(tenant_id, "finished_goods_inspection", rows)

    async def conduct_inspection(self, tenant_id: int, inspection_id: int, inspection_data: dict, inspected_by: int) -> FinishedGoodsInspectionResponse:
        """执行成品检验"""
        async with in_transaction():
            inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if inspection.status != '待检验':
                raise BusinessLogicError("只有待检验状态的检验单才能执行检验")

            inspector_name = await self.get_user_name(inspected_by)

            # 计算合格/不合格数量
            qualified_quantity = inspection_data.get('qualified_quantity', 0)
            unqualified_quantity = inspection_data.get('unqualified_quantity', 0)

            if qualified_quantity + unqualified_quantity != inspection.inspection_quantity:
                raise ValidationError("合格数量和不合格数量之和必须等于检验数量")

            quality_status = "合格" if unqualified_quantity == 0 else "不合格"

            conduct_payload = _apply_template_conduct_to_payload(
                inspection, "other_checks", inspection_data
            )

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                qualified_quantity=qualified_quantity,
                unqualified_quantity=unqualified_quantity,
                inspection_result="已检验",
                quality_status=quality_status,
                inspector_id=inspected_by,
                inspector_name=inspector_name,
                inspection_time=datetime.now(),
                status="已检验",
                updated_by=inspected_by,
                **conduct_payload
            )

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if updated_inspection.quality_status == "不合格" and updated_inspection.unqualified_quantity > 0:
                await _maybe_create_quality_exception_from_inspection(
                    tenant_id=tenant_id,
                    source_type="finished_goods_inspection",
                    source_id=inspection_id,
                    inspected_by=inspected_by,
                    problem_description=inspection_data.get("nonconformance_reason")
                    or f"成品检验不合格：{updated_inspection.inspection_code}",
                )

            return updated_inspection

    async def approve_inspection(
        self, tenant_id: int, inspection_id: int, approved_by: int, rejection_reason: Optional[str] = None
    ) -> FinishedGoodsInspectionResponse:
        """审核成品检验单"""
        async with in_transaction():
            inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if inspection.review_status != '待审核':
                raise BusinessLogicError("成品检验单审核状态不是待审核")

            approver_name = await self.get_user_name(approved_by)

            review_status = "驳回" if rejection_reason else "通过"
            status = "已驳回" if rejection_reason else "已审核"

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                reviewer_id=approved_by,
                reviewer_name=approver_name,
                review_time=datetime.now(),
                review_status=review_status,
                review_remarks=rejection_reason,
                status=status,
                updated_by=approved_by
            )

            return await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

    async def issue_certificate(self, tenant_id: int, inspection_id: int, certificate_number: str, issued_by: int) -> FinishedGoodsInspectionResponse:
        """出具放行证书"""
        async with in_transaction():
            inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)

            if inspection.quality_status != '合格':
                raise BusinessLogicError("只有合格的成品才能出具放行证书")

            if inspection.certificate_issued:
                raise BusinessLogicError("该检验单已出具放行证书")

            await FinishedGoodsInspection.filter(tenant_id=tenant_id, id=inspection_id).update(
                release_certificate=certificate_number,
                certificate_issued=True,
                updated_by=issued_by
            )

            # 自动推送至成品/半成品入库（待审核/待入库状态，按 BOM 子件角色分流）
            try:
                if inspection.qualified_quantity > 0:
                    from apps.kuaizhizao.services.warehouse_service import FinishedGoodsReceiptService
                    from apps.kuaizhizao.services.semi_finished_goods_receipt_service import (
                        SemiFinishedGoodsReceiptService,
                    )
                    from apps.kuaizhizao.schemas.warehouse import (
                        FinishedGoodsReceiptCreate,
                        FinishedGoodsReceiptItemCreate,
                        SemiFinishedGoodsReceiptCreate,
                        SemiFinishedGoodsReceiptItemCreate,
                    )
                    from apps.kuaizhizao.models.work_order import WorkOrder
                    from apps.kuaizhizao.services.work_order_inbound_bom_role import (
                        is_semi_finished_product_by_bom_role,
                    )

                    wo = await WorkOrder.get_or_none(
                        tenant_id=tenant_id,
                        id=inspection.work_order_id,
                        deleted_at__isnull=True,
                    )
                    wh_id: Optional[int] = None
                    wh_name: str = ""
                    if wo:
                        resolved = await FinishedGoodsReceiptService().resolve_default_inbound_warehouse_for_work_order(
                            tenant_id=tenant_id,
                            work_order=wo,
                        )
                        if resolved:
                            wh_id, wh_name = resolved[0], resolved[1]

                    from apps.master_data.models.material import Material as _Mat

                    mat = await _Mat.get_or_none(
                        tenant_id=tenant_id, id=inspection.material_id, deleted_at__isnull=True
                    )
                    material_unit = (getattr(mat, "base_unit", None) or "个") if mat else "个"

                    use_semi = await is_semi_finished_product_by_bom_role(tenant_id, inspection.material_id)
                    if use_semi:
                        sf_svc = SemiFinishedGoodsReceiptService()
                        receipt_data = SemiFinishedGoodsReceiptCreate(
                            work_order_id=inspection.work_order_id,
                            work_order_code=inspection.work_order_code,
                            sales_order_id=inspection.sales_order_id,
                            sales_order_code=inspection.sales_order_code,
                            warehouse_id=wh_id or 0,
                            warehouse_name=wh_name or "",
                            receipt_time=datetime.now(),
                            status="待入库",
                            notes=f"由成品检验单 {inspection.inspection_code} 合格放行自动生成（半成品入库）",
                        )
                        if not wh_id:
                            logger.warning(
                                "成品检验自动生成半成品入库单跳过：未解析到默认仓库 inspection=%s",
                                inspection.inspection_code,
                            )
                        else:
                            item_data = SemiFinishedGoodsReceiptItemCreate(
                                material_id=inspection.material_id,
                                material_code=inspection.material_code,
                                material_name=inspection.material_name,
                                material_unit=material_unit,
                                receipt_quantity=inspection.qualified_quantity,
                                qualified_quantity=inspection.qualified_quantity,
                                unqualified_quantity=0,
                                batch_number=inspection.batch_number,
                                quality_inspection_id=inspection.id,
                                quality_status="合格",
                            )
                            await sf_svc.create_semi_finished_goods_receipt(
                                tenant_id=tenant_id,
                                receipt_data=receipt_data,
                                created_by=issued_by,
                                items=[item_data],
                            )
                            logger.info(
                                f"成品检验合格 -> 自动生成半成品入库单成功: {inspection.inspection_code}"
                            )
                    else:
                        wh_svc = FinishedGoodsReceiptService()
                        receipt_data = FinishedGoodsReceiptCreate(
                            work_order_id=inspection.work_order_id,
                            work_order_code=inspection.work_order_code,
                            sales_order_id=inspection.sales_order_id,
                            sales_order_code=inspection.sales_order_code,
                            warehouse_id=wh_id or 0,
                            warehouse_name=wh_name or "",
                            receipt_time=datetime.now(),
                            status="待入库",
                            notes=f"由成品检验单 {inspection.inspection_code} 合格放行自动生成",
                        )
                        if not wh_id:
                            logger.warning(
                                "成品检验自动生成成品入库单跳过：未解析到默认仓库 inspection=%s",
                                inspection.inspection_code,
                            )
                        else:
                            item_data = FinishedGoodsReceiptItemCreate(
                                material_id=inspection.material_id,
                                material_code=inspection.material_code,
                                material_name=inspection.material_name,
                                material_unit=material_unit,
                                receipt_quantity=inspection.qualified_quantity,
                                qualified_quantity=inspection.qualified_quantity,
                                unqualified_quantity=0,
                                batch_number=inspection.batch_number,
                                quality_inspection_id=inspection.id,
                                quality_status="合格",
                            )
                            await wh_svc.create_finished_goods_receipt(
                                tenant_id=tenant_id,
                                receipt_data=receipt_data,
                                created_by=issued_by,
                                items=[item_data],
                            )
                            logger.info(
                                f"成品检验合格 -> 自动生成成品入库单成功: {inspection.inspection_code}"
                            )
            except Exception as e:
                logger.warning(f"成品检验合格 -> 自动生成成品入库单失败: {e}")

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

    async def push_to_rework(self, tenant_id: int, inspection_id: int, created_by: int) -> dict:
        """成品检验不合格 -> 一键生成返工单"""
        async with in_transaction():
            inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)
            
            if inspection.quality_status != '不合格':
                raise BusinessLogicError("只有不合格的成品检验单才能下推返工单")
            
            if inspection.unqualified_quantity <= 0:
                raise BusinessLogicError("不合格数量为0，无需返工")

            from apps.kuaizhizao.services.rework_order_service import ReworkOrderService
            from apps.kuaizhizao.schemas.rework_order import ReworkOrderCreate
            
            rework_svc = ReworkOrderService()
            
            # 生成返工单
            rework_data = ReworkOrderCreate(
                original_work_order_id=inspection.work_order_id,
                original_work_order_uuid=None, 
                product_id=inspection.material_id,
                product_code=inspection.material_code,
                product_name=inspection.material_name,
                quantity=inspection.unqualified_quantity,
                rework_reason=inspection.nonconformance_reason or "质量检验不合格",
                rework_type="internal",
                remarks=f"由成品检验单 {inspection.inspection_code} 不合格项自动生成"
            )
            
            rework_order = await rework_svc.create_rework_order(
                tenant_id=tenant_id,
                rework_order_data=rework_data,
                created_by=created_by
            )
            
            # 建立 质检 -> 返工单 的关联
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate
                
                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="finished_goods_inspection",
                        source_id=inspection_id,
                        source_code=inspection.inspection_code,
                        source_name=None,
                        target_type="rework_order",
                        target_id=rework_order.id,
                        target_code=rework_order.code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="成品检验不合格生成返工单",
                    ),
                    created_by=created_by,
                )
            except Exception as rel_e:
                logger.warning(f"建立质检->返工单关联失败: {rel_e}")

            return {"rework_order_id": rework_order.id, "rework_order_code": rework_order.code}

    async def create_inspection_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int,
        reporting_record_id: Optional[int] = None,
    ) -> FinishedGoodsInspectionResponse:
        """
        从工单创建成品检验单
        
        Args:
            tenant_id: 租户ID
            work_order_id: 工单ID
            created_by: 创建人ID
            
        Returns:
            FinishedGoodsInspectionResponse: 创建的成品检验单
        """
        await _require_fqc_stage_enabled(tenant_id)
        finished_enabled = await _is_finished_inspection_enabled(tenant_id)
        if not finished_enabled:
            raise BusinessLogicError("当前组织未开启成品检验，禁止从工单下推成品检验")
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.material import Material

        async with in_transaction():
            # 获取工单
            work_order = await WorkOrder.get_or_none(
                tenant_id=tenant_id, id=work_order_id, deleted_at__isnull=True
            )
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")

            wf = _work_order_product_fields(work_order)
            mid = wf.get("material_id")
            mat = None
            if mid:
                mat = await Material.get_or_none(
                    tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                )

            eff, _, _ = await resolve_inspection_policy(
                tenant_id,
                "fqc",
                material_id=mid,
            )
            if eff == "none":
                raise BusinessLogicError(
                    "当前成品物料未配置成品检验（质检模式为无质检），无需下推成品检验单"
                )

            if reporting_record_id:
                existing_by_report = await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    reporting_record_id=reporting_record_id,
                    deleted_at__isnull=True,
                ).first()
                if existing_by_report:
                    return FinishedGoodsInspectionResponse.model_validate(existing_by_report)
            
            # 检查是否已存在检验单
            existing = await FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                status='待检验'
            ).first()
            
            if existing:
                raise BusinessLogicError("该工单已存在待检验的检验单")
            
            # 创建检验单
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

            inspection_qty = wf.get("planned_qty") or work_order.quantity

            template = await _resolve_inspection_template_fields(
                tenant_id,
                wf["material_id"],
                "fqc",
            )
            
            inspection = await FinishedGoodsInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                reporting_record_id=reporting_record_id,
                source_type="work_order",
                source_id=work_order_id,
                source_code=work_order.code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                sales_order_id=work_order.sales_order_id,
                sales_order_code=work_order.sales_order_code,
                customer_id=getattr(work_order, "customer_id", None),
                customer_name=getattr(work_order, "customer_name", None),
                material_id=wf["material_id"],
                material_code=wf["material_code"],
                material_name=wf["material_name"],
                material_spec=wf["material_spec"],
                batch_number=wf["batch_number"],
                inspection_quantity=inspection_qty,
                qualified_quantity=0,
                unqualified_quantity=0,
                inspection_result="待检验",
                quality_status="待判定",
                status="待检验",
                created_by=created_by,
                **template,
            )
            # 建立工单→成品检验 的 DocumentRelation
            try:
                from apps.kuaizhizao.services.document_relation_new_service import DocumentRelationNewService
                from apps.kuaizhizao.schemas.document_relation import DocumentRelationCreate

                rel_svc = DocumentRelationNewService()
                await rel_svc.create_relation(
                    tenant_id=tenant_id,
                    relation_data=DocumentRelationCreate(
                        source_type="work_order",
                        source_id=work_order_id,
                        source_code=work_order.code,
                        source_name=work_order.name,
                        target_type="finished_goods_inspection",
                        target_id=inspection.id,
                        target_code=inspection.inspection_code,
                        target_name=None,
                        relation_type="source",
                        relation_mode="push",
                        relation_desc="工单创建成品检验单",
                    ),
                    created_by=created_by,
                )
            except Exception as e:
                logger.warning("建立工单→成品检验 单据关联失败: %s", e)
            return FinishedGoodsInspectionResponse.model_validate(inspection)

    async def import_from_data(
        self,
        tenant_id: int,
        data: List[List[Any]],
        created_by: int
    ) -> Dict[str, Any]:
        """从二维数组数据导入成品检验单"""
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        header_map = {
            '工单编码': 'work_order_code',
            '检验数量': 'inspection_quantity',
            '合格数量': 'qualified_quantity',
            '不合格数量': 'unqualified_quantity',
            '备注': 'notes',
        }
        
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header in header_map:
                header_index_map[header_map[header]] = idx
        
        if 'work_order_code' not in header_index_map:
            raise ValidationError("导入数据必须包含'工单编码'字段")

        await _require_fqc_stage_enabled(tenant_id)

        success_count = 0
        failure_count = 0
        errors = []

        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.material import Material

        for row_idx, row in enumerate(data[2:], start=3):
            try:
                work_order_code = str(row[header_index_map['work_order_code']]).strip()
                work_order = await WorkOrder.get_or_none(
                    tenant_id=tenant_id, code=work_order_code, deleted_at__isnull=True
                )
                if not work_order:
                    raise ValidationError(f"工单不存在: {work_order_code}")

                wf = _work_order_product_fields(work_order)
                mid = wf.get("material_id")
                mat = None
                if mid:
                    mat = await Material.get_or_none(
                        tenant_id=tenant_id, id=mid, deleted_at__isnull=True
                    )

                eff, _, _ = await resolve_inspection_policy(
                    tenant_id,
                    "fqc",
                    material_id=mid,
                )
                if eff == "none":
                    continue

                existing = await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id
                ).first()

                if existing:
                    continue

                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

                base_qty = wf.get("planned_qty") or work_order.quantity
                inspection_quantity = (
                    float(row[header_index_map.get('inspection_quantity', -1)])
                    if header_index_map.get('inspection_quantity', -1) >= 0
                    and row[header_index_map.get('inspection_quantity', -1)]
                    else base_qty
                )
                qualified_quantity = float(row[header_index_map.get('qualified_quantity', -1)]) if header_index_map.get('qualified_quantity', -1) >= 0 and row[header_index_map.get('qualified_quantity', -1)] else 0
                unqualified_quantity = float(row[header_index_map.get('unqualified_quantity', -1)]) if header_index_map.get('unqualified_quantity', -1) >= 0 and row[header_index_map.get('unqualified_quantity', -1)] else 0
                notes = str(row[header_index_map.get('notes', -1)]) if header_index_map.get('notes', -1) >= 0 and row[header_index_map.get('notes', -1)] else None

                await FinishedGoodsInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    source_type="work_order",
                    source_id=work_order.id,
                    source_code=work_order.code,
                    work_order_id=work_order.id,
                    work_order_code=work_order.code,
                    sales_order_id=work_order.sales_order_id,
                    sales_order_code=work_order.sales_order_code,
                    customer_id=getattr(work_order, "customer_id", None),
                    customer_name=getattr(work_order, "customer_name", None),
                    material_id=wf["material_id"],
                    material_code=wf["material_code"],
                    material_name=wf["material_name"],
                    material_spec=wf["material_spec"],
                    batch_number=wf["batch_number"],
                    inspection_quantity=inspection_quantity,
                    qualified_quantity=qualified_quantity,
                    unqualified_quantity=unqualified_quantity,
                    inspection_result="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    quality_status="待判定" if qualified_quantity == 0 and unqualified_quantity == 0 else ("合格" if unqualified_quantity == 0 else "不合格"),
                    status="待检验" if qualified_quantity == 0 and unqualified_quantity == 0 else "已检验",
                    notes=notes,
                    created_by=created_by,
                )
                success_count += 1
            except Exception as e:
                failure_count += 1
                errors.append({"row": row_idx, "message": str(e)})

        return {
            "success": True,
            "message": f"导入完成：成功 {success_count} 条，失败 {failure_count} 条",
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors
        }

    async def export_to_excel(
        self,
        tenant_id: int,
        **filters
    ) -> str:
        """导出成品检验单到Excel文件"""
        import csv
        import os
        import tempfile
        
        inspections = await self.list_finished_goods_inspections(
            tenant_id=tenant_id,
            skip=0,
            limit=10000,
            **filters
        )
        
        export_dir = os.path.join(tempfile.gettempdir(), 'riveredge_exports')
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"finished_goods_inspections_{timestamp}.csv"
        file_path = os.path.join(export_dir, filename)
        
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '检验单号', '工单编码', '物料编码', '物料名称',
                '检验数量', '合格数量', '不合格数量', '检验结果', '质量状态',
                '检验员', '检验时间', '状态', '备注'
            ])
            
            for inspection in inspections:
                writer.writerow([
                    inspection.inspection_code,
                    inspection.work_order_code,
                    inspection.material_code,
                    inspection.material_name,
                    str(inspection.inspection_quantity),
                    str(inspection.qualified_quantity),
                    str(inspection.unqualified_quantity),
                    inspection.inspection_result,
                    inspection.quality_status,
                    inspection.inspector_name or '',
                    inspection.inspection_time.strftime('%Y-%m-%d %H:%M:%S') if inspection.inspection_time else '',
                    inspection.status,
                    inspection.notes or '',
                ])
        
        return file_path

    # ============ 质量异常检测和统计分析 ============

    async def get_quality_anomalies(
        self,
        tenant_id: int,
        inspection_type: Optional[str] = None,  # "incoming", "process", "finished"
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        material_id: Optional[int] = None,
        supplier_id: Optional[int] = None,
        limit: int = 100,
    ) -> List[dict]:
        """
        查询质量异常记录（不合格的检验单）

        Args:
            tenant_id: 租户ID
            inspection_type: 检验类型（可选：incoming/process/finished）
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            supplier_id: 供应商ID（可选，仅用于来料检验）
            limit: 返回条数上限（全类型合并排序后截取）

        Returns:
            List[dict]: 质量异常记录列表
        """
        anomalies = []

        # 查询来料检验异常
        if inspection_type is None or inspection_type == "incoming":
            query = IncomingInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)
            if supplier_id:
                query = query.filter(supplier_id=supplier_id)

            incoming_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in incoming_anomalies:
                anomalies.append({
                    "inspection_type": "incoming",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "supplier_id": inspection.supplier_id,
                    "supplier_name": inspection.supplier_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None
                })

        # 查询过程检验异常
        if inspection_type is None or inspection_type == "process":
            query = ProcessInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            process_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in process_anomalies:
                anomalies.append({
                    "inspection_type": "process",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "work_order_id": inspection.work_order_id,
                    "work_order_code": inspection.work_order_code,
                    "operation_id": inspection.operation_id,
                    "operation_name": inspection.operation_name,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None
                })

        # 查询成品检验异常
        if inspection_type is None or inspection_type == "finished":
            query = FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                quality_status="不合格",
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            finished_anomalies = await query.order_by("-inspection_time").limit(100).all()
            for inspection in finished_anomalies:
                anomalies.append({
                    "inspection_type": "finished",
                    "inspection_id": inspection.id,
                    "inspection_code": inspection.inspection_code,
                    "work_order_id": inspection.work_order_id,
                    "work_order_code": inspection.work_order_code,
                    "material_id": inspection.material_id,
                    "material_code": inspection.material_code,
                    "material_name": inspection.material_name,
                    "inspection_quantity": float(inspection.inspection_quantity),
                    "qualified_quantity": float(inspection.qualified_quantity),
                    "unqualified_quantity": float(inspection.unqualified_quantity),
                    "quality_status": inspection.quality_status,
                    "nonconformance_reason": inspection.nonconformance_reason,
                    "inspection_time": inspection.inspection_time.isoformat() if inspection.inspection_time else None
                })

        # 按检验时间降序排序
        anomalies.sort(key=lambda x: x.get("inspection_time") or "", reverse=True)
        return anomalies[: max(1, min(limit, 500))]

    async def get_quality_statistics(
        self,
        tenant_id: int,
        inspection_type: Optional[str] = None,  # "incoming", "process", "finished"
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        material_id: Optional[int] = None,
        supplier_id: Optional[int] = None
    ) -> dict:
        """
        获取质量统计分析

        Args:
            tenant_id: 租户ID
            inspection_type: 检验类型（可选：incoming/process/finished）
            start_date: 开始日期（可选）
            end_date: 结束日期（可选）
            material_id: 物料ID（可选）
            supplier_id: 供应商ID（可选，仅用于来料检验）

        Returns:
            dict: 质量统计数据
        """
        stats = {
            "total_inspections": 0,
            "total_quantity": Decimal(0),
            "qualified_quantity": Decimal(0),
            "unqualified_quantity": Decimal(0),
            "by_type": {}
        }

        # 统计来料检验
        if inspection_type is None or inspection_type == "incoming":
            query = IncomingInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)
            if supplier_id:
                query = query.filter(supplier_id=supplier_id)

            incoming_inspections = await query.all()
            incoming_stats = {
                "total_inspections": len(incoming_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in incoming_inspections:
                incoming_stats["total_quantity"] += inspection.inspection_quantity
                incoming_stats["qualified_quantity"] += inspection.qualified_quantity
                incoming_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if incoming_stats["total_quantity"] > 0:
                incoming_stats["qualified_rate"] = float(
                    incoming_stats["qualified_quantity"] / incoming_stats["total_quantity"] * 100
                )
                incoming_stats["unqualified_rate"] = float(
                    incoming_stats["unqualified_quantity"] / incoming_stats["total_quantity"] * 100
                )
            else:
                incoming_stats["qualified_rate"] = 0.0
                incoming_stats["unqualified_rate"] = 0.0

            stats["by_type"]["incoming"] = incoming_stats
            stats["total_inspections"] += incoming_stats["total_inspections"]
            stats["total_quantity"] += incoming_stats["total_quantity"]
            stats["qualified_quantity"] += incoming_stats["qualified_quantity"]
            stats["unqualified_quantity"] += incoming_stats["unqualified_quantity"]

        # 统计过程检验
        if inspection_type is None or inspection_type == "process":
            query = ProcessInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            process_inspections = await query.all()
            process_stats = {
                "total_inspections": len(process_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in process_inspections:
                process_stats["total_quantity"] += inspection.inspection_quantity
                process_stats["qualified_quantity"] += inspection.qualified_quantity
                process_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if process_stats["total_quantity"] > 0:
                process_stats["qualified_rate"] = float(
                    process_stats["qualified_quantity"] / process_stats["total_quantity"] * 100
                )
                process_stats["unqualified_rate"] = float(
                    process_stats["unqualified_quantity"] / process_stats["total_quantity"] * 100
                )
            else:
                process_stats["qualified_rate"] = 0.0
                process_stats["unqualified_rate"] = 0.0

            stats["by_type"]["process"] = process_stats
            stats["total_inspections"] += process_stats["total_inspections"]
            stats["total_quantity"] += process_stats["total_quantity"]
            stats["qualified_quantity"] += process_stats["qualified_quantity"]
            stats["unqualified_quantity"] += process_stats["unqualified_quantity"]

        # 统计成品检验
        if inspection_type is None or inspection_type == "finished":
            query = FinishedGoodsInspection.filter(
                tenant_id=tenant_id,
                status="已检验"
            )
            if start_date:
                query = query.filter(inspection_time__gte=start_date)
            if end_date:
                query = query.filter(inspection_time__lte=end_date)
            if material_id:
                query = query.filter(material_id=material_id)

            finished_inspections = await query.all()
            finished_stats = {
                "total_inspections": len(finished_inspections),
                "total_quantity": Decimal(0),
                "qualified_quantity": Decimal(0),
                "unqualified_quantity": Decimal(0)
            }

            for inspection in finished_inspections:
                finished_stats["total_quantity"] += inspection.inspection_quantity
                finished_stats["qualified_quantity"] += inspection.qualified_quantity
                finished_stats["unqualified_quantity"] += inspection.unqualified_quantity

            if finished_stats["total_quantity"] > 0:
                finished_stats["qualified_rate"] = float(
                    finished_stats["qualified_quantity"] / finished_stats["total_quantity"] * 100
                )
                finished_stats["unqualified_rate"] = float(
                    finished_stats["unqualified_quantity"] / finished_stats["total_quantity"] * 100
                )
            else:
                finished_stats["qualified_rate"] = 0.0
                finished_stats["unqualified_rate"] = 0.0

            stats["by_type"]["finished"] = finished_stats
            stats["total_inspections"] += finished_stats["total_inspections"]
            stats["total_quantity"] += finished_stats["total_quantity"]
            stats["qualified_quantity"] += finished_stats["qualified_quantity"]
            stats["unqualified_quantity"] += finished_stats["unqualified_quantity"]

        # 计算总体合格率
        if stats["total_quantity"] > 0:
            stats["qualified_rate"] = float(
                stats["qualified_quantity"] / stats["total_quantity"] * 100
            )
            stats["unqualified_rate"] = float(
                stats["unqualified_quantity"] / stats["total_quantity"] * 100
            )
        else:
            stats["qualified_rate"] = 0.0
            stats["unqualified_rate"] = 0.0

        # 转换为float以便JSON序列化
        stats["total_quantity"] = float(stats["total_quantity"])
        stats["qualified_quantity"] = float(stats["qualified_quantity"])
        stats["unqualified_quantity"] = float(stats["unqualified_quantity"])

        # 转换 by_type 中的 Decimal 值为 float
        for inspection_type_key, type_stats in stats["by_type"].items():
            if "total_quantity" in type_stats:
                type_stats["total_quantity"] = float(type_stats["total_quantity"])
            if "qualified_quantity" in type_stats:
                type_stats["qualified_quantity"] = float(type_stats["qualified_quantity"])
            if "unqualified_quantity" in type_stats:
                type_stats["unqualified_quantity"] = float(type_stats["unqualified_quantity"])

        return stats

    async def get_inspection_center_summary(self, tenant_id: int) -> dict:
        """
        获取质检中心看板汇总数据：待检验数量、合格率趋势等。
        """
        import asyncio
        from datetime import datetime, timedelta
        from decimal import Decimal
        from tortoise.functions import Sum
        from apps.kuaizhizao.models.oqc_inspection import OQCInspection

        now = datetime.now()
        today_start = datetime(now.year, now.month, now.day)
        month_start = datetime(now.year, now.month, 1)
        last_month_end = month_start - timedelta(seconds=1)
        last_month_start = datetime(last_month_end.year, last_month_end.month, 1)

        # 1. 并行获取待检验数量
        pending_tasks = [
            IncomingInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
            ProcessInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
            FinishedGoodsInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
            OQCInspection.filter(tenant_id=tenant_id, deleted_at__isnull=True, status="待检验").count(),
        ]

        async def sum_qualified_between(start: datetime, end: datetime, *, end_inclusive: bool = False) -> tuple:
            """使用聚合函数计算特定时间范围内的合格率数据，避免加载全部行。"""
            time_kw = {"inspection_time__gte": start, "inspection_time__lte": end} if end_inclusive else {"inspection_time__gte": start, "inspection_time__lt": end}
            
            total_sum = Decimal(0)
            qual_sum = Decimal(0)
            
            # 对三种检验类型并行获取数据
            agg_tasks = []
            for model in (IncomingInspection, ProcessInspection, FinishedGoodsInspection):
                agg_tasks.append(model.filter(
                    tenant_id=tenant_id, deleted_at__isnull=True, status="已检验", **time_kw
                ).values_list("inspection_quantity", "qualified_quantity"))
            
            results = await asyncio.gather(*agg_tasks)
            for model_results in results:
                for t, q in model_results:
                    total_sum += Decimal(str(t or 0))
                    qual_sum += Decimal(str(q or 0))
                
            return total_sum, qual_sum

        # 2. 获取汇总数据（今日、本月、上月）
        (
            (pending_incoming, pending_process, pending_finished, pending_oqc), 
            (t_today, q_today),
            (t_month, q_month),
            (t_last_month, q_last_month)
        ) = await asyncio.gather(
            asyncio.gather(*pending_tasks),
            sum_qualified_between(today_start, now, end_inclusive=True),
            sum_qualified_between(month_start, now, end_inclusive=True),
            sum_qualified_between(last_month_start, last_month_end, end_inclusive=True)
        )
        
        today_qualified_rate = float(q_today / t_today * 100) if t_today > 0 else 0.0
        month_qualified_rate = float(q_month / t_month * 100) if t_month > 0 else 0.0
        last_month_qualified_rate = float(q_last_month / t_last_month * 100) if t_last_month > 0 else 0.0

        total_inspected_today = float(t_today)

        # 3. 并行获取近 7 日趋势
        daily_trend = []
        today_d = now.date()
        trend_tasks = []
        dates = []

        for i in range(6, -1, -1):
            d = today_d - timedelta(days=i)
            dates.append(d)
            ds = datetime(d.year, d.month, d.day)
            if d == today_d:
                trend_tasks.append(sum_qualified_between(ds, now, end_inclusive=True))
            else:
                de = ds + timedelta(days=1)
                trend_tasks.append(sum_qualified_between(ds, de, end_inclusive=False))
        
        trend_results = await asyncio.gather(*trend_tasks)
        for d, (tq, qq) in zip(dates, trend_results):
            rate = float(qq / tq * 100) if tq > 0 else 0.0
            daily_trend.append({"date": d.isoformat(), "rate": round(rate, 2)})

        sparkline_rates = [x["rate"] for x in daily_trend]

        return {
            "pending_incoming": pending_incoming,
            "pending_process": pending_process,
            "pending_finished": pending_finished,
            "pending_oqc": pending_oqc,
            "total_inspected_today": total_inspected_today,
            "today_qualified_rate": round(today_qualified_rate, 2),
            "month_qualified_rate": round(month_qualified_rate, 2),
            "last_month_qualified_rate": round(last_month_qualified_rate, 2),
            "daily_pass_rate_trend": daily_trend,
            "sparkline_rates": sparkline_rates,
        }

