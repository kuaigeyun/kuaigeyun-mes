"""
工艺数据服务模块

提供工艺数据的业务逻辑处理（不良品、工序、工艺路线、作业程序），支持多组织隔离。
"""

from typing import List, Optional, Dict, Any
import re
from tortoise.exceptions import IntegrityError

from apps.master_data.models.process import DefectType, Operation, ProcessRoute, ProcessRouteTemplate, SOP
from apps.master_data.schemas.process_schemas import (
    DefectTypeCreate, DefectTypeUpdate, DefectTypeResponse,
    OperationCreate, OperationUpdate, OperationResponse,
    ProcessRouteCreate, ProcessRouteUpdate, ProcessRouteResponse,
    ProcessRouteVersionCreate, ProcessRouteVersionCompare, ProcessRouteVersionCompareResult,
    ProcessRouteTemplateCreate, ProcessRouteTemplateUpdate, ProcessRouteTemplateResponse,
    ProcessRouteTemplateVersionCreate, ProcessRouteFromTemplateCreate,
    SOPCreate, SOPUpdate, SOPResponse
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ProcessService:
    """工艺数据服务"""
    
    @staticmethod
    async def _to_process_route_response(process_route: ProcessRoute) -> ProcessRouteResponse:
        """
        将ProcessRoute模型转换为ProcessRouteResponse
        
        处理parent_route_uuid的转换（从外键关系获取UUID）
        
        Args:
            process_route: ProcessRoute模型对象
            
        Returns:
            ProcessRouteResponse: 响应对象
        """
        response_data = {
            "id": process_route.id,
            "uuid": process_route.uuid,
            "tenant_id": process_route.tenant_id,
            "code": process_route.code,
            "name": process_route.name,
            "description": process_route.description,
            "version": process_route.version,
            "version_description": process_route.version_description,
            "base_version": process_route.base_version,
            "effective_date": process_route.effective_date,
            "operation_sequence": process_route.operation_sequence,
            "parent_route_uuid": None,
            "parent_operation_uuid": process_route.parent_operation_uuid,
            "level": process_route.level or 0,
            "is_active": process_route.is_active,
            "created_at": process_route.created_at,
            "updated_at": process_route.updated_at,
            "deleted_at": process_route.deleted_at,
        }
        
        # 处理parent_route_uuid
        if process_route.parent_route_id:
            try:
                parent_route = await ProcessRoute.get(id=process_route.parent_route_id)
                response_data["parent_route_uuid"] = parent_route.uuid
            except:
                response_data["parent_route_uuid"] = None
        
        return ProcessRouteResponse(**response_data)
    
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
        try:
            defect_type = await DefectType.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"不良品编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        
        try:
            await defect_type.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"不良品编码 {data.code or defect_type.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        try:
            operation = await Operation.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"工序编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        
        try:
            await operation.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"工序编码 {data.code or operation.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        # 检查编码+版本是否已存在（同一编码可以有多个版本）
        version = data.version if hasattr(data, 'version') and data.version else "1.0"
        existing = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=data.code,
            version=version,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"工艺路线编码 {data.code} 版本 {version} 已存在")
        
        # 创建工艺路线
        route_data = data.dict(exclude={'parent_route_uuid'})
        if 'version' not in route_data or not route_data.get('version'):
            route_data['version'] = "1.0"
        
        # 处理父工艺路线关联
        if hasattr(data, 'parent_route_uuid') and data.parent_route_uuid:
            parent_route = await ProcessRoute.filter(
                tenant_id=tenant_id,
                uuid=data.parent_route_uuid,
                deleted_at__isnull=True
            ).first()
            if not parent_route:
                raise NotFoundError(f"父工艺路线 {data.parent_route_uuid} 不存在")
            
            # 检查嵌套层级
            parent_level = parent_route.level or 0
            new_level = data.level if hasattr(data, 'level') and data.level is not None else parent_level + 1
            if new_level > 3:
                raise ValidationError("嵌套层级不能超过3层")
            
            route_data['parent_route_id'] = parent_route.id
            route_data['level'] = new_level
        
        process_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            **route_data
        )
        
        return await ProcessService._to_process_route_response(process_route)
    
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
        
        return await ProcessService._to_process_route_response(process_route)
    
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
        
        return [await ProcessService._to_process_route_response(pr) for pr in process_routes]
    
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
        
        try:
            await process_route.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"工艺路线编码 {data.code or process_route.code} 已存在（可能已被软删除，请检查）")
            raise
        
        return await ProcessService._to_process_route_response(process_route)
    
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
        try:
            sop = await SOP.create(
                tenant_id=tenant_id,
                **data.dict()
            )
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"SOP编码 {data.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
        
        try:
            await sop.save()
        except IntegrityError as e:
            # 捕获数据库唯一约束错误，提供友好提示
            if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                raise ValidationError(f"SOP编码 {data.code or sop.code} 已存在（可能已被软删除，请检查）")
            raise
        
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
    
    # ==================== 工艺路线版本管理相关方法 ====================
    
    @staticmethod
    async def create_process_route_version(
        tenant_id: int,
        process_route_code: str,
        data: ProcessRouteVersionCreate
    ) -> ProcessRouteResponse:
        """
        创建工艺路线新版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            data: 版本创建数据
            
        Returns:
            ProcessRouteResponse: 新创建的工艺路线版本对象
            
        Raises:
            NotFoundError: 当工艺路线不存在时抛出
            ValidationError: 当版本号已存在时抛出
        """
        from datetime import datetime
        import re
        
        # 获取当前最新版本的工艺路线
        current_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            deleted_at__isnull=True
        ).order_by("-version").first()
        
        if not current_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 不存在")
        
        # 检查新版本号是否已存在
        existing_version = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=data.version,
            deleted_at__isnull=True
        ).first()
        
        if existing_version:
            raise ValidationError(f"版本号 '{data.version}' 已存在，请使用其他版本号")
        
        # 创建新版本的工艺路线（复制当前版本）
        new_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            code=current_route.code,
            name=current_route.name,
            description=current_route.description,
            version=data.version,
            version_description=data.version_description,
            base_version=current_route.version,
            effective_date=data.effective_date or datetime.now(),
            operation_sequence=current_route.operation_sequence,
            is_active=current_route.is_active,
        )
        
        return await ProcessService._to_process_route_response(new_route)
    
    @staticmethod
    async def get_process_route_versions(
        tenant_id: int,
        process_route_code: str
    ) -> List[ProcessRouteResponse]:
        """
        获取工艺路线的所有版本
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            
        Returns:
            List[ProcessRouteResponse]: 版本列表（按版本号降序排列）
        """
        routes = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            deleted_at__isnull=True
        ).order_by("-version").all()
        
        result = []
        for r in routes:
            result.append(await ProcessService._to_process_route_response(r))
        return result
    
    @staticmethod
    async def compare_process_route_versions(
        tenant_id: int,
        process_route_code: str,
        data: ProcessRouteVersionCompare
    ) -> ProcessRouteVersionCompareResult:
        """
        对比工艺路线版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            data: 版本对比数据
            
        Returns:
            ProcessRouteVersionCompareResult: 版本对比结果
            
        Raises:
            NotFoundError: 当版本不存在时抛出
        """
        # 获取两个版本的工艺路线
        version1_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=data.version1,
            deleted_at__isnull=True
        ).first()
        
        version2_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=data.version2,
            deleted_at__isnull=True
        ).first()
        
        if not version1_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 版本 {data.version1} 不存在")
        if not version2_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 版本 {data.version2} 不存在")
        
        # 解析工序序列
        seq1 = version1_route.operation_sequence or {}
        seq2 = version2_route.operation_sequence or {}
        
        # 提取工序ID列表（保持顺序）
        ops1 = seq1.get("operations", []) if isinstance(seq1, dict) else []
        ops2 = seq2.get("operations", []) if isinstance(seq2, dict) else []
        
        # 构建工序ID到索引的映射
        ops1_map = {op.get("uuid") or op.get("id"): idx for idx, op in enumerate(ops1) if op}
        ops2_map = {op.get("uuid") or op.get("id"): idx for idx, op in enumerate(ops2) if op}
        
        # 找出差异
        added_operations = []
        removed_operations = []
        modified_operations = []
        sequence_changes = []
        
        # 检查版本2中新增或修改的工序
        for idx2, op2 in enumerate(ops2):
            op_id = op2.get("uuid") or op2.get("id")
            if op_id not in ops1_map:
                # 新增工序
                added_operations.append({
                    "operation": op2,
                    "position": idx2 + 1,
                })
            else:
                # 检查是否修改或位置变化
                idx1 = ops1_map[op_id]
                op1 = ops1[idx1]
                
                # 检查位置是否变化
                if idx1 != idx2:
                    sequence_changes.append({
                        "operation": op2,
                        "old_position": idx1 + 1,
                        "new_position": idx2 + 1,
                    })
                
                # 检查工序配置是否变化（如果有其他配置字段）
                if op1 != op2:
                    changes = {}
                    for key in set(list(op1.keys()) + list(op2.keys())):
                        if op1.get(key) != op2.get(key):
                            changes[key] = {
                                "old": op1.get(key),
                                "new": op2.get(key),
                            }
                    if changes:
                        modified_operations.append({
                            "operation": op2,
                            "changes": changes,
                        })
        
        # 检查版本1中删除的工序
        for idx1, op1 in enumerate(ops1):
            op_id = op1.get("uuid") or op1.get("id")
            if op_id not in ops2_map:
                removed_operations.append({
                    "operation": op1,
                    "old_position": idx1 + 1,
                })
        
        return ProcessRouteVersionCompareResult(
            version1=data.version1,
            version2=data.version2,
            added_operations=added_operations,
            removed_operations=removed_operations,
            modified_operations=modified_operations,
            sequence_changes=sequence_changes,
        )
    
    @staticmethod
    async def rollback_process_route_version(
        tenant_id: int,
        process_route_code: str,
        target_version: str,
        new_version: Optional[str] = None
    ) -> ProcessRouteResponse:
        """
        回退工艺路线到指定版本
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        回退时创建新版本，内容与目标版本相同，保留历史记录。
        
        Args:
            tenant_id: 租户ID
            process_route_code: 工艺路线编码
            target_version: 目标版本（要回退到的版本）
            new_version: 新版本号（可选，如果不提供则自动生成）
            
        Returns:
            ProcessRouteResponse: 新创建的工艺路线版本对象（内容与目标版本相同）
            
        Raises:
            NotFoundError: 当目标版本不存在时抛出
            ValidationError: 当新版本号已存在时抛出
        """
        from datetime import datetime
        import re
        
        # 获取目标版本的工艺路线
        target_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=target_version,
            deleted_at__isnull=True
        ).first()
        
        if not target_route:
            raise NotFoundError(f"工艺路线 {process_route_code} 版本 {target_version} 不存在")
        
        # 如果没有提供新版本号，自动生成
        if not new_version:
            # 获取当前最新版本
            current_route = await ProcessRoute.filter(
                tenant_id=tenant_id,
                code=process_route_code,
                deleted_at__isnull=True
            ).order_by("-version").first()
            
            if current_route:
                current_version = current_route.version or "1.0"
                version_match = re.match(r'^v?(\d+)\.(\d+)$', current_version) if isinstance(current_version, str) else None
                if version_match:
                    major = int(version_match.group(1))
                    minor = int(version_match.group(2))
                    new_version = f"v{major}.{minor + 1}"
                else:
                    new_version = f"{current_version}.1"
            else:
                new_version = "v1.1"
        
        # 检查新版本号是否已存在
        existing_version = await ProcessRoute.filter(
            tenant_id=tenant_id,
            code=process_route_code,
            version=new_version,
            deleted_at__isnull=True
        ).first()
        
        if existing_version:
            raise ValidationError(f"版本号 '{new_version}' 已存在，请使用其他版本号")
        
        # 创建新版本的工艺路线（内容与目标版本相同）
        new_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            code=target_route.code,
            name=target_route.name,
            description=target_route.description,
            version=new_version,
            version_description=f"回退到版本 {target_version}",
            base_version=target_version,
            effective_date=datetime.now(),
            operation_sequence=target_route.operation_sequence,
            is_active=target_route.is_active,
        )
        
        return await ProcessService._to_process_route_response(new_route)
    
    # ==================== 工艺路线绑定管理相关方法 ====================
    
    @staticmethod
    async def bind_material_group(
        tenant_id: int,
        process_route_uuid: str,
        material_group_uuid: str
    ) -> None:
        """
        绑定工艺路线到物料分组
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            material_group_uuid: 物料分组UUID
            
        Raises:
            NotFoundError: 当工艺路线或物料分组不存在时抛出
        """
        from apps.master_data.models.material import MaterialGroup
        
        # 获取工艺路线
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 获取物料分组
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=material_group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {material_group_uuid} 不存在")
        
        # 绑定工艺路线到物料分组
        material_group.process_route_id = process_route.id
        await material_group.save()
    
    @staticmethod
    async def unbind_material_group(
        tenant_id: int,
        material_group_uuid: str
    ) -> None:
        """
        解绑物料分组的工艺路线
        
        Args:
            tenant_id: 租户ID
            material_group_uuid: 物料分组UUID
            
        Raises:
            NotFoundError: 当物料分组不存在时抛出
        """
        from apps.master_data.models.material import MaterialGroup
        
        # 获取物料分组
        material_group = await MaterialGroup.filter(
            tenant_id=tenant_id,
            uuid=material_group_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material_group:
            raise NotFoundError(f"物料分组 {material_group_uuid} 不存在")
        
        # 解绑工艺路线
        material_group.process_route_id = None
        await material_group.save()
    
    @staticmethod
    async def bind_material(
        tenant_id: int,
        process_route_uuid: str,
        material_uuid: str
    ) -> None:
        """
        绑定工艺路线到物料
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        物料绑定优先级高于物料分组绑定。
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            material_uuid: 物料UUID
            
        Raises:
            NotFoundError: 当工艺路线或物料不存在时抛出
        """
        from apps.master_data.models.material import Material
        
        # 获取工艺路线
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 获取物料
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 绑定工艺路线到物料
        material.process_route_id = process_route.id
        await material.save()
    
    @staticmethod
    async def unbind_material(
        tenant_id: int,
        material_uuid: str
    ) -> None:
        """
        解绑物料的工艺路线
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Raises:
            NotFoundError: 当物料不存在时抛出
        """
        from apps.master_data.models.material import Material
        
        # 获取物料
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 解绑工艺路线
        material.process_route_id = None
        await material.save()
    
    @staticmethod
    async def get_process_route_for_material(
        tenant_id: int,
        material_uuid: str
    ) -> Optional[ProcessRouteResponse]:
        """
        获取物料匹配的工艺路线（按优先级）
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        优先级从高到低：
        1. 物料主数据中的工艺路线关联（最高优先级）
        2. 物料绑定工艺路线（第二优先级）
        3. 物料分组绑定工艺路线（第三优先级）
        4. 默认工艺路线（最低优先级，如果配置了）
        
        Args:
            tenant_id: 租户ID
            material_uuid: 物料UUID
            
        Returns:
            Optional[ProcessRouteResponse]: 匹配的工艺路线，如果没有则返回None
        """
        from apps.master_data.models.material import Material, MaterialGroup
        
        # 获取物料
        material = await Material.filter(
            tenant_id=tenant_id,
            uuid=material_uuid,
            deleted_at__isnull=True
        ).prefetch_related("process_route", "group").first()
        
        if not material:
            raise NotFoundError(f"物料 {material_uuid} 不存在")
        
        # 优先级1：物料主数据中的工艺路线关联（最高优先级）
        if material.process_route_id:
            process_route = await ProcessRoute.filter(
                id=material.process_route_id,
                deleted_at__isnull=True,
                is_active=True
            ).first()
            if process_route:
                return await ProcessService._to_process_route_response(process_route)
        
        # 优先级2：物料分组绑定工艺路线
        if material.group_id:
            material_group = await MaterialGroup.filter(
                id=material.group_id,
                deleted_at__isnull=True
            ).prefetch_related("process_route").first()
            
            if material_group and material_group.process_route_id:
                process_route = await ProcessRoute.filter(
                    id=material_group.process_route_id,
                    deleted_at__isnull=True,
                    is_active=True
                ).first()
                if process_route:
                    return await ProcessService._to_process_route_response(process_route)
        
        # 优先级3：默认工艺路线（如果配置了）
        # TODO: 实现默认工艺路线配置
        
        return None
    
    @staticmethod
    async def get_bound_materials(
        tenant_id: int,
        process_route_uuid: str
    ) -> Dict[str, Any]:
        """
        获取工艺路线绑定的物料和物料分组
        
        Args:
            tenant_id: 租户ID
            process_route_uuid: 工艺路线UUID
            
        Returns:
            Dict[str, Any]: 包含绑定的物料列表和物料分组列表
        """
        from apps.master_data.models.material import Material, MaterialGroup
        
        # 获取工艺路线
        process_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=process_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not process_route:
            raise NotFoundError(f"工艺路线 {process_route_uuid} 不存在")
        
        # 获取绑定的物料
        materials = await Material.filter(
            tenant_id=tenant_id,
            process_route_id=process_route.id,
            deleted_at__isnull=True
        ).all()
        
        # 获取绑定的物料分组
        material_groups = await MaterialGroup.filter(
            tenant_id=tenant_id,
            process_route_id=process_route.id,
            deleted_at__isnull=True
        ).all()
        
        return {
            "materials": [
                {
                    "uuid": m.uuid,
                    "code": m.main_code,
                    "name": m.name,
                }
                for m in materials
            ],
            "material_groups": [
                {
                    "uuid": mg.uuid,
                    "code": mg.code,
                    "name": mg.name,
                }
                for mg in material_groups
            ],
        }
    
    # ==================== 子工艺路线管理相关方法 ====================
    
    @staticmethod
    async def create_sub_route(
        tenant_id: int,
        parent_route_uuid: str,
        parent_operation_uuid: str,
        data: ProcessRouteCreate
    ) -> ProcessRouteResponse:
        """
        创建子工艺路线
        
        根据《工艺路线和标准作业流程优化设计规范.md》设计。
        
        Args:
            tenant_id: 租户ID
            parent_route_uuid: 父工艺路线UUID
            parent_operation_uuid: 父工序UUID（此子工艺路线所属的父工序）
            data: 子工艺路线创建数据
            
        Returns:
            ProcessRouteResponse: 创建的子工艺路线对象
            
        Raises:
            NotFoundError: 当父工艺路线或父工序不存在时抛出
            ValidationError: 当嵌套层级超过3层时抛出
        """
        # 获取父工艺路线
        parent_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=parent_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not parent_route:
            raise NotFoundError(f"父工艺路线 {parent_route_uuid} 不存在")
        
        # 检查嵌套层级
        parent_level = parent_route.level or 0
        if parent_level >= 3:
            raise ValidationError("嵌套层级不能超过3层（最多支持3层嵌套）")
        
        # 验证父工序是否存在（在父工艺路线的工序序列中）
        if parent_route.operation_sequence:
            operations = []
            if isinstance(parent_route.operation_sequence, dict):
                operations = parent_route.operation_sequence.get("operations", [])
            elif isinstance(parent_route.operation_sequence, list):
                operations = parent_route.operation_sequence
            
            operation_found = False
            for op in operations:
                if isinstance(op, dict):
                    if op.get("uuid") == parent_operation_uuid or op.get("operation_uuid") == parent_operation_uuid:
                        operation_found = True
                        break
                elif isinstance(op, str) and op == parent_operation_uuid:
                    operation_found = True
                    break
            
            if not operation_found:
                raise NotFoundError(f"父工序 {parent_operation_uuid} 在父工艺路线中不存在")
        
        # 创建子工艺路线
        route_data = data.dict(exclude={'parent_route_uuid'})
        route_data['parent_route_id'] = parent_route.id
        route_data['parent_operation_uuid'] = parent_operation_uuid
        route_data['level'] = parent_level + 1
        
        if 'version' not in route_data or not route_data.get('version'):
            route_data['version'] = "1.0"
        
        sub_route = await ProcessRoute.create(
            tenant_id=tenant_id,
            **route_data
        )
        
        return await ProcessService._to_process_route_response(sub_route)
    
    @staticmethod
    async def get_sub_routes(
        tenant_id: int,
        parent_route_uuid: str,
        parent_operation_uuid: Optional[str] = None
    ) -> List[ProcessRouteResponse]:
        """
        获取子工艺路线列表
        
        Args:
            tenant_id: 租户ID
            parent_route_uuid: 父工艺路线UUID
            parent_operation_uuid: 父工序UUID（可选，如果提供则只返回该工序的子工艺路线）
            
        Returns:
            List[ProcessRouteResponse]: 子工艺路线列表
        """
        # 获取父工艺路线
        parent_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=parent_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not parent_route:
            raise NotFoundError(f"父工艺路线 {parent_route_uuid} 不存在")
        
        # 查询子工艺路线
        query = ProcessRoute.filter(
            tenant_id=tenant_id,
            parent_route_id=parent_route.id,
            deleted_at__isnull=True
        )
        
        if parent_operation_uuid:
            query = query.filter(parent_operation_uuid=parent_operation_uuid)
        
        sub_routes = await query.order_by("code").all()
        
        result = []
        for r in sub_routes:
            result.append(await ProcessService._to_process_route_response(r))
        return result
    
    @staticmethod
    async def delete_sub_route(
        tenant_id: int,
        sub_route_uuid: str
    ) -> None:
        """
        删除子工艺路线（软删除）
        
        Args:
            tenant_id: 租户ID
            sub_route_uuid: 子工艺路线UUID
            
        Raises:
            NotFoundError: 当子工艺路线不存在时抛出
        """
        sub_route = await ProcessRoute.filter(
            tenant_id=tenant_id,
            uuid=sub_route_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not sub_route:
            raise NotFoundError(f"子工艺路线 {sub_route_uuid} 不存在")
        
        # 检查是否有嵌套子工艺路线
        nested_sub_routes = await ProcessRoute.filter(
            tenant_id=tenant_id,
            parent_route_id=sub_route.id,
            deleted_at__isnull=True
        ).count()
        
        if nested_sub_routes > 0:
            raise ValidationError(f"无法删除：此子工艺路线下还有 {nested_sub_routes} 个嵌套子工艺路线，请先删除嵌套子工艺路线")
        
        # 软删除
        from tortoise import timezone
        sub_route.deleted_at = timezone.now()
        await sub_route.save()

    # ==================== 工艺路线模板管理相关方法 ====================

    async def create_process_route_template(
        self,
        tenant_id: int,
        template_data: ProcessRouteTemplateCreate,
        created_by: int
    ) -> ProcessRouteTemplateResponse:
        """
        创建工艺路线模板
        
        Args:
            tenant_id: 组织ID
            template_data: 模板创建数据
            created_by: 创建人ID
            
        Returns:
            ProcessRouteTemplateResponse: 创建的模板对象
        """
        # 检查编码是否已存在
        existing = await ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            code=template_data.code,
            version=template_data.version,
            deleted_at__isnull=True
        ).first()
        
        if existing:
            raise ValidationError(f"模板编码 {template_data.code} 版本 {template_data.version} 已存在")
        
        # 创建模板
        template = await ProcessRouteTemplate.create(
            tenant_id=tenant_id,
            **template_data.dict()
        )
        
        return ProcessRouteTemplateResponse.model_validate(template)

    async def list_process_route_templates(
        self,
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[ProcessRouteTemplateResponse]:
        """
        获取工艺路线模板列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            category: 模板分类
            is_active: 是否启用
            
        Returns:
            List[ProcessRouteTemplateResponse]: 模板列表
        """
        query = ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if category:
            query = query.filter(category=category)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        templates = await query.order_by("-created_at").offset(skip).limit(limit).all()
        
        return [ProcessRouteTemplateResponse.model_validate(t) for t in templates]

    async def get_process_route_template(
        self,
        tenant_id: int,
        template_uuid: str
    ) -> ProcessRouteTemplateResponse:
        """
        获取工艺路线模板详情
        
        Args:
            tenant_id: 组织ID
            template_uuid: 模板UUID
            
        Returns:
            ProcessRouteTemplateResponse: 模板对象
            
        Raises:
            NotFoundError: 当模板不存在时抛出
        """
        template = await ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            uuid=template_uuid,
            deleted_at__isnull=True
        ).first()
        
        if not template:
            raise NotFoundError(f"工艺路线模板 {template_uuid} 不存在")
        
        return ProcessRouteTemplateResponse.model_validate(template)

    async def create_process_route_from_template(
        self,
        tenant_id: int,
        route_data: ProcessRouteFromTemplateCreate,
        created_by: int
    ) -> ProcessRouteResponse:
        """
        基于模板创建工艺路线
        
        Args:
            tenant_id: 组织ID
            route_data: 工艺路线创建数据（包含template_uuid）
            created_by: 创建人ID
            
        Returns:
            ProcessRouteResponse: 创建的工艺路线对象
        """
        # 获取模板
        template = await ProcessRouteTemplate.filter(
            tenant_id=tenant_id,
            uuid=route_data.template_uuid,
            deleted_at__isnull=True,
            is_active=True
        ).first()
        
        if not template:
            raise NotFoundError(f"工艺路线模板 {route_data.template_uuid} 不存在或已禁用")
        
        # 从模板配置创建工艺路线
        template_config = template.process_route_config or {}
        
        route_create_data = ProcessRouteCreate(
            code=route_data.code,
            name=route_data.name,
            description=route_data.description,
            is_active=route_data.is_active,
            operation_sequence=template_config.get("operation_sequence"),
            version="1.0",
        )
        
        # 创建工艺路线
        return await self.create_process_route(tenant_id, route_create_data, created_by)
