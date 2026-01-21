# 自动化模块测试工具使用说明

## 📋 功能

- ✅ 自动检测路由注册情况（按模块分组）
- ✅ 逐个测试各模块的API路由
- ✅ 自动生成测试报告
- ✅ 支持只测试指定模块

## 🚀 使用方法

### 基本用法

```bash
# 在项目根目录运行
cd riveredge-backend
uv run python ../scripts/test-modules-automated.py
```

### 测试指定模块

```bash
# 只测试 kuaizhizao 模块
uv run python ../scripts/test-modules-automated.py --module kuaizhizao

# 只测试 master-data 模块
uv run python ../scripts/test-modules-automated.py --module master-data
```

### 使用真实后端URL

```bash
# 测试真实后端（需要后端运行）
uv run python ../scripts/test-modules-automated.py --base-url http://localhost:8100 --tenant-id 1
```

## 📊 输出说明

- **可访问**: 路由存在且可访问（不返回404）
- **404**: 路由不存在或未注册
- **错误**: 测试过程中发生异常

测试结果会保存到 `module-test-results.json` 文件中。
