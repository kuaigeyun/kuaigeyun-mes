"""
质量管理服务模块

提供质量管理相关的业务逻辑处理。

Author: Luigi Lu
Date: 2025-12-30
"""

from typing import List, Optional, Dict, Any
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

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError
from datetime import timedelta
from decimal import Decimal


class IncomingInspectionService(AppBaseService[IncomingInspection]):
    """来料检验单服务"""

    def __init__(self):
        super().__init__(IncomingInspection)

    async def create_incoming_inspection(self, tenant_id: int, inspection_data: IncomingInspectionCreate, created_by: int) -> IncomingInspectionResponse:
        """创建来料检验单"""
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "INCOMING_INSPECTION_CODE", prefix=f"IQ{today}")

            inspection = await IncomingInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return IncomingInspectionResponse.model_validate(inspection)

    async def get_incoming_inspection_by_id(self, tenant_id: int, inspection_id: int) -> IncomingInspectionResponse:
        """根据ID获取来料检验单"""
        inspection = await IncomingInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"来料检验单不存在: {inspection_id}")
        return IncomingInspectionResponse.model_validate(inspection)

    async def list_incoming_inspections(self, tenant_id: int, skip: int = 0, limit: int = 20, **filters) -> List[IncomingInspectionListResponse]:
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

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        return [IncomingInspectionListResponse.model_validate(inspection) for inspection in inspections]

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
                **inspection_data
            )

            updated_inspection = await self.get_incoming_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

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
        from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
        from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
        
        async with in_transaction():
            # 获取采购入库单
            receipt = await PurchaseReceipt.get_or_none(tenant_id=tenant_id, id=purchase_receipt_id)
            if not receipt:
                raise NotFoundError(f"采购入库单不存在: {purchase_receipt_id}")
            
            if receipt.status != '已入库':
                raise BusinessLogicError("只有已入库状态的采购入库单才能创建来料检验单")
            
            # 获取采购入库单明细
            receipt_items = await PurchaseReceiptItem.filter(
                tenant_id=tenant_id,
                receipt_id=purchase_receipt_id
            ).all()
            
            if not receipt_items:
                raise BusinessLogicError("采购入库单没有明细项")
            
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
                )
                inspections.append(IncomingInspectionResponse.model_validate(inspection))
            
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
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")

            inspection = await ProcessInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return ProcessInspectionResponse.model_validate(inspection)

    async def get_process_inspection_by_id(self, tenant_id: int, inspection_id: int) -> ProcessInspectionResponse:
        """根据ID获取过程检验单"""
        inspection = await ProcessInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"过程检验单不存在: {inspection_id}")
        return ProcessInspectionResponse.model_validate(inspection)

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

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        return [ProcessInspectionListResponse.model_validate(inspection) for inspection in inspections]

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
                **inspection_data
            )

            updated_inspection = await self.get_process_inspection_by_id(tenant_id, inspection_id)
            
            # 自动更新报工合格数
            if inspection.work_order_id:
                await self._update_reporting_qualified_quantity(
                    tenant_id=tenant_id,
                    work_order_id=inspection.work_order_id,
                    operation_id=inspection.operation_id,
                    qualified_quantity=qualified_quantity
                )
            
            return updated_inspection

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
        created_by: int
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
        from apps.kuaizhizao.models.work_order import WorkOrder
        from apps.master_data.models.routing import RoutingOperation
        
        async with in_transaction():
            # 获取工单
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")
            
            # 获取工序
            operation = await RoutingOperation.get_or_none(tenant_id=tenant_id, id=operation_id)
            if not operation:
                raise NotFoundError(f"工序不存在: {operation_id}")
            
            # 检查是否已存在检验单
            existing = await ProcessInspection.filter(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                operation_id=operation_id,
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
                operation_id=operation_id
            ).order_by('-created_at').first()
            
            inspection_quantity = reporting.completed_quantity if reporting else work_order.planned_quantity
            
            inspection = await ProcessInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                operation_id=operation_id,
                operation_code=operation.operation_code,
                operation_name=operation.operation_name,
                workshop_id=work_order.workshop_id,
                workshop_name=work_order.workshop_name,
                material_id=work_order.material_id,
                material_code=work_order.material_code,
                material_name=work_order.material_name,
                material_spec=work_order.material_spec,
                batch_number=work_order.batch_number,
                inspection_quantity=inspection_quantity,
                qualified_quantity=0,
                unqualified_quantity=0,
                inspection_result="待检验",
                quality_status="待判定",
                status="待检验",
                created_by=created_by,
            )
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
        
        success_count = 0
        failure_count = 0
        errors = []
        
        for row_idx, row in enumerate(data[2:], start=3):
            try:
                work_order_code = str(row[header_index_map['work_order_code']]).strip()
                from apps.kuaizhizao.models.work_order import WorkOrder
                work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, code=work_order_code)
                if not work_order:
                    raise ValidationError(f"工单不存在: {work_order_code}")
                
                operation_code = str(row[header_index_map['operation_code']]).strip()
                from apps.master_data.models.routing import RoutingOperation
                operation = await RoutingOperation.get_or_none(tenant_id=tenant_id, operation_code=operation_code)
                if not operation:
                    raise ValidationError(f"工序不存在: {operation_code}")
                
                existing = await ProcessInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id,
                    operation_id=operation.id
                ).first()
                
                if existing:
                    continue
                
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "PROCESS_INSPECTION_CODE", prefix=f"PQ{today}")
                
                inspection_quantity = float(row[header_index_map.get('inspection_quantity', -1)]) if header_index_map.get('inspection_quantity', -1) >= 0 and row[header_index_map.get('inspection_quantity', -1)] else work_order.planned_quantity
                qualified_quantity = float(row[header_index_map.get('qualified_quantity', -1)]) if header_index_map.get('qualified_quantity', -1) >= 0 and row[header_index_map.get('qualified_quantity', -1)] else 0
                unqualified_quantity = float(row[header_index_map.get('unqualified_quantity', -1)]) if header_index_map.get('unqualified_quantity', -1) >= 0 and row[header_index_map.get('unqualified_quantity', -1)] else 0
                notes = str(row[header_index_map.get('notes', -1)]) if header_index_map.get('notes', -1) >= 0 and row[header_index_map.get('notes', -1)] else None
                
                await ProcessInspection.create(
                    tenant_id=tenant_id,
                    inspection_code=code,
                    work_order_id=work_order.id,
                    work_order_code=work_order.code,
                    operation_id=operation.id,
                    operation_code=operation.operation_code,
                    operation_name=operation.operation_name,
                    workshop_id=work_order.workshop_id,
                    workshop_name=work_order.workshop_name,
                    material_id=work_order.material_id,
                    material_code=work_order.material_code,
                    material_name=work_order.material_name,
                    material_spec=work_order.material_spec,
                    batch_number=work_order.batch_number,
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
        async with in_transaction():
            user_info = await self.get_user_info(created_by)
            today = datetime.now().strftime("%Y%m%d")
            code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")

            inspection = await FinishedGoodsInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                created_by=created_by,
                created_by_name=user_info["name"],
                **inspection_data.model_dump(exclude_unset=True, exclude={'created_by'})
            )
            return FinishedGoodsInspectionResponse.model_validate(inspection)

    async def get_finished_goods_inspection_by_id(self, tenant_id: int, inspection_id: int) -> FinishedGoodsInspectionResponse:
        """根据ID获取成品检验单"""
        inspection = await FinishedGoodsInspection.get_or_none(tenant_id=tenant_id, id=inspection_id)
        if not inspection:
            raise NotFoundError(f"成品检验单不存在: {inspection_id}")
        return FinishedGoodsInspectionResponse.model_validate(inspection)

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

        inspections = await query.offset(skip).limit(limit).order_by('-created_at')
        return [FinishedGoodsInspectionListResponse.model_validate(inspection) for inspection in inspections]

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
                **inspection_data
            )

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)
            return updated_inspection

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

            updated_inspection = await self.get_finished_goods_inspection_by_id(tenant_id, inspection_id)
            
            # 检验结果处理：合格数量允许入库，不良数量不允许入库
            # 这里可以触发入库流程，但只允许合格数量入库
            if qualified_quantity > 0:
                logger.info(f"成品检验完成，合格数量{qualified_quantity}允许入库，不合格数量{unqualified_quantity}不允许入库")
            
            return updated_inspection

    async def create_inspection_from_work_order(
        self,
        tenant_id: int,
        work_order_id: int,
        created_by: int
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
        from apps.kuaizhizao.models.work_order import WorkOrder
        
        async with in_transaction():
            # 获取工单
            work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, id=work_order_id)
            if not work_order:
                raise NotFoundError(f"工单不存在: {work_order_id}")
            
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
            
            inspection = await FinishedGoodsInspection.create(
                tenant_id=tenant_id,
                inspection_code=code,
                source_type="work_order",
                source_id=work_order_id,
                source_code=work_order.code,
                work_order_id=work_order_id,
                work_order_code=work_order.code,
                sales_order_id=work_order.sales_order_id,
                sales_order_code=work_order.sales_order_code,
                customer_id=work_order.customer_id,
                customer_name=work_order.customer_name,
                material_id=work_order.material_id,
                material_code=work_order.material_code,
                material_name=work_order.material_name,
                material_spec=work_order.material_spec,
                batch_number=work_order.batch_number,
                inspection_quantity=work_order.planned_quantity,
                qualified_quantity=0,
                unqualified_quantity=0,
                inspection_result="待检验",
                quality_status="待判定",
                status="待检验",
                created_by=created_by,
            )
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
        
        success_count = 0
        failure_count = 0
        errors = []
        
        for row_idx, row in enumerate(data[2:], start=3):
            try:
                work_order_code = str(row[header_index_map['work_order_code']]).strip()
                from apps.kuaizhizao.models.work_order import WorkOrder
                work_order = await WorkOrder.get_or_none(tenant_id=tenant_id, code=work_order_code)
                if not work_order:
                    raise ValidationError(f"工单不存在: {work_order_code}")
                
                existing = await FinishedGoodsInspection.filter(
                    tenant_id=tenant_id,
                    work_order_id=work_order.id
                ).first()
                
                if existing:
                    continue
                
                today = datetime.now().strftime("%Y%m%d")
                code = await self.generate_code(tenant_id, "FINISHED_GOODS_INSPECTION_CODE", prefix=f"FQ{today}")
                
                inspection_quantity = float(row[header_index_map.get('inspection_quantity', -1)]) if header_index_map.get('inspection_quantity', -1) >= 0 and row[header_index_map.get('inspection_quantity', -1)] else work_order.planned_quantity
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
                    customer_id=work_order.customer_id,
                    customer_name=work_order.customer_name,
                    material_id=work_order.material_id,
                    material_code=work_order.material_code,
                    material_name=work_order.material_name,
                    material_spec=work_order.material_spec,
                    batch_number=work_order.batch_number,
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
        supplier_id: Optional[int] = None
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
        return anomalies

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

        return stats

