"""
期初数据导入服务模块

提供期初数据导入的业务逻辑处理，包括期初库存、在制品、应收应付的导入。

Author: Luigi Lu
Date: 2026-01-15
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
import uuid
from tortoise.transactions import in_transaction
from tortoise.expressions import Q
from loguru import logger

from apps.kuaizhizao.models.purchase_receipt import PurchaseReceipt
from apps.kuaizhizao.models.purchase_receipt_item import PurchaseReceiptItem
from apps.kuaizhizao.models.work_order import WorkOrder
from apps.kuaizhizao.models.work_order_operation import WorkOrderOperation
from apps.kuaizhizao.models.receivable import Receivable
from apps.kuaizhizao.models.payable import Payable
from apps.master_data.models.material import Material
from apps.master_data.models.warehouse import Warehouse
from apps.master_data.models.factory import Workshop
from apps.master_data.models.process import Operation
from apps.master_data.models.customer import Customer
from apps.master_data.models.supplier import Supplier
from apps.master_data.services.material_code_mapping_service import MaterialCodeMappingService
from apps.master_data.schemas.material_schemas import MaterialCodeConvertRequest
from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError


class InitialDataService:
    """
    期初数据导入服务类
    
    提供期初库存、在制品、应收应付的导入功能。
    """

    async def import_initial_inventory(
        self,
        tenant_id: int,
        data: List[List[Any]],  # 二维数组数据（从 uni_import 组件传递）
        snapshot_time: Optional[datetime] = None,
        created_by: int = 1
    ) -> Dict[str, Any]:
        """
        导入期初库存
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建期初库存入库单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 组织ID
            data: 二维数组数据（从 uni_import 组件传递）
            snapshot_time: 快照时间点（可选，用于标记期初数据的时间点）
            created_by: 创建人ID
            
        Returns:
            dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '物料编码': 'material_code',
            '*物料编码': 'material_code',
            'material_code': 'material_code',
            '*material_code': 'material_code',
            '仓库编码': 'warehouse_code',
            '*仓库编码': 'warehouse_code',
            'warehouse_code': 'warehouse_code',
            '*warehouse_code': 'warehouse_code',
            '期初数量': 'quantity',
            '*期初数量': 'quantity',
            'quantity': 'quantity',
            '*quantity': 'quantity',
            '期初金额': 'amount',
            'amount': 'amount',
            '批次号': 'batch_number',
            'batch_number': 'batch_number',
            '库位编码': 'location_code',
            'location_code': 'location_code',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['material_code', 'warehouse_code', 'quantity']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        # 用于批量创建入库单（按仓库分组）
        receipts_by_warehouse: Dict[str, Dict[str, Any]] = {}
        
        async with in_transaction():
            for row, row_idx in non_empty_rows:
                try:
                    # 解析行数据
                    row_data = {}
                    for field, col_idx in header_index_map.items():
                        if col_idx < len(row):
                            value = row[col_idx]
                            if value is not None:
                                row_data[field] = str(value).strip()
                    
                    # 验证必填字段
                    if not row_data.get('material_code'):
                        errors.append({
                            "row": row_idx,
                            "error": "物料编码为空"
                        })
                        failure_count += 1
                        continue
                    
                    if not row_data.get('warehouse_code'):
                        errors.append({
                            "row": row_idx,
                            "error": "仓库编码为空"
                        })
                        failure_count += 1
                        continue
                    
                    if not row_data.get('quantity'):
                        errors.append({
                            "row": row_idx,
                            "error": "期初数量为空"
                        })
                        failure_count += 1
                        continue
                    
                    # 转换物料编码（支持部门编码，自动映射到主编码）
                    material_code = row_data['material_code']
                    try:
                        # 尝试通过编码映射转换
                        convert_request = MaterialCodeConvertRequest(
                            external_code=material_code,
                            external_system="期初数据导入"
                        )
                        convert_result = await MaterialCodeMappingService.convert_code(
                            tenant_id=tenant_id,
                            request=convert_request
                        )
                        if convert_result.found:
                            material_code = convert_result.internal_code
                    except Exception as e:
                        logger.warning(f"物料编码映射转换失败: {material_code}, 错误: {e}")
                        # 如果映射失败，继续使用原始编码
                    
                    # 查找物料
                    material = await Material.filter(
                        tenant_id=tenant_id,
                        code=material_code,
                        deleted_at__isnull=True
                    ).first()
                    
                    if not material:
                        errors.append({
                            "row": row_idx,
                            "error": f"物料不存在: {material_code}"
                        })
                        failure_count += 1
                        continue
                    
                    # 查找仓库
                    warehouse = await Warehouse.filter(
                        tenant_id=tenant_id,
                        code=row_data['warehouse_code'],
                        deleted_at__isnull=True
                    ).first()
                    
                    if not warehouse:
                        errors.append({
                            "row": row_idx,
                            "error": f"仓库不存在: {row_data['warehouse_code']}"
                        })
                        failure_count += 1
                        continue
                    
                    # 解析数量
                    try:
                        quantity = Decimal(str(row_data['quantity']))
                        if quantity <= 0:
                            raise ValueError("数量必须大于0")
                    except (ValueError, TypeError) as e:
                        errors.append({
                            "row": row_idx,
                            "error": f"期初数量格式错误: {row_data['quantity']}"
                        })
                        failure_count += 1
                        continue
                    
                    # 解析金额（可选）
                    amount = Decimal('0')
                    if row_data.get('amount'):
                        try:
                            amount = Decimal(str(row_data['amount']))
                        except (ValueError, TypeError):
                            # 金额格式错误，使用0
                            pass
                    
                    # 按仓库分组，准备批量创建入库单
                    warehouse_key = f"{warehouse.id}_{warehouse.code}"
                    if warehouse_key not in receipts_by_warehouse:
                        receipts_by_warehouse[warehouse_key] = {
                            'warehouse': warehouse,
                            'items': []
                        }
                    
                    receipts_by_warehouse[warehouse_key]['items'].append({
                        'material': material,
                        'quantity': quantity,
                        'amount': amount,
                        'batch_number': row_data.get('batch_number'),
                        'location_code': row_data.get('location_code'),
                        'row_idx': row_idx,
                    })
                    
                except Exception as e:
                    logger.error(f"处理第 {row_idx} 行数据时出错: {e}")
                    errors.append({
                        "row": row_idx,
                        "error": f"处理数据时出错: {str(e)}"
                    })
                    failure_count += 1
                    continue
            
            # 批量创建期初库存入库单
            for warehouse_key, receipt_data in receipts_by_warehouse.items():
                warehouse = receipt_data['warehouse']
                items = receipt_data['items']
                
                try:
                    # 生成入库单编码
                    today = datetime.now().strftime("%Y%m%d")
                    from apps.base_service import AppBaseService
                    base_service = AppBaseService(PurchaseReceipt)
                    receipt_code = await base_service.generate_code(
                        tenant_id, 
                        "PURCHASE_RECEIPT_CODE", 
                        prefix=f"INIT-INV{today}"
                    )
                    
                    # 计算总数量和总金额
                    total_quantity = sum(item['quantity'] for item in items)
                    total_amount = sum(item['amount'] for item in items)
                    
                    # 创建期初库存入库单（标记为"期初库存"）
                    receipt = await PurchaseReceipt.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        receipt_code=receipt_code,
                        purchase_order_id=0,  # 期初库存没有关联采购订单
                        purchase_order_code="期初库存",
                        supplier_id=0,
                        supplier_name="期初库存导入",
                        warehouse_id=warehouse.id,
                        warehouse_name=warehouse.name,
                        receipt_time=snapshot_time or datetime.now(),
                        status="已入库",  # 期初库存直接标记为已入库
                        review_status="已审核",  # 期初库存直接标记为已审核
                        total_quantity=float(total_quantity),
                        total_amount=float(total_amount),
                        notes=f"期初库存导入（快照时间点：{snapshot_time.strftime('%Y-%m-%d %H:%M:%S') if snapshot_time else '未指定'}）",
                        created_by=created_by,
                        updated_by=created_by,
                    )
                    
                    # 创建入库单明细
                    for item in items:
                        await PurchaseReceiptItem.create(
                            tenant_id=tenant_id,
                            receipt_id=receipt.id,
                            purchase_order_item_id=0,  # 期初库存没有关联采购订单明细
                            material_id=item['material'].id,
                            material_code=item['material'].code,
                            material_name=item['material'].name,
                            material_spec=getattr(item['material'], 'specification', None),
                            material_unit=item['material'].base_unit,
                            receipt_quantity=item['quantity'],
                            qualified_quantity=item['quantity'],  # 期初库存默认为合格数量
                            unqualified_quantity=Decimal('0'),
                            unit_price=item['amount'] / item['quantity'] if item['quantity'] > 0 else Decimal('0'),
                            total_amount=item['amount'],
                            quality_status="合格",
                            batch_number=item.get('batch_number'),
                            location_code=item.get('location_code'),
                            status="已入库",
                        )
                    
                    success_count += len(items)
                    
                except Exception as e:
                    logger.error(f"创建期初库存入库单失败（仓库：{warehouse.code}）: {e}")
                    # 记录所有相关行的错误
                    for item in items:
                        errors.append({
                            "row": item['row_idx'],
                            "error": f"创建入库单失败: {str(e)}"
                        })
                        failure_count += 1
                    success_count -= len(items)
        
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
            "total": success_count + failure_count,
        }

    async def import_initial_wip(
        self,
        tenant_id: int,
        data: List[List[Any]],  # 二维数组数据（从 uni_import 组件传递）
        snapshot_time: Optional[datetime] = None,
        created_by: int = 1
    ) -> Dict[str, Any]:
        """
        导入期初在制品
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建期初在制品工单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 组织ID
            data: 二维数组数据（从 uni_import 组件传递）
            snapshot_time: 快照时间点（可选，用于标记期初数据的时间点）
            created_by: 创建人ID
            
        Returns:
            dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '工单号': 'work_order_code',
            'work_order_code': 'work_order_code',
            '产品编码': 'product_code',
            '*产品编码': 'product_code',
            'product_code': 'product_code',
            '*product_code': 'product_code',
            '当前工序': 'current_operation',
            '*当前工序': 'current_operation',
            'current_operation': 'current_operation',
            '*current_operation': 'current_operation',
            '在制品数量': 'wip_quantity',
            '*在制品数量': 'wip_quantity',
            'wip_quantity': 'wip_quantity',
            '*wip_quantity': 'wip_quantity',
            '已投入数量': 'input_quantity',
            'input_quantity': 'input_quantity',
            '预计完成时间': 'estimated_completion_time',
            'estimated_completion_time': 'estimated_completion_time',
            '车间编码': 'workshop_code',
            'workshop_code': 'workshop_code',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['product_code', 'current_operation', 'wip_quantity']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        async with in_transaction():
            
            for row, row_idx in non_empty_rows:
                try:
                    # 解析行数据
                    row_data = {}
                    for field, col_idx in header_index_map.items():
                        if col_idx < len(row):
                            value = row[col_idx]
                            if value is not None:
                                row_data[field] = str(value).strip()
                    
                    # 验证必填字段
                    if not row_data.get('product_code'):
                        errors.append({
                            "row": row_idx,
                            "error": "产品编码为空"
                        })
                        failure_count += 1
                        continue
                    
                    if not row_data.get('current_operation'):
                        errors.append({
                            "row": row_idx,
                            "error": "当前工序为空"
                        })
                        failure_count += 1
                        continue
                    
                    if not row_data.get('wip_quantity'):
                        errors.append({
                            "row": row_idx,
                            "error": "在制品数量为空"
                        })
                        failure_count += 1
                        continue
                    
                    # 转换产品编码（支持部门编码，自动映射到主编码）
                    product_code = row_data['product_code']
                    try:
                        convert_request = MaterialCodeConvertRequest(
                            external_code=product_code,
                            external_system="期初数据导入"
                        )
                        convert_result = await MaterialCodeMappingService.convert_code(
                            tenant_id=tenant_id,
                            request=convert_request
                        )
                        if convert_result.found:
                            product_code = convert_result.internal_code
                    except Exception as e:
                        logger.warning(f"产品编码映射转换失败: {product_code}, 错误: {e}")
                    
                    # 查找产品（物料）
                    product = await Material.filter(
                        tenant_id=tenant_id,
                        code=product_code,
                        deleted_at__isnull=True
                    ).first()
                    
                    if not product:
                        errors.append({
                            "row": row_idx,
                            "error": f"产品不存在: {product_code}"
                        })
                        failure_count += 1
                        continue
                    
                    # 查找当前工序
                    current_operation_code = row_data['current_operation']
                    operation = await Operation.filter(
                        tenant_id=tenant_id,
                        code=current_operation_code,
                        deleted_at__isnull=True
                    ).first()
                    
                    if not operation:
                        errors.append({
                            "row": row_idx,
                            "error": f"工序不存在: {current_operation_code}"
                        })
                        failure_count += 1
                        continue
                    
                    # 解析在制品数量
                    try:
                        wip_quantity = Decimal(str(row_data['wip_quantity']))
                        if wip_quantity <= 0:
                            raise ValueError("在制品数量必须大于0")
                    except (ValueError, TypeError) as e:
                        errors.append({
                            "row": row_idx,
                            "error": f"在制品数量格式错误: {row_data['wip_quantity']}"
                        })
                        failure_count += 1
                        continue
                    
                    # 解析已投入数量（可选）
                    input_quantity = Decimal('0')
                    if row_data.get('input_quantity'):
                        try:
                            input_quantity = Decimal(str(row_data['input_quantity']))
                        except (ValueError, TypeError):
                            pass
                    
                    # 解析预计完成时间（可选）
                    estimated_completion_time = None
                    if row_data.get('estimated_completion_time'):
                        try:
                            from datetime import datetime as dt
                            # 尝试多种日期格式
                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                try:
                                    estimated_completion_time = dt.strptime(row_data['estimated_completion_time'], fmt)
                                    break
                                except ValueError:
                                    continue
                        except Exception:
                            pass
                    
                    # 查找车间（可选）
                    workshop = None
                    if row_data.get('workshop_code'):
                        workshop = await Workshop.filter(
                            tenant_id=tenant_id,
                            code=row_data['workshop_code'],
                            deleted_at__isnull=True
                        ).first()
                    
                    # 生成工单编码（如果未提供）
                    work_order_code = row_data.get('work_order_code')
                    if not work_order_code:
                        today = datetime.now().strftime("%Y%m%d")
                        base_service = AppBaseService(WorkOrder)
                        work_order_code = await base_service.generate_code(
                            tenant_id,
                            "WORK_ORDER_CODE",
                            prefix=f"INIT-WIP{today}"
                        )
                    
                    # 检查工单是否已存在
                    existing_work_order = await WorkOrder.filter(
                        tenant_id=tenant_id,
                        code=work_order_code,
                        deleted_at__isnull=True
                    ).first()
                    
                    if existing_work_order:
                        errors.append({
                            "row": row_idx,
                            "error": f"工单已存在: {work_order_code}"
                        })
                        failure_count += 1
                        continue
                    
                    # 创建期初在制品工单（标记为"期初在制品"）
                    work_order = await WorkOrder.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        code=work_order_code,
                        name=f"期初在制品-{product.name}",
                        product_id=product.id,
                        product_code=product.code,
                        product_name=product.name,
                        quantity=wip_quantity,
                        production_mode="MTS",
                        workshop_id=workshop.id if workshop else None,
                        workshop_name=workshop.name if workshop else None,
                        status="进行中",  # 期初在制品直接标记为进行中
                        priority="normal",
                        actual_start_date=snapshot_time or datetime.now(),
                        completed_quantity=Decimal('0'),
                        qualified_quantity=Decimal('0'),
                        unqualified_quantity=Decimal('0'),
                        remarks=f"期初在制品导入（快照时间点：{snapshot_time.strftime('%Y-%m-%d %H:%M:%S') if snapshot_time else '未指定'}，当前工序：{operation.name}）",
                        created_by=created_by,
                        updated_by=created_by,
                    )
                    
                    # 创建工单工序（当前工序标记为进行中）
                    await WorkOrderOperation.create(
                        tenant_id=tenant_id,
                        uuid=str(uuid.uuid4()),
                        work_order_id=work_order.id,
                        work_order_code=work_order.code,
                        operation_id=operation.id,
                        operation_code=operation.code,
                        operation_name=operation.name,
                        sequence=1,  # 期初在制品只有一个当前工序
                        workshop_id=workshop.id if workshop else None,
                        workshop_name=workshop.name if workshop else None,
                        actual_start_date=snapshot_time or datetime.now(),
                        completed_quantity=Decimal('0'),  # 当前工序未完成
                        qualified_quantity=Decimal('0'),
                        unqualified_quantity=Decimal('0'),
                        status="进行中",
                        remarks=f"期初在制品，在制品数量：{wip_quantity}",
                    )
                    
                    # TODO: 如果提供了已投入数量，可以创建生产领料单记录
                    # 这里暂时不实现，因为需要更复杂的BOM展开逻辑
                    
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"处理第 {row_idx} 行数据时出错: {e}")
                    errors.append({
                        "row": row_idx,
                        "error": f"处理数据时出错: {str(e)}"
                    })
                    failure_count += 1
                    continue
        
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
            "total": success_count + failure_count,
        }

    async def import_initial_receivables_payables(
        self,
        tenant_id: int,
        data: List[List[Any]],  # 二维数组数据（从 uni_import 组件传递）
        snapshot_time: Optional[datetime] = None,
        created_by: int = 1
    ) -> Dict[str, Any]:
        """
        导入期初应收应付
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建期初应收/应付单。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 组织ID
            data: 二维数组数据（从 uni_import 组件传递）
            snapshot_time: 快照时间点（可选，用于标记期初数据的时间点）
            created_by: 创建人ID
            
        Returns:
            dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '类型': 'type', '*类型': 'type', 'type': 'type',
            '客户编码': 'customer_code', 'customer_code': 'customer_code',
            '供应商编码': 'supplier_code', 'supplier_code': 'supplier_code',
            '单据类型': 'source_type', '*单据类型': 'source_type', 'source_type': 'source_type',
            '单据号': 'source_code', '*单据号': 'source_code', 'source_code': 'source_code',
            '单据日期': 'business_date', '*单据日期': 'business_date', 'business_date': 'business_date',
            '应收金额': 'receivable_amount', 'receivable_amount': 'receivable_amount',
            '应付金额': 'payable_amount', 'payable_amount': 'payable_amount',
            '已收金额': 'received_amount', 'received_amount': 'received_amount',
            '已付金额': 'paid_amount', 'paid_amount': 'paid_amount',
            '到期日期': 'due_date', 'due_date': 'due_date',
            '发票号': 'invoice_number', 'invoice_number': 'invoice_number',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['type', 'source_type', 'source_code', 'business_date']
        missing_fields = [f for f in required_fields if f not in header_index_map]
        if missing_fields:
            raise ValidationError(f"缺少必填字段：{', '.join(missing_fields)}")
        
        # 解析数据行（从第三行开始，索引2，跳过表头和示例数据行）
        rows = data[2:] if len(data) > 2 else []
        
        # 过滤空行
        non_empty_rows = [
            (row, idx + 3) for idx, row in enumerate(rows)
            if any(cell is not None and str(cell).strip() for cell in row)
        ]
        
        if not non_empty_rows:
            raise ValidationError("没有可导入的数据行（所有行都为空）")
        
        success_count = 0
        failure_count = 0
        errors = []
        
        async with in_transaction():
            for row, row_idx in non_empty_rows:
                try:
                    # 解析行数据
                    row_data = {}
                    for field, col_idx in header_index_map.items():
                        if col_idx < len(row):
                            value = row[col_idx]
                            if value is not None:
                                row_data[field] = str(value).strip()
                    
                    # 验证类型
                    if not row_data.get('type'):
                        errors.append({"row": row_idx, "error": "类型为空（应收/应付）"})
                        failure_count += 1
                        continue
                    
                    data_type = row_data['type'].strip().upper()
                    if data_type not in ['应收', '应付', 'RECEIVABLE', 'PAYABLE', 'AR', 'AP']:
                        errors.append({"row": row_idx, "error": f"类型错误: {row_data['type']}，应为'应收'或'应付'"})
                        failure_count += 1
                        continue
                    
                    is_receivable = data_type in ['应收', 'RECEIVABLE', 'AR']
                    
                    # 验证客户/供应商编码
                    if is_receivable:
                        if not row_data.get('customer_code'):
                            errors.append({"row": row_idx, "error": "客户编码为空"})
                            failure_count += 1
                            continue
                    else:
                        if not row_data.get('supplier_code'):
                            errors.append({"row": row_idx, "error": "供应商编码为空"})
                            failure_count += 1
                            continue
                    
                    # 验证其他必填字段
                    for field in ['source_type', 'source_code', 'business_date']:
                        if not row_data.get(field):
                            errors.append({"row": row_idx, "error": f"{field}为空"})
                            failure_count += 1
                            break
                    else:
                        # 解析金额和日期
                        from datetime import datetime as dt, date
                        
                        # 解析金额
                        if is_receivable:
                            if not row_data.get('receivable_amount'):
                                errors.append({"row": row_idx, "error": "应收金额为空"})
                                failure_count += 1
                                continue
                            try:
                                total_amount = Decimal(str(row_data['receivable_amount']))
                                if total_amount <= 0:
                                    raise ValueError("应收金额必须大于0")
                            except (ValueError, TypeError):
                                errors.append({"row": row_idx, "error": f"应收金额格式错误: {row_data['receivable_amount']}"})
                                failure_count += 1
                                continue
                            
                            received_amount = Decimal('0')
                            if row_data.get('received_amount'):
                                try:
                                    received_amount = Decimal(str(row_data['received_amount']))
                                except (ValueError, TypeError):
                                    pass
                            remaining_amount = total_amount - received_amount
                        else:
                            if not row_data.get('payable_amount'):
                                errors.append({"row": row_idx, "error": "应付金额为空"})
                                failure_count += 1
                                continue
                            try:
                                total_amount = Decimal(str(row_data['payable_amount']))
                                if total_amount <= 0:
                                    raise ValueError("应付金额必须大于0")
                            except (ValueError, TypeError):
                                errors.append({"row": row_idx, "error": f"应付金额格式错误: {row_data['payable_amount']}"})
                                failure_count += 1
                                continue
                            
                            paid_amount = Decimal('0')
                            if row_data.get('paid_amount'):
                                try:
                                    paid_amount = Decimal(str(row_data['paid_amount']))
                                except (ValueError, TypeError):
                                    pass
                            remaining_amount = total_amount - paid_amount
                        
                        # 解析日期
                        try:
                            business_date_str = row_data['business_date']
                            business_date = None
                            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d', '%Y-%m-%d %H:%M:%S']:
                                try:
                                    business_date = dt.strptime(business_date_str, fmt).date()
                                    break
                                except ValueError:
                                    continue
                            if not business_date:
                                raise ValueError(f"日期格式错误: {business_date_str}")
                        except Exception:
                            errors.append({"row": row_idx, "error": f"单据日期格式错误: {row_data['business_date']}"})
                            failure_count += 1
                            continue
                        
                        # 解析到期日期（可选）
                        due_date = business_date
                        if row_data.get('due_date'):
                            try:
                                due_date_str = row_data['due_date']
                                for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y.%m.%d']:
                                    try:
                                        due_date = dt.strptime(due_date_str, fmt).date()
                                        break
                                    except ValueError:
                                        continue
                            except Exception:
                                pass
                        
                        # 查找客户/供应商并创建应收/应付单
                        if is_receivable:
                            customer = await Customer.filter(
                                tenant_id=tenant_id,
                                code=row_data['customer_code'],
                                deleted_at__isnull=True
                            ).first()
                            
                            if not customer:
                                errors.append({"row": row_idx, "error": f"客户不存在: {row_data['customer_code']}"})
                                failure_count += 1
                                continue
                            
                            # 生成应收单编码
                            today = datetime.now().strftime("%Y%m%d")
                            base_service = AppBaseService(Receivable)
                            receivable_code = await base_service.generate_code(
                                tenant_id, "RECEIVABLE_CODE", prefix=f"INIT-AR{today}"
                            )
                            
                            # 创建期初应收单
                            await Receivable.create(
                                tenant_id=tenant_id,
                                uuid=str(uuid.uuid4()),
                                receivable_code=receivable_code,
                                source_type=row_data['source_type'],
                                source_id=0,
                                source_code=row_data['source_code'],
                                customer_id=customer.id,
                                customer_name=customer.name,
                                total_amount=total_amount,
                                received_amount=received_amount,
                                remaining_amount=remaining_amount,
                                due_date=due_date,
                                status="未收款" if remaining_amount > 0 else "已收款",
                                business_date=business_date,
                                invoice_issued=bool(row_data.get('invoice_number')),
                                invoice_number=row_data.get('invoice_number'),
                                review_status="已审核",
                                notes=f"期初应收导入（快照时间点：{snapshot_time.strftime('%Y-%m-%d %H:%M:%S') if snapshot_time else '未指定'}）",
                                created_by=created_by,
                                updated_by=created_by,
                            )
                            success_count += 1
                        else:
                            supplier = await Supplier.filter(
                                tenant_id=tenant_id,
                                code=row_data['supplier_code'],
                                deleted_at__isnull=True
                            ).first()
                            
                            if not supplier:
                                errors.append({"row": row_idx, "error": f"供应商不存在: {row_data['supplier_code']}"})
                                failure_count += 1
                                continue
                            
                            # 生成应付单编码
                            today = datetime.now().strftime("%Y%m%d")
                            base_service = AppBaseService(Payable)
                            payable_code = await base_service.generate_code(
                                tenant_id, "PAYABLE_CODE", prefix=f"INIT-AP{today}"
                            )
                            
                            # 创建期初应付单
                            await Payable.create(
                                tenant_id=tenant_id,
                                uuid=str(uuid.uuid4()),
                                payable_code=payable_code,
                                source_type=row_data['source_type'],
                                source_id=0,
                                source_code=row_data['source_code'],
                                supplier_id=supplier.id,
                                supplier_name=supplier.name,
                                total_amount=total_amount,
                                paid_amount=paid_amount,
                                remaining_amount=remaining_amount,
                                due_date=due_date,
                                status="未付款" if remaining_amount > 0 else "已付款",
                                business_date=business_date,
                                invoice_received=bool(row_data.get('invoice_number')),
                                invoice_number=row_data.get('invoice_number'),
                                review_status="已审核",
                                notes=f"期初应付导入（快照时间点：{snapshot_time.strftime('%Y-%m-%d %H:%M:%S') if snapshot_time else '未指定'}）",
                                created_by=created_by,
                                updated_by=created_by,
                            )
                            success_count += 1
                    
                except Exception as e:
                    logger.error(f"处理第 {row_idx} 行数据时出错: {e}")
                    errors.append({"row": row_idx, "error": f"处理数据时出错: {str(e)}"})
                    failure_count += 1
                    continue
        
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
            "total": success_count + failure_count,
        }

