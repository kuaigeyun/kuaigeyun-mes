"""
客户来料登记业务服务模块

提供客户来料登记和条码映射规则相关的业务逻辑处理，包括条码解析、条码映射、来料登记等。

Author: Luigi Lu
Date: 2025-01-04
"""

import uuid
import re
from datetime import datetime
from typing import List, Optional, Dict, Any
from decimal import Decimal

from tortoise.queryset import Q
from tortoise.transactions import in_transaction

from apps.kuaizhizao.models.customer_material_registration import BarcodeMappingRule, CustomerMaterialRegistration
from apps.kuaizhizao.schemas.customer_material_registration import (
    BarcodeMappingRuleCreate,
    BarcodeMappingRuleUpdate,
    BarcodeMappingRuleResponse,
    BarcodeMappingRuleListResponse,
    CustomerMaterialRegistrationCreate,
    CustomerMaterialRegistrationResponse,
    CustomerMaterialRegistrationListResponse,
    ParseBarcodeRequest,
    ParseBarcodeResponse,
)

from apps.base_service import AppBaseService
from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class BarcodeMappingRuleService(AppBaseService[BarcodeMappingRule]):
    """
    条码映射规则服务类

    处理条码映射规则相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(BarcodeMappingRule)

    async def create_mapping_rule(
        self,
        tenant_id: int,
        rule_data: BarcodeMappingRuleCreate,
        created_by: int
    ) -> BarcodeMappingRuleResponse:
        """
        创建条码映射规则

        Args:
            tenant_id: 组织ID
            rule_data: 映射规则创建数据
            created_by: 创建人ID

        Returns:
            BarcodeMappingRuleResponse: 创建的映射规则信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 生成映射规则编码
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="BARCODE_MAPPING_RULE_CODE",
                prefix="BMR"
            )

            # 获取创建人信息
            user_info = await self.get_user_info(created_by)

            # 创建映射规则
            mapping_rule = await BarcodeMappingRule.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                code=code,
                name=rule_data.name,
                customer_id=rule_data.customer_id,
                customer_name=rule_data.customer_name,
                barcode_pattern=rule_data.barcode_pattern,
                barcode_type=rule_data.barcode_type,
                material_id=rule_data.material_id,
                material_code=rule_data.material_code,
                material_name=rule_data.material_name,
                parsing_rule=rule_data.parsing_rule,
                is_enabled=rule_data.is_enabled,
                priority=rule_data.priority,
                remarks=rule_data.remarks,
                created_by=created_by,
                created_by_name=user_info["name"],
                updated_by=created_by,
                updated_by_name=user_info["name"],
            )

            return BarcodeMappingRuleResponse.model_validate(mapping_rule)

    async def list_mapping_rules(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        customer_id: Optional[int] = None,
        is_enabled: Optional[bool] = None,
    ) -> List[BarcodeMappingRuleListResponse]:
        """
        获取条码映射规则列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            customer_id: 客户ID（可选）
            is_enabled: 是否启用（可选）

        Returns:
            List[BarcodeMappingRuleListResponse]: 映射规则列表
        """
        query = BarcodeMappingRule.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if customer_id:
            query = query.filter(customer_id=customer_id)
        if is_enabled is not None:
            query = query.filter(is_enabled=is_enabled)

        rules = await query.order_by('-priority', '-created_at').offset(skip).limit(limit)

        return [BarcodeMappingRuleListResponse.model_validate(rule) for rule in rules]


