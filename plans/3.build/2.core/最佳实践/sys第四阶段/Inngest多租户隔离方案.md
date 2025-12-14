# Inngest 多租户隔离方案

## 📋 概述

Inngest 作为流程管理核心引擎，必须支持多租户隔离，确保不同租户的数据和任务完全隔离。

**当前实现状态**：
- ✅ 所有 Inngest 函数都通过事件数据传递 `tenant_id`
- ✅ 所有数据库查询都使用 `tenant_id` 进行过滤
- ⚠️ 未使用 `tenant_context` 机制，无法利用自动过滤
- ⚠️ 缺少统一的租户隔离中间件或装饰器

---

## 🎯 多租户隔离策略

### 策略 1：事件数据传递（当前实现）

**实现方式**：
- 在发送事件时，将 `tenant_id` 包含在事件数据中
- Inngest 函数从 `event.data` 中获取 `tenant_id`
- 所有数据库查询都明确使用 `tenant_id` 参数

**优点**：
- ✅ 简单直接，易于理解
- ✅ 显式传递，不会遗漏
- ✅ 适合异步任务场景

**缺点**：
- ❌ 每个函数都需要手动获取和验证 `tenant_id`
- ❌ 无法利用 `tenant_context` 的自动过滤机制
- ❌ 代码重复，容易出错

**示例**：
```python
# 发送事件
await inngest_client.send_event(
    event=Event(
        name="message/send",
        data={
            "tenant_id": 1,  # 显式传递 tenant_id
            "message_log_uuid": "...",
            # ... 其他数据
        }
    )
)

# Inngest 函数中获取
async def message_sender_function(event: Event) -> Dict[str, Any]:
    data = event.data or {}
    tenant_id = data.get("tenant_id")
    
    if not tenant_id:
        return {"success": False, "error": "缺少 tenant_id"}
    
    # 使用 tenant_id 查询
    message_log = await MessageLog.filter(
        tenant_id=tenant_id,  # 显式过滤
        uuid=message_log_uuid
    ).first()
```

### 策略 2：租户上下文设置（推荐）

**实现方式**：
- 在 Inngest 函数开始时，从事件数据中获取 `tenant_id`
- 使用 `set_current_tenant_id()` 设置租户上下文
- 后续所有数据库查询自动使用租户上下文过滤

**优点**：
- ✅ 利用 `tenant_context` 的自动过滤机制
- ✅ 代码更简洁，减少重复
- ✅ 与 FastAPI 路由的租户隔离机制一致

**缺点**：
- ⚠️ 需要确保每个函数都设置租户上下文
- ⚠️ 异步任务中上下文传递需要注意

**示例**：
```python
from infra.domain.tenant_context import set_current_tenant_id, get_current_tenant_id

async def message_sender_function(event: Event) -> Dict[str, Any]:
    data = event.data or {}
    tenant_id = data.get("tenant_id")
    
    if not tenant_id:
        return {"success": False, "error": "缺少 tenant_id"}
    
    # 设置租户上下文
    set_current_tenant_id(tenant_id)
    
    try:
        # 后续查询可以自动使用租户上下文
        # 但 Tortoise ORM 的 filter 仍然需要显式传递 tenant_id
        # 所以这种方式主要适用于需要租户上下文的场景
        
        message_log = await MessageLog.filter(
            tenant_id=tenant_id,  # 仍然需要显式传递
            uuid=message_log_uuid
        ).first()
        
        # 如果使用 require_tenant_context()，可以验证租户上下文
        from infra.domain.tenant_context import require_tenant_context
        current_tenant_id = await require_tenant_context()
        assert current_tenant_id == tenant_id
        
        # ... 业务逻辑
    finally:
        # 清理租户上下文（可选，因为异步任务结束后上下文会自动清理）
        from infra.domain.tenant_context import clear_tenant_context
        clear_tenant_context()
```

### 策略 3：装饰器模式（最佳实践）

**实现方式**：
- 创建一个装饰器，自动处理租户隔离
- 装饰器自动从事件数据中获取 `tenant_id`
- 装饰器自动设置和清理租户上下文
- 装饰器自动验证 `tenant_id` 的有效性

**优点**：
- ✅ 代码最简洁，减少重复
- ✅ 统一的租户隔离处理
- ✅ 自动验证和错误处理
- ✅ 易于维护和扩展

