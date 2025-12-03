"""
打印模板管理服务模块

提供打印模板的 CRUD 操作和模板渲染功能。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
import io
import re

from tortoise.exceptions import IntegrityError

from tree_root.models.print_template import PrintTemplate
from tree_root.schemas.print_template import (
    PrintTemplateCreate,
    PrintTemplateUpdate,
    PrintTemplateRenderRequest,
)
from soil.exceptions.exceptions import NotFoundError, ValidationError


class PrintTemplateService:
    """
    打印模板管理服务类
    
    提供打印模板的 CRUD 操作和模板渲染功能。
    """
    
    @staticmethod
    async def create_print_template(
        tenant_id: int,
        data: PrintTemplateCreate
    ) -> PrintTemplate:
        """
        创建打印模板
        
        Args:
            tenant_id: 组织ID
            data: 打印模板创建数据
            
        Returns:
            PrintTemplate: 创建的打印模板对象
            
        Raises:
            ValidationError: 当模板代码已存在时抛出
        """
        try:
            print_template = PrintTemplate(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await print_template.save()
            
            # TODO: 可选集成 Inngest 函数注册
            # 如果需要通过 Inngest 异步执行打印，可以在这里注册函数
            
            return print_template
        except IntegrityError:
            raise ValidationError(f"打印模板代码 {data.code} 已存在")
    
    @staticmethod
    async def get_print_template_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> PrintTemplate:
        """
        根据UUID获取打印模板
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            
        Returns:
            PrintTemplate: 打印模板对象
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
        """
        print_template = await PrintTemplate.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not print_template:
            raise NotFoundError("打印模板不存在")
        
        return print_template
    
    @staticmethod
    async def list_print_templates(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[PrintTemplate]:
        """
        获取打印模板列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 模板类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[PrintTemplate]: 打印模板列表
        """
        query = PrintTemplate.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_print_template(
        tenant_id: int,
        uuid: str,
        data: PrintTemplateUpdate
    ) -> PrintTemplate:
        """
        更新打印模板
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            data: 打印模板更新数据
            
        Returns:
            PrintTemplate: 更新后的打印模板对象
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
        """
        print_template = await PrintTemplateService.get_print_template_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(print_template, key, value)
        
        await print_template.save()
        return print_template
    
    @staticmethod
    async def delete_print_template(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除打印模板（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
        """
        print_template = await PrintTemplateService.get_print_template_by_uuid(tenant_id, uuid)
        print_template.deleted_at = datetime.now()
        await print_template.save()
    
    @staticmethod
    def render_template(
        template_content: str,
        data: dict
    ) -> str:
        """
        渲染模板内容（简单的变量替换）
        
        Args:
            template_content: 模板内容
            data: 模板数据
            
        Returns:
            str: 渲染后的内容
        """
        # 简单的变量替换：{{variable_name}}
        rendered = template_content
        for key, value in data.items():
            placeholder = f"{{{{{key}}}}}"
            rendered = rendered.replace(placeholder, str(value))
        
        return rendered
    
    @staticmethod
    async def render_print_template(
        tenant_id: int,
        uuid: str,
        data: PrintTemplateRenderRequest
    ) -> dict:
        """
        渲染打印模板
        
        Args:
            tenant_id: 组织ID
            uuid: 打印模板UUID
            data: 渲染请求数据
            
        Returns:
            dict: 渲染结果
            
        Raises:
            NotFoundError: 当打印模板不存在时抛出
            ValidationError: 当模板未启用时抛出
        """
        print_template = await PrintTemplateService.get_print_template_by_uuid(tenant_id, uuid)
        
        if not print_template.is_active:
            raise ValidationError("打印模板未启用")
        
        # 如果选择异步执行，通过 Inngest 执行
        if data.async_execution:
            # TODO: 集成 Inngest 异步执行
            # from tree_root.inngest.client import inngest_client
            # from inngest import Event
            # await inngest_client.send_event(
            #     event=Event(
            #         name="print/render",
            #         data={
            #             "tenant_id": tenant_id,
            #             "template_id": str(print_template.uuid),
            #             "data": data.data,
            #             "output_format": data.output_format
            #         }
            #     )
            # )
            # return {
            #     "success": True,
            #     "async": True,
            #     "message": "打印任务已提交异步执行"
            # }
            raise ValidationError("异步执行功能待实现")
        
        # 同步渲染模板
        rendered_content = PrintTemplateService.render_template(
            print_template.content,
            data.data
        )
        
        # 更新使用统计
        print_template.usage_count += 1
        print_template.last_used_at = datetime.now()
        await print_template.save()
        
        # TODO: 根据 output_format 生成文件（PDF、HTML等）
        # 目前只返回渲染后的内容
        return {
            "success": True,
            "content": rendered_content,
            "message": "模板渲染成功"
        }

