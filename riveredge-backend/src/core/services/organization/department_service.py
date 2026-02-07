"""
部门服务模块

提供部门的 CRUD 操作和树形结构管理。
"""

from typing import List, Optional, Dict, Any
from tortoise.exceptions import IntegrityError
from tortoise.expressions import Q

from core.models.department import Department
from core.models.user_role import UserRole
from core.schemas.department import DepartmentCreate, DepartmentUpdate
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError, AuthorizationError
from loguru import logger

# 向后兼容别名
PermissionDeniedError = AuthorizationError


class DepartmentService:
    """
    部门服务类
    
    提供部门的 CRUD 操作和树形结构管理。
    """
    
    @staticmethod
    async def create_department(
        tenant_id: int,
        data: DepartmentCreate,
        current_user_id: int
    ) -> Department:
        """
        创建部门
        
        Args:
            tenant_id: 组织ID
            data: 部门创建数据
            current_user_id: 当前用户ID
            
        Returns:
            Department: 创建的部门对象
            
        Raises:
            ValidationError: 当父部门不存在或不属于当前组织时抛出
            AuthorizationError: 当用户无权限时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 验证父部门（如果提供）
        parent_id = None
        if data.parent_uuid:
            parent = await Department.filter(
                uuid=data.parent_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not parent:
                raise ValidationError("父部门不存在或不属于当前组织")
            
            # 检查循环引用（防止父部门是自己或子部门）
            # TODO: 实现循环引用检查逻辑
            
            parent_id = parent.id  # 转换为ID用于数据库关联
        
        # 验证部门负责人（如果提供）
        manager_id = None
        if data.manager_uuid:
            manager = await User.filter(
                uuid=data.manager_uuid,
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).first()
            
            if not manager:
                raise ValidationError("部门负责人不存在或不属于当前组织")
            
            manager_id = manager.id  # 转换为ID用于数据库关联
        
        # 创建部门
        department = await Department.create(
            tenant_id=tenant_id,
            name=data.name,
            code=data.code,
            description=data.description,
            parent_id=parent_id,
            manager_id=manager_id,
            sort_order=data.sort_order if data.sort_order is not None else 0,
            is_active=data.is_active if data.is_active is not None else True,
        )
        
        return department
    
    @staticmethod
    async def get_department_tree(
        tenant_id: int,
        parent_id: Optional[int] = None,
        keyword: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[Dict[str, Any]]:
        """
        获取部门树（支持搜索和筛选）
        
        Args:
            tenant_id: 组织ID
            parent_id: 开始父部门ID（通常为 None 表示从根开始）
            keyword: 关键词搜索（名称、代码）
            is_active: 是否启用筛选
            
        Returns:
            List[Dict]: 部门树列表
        """
        # 1. 构建基础查询条件
        query = Q(tenant_id=tenant_id)
        # deleted_at__isnull=True  # 暂时移除，数据库表结构不一致
        
        # 2. 如果不带搜索/筛选，使用原有的递归加载方式（性能较好，且支持大数量）
        if not keyword and is_active is None:
            return await DepartmentService._get_recursive_tree(tenant_id, parent_id)
            
        # 3. 如果带搜索/筛选，采用全部加载并过滤的方式保持树形结构
        # 获取所有部门
        all_departments = await Department.filter(query).order_by("sort_order", "id").all()
        if not all_departments:
            return []
            
        # 匹配搜索条件的部门 ID 集合
        matched_ids = set()
        for dept in all_departments:
            matches = True
            if keyword:
                kw = keyword.lower()
                matches = kw in (dept.name or "").lower() or kw in (dept.code or "").lower()
            
            if matches and is_active is not None:
                matches = dept.is_active == is_active
                
            if matches:
                matched_ids.add(dept.id)
        
        if not matched_ids:
            return []
            
        # 扩展 matched_ids 以包含所有祖先节点，确保能构建出完整的整路径
        id_to_dept = {dept.id: dept for dept in all_departments}
        result_ids = set(matched_ids)
        for dept_id in matched_ids:
            curr = id_to_dept.get(dept_id)
            while curr and curr.parent_id:
                if curr.parent_id in result_ids:
                    break
                result_ids.add(curr.parent_id)
                curr = id_to_dept.get(curr.parent_id)
        
        # 4. 构建树形结构
        # 过滤出最终需要的部门列表
        filtered_depts = [dept for dept in all_departments if dept.id in result_ids]
        
        # 转换为带统计信息的字典，并按层级分组
        from infra.models.user import User
        
        async def enrich_dept(dept):
            children_count = await Department.filter(tenant_id=tenant_id, parent_id=dept.id).count()
            user_count = await User.filter(tenant_id=tenant_id, department_id=dept.id).count()
            
            # 获取父部门的UUID
            parent_uuid = None
            if dept.parent_id:
                parent_dept = id_to_dept.get(dept.parent_id)
                parent_uuid = parent_dept.uuid if parent_dept else None
                
            return {
                "id": dept.id,
                "uuid": dept.uuid,
                "name": dept.name,
                "code": dept.code,
                "description": dept.description,
                "parent_id": dept.parent_id,
                "parent_uuid": parent_uuid,
                "manager_id": dept.manager_id,
                "manager_uuid": None,
                "sort_order": dept.sort_order,
                "is_active": dept.is_active,
                "children_count": children_count,
                "user_count": user_count,
                "children": []
            }

        # 构建 ID 到处理后字典的映射
        enriched_items = {}
        for dept in filtered_depts:
            enriched_items[dept.id] = await enrich_dept(dept)
            
        root_nodes = []
        for dept_id, item in enriched_items.items():
            if item["parent_id"] is None or item["parent_id"] not in enriched_items:
                root_nodes.append(item)
            else:
                parent = enriched_items[item["parent_id"]]
                parent["children"].append(item)
                
        return root_nodes

    @staticmethod
    async def _get_recursive_tree(tenant_id: int, parent_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """原有递归加载树的辅助函数"""
        departments = await Department.filter(
            tenant_id=tenant_id,
            parent_id=parent_id,
        ).order_by("sort_order", "id").all()
        
        result = []
        for dept in departments:
            children_count = await Department.filter(tenant_id=tenant_id, parent_id=dept.id).count()
            from infra.models.user import User
            user_count = await User.filter(tenant_id=tenant_id, department_id=dept.id).count()
            
            children = await DepartmentService._get_recursive_tree(tenant_id, dept.id)
            
            parent_uuid = None
            if dept.parent_id:
                parent_dept = await Department.get_or_none(id=dept.parent_id)
                parent_uuid = parent_dept.uuid if parent_dept else None

            result.append({
                "id": dept.id,
                "uuid": dept.uuid,
                "name": dept.name,
                "code": dept.code,
                "description": dept.description,
                "parent_id": dept.parent_id,
                "parent_uuid": parent_uuid,
                "manager_id": dept.manager_id,
                "manager_uuid": None,
                "sort_order": dept.sort_order,
                "is_active": dept.is_active,
                "children_count": children_count,
                "user_count": user_count,
                "children": children,
            })
        return result
    
    @staticmethod
    async def get_department_by_uuid(
        tenant_id: int,
        department_uuid: str
    ) -> Department:
        """
        根据UUID获取部门详情
        
        Args:
            tenant_id: 组织ID
            department_uuid: 部门UUID
            
        Returns:
            Department: 部门对象
            
        Raises:
            NotFoundError: 当部门不存在时抛出
        """
        department = await Department.filter(
            uuid=department_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not department:
            raise NotFoundError("部门", department_uuid)
        
        return department
    
    @staticmethod
    async def update_department(
        tenant_id: int,
        department_uuid: str,
        data: DepartmentUpdate,
        current_user_id: int
    ) -> Department:
        """
        更新部门
        
        Args:
            tenant_id: 组织ID
            department_uuid: 部门UUID
            data: 部门更新数据
            current_user_id: 当前用户ID
            
        Returns:
            Department: 更新后的部门对象
            
        Raises:
            NotFoundError: 当部门不存在时抛出
            ValidationError: 当父部门无效或循环引用时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取部门
        department = await Department.filter(
            uuid=department_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not department:
            raise NotFoundError("部门", department_uuid)
        
        # 验证父部门（如果更新）
        if data.parent_uuid is not None:
            if data.parent_uuid == department_uuid:
                raise ValidationError("部门不能将自己设为父部门")
            
            if data.parent_uuid:
                parent = await Department.filter(
                    uuid=data.parent_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not parent:
                    raise ValidationError("父部门不存在或不属于当前组织")
                
                # 检查循环引用（防止父部门是子部门）
                # TODO: 实现循环引用检查逻辑
                
                department.parent_id = parent.id
            else:
                department.parent_id = None
        
        # 验证部门负责人（如果更新）
        if data.manager_uuid is not None:
            if data.manager_uuid:
                manager = await User.filter(
                    uuid=data.manager_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if not manager:
                    raise ValidationError("部门负责人不存在或不属于当前组织")
                
                department.manager_id = manager.id
            else:
                department.manager_id = None
        
        # 更新其他字段
        update_data = data.model_dump(exclude_unset=True, exclude={"parent_uuid", "manager_uuid"})
        for key, value in update_data.items():
            setattr(department, key, value)
        
        await department.save()
        
        return department
    
    @staticmethod
    async def delete_department(
        tenant_id: int,
        department_uuid: str,
        current_user_id: int
    ) -> None:
        """
        删除部门
        
        Args:
            tenant_id: 组织ID
            department_uuid: 部门UUID
            current_user_id: 当前用户ID
            
        Raises:
            NotFoundError: 当部门不存在时抛出
            ValidationError: 当部门有子部门或关联用户时抛出
        """
        # 验证权限
        # TODO: 实现权限验证逻辑
        
        # 获取部门
        department = await Department.filter(
            uuid=department_uuid,
            tenant_id=tenant_id,
            deleted_at__isnull=True
        ).first()
        
        if not department:
            raise NotFoundError("部门", department_uuid)
        
        # 检查是否有子部门
        children_count = await Department.filter(
            tenant_id=tenant_id,
            parent_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        if children_count > 0:
            raise ValidationError(f"部门下存在子部门（{children_count}个），无法删除")
        
        # 检查是否有关联用户
        user_count = await User.filter(
            tenant_id=tenant_id,
            department_id=department.id,
            deleted_at__isnull=True
        ).count()
        
        if user_count > 0:
            # 自动清理关联用户的部门字段（设置为NULL）
            await User.filter(
                tenant_id=tenant_id,
                department_id=department.id,
                deleted_at__isnull=True
            ).update(department_id=None)
        
        # 软删除
        from datetime import datetime
        department.deleted_at = datetime.now()
        await department.save()
    
    @staticmethod
    async def update_department_order(
        tenant_id: int,
        department_orders: List[Dict[str, Any]]
    ) -> bool:
        """
        更新部门排序
        
        Args:
            tenant_id: 组织ID
            department_orders: 部门排序列表，格式：[{"uuid": "...", "sort_order": 1}, ...]
            
        Returns:
            bool: 是否成功
        """
        for order_item in department_orders:
            department_uuid = order_item.get("uuid")
            sort_order = order_item.get("sort_order")
            
            if department_uuid and sort_order is not None:
                department = await Department.filter(
                    uuid=department_uuid,
                    tenant_id=tenant_id,
                    deleted_at__isnull=True
                ).first()
                
                if department:
                    department.sort_order = sort_order
                    await department.save()
        
        return True
    
    @staticmethod
    async def import_departments_from_data(
        tenant_id: int,
        data: List[List[Any]],
        current_user_id: int
    ) -> Dict[str, Any]:
        """
        从二维数组数据导入部门
        
        接收前端 uni_import 组件传递的二维数组数据，批量创建部门。
        数据格式：第一行为表头，第二行为示例数据（跳过），从第三行开始为实际数据。
        
        Args:
            tenant_id: 组织ID
            data: 二维数组数据（从 uni_import 组件传递）
            current_user_id: 当前用户ID
            
        Returns:
            dict: 导入结果（成功数、失败数、错误列表）
        """
        if not data or len(data) < 2:
            raise ValidationError("导入数据格式错误：至少需要表头和示例数据行")
        
        # 解析表头（第一行，索引0）
        headers = [str(cell).strip() if cell is not None else '' for cell in data[0]]
        
        # 表头字段映射（支持中英文）
        header_map = {
            '部门名称': 'name',
            '*部门名称': 'name',
            'name': 'name',
            '*name': 'name',
            '部门代码': 'code',
            'code': 'code',
            '父部门': 'parent',
            'parent': 'parent',
            '负责人': 'manager',
            'manager': 'manager',
            '描述': 'description',
            'description': 'description',
            '排序': 'sort_order',
            'sort_order': 'sort_order',
            '启用': 'is_active',
            'is_active': 'is_active',
        }
        
        # 找到表头索引
        header_index_map = {}
        for idx, header in enumerate(headers):
            if header and header in header_map:
                header_index_map[header_map[header]] = idx
        
        # 验证必填字段
        required_fields = ['name']
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
        
        # 用于缓存已创建的部门（按名称），用于处理父子关系
        created_departments_cache: Dict[str, Department] = {}
        
        for row, row_idx in non_empty_rows:
            try:
                # 解析行数据
                dept_data = {}
                for field, col_idx in header_index_map.items():
                    if col_idx < len(row):
                        value = row[col_idx]
                        if value is not None:
                            dept_data[field] = str(value).strip()
                
                # 验证必填字段
                if not dept_data.get('name'):
                    errors.append({
                        "row": row_idx,
                        "error": "部门名称为空"
                    })
                    failure_count += 1
                    continue
                
                # 检查部门名称是否已存在
                existing_dept = await Department.filter(
                    tenant_id=tenant_id,
                    name=dept_data['name'],
                    deleted_at__isnull=True
                ).first()
                
                if existing_dept:
                    errors.append({
                        "row": row_idx,
                        "error": f"部门名称 {dept_data['name']} 已存在"
                    })
                    failure_count += 1
                    continue
                
                # 处理父部门（通过名称查找）
                parent_id = None
                if dept_data.get('parent'):
                    # 先查找已创建的部门
                    if dept_data['parent'] in created_departments_cache:
                        parent_id = created_departments_cache[dept_data['parent']].id
                    else:
                        # 查找数据库中的部门
                        parent = await Department.filter(
                            tenant_id=tenant_id,
                            deleted_at__isnull=True
                        ).filter(
                            Q(name=dept_data['parent']) | Q(code=dept_data['parent'])
                        ).first()
                        
                        if parent:
                            parent_id = parent.id
                        else:
                            errors.append({
                                "row": row_idx,
                                "error": f"父部门 {dept_data['parent']} 不存在（请先导入父部门）"
                            })
                            failure_count += 1
                            continue
                
                # 处理部门负责人（通过用户名查找）
                manager_id = None
                if dept_data.get('manager'):
                    manager = await User.filter(
                        tenant_id=tenant_id,
                        deleted_at__isnull=True
                    ).filter(
                        Q(username=dept_data['manager']) | Q(full_name=dept_data['manager'])
                    ).first()
                    
                    if manager:
                        manager_id = manager.id
                    else:
                        errors.append({
                            "row": row_idx,
                            "error": f"负责人 {dept_data['manager']} 不存在"
                        })
                        failure_count += 1
                        continue
                
                # 处理排序
                sort_order = 0
                if dept_data.get('sort_order'):
                    try:
                        sort_order = int(dept_data['sort_order'])
                    except ValueError:
                        sort_order = 0
                
                # 处理启用状态
                is_active = True
                if dept_data.get('is_active'):
                    is_active_str = str(dept_data['is_active']).lower()
                    is_active = is_active_str in ('true', '1', '是', '启用', 'enabled')
                
                # 创建部门
                department = await Department.create(
                    tenant_id=tenant_id,
                    name=dept_data['name'],
                    code=dept_data.get('code'),
                    description=dept_data.get('description'),
                    parent_id=parent_id,
                    manager_id=manager_id,
                    sort_order=sort_order,
                    is_active=is_active,
                )
                
                # 缓存已创建的部门
                created_departments_cache[dept_data['name']] = department
                
                success_count += 1
                
            except Exception as e:
                logger.error(f"导入部门失败（行{row_idx}）: {e}")
                errors.append({
                    "row": row_idx,
                    "error": str(e)
                })
                failure_count += 1
        
        return {
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
        }

