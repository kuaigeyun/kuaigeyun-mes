# 布局模板使用指南

## 📋 概述

本文档介绍如何使用统一的布局模板组件，确保整个系统视觉统一、协调、优雅，遵循 Ant Design 设计规范。

---

## 🎯 设计原则

1. **统一性**: 所有页面使用统一的布局模板
2. **规范性**: 遵循 Ant Design 设计规范
3. **可复用性**: 模板可配置，适应不同场景
4. **优雅性**: 视觉协调，用户体验良好

---

## 📦 可用模板列表

### 1. ListPageTemplate - 列表页面模板

**使用场景**: 标准列表页面（带或不带统计卡片）

**示例**:
```tsx
import { ListPageTemplate } from '@/components/layout-templates';

<ListPageTemplate
  statCards={[
    {
      title: '今日订单数',
      value: 12,
      prefix: <FileExcelOutlined />,
      valueStyle: { color: '#1890ff' },
    },
  ]}
>
  <UniTable ... />
</ListPageTemplate>
```

---

### 2. FormModalTemplate - 表单 Modal 模板

**使用场景**: 新建/编辑表单（Modal弹窗）

**示例**:
```tsx
import { FormModalTemplate } from '@/components/layout-templates';

<FormModalTemplate
  title={isEdit ? '编辑客户' : '新建客户'}
  open={modalVisible}
  onClose={() => setModalVisible(false)}
  onFinish={handleSubmit}
  isEdit={isEdit}
  initialValues={formValues}
>
  <ProFormText name="code" label="编码" />
  <ProFormText name="name" label="名称" />
</FormModalTemplate>
```

---

### 3. DetailDrawerTemplate - 详情 Drawer 模板

**使用场景**: 详情查看（Drawer抽屉）

**示例**:
```tsx
import { DetailDrawerTemplate } from '@/components/layout-templates';

<DetailDrawerTemplate
  title="客户详情"
  open={drawerVisible}
  onClose={() => setDrawerVisible(false)}
  dataSource={customerDetail}
  columns={[
    { title: '客户编码', dataIndex: 'code' },
    { title: '客户名称', dataIndex: 'name' },
  ]}
/>
```

---

### 4. TwoColumnLayout - 两栏布局模板

**使用场景**: 左侧树形结构，右侧内容区（物料管理、文件管理等）

**示例**:
```tsx
import { TwoColumnLayout } from '@/components/layout-templates';

<TwoColumnLayout
  leftPanel={{
    search: { placeholder: '搜索分组', value: searchValue, onChange: setSearchValue },
    actions: [<Button>新建分组</Button>],
    tree: { treeData, selectedKeys, onSelect },
  }}
  rightPanel={{
    header: { center: <span>全部物料</span> },
    content: <UniTable ... />,
  }}
/>
```

---

### 5. DashboardTemplate - 工作台布局模板

**使用场景**: 工作台首页（快捷操作、待办事项、数据看板）

**示例**:
```tsx
import { DashboardTemplate } from '@/components/layout-templates';

<DashboardTemplate
  quickActions={[
    { title: '一键报工', icon: <PlayCircleOutlined />, onClick: handleReport },
  ]}
  todos={[
    { title: '待下达工单', count: 5, onClick: handlePendingOrders },
  ]}
  stats={[
    { title: '今日生产', value: 100, suffix: '件' },
  ]}
/>
```

---

### 6. WizardTemplate - 向导布局模板

**使用场景**: 多步骤流程（快速初始化向导、审批流程等）

**示例**:
```tsx
import { WizardTemplate } from '@/components/layout-templates';

<WizardTemplate
  steps={[
    { title: '选择模板', content: <TemplateSelection /> },
    { title: '基础信息', content: <BasicInfo /> },
    { title: '完成', content: <Completion /> },
  ]}
  current={currentStep}
  onStepChange={setCurrentStep}
  onFinish={handleFinish}
/>
```

---

### 7. KanbanViewTemplate - 看板视图布局模板

**使用场景**: 工单看板、任务看板等

