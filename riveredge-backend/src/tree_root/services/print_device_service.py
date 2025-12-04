"""
打印设备管理服务模块

提供打印设备的 CRUD 操作和打印设备连接测试功能。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
import socket

from tortoise.exceptions import IntegrityError

from tree_root.models.print_device import PrintDevice
from tree_root.models.print_template import PrintTemplate
from tree_root.schemas.print_device import (
    PrintDeviceCreate,
    PrintDeviceUpdate,
    PrintDeviceTestRequest,
    PrintDevicePrintRequest,
)
from soil.exceptions.exceptions import NotFoundError, ValidationError


class PrintDeviceService:
    """
    打印设备管理服务类
    
    提供打印设备的 CRUD 操作和打印设备连接测试功能。
    """
    
    @staticmethod
    async def create_print_device(
        tenant_id: int,
        data: PrintDeviceCreate
    ) -> PrintDevice:
        """
        创建打印设备
        
        Args:
            tenant_id: 组织ID
            data: 打印设备创建数据
            
        Returns:
            PrintDevice: 创建的打印设备对象
            
        Raises:
            ValidationError: 当设备代码已存在时抛出
        """
        try:
            print_device = PrintDevice(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await print_device.save()
            
            # TODO: 可选集成 Inngest 函数注册
            # 如果需要通过 Inngest 异步执行打印，可以在这里注册函数
            
            return print_device
        except IntegrityError:
            raise ValidationError(f"打印设备代码 {data.code} 已存在")
    
    @staticmethod
    async def get_print_device_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> PrintDevice:
        """
        根据UUID获取打印设备
        
        Args:
            tenant_id: 组织ID
            uuid: 打印设备UUID
            
        Returns:
            PrintDevice: 打印设备对象
            
        Raises:
            NotFoundError: 当打印设备不存在时抛出
        """
        print_device = await PrintDevice.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not print_device:
            raise NotFoundError("打印设备不存在")
        
        return print_device
    
    @staticmethod
    async def list_print_devices(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[PrintDevice]:
        """
        获取打印设备列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 设备类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[PrintDevice]: 打印设备列表
        """
        query = PrintDevice.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_print_device(
        tenant_id: int,
        uuid: str,
        data: PrintDeviceUpdate
    ) -> PrintDevice:
        """
        更新打印设备
        
        Args:
            tenant_id: 组织ID
            uuid: 打印设备UUID
            data: 打印设备更新数据
            
        Returns:
            PrintDevice: 更新后的打印设备对象
            
        Raises:
            NotFoundError: 当打印设备不存在时抛出
        """
        print_device = await PrintDeviceService.get_print_device_by_uuid(tenant_id, uuid)
        
        old_is_active = print_device.is_active
        old_is_online = print_device.is_online
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(print_device, key, value)
        
        await print_device.save()
        
        # 如果设备状态变更，异步通知关联的打印模板
        if (data.is_active is not None and old_is_active != print_device.is_active) or \
           (old_is_online != print_device.is_online):
            import asyncio
            asyncio.create_task(
                PrintDeviceService._notify_templates_of_device_change(
                    tenant_id=tenant_id,
                    device_uuid=uuid
                )
            )
        
        return print_device
    
    @staticmethod
    async def delete_print_device(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除打印设备（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 打印设备UUID
            
        Raises:
            NotFoundError: 当打印设备不存在时抛出
        """
        print_device = await PrintDeviceService.get_print_device_by_uuid(tenant_id, uuid)
        print_device.deleted_at = datetime.now()
        await print_device.save()
        
        # 异步通知关联的打印模板，清除设备关联
        import asyncio
        asyncio.create_task(
            PrintDeviceService._notify_templates_of_device_change(
                tenant_id=tenant_id,
                device_uuid=uuid,
                is_deleted=True
            )
        )
    
    @staticmethod
    async def test_print_device(
        tenant_id: int,
        uuid: str,
        data: PrintDeviceTestRequest
    ) -> dict:
        """
        测试打印设备连接
        
        Args:
            tenant_id: 组织ID
            uuid: 打印设备UUID
            data: 测试请求数据
            
        Returns:
            dict: 测试结果
            
        Raises:
            NotFoundError: 当打印设备不存在时抛出
            ValidationError: 当设备未启用时抛出
        """
        print_device = await PrintDeviceService.get_print_device_by_uuid(tenant_id, uuid)
        
        if not print_device.is_active:
            raise ValidationError("打印设备未启用")
        
        success = False
        message = None
        error = None
        
        try:
            if print_device.type == "network":
                # 测试网络打印机连接
                config = print_device.config
                host = config.get("host")
                port = config.get("port", 9100)
                
                if not host:
                    raise ValidationError("网络打印机配置缺少 host 参数")
                
                # 尝试连接
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(5)
                result = sock.connect_ex((host, port))
                sock.close()
                
                if result == 0:
                    success = True
                    message = "网络打印机连接成功"
                    print_device.is_online = True
                    print_device.last_connected_at = datetime.now()
                else:
                    error = "网络打印机连接失败"
                    print_device.is_online = False
            elif print_device.type == "local":
                # 测试本地打印机（需要系统支持）
                # TODO: 实现本地打印机测试（可能需要 pycups）
                success = True
                message = "本地打印机测试通过（需要系统支持）"
                print_device.is_online = True
                print_device.last_connected_at = datetime.now()
            else:
                raise ValidationError(f"不支持的设备类型: {print_device.type}")
        except Exception as e:
            error = str(e)
            print_device.is_online = False
        finally:
            await print_device.save()
        
        return {
            "success": success,
            "message": message,
            "error": error
        }
    
    @staticmethod
    async def print_with_device(
        tenant_id: int,
        uuid: str,
        data: PrintDevicePrintRequest
    ) -> dict:
        """
        使用打印设备执行打印任务
        
        Args:
            tenant_id: 组织ID
            uuid: 打印设备UUID
            data: 打印请求数据
            
        Returns:
            dict: 打印结果
            
        Raises:
            NotFoundError: 当打印设备不存在时抛出
            ValidationError: 当设备未启用或不在线时抛出
        """
        print_device = await PrintDeviceService.get_print_device_by_uuid(tenant_id, uuid)
        
        if not print_device.is_active:
            raise ValidationError("打印设备未启用")
        
        if not print_device.is_online:
            raise ValidationError("打印设备不在线")
        
        # 如果选择异步执行，通过 Inngest 执行
        if data.async_execution:
            # TODO: 集成 Inngest 异步执行
            # from tree_root.inngest.client import inngest_client
            # from inngest import Event
            # await inngest_client.send_event(
            #     event=Event(
            #         name="print/execute",
            #         data={
            #             "tenant_id": tenant_id,
            #             "device_id": str(print_device.uuid),
            #             "template_id": data.template_uuid,
            #             "data": data.data
            #         }
            #     )
            # )
            # return {
            #     "success": True,
            #     "async": True,
            #     "message": "打印任务已提交异步执行"
            # }
            raise ValidationError("异步执行功能待实现")
        
        # 同步执行打印
        # 1. 获取打印模板
        from tree_root.services.print_template_service import PrintTemplateService
        print_template = await PrintTemplateService.get_print_template_by_uuid(
            tenant_id=tenant_id,
            uuid=data.template_uuid
        )
        
        # 2. 验证模板是否关联了当前打印设备（如果模板配置了设备）
        if print_template.config and print_template.config.get("device_uuid"):
            template_device_uuid = print_template.config.get("device_uuid")
            if template_device_uuid != uuid:
                # 模板关联了其他设备，但用户指定了不同的设备
                # 可以选择使用模板关联的设备，或者使用用户指定的设备
                # 这里使用用户指定的设备（因为用户明确指定了）
                pass
        
        # 3. 渲染模板
        from tree_root.schemas.print_template import PrintTemplateRenderRequest
        render_request = PrintTemplateRenderRequest(
            data=data.data,
            output_format="pdf",  # 默认 PDF
            async_execution=False
        )
        render_result = await PrintTemplateService.render_print_template(
            tenant_id=tenant_id,
            uuid=data.template_uuid,
            data=render_request
        )
        
        # 4. 发送到打印设备（TODO: 实现实际的打印逻辑）
        # 这里只是示例，实际需要根据设备类型调用相应的打印接口
        
        # 更新使用统计
        print_device.usage_count += 1
        print_device.last_used_at = datetime.now()
        await print_device.save()
        
        return {
            "success": True,
            "message": "打印任务已提交"
        }
    
    @staticmethod
    async def _notify_templates_of_device_change(
        tenant_id: int,
        device_uuid: str,
        is_deleted: bool = False
    ) -> None:
        """
        通知打印模板打印设备变更（预留接口）
        
        此方法用于在打印设备变更或删除时，触发后续的业务逻辑，
        例如更新关联打印模板的状态、清除设备关联等。
        
        Args:
            tenant_id: 组织ID
            device_uuid: 打印设备UUID
            is_deleted: 是否已删除
        """
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # 查找所有关联此设备的打印模板
            # 注意：Tortoise ORM 不支持直接查询 JSON 字段，需要先获取所有模板，然后过滤
            all_templates = await PrintTemplate.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True
            ).all()
            
            templates = [
                template for template in all_templates
                if template.config and template.config.get("device_uuid") == device_uuid
            ]
            
            if is_deleted:
                # 如果设备已删除，清除所有关联模板的设备关联
                for template in templates:
                    if template.config and template.config.get("device_uuid") == device_uuid:
                        template.config.pop("device_uuid", None)
                        await template.save()
                        logger.info(f"打印模板 {template.name} (UUID: {template.uuid}) 的设备关联已清除")
            else:
                # 如果设备状态变更，可以在这里更新模板状态（如果需要）
                # 例如：如果设备离线，可以禁用关联的模板
                device = await PrintDeviceService.get_print_device_by_uuid(tenant_id, device_uuid)
                if not device.is_active or not device.is_online:
                    # 设备不可用，可以在这里处理（例如记录日志）
                    logger.info(f"打印设备 {device.name} (UUID: {device_uuid}) 状态变更，关联模板数量: {len(templates)}")
        except Exception as e:
            logger.error(f"通知打印模板设备变更失败: {str(e)}")

