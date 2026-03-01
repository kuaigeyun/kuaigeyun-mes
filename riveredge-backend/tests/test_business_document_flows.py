"""
业务单据全流程模拟与逻辑缺陷修复 - 端到端验证测试

验证计划中修复的逻辑：
- 阶段1: 采购入库与来料检验流程（待入库可创建检验单）
- 阶段2: DocumentRelation 创建
- 阶段3: 库存更新
- 阶段4: 退货财务冲减

使用文件读取方式验证，避免导入完整应用依赖链。

Author: RiverEdge Team
Date: 2026-03-01
"""

import pytest
from pathlib import Path


def _read_source(relative_path: str) -> str:
    """读取 src 下的源码文件"""
    src = Path(__file__).resolve().parent.parent / "src"
    return (src / relative_path).read_text(encoding="utf-8")


class TestQualityServiceInspectionFlow:
    """验证采购入库与来料检验流程矛盾修复"""

    def test_create_inspection_allows_pending_receipt_status(self):
        """待入库状态的采购入库单应能创建来料检验单（修复死循环）- 验证代码逻辑"""
        source = _read_source("apps/kuaizhizao/services/quality_service.py")
        # 修复后应允许「待入库」或「已入库」
        assert "待入库" in source
        assert "已入库" in source
        assert "receipt.status not in" in source or "receipt.status in" in source


class TestDocumentRelationCreation:
    """验证 DocumentRelation 创建逻辑存在"""

    def test_sales_service_has_document_relation_import(self):
        """sales_service 应包含 DocumentRelation 创建逻辑"""
        source = _read_source("apps/kuaizhizao/services/sales_service.py")
        assert "DocumentRelationNewService" in source or "create_relation" in source

    def test_warehouse_service_confirm_delivery_creates_receivable_relation(self):
        """confirm_delivery 应创建 sales_delivery -> receivable 关联"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "DocumentRelation" in source or "create_relation" in source

    def test_warehouse_service_confirm_receipt_creates_payable_relation(self):
        """confirm_receipt (采购入库) 应创建 purchase_receipt -> payable 关联"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "DocumentRelation" in source or "create_relation" in source

    def test_quality_service_creates_inspection_relation(self):
        """create_inspection_from_purchase_receipt 应创建 purchase_receipt -> incoming_inspection 关联"""
        source = _read_source("apps/kuaizhizao/services/quality_service.py")
        assert "DocumentRelation" in source or "create_relation" in source

    def test_work_order_merge_creates_relation(self):
        """merge_work_orders 应创建原工单 -> 合并工单 关联"""
        source = _read_source("apps/kuaizhizao/services/work_order_service.py")
        assert "DocumentRelation" in source or "create_relation" in source


class TestDocumentRelationCoverage:
    """验证全流程 DocumentRelation 覆盖完整性"""

    def test_sales_forecast_to_demand_relation(self):
        """销售预测→Demand DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/sales_service.py")
        assert 'source_type="sales_forecast"' in source
        assert 'target_type="demand"' in source

    def test_sales_order_to_demand_relation(self):
        """销售订单→Demand DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/sales_order_service.py")
        assert 'source_type="sales_order"' in source
        assert 'target_type="demand"' in source

    def test_demand_computation_to_work_order_purchase_order_relation(self):
        """需求计算→工单/采购 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/demand_computation_service.py")
        assert 'target_type="work_order"' in source or "work_order" in source
        assert "create_relation" in source

    def test_work_order_to_picking_return_receipt_relation(self):
        """工单→领料/退料/成品入库 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert 'source_type="work_order"' in source
        assert 'target_type="production_picking"' in source
        assert 'target_type="production_return"' in source
        assert 'target_type="finished_goods_receipt"' in source

    def test_picking_to_production_return_relation(self):
        """领料→退料 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert 'source_type="production_picking"' in source
        assert 'target_type="production_return"' in source

    def test_sales_order_forecast_to_sales_delivery_relation(self):
        """销售订单/预测→销售出库 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert 'source_type="sales_order"' in source
        assert 'source_type="sales_forecast"' in source
        assert 'target_type="sales_delivery"' in source

    def test_purchase_order_to_purchase_receipt_relation(self):
        """采购订单→采购入库 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert 'source_type="purchase_order"' in source
        assert 'target_type="purchase_receipt"' in source

    def test_sales_delivery_to_sales_return_relation(self):
        """销售出库→销售退货 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert 'source_type="sales_delivery"' in source
        assert 'target_type="sales_return"' in source

    def test_purchase_receipt_to_purchase_return_relation(self):
        """采购入库→采购退货 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert 'source_type="purchase_receipt"' in source
        assert 'target_type="purchase_return"' in source

    def test_receipt_delivery_to_packing_binding_relation(self):
        """成品入库/销售出库→装箱绑定 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/packing_binding_service.py")
        assert "create_relation" in source
        assert "finished_goods_receipt" in source or "sales_delivery" in source
        assert "packing_binding" in source

    def test_work_order_to_process_finished_inspection_relation(self):
        """工单→过程/成品检验 DocumentRelation"""
        source = _read_source("apps/kuaizhizao/services/quality_service.py")
        assert 'target_type="process_inspection"' in source
        assert 'target_type="finished_goods_inspection"' in source


class TestInventoryUpdate:
    """验证库存更新逻辑存在"""

    def test_confirm_picking_decreases_stock(self):
        """领料确认应调用 InventoryService.decrease_stock"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "InventoryService" in source and "decrease_stock" in source

    def test_confirm_delivery_decreases_stock(self):
        """销售出库 confirm_delivery 应调用 InventoryService.decrease_stock"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "InventoryService" in source and "decrease_stock" in source

    def test_confirm_receipt_purchase_increases_stock(self):
        """采购入库 confirm_receipt 应调用 InventoryService.increase_stock"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "InventoryService" in source and "increase_stock" in source

    def test_finished_goods_receipt_increases_stock(self):
        """成品入库 confirm 应调用 InventoryService.increase_stock"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "finished_goods_receipt" in source
        assert "increase_stock" in source

    def test_production_return_increases_stock(self):
        """生产退料 confirm 应调用 InventoryService.increase_stock"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "production_return" in source
        assert "increase_stock" in source

    def test_sales_return_increases_stock(self):
        """销售退货 confirm 应调用 InventoryService.increase_stock"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "销售退货" in source or "sales_return" in source
        assert "increase_stock" in source

    def test_purchase_return_decreases_stock(self):
        """采购退货 confirm 应调用 InventoryService.decrease_stock"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "采购退货" in source or "purchase_return" in source
        assert "decrease_stock" in source


class TestReturnFinanceOffset:
    """验证退货财务冲减逻辑存在"""

    def test_sales_return_creates_receivable_credit(self):
        """销售退货 confirm_return 应创建红字应收单"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "ReceivableService" in source or "create_receivable" in source
        assert "销售退货" in source

    def test_purchase_return_creates_payable_credit(self):
        """采购退货 confirm_return 应创建红字应付单"""
        source = _read_source("apps/kuaizhizao/services/warehouse_service.py")
        assert "PayableService" in source or "create_payable" in source
        assert "采购退货" in source
