"""
服务合同服务模块

提供服务合同的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from apps.kuaicrm.models.service_contract import ServiceContract
from apps.kuaicrm.schemas.service_contract_schemas import (
    ServiceContractCreate, ServiceContractUpdate, ServiceContractResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ServiceContractService:
    """服务合同服务"""
    
    @staticmethod
    async def create_contract(
        tenant_id: int,
        data: ServiceContractCreate
    ) -> ServiceContractResponse:
        """
        创建服务合同
        
        Args:
            tenant_id: 租户ID
            data: 合同创建数据
            
        Returns:
            ServiceContractResponse: 创建的合同对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await ServiceContract.filter(
            tenant_id=tenant_id,
            contract_no=data.contract_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"合同编号 {data.contract_no} 已存在")
        
        # 创建合同
        contract = await ServiceContract.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ServiceContractResponse.model_validate(contract)
    
    @staticmethod
    async def get_contract_by_uuid(
        tenant_id: int,
        contract_uuid: str
    ) -> ServiceContractResponse:
        """
        根据UUID获取服务合同
        
        Args:
            tenant_id: 租户ID
            contract_uuid: 合同UUID
            
        Returns:
            ServiceContractResponse: 合同对象
            
        Raises:
            NotFoundError: 当合同不存在时抛出
        """
        contract = await ServiceContract.filter(
            tenant_id=tenant_id,
            uuid=contract_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not contract:
            raise NotFoundError(f"合同 {contract_uuid} 不存在")
        
        return ServiceContractResponse.model_validate(contract)
    
    @staticmethod
    async def list_contracts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        contract_status: Optional[str] = None,
        customer_id: Optional[int] = None
    ) -> List[ServiceContractResponse]:
        """
        获取服务合同列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            contract_status: 合同状态（过滤）
            customer_id: 客户ID（过滤）
            
        Returns:
            List[ServiceContractResponse]: 合同列表
        """
        query = ServiceContract.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if contract_status:
            query = query.filter(contract_status=contract_status)
        if customer_id:
            query = query.filter(customer_id=customer_id)
        
        contracts = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [ServiceContractResponse.model_validate(c) for c in contracts]
    
    @staticmethod
    async def update_contract(
        tenant_id: int,
        contract_uuid: str,
        data: ServiceContractUpdate
    ) -> ServiceContractResponse:
        """
        更新服务合同
        
        Args:
            tenant_id: 租户ID
            contract_uuid: 合同UUID
            data: 合同更新数据
            
        Returns:
            ServiceContractResponse: 更新后的合同对象
            
        Raises:
            NotFoundError: 当合同不存在时抛出
        """
        contract = await ServiceContract.filter(
            tenant_id=tenant_id,
            uuid=contract_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not contract:
            raise NotFoundError(f"合同 {contract_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(contract, key, value)
        
        await contract.save()
        
        return ServiceContractResponse.model_validate(contract)
    
    @staticmethod
    async def delete_contract(
        tenant_id: int,
        contract_uuid: str
    ) -> None:
        """
        删除服务合同（软删除）
        
        Args:
            tenant_id: 租户ID
            contract_uuid: 合同UUID
            
        Raises:
            NotFoundError: 当合同不存在时抛出
        """
        contract = await ServiceContract.filter(
            tenant_id=tenant_id,
            uuid=contract_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not contract:
            raise NotFoundError(f"合同 {contract_uuid} 不存在")
        
        from datetime import datetime
        contract.deleted_at = datetime.utcnow()
        await contract.save()
