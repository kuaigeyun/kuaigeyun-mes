# Inngest 集成指南

本文档介绍如何将 Inngest 工作流引擎集成到 FastAPI 项目中。

参考官方文档：https://www.inngest.com/docs

## 1. 安装依赖

### 1.1 安装 Python SDK

在 `pyproject.toml` 中添加依赖：

```toml
[project]
dependencies = [
    "inngest>=0.3.0",  # Inngest Python SDK
    # ... 其他依赖
]
```

然后安装：

```bash
uv sync
```

### 1.2 安装 Inngest Dev Server（可选，用于本地开发）

下载 Inngest Dev Server 可执行文件：

- Windows: 下载 `inngest-windows-amd64.exe` 或 `inngest.exe`
- Linux: 下载 `inngest-linux-amd64`
- macOS: 下载 `inngest-darwin-amd64`

将可执行文件放到项目的 `bin/inngest/` 目录。

## 2. 创建 Inngest 客户端

创建 `src/core/inngest/client.py`：

```python
"""
Inngest 客户端配置

提供全局 Inngest 客户端实例，用于发送事件和注册工作流函数。
"""

import os
from inngest import Inngest

# 从环境变量获取 Inngest 配置
# 优先使用 INNGEST_EVENT_API_URL 环境变量（推荐方式）
INNGEST_EVENT_API_URL = os.getenv(
    "INNGEST_EVENT_API_URL",
    "http://127.0.0.1:8288"  # 默认本地开发地址
)

INNGEST_APP_ID = os.getenv("INNGEST_APP_ID", "my-app")
INNGEST_IS_PRODUCTION = os.getenv("INNGEST_IS_PRODUCTION", "false").lower() == "true"

# 创建全局 Inngest 客户端
inngest_client = Inngest(
    app_id=INNGEST_APP_ID,
    event_api_base_url=INNGEST_EVENT_API_URL,
    is_production=INNGEST_IS_PRODUCTION,
)
```

## 3. 创建 Inngest 工作流函数

创建 `src/core/inngest/functions/` 目录，定义工作流函数：

### 3.1 事件触发的工作流

创建 `src/core/inngest/functions/example_function.py`：

```python
"""
示例 Inngest 工作流函数

展示如何创建事件驱动的工作流。
"""

from inngest import Event, TriggerEvent
from typing import Dict, Any
from core.inngest.client import inngest_client


@inngest_client.create_function(
    fn_id="example-function",
    name="示例工作流",
    trigger=TriggerEvent(event="example/event"),
)
async def example_function(event: Event) -> Dict[str, Any]:
    """
    示例工作流函数
    
    Args:
        event: Inngest 事件对象
        
    Returns:
        处理结果字典
    """
    # 从事件数据中获取信息
    data = event.data or {}
    message = data.get("message", "Hello from Inngest!")
    
    # 执行业务逻辑
    # ...
    
    # 返回处理结果
    return {
        "success": True,
        "message": message,
        "event_id": getattr(event, "id", None),
    }
```

### 3.2 定时任务工作流

```python
from inngest import TriggerCron
from datetime import datetime
from core.inngest.client import inngest_client


@inngest_client.create_function(
    fn_id="scheduled-task",
    name="定时任务",
    trigger=TriggerCron(cron="0 */6 * * *"),  # 每6小时执行一次
)
async def scheduled_task_function() -> Dict[str, Any]:
    """
    定时任务工作流
    
    根据 cron 表达式定时执行。
    """
    # 执行定时任务逻辑
    print(f"定时任务执行时间: {datetime.now()}")
    
    return {
        "success": True,
        "executed_at": datetime.now().isoformat(),
    }
```

### 3.3 带步骤的工作流（Durable Execution）

```python
from inngest import step
from core.inngest.client import inngest_client


@inngest_client.create_function(
    fn_id="multi-step-workflow",
    name="多步骤工作流",
    trigger=TriggerEvent(event="workflow/start"),
)
async def multi_step_workflow(event: Event) -> Dict[str, Any]:
    """
    多步骤工作流示例
    
    展示如何使用 step 装饰器创建可靠的多步骤工作流。
    """
    # 步骤1：获取数据
    data = await step.run("获取数据", lambda: fetch_data())
    
    # 步骤2：处理数据
    processed = await step.run("处理数据", lambda: process_data(data))
    
    # 步骤3：保存结果
    result = await step.run("保存结果", lambda: save_result(processed))
    
    return {
        "success": True,
        "result": result,
    }
```

## 4. 在 FastAPI 中注册 Inngest 服务端点

在 `src/server/main.py` 中注册 Inngest 服务：

```python
from fastapi import FastAPI
from core.inngest.client import inngest_client
from inngest.fast_api import serve as inngest_serve
from core.inngest.functions import (
    example_function,
    scheduled_task_function,
    multi_step_workflow,
)

app = FastAPI()

# 注册 Inngest 服务端点
# 必须在导入所有 Inngest 函数之后注册
app.mount(
    "/api/inngest",
    inngest_serve(
        app,
        inngest_client,
    ),
)
```

**重要**：必须在导入所有 Inngest 函数之后注册服务端点，确保函数被正确注册。

