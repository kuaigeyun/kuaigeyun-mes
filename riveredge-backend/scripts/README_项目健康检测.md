# 项目健康检测程序使用指南

## 📋 概述

项目健康检测程序是一个全自动的前后端功能完整性检测工具，用于验证项目的整体健康状况。

## 🎯 功能特性

### 后端检测
- ✅ **API端点检测**：检测所有API路由定义
- ✅ **数据模型检测**：验证数据模型的完整性
- ✅ **服务层检测**：检查服务类的定义
- ✅ **数据库迁移检测**：验证迁移文件的有效性

### 前端检测
- ✅ **前端页面检测**：检查所有页面文件是否存在
- ✅ **路由配置检测**：验证路由配置的完整性
- ✅ **API服务检测**：检查API服务文件的定义

### 集成检测
- ✅ **前后端API映射检测**：验证前后端API接口的对接情况

## 🚀 使用方法

### 基本使用

```bash
# 在项目根目录运行
cd /f/dev/riveredge
python riveredge-backend/scripts/check_project_health.py
```

### 输出说明

程序会生成两种格式的报告：

1. **文本报告**：`project_health_report.txt`
   - 人类可读的格式
   - 包含详细的检测结果和建议

2. **JSON报告**：`project_health_report.json`
   - 机器可读的格式
   - 可用于自动化工具和CI/CD集成

### 检测结果状态

- ✅ **通过 (pass)**：检测项正常，无问题
- ⚠️ **警告 (warning)**：检测项基本正常，但有一些需要注意的地方
- ❌ **失败 (fail)**：检测项存在问题，需要修复

## 📊 检测报告示例

```
================================================================================
项目健康检测报告
================================================================================
检测时间: 2026-01-03 07:49:09

📦 后端检测结果
--------------------------------------------------------------------------------
✅ API端点检测: 检测到 142 个API端点
✅ 数据模型检测: 检测到 25 个数据模型
✅ 服务层检测: 检测到 11 个服务类
✅ 数据库迁移检测: 检测到 9 个有效迁移文件

🎨 前端检测结果
--------------------------------------------------------------------------------
✅ 前端页面检测: 检测到 25 个页面
✅ 路由配置检测: 检测到 23 个路由
✅ API服务检测: 检测到 10 个API服务文件

🔗 集成检测结果
--------------------------------------------------------------------------------
✅ 前后端API映射检测: 后端端点: 143, 前端调用: 73

📊 检测总结
--------------------------------------------------------------------------------
总检测项: 8
✅ 通过: 8
⚠️  警告: 0
❌ 失败: 0

✅ 项目健康状态良好，所有检测通过！
```

## 🔧 集成到CI/CD

### GitHub Actions 示例

```yaml
name: Project Health Check

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Run Health Check
        run: |
          cd riveredge-backend/scripts
          python check_project_health.py
      
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: health-report
          path: |
            project_health_report.txt
            project_health_report.json
```

### GitLab CI 示例

```yaml
health_check:
  stage: test
  script:
    - cd riveredge-backend/scripts
    - python check_project_health.py
  artifacts:
    paths:
      - project_health_report.txt
      - project_health_report.json
    expire_in: 1 week
```

## 📝 自定义检测

如果需要添加自定义检测项，可以修改 `check_project_health.py` 文件：

1. 在 `BackendChecker`、`FrontendChecker` 或 `IntegrationChecker` 类中添加新的检测方法
2. 在 `run_all_checks()` 方法中调用新的检测方法
3. 返回 `CheckResult` 对象

示例：

```python
def check_custom_feature(self) -> CheckResult:
    """自定义检测"""
    # 检测逻辑
    if condition:
        return CheckResult(
            name="自定义检测",
            status="pass",
            message="检测通过",
            details=[]
        )
    else:
        return CheckResult(
            name="自定义检测",
            status="fail",
            message="检测失败",
            details=["具体问题描述"]
        )
```

## ⚠️ 注意事项

1. **路径依赖**：确保在项目根目录运行脚本，或修改脚本中的路径配置
2. **编码格式**：所有文件必须使用UTF-8编码
3. **Python版本**：需要Python 3.11+
4. **依赖项**：脚本使用标准库，无需额外依赖

## 🔍 故障排查

### 问题：检测不到前端页面

**原因**：页面文件路径不正确或文件不存在

**解决**：
1. 检查 `riveredge-frontend/src/apps/kuaizhizao/pages` 目录是否存在
2. 确认每个页面目录都有 `index.tsx` 文件

### 问题：API映射检测失败

**原因**：前后端API路径格式不一致

**解决**：
1. 检查后端API路由定义格式
2. 检查前端API调用格式
3. 确保路径匹配规则正确

### 问题：迁移文件检测失败

**原因**：迁移文件格式不正确

**解决**：
1. 检查迁移文件是否包含 `async def upgrade` 函数
2. 确认迁移文件格式符合Aerich规范

## 📚 相关文档

- [数据库迁移使用指南](../../migrations/README_迁移初始化指南.md)
- [未迁移模型检测](../../migrations/check_unmigrated_models.py)
- [迁移状态检测](../../migrations/check_migration_status.py)

## 📞 支持

如有问题或建议，请提交Issue或联系开发团队。

---

**最后更新**：2026-01-03  
**维护者**：Auto (AI Assistant)

