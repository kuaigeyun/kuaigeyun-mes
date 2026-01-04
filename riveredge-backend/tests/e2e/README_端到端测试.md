# 端到端测试使用指南

## 📋 概述

端到端测试（E2E Tests）用于测试完整的业务流程，验证系统从需求到交付的完整链路。

## 🎯 测试覆盖范围

### 1. MTS模式完整流程
- ✅ 销售预测创建
- ✅ MRP运算
- ✅ 工单生成
- ✅ 工单下达
- ✅ 报工
- ✅ 成品入库
- ✅ 销售出库

### 2. MTO模式完整流程
- ✅ 销售订单创建
- ✅ LRP运算
- ✅ 工单生成（关联订单）
- ✅ 工单下达
- ✅ 报工
- ✅ 成品入库
- ✅ 销售出库（关联订单）

### 3. 采购流程闭环
- ✅ 采购单创建
- ✅ 采购入库
- ✅ 来料检验
- ✅ 应付单自动生成

### 4. 质量管理流程
- ✅ 来料检验
- ✅ 过程检验
- ✅ 成品检验

### 5. 财务协同流程
- ✅ 应付单生成和付款
- ✅ 应收单生成和收款

## 🚀 使用方法

### 运行所有测试

```bash
cd riveredge-backend
python tests/e2e/run_all_tests.py
```

### 运行特定测试

```bash
# 运行MTS流程测试
pytest tests/e2e/test_mts_workflow.py -v

# 运行MTO流程测试
pytest tests/e2e/test_mto_workflow.py -v

# 运行采购流程测试
pytest tests/e2e/test_purchase_workflow.py -v

# 运行质量管理流程测试
pytest tests/e2e/test_quality_workflow.py -v

# 运行财务协同流程测试
pytest tests/e2e/test_finance_workflow.py -v
```

### 使用pytest直接运行

```bash
cd riveredge-backend
pytest tests/e2e/ -v --asyncio-mode=auto
```

## 📊 测试报告

测试运行后会生成以下报告：

1. **JUnit XML报告**：`test_results.xml`
   - 用于CI/CD集成
   - 支持Jenkins、GitLab CI等

2. **HTML报告**：`test_report.html`
   - 人类可读的详细报告
   - 包含测试结果、执行时间、错误详情

## 🔧 测试配置

### 环境要求

- Python 3.11+
- pytest
- pytest-asyncio
- httpx
- 测试数据库（建议使用独立的测试数据库）

### 配置文件

测试配置在 `conftest.py` 中：

- `test_client`: 测试HTTP客户端
- `test_tenant`: 测试租户
- `test_user`: 测试用户
- `auth_headers`: 认证头

## ⚠️ 注意事项

1. **数据库隔离**：建议使用独立的测试数据库
2. **数据清理**：测试后会自动清理测试数据
3. **异步支持**：所有测试都是异步的，使用 `pytest-asyncio`
4. **依赖顺序**：某些测试依赖于前置步骤，如果前置失败会跳过后续测试

## 📝 添加新测试

### 测试类结构

```python
class TestNewWorkflow:
    """新流程测试"""
    
    @pytest.mark.asyncio
    async def test_new_workflow(
        self,
        test_client: AsyncClient,
        auth_headers: dict,
        test_tenant
    ):
        """测试新流程"""
        # 测试步骤
        pass
```

### 测试步骤

1. 准备测试数据
2. 调用API接口
3. 验证响应状态
4. 验证业务逻辑
5. 清理测试数据

## 🔍 故障排查

### 问题：测试失败，提示数据库连接错误

**解决**：
1. 检查数据库配置
2. 确保测试数据库已创建
3. 检查 `TORTOISE_ORM` 配置

### 问题：认证失败

**解决**：
1. 检查 `auth_headers` fixture
2. 确保实现了真实的登录逻辑
3. 检查用户和租户是否正确创建

### 问题：异步任务未完成

**解决**：
1. 增加等待时间
2. 使用更好的等待机制（如轮询）
3. 检查Inngest工作流配置

## 📚 相关文档

- [pytest文档](https://docs.pytest.org/)
- [pytest-asyncio文档](https://pytest-asyncio.readthedocs.io/)
- [httpx文档](https://www.python-httpx.org/)

---

**最后更新**：2026-01-03  
**维护者**：Auto (AI Assistant)

