"""
采购合同服务模块

提供采购合同的业务逻辑处理，支持多组织隔离。
"""

from typing import List, Optional
from datetime import datetime
from apps.kuaisrm.models.purchase_contract import PurchaseContract
from apps.kuaisrm.schemas.purchase_contract_schemas import (
    PurchaseContractCreate, PurchaseContractUpdate, PurchaseContractResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class PurchaseContractService:
    """采购合同服务"""
    
    @staticmethod
    async def create_purchase_contract(
        tenant_id: int,
        data: PurchaseContractCreate
    ) -> PurchaseContractResponse:
        """
        创建采购合同
        
        Args:
            tenant_id: 租户ID
            data: 合同创建数据
            
        Returns:
            PurchaseContractResponse: 创建的合同对象
            
        Raises:
            ValidationError: 当编号已存在时抛出
        """
        # 检查编号是否已存在
        existing = await PurchaseContract.filter(
            tenant_id=tenant_id,
            contract_no=data.contract_no,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"合同编号 {data.contract_no} 已存在")
        
        # 创建合同
        contract = await PurchaseContract.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return PurchaseContractResponse.model_validate(contract)
    
    @staticmethod
    async def get_purchase_contract_by_uuid(
        tenant_id: int,
        contract_uuid: str
    ) -> PurchaseContractResponse:
        """
        根据UUID获取采购合同
        
        Args:
            tenant_id: 租户ID
            contract_uuid: 合同UUID
            
        Returns:
            PurchaseContractResponse: 合同对象
            
        Raises:
            NotFoundError: 当合同不存在时抛出
        """
        contract = await PurchaseContract.filter(
            tenant_id=tenant_id,
            uuid=contract_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not contract:
            raise NotFoundError(f"采购合同 {contract_uuid} 不存在")
        
        return PurchaseContractResponse.model_validate(contract)
    
    @staticmethod
    async def list_purchase_contracts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        status: Optional[str] = None,
        supplier_id: Optional[int] = None
    ) -> List[PurchaseContractResponse]:
        """
        获取采购合同列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            status: 合同状态（过滤）
            supplier_id: 供应商ID（过滤）
            
        Returns:
            List[PurchaseContractResponse]: 合同列表
        """
        query = PurchaseContract.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if status:
            query = query.filter(status=status)
        if supplier_id:
            query = query.filter(supplier_id=supplier_id)
        
        contracts = await query.offset(skip).limit(limit).order_by("-created_at")
        
        return [PurchaseContractResponse.model_validate(contract) for contract in contracts]
    
    @staticmethod
    async def update_purchase_contract(
        tenant_id: int,
        contract_uuid: str,
        data: PurchaseContractUpdate
    ) -> PurchaseContractResponse:
        """
        更新采购合同
        
        Args:
            tenant_id: 租户ID
            contract_uuid: 合同UUID
            data: 合同更新数据
            
        Returns:
            PurchaseContractResponse: 更新后的合同对象
            
        Raises:
            NotFoundError: 当合同不存在时抛出
        """
        contract = await PurchaseContract.filter(
            tenant_id=tenant_id,
            uuid=contract_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not contract:
            raise NotFoundError(f"采购合同 {contract_uuid} 不存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(contract, key, value)
        
        await contract.save()
        
        return PurchaseContractResponse.model_validate(contract)
    
    @staticmethod
    async def delete_purchase_contract(
        tenant_id: int,
        contract_uuid: str
    ) -> None:
        """
        删除采购合同（软删除）
        
        Args:
            tenant_id: 租户ID
            contract_uuid: 合同UUID
            
        Raises:
            NotFoundError: 当合同不存在时抛出
        """
        contract = await PurchaseContract.filter(
            tenant_id=tenant_id,
            uuid=contract_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not contract:
            raise NotFoundError(f"采购合同 {contract_uuid} 不存在")
        
        contract.deleted_at = datetime.utcnow()
        await contract.save()