**缺点**：
- ⚠️ 需要额外的装饰器实现
- ⚠️ 需要理解装饰器的工作原理

**示例**：
```python
# core/utils/inngest_tenant_isolation.py
from functools import wraps
from typing import Callable, Any
from inngest import Event
from infra.domain.tenant_context import set_current_tenant_id, clear_tenant_context
from infra.models.tenant import Tenant
from loguru import logger


def with_tenant_isolation(func: Callable) -> Callable:
    """
    Inngest 函数租户隔离装饰器
    
    自动处理租户隔离：
    1. 从事件数据中获取 tenant_id
    2. 验证 tenant_id 的有效性
    3. 设置租户上下文
    4. 执行函数
    5. 清理租户上下文
    
    Usage:
        @inngest_client.create_function(...)
        @with_tenant_isolation
        async def my_function(event: Event) -> Dict[str, Any]:
            # tenant_id 已经设置到上下文中
            # 可以直接使用 get_current_tenant_id() 获取
            pass
    """
    @wraps(func)
    async def wrapper(event: Event) -> Any:
        data = event.data or {}
        tenant_id = data.get("tenant_id")
        
        # 验证 tenant_id
        if not tenant_id:
            logger.error(f"Inngest 函数 {func.__name__} 缺少 tenant_id")
            return {
                "success": False,
                "error": "缺少必要参数：tenant_id"
            }
        
        # 验证租户是否存在
        try:
            tenant = await Tenant.get_or_none(id=tenant_id)
            if not tenant:
                logger.error(f"Inngest 函数 {func.__name__} 租户不存在: {tenant_id}")
                return {
                    "success": False,
                    "error": f"租户不存在: {tenant_id}"
                }
        except Exception as e:
            logger.error(f"Inngest 函数 {func.__name__} 验证租户失败: {e}")
            return {
                "success": False,
                "error": f"验证租户失败: {str(e)}"
            }
        
        # 设置租户上下文
        set_current_tenant_id(tenant_id)
        
        try:
            # 执行函数
            result = await func(event)
            return result
        except Exception as e:
            logger.error(f"Inngest 函数 {func.__name__} 执行失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
        finally:
            # 清理租户上下文
            clear_tenant_context()
    
    return wrapper
```

**使用装饰器**：
```python
from core.utils.inngest_tenant_isolation import with_tenant_isolation
from infra.domain.tenant_context import get_current_tenant_id

@inngest_client.create_function(
    fn_id="message-sender",
    name="消息发送器",
    trigger=TriggerEvent(event="message/send"),
    retries=3,
)
@with_tenant_isolation  # 添加装饰器
async def message_sender_function(event: Event) -> Dict[str, Any]:
    """
    消息发送器工作流函数
    
    租户隔离已由装饰器自动处理，可以直接使用 get_current_tenant_id() 获取租户ID。
    """
    # 从上下文获取 tenant_id（可选，也可以从 event.data 获取）
    tenant_id = get_current_tenant_id()
    
    # 或者从事件数据获取（装饰器已经验证过）
    data = event.data or {}
    message_log_uuid = data.get("message_log_uuid")
    
    # 查询时使用 tenant_id（仍然需要显式传递，因为 Tortoise ORM 不支持自动过滤）
    message_log = await MessageLog.filter(
        tenant_id=tenant_id,
        uuid=message_log_uuid
    ).first()
    
    # ... 业务逻辑
```

---

## 🔧 实施建议

### 阶段一：统一使用装饰器（推荐）

1. **创建装饰器**
   - [ ] 创建 `core/utils/inngest_tenant_isolation.py`
   - [ ] 实现 `with_tenant_isolation` 装饰器
   - [ ] 添加租户验证逻辑

2. **应用到现有函数**
   - [ ] 更新 `message_sender.py` 使用装饰器
   - [ ] 更新 `scheduled_task_executor.py` 使用装饰器
   - [ ] 更新 `approval_workflow.py` 使用装饰器
   - [ ] 更新其他 Inngest 函数使用装饰器

3. **测试验证**
   - [ ] 测试租户隔离是否正常工作
   - [ ] 测试跨租户数据是否隔离
   - [ ] 测试错误处理是否正常

### 阶段二：增强验证和日志

