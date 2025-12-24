# Inngest 集成指南

## 📋 概述

本文档详细说明如何在 RiverEdge SaaS 多组织框架中集成 Inngest，作为流程管理的核心引擎。

**Inngest 定位**：
- ✅ **流程管理核心引擎**：所有流程相关功能都基于 Inngest
- ✅ **替代 APScheduler**：定时任务完全由 Inngest 处理
- ✅ **工作流编排引擎**：审批流程、电子记录等工作流都通过 Inngest 执行
- ✅ **事件驱动引擎**：消息推送等事件驱动功能都通过 Inngest 处理

---

## 🚀 Inngest 服务部署

### 1. 安装 Inngest

**方式一：使用 npm 全局安装**
```bash
npm install -g inngest
```

**方式二：下载二进制文件**
- 从 Inngest 官网下载对应平台的二进制文件
- 直接运行二进制文件

### 2. 配置 Inngest

**配置文件**：`inngest.config.json`

```json
{
  "event_api": {
    "port": 8288,
    "host": "0.0.0.0"
  },
  "database": {
    "url": "postgresql://user:password@localhost:5432/easthigh",
    "pool_size": 10
  },
  "log_level": "info"
}
```

**关键配置**：
- ✅ **事件 API 端口**：默认 8288（可自定义）
- ✅ **数据库连接**：使用 PostgreSQL，数据库名：`easthigh`
- ✅ **日志级别**：info（生产环境）或 debug（开发环境）

### 3. 启动 Inngest 服务

```bash
# 使用 npm 安装的版本
inngest dev

# 或使用二进制文件
./inngest dev
```

**启动后**：
- Inngest 事件 API：`http://localhost:8288`
- Inngest Dashboard：`http://localhost:8288/dashboard`（如果支持）

---

## 🐍 Python SDK 集成

### 1. 安装 Python SDK

```bash
pip install inngest
```

### 2. 在 FastAPI 中集成 Inngest

**文件位置**：`riveredge-backend/src/maintree/main.py`

```python
from fastapi import FastAPI
from inngest import Inngest, Event
from inngest.fast_api import serve

# 创建 Inngest 客户端
inngest_client = Inngest(
    app_id="riveredge",
    event_api_base_url="http://localhost:8288",
    is_production=False  # 生产环境设置为 True
)

app = FastAPI()

# 注册 Inngest 服务
app.mount("/api/inngest", serve(inngest_client))
```

### 3. 创建 Inngest 函数

**文件位置**：`riveredge-backend/src/tree_root/inngest/functions/`

**示例：定时任务函数**

```python
# riveredge-backend/src/tree_root/inngest/functions/scheduled_task.py
from inngest import Inngest, Event
from typing import Dict, Any
import httpx

inngest = Inngest(app_id="riveredge")

@inngest.create_function(
    id="scheduled-task-executor",
    name="定时任务执行器",
    trigger=inngest.TriggerCron(cron="0 * * * *")  # 每小时执行一次
)
async def scheduled_task_executor(event: Event) -> Dict[str, Any]:
    """
    定时任务执行器
    
    从事件数据中获取任务配置，执行任务。
    """
    # 从事件数据中获取任务信息
    task_id = event.data.get("task_id")
    tenant_id = event.data.get("tenant_id")
    task_type = event.data.get("task_type")
    task_config = event.data.get("task_config")
    
    # 根据任务类型执行任务
    if task_type == "api_call":
        # 执行 API 调用
        async with httpx.AsyncClient() as client:
            response = await client.post(
                task_config["url"],
                json=task_config["data"],
                headers=task_config.get("headers", {})
            )
            return {"success": True, "response": response.json()}
    elif task_type == "python_script":
        # 执行 Python 脚本
        # ...
        return {"success": True}
    
    return {"success": False, "error": "Unknown task type"}
```

**示例：工作流函数**

```python
# riveredge-backend/src/tree_root/inngest/functions/approval_workflow.py
from inngest import Inngest, Event
from typing import Dict, Any

inngest = Inngest(app_id="riveredge")

@inngest.create_function(
    id="approval-workflow",
    name="审批工作流",
    trigger=inngest.TriggerEvent(event="approval/submit")
)
async def approval_workflow(event: Event) -> Dict[str, Any]:
    """
    审批工作流
    
    处理审批流程的各个节点。
    """
    approval_id = event.data.get("approval_id")
    tenant_id = event.data.get("tenant_id")
    current_node = event.data.get("current_node")
    
    # 执行审批节点逻辑
    # ...
    
    # 如果还有下一个节点，触发下一个节点
    if has_next_node:
        await inngest.send_event(
            event=Event(
                name="approval/next",
                data={
                    "approval_id": approval_id,
                    "tenant_id": tenant_id,
                    "next_node": next_node
                }
            )
        )
    
    return {"success": True, "current_node": current_node}
```

