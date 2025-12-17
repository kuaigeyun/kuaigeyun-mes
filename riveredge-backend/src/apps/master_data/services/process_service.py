"""
工艺数据服务模块

提供工艺数据的业务逻辑处理（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

from typing import List, Optional, Dict, Any

from apps.master_data.models.process import DefectType, Operation, ProcessRoute, SOP
from apps.master_data.schemas.process_schemas import (
    DefectTypeCreate, DefectTypeUpdate, DefectTypeResponse,
    OperationCreate, OperationUpdate, OperationResponse,
    ProcessRouteCreate, ProcessRouteUpdate, ProcessRouteResponse,
    SOPCreate, SOPUpdate, SOPResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProcessService:
    """工艺数据服务"""
    
    # ==================== 不良品相关方法 ====================
    
    @staticmethod
    async def create_defect_type(
        tenant_id: int,
        data: DefectTypeCreate
    ) -> DefectTypeResponse:
        """
        创建不良品
        
        Args:
            tenant_id: 租户ID
            data: 不良品创建数据
            
        Returns:
            DefectTypeResponse: 创建的不良品对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await DefectType.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"不良品编码 {data.code} 已存在")
        
        # 创建不良品
        defect_type = await DefectType.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return DefectTypeResponse.model_validate(defect_type)
    
    @staticmethod
    async def get_defect_type_by_uuid(
        tenant_id: int,
        defect_type_uuid: str
    ) -> DefectTypeResponse:
        """
        根据UUID获取不良品
        
        Args:
            tenant_id: 租户ID
            defect_type_uuid: 不良品UUID
            
        Returns:
            DefectTypeResponse: 不良品对象
            
        Raises:
            NotFoundError: 当不良品不存在时抛出
        """
        defect_type = await DefectType.filter(
            tenant_id=tenant_id,
            uuid=defect_type_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not defect_type:
            raise NotFoundError(f"不良品 {defect_type_uuid} 不存在")
        
        return DefectTypeResponse.model_validate(defect_type)
    
    @staticmethod
    async def list_defect_types(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[DefectTypeResponse]:
        """
        获取不良品列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            category: 分类（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[DefectTypeResponse]: 不良品列表
        """
        query = DefectType.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if category is not None:
            query = query.filter(category=category)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        defect_types = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [DefectTypeResponse.model_validate(dt) for dt in defect_types]
    
    @staticmethod
    async def update_defect_type(
        tenant_id: int,
        defect_type_uuid: str,
        data: DefectTypeUpdate
    ) -> DefectTypeResponse:
        """
        更新不良品
        
        Args:
            tenant_id: 租户ID
            defect_type_uuid: 不良品UUID
            data: 不良品更新数据
            
        Returns:
            DefectTypeResponse: 更新后的不良品对象
            
        Raises:
            NotFoundError: 当不良品不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        defect_type = await DefectType.filter(
            tenant_id=tenant_id,
            uuid=defect_type_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not defect_type:
            raise NotFoundError(f"不良品 {defect_type_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != defect_type.code:
            existing = await DefectType.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"不良品编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(defect_type, key, value)
        
        await defect_type.save()
        
        return DefectTypeResponse.model_validate(defect_type)
    
    @staticmethod
    async def delete_defect_type(
        tenant_id: int,
        defect_type_uuid: str
    ) -> None:
        """
        删除不良品（软删除）
        
        Args:
            tenant_id: 租户ID
            defect_type_uuid: 不良品UUID
            
        Raises:
            NotFoundError: 当不良品不存在时抛出
        """
        defect_type = await DefectType.filter(
            tenant_id=tenant_id,
            uuid=defect_type_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not defect_type:
            raise NotFoundError(f"不良品 {defect_type_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        defect_type.deleted_at = timezone.now()
        await defect_type.save()
    
    # ==================== 工序相关方法 ====================
    
    @staticmethod
    async def create_operation(
        tenant_id: int,
        data: OperationCreate
    ) -> OperationResponse:
        """
        创建工序
        
        Args:
            tenant_id: 租户ID
            data: 工序创建数据
            
        Returns:
            OperationResponse: 创建的工序对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await Operation.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工序编码 {data.code} 已存在")
        
        # 创建工序
        operation = await Operation.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return OperationResponse.model_validate(operation)
    
    @staticmethod
    async def get_operation_by_uuid(
        tenant_id: int,
        operation_uuid: str
    ) -> OperationResponse:
        """
        根据UUID获取工序
        
        Args:
            tenant_id: 租户ID
            operation_uuid: 工序UUID
            
        Returns:
            OperationResponse: 工序对象
            
        Raises:
            NotFoundError: 当工序不存在时抛出
        """
        operation = await Operation.filter(
            tenant_id=tenant_id,
            uuid=operation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not operation:
            raise NotFoundError(f"工序 {operation_uuid} 不存在")
        
        return OperationResponse.model_validate(operation)
    
    @staticmethod
    async def list_operations(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[OperationResponse]:
        """
        获取工序列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[OperationResponse]: 工序列表
        """
        query = Operation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        operations = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [OperationResponse.model_validate(op) for op in operations]
    
    @staticmethod
    async def update_operation(
        tenant_id: int,
        operation_uuid: str,
        data: OperationUpdate
    ) -> OperationResponse:
        """
        更新工序
        
        Args:
            tenant_id: 租户ID
            operation_uuid: 工序UUID
            data: 工序更新数据
            
        Returns:
            OperationResponse: 更新后的工序对象
            
        Raises:
            NotFoundError: 当工序不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        operation = await Operation.filter(
            tenant_id=tenant_id,
            uuid=operation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not operation:
            raise NotFoundError(f"工序 {operation_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != operation.code:
            existing = await Operation.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"工序编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(operation, key, value)
        
        await operation.save()
        
        return OperationResponse.model_validate(operation)
    
    @staticmethod
    async def delete_operation(
        tenant_id: int,
        operation_uuid: str
    ) -> None:
        """
        删除工序（软删除）
        
        Args:
            tenant_id: 租户ID
            operation_uuid: 工序UUID
            
        Raises:
            NotFoundError: 当工序不存在时抛出
            ValidationError: 当工序被工艺路线或SOP使用时抛出
        """
        operation = await Operation.filter(
            tenant_id=tenant_id,
            uuid=operation_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not operation:
            raise NotFoundError(f"工序 {operation_uuid} 不存在")
        
        # 检查是否被SOP使用
        sops_count = await SOP.filter(
            tenant_id=tenant_id,
            operation_id=operation.id,
            deleted_at__isnull=True
        ).count()
        
        if sops_count > 0:
            raise ValidationError(f"工序被 {sops_count} 个SOP使用，无法删除")
        
        # 软删除
        from tortoise import timezone
        operation.deleted_at = timezone.now()
        await operation.save()
    
    # ==================== 工艺路线相关方法 ====================
    
    @staticmethod
    async def create_process_route(
        tenant_id: int,
        data: ProcessRouteCreate
    ) -> ProcessRouteResponse:
        """
        创建工艺路线
        
        Args:
            tenant_id: 租户ID
            data: 工艺路线创建数据
            
        Returns:
            ProcessRouteResponse: 创建的工艺路线对象
            
        Raises:
            ValidationError: 当编码已存在时抛出
        """
        # 检查编码是否已存在
        existing = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工艺路线编码 {data.code} 已存在")
        
        # 创建工艺路线
        process_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return ProcessRouteResponse.model_validate(process_route)
    
    @staticmethod
    async def get_process_route_by_uuid(
        tenant_id: int,
        process_route_uuid: str
    ) -> ProcessRouteResponse:
        """
        根据UUID获取工艺路线
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            
        Returns:
            ProcessRouteResponse: 工艺路线对象
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
        """
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        return ProcessRouteResponse.model_validate(process_route)
    
    @staticmethod
    async def list_process_routes(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None
    ) -> List[ProcessRouteResponse]:
        """
        获取工艺路线列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            is_active: 是否启用（可选）
            
        Returns:
            List[ProcessRouteResponse]: 工艺路线列表
        """
        query = ProcessRoute.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        process_routes = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [ProcessRouteResponse.model_validate(pr) for pr in process_routes]
    
    @staticmethod
    async def update_process_route(
        tenant_id: int,
        process_route_uuid: str,
        data: ProcessRouteUpdate
    ) -> ProcessRouteResponse:
        """
        更新工艺路线
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            data: 工艺路线更新数据
            
        Returns:
            ProcessRouteResponse: 更新后的工艺路线对象
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
            ValidationError: 当编码已存在时抛出
        """
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != process_route.code:
            existing = await ProcessRoute.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"工艺路线编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(process_route, key, value)
        
        await process_route.save()
        
        return ProcessRouteResponse.model_validate(process_route)
    
    @staticmethod
    async def delete_process_route(
        tenant_id: int,
        process_route_uuid: str
    ) -> None:
        """
        删除工艺路线（软删除）
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
        """
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        process_route.deleted_at = timezone.now()
        await process_route.save()
    
    # ==================== 级联查询相关方法 ====================
    
    @staticmethod
    async def get_process_route_tree(
        tenant_id: int,
        is_active: Optional[bool] = None
    ) -> List["ProcessRouteTreeResponse"]:
        """
        获取工艺路线树形结构（工艺路线→工序）
        
        返回完整的工艺路线层级结构，每个工艺路线包含其工序序列中的工序信息。
        用于级联选择等场景。
        
        Args:
            tenant_id: 租户ID
            is_active: 是否只查询启用的数据（可选）
            
        Returns:
            List[ProcessRouteTreeResponse]: 工艺路线树形列表，每个工艺路线包含工序列表（按序列顺序）
        """
        # 延迟导入避免循环依赖
        from apps.master_data.schemas.process_schemas import (
            ProcessRouteTreeResponse,
            OperationTreeResponse
        )
        
        # 查询所有工艺路线
        route_query = ProcessRoute.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            route_query = route_query.filter(is_active=is_active)
        
        process_routes = await route_query.order_by("code").all()
        
        # 查询所有工序（用于构建映射）
        operation_query = Operation.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        if is_active is not None:
            operation_query = operation_query.filter(is_active=is_active)
        
        operations = await operation_query.all()
        
        # 构建工序映射（按ID）
        operation_map: Dict[int, Operation] = {op.id: op for op in operations}
        
        # 构建工艺路线树形结构
        result: List[ProcessRouteTreeResponse] = []
        for route in process_routes:
            # 创建工艺路线响应对象
            route_response = ProcessRouteTreeResponse.model_validate(route)
            route_response.operations = []
            
            # 解析工序序列（JSON格式）
            if route.operation_sequence:
                # operation_sequence 可能是列表或字典格式
                # 假设格式为: [{"operation_id": 1, "sequence": 1}, ...] 或 {"1": {"sequence": 1}, ...}
                sequence_data = route.operation_sequence
                
                # 处理不同的JSON格式
                operation_list = []
                if isinstance(sequence_data, list):
                    # 列表格式：[{"operation_id": 1, "sequence": 1}, ...]
                    for item in sequence_data:
                        if isinstance(item, dict):
                            op_id = item.get("operation_id") or item.get("operationId")
                            if op_id and op_id in operation_map:
                                operation_list.append((item.get("sequence", 0), operation_map[op_id]))
                elif isinstance(sequence_data, dict):
                    # 字典格式：{"1": {"sequence": 1}, ...} 或 {"operation_ids": [1, 2, 3]}
                    if "operation_ids" in sequence_data or "operationIds" in sequence_data:
                        # 简单列表格式
                        op_ids = sequence_data.get("operation_ids") or sequence_data.get("operationIds", [])
                        for idx, op_id in enumerate(op_ids):
                            if op_id in operation_map:
                                operation_list.append((idx, operation_map[op_id]))
                    else:
                        # 键值对格式
                        for key, value in sequence_data.items():
                            if isinstance(value, dict):
                                op_id = value.get("operation_id") or value.get("operationId") or int(key)
                            else:
                                op_id = int(key) if key.isdigit() else None
                            
                            if op_id and op_id in operation_map:
                                seq = value.get("sequence", 0) if isinstance(value, dict) else 0
                                operation_list.append((seq, operation_map[op_id]))
                
                # 按序列顺序排序
                operation_list.sort(key=lambda x: x[0])
                
                # 构建工序响应列表
                route_response.operations = [
                    OperationTreeResponse.model_validate(op) for _, op in operation_list
                ]
            
            result.append(route_response)
        
        return result
    
    # ==================== 作业程序（SOP）相关方法 ====================
    
    @staticmethod
    async def create_sop(
        tenant_id: int,
        data: SOPCreate
    ) -> SOPResponse:
        """
        创建作业程序（SOP）
        
        Args:
            tenant_id: 租户ID
            data: SOP创建数据
            
        Returns:
            SOPResponse: 创建的SOP对象
            
        Raises:
            ValidationError: 当编码已存在或工序不存在时抛出
        """
        # 如果指定了工序，检查工序是否存在
        if data.operation_id:
            operation = await Operation.filter(
                tenant_id=tenant_id,
                id=data.operation_id,
                deleted_at__isnull=True
            ).first()
            
            if not operation:
                raise ValidationError(f"工序 {data.operation_id} 不存在")
        
        # 检查编码是否已存在
        existing = await SOP.filter(
            tenant_id=tenant_id,
            code=data.code,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"SOP编码 {data.code} 已存在")
        
        # 创建SOP
        sop = await SOP.create(
            tenant_id=tenant_id,
            **data.dict()
        )
        
        return SOPResponse.model_validate(sop)
    
    @staticmethod
    async def get_sop_by_uuid(
        tenant_id: int,
        sop_uuid: str
    ) -> SOPResponse:
        """
        根据UUID获取作业程序（SOP）
        
        Args:
            tenant_id: 租户ID
            sop_uuid: SOP UUID
            
        Returns:
            SOPResponse: SOP对象
            
        Raises:
            NotFoundError: 当SOP不存在时抛出
        """
        sop = await SOP.filter(
            tenant_id=tenant_id,
            uuid=sop_uuid,
            deleted_at__isnull=True
        ).prefetch_related("operation").first()
        
        if not sop:
            raise NotFoundError(f"SOP {sop_uuid} 不存在")
        
        return SOPResponse.model_validate(sop)
    
    @staticmethod
    async def list_sops(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        operation_id: Optional[int] = None,
        is_active: Optional[bool] = None
    ) -> List[SOPResponse]:
        """
        获取作业程序（SOP）列表
        
        Args:
            tenant_id: 租户ID
            skip: 跳过数量
            limit: 限制数量
            operation_id: 工序ID（可选，用于过滤）
            is_active: 是否启用（可选）
            
        Returns:
            List[SOPResponse]: SOP列表
        """
        query = SOP.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if operation_id is not None:
            query = query.filter(operation_id=operation_id)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        sops = await query.offset(skip).limit(limit).order_by("code").all()
        
        return [SOPResponse.model_validate(s) for s in sops]
    
    @staticmethod
    async def update_sop(
        tenant_id: int,
        sop_uuid: str,
        data: SOPUpdate
    ) -> SOPResponse:
        """
        更新作业程序（SOP）
        
        Args:
            tenant_id: 租户ID
            sop_uuid: SOP UUID
            data: SOP更新数据
            
        Returns:
            SOPResponse: 更新后的SOP对象
            
        Raises:
            NotFoundError: 当SOP不存在时抛出
            ValidationError: 当编码已存在或工序不存在时抛出
        """
        sop = await SOP.filter(
            tenant_id=tenant_id,
            uuid=sop_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sop:
            raise NotFoundError(f"SOP {sop_uuid} 不存在")
        
        # 如果更新工序ID，检查工序是否存在
        if data.operation_id is not None and data.operation_id != sop.operation_id:
            if data.operation_id:
                operation = await Operation.filter(
                    tenant_id=tenant_id,
                    id=data.operation_id,
                    deleted_at__isnull=True
                ).first()
                
                if not operation:
                    raise ValidationError(f"工序 {data.operation_id} 不存在")
        
        # 如果更新编码，检查是否已存在
        if data.code and data.code != sop.code:
            existing = await SOP.filter(
                tenant_id=tenant_id,
                code=data.code,
                deleted_at__isnull=True
            ).first()
            
            if existing:
                raise ValidationError(f"SOP编码 {data.code} 已存在")
        
        # 更新字段
        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(sop, key, value)
        
        await sop.save()
        
        return SOPResponse.model_validate(sop)
    
    @staticmethod
    async def delete_sop(
        tenant_id: int,
        sop_uuid: str
    ) -> None:
        """
        删除作业程序（SOP）（软删除）
        
        Args:
            tenant_id: 租户ID
            sop_uuid: SOP UUID
            
        Raises:
            NotFoundError: 当SOP不存在时抛出
        """
        sop = await SOP.filter(
            tenant_id=tenant_id,
            uuid=sop_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sop:
            raise NotFoundError(f"SOP {sop_uuid} 不存在")
        
        # 软删除
        from tortoise import timezone
        sop.deleted_at = timezone.now()
        await sop.save()

