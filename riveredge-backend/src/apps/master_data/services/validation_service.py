"""
数据验证服务模块

提供基础数据完整性验证功能，用于MES创建工单前的数据校验。
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from apps.master_data.models.product import Product
from apps.master_data.models.material import Material
from apps.master_data.models.process import ProcessRoute, Operation
from infra.exceptions.exceptions import ValidationError


@dataclass
class ValidationResult:
    """验证结果"""

    is_valid: bool
    errors: List[str]
    warnings: List[str]

    def __init__(self):
        self.is_valid = True
        self.errors = []
        self.warnings = []

    def add_error(self, message: str):
        """添加错误信息"""
        self.errors.append(message)
        self.is_valid = False

    def add_warning(self, message: str):
        """添加警告信息"""
        self.warnings.append(message)


class DataValidationService:
    """数据验证服务"""

    @staticmethod
    async def validate_product_for_work_order(
        tenant_id: int,
        product_id: int
    ) -> ValidationResult:
        """
        验证产品是否可以用于创建工单

        检查产品是否存在、是否启用，以及相关的基础数据完整性。

        Args:
            tenant_id: 租户ID
            product_id: 产品ID

        Returns:
            ValidationResult: 验证结果
        """
        result = ValidationResult()

        # 1. 检查产品是否存在
        product = await Product.filter(
            tenant_id=tenant_id,
            id=product_id,
            deleted_at__isnull=True
        ).first()

        if not product:
            result.add_error(f"产品ID {product_id} 不存在")
            return result

        # 2. 检查产品是否启用
        if not product.is_active:
            result.add_error(f"产品 {product.code} - {product.name} 未启用")
            return result

        # 3. 检查产品是否有BOM数据
        if not product.bom_data:
            result.add_warning(f"产品 {product.code} 没有BOM数据")
        else:
            # 验证BOM数据的完整性
            await DataValidationService._validate_product_bom_data(tenant_id, product, result)

        # 4. 检查产品是否有工艺路线关联
        if not product.process_route_ids:
            result.add_warning(f"产品 {product.code} 没有关联的工艺路线")
        else:
            # 验证工艺路线的有效性
            await DataValidationService._validate_product_process_routes(tenant_id, product, result)

        return result

    @staticmethod
    async def _validate_product_bom_data(
        tenant_id: int,
        product: Product,
        result: ValidationResult
    ) -> None:
        """
        验证产品BOM数据的完整性

        Args:
            tenant_id: 租户ID
            product: 产品对象
            result: 验证结果对象
        """
        try:
            bom_data = product.bom_data
            if not isinstance(bom_data, dict):
                result.add_error(f"产品 {product.code} 的BOM数据格式不正确")
                return

            items = bom_data.get("items", [])
            if not items:
                result.add_warning(f"产品 {product.code} 的BOM数据为空")
                return

            # 检查每个BOM项的物料是否存在
            for item in items:
                if not isinstance(item, dict):
                    result.add_error(f"产品 {product.code} 的BOM项格式不正确")
                    continue

                material_id = item.get("material_id") or item.get("materialId")
                if not material_id:
                    result.add_error(f"产品 {product.code} 的BOM项缺少物料ID")
                    continue

                # 检查物料是否存在且启用
                material = await Material.filter(
                    tenant_id=tenant_id,
                    id=material_id,
                    deleted_at__isnull=True
                ).first()

                if not material:
                    result.add_error(f"产品 {product.code} 的BOM中引用的物料ID {material_id} 不存在")
                elif not material.is_active:
                    result.add_warning(f"产品 {product.code} 的BOM中引用的物料 {material.code} 未启用")

        except Exception as e:
            result.add_error(f"验证产品 {product.code} 的BOM数据时发生错误: {str(e)}")

    @staticmethod
    async def _validate_product_process_routes(
        tenant_id: int,
        product: Product,
        result: ValidationResult
    ) -> None:
        """
        验证产品关联工艺路线的有效性

        Args:
            tenant_id: 租户ID
            product: 产品对象
            result: 验证结果对象
        """
        try:
            process_route_ids = product.process_route_ids
            if not isinstance(process_route_ids, list):
                result.add_error(f"产品 {product.code} 的工艺路线关联数据格式不正确")
                return

            if not process_route_ids:
                result.add_warning(f"产品 {product.code} 的工艺路线关联列表为空")
                return

            # 检查每个工艺路线是否存在且启用
            for route_id in process_route_ids:
                if not isinstance(route_id, int):
                    result.add_error(f"产品 {product.code} 的工艺路线ID {route_id} 格式不正确")
                    continue

                process_route = await ProcessRoute.filter(
                    tenant_id=tenant_id,
                    id=route_id,
                    deleted_at__isnull=True
                ).first()

                if not process_route:
                    result.add_error(f"产品 {product.code} 关联的工艺路线ID {route_id} 不存在")
                elif not process_route.is_active:
                    result.add_warning(f"产品 {product.code} 关联的工艺路线 {process_route.code} 未启用")
                else:
                    # 验证工艺路线的工序数据
                    await DataValidationService._validate_process_route_operations(tenant_id, process_route, result)

        except Exception as e:
            result.add_error(f"验证产品 {product.code} 的工艺路线关联时发生错误: {str(e)}")

    @staticmethod
    async def _validate_process_route_operations(
        tenant_id: int,
        process_route: ProcessRoute,
        result: ValidationResult
    ) -> None:
        """
        验证工艺路线中工序的有效性

        Args:
            tenant_id: 租户ID
            process_route: 工艺路线对象
            result: 验证结果对象
        """
        try:
            if not process_route.operation_sequence:
                result.add_warning(f"工艺路线 {process_route.code} 没有工序序列数据")
                return

            # 解析工序序列
            operation_ids = DataValidationService._extract_operation_ids_from_sequence(process_route.operation_sequence)

            if not operation_ids:
                result.add_warning(f"工艺路线 {process_route.code} 的工序序列为空")
                return

            # 检查每个工序是否存在且启用
            for op_id in operation_ids:
                operation = await Operation.filter(
                    tenant_id=tenant_id,
                    id=op_id,
                    deleted_at__isnull=True
                ).first()

                if not operation:
                    result.add_error(f"工艺路线 {process_route.code} 中引用的工序ID {op_id} 不存在")
                elif not operation.is_active:
                    result.add_warning(f"工艺路线 {process_route.code} 中引用的工序 {operation.code} 未启用")

        except Exception as e:
            result.add_error(f"验证工艺路线 {process_route.code} 的工序数据时发生错误: {str(e)}")

    @staticmethod
    def _extract_operation_ids_from_sequence(operation_sequence: Any) -> List[int]:
        """
        从工序序列中提取工序ID列表

        Args:
            operation_sequence: 工序序列数据

        Returns:
            List[int]: 工序ID列表
        """
        operation_ids = []

        try:
            if isinstance(operation_sequence, list):
                # 列表格式：[{"operation_id": 1, "sequence": 1}, ...]
                for item in operation_sequence:
                    if isinstance(item, dict):
                        op_id = item.get("operation_id") or item.get("operationId")
                        if op_id and isinstance(op_id, int):
                            operation_ids.append(op_id)
            elif isinstance(operation_sequence, dict):
                # 字典格式：{"1": {"sequence": 1}, ...} 或 {"operation_ids": [1, 2, 3]}
                if "operation_ids" in operation_sequence or "operationIds" in operation_sequence:
                    op_ids = operation_sequence.get("operation_ids") or operation_sequence.get("operationIds", [])
                    if isinstance(op_ids, list):
                        operation_ids.extend([op_id for op_id in op_ids if isinstance(op_id, int)])
                else:
                    for key, value in operation_sequence.items():
                        if isinstance(value, dict):
                            op_id = value.get("operation_id") or value.get("operationId") or (int(key) if key.isdigit() else None)
                        else:
                            op_id = int(key) if key.isdigit() else None

                        if op_id and isinstance(op_id, int):
                            operation_ids.append(op_id)
        except Exception:
            # 如果解析失败，返回空列表
            pass

        return list(set(operation_ids))  # 去重

    @staticmethod
    async def validate_work_order_data_integrity(
        tenant_id: int,
        product_id: int,
        process_route_id: Optional[int] = None
    ) -> ValidationResult:
        """
        验证工单数据的完整性

        这是MES创建工单前的主要验证方法，检查产品、工艺路线等数据的完整性。

        Args:
            tenant_id: 租户ID
            product_id: 产品ID
            process_route_id: 工艺路线ID（可选，如果指定则额外验证）

        Returns:
            ValidationResult: 验证结果
        """
        result = ValidationResult()

        # 1. 验证产品
        product_result = await DataValidationService.validate_product_for_work_order(tenant_id, product_id)
        result.errors.extend(product_result.errors)
        result.warnings.extend(product_result.warnings)
        result.is_valid = result.is_valid and product_result.is_valid

        # 2. 如果指定了工艺路线，额外验证工艺路线
        if process_route_id:
            route_result = await DataValidationService.validate_process_route_for_work_order(tenant_id, process_route_id)
            result.errors.extend(route_result.errors)
            result.warnings.extend(route_result.warnings)
            result.is_valid = result.is_valid and route_result.is_valid

        return result

    @staticmethod
    async def validate_process_route_for_work_order(
        tenant_id: int,
        process_route_id: int
    ) -> ValidationResult:
        """
        验证工艺路线是否可以用于创建工单

        Args:
            tenant_id: 租户ID
            process_route_id: 工艺路线ID

        Returns:
            ValidationResult: 验证结果
        """
        result = ValidationResult()

        # 1. 检查工艺路线是否存在
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            id=process_route_id,
            deleted_at__isnull=True
        ).first()

        if not process_route:
            result.add_error(f"工艺路线ID {process_route_id} 不存在")
            return result

        # 2. 检查工艺路线是否启用
        if not process_route.is_active:
            result.add_error(f"工艺路线 {process_route.code} - {process_route.name} 未启用")
            return result

        # 3. 验证工序数据
        await DataValidationService._validate_process_route_operations(tenant_id, process_route, result)

        return result