---

## 🔄 多租户支持

### 1. 所有函数必须包含 tenant_id

**原则**：
- ✅ 所有 Inngest 函数的事件数据必须包含 `tenant_id`
- ✅ 函数执行时根据 `tenant_id` 过滤数据
- ✅ 任务监控按 `tenant_id` 过滤

**示例**：

```python
@inngest.create_function(
    id="tenant-aware-task",
    name="多租户任务",
    trigger=inngest.TriggerEvent(event="task/execute")
)
async def tenant_aware_task(event: Event) -> Dict[str, Any]:
    """
    多租户任务
    
    确保任务只处理指定组织的数据。
    """
    tenant_id = event.data.get("tenant_id")
    if not tenant_id:
        return {"success": False, "error": "tenant_id is required"}
    
    # 根据 tenant_id 过滤数据
    # ...
    
    return {"success": True}
```

### 2. 事件发送时包含 tenant_id

**示例**：

```python
# 发送事件时包含 tenant_id
await inngest.send_event(
    event=Event(
        name="message/send",
        data={
            "tenant_id": tenant_id,  # ✅ 必须包含
            "message_type": "email",
            "recipient": "user@example.com",
            "content": "Hello, World!"
        }
    )
)
```

---

## 📊 工作流编排

### 1. 使用 Inngest 工作流

**示例：多步骤工作流**

```python
from inngest import Inngest, Event
from inngest.functions import Step

inngest = Inngest(app_id="riveredge")

@inngest.create_function(
    id="multi-step-workflow",
    name="多步骤工作流",
    trigger=inngest.TriggerEvent(event="workflow/start")
)
async def multi_step_workflow(event: Event) -> Dict[str, Any]:
    """
    多步骤工作流
    
    演示如何使用 Inngest 的 Step 功能编排多步骤工作流。
    """
    tenant_id = event.data.get("tenant_id")
    
    # 步骤1：准备数据
    step1_result = await Step.run(
        "prepare-data",
        lambda: prepare_data(tenant_id)
    )
    
    # 步骤2：处理数据
    step2_result = await Step.run(
        "process-data",
        lambda: process_data(step1_result)
    )
    
    # 步骤3：发送通知
    step3_result = await Step.run(
        "send-notification",
        lambda: send_notification(step2_result)
    )
    
    return {
        "success": True,
        "result": step3_result
    }
```

### 2. 条件分支

**示例：条件分支工作流**

```python
@inngest.create_function(
    id="conditional-workflow",
    name="条件分支工作流",
    trigger=inngest.TriggerEvent(event="workflow/conditional")
)
async def conditional_workflow(event: Event) -> Dict[str, Any]:
    """
    条件分支工作流
    
    根据条件执行不同的分支。
    """
    tenant_id = event.data.get("tenant_id")
    condition = event.data.get("condition")
    
    if condition == "option_a":
        # 执行选项 A
        result = await Step.run("option-a", lambda: execute_option_a(tenant_id))
    elif condition == "option_b":
        # 执行选项 B
        result = await Step.run("option-b", lambda: execute_option_b(tenant_id))
    else:
        # 默认选项
        result = await Step.run("default", lambda: execute_default(tenant_id))
    
    return {"success": True, "result": result}
```

---

## 🔔 事件驱动

### 1. 发送事件

**示例：发送消息事件**

```python
from inngest import Event

# 发送事件触发消息发送
await inngest.send_event(
    event=Event(
        name="message/send",
        data={
            "tenant_id": tenant_id,
            "message_type": "email",
            "recipient": "user@example.com",
            "subject": "Hello",
            "content": "Hello, World!"
        }
    )
)
```

### 2. 监听事件

**示例：监听消息发送事件**

