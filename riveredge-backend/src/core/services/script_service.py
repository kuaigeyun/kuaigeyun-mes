"""
脚本管理服务模块

提供脚本的 CRUD 操作和脚本执行功能。
"""

from typing import Optional, List
from uuid import UUID
from datetime import datetime
import subprocess
import json
import time

from tortoise.exceptions import IntegrityError

from core.models.script import Script
from core.schemas.script import (
    ScriptCreate,
    ScriptUpdate,
    ScriptExecuteRequest,
)
from infra.exceptions.exceptions import NotFoundError, ValidationError


class ScriptService:
    """
    脚本管理服务类
    
    提供脚本的 CRUD 操作和脚本执行功能。
    """
    
    @staticmethod
    async def create_script(
        tenant_id: int,
        data: ScriptCreate
    ) -> Script:
        """
        创建脚本
        
        Args:
            tenant_id: 组织ID
            data: 脚本创建数据
            
        Returns:
            Script: 创建的脚本对象
            
        Raises:
            ValidationError: 当脚本代码已存在时抛出
        """
        try:
            script = Script(
                tenant_id=tenant_id,
                **data.model_dump()
            )
            await script.save()
            
            # TODO: 可选集成 Inngest 函数注册
            # 如果需要通过 Inngest 异步执行，可以在这里注册函数
            
            return script
        except IntegrityError:
            raise ValidationError(f"脚本代码 {data.code} 已存在")
    
    @staticmethod
    async def get_script_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> Script:
        """
        根据UUID获取脚本
        
        Args:
            tenant_id: 组织ID
            uuid: 脚本UUID
            
        Returns:
            Script: 脚本对象
            
        Raises:
            NotFoundError: 当脚本不存在时抛出
        """
        script = await Script.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not script:
            raise NotFoundError("脚本不存在")
        
        return script
    
    @staticmethod
    async def list_scripts(
        tenant_id: int,
        skip: int = 0,
        limit: int = 100,
        type: Optional[str] = None,
        is_active: Optional[bool] = None
    ) -> List[Script]:
        """
        获取脚本列表
        
        Args:
            tenant_id: 组织ID
            skip: 跳过数量
            limit: 限制数量
            type: 脚本类型筛选
            is_active: 是否启用筛选
            
        Returns:
            List[Script]: 脚本列表
        """
        query = Script.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        if type:
            query = query.filter(type=type)
        
        if is_active is not None:
            query = query.filter(is_active=is_active)
        
        return await query.order_by("-created_at").offset(skip).limit(limit).all()
    
    @staticmethod
    async def update_script(
        tenant_id: int,
        uuid: str,
        data: ScriptUpdate
    ) -> Script:
        """
        更新脚本
        
        Args:
            tenant_id: 组织ID
            uuid: 脚本UUID
            data: 脚本更新数据
            
        Returns:
            Script: 更新后的脚本对象
            
        Raises:
            NotFoundError: 当脚本不存在时抛出
        """
        script = await ScriptService.get_script_by_uuid(tenant_id, uuid)
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(script, key, value)
        
        await script.save()
        return script
    
    @staticmethod
    async def delete_script(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除脚本（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 脚本UUID
            
        Raises:
            NotFoundError: 当脚本不存在时抛出
        """
        script = await ScriptService.get_script_by_uuid(tenant_id, uuid)
        script.deleted_at = datetime.now()
        await script.save()
    
    @staticmethod
    async def execute_script(
        tenant_id: int,
        uuid: str,
        data: ScriptExecuteRequest
    ) -> dict:
        """
        执行脚本
        
        Args:
            tenant_id: 组织ID
            uuid: 脚本UUID
            data: 执行请求数据
            
        Returns:
            dict: 执行结果
            
        Raises:
            NotFoundError: 当脚本不存在时抛出
            ValidationError: 当脚本未启用或正在运行时抛出
        """
        script = await ScriptService.get_script_by_uuid(tenant_id, uuid)
        
        if not script.is_active:
            raise ValidationError("脚本未启用")
        
        if script.is_running:
            raise ValidationError("脚本正在运行中")
        
        # 如果选择异步执行，通过 Inngest 执行
        if data.async_execution:
            # TODO: 集成 Inngest 异步执行
            # from core.inngest.client import inngest_client
            # from inngest import Event
            # await inngest_client.send_event(
            #     event=Event(
            #         name="script/execute",
            #         data={
            #             "tenant_id": tenant_id,
            #             "script_id": str(script.uuid),
            #             "parameters": data.parameters or {}
            #         }
            #     )
            # )
            # return {
            #     "success": True,
            #     "async": True,
            #     "message": "脚本已提交异步执行"
            # }
            raise ValidationError("异步执行功能待实现")
        
        # 同步执行脚本
        script.is_running = True
        await script.save()
        
        start_time = time.time()
        output = None
        error = None
        success = False
        
        try:
            if script.type == "python":
                # 执行 Python 脚本
                result = subprocess.run(
                    ["python", "-c", script.content],
                    capture_output=True,
                    text=True,
                    timeout=300,  # 5分钟超时
                    env={**dict(data.parameters or {}), **dict(script.config or {})}
                )
                output = result.stdout
                error = result.stderr
                success = result.returncode == 0
            elif script.type == "shell":
                # 执行 Shell 脚本
                result = subprocess.run(
                    script.content,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300,
                    env={**dict(data.parameters or {}), **dict(script.config or {})}
                )
                output = result.stdout
                error = result.stderr
                success = result.returncode == 0
            elif script.type == "sql":
                # SQL 脚本需要通过数据库连接执行
                # TODO: 实现 SQL 脚本执行
                raise ValidationError("SQL 脚本执行功能待实现")
            else:
                raise ValidationError(f"不支持的脚本类型: {script.type}")
        except subprocess.TimeoutExpired:
            error = "脚本执行超时（超过5分钟）"
            success = False
        except Exception as e:
            error = str(e)
            success = False
        finally:
            execution_time = time.time() - start_time
            
            # 更新脚本执行信息
            script.is_running = False
            script.last_run_at = datetime.now()
            script.last_run_status = "success" if success else "failed"
            script.last_error = error
            await script.save()
        
        return {
            "success": success,
            "output": output,
            "error": error,
            "execution_time": execution_time
        }