1. **增强验证**
   - [ ] 添加租户状态验证（是否启用、是否过期）
   - [ ] 添加租户权限验证（某些功能可能需要特定权限）
   - [ ] 添加租户配额验证（某些功能可能有配额限制）

2. **增强日志**
   - [ ] 记录租户隔离相关的日志
   - [ ] 记录跨租户访问尝试（安全审计）
   - [ ] 记录租户上下文设置和清理

### 阶段三：性能优化

1. **缓存优化**
   - [ ] 缓存租户信息（减少数据库查询）
   - [ ] 缓存租户配置（减少配置查询）

2. **批量处理优化**
   - [ ] 支持批量任务处理（同一租户的多个任务）
   - [ ] 优化租户上下文切换（减少上下文设置开销）

---

## 📋 最佳实践

### 1. 始终传递 tenant_id

**发送事件时**：
```python
# ✅ 正确：始终包含 tenant_id
await inngest_client.send_event(
    event=Event(
        name="message/send",
        data={
            "tenant_id": current_tenant_id,  # 必须包含
            # ... 其他数据
        }
    )
)

# ❌ 错误：缺少 tenant_id
await inngest_client.send_event(
    event=Event(
        name="message/send",
        data={
            # 缺少 tenant_id
            "message_log_uuid": "...",
        }
    )
)
```

### 2. 使用装饰器统一处理

**所有 Inngest 函数都应该使用装饰器**：
```python
@inngest_client.create_function(...)
@with_tenant_isolation  # 必须添加
async def my_function(event: Event) -> Dict[str, Any]:
    # 租户隔离已自动处理
    pass
```

### 3. 显式使用 tenant_id 查询

**即使设置了租户上下文，查询时仍然需要显式传递 tenant_id**：
```python
# ✅ 正确：显式传递 tenant_id
message_log = await MessageLog.filter(
    tenant_id=tenant_id,  # 必须显式传递
    uuid=message_log_uuid
).first()

# ❌ 错误：依赖自动过滤（Tortoise ORM 不支持）
message_log = await MessageLog.filter(
    uuid=message_log_uuid
).first()  # 可能返回其他租户的数据
```

### 4. 验证租户有效性

**在关键操作前验证租户**：
```python
# 验证租户是否存在
tenant = await Tenant.get_or_none(id=tenant_id)
if not tenant:
    return {"success": False, "error": "租户不存在"}

# 验证租户是否启用
if not tenant.is_active:
    return {"success": False, "error": "租户已禁用"}
```

### 5. 记录租户相关日志

**记录租户相关的操作日志**：
```python
logger.info(f"[租户 {tenant_id}] 消息发送开始: {message_log_uuid}")
logger.error(f"[租户 {tenant_id}] 消息发送失败: {error}")
```

---

## 🔒 安全考虑

### 1. 租户 ID 验证

- ✅ 验证租户 ID 是否为整数
- ✅ 验证租户是否存在
- ✅ 验证租户是否启用
- ✅ 验证租户是否过期（如果有过期机制）

### 2. 跨租户访问防护

- ✅ 所有数据库查询必须包含 `tenant_id` 过滤
- ✅ 禁止在 Inngest 函数中直接使用用户输入作为租户 ID
- ✅ 记录所有跨租户访问尝试（安全审计）

### 3. 事件数据验证

- ✅ 验证事件数据中是否包含 `tenant_id`
- ✅ 验证 `tenant_id` 的类型和格式
- ✅ 验证 `tenant_id` 是否与当前用户/会话匹配（如果可能）

---

## 📚 相关文档

- [Inngest 集成指南](./Inngest集成指南.md)
- [租户上下文管理](../../../infra/domain/tenant_context.py)
- [多租户数据隔离规范](../../../2.rules/3.数据库命名规范.md)

---

## ✅ 总结

Inngest 多租户隔离方案：

1. **当前实现**：通过事件数据传递 `tenant_id`，查询时显式过滤
2. **推荐方案**：使用装饰器统一处理租户隔离
3. **最佳实践**：始终传递 `tenant_id`，显式使用 `tenant_id` 查询，验证租户有效性

**核心原则**：
- ✅ 所有 Inngest 事件必须包含 `tenant_id`
- ✅ 所有数据库查询必须使用 `tenant_id` 过滤
- ✅ 使用装饰器统一处理租户隔离
- ✅ 记录租户相关的操作日志

---

**最后更新**：2025-01-11