**示例**:
```tsx
import { KanbanViewTemplate } from '@/components/layout-templates';

<KanbanViewTemplate
  columns={[
    {
      id: 'pending',
      title: '待下达',
      cards: [<WorkOrderCard key="1" />],
    },
    {
      id: 'in-progress',
      title: '生产中',
      cards: [<WorkOrderCard key="2" />],
    },
  ]}
/>
```

---

### 8. TouchScreenTemplate - 工位机触屏模式布局模板

**使用场景**: 工位机触屏模式（现场报工、SOP查看等）

**示例**:
```tsx
import { TouchScreenTemplate } from '@/components/layout-templates';

<TouchScreenTemplate
  title="现场报工"
  footerButtons={[
    { title: '提交', type: 'primary', onClick: handleSubmit, block: true },
  ]}
>
  <TouchScreenForm ... />
</TouchScreenTemplate>
```

---

### 9. CompareViewTemplate - 对比视图布局模板

**使用场景**: 重复物料对比、版本对比等

**示例**:
```tsx
import { CompareViewTemplate } from '@/components/layout-templates';

<CompareViewTemplate
  leftTitle="物料A"
  rightTitle="物料B"
  items={[
    {
      key: 'name',
      field: 'name',
      label: '物料名称',
      leftValue: '产品A',
      rightValue: '产品A',
      isSame: true,
      confidence: 'high',
    },
  ]}
  onMerge={handleMerge}
/>
```

---

### 10. ParameterConfigTemplate - 参数配置布局模板

**使用场景**: MRP/LRP参数配置等

**示例**:
```tsx
import { ParameterConfigTemplate } from '@/components/layout-templates';

<ParameterConfigTemplate
  groups={[
    {
      title: '库存相关参数',
      parameters: [
        { key: 'currentStock', label: '当前库存数量', defaultChecked: true },
      ],
    },
  ]}
  onSave={handleSave}
/>
```

---

### 11. CalculationResultTemplate - 计算结果显示布局模板

**使用场景**: MRP/LRP运算结果展示

**示例**:
```tsx
import { CalculationResultTemplate } from '@/components/layout-templates';

<CalculationResultTemplate
  title="MRP运算结果"
  mainContent={<MRPResultSummary />}
  explanation={{
    title: '计算说明',
    content: '基于以下参数计算...',
    usedParameters: ['当前库存', '安全库存'],
  }}
  tabs={[
    { key: 'workOrders', label: '工单建议', content: <WorkOrderSuggestions /> },
  ]}
/>
```

---

## 🎨 布局常量使用

所有布局相关的常量都统一在 `constants.ts` 中管理：

```tsx
import {
  MODAL_CONFIG,
  DRAWER_CONFIG,
  FORM_LAYOUT,
  STAT_CARD_CONFIG,
  PAGE_SPACING,
  TWO_COLUMN_LAYOUT,
  TABLE_CONFIG,
  BUTTON_CONFIG,
  STATUS_COLORS,
  ANT_DESIGN_TOKENS,
  TOUCH_SCREEN_CONFIG,
  DASHBOARD_CONFIG,
} from '@/components/layout-templates';

// 使用示例
<Modal width={MODAL_CONFIG.STANDARD_WIDTH} ...>
<Drawer width={DRAWER_CONFIG.STANDARD_WIDTH} ...>
<ProForm layout={FORM_LAYOUT.VERTICAL} grid={true} ...>
```

---

## ✅ 使用检查清单

使用布局模板时，请确保：

- [ ] 使用统一的布局模板，不硬编码布局
- [ ] 使用布局常量，不硬编码尺寸和间距
- [ ] 遵循 Ant Design 设计规范
- [ ] 使用主题 token，支持深色模式
- [ ] 响应式设计，适配不同屏幕尺寸
- [ ] 视觉统一，风格协调

---

## 📚 相关文档

- [Ant Design 设计语言](https://ant.design/docs/spec/introduce-cn)
- [Ant Design Pro 设计规范](https://pro.ant.design/zh-CN/docs/design)
- [品牌VI一致性规范](../../../docs/2.rules/5.品牌VI一致性规范.md)

---

**最后更新**: 2025-12-26

