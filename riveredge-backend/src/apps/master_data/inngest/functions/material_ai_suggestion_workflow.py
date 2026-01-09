"""
物料创建后的 AI 建议工作流

监听 material/created 事件，异步生成 AI 建议。

Author: Luigi Lu
Date: 2026-01-09
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from loguru import logger

from core.inngest.client import inngest_client
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from infra.domain.tenant_context import get_current_tenant_id


@inngest_client.create_function(
    fn_id="material-ai-suggestion-workflow",
    name="物料AI建议工作流",
    trigger=TriggerEvent(event="material/created"),
    retries=2,
)
@with_tenant_isolation  # 添加租户隔离装饰器
async def material_ai_suggestion_workflow(event: Event) -> Dict[str, Any]:
    """
    物料创建后的 AI 建议工作流
    
    监听 material/created 事件，异步生成 AI 建议。
    
    步骤：
    1. 获取物料信息
    2. 调用 AI 服务生成建议
    3. 记录建议结果（可选，可以存储到数据库或缓存）
    4. 返回建议结果
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        Dict[str, Any]: 工作流执行结果
    """
    # 从上下文获取 tenant_id（装饰器已验证和设置）
    tenant_id = get_current_tenant_id()
    
    data = event.data or {}
    material_id = data.get("material_id")
    material_uuid = data.get("material_uuid")
    material_name = data.get("material_name")
    material_type = data.get("material_type")
    
    if not material_id:
        logger.warning(f"物料AI建议工作流：缺少 material_id，事件数据: {data}")
        return {
            "success": False,
            "error": "缺少必要参数：material_id"
        }
    
    try:
        logger.info(f"开始为物料生成 AI 建议: material_id={material_id}, tenant_id={tenant_id}")
        
        # 步骤1：调用 AI 服务生成建议
        from apps.master_data.services.ai.material_ai_service import MaterialAIService
        
        suggestions = await MaterialAIService.generate_suggestions(
            tenant_id=tenant_id,
            material_id=material_id,
            material_name=material_name,
            material_type=material_type,
        )
        
        logger.info(
            f"为物料 {material_id} 生成 AI 建议成功，"
            f"共 {len(suggestions)} 条建议"
        )
        
        # 步骤2：记录建议结果（可选）
        # 可以存储到数据库或缓存，供前端查询
        # 当前简化实现：仅记录日志，不存储
        
        # 步骤3：返回结果
        return {
            "success": True,
            "material_id": material_id,
            "material_uuid": material_uuid,
            "suggestions_count": len(suggestions),
            "suggestions": suggestions,
        }
    except Exception as e:
        logger.error(f"生成 AI 建议失败: material_id={material_id}, 错误: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
            "material_id": material_id,
        }