```python
@inngest.create_function(
    id="message-sender",
    name="消息发送器",
    trigger=inngest.TriggerEvent(event="message/send")
)
async def message_sender(event: Event) -> Dict[str, Any]:
    """
    消息发送器
    
    监听 message/send 事件，发送消息。
    """
    tenant_id = event.data.get("tenant_id")
    message_type = event.data.get("message_type")
    
    if message_type == "email":
        # 发送邮件
        result = await send_email(event.data)
    elif message_type == "sms":
        # 发送短信
        result = await send_sms(event.data)
    else:
        result = {"success": False, "error": "Unknown message type"}
    
    return result
```

---

## ⏰ 定时触发器

### 1. Cron 表达式

**示例：每天凌晨执行**

```python
@inngest.create_function(
    id="daily-task",
    name="每日任务",
    trigger=inngest.TriggerCron(cron="0 0 * * *")  # 每天 00:00 执行
)
async def daily_task(event: Event) -> Dict[str, Any]:
    """
    每日任务
    
    每天凌晨执行的任务。
    """
    # 执行任务
    return {"success": True}
```

### 2. 间隔触发器

**示例：每5分钟执行一次**

```python
@inngest.create_function(
    id="interval-task",
    name="间隔任务",
    trigger=inngest.TriggerInterval(seconds=300)  # 每5分钟执行一次
)
async def interval_task(event: Event) -> Dict[str, Any]:
    """
    间隔任务
    
    每5分钟执行一次的任务。
    """
    # 执行任务
    return {"success": True}
```

### 3. 日期触发器

**示例：指定日期执行**

```python
from datetime import datetime

@inngest.create_function(
    id="date-task",
    name="日期任务",
    trigger=inngest.TriggerDate(at=datetime(2025, 1, 1, 0, 0, 0))
)
async def date_task(event: Event) -> Dict[str, Any]:
    """
    日期任务
    
    在指定日期执行的任务。
    """
    # 执行任务
    return {"success": True}
```

---

## 🔍 任务监控和日志

### 1. 查询任务状态

**使用 Inngest API 查询任务状态**

```python
import httpx

async def get_task_status(run_id: str) -> Dict[str, Any]:
    """
    查询任务状态
    
    Args:
        run_id: Inngest 运行 ID
        
    Returns:
        任务状态信息
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:8288/api/v1/runs/{run_id}",
            headers={"Authorization": "Bearer your-token"}
        )
        return response.json()
```

### 2. 查询任务日志

**使用 Inngest API 查询任务日志**

```python
async def get_task_logs(run_id: str) -> List[Dict[str, Any]]:
    """
    查询任务日志
    
    Args:
        run_id: Inngest 运行 ID
        
    Returns:
        任务日志列表
    """
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:8288/api/v1/runs/{run_id}/logs",
            headers={"Authorization": "Bearer your-token"}
        )
        return response.json()
```

---

## ⚠️ 错误处理和重试

### 1. 配置重试策略

**示例：配置重试策略**

```python
@inngest.create_function(
    id="retry-task",
    name="重试任务",
    trigger=inngest.TriggerEvent(event="task/execute"),
    retries=3,  # 重试3次
    retry_delay=inngest.RetryDelay(seconds=60)  # 每次重试间隔60秒
)
async def retry_task(event: Event) -> Dict[str, Any]:
    """
    重试任务
    
    如果执行失败，会自动重试。
    """
    # 执行任务
    # 如果失败，Inngest 会自动重试
    return {"success": True}
```

### 2. 错误处理

**示例：捕获和处理错误**

```python
@inngest.create_function(
    id="error-handling-task",
    name="错误处理任务",
    trigger=inngest.TriggerEvent(event="task/execute")
)
async def error_handling_task(event: Event) -> Dict[str, Any]:
    """
    错误处理任务
    
    捕获和处理错误。
    """
    try:
        # 执行任务
        result = await execute_task(event.data)
        return {"success": True, "result": result}
    except Exception as e:
        # 记录错误
        await log_error(event.data.get("tenant_id"), str(e))
        # 发送错误通知
        await send_error_notification(event.data.get("tenant_id"), str(e))
        raise  # 重新抛出异常，触发重试
```

---

## 📚 相关文档

- [系统级功能建设计划.md](../系统级功能建设计划.md)
- [2.定时任务最佳实践.md](./2.定时任务最佳实践.md)
- [3.审批流程最佳实践.md](./3.审批流程最佳实践.md)
- [1.消息管理最佳实践.md](./1.消息管理最佳实践.md)

---

**最后更新**：2025-01-XX

