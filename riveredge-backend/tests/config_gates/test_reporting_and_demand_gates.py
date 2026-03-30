import sys
import types
import importlib.util
from pathlib import Path
from decimal import Decimal
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

sys.modules.setdefault("aiosmtplib", types.ModuleType("aiosmtplib"))

from infra.exceptions.exceptions import BusinessLogicError, ValidationError, NotFoundError
from apps.kuaizhizao.services import reporting_service
from apps.kuaizhizao.services.reporting_service import ReportingService
from apps.kuaizhizao.services import demand_computation_service
from apps.kuaizhizao.services.demand_computation_service import DemandComputationService
from infra.services import business_config_service as infra_business_config_service

_reporting_api_path = Path(__file__).resolve().parents[2] / "src/apps/kuaizhizao/api/productions/reporting.py"
_reporting_api_spec = importlib.util.spec_from_file_location("config_gate_reporting_api", _reporting_api_path)
reporting_api = importlib.util.module_from_spec(_reporting_api_spec)
assert _reporting_api_spec and _reporting_api_spec.loader
_reporting_api_spec.loader.exec_module(reporting_api)

_demands_api_path = Path(__file__).resolve().parents[2] / "src/apps/kuaizhizao/api/demands/demands.py"
_demands_api_spec = importlib.util.spec_from_file_location("config_gate_demands_api", _demands_api_path)
demands_api = importlib.util.module_from_spec(_demands_api_spec)
assert _demands_api_spec and _demands_api_spec.loader
_demands_api_spec.loader.exec_module(demands_api)

_sales_orders_api_path = Path(__file__).resolve().parents[2] / "src/apps/kuaizhizao/api/sales_orders/sales_orders.py"
_sales_orders_api_spec = importlib.util.spec_from_file_location("config_gate_sales_orders_api", _sales_orders_api_path)
sales_orders_api = importlib.util.module_from_spec(_sales_orders_api_spec)
assert _sales_orders_api_spec and _sales_orders_api_spec.loader
_sales_orders_api_spec.loader.exec_module(sales_orders_api)