## 5. 发送事件到 Inngest

在业务代码中发送事件：

```python
from core.inngest.client import inngest_client

# 发送事件
await inngest_client.send(
    inngest.Event(
        name="example/event",
        data={
            "message": "Hello from FastAPI!",
            "user_id": 123,
        },
    )
)
```

## 6. 启动 Inngest Dev Server（本地开发）

### 6.1 创建配置文件

创建 `bin/inngest/inngest.config.json`：

```json
{
    "database": {
        "url": "postgresql://postgres:postgres@localhost:5432/inngest",
        "pool_size": 10
    },
    "log_level": "info"
}
```

### 6.2 启动 Dev Server

```bash
# 方式1：使用启动脚本（推荐）
./bin/inngest/start-inngest.sh start

# 方式2：直接运行
./bin/inngest/inngest.exe dev \
  -u http://127.0.0.1:8200/api/inngest \
  --config bin/inngest/inngest.config.json
```

参数说明：
- `-u`: 后端 API 的 Inngest 服务端点 URL
- `--config`: Inngest 配置文件路径
- `--host`: 绑定地址（默认：0.0.0.0）
- `--port`: 端口（默认：8288）

### 6.3 访问 Inngest Dashboard

启动成功后，访问：
- Dashboard: http://localhost:8288/_dashboard
- API: http://localhost:8288

## 7. 环境变量配置

在 `.env` 文件中配置：

```bash
# Inngest 配置
INNGEST_EVENT_API_URL=http://127.0.0.1:8288
INNGEST_APP_ID=my-app
INNGEST_IS_PRODUCTION=false
```

## 8. 项目结构示例

```
project/
├── src/
│   ├── core/
│   │   └── inngest/
│   │       ├── __init__.py
│   │       ├── client.py              # Inngest 客户端
│   │       └── functions/
│   │           ├── __init__.py
│   │           ├── example_function.py
│   │           └── scheduled_task.py
│   └── server/
│       └── main.py                    # FastAPI 应用，注册 Inngest 端点
├── bin/
│   └── inngest/
│       ├── inngest.exe               # Inngest Dev Server
│       ├── inngest.config.json       # Inngest 配置
│       └── start-inngest.sh          # 启动脚本
└── pyproject.toml
```

## 9. 最佳实践

### 9.1 函数组织

- 按功能模块组织函数文件
- 每个文件包含相关的函数
- 在 `functions/__init__.py` 中统一导入

### 9.2 错误处理

```python
from inngest import step

@inngest_client.create_function(
    fn_id="error-handling-example",
    trigger=TriggerEvent(event="example/error"),
)
async def error_handling_function(event: Event):
    try:
        result = await step.run("执行操作", lambda: risky_operation())
        return {"success": True, "result": result}
    except Exception as e:
        # Inngest 会自动重试（根据配置）
        raise
```

### 9.3 租户隔离（多租户场景）

```python
from core.utils.inngest_tenant_isolation import with_tenant_isolation_optional

@inngest_client.create_function(
    fn_id="tenant-aware-function",
    trigger=TriggerEvent(event="tenant/action"),
)
@with_tenant_isolation_optional
async def tenant_aware_function(event: Event):
    # 装饰器会自动处理租户隔离
    tenant_id = get_current_tenant_id()
    # ...
```

## 10. 测试

### 10.1 测试事件发送

```python
# 在 FastAPI 路由中测试
@app.post("/api/v1/test/inngest")
async def test_inngest():
    await inngest_client.send(
        inngest.Event(
            name="example/event",
            data={"message": "Test event"},
        )
    )
    return {"message": "Event sent"}
```

### 10.2 查看执行日志

- 在 Inngest Dashboard 中查看函数执行日志
- 检查函数执行状态和结果
- 调试失败的工作流

## 11. 生产环境部署

### 11.1 使用 Inngest Cloud

1. 注册 Inngest Cloud 账号
2. 创建应用
3. 获取 Event API URL
4. 配置环境变量：

```bash
INNGEST_EVENT_API_URL=https://your-app.inngest.com
INNGEST_IS_PRODUCTION=true
```

### 11.2 自托管 Inngest

参考 Inngest 官方文档部署自托管实例。

## 12. 常见问题

### 12.1 函数未注册

**问题**：函数没有被 Inngest 发现。

**解决**：
- 确保在注册服务端点之前导入所有函数
- 检查函数装饰器是否正确
- 查看 Inngest Dev Server 日志

### 12.2 事件发送失败

**问题**：无法发送事件到 Inngest。

**解决**：
- 检查 `INNGEST_EVENT_API_URL` 配置
- 确认 Inngest Dev Server 正在运行
- 检查网络连接

### 12.3 Windows 端口问题

**问题**：Windows 上无法绑定到默认端口 8288。

**解决**：
- 使用 `--host 127.0.0.1` 参数
- 以管理员身份运行
- 检查 Windows 端口保留范围

## 13. 参考资源

- [Inngest 官方文档](https://www.inngest.com/docs)
- [Python SDK 文档](https://www.inngest.com/docs/reference/python-sdk)
- [FastAPI 集成示例](https://www.inngest.com/docs/getting-started/python-quick-start)

