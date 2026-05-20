"""
用户导入时解析/自动创建部门、职位、角色（按系统编码规则生成 code）
"""

from __future__ import annotations

from typing import Dict, Optional

from tortoise.expressions import Q
from tortoise.exceptions import IntegrityError

from core.models.department import Department
from core.models.position import Position
from core.models.role import Role
from core.schemas.department import DepartmentCreate
from core.schemas.position import PositionCreate
from core.schemas.role import RoleCreate
from core.services.organization.department_service import DepartmentService
from core.services.authorization.position_service import PositionService
from core.services.authorization.role_service import RoleService
from core.services.business.code_generation_service import CodeGenerationService
from core.services.default.default_values_service import DefaultValuesService
from infra.exceptions.exceptions import ValidationError

PAGE_DEPARTMENT = "system-department"
PAGE_POSITION = "system-position"
PAGE_ROLE = "system-role"

RULE_DEPARTMENT = "DEPARTMENT_CODE"
RULE_POSITION = "POSITION_CODE"
RULE_ROLE = "ROLE_CODE"


class UserImportReferenceService:
    @staticmethod
    async def lookup_department(tenant_id: int, name_or_code: str) -> Optional[Department]:
        key = (name_or_code or "").strip()
        if not key:
            return None
        return await UserImportReferenceService._find_by_name_or_code(Department, tenant_id, key)

    @staticmethod
    async def lookup_position(tenant_id: int, name_or_code: str) -> Optional[Position]:
        key = (name_or_code or "").strip()
        if not key:
            return None
        return await UserImportReferenceService._find_by_name_or_code(Position, tenant_id, key)

    @staticmethod
    async def lookup_role(tenant_id: int, name_or_code: str) -> Optional[Role]:
        key = (name_or_code or "").strip()
        if not key:
            return None
        return await UserImportReferenceService._find_by_name_or_code(Role, tenant_id, key)

    @staticmethod
    async def _generate_code(tenant_id: int, page_code: str, rule_code: str) -> str:
        await DefaultValuesService.ensure_code_rule_for_page(tenant_id, page_code)
        return await CodeGenerationService.generate_code(tenant_id, rule_code)

    @staticmethod
    async def _find_by_name_or_code(model, tenant_id: int, value: str):
        return await model.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).filter(Q(name=value) | Q(code=value)).first()

    @staticmethod
    async def ensure_department(
        tenant_id: int,
        name_or_code: str,
        current_user_id: int,
        cache: Dict[str, Department],
    ) -> Department:
        key = (name_or_code or "").strip()
        if not key:
            raise ValidationError("部门名称为空")
        if key in cache:
            return cache[key]

        existing = await UserImportReferenceService._find_by_name_or_code(
            Department, tenant_id, key
        )
        if existing:
            cache[key] = existing
            return existing

        code = await UserImportReferenceService._generate_code(
            tenant_id, PAGE_DEPARTMENT, RULE_DEPARTMENT
        )
        created = await DepartmentService.create_department(
            tenant_id,
            DepartmentCreate(name=key, code=code, is_active=True),
            current_user_id,
        )
        cache[key] = created
        return created

    @staticmethod
    async def ensure_position(
        tenant_id: int,
        name_or_code: str,
        current_user_id: int,
        cache: Dict[str, Position],
        *,
        department_id: Optional[int] = None,
    ) -> Position:
        key = (name_or_code or "").strip()
        if not key:
            raise ValidationError("职位名称为空")
        if key in cache:
            return cache[key]

        existing = await UserImportReferenceService._find_by_name_or_code(
            Position, tenant_id, key
        )
        if existing:
            cache[key] = existing
            return existing

        code = await UserImportReferenceService._generate_code(
            tenant_id, PAGE_POSITION, RULE_POSITION
        )
        dept_uuid = None
        if department_id:
            dept = await Department.filter(id=department_id, tenant_id=tenant_id).first()
            if dept:
                dept_uuid = dept.uuid

        created = await PositionService.create_position(
            tenant_id,
            PositionCreate(
                name=key,
                code=code,
                is_active=True,
                department_uuid=dept_uuid,
            ),
            current_user_id,
        )
        cache[key] = created
        return created

    @staticmethod
    async def ensure_role(
        tenant_id: int,
        name_or_code: str,
        current_user_id: int,
        cache: Dict[str, Role],
    ) -> Role:
        key = (name_or_code or "").strip()
        if not key:
            raise ValidationError("角色名称为空")
        if key in cache:
            return cache[key]

        existing = await UserImportReferenceService._find_by_name_or_code(
            Role, tenant_id, key
        )
        if existing:
            cache[key] = existing
            return existing

        for attempt in range(3):
            code = await UserImportReferenceService._generate_code(
                tenant_id, PAGE_ROLE, RULE_ROLE
            )
            try:
                created = await RoleService.create_role(
                    tenant_id,
                    RoleCreate(name=key, code=code, is_active=True),
                    current_user_id,
                )
                cache[key] = created
                return created
            except IntegrityError:
                if attempt >= 2:
                    raise ValidationError(f"角色代码 {code} 冲突，请检查编码规则")
                continue
            except ValidationError as e:
                if "已存在" in str(e) and attempt < 2:
                    continue
                raise

        raise ValidationError(f"无法创建角色: {key}")