class _NoopTx:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_data_correction_gate_blocks_when_disabled(monkeypatch):
    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": False}}}

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    service = ReportingService()

    with pytest.raises(BusinessLogicError, match="未开启报工数据修正"):
        await service.correct_reporting_data(
            tenant_id=1,
            record_id=1,
            correct_data=None,
            corrected_by=1,
            correction_reason="need fix",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_reporting_record_blocks_when_picking_not_confirmed(monkeypatch):
    class _WorkOrderModel:
        @staticmethod
        async def get_or_none(**_kwargs):
            return types.SimpleNamespace(
                id=1,
                status="released",
                is_frozen=False,
                freeze_reason=None,
            )

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 0

        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_reporting": True}

    async def _not_confirmed(*_args, **_kwargs):
        return False

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service, "WorkOrder", _WorkOrderModel)
    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(
        "apps.kuaizhizao.services.work_order_service.WorkOrderService.has_confirmed_picking_for_work_order",
        _not_confirmed,
    )

    service = ReportingService()
    reporting_data = types.SimpleNamespace(work_order_id=1, worker_id=7)
    with pytest.raises(BusinessLogicError, match="未确认领料，禁止报工"):
        await service.create_reporting_record(
            tenant_id=1,
            reporting_data=reporting_data,
            reported_by=7,
            entry_mode="manual",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_reporting_record_blocks_when_material_shortage_on_level3(monkeypatch):
    class _WorkOrderModel:
        @staticmethod
        async def get_or_none(**_kwargs):
            return types.SimpleNamespace(
                id=1,
                status="released",
                is_frozen=False,
                freeze_reason=None,
            )

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 3

        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_reporting": False}

    async def _check_shortage(self, **_kwargs):
        return {
            "has_shortage": True,
            "shortage_items": [
                {"material_name": "物料A", "shortage_quantity": 5, "unit": "个"},
                {"material_name": "物料B", "shortage_quantity": 2, "unit": "个"},
                {"material_name": "物料C", "shortage_quantity": 1, "unit": "个"},
                {"material_name": "物料D", "shortage_quantity": 9, "unit": "个"},
            ],
            "total_shortage_count": 4,
        }

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service, "WorkOrder", _WorkOrderModel)
    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(
        "apps.kuaizhizao.services.work_order_service.WorkOrderService.check_material_shortage",
        _check_shortage,
    )

    service = ReportingService()
    reporting_data = types.SimpleNamespace(work_order_id=1, worker_id=7)
    with pytest.raises(BusinessLogicError, match="工单存在缺料，无法报工"):
        await service.create_reporting_record(
            tenant_id=1,
            reporting_data=reporting_data,
            reported_by=7,
            entry_mode="manual",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_demand_generate_work_order_gate_blocks_when_auto_generate_disabled(monkeypatch):
    class _Computation:
        computation_status = "完成"

    class _DemandComputation:
        @staticmethod
        async def get_or_none(**kwargs):
            return _Computation()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"work_order": {"auto_generate": False}}}

    monkeypatch.setattr(demand_computation_service, "DemandComputation", _DemandComputation)
    monkeypatch.setattr(infra_business_config_service, "BusinessConfigService", lambda: _BizConfig())

    service = DemandComputationService()
    with pytest.raises(BusinessLogicError, match="未开启自动生成工单"):
        await service.generate_work_orders_and_purchase_orders(
            tenant_id=1,
            computation_id=1,
            created_by=1,
            generate_mode="work_order_only",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_demands_api_create_should_map_validation_error_to_422_with_trace_id(monkeypatch):
    class _FakeService:
        async def create_demand(self, **kwargs):
            raise ValidationError("需求类型无效")

    monkeypatch.setattr(demands_api, "demand_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await demands_api.create_demand(
            demand_data=types.SimpleNamespace(),
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 422
    assert "需求类型无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_demands_api_get_should_map_not_found_to_404_with_trace_id(monkeypatch):
    class _FakeService:
        async def get_demand_by_id(self, **kwargs):
            raise NotFoundError("需求不存在: 1001")

    monkeypatch.setattr(demands_api, "demand_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await demands_api.get_demand(
            demand_id=1001,
            include_items=False,
            include_duration=False,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "需求不存在: 1001" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_demands_api_list_should_map_internal_error_to_500_with_trace_id(monkeypatch):
    class _FakeService:
        async def list_demands(self, **kwargs):
            raise RuntimeError("db timeout")

    monkeypatch.setattr(demands_api, "demand_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await demands_api.list_demands(
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 500
    assert "获取需求列表失败" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_orders_api_create_should_map_validation_error_to_422_with_trace_id(monkeypatch):
    class _FakeService:
        async def create_sales_order(self, **kwargs):
            raise ValidationError("订单明细不能为空")

    monkeypatch.setattr(sales_orders_api, "sales_order_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await sales_orders_api.create_sales_order(
            sales_order_data=types.SimpleNamespace(),
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 422
    assert "订单明细不能为空" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_orders_api_get_should_map_not_found_to_404_with_trace_id(monkeypatch):
    class _FakeService:
        async def get_sales_order_by_id(self, **kwargs):
            raise NotFoundError("销售订单不存在: 2001")

    monkeypatch.setattr(sales_orders_api, "sales_order_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await sales_orders_api.get_sales_order(
            sales_order_id=2001,
            include_items=False,
            include_duration=False,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "销售订单不存在: 2001" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_sales_orders_api_list_should_map_internal_error_to_500_with_trace_id(monkeypatch):
    class _FakeService:
        async def list_sales_orders(self, **kwargs):
            raise RuntimeError("db error")

    monkeypatch.setattr(sales_orders_api, "sales_order_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await sales_orders_api.list_sales_orders(
            order_by="",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 500
    assert "获取销售订单列表失败" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_manual_entry_mode(monkeypatch):
    payload = types.SimpleNamespace(id="payload")

    class _FakeService:
        async def create_reporting_record(self, **kwargs):
            assert kwargs["entry_mode"] == "manual"
            assert kwargs["tenant_id"] == 1
            assert kwargs["reported_by"] == 7
            assert kwargs["reporting_data"] is payload
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.create_reporting_record(
        reporting=payload,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_quick_entry_mode(monkeypatch):
    payload = types.SimpleNamespace(id="payload-quick")

    class _FakeService:
        async def create_reporting_record(self, **kwargs):
            assert kwargs["entry_mode"] == "quick"
            assert kwargs["tenant_id"] == 1
            assert kwargs["reported_by"] == 7
            assert kwargs["reporting_data"] is payload
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.create_quick_reporting_record(
        reporting=payload,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_get_should_forward_ids(monkeypatch):
    expected = types.SimpleNamespace(id=501)

    class _FakeService:
        async def get_reporting_record_by_id(self, **kwargs):
            assert kwargs["record_id"] == 501
            assert kwargs["tenant_id"] == 1
            return expected

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.get_reporting_record(
        record_id=501,
        current_user=user,
        tenant_id=1,
    )
    assert result is expected


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_get_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def get_reporting_record_by_id(self, **kwargs):
            assert kwargs["record_id"] == 999
            raise NotFoundError("报工记录不存在: 999")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.get_reporting_record(
            record_id=999,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报工记录不存在: 999" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_approve_should_map_service_gate_error_to_http_400(monkeypatch):
    class _FakeService:
        async def approve_reporting_record(self, **kwargs):
            assert kwargs["approved_by"] == 7
            assert kwargs["record_id"] == 99
            raise BusinessLogicError("报工人不能审核通过自己的报工记录")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_reporting_record(
            record_id=99,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "报工人不能审核通过自己的报工记录" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_batch_revoke_should_forward_ids_and_user(monkeypatch):
    class _FakeService:
        async def batch_revoke_reporting_approval(self, **kwargs):
            assert kwargs["record_ids"] == [10, 11]
            assert kwargs["revoked_by"] == 7
            assert kwargs["tenant_id"] == 1
            return {"success": 2, "failed": 0}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.batch_revoke_reporting_approval(
        record_ids=[10, 11],
        current_user=user,
        tenant_id=1,
    )
    assert result == {"success": 2, "failed": 0}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_batch_revoke_should_passthrough_partial_failure_details(monkeypatch):
    class _FakeService:
        async def batch_revoke_reporting_approval(self, **kwargs):
            assert kwargs["record_ids"] == [10, 11, 12]
            assert kwargs["revoked_by"] == 7
            assert kwargs["tenant_id"] == 1
            return {
                "total": 3,
                "success": 1,
                "failed": 2,
                "details": [
                    {"id": 10, "status": "success"},
                    {"id": 11, "status": "failed", "reason": "记录不存在"},
                    {"id": 12, "status": "failed", "reason": "当前状态为 pending，无法撤回审核"},
                ],
            }

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.batch_revoke_reporting_approval(
        record_ids=[10, 11, 12],
        current_user=user,
        tenant_id=1,
    )
    assert result["total"] == 3
    assert result["success"] == 1
    assert result["failed"] == 2
    assert result["details"][1]["reason"] == "记录不存在"
    assert result["details"][2]["reason"] == "当前状态为 pending，无法撤回审核"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_batch_revoke_should_map_validation_error_to_http_400(monkeypatch):
    class _FakeService:
        async def batch_revoke_reporting_approval(self, **kwargs):
            assert kwargs["record_ids"] == []
            raise ValidationError("报工记录ID列表不能为空")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.batch_revoke_reporting_approval(
            record_ids=[],
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "报工记录ID列表不能为空" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_delete_should_map_approved_gate_error_to_http_400(monkeypatch):
    class _FakeService:
        async def delete_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 77
            assert kwargs["tenant_id"] == 1
            raise ValidationError("已审核通过的报工记录不允许直接删除，请先撤销审核")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.delete_reporting_record(
            record_id=77,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "已审核通过的报工记录不允许直接删除" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_delete_should_forward_ids(monkeypatch):
    class _FakeService:
        async def delete_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 78
            assert kwargs["tenant_id"] == 1
            return None

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.delete_reporting_record(
        record_id=78,
        current_user=user,
        tenant_id=1,
    )
    assert result.status_code == 200
    assert "删除成功" in result.body.decode("utf-8")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_create_should_map_validation_error_to_http_400(monkeypatch):
    class _FakeService:
        async def create_reporting_record(self, **kwargs):
            assert kwargs["entry_mode"] == "manual"
            raise ValidationError("报工工时必须大于0")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.create_reporting_record(
            reporting=types.SimpleNamespace(),
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "报工工时必须大于0" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_create_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def create_reporting_record(self, **kwargs):
            assert kwargs["entry_mode"] == "manual"
            raise NotFoundError("工单不存在: 1")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.create_reporting_record(
            reporting=types.SimpleNamespace(),
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "工单不存在: 1" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_delete_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def delete_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 79
            raise NotFoundError("报工记录不存在: 79")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.delete_reporting_record(
            record_id=79,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报工记录不存在: 79" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_correct_should_forward_args(monkeypatch):
    payload = types.SimpleNamespace(reported_quantity=Decimal("8"))

    class _FakeService:
        async def correct_reporting_data(self, **kwargs):
            assert kwargs["tenant_id"] == 1
            assert kwargs["record_id"] == 88
            assert kwargs["correct_data"] is payload
            assert kwargs["corrected_by"] == 7
            assert kwargs["correction_reason"] == "补录"
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.correct_reporting_data(
        record_id=88,
        correct_data=payload,
        correction_reason="补录",
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_correct_should_map_validation_error_to_http_400(monkeypatch):
    class _FakeService:
        async def correct_reporting_data(self, **kwargs):
            assert kwargs["record_id"] == 89
            assert kwargs["corrected_by"] == 7
            raise ValidationError("报工工时必须大于0")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.correct_reporting_data(
            record_id=89,
            correct_data=types.SimpleNamespace(work_hours=Decimal("0")),
            correction_reason="修正工时",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "报工工时必须大于0" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_correct_should_map_business_logic_error_to_http_400(monkeypatch):
    class _FakeService:
        async def correct_reporting_data(self, **kwargs):
            assert kwargs["record_id"] == 90
            assert kwargs["corrected_by"] == 7
            raise BusinessLogicError("只有组织管理员可以修正报工数据")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.correct_reporting_data(
            record_id=90,
            correct_data=types.SimpleNamespace(remarks="x"),
            correction_reason="补录",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "只有组织管理员可以修正报工数据" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_correct_should_pass_blank_reason_to_service(monkeypatch):
    class _FakeService:
        async def correct_reporting_data(self, **kwargs):
            assert kwargs["record_id"] == 91
            assert kwargs["correction_reason"] == "   "
            raise ValidationError("修正原因不能为空")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.correct_reporting_data(
            record_id=91,
            correct_data=types.SimpleNamespace(remarks="x"),
            correction_reason="   ",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "修正原因不能为空" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_correct_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def correct_reporting_data(self, **kwargs):
            assert kwargs["record_id"] == 92
            raise NotFoundError("报工记录不存在: 92")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.correct_reporting_data(
            record_id=92,
            correct_data=types.SimpleNamespace(remarks="x"),
            correction_reason="补录",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报工记录不存在: 92" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_approve_should_forward_rejection_reason(monkeypatch):
    class _FakeService:
        async def approve_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 80
            assert kwargs["tenant_id"] == 1
            assert kwargs["approved_by"] == 7
            assert kwargs["rejection_reason"] == "库存不一致"
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.approve_reporting_record(
        record_id=80,
        rejection_reason="库存不一致",
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_approve_should_map_blank_rejection_reason_gate_to_http_400(monkeypatch):
    class _FakeService:
        async def approve_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 82
            assert kwargs["tenant_id"] == 1
            assert kwargs["approved_by"] == 7
            # 路由层不应改写空白输入，交由服务层门禁处理
            assert kwargs["rejection_reason"] == "   "
            raise ValidationError("驳回原因不能为空")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_reporting_record(
            record_id=82,
            rejection_reason="   ",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "驳回原因不能为空" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_approve_should_forward_none_rejection_reason(monkeypatch):
    class _FakeService:
        async def approve_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 83
            assert kwargs["tenant_id"] == 1
            assert kwargs["approved_by"] == 7
            assert kwargs["rejection_reason"] is None
            return {"ok": True, "status": "approved"}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.approve_reporting_record(
        record_id=83,
        rejection_reason=None,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True, "status": "approved"}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_revoke_should_forward_ids_and_user(monkeypatch):
    class _FakeService:
        async def revoke_reporting_approval(self, **kwargs):
            assert kwargs["record_id"] == 81
            assert kwargs["tenant_id"] == 1
            assert kwargs["revoked_by"] == 7
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.revoke_reporting_approval(
        record_id=81,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_revoke_should_map_validation_error_to_http_400(monkeypatch):
    class _FakeService:
        async def revoke_reporting_approval(self, **kwargs):
            assert kwargs["record_id"] == 84
            assert kwargs["tenant_id"] == 1
            assert kwargs["revoked_by"] == 7
            raise ValidationError("只有已审核通过的报工记录才可以撤回审核")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.revoke_reporting_approval(
            record_id=84,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "只有已审核通过的报工记录才可以撤回审核" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_approve_should_map_validation_error_to_http_400(monkeypatch):
    class _FakeService:
        async def approve_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 85
            assert kwargs["tenant_id"] == 1
            assert kwargs["approved_by"] == 7
            raise ValidationError("报工时间不能晚于当前时间")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_reporting_record(
            record_id=85,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "报工时间不能晚于当前时间" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_revoke_should_map_business_logic_error_to_http_400(monkeypatch):
    class _FakeService:
        async def revoke_reporting_approval(self, **kwargs):
            assert kwargs["record_id"] == 86
            assert kwargs["tenant_id"] == 1
            assert kwargs["revoked_by"] == 7
            raise BusinessLogicError("当前班次已封账，禁止撤回审核")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.revoke_reporting_approval(
            record_id=86,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "当前班次已封账，禁止撤回审核" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_approve_should_map_business_logic_error_to_http_400(monkeypatch):
    class _FakeService:
        async def approve_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 87
            assert kwargs["tenant_id"] == 1
            assert kwargs["approved_by"] == 7
            raise BusinessLogicError("报工人不能审核通过自己的报工记录")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_reporting_record(
            record_id=87,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "报工人不能审核通过自己的报工记录" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_approve_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def approve_reporting_record(self, **kwargs):
            assert kwargs["record_id"] == 93
            raise NotFoundError("报工记录不存在: 93")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_reporting_record(
            record_id=93,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报工记录不存在: 93" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_revoke_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def revoke_reporting_approval(self, **kwargs):
            assert kwargs["record_id"] == 94
            raise NotFoundError("报工记录不存在: 94")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.revoke_reporting_approval(
            record_id=94,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报工记录不存在: 94" in str(exc.value.detail)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_scrap_should_forward_args(monkeypatch):
    payload = types.SimpleNamespace(id="scrap-payload")

    class _FakeService:
        async def record_scrap(self, **kwargs):
            assert kwargs["tenant_id"] == 1
            assert kwargs["reporting_record_id"] == 101
            assert kwargs["scrap_data"] is payload
            assert kwargs["created_by"] == 7
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.create_scrap_record_from_reporting(
        record_id=101,
        scrap_data=payload,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_scrap_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def record_scrap(self, **kwargs):
            raise NotFoundError("报工记录不存在: 101")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.create_scrap_record_from_reporting(
            record_id=101,
            scrap_data=types.SimpleNamespace(),
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报工记录不存在: 101" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_defect_should_map_validation_error_to_http_400(monkeypatch):
    class _FakeService:
        async def record_defect(self, **kwargs):
            raise ValidationError("不良数量必须大于0")

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.create_defect_record_from_reporting(
            record_id=102,
            defect_data=types.SimpleNamespace(),
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "不良数量必须大于0" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_material_binding_feeding_should_forward_and_set_type(monkeypatch):
    payload = types.SimpleNamespace(binding_type=None)

    class _FakeService:
        async def create_material_binding_from_reporting(self, **kwargs):
            assert kwargs["tenant_id"] == 1
            assert kwargs["reporting_record_id"] == 103
            assert kwargs["bound_by"] == 7
            assert kwargs["binding_data"] is payload
            assert kwargs["binding_data"].binding_type == "feeding"
            return {"ok": True}

    monkeypatch.setattr(reporting_api, "material_binding_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.create_feeding_binding_from_reporting(
        record_id=103,
        binding_data=payload,
        current_user=user,
        tenant_id=1,
    )
    assert result == {"ok": True}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_material_binding_discharging_should_map_not_found_error_to_http_404(monkeypatch):
    payload = types.SimpleNamespace(binding_type=None)

    class _FakeService:
        async def create_material_binding_from_reporting(self, **kwargs):
            raise NotFoundError("报工记录不存在: 104")

    monkeypatch.setattr(reporting_api, "material_binding_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.create_discharging_binding_from_reporting(
            record_id=104,
            binding_data=payload,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报工记录不存在: 104" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_get_material_bindings_should_map_validation_error_to_http_400(monkeypatch):
    class _FakeService:
        async def get_material_bindings_by_reporting_record(self, **kwargs):
            raise ValidationError("报工记录ID无效")

    monkeypatch.setattr(reporting_api, "material_binding_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.get_material_bindings_by_reporting_record(
            record_id=0,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "报工记录ID无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_delete_material_binding_should_map_not_found_error_to_http_404(monkeypatch):
    class _FakeService:
        async def delete_material_binding(self, **kwargs):
            raise NotFoundError("物料绑定记录不存在: 105")

    monkeypatch.setattr(reporting_api, "material_binding_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.delete_material_binding(
            binding_id=105,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "物料绑定记录不存在: 105" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_scrap_approve_should_map_validation_error_with_trace_id(monkeypatch):
    class _FakeService:
        async def approve_scrap_record(self, **kwargs):
            raise ValidationError("审批参数无效")

    monkeypatch.setattr(reporting_api, "scrap_record_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_scrap_record(
            scrap_id=201,
            approved=True,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "审批参数无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_defect_approve_should_map_business_error_with_trace_id(monkeypatch):
    class _FakeService:
        async def approve_defect_acceptance(self, **kwargs):
            raise BusinessLogicError("当前状态不允许让步接收审批")

    monkeypatch.setattr(reporting_api, "defect_record_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_defect_acceptance(
            defect_id=301,
            approved=True,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "当前状态不允许让步接收审批" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_scrap_approve_should_map_not_found_error_with_trace_id(monkeypatch):
    class _FakeService:
        async def approve_scrap_record(self, **kwargs):
            raise NotFoundError("报废记录不存在: 202")

    monkeypatch.setattr(reporting_api, "scrap_record_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_scrap_record(
            scrap_id=202,
            approved=True,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "报废记录不存在: 202" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_defect_approve_should_map_not_found_error_with_trace_id(monkeypatch):
    class _FakeService:
        async def approve_defect_acceptance(self, **kwargs):
            raise NotFoundError("不良品记录不存在: 302")

    monkeypatch.setattr(reporting_api, "defect_record_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.approve_defect_acceptance(
            defect_id=302,
            approved=True,
            rejection_reason=None,
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 404
    assert "不良品记录不存在: 302" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_list_reporting_should_map_invalid_start_datetime_to_http_400():
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.list_reporting_records(
            reported_at_start="invalid-date",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "reported_at_start 格式无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_reporting_statistics_should_map_invalid_end_datetime_to_http_400():
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.get_reporting_statistics(
            date_end="not-iso",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "date_end 格式无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_reporting_statistics_should_return_typed_payload(monkeypatch):
    class _FakeService:
        async def get_reporting_statistics(self, **kwargs):
            assert kwargs["tenant_id"] == 1
            assert kwargs["date_start"] is None
            assert kwargs["date_end"] is None
            return {
                "total_count": 10,
                "pending_count": 2,
                "approved_count": 7,
                "rejected_count": 1,
                "total_reported_quantity": 100.0,
                "total_qualified_quantity": 95.0,
                "total_unqualified_quantity": 5.0,
                "total_work_hours": 20.0,
                "cumulative_hours": 20.0,
                "estimated_wages": 600.0,
                "qualification_rate": 95.0,
                "unqualified_rate": 5.0,
                "avg_quantity_per_hour": 5.0,
                "efficiency": 95.0,
                "operation_stats": [],
                "worker_stats": [],
                "trends": {
                    "hours": [20.0],
                    "wages": [600.0],
                    "efficiency": [95.0],
                },
            }

    monkeypatch.setattr(reporting_api, "reporting_service", _FakeService())
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.get_reporting_statistics(
        current_user=user,
        tenant_id=1,
    )
    assert result.total_count == 10
    assert result.efficiency == 95.0
    assert result.trends.efficiency == [95.0]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_overview_statistics_should_return_typed_payload(monkeypatch):
    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"estimated_wage_rate": 45}}}

    class _BaseQuery:
        def __init__(self):
            self._last_filter = {}

        def filter(self, **kwargs):
            self._last_filter = kwargs
            return self

        async def values_list(self, field: str, flat: bool = False):
            assert flat is True
            if field == "actual_hours":
                return [Decimal("1.5"), Decimal("2.0")]
            if field == "qualified_quantity":
                return [Decimal("90")]
            if field == "planned_quantity":
                return [Decimal("100")]
            return [0]

        async def count(self):
            if self._last_filter.get("downtime_minutes__gt") == 0:
                return 2
            if self._last_filter.get("status") == "exception":
                return 1
            return 0

    class _FakeReportingRecord:
        @staticmethod
        def filter(**kwargs):
            assert kwargs["tenant_id"] == 1
            assert kwargs["deleted_at__isnull"] is True
            return _BaseQuery()

    monkeypatch.setattr(reporting_api, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr("apps.kuaizhizao.models.reporting_record.ReportingRecord", _FakeReportingRecord)
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.get_reporting_overview_statistics(
        current_user=user,
        tenant_id=1,
    )

    assert result.cumulative_hours == 3.5
    assert result.estimated_wages == 157.5
    assert result.downtime_records == 2
    assert result.exception_reports == 1
    assert result.efficiency == 90.0
    assert len(result.trends.hours) == 7
    assert len(result.trends.wages) == 7
    assert result.trends.efficiency == [90.0] * 7


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_overview_statistics_should_fallback_to_zero_payload_on_internal_error(monkeypatch):
    class _BrokenQuery:
        def filter(self, **kwargs):
            return self

        async def values_list(self, field: str, flat: bool = False):
            raise RuntimeError("boom")

        async def count(self):
            raise RuntimeError("boom")

    class _FakeReportingRecord:
        @staticmethod
        def filter(**kwargs):
            return _BrokenQuery()

    monkeypatch.setattr("apps.kuaizhizao.models.reporting_record.ReportingRecord", _FakeReportingRecord)
    user = types.SimpleNamespace(id=7)

    result = await reporting_api.get_reporting_overview_statistics(
        current_user=user,
        tenant_id=1,
    )

    assert result.cumulative_hours == 0
    assert result.estimated_wages == 0
    assert result.downtime_records == 0
    assert result.exception_reports == 0
    assert result.efficiency == 0
    assert result.trends.hours == [0] * 7
    assert result.trends.wages == [0] * 7
    assert result.trends.efficiency == [0] * 7


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_overview_statistics_should_emit_alert_hook_on_internal_error(monkeypatch):
    captured = {}

    class _BrokenQuery:
        def filter(self, **kwargs):
            return self

        async def values_list(self, field: str, flat: bool = False):
            raise RuntimeError("boom")

        async def count(self):
            raise RuntimeError("boom")

    class _FakeReportingRecord:
        @staticmethod
        def filter(**kwargs):
            return _BrokenQuery()

    async def _fake_emit_alert(*, tenant_id: int, trace_id: str, error_message: str):
        captured["tenant_id"] = tenant_id
        captured["trace_id"] = trace_id
        captured["error_message"] = error_message

    monkeypatch.setattr("apps.kuaizhizao.models.reporting_record.ReportingRecord", _FakeReportingRecord)
    monkeypatch.setattr(reporting_api, "_emit_overview_statistics_alert", _fake_emit_alert)

    user = types.SimpleNamespace(id=7)
    await reporting_api.get_reporting_overview_statistics(
        current_user=user,
        tenant_id=1,
    )

    assert captured["tenant_id"] == 1
    assert captured["trace_id"]
    assert "boom" in captured["error_message"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_get_reporting_statistics_should_use_configured_wage_rate(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"estimated_wage_rate": 50}}}

    record = types.SimpleNamespace(
        status="approved",
        reported_quantity=Decimal("10"),
        qualified_quantity=Decimal("9"),
        unqualified_quantity=Decimal("1"),
        work_hours=Decimal("2"),
        operation_name="工序A",
        worker_name="张三",
    )

    class _Query:
        def filter(self, **_kwargs):
            return self

        async def all(self):
            return [record]

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service.ReportingRecord, "filter", lambda **_kwargs: _Query())

    result = await service.get_reporting_statistics(tenant_id=1)

    assert result["estimated_wages"] == 100.0
    assert result["trends"]["wages"][-1] == 100.0


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_list_scrap_should_map_invalid_start_datetime_to_http_400():
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.list_scrap_records(
            date_start="2026/01/01",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "date_start 格式无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_scrap_statistics_should_map_invalid_end_datetime_to_http_400():
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.get_scrap_statistics(
            date_end="bad-date",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "date_end 格式无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_list_defect_should_map_invalid_start_datetime_to_http_400():
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.list_defect_records(
            date_start="2026.01.01",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "date_start 格式无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_reporting_api_defect_statistics_should_map_invalid_end_datetime_to_http_400():
    user = types.SimpleNamespace(id=7)

    with pytest.raises(HTTPException) as exc:
        await reporting_api.get_defect_statistics(
            date_end="bad",
            current_user=user,
            tenant_id=1,
        )
    assert exc.value.status_code == 400
    assert "date_end 格式无效" in str(exc.value.detail)
    assert isinstance(exc.value.detail, dict)
    assert exc.value.detail.get("trace_id")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_reporting_record_should_override_work_order_and_operation_identity(monkeypatch):
    service = ReportingService()
    captured = {}

    work_order = types.SimpleNamespace(
        id=1001,
        code="WO-REAL",
        name="真实工单",
        status="released",
        is_frozen=False,
        freeze_reason=None,
        quantity=Decimal("10"),
        completed_quantity=Decimal("0"),
        qualified_quantity=Decimal("0"),
        unqualified_quantity=Decimal("0"),
        actual_start_date=None,
        actual_end_date=None,
    )
    work_order_operation = types.SimpleNamespace(
        id=2001,
        operation_id=3001,
        operation_code="OP-REAL",
        operation_name="真实工序",
        reporting_type="quantity",
        sequence=1,
        status="pending",
        completed_quantity=Decimal("0"),
        qualified_quantity=Decimal("0"),
        unqualified_quantity=Decimal("0"),
        actual_start_date=None,
        actual_end_date=None,
    )

    class _OpQuery:
        def __init__(self, kwargs):
            self.kwargs = kwargs

        def order_by(self, *_args, **_kwargs):
            return self

        async def all(self):
            if "sequence__lt" in self.kwargs:
                return []
            return [work_order_operation]

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 0

        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_reporting": False}

        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"quick_reporting": True, "parameter_reporting": True, "auto_approve": False}}}

    async def _create_reporting_record(**kwargs):
        captured["create_kwargs"] = kwargs
        return types.SimpleNamespace(id=9001, **kwargs)

    async def _get_work_order(**_kwargs):
        return work_order

    async def _get_work_order_operation(**_kwargs):
        return work_order_operation

    class _BackflushSvc:
        async def backflush_materials(self, **kwargs):
            captured["backflush_kwargs"] = kwargs
            return None

    async def _save_op():
        return None

    async def _save_wo():
        return None

    work_order_operation.save = _save_op
    work_order.save = _save_wo

    reporting_data = types.SimpleNamespace(
        work_order_id=1001,
        work_order_code="WO-TAMPER",
        work_order_name="篡改工单名",
        operation_id=3001,
        operation_code="OP-TAMPER",
        operation_name="篡改工序名",
        worker_id=7,
        worker_name="张三",
        reported_quantity=Decimal("1"),
        qualified_quantity=Decimal("1"),
        unqualified_quantity=Decimal("0"),
        work_hours=Decimal("1"),
        status="pending",
        reported_at=None,
        remarks=None,
        device_info=None,
        sop_parameters={},
    )

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _get_work_order)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _get_work_order_operation)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "filter", lambda **kwargs: _OpQuery(kwargs))
    monkeypatch.setattr(reporting_service.ReportingRecord, "create", _create_reporting_record)
    monkeypatch.setattr(
        "apps.kuaizhizao.services.backflush_service.BackflushService",
        lambda: _BackflushSvc(),
    )
    monkeypatch.setattr(reporting_service.ReportingRecordResponse, "model_validate", lambda x: x)

    result = await service.create_reporting_record(
        tenant_id=1,
        reporting_data=reporting_data,
        reported_by=7,
        entry_mode="manual",
    )

    assert getattr(result, "work_order_code", "") == "WO-REAL"
    assert getattr(result, "work_order_name", "") == "真实工单"
    assert getattr(result, "operation_code", "") == "OP-REAL"
    assert getattr(result, "operation_name", "") == "真实工序"
    assert captured["create_kwargs"]["work_order_code"] == "WO-REAL"
    assert captured["create_kwargs"]["operation_code"] == "OP-REAL"
    assert captured["backflush_kwargs"]["operation_code"] == "OP-REAL"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_reporting_record_should_block_when_reporter_and_worker_mismatch(monkeypatch):
    class _WorkOrderModel:
        @staticmethod
        async def get_or_none(**_kwargs):
            return types.SimpleNamespace(
                id=1,
                status="released",
                is_frozen=False,
                freeze_reason=None,
            )

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service, "WorkOrder", _WorkOrderModel)

    service = ReportingService()
    reporting_data = types.SimpleNamespace(work_order_id=1, worker_id=99)
    with pytest.raises(BusinessLogicError, match="报工人身份不一致"):
        await service.create_reporting_record(
            tenant_id=1,
            reporting_data=reporting_data,
            reported_by=7,
            entry_mode="manual",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_reporting_record_should_block_when_work_hours_not_positive(monkeypatch):
    service = ReportingService()

    work_order = types.SimpleNamespace(
        id=1001,
        code="WO-REAL",
        name="真实工单",
        status="released",
        is_frozen=False,
        freeze_reason=None,
        quantity=Decimal("10"),
    )
    work_order_operation = types.SimpleNamespace(
        id=2001,
        operation_id=3001,
        operation_code="OP-REAL",
        operation_name="真实工序",
        reporting_type="status",
        sequence=1,
        status="pending",
        completed_quantity=Decimal("0"),
    )

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 0

        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_reporting": False}

    class _OpQuery:
        def order_by(self, *_args, **_kwargs):
            return self

        async def all(self):
            return []

    async def _get_work_order(**_kwargs):
        return work_order

    async def _get_work_order_operation(**_kwargs):
        return work_order_operation

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _get_work_order)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _get_work_order_operation)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "filter", lambda **_kwargs: _OpQuery())
    monkeypatch.setattr(
        "apps.kuaizhizao.services.operation_jump_rules.effective_allow_jump",
        lambda *_args, **_kwargs: False,
    )

    reporting_data = types.SimpleNamespace(
        work_order_id=1001,
        work_order_code="WO-REAL",
        work_order_name="真实工单",
        operation_id=3001,
        operation_code="OP-REAL",
        operation_name="真实工序",
        worker_id=7,
        worker_name="张三",
        reported_quantity=0,
        qualified_quantity=0,
        unqualified_quantity=0,
        work_hours=Decimal("0"),
        status="pending",
        reported_at=None,
        remarks=None,
        device_info=None,
        sop_parameters={},
    )

    with pytest.raises(ValidationError, match="报工工时必须大于0"):
        await service.create_reporting_record(
            tenant_id=1,
            reporting_data=reporting_data,
            reported_by=7,
            entry_mode="manual",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_reporting_record_should_block_when_reported_at_in_future(monkeypatch):
    service = ReportingService()

    work_order = types.SimpleNamespace(
        id=1001,
        code="WO-REAL",
        name="真实工单",
        status="released",
        is_frozen=False,
        freeze_reason=None,
        quantity=Decimal("10"),
    )
    work_order_operation = types.SimpleNamespace(
        id=2001,
        operation_id=3001,
        operation_code="OP-REAL",
        operation_name="真实工序",
        reporting_type="status",
        sequence=1,
        status="pending",
        completed_quantity=Decimal("0"),
    )

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 0

        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_reporting": False}

    class _OpQuery:
        def order_by(self, *_args, **_kwargs):
            return self

        async def all(self):
            return []

    async def _get_work_order(**_kwargs):
        return work_order

    async def _get_work_order_operation(**_kwargs):
        return work_order_operation

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _get_work_order)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _get_work_order_operation)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "filter", lambda **_kwargs: _OpQuery())
    monkeypatch.setattr(
        "apps.kuaizhizao.services.operation_jump_rules.effective_allow_jump",
        lambda *_args, **_kwargs: False,
    )

    reporting_data = types.SimpleNamespace(
        work_order_id=1001,
        work_order_code="WO-REAL",
        work_order_name="真实工单",
        operation_id=3001,
        operation_code="OP-REAL",
        operation_name="真实工序",
        worker_id=7,
        worker_name="张三",
        reported_quantity=0,
        qualified_quantity=0,
        unqualified_quantity=0,
        work_hours=Decimal("1"),
        status="pending",
        reported_at=datetime.now() + timedelta(minutes=5),
        remarks=None,
        device_info=None,
        sop_parameters={},
    )

    with pytest.raises(ValidationError, match="报工时间不能晚于当前时间"):
        await service.create_reporting_record(
            tenant_id=1,
            reporting_data=reporting_data,
            reported_by=7,
            entry_mode="manual",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_create_reporting_record_should_block_when_reported_at_in_future_with_timezone(monkeypatch):
    service = ReportingService()

    work_order = types.SimpleNamespace(
        id=1001,
        code="WO-REAL",
        name="真实工单",
        status="released",
        is_frozen=False,
        freeze_reason=None,
        quantity=Decimal("10"),
    )
    work_order_operation = types.SimpleNamespace(
        id=2001,
        operation_id=3001,
        operation_code="OP-REAL",
        operation_name="真实工序",
        reporting_type="status",
        sequence=1,
        status="pending",
        completed_quantity=Decimal("0"),
    )

    class _BizConfig:
        async def get_material_shortage_block_level(self, _tenant_id: int):
            return 0

        async def get_work_order_picking_policy(self, _tenant_id: int):
            return {"require_confirmed_picking_before_reporting": False}

    class _OpQuery:
        def order_by(self, *_args, **_kwargs):
            return self

        async def all(self):
            return []

    async def _get_work_order(**_kwargs):
        return work_order

    async def _get_work_order_operation(**_kwargs):
        return work_order_operation

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _get_work_order)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _get_work_order_operation)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "filter", lambda **_kwargs: _OpQuery())
    monkeypatch.setattr(
        "apps.kuaizhizao.services.operation_jump_rules.effective_allow_jump",
        lambda *_args, **_kwargs: False,
    )

    reporting_data = types.SimpleNamespace(
        work_order_id=1001,
        work_order_code="WO-REAL",
        work_order_name="真实工单",
        operation_id=3001,
        operation_code="OP-REAL",
        operation_name="真实工序",
        worker_id=7,
        worker_name="张三",
        reported_quantity=0,
        qualified_quantity=0,
        unqualified_quantity=0,
        work_hours=Decimal("1"),
        status="pending",
        reported_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        remarks=None,
        device_info=None,
        sop_parameters={},
    )

    with pytest.raises(ValidationError, match="报工时间不能晚于当前时间"):
        await service.create_reporting_record(
            tenant_id=1,
            reporting_data=reporting_data,
            reported_by=7,
            entry_mode="manual",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_approve_reporting_record_should_block_when_reported_at_in_future(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=5001,
        tenant_id=1,
        status="pending",
        reported_at=datetime.now() + timedelta(minutes=3),
    )

    async def _get_record(**_kwargs):
        return record

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)

    with pytest.raises(ValidationError, match="报工时间不能晚于当前时间"):
        await service.approve_reporting_record(
            tenant_id=1,
            record_id=5001,
            approved_by=7,
            rejection_reason=None,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_approve_reporting_record_should_block_when_reported_at_in_future_with_timezone(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=5001,
        tenant_id=1,
        status="pending",
        reported_at=datetime.now(timezone.utc) + timedelta(minutes=3),
    )

    async def _get_record(**_kwargs):
        return record

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)

    with pytest.raises(ValidationError, match="报工时间不能晚于当前时间"):
        await service.approve_reporting_record(
            tenant_id=1,
            record_id=5001,
            approved_by=7,
            rejection_reason=None,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_approve_reporting_record_should_block_when_rejection_reason_blank(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=5002,
        tenant_id=1,
        status="pending",
        reported_at=datetime.now(),
    )

    async def _get_record(**_kwargs):
        return record

    async def _get_user_name(_uid: int):
        return "tester"

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(service, "get_user_name", _get_user_name)

    with pytest.raises(ValidationError, match="驳回原因不能为空"):
        await service.approve_reporting_record(
            tenant_id=1,
            record_id=5002,
            approved_by=7,
            rejection_reason="   ",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_approve_reporting_record_should_block_self_approval(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=5003,
        tenant_id=1,
        status="pending",
        reported_at=datetime.now(),
        worker_id=7,
    )

    async def _get_record(**_kwargs):
        return record

    async def _get_user_name(_uid: int):
        return "tester"

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(service, "get_user_name", _get_user_name)

    with pytest.raises(BusinessLogicError, match="报工人不能审核通过自己的报工记录"):
        await service.approve_reporting_record(
            tenant_id=1,
            record_id=5003,
            approved_by=7,
            rejection_reason=None,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_approve_reporting_record_should_clear_old_rejection_reason_when_approved(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=5004,
        tenant_id=1,
        status="pending",
        reported_at=datetime.now(),
        worker_id=9,
        rejection_reason="历史驳回",
        work_order_id=101,
        operation_id=201,
        operation_code="OP-1",
        reported_quantity=Decimal("1"),
        qualified_quantity=Decimal("1"),
        worker_name="张三",
    )

    async def _save():
        return None

    async def _get_record(**_kwargs):
        return record

    async def _get_user_name(_uid: int):
        return "auditor"

    async def _noop_update_progress(*_args, **_kwargs):
        return None

    async def _none_obj(**_kwargs):
        return None

    record.save = _save
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(service, "get_user_name", _get_user_name)
    monkeypatch.setattr(service, "_update_work_order_progress", _noop_update_progress)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _none_obj)
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _none_obj)
    monkeypatch.setattr(reporting_service.ReportingRecordResponse, "model_validate", lambda x: x)

    result = await service.approve_reporting_record(
        tenant_id=1,
        record_id=5004,
        approved_by=7,
        rejection_reason=None,
    )
    assert getattr(result, "status", "") == "approved"
    assert getattr(result, "rejection_reason", "x") is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_revoke_reporting_approval_should_clear_rejection_reason(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=5005,
        tenant_id=1,
        status="approved",
        work_order_id=102,
        rejection_reason="历史驳回",
        remarks=None,
    )

    async def _save():
        return None

    async def _get_record(**_kwargs):
        return record

    async def _get_user_info(_uid: int):
        return {"name": "auditor"}

    async def _noop_update_progress(*_args, **_kwargs):
        return None

    record.save = _save
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(service, "_update_work_order_progress", _noop_update_progress)
    monkeypatch.setattr(reporting_service.ReportingRecordResponse, "model_validate", lambda x: x)

    result = await service.revoke_reporting_approval(
        tenant_id=1,
        record_id=5005,
        revoked_by=8,
    )
    assert getattr(result, "status", "") == "pending"
    assert getattr(result, "rejection_reason", "x") is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batch_revoke_reporting_approval_should_clear_audit_fields(monkeypatch):
    service = ReportingService()

    r1 = types.SimpleNamespace(
        id=6001,
        tenant_id=1,
        status="approved",
        work_order_id=201,
        approved_at=datetime.now(),
        approved_by=11,
        approved_by_name="qa",
        rejection_reason="历史驳回",
        remarks=None,
    )
    r2 = types.SimpleNamespace(
        id=6002,
        tenant_id=1,
        status="approved",
        work_order_id=202,
        approved_at=datetime.now(),
        approved_by=12,
        approved_by_name="qa2",
        rejection_reason="历史驳回2",
        remarks="old",
    )
    records = {6001: r1, 6002: r2}

    async def _save():
        return None

    async def _get_record(**kwargs):
        return records.get(kwargs.get("id"))

    async def _get_user_info(_uid: int):
        return {"name": "auditor"}

    updated_work_orders = []

    async def _noop_update_progress(_tenant_id: int, work_order_id: int):
        updated_work_orders.append(work_order_id)
        return None

    r1.save = _save
    r2.save = _save
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(service, "_update_work_order_progress", _noop_update_progress)

    result = await service.batch_revoke_reporting_approval(
        tenant_id=1,
        record_ids=[6001, 6002],
        revoked_by=8,
    )

    assert result["success"] == 2
    assert r1.status == "pending" and r2.status == "pending"
    assert r1.approved_at is None and r2.approved_at is None
    assert r1.approved_by is None and r2.approved_by is None
    assert r1.approved_by_name is None and r2.approved_by_name is None
    assert r1.rejection_reason is None and r2.rejection_reason is None
    assert set(updated_work_orders) == {201, 202}


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batch_revoke_reporting_approval_should_return_partial_failure_details(monkeypatch):
    service = ReportingService()

    approved = types.SimpleNamespace(
        id=6101,
        tenant_id=1,
        status="approved",
        work_order_id=301,
        approved_at=datetime.now(),
        approved_by=11,
        approved_by_name="qa",
        rejection_reason="旧原因",
        remarks=None,
    )
    pending = types.SimpleNamespace(
        id=6102,
        tenant_id=1,
        status="pending",
        work_order_id=302,
        approved_at=None,
        approved_by=None,
        approved_by_name=None,
        rejection_reason=None,
        remarks=None,
    )
    records = {6101: approved, 6102: pending}

    async def _save():
        return None

    async def _get_record(**kwargs):
        return records.get(kwargs.get("id"))

    async def _get_user_info(_uid: int):
        return {"name": "auditor"}

    refreshed = []

    async def _noop_update_progress(_tenant_id: int, work_order_id: int):
        refreshed.append(work_order_id)
        return None

    approved.save = _save
    pending.save = _save
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(service, "_update_work_order_progress", _noop_update_progress)

    result = await service.batch_revoke_reporting_approval(
        tenant_id=1,
        record_ids=[6101, 9999, 6102],
        revoked_by=8,
    )

    assert result["total"] == 3
    assert result["success"] == 1
    assert result["failed"] == 2
    assert result["details"][0] == {"id": 6101, "status": "success"}
    assert result["details"][1] == {"id": 9999, "status": "failed", "reason": "记录不存在"}
    assert "当前状态为 pending，无法撤回审核" in result["details"][2]["reason"]
    assert refreshed == [301]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batch_revoke_reporting_approval_should_block_when_empty_ids():
    service = ReportingService()

    with pytest.raises(ValidationError, match="报工记录ID列表不能为空"):
        await service.batch_revoke_reporting_approval(
            tenant_id=1,
            record_ids=[],
            revoked_by=8,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_batch_revoke_reporting_approval_should_block_when_contains_non_positive_ids():
    service = ReportingService()

    with pytest.raises(ValidationError, match="报工记录ID必须为正整数"):
        await service.batch_revoke_reporting_approval(
            tenant_id=1,
            record_ids=[301, 0, -1],
            revoked_by=8,
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_reporting_record_should_rollback_quantities_and_status(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=7001,
        tenant_id=1,
        status="pending",
        work_order_id=401,
        operation_id=501,
        reported_quantity=Decimal("3"),
        qualified_quantity=Decimal("2"),
        unqualified_quantity=Decimal("1"),
    )
    work_order_op = types.SimpleNamespace(
        completed_quantity=Decimal("10"),
        qualified_quantity=Decimal("8"),
        unqualified_quantity=Decimal("2"),
        status="completed",
    )
    work_order = types.SimpleNamespace(
        completed_quantity=Decimal("20"),
        qualified_quantity=Decimal("15"),
        unqualified_quantity=Decimal("5"),
        status="completed",
    )

    deleted = {"called": False}
    progress_calls = []

    async def _get_record(**_kwargs):
        return record

    async def _get_work_order_op(**_kwargs):
        return work_order_op

    async def _get_work_order(**_kwargs):
        return work_order

    async def _save_noop():
        return None

    async def _delete_record():
        deleted["called"] = True
        return None

    async def _update_progress(_tenant_id: int, work_order_id: int):
        progress_calls.append(work_order_id)
        return None

    work_order_op.save = _save_noop
    work_order.save = _save_noop
    record.delete = _delete_record

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _get_work_order_op)
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _get_work_order)
    monkeypatch.setattr(service, "_update_work_order_progress", _update_progress)

    await service.delete_reporting_record(tenant_id=1, record_id=7001)

    assert work_order_op.completed_quantity == Decimal("7")
    assert work_order_op.qualified_quantity == Decimal("6")
    assert work_order_op.unqualified_quantity == Decimal("1")
    assert work_order_op.status == "in_progress"

    assert work_order.completed_quantity == Decimal("17")
    assert work_order.qualified_quantity == Decimal("13")
    assert work_order.unqualified_quantity == Decimal("4")
    assert work_order.status == "in_progress"

    assert deleted["called"] is True
    assert progress_calls == [401]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_reporting_record_should_pass_when_work_order_refs_missing(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=7002,
        tenant_id=1,
        status="pending",
        work_order_id=402,
        operation_id=502,
        reported_quantity=Decimal("1"),
        qualified_quantity=Decimal("1"),
        unqualified_quantity=Decimal("0"),
    )

    deleted = {"called": False}
    progress_calls = []

    async def _get_record(**_kwargs):
        return record

    async def _none_obj(**_kwargs):
        return None

    async def _delete_record():
        deleted["called"] = True
        return None

    async def _update_progress(_tenant_id: int, work_order_id: int):
        progress_calls.append(work_order_id)
        return None

    record.delete = _delete_record

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _none_obj)
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _none_obj)
    monkeypatch.setattr(service, "_update_work_order_progress", _update_progress)

    await service.delete_reporting_record(tenant_id=1, record_id=7002)

    assert deleted["called"] is True
    assert progress_calls == [402]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_reporting_record_should_block_when_status_approved(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=7003,
        tenant_id=1,
        status="approved",
        work_order_id=403,
        operation_id=503,
    )

    async def _get_record(**_kwargs):
        return record

    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)

    with pytest.raises(ValidationError, match="已审核通过的报工记录不允许直接删除"):
        await service.delete_reporting_record(tenant_id=1, record_id=7003)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_reporting_record_should_raise_not_found(monkeypatch):
    service = ReportingService()

    async def _none_obj(**_kwargs):
        return None

    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _none_obj)

    with pytest.raises(NotFoundError, match="报工记录不存在"):
        await service.delete_reporting_record(tenant_id=1, record_id=7999)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_reporting_record_should_not_make_operation_quantities_negative(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=7004,
        tenant_id=1,
        status="pending",
        work_order_id=404,
        operation_id=504,
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("3"),
        unqualified_quantity=Decimal("2"),
    )
    work_order_op = types.SimpleNamespace(
        completed_quantity=Decimal("1"),
        qualified_quantity=Decimal("1"),
        unqualified_quantity=Decimal("0"),
        status="completed",
    )
    work_order = types.SimpleNamespace(
        completed_quantity=Decimal("10"),
        qualified_quantity=Decimal("8"),
        unqualified_quantity=Decimal("2"),
        status="in_progress",
    )

    async def _get_record(**_kwargs):
        return record

    async def _get_work_order_op(**_kwargs):
        return work_order_op

    async def _get_work_order(**_kwargs):
        return work_order

    async def _save_noop():
        return None

    async def _delete_record():
        return None

    async def _update_progress(*_args, **_kwargs):
        return None

    work_order_op.save = _save_noop
    work_order.save = _save_noop
    record.delete = _delete_record

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _get_work_order_op)
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _get_work_order)
    monkeypatch.setattr(service, "_update_work_order_progress", _update_progress)

    await service.delete_reporting_record(tenant_id=1, record_id=7004)

    assert work_order_op.completed_quantity == Decimal("0")
    assert work_order_op.qualified_quantity == Decimal("0")
    assert work_order_op.unqualified_quantity == Decimal("0")
    assert work_order_op.status == "in_progress"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_delete_reporting_record_should_not_make_work_order_quantities_negative(monkeypatch):
    service = ReportingService()

    record = types.SimpleNamespace(
        id=7005,
        tenant_id=1,
        status="pending",
        work_order_id=405,
        operation_id=505,
        reported_quantity=Decimal("6"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("2"),
    )
    work_order_op = types.SimpleNamespace(
        completed_quantity=Decimal("8"),
        qualified_quantity=Decimal("6"),
        unqualified_quantity=Decimal("2"),
        status="in_progress",
    )
    work_order = types.SimpleNamespace(
        completed_quantity=Decimal("2"),
        qualified_quantity=Decimal("1"),
        unqualified_quantity=Decimal("1"),
        status="completed",
    )

    async def _get_record(**_kwargs):
        return record

    async def _get_work_order_op(**_kwargs):
        return work_order_op

    async def _get_work_order(**_kwargs):
        return work_order

    async def _save_noop():
        return None

    async def _delete_record():
        return None

    async def _update_progress(*_args, **_kwargs):
        return None

    work_order_op.save = _save_noop
    work_order.save = _save_noop
    record.delete = _delete_record

    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(reporting_service.WorkOrderOperation, "get_or_none", _get_work_order_op)
    monkeypatch.setattr(reporting_service.WorkOrder, "get_or_none", _get_work_order)
    monkeypatch.setattr(service, "_update_work_order_progress", _update_progress)

    await service.delete_reporting_record(tenant_id=1, record_id=7005)

    assert work_order.completed_quantity == Decimal("0")
    assert work_order.qualified_quantity == Decimal("0")
    assert work_order.unqualified_quantity == Decimal("0")
    assert work_order.status == "in_progress"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_correct_reporting_data_should_block_forbidden_audit_fields(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": True}}}

    record = types.SimpleNamespace(
        id=8001,
        tenant_id=1,
        status="pending",
        remarks=None,
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("1"),
    )
    admin = types.SimpleNamespace(is_tenant_admin=True)

    async def _get_record(**_kwargs):
        return record

    async def _get_user_info(_uid: int):
        return {"name": "admin"}

    async def _get_admin(**_kwargs):
        return admin

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr("infra.models.user.User.get_or_none", _get_admin)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)

    correct_data = types.SimpleNamespace(
        model_dump=lambda **_kwargs: {"status": "approved"},
    )
    with pytest.raises(ValidationError, match="不允许直接修改审核字段"):
        await service.correct_reporting_data(
            tenant_id=1,
            record_id=8001,
            correct_data=correct_data,
            corrected_by=7,
            correction_reason="修正",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_correct_reporting_data_should_block_invalid_quantity_relation(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": True}}}

    record = types.SimpleNamespace(
        id=8002,
        tenant_id=1,
        status="pending",
        remarks=None,
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("1"),
    )
    admin = types.SimpleNamespace(is_tenant_admin=True)

    async def _get_record(**_kwargs):
        return record

    async def _get_user_info(_uid: int):
        return {"name": "admin"}

    async def _get_admin(**_kwargs):
        return admin

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr("infra.models.user.User.get_or_none", _get_admin)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)

    correct_data = types.SimpleNamespace(
        model_dump=lambda **_kwargs: {
            "reported_quantity": Decimal("3"),
            "qualified_quantity": Decimal("2"),
            "unqualified_quantity": Decimal("2"),
        },
    )
    with pytest.raises(ValidationError, match="合格数与不合格数之和不能超过报工数量"):
        await service.correct_reporting_data(
            tenant_id=1,
            record_id=8002,
            correct_data=correct_data,
            corrected_by=7,
            correction_reason="修正",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_correct_reporting_data_should_update_and_append_remarks(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": True}}}

    before = types.SimpleNamespace(
        id=8101,
        tenant_id=1,
        work_order_id=901,
        status="pending",
        remarks="old remarks",
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("1"),
    )
    after = types.SimpleNamespace(
        id=8101,
        tenant_id=1,
        work_order_id=901,
        status="pending",
        remarks="old remarks\n[数据修正] 2026-01-01 00:00:00 由 admin 修正，原因：补录说明",
        reported_quantity=Decimal("6"),
        qualified_quantity=Decimal("5"),
        unqualified_quantity=Decimal("1"),
    )
    admin = types.SimpleNamespace(is_tenant_admin=True)
    update_payload = {}

    class _Updater:
        async def update(self, **kwargs):
            update_payload.update(kwargs)
            return 1

    async def _get_admin(**_kwargs):
        return admin

    calls = {"n": 0}

    async def _get_record(**_kwargs):
        calls["n"] += 1
        return before if calls["n"] == 1 else after

    async def _get_user_info(_uid: int):
        return {"name": "admin"}

    async def _noop_progress(*_args, **_kwargs):
        return None

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(reporting_service.ReportingRecord, "filter", lambda **_kwargs: _Updater())
    monkeypatch.setattr("infra.models.user.User.get_or_none", _get_admin)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(service, "_update_work_order_progress", _noop_progress)
    monkeypatch.setattr(reporting_service.ReportingRecordResponse, "model_validate", lambda x: x)

    correct_data = types.SimpleNamespace(
        model_dump=lambda **_kwargs: {
            "reported_quantity": Decimal("6"),
            "qualified_quantity": Decimal("5"),
            "unqualified_quantity": Decimal("1"),
        },
    )

    result = await service.correct_reporting_data(
        tenant_id=1,
        record_id=8101,
        correct_data=correct_data,
        corrected_by=7,
        correction_reason="补录说明",
    )

    assert result is after
    assert update_payload["reported_quantity"] == Decimal("6")
    assert update_payload["updated_by"] == 7
    assert update_payload["updated_by_name"] == "admin"
    assert "[数据修正]" in update_payload["remarks"]
    assert "原因：补录说明" in update_payload["remarks"]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_correct_reporting_data_should_trigger_progress_when_quantity_changed(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": True}}}

    record = types.SimpleNamespace(
        id=8102,
        tenant_id=1,
        work_order_id=902,
        status="pending",
        remarks=None,
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("1"),
    )
    admin = types.SimpleNamespace(is_tenant_admin=True)

    class _Updater:
        async def update(self, **_kwargs):
            return 1

    async def _get_admin(**_kwargs):
        return admin

    async def _get_record(**_kwargs):
        return record

    async def _get_user_info(_uid: int):
        return {"name": "admin"}

    progress_calls = []

    async def _progress(tenant_id: int, work_order_id: int):
        progress_calls.append((tenant_id, work_order_id))
        return None

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(reporting_service.ReportingRecord, "filter", lambda **_kwargs: _Updater())
    monkeypatch.setattr("infra.models.user.User.get_or_none", _get_admin)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(service, "_update_work_order_progress", _progress)
    monkeypatch.setattr(reporting_service.ReportingRecordResponse, "model_validate", lambda x: x)

    correct_data = types.SimpleNamespace(
        model_dump=lambda **_kwargs: {"reported_quantity": Decimal("7")},
    )

    await service.correct_reporting_data(
        tenant_id=1,
        record_id=8102,
        correct_data=correct_data,
        corrected_by=7,
        correction_reason="数量修正",
    )

    assert progress_calls == [(1, 902)]


@pytest.mark.unit
@pytest.mark.asyncio
async def test_correct_reporting_data_should_not_trigger_progress_when_only_remarks_changed(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": True}}}

    record = types.SimpleNamespace(
        id=8103,
        tenant_id=1,
        work_order_id=903,
        status="pending",
        remarks=None,
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("1"),
    )
    admin = types.SimpleNamespace(is_tenant_admin=True)

    class _Updater:
        async def update(self, **_kwargs):
            return 1

    async def _get_admin(**_kwargs):
        return admin

    async def _get_record(**_kwargs):
        return record

    async def _get_user_info(_uid: int):
        return {"name": "admin"}

    progress_calls = []

    async def _progress(tenant_id: int, work_order_id: int):
        progress_calls.append((tenant_id, work_order_id))
        return None

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr(reporting_service.ReportingRecord, "filter", lambda **_kwargs: _Updater())
    monkeypatch.setattr("infra.models.user.User.get_or_none", _get_admin)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)
    monkeypatch.setattr(service, "_update_work_order_progress", _progress)
    monkeypatch.setattr(reporting_service.ReportingRecordResponse, "model_validate", lambda x: x)

    correct_data = types.SimpleNamespace(
        model_dump=lambda **_kwargs: {"remarks": "only remarks"},
    )

    await service.correct_reporting_data(
        tenant_id=1,
        record_id=8103,
        correct_data=correct_data,
        corrected_by=7,
        correction_reason="备注修正",
    )

    assert progress_calls == []


@pytest.mark.unit
@pytest.mark.asyncio
async def test_correct_reporting_data_should_block_non_positive_work_hours(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": True}}}

    record = types.SimpleNamespace(
        id=8104,
        tenant_id=1,
        work_order_id=904,
        status="pending",
        remarks=None,
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("1"),
        work_hours=Decimal("2"),
    )
    admin = types.SimpleNamespace(is_tenant_admin=True)

    async def _get_admin(**_kwargs):
        return admin

    async def _get_record(**_kwargs):
        return record

    async def _get_user_info(_uid: int):
        return {"name": "admin"}

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr("infra.models.user.User.get_or_none", _get_admin)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)

    correct_data = types.SimpleNamespace(
        model_dump=lambda **_kwargs: {"work_hours": Decimal("0")},
    )

    with pytest.raises(ValidationError, match="报工工时必须大于0"):
        await service.correct_reporting_data(
            tenant_id=1,
            record_id=8104,
            correct_data=correct_data,
            corrected_by=7,
            correction_reason="工时修正",
        )


@pytest.mark.unit
@pytest.mark.asyncio
async def test_correct_reporting_data_should_block_future_reported_at(monkeypatch):
    service = ReportingService()

    class _BizConfig:
        async def get_business_config(self, _tenant_id: int):
            return {"parameters": {"reporting": {"data_correction": True}}}

    record = types.SimpleNamespace(
        id=8105,
        tenant_id=1,
        work_order_id=905,
        status="pending",
        remarks=None,
        reported_quantity=Decimal("5"),
        qualified_quantity=Decimal("4"),
        unqualified_quantity=Decimal("1"),
        work_hours=Decimal("2"),
    )
    admin = types.SimpleNamespace(is_tenant_admin=True)

    async def _get_admin(**_kwargs):
        return admin

    async def _get_record(**_kwargs):
        return record

    async def _get_user_info(_uid: int):
        return {"name": "admin"}

    monkeypatch.setattr(reporting_service, "BusinessConfigService", lambda: _BizConfig())
    monkeypatch.setattr(reporting_service, "in_transaction", lambda: _NoopTx())
    monkeypatch.setattr(reporting_service.ReportingRecord, "get_or_none", _get_record)
    monkeypatch.setattr("infra.models.user.User.get_or_none", _get_admin)
    monkeypatch.setattr(service, "get_user_info", _get_user_info)

    correct_data = types.SimpleNamespace(
        model_dump=lambda **_kwargs: {"reported_at": datetime.now() + timedelta(minutes=3)},
    )

    with pytest.raises(ValidationError, match="报工时间不能晚于当前时间"):
        await service.correct_reporting_data(
            tenant_id=1,
            record_id=8105,
            correct_data=correct_data,
            corrected_by=7,
            correction_reason="时间修正",
        )