class CustomerMaterialRegistrationService(AppBaseService[CustomerMaterialRegistration]):
    """
    客户来料登记服务类

    处理客户来料登记相关的所有业务逻辑。
    """

    def __init__(self):
        super().__init__(CustomerMaterialRegistration)
        self.mapping_rule_service = BarcodeMappingRuleService()

    async def parse_barcode(
        self,
        tenant_id: int,
        parse_request: ParseBarcodeRequest
    ) -> ParseBarcodeResponse:
        """
        解析客户来料条码

        Args:
            tenant_id: 组织ID
            parse_request: 解析条码请求

        Returns:
            ParseBarcodeResponse: 解析结果

        Raises:
            ValidationError: 条码格式错误
        """
        barcode = parse_request.barcode.strip()
        if not barcode:
            raise ValidationError("条码不能为空")

        # 获取所有启用的映射规则（按优先级排序）
        query = BarcodeMappingRule.filter(
            tenant_id=tenant_id,
            is_enabled=True,
            deleted_at__isnull=True
        )

        # 如果提供了客户ID，优先匹配该客户的规则
        if parse_request.customer_id:
            query = query.filter(
                Q(customer_id=parse_request.customer_id) | Q(customer_id__isnull=True)
            )

        rules = await query.order_by('-priority', '-created_at')

        # 尝试匹配映射规则
        matched_rule = None
        parsed_data = {}
        mapped_material_id = None
        mapped_material_code = None
        mapped_material_name = None

        for rule in rules:
            try:
                # 使用正则表达式匹配条码模式
                if re.match(rule.barcode_pattern, barcode):
                    matched_rule = rule
                    mapped_material_id = rule.material_id
                    mapped_material_code = rule.material_code
                    mapped_material_name = rule.material_name

                    # 如果有解析规则，应用解析规则
                    if rule.parsing_rule:
                        # TODO: 根据解析规则从条码中提取信息
                        # 这里简化处理，假设解析规则定义了如何从条码中提取物料编码、数量等信息
                        parsed_data = {
                            "barcode": barcode,
                            "material_code": rule.material_code,
                            "material_name": rule.material_name,
                        }
                    else:
                        parsed_data = {
                            "barcode": barcode,
                            "material_code": rule.material_code,
                            "material_name": rule.material_name,
                        }

                    break
            except re.error:
                # 正则表达式错误，跳过该规则
                continue

        return ParseBarcodeResponse(
            barcode=barcode,
            barcode_type=parse_request.barcode_type or "1d",
            parsed_data=parsed_data,
            mapped_material_id=mapped_material_id,
            mapped_material_code=mapped_material_code,
            mapped_material_name=mapped_material_name,
            mapping_rule_id=matched_rule.id if matched_rule else None,
            mapping_rule_name=matched_rule.name if matched_rule else None,
        )

    async def create_registration(
        self,
        tenant_id: int,
        registration_data: CustomerMaterialRegistrationCreate,
        registered_by: int
    ) -> CustomerMaterialRegistrationResponse:
        """
        创建客户来料登记

        Args:
            tenant_id: 组织ID
            registration_data: 登记创建数据
            registered_by: 登记人ID

        Returns:
            CustomerMaterialRegistrationResponse: 创建的登记记录信息

        Raises:
            ValidationError: 数据验证失败
        """
        async with in_transaction():
            # 解析条码（如果提供了条码）
            mapped_material_id = None
            mapped_material_code = None
            mapped_material_name = None
            mapping_rule_id = None
            parsed_data = None

            if registration_data.barcode:
                try:
                    parse_result = await self.parse_barcode(
                        tenant_id=tenant_id,
                        parse_request=ParseBarcodeRequest(
                            barcode=registration_data.barcode,
                            barcode_type=registration_data.barcode_type,
                            customer_id=registration_data.customer_id,
                        )
                    )
                    mapped_material_id = parse_result.mapped_material_id
                    mapped_material_code = parse_result.mapped_material_code
                    mapped_material_name = parse_result.mapped_material_name
                    mapping_rule_id = parse_result.mapping_rule_id
                    parsed_data = parse_result.parsed_data
                except Exception as e:
                    # 解析失败，但不阻止登记
                    pass

            # 生成登记编码
            code = await self.generate_code(
                tenant_id=tenant_id,
                code_type="CUSTOMER_MATERIAL_REGISTRATION_CODE",
                prefix="CMR"
            )

            # 获取登记人信息
            user_info = await self.get_user_info(registered_by)

            # 创建登记记录
            registration = await CustomerMaterialRegistration.create(
                tenant_id=tenant_id,
                uuid=str(uuid.uuid4()),
                registration_code=code,
                customer_id=registration_data.customer_id,
                customer_name=registration_data.customer_name,
                barcode=registration_data.barcode,
                barcode_type=registration_data.barcode_type,
                parsed_data=parsed_data,
                mapped_material_id=mapped_material_id,
                mapped_material_code=mapped_material_code,
                mapped_material_name=mapped_material_name,
                mapping_rule_id=mapping_rule_id,
                quantity=registration_data.quantity,
                registration_date=registration_data.registration_date or datetime.now(),
                registered_by=registered_by,
                registered_by_name=user_info["name"],
                warehouse_id=registration_data.warehouse_id,
                warehouse_name=registration_data.warehouse_name,
                status="pending",
                remarks=registration_data.remarks,
            )

            return CustomerMaterialRegistrationResponse.model_validate(registration)

    async def list_registrations(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        customer_id: Optional[int] = None,
        status: Optional[str] = None,
        registration_date_start: Optional[datetime] = None,
        registration_date_end: Optional[datetime] = None,
    ) -> List[CustomerMaterialRegistrationListResponse]:
        """
        获取客户来料登记列表

        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            customer_id: 客户ID（可选）
            status: 状态（可选）
            registration_date_start: 登记开始日期（可选）
            registration_date_end: 登记结束日期（可选）

        Returns:
            List[CustomerMaterialRegistrationListResponse]: 登记记录列表
        """
        query = CustomerMaterialRegistration.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if customer_id:
            query = query.filter(customer_id=customer_id)
        if status:
            query = query.filter(status=status)
        if registration_date_start:
            query = query.filter(registration_date__gte=registration_date_start)
        if registration_date_end:
            query = query.filter(registration_date__lte=registration_date_end)

        registrations = await query.order_by('-registration_date').offset(skip).limit(limit)

        return [CustomerMaterialRegistrationListResponse.model_validate(reg) for reg in registrations]

    async def get_registration_by_id(
        self,
        tenant_id: int,
        registration_id: int
    ) -> CustomerMaterialRegistrationResponse:
        """
        根据ID获取客户来料登记详情

        Args:
            tenant_id: 组织ID
            registration_id: 登记记录ID

        Returns:
            CustomerMaterialRegistrationResponse: 登记记录详情

        Raises:
            NotFoundError: 登记记录不存在
        """
        registration = await CustomerMaterialRegistration.get_or_none(
            id=registration_id,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )

        if not registration:
            raise NotFoundError(f"客户来料登记记录不存在: {registration_id}")

        return CustomerMaterialRegistrationResponse.model_validate(registration)

    async def process_registration(
        self,
        tenant_id: int,
        registration_id: int,
        processed_by: int
    ) -> CustomerMaterialRegistrationResponse:
        """
        处理客户来料登记（入库）

        Args:
            tenant_id: 组织ID
            registration_id: 登记记录ID
            processed_by: 处理人ID

        Returns:
            CustomerMaterialRegistrationResponse: 处理后的登记记录信息

        Raises:
            NotFoundError: 登记记录不存在
            BusinessLogicError: 登记记录状态不允许处理
        """
        async with in_transaction():
            # 获取登记记录
            registration = await CustomerMaterialRegistration.get_or_none(
                id=registration_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not registration:
                raise NotFoundError(f"客户来料登记记录不存在: {registration_id}")

            if registration.status != "pending":
                raise BusinessLogicError(f"登记记录状态不允许处理: {registration.status}")

            # 更新状态
            registration.status = "processed"
            registration.processed_at = datetime.now()

            await registration.save()

            # TODO: 调用库存服务更新库存（待库存服务实现后补充）

            return CustomerMaterialRegistrationResponse.model_validate(registration)

    async def cancel_registration(
        self,
        tenant_id: int,
        registration_id: int,
        cancelled_by: int
    ) -> CustomerMaterialRegistrationResponse:
        """
        取消客户来料登记

        Args:
            tenant_id: 组织ID
            registration_id: 登记记录ID
            cancelled_by: 取消人ID

        Returns:
            CustomerMaterialRegistrationResponse: 取消后的登记记录信息

        Raises:
            NotFoundError: 登记记录不存在
            BusinessLogicError: 登记记录状态不允许取消
        """
        async with in_transaction():
            # 获取登记记录
            registration = await CustomerMaterialRegistration.get_or_none(
                id=registration_id,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            )

            if not registration:
                raise NotFoundError(f"客户来料登记记录不存在: {registration_id}")

            if registration.status != "pending":
                raise BusinessLogicError(f"登记记录状态不允许取消: {registration.status}")

            # 更新状态
            registration.status = "cancelled"

            await registration.save()

            return CustomerMaterialRegistrationResponse.model_validate(registration)
