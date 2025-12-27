# Inngest 与 FastAPI 同步问题修复

**问题时间**: 2025-12-27  
**问题现象**: Inngest Dashboard `/apps` 页面显示 "Not Synced"

---

## 🔍 问题分析

### 1. 问题现象

- Inngest Dashboard 中 `/apps` 页面显示 "Not Synced"
- `/api/inngest/serve` 端点返回 404 Not Found
- `/api/inngest/function/run` 端点返回 404 Not Found

### 2. 根本原因

**`inngest_serve()` 函数使用方式不正确**

**修复前的代码**:
```python
inngest_serve(
    app,
    inngest_client,
    [functions...]
)
```

**问题**: 直接调用 `inngest_serve()` 不会正确注册 FastAPI 路由端点，导致：
- `/api/inngest/serve` 端点不存在（404）
- `/api/inngest/function/run` 端点不存在（404）
- Inngest Dev Server 无法同步函数

### 3. 正确的使用方式

根据 Inngest Python SDK 文档，应该使用 `app.mount()` 来挂载 Inngest 服务：

```python
app.mount(
    "/api/inngest",
    inngest_serve(
        app,
        inngest_client,
        functions,
    ),
)
```

---

## 🔧 修复方案

### 修复内容

**文件**: `riveredge-backend/src/server/main.py`

**修复前**:
```python
# 挂载 Inngest 服务端点
try:
    inngest_serve(
        app,
        inngest_client,
        [
            test_integration_function,
            message_sender_function,
            # ... 其他函数
        ]
    )
    logger.info("✅ Inngest 服务端点注册成功")
except Exception as e:
    logger.error(f"❌ Inngest 服务端点注册失败: {e}")
```

**修复后**:
```python
# 挂载 Inngest 服务端点
# 使用 app.mount() 挂载 Inngest 服务，确保所有端点（/serve, /function/run 等）正确注册
try:
    # 准备所有 Inngest 函数列表
    inngest_functions = [
        test_integration_function,
        message_sender_function,
        # ... 其他函数
    ]
    
    # 使用 app.mount() 挂载 Inngest 服务端点
    # 这会注册 /api/inngest/serve 和 /api/inngest/function/run 等端点
    app.mount(
        "/api/inngest",
        inngest_serve(
            app,
            inngest_client,
            inngest_functions,
        ),
    )
    logger.info("✅ Inngest 服务端点注册成功")
    logger.info(f"✅ 已注册 {len(inngest_functions)} 个 Inngest 函数")
except Exception as e:
    logger.error(f"❌ Inngest 服务端点注册失败: {e}")
```

---

## ✅ 验证修复

### 1. 检查端点是否注册

修复后，以下端点应该可以访问：

```bash
# 1. 检查 /api/inngest 端点
curl http://127.0.0.1:8200/api/inngest
# 应该返回函数信息

# 2. 检查 /api/inngest/serve 端点（关键）
curl http://127.0.0.1:8200/api/inngest/serve
# 应该返回函数列表，而不是 404

# 3. 检查 /api/inngest/function/run 端点
curl -X POST http://127.0.0.1:8200/api/inngest/function/run
# 应该返回函数执行相关响应，而不是 404
```

### 2. 检查 Inngest Dashboard

1. 访问 http://127.0.0.1:8300/_dashboard
2. 进入 `/apps` 页面
3. 应该显示 "Synced" 状态，而不是 "Not Synced"

### 3. 检查日志

后端日志应该显示：
```
✅ Inngest 服务端点注册成功
✅ 已注册 8 个 Inngest 函数
```

Inngest 日志应该显示：
```json
{"level":"INFO","msg":"apps synced, disabling auto-discovery"}
```

---

## 📋 关键要点

### 1. `app.mount()` vs 直接调用

- ❌ **错误**: 直接调用 `inngest_serve()` - 不会注册路由端点
- ✅ **正确**: 使用 `app.mount()` 挂载 - 正确注册所有端点

### 2. 端点路径

Inngest 需要以下端点才能正常工作：
- `/api/inngest` - 基础端点（用于发现）
- `/api/inngest/serve` - **同步端点**（Inngest 调用此端点获取函数列表）
- `/api/inngest/function/run` - 函数执行端点（Inngest 调用此端点执行函数）

### 3. 启动顺序

1. **先启动后端**: 确保 `/api/inngest` 端点已注册
2. **再启动 Inngest**: Inngest 会调用 `/api/inngest/serve` 同步函数

---

## 🎯 总结

**问题**: `inngest_serve()` 使用方式不正确，导致同步端点未注册

**解决方案**: 使用 `app.mount()` 挂载 Inngest 服务

**结果**: 所有端点正确注册，Inngest 可以正常同步函数

---

**修复时间**: 2025-12-27  
**状态**: ✅ 已修复

