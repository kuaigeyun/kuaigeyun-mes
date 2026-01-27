# 布局模板组件库

统一的页面布局模板组件，遵循 Ant Design 设计规范，主要用于主内容区（PageContainer）的布局。

## 📦 组件列表

### 1. ListPageTemplate - 列表页面模板

提供统一的列表页面布局，支持统计卡片（可选）和表格区域。

**使用场景**: 销售订单、工单管理等需要展示统计信息的列表页面

**示例**:
```typescript
import { ListPageTemplate } from '@/components/layout-templates';

<ListPageTemplate
  statCards={[
    {
      title: '今日订单数',
      value: 12,
      prefix: <FileExcelOutlined />,
      valueStyle: { color: '#1890ff' },
    },
    {
      title: 'MTO订单数',
      value: 8,
      prefix: <FileExcelOutlined />,
      valueStyle: { color: '#722ed1' },
    },
  ]}
>
  <UniTable ... />
</ListPageTemplate>
```

---

### 2. FormModalTemplate - 表单 Modal 模板

提供统一的表单 Modal 布局，使用 ProForm 实现标准化的表单布局。

**使用场景**: 新建/编辑客户、物料等表单操作

**示例**:
```typescript
import { FormModalTemplate } from '@/components/layout-templates';

<FormModalTemplate
  title={isEdit ? '编辑客户' : '新建客户'}
  open={modalVisible}
  onClose={() => setModalVisible(false)}
  onFinish={handleSubmit}
  isEdit={isEdit}
  initialValues={formValues}
>
  <ProFormText
    name="code"
    label="编码"
    rules={[{ required: true, message: '请输入编码' }]}
  />
  <ProFormText
    name="name"
    label="名称"
    rules={[{ required: true, message: '请输入名称' }]}
  />
</FormModalTemplate>
```

---

### 3. DetailDrawerTemplate - 详情 Drawer 模板

提供统一的详情 Drawer 布局，使用 ProDescriptions 展示详情信息。

**使用场景**: 查看客户详情、物料详情等只读详情展示

**示例**:
```typescript
import { DetailDrawerTemplate } from '@/components/layout-templates';

<DetailDrawerTemplate
  title="客户详情"
  open={drawerVisible}
  onClose={() => setDrawerVisible(false)}
  dataSource={customerDetail}
  columns={[
    { title: '客户编码', dataIndex: 'code' },
    { title: '客户名称', dataIndex: 'name' },
    { title: '联系人', dataIndex: 'contactPerson' },
    { title: '电话', dataIndex: 'phone' },
  ]}
/>
```

---

### 4. TwoColumnLayout - 两栏布局模板

用于统一管理左右两栏布局的页面，左侧一般为搜索、新增等按钮和树形结构，右侧为标题栏、内容区和状态栏。

**使用场景**: 物料管理（左侧分组树，右侧物料列表）、文件管理等

**示例**:
```typescript
import { TwoColumnLayout } from '@/components/layout-templates';

<TwoColumnLayout
  leftPanel={{
    search: {
      placeholder: '搜索分组',
      value: groupSearchValue,
      onChange: setGroupSearchValue,
      allowClear: true,
    },
    actions: [
      <Button
        key="create-group"
        type="primary"
        icon={<PlusOutlined />}
        block
        onClick={handleCreateGroup}
      >
        新建分组
      </Button>,
    ],
    tree: {
      treeData: filteredGroupTreeData,
      selectedKeys: selectedGroupKeys,
      expandedKeys: expandedKeys,
      onSelect: handleGroupSelect,
      onExpand: handleGroupExpand,
      showIcon: true,
      blockNode: true,
      loading: materialGroupsLoading,
    },
    width: 300,
    minWidth: 200,
  }}
  rightPanel={{
    header: {
      left: (
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
          刷新
        </Button>
      ),
      center: (
        <Space>
          <span style={{ fontWeight: 500 }}>全部物料</span>
          <Tag color="default">全部</Tag>
        </Space>
      ),
    },
    content: <UniTable ... />,
    footer: (
      <span>
        {selectedRowKeys.length > 0
          ? `已选择 ${selectedRowKeys.length} 项`
          : '物料列表'}
      </span>
    ),
  }}
/>
```

---

### 5. CanvasPageTemplate - 画板页布局模板

用于带画板的页面统一布局：**操作条 + 画板 + 右侧面板**。主内容区仅包含上述三块，边距 16px。

**使用场景**: 流程设计、工程 BOM 设计、思维导图等以画布为核心的设计器页面

**示例**:
```typescript
import { CanvasPageTemplate } from '@/components/layout-templates';

<CanvasPageTemplate
  toolbar={
    <Space>
      <Button type="primary" icon={<SaveOutlined />}>保存</Button>
      <Button icon={<CloseOutlined />}>返回</Button>
      <Button icon={<PlusOutlined />}>添加子节点</Button>
    </Space>
  }
  canvas={<MindMap {...config} />}
  rightPanel={{
    title: '节点配置',
    children: <Form>...</Form>,
  }}
  rightPanelWidth={400}
  canvasMinHeight={600}
/>
```

---

## 📐 布局常量配置

所有布局相关的常量都统一在 `constants.ts` 中管理，包括：

- **MODAL_CONFIG**: Modal 标准配置（标准宽度、大宽度、小宽度）
- **DRAWER_CONFIG**: Drawer 标准配置（标准宽度、大宽度、小宽度）
- **FORM_LAYOUT**: 表单布局配置（垂直/水平布局、列宽、间距等）
- **STAT_CARD_CONFIG**: 统计卡片配置（间距、响应式列数等）
- **PAGE_SPACING**: 页面间距配置（内边距、区块间距等）
- **TWO_COLUMN_LAYOUT**: 两栏布局配置（左侧面板宽度等）
- **CANVAS_PAGE_LAYOUT**: 画板页布局配置（右侧面板宽度、画板最小高度）
- **TABLE_CONFIG**: 表格配置（分页大小、操作列宽度等）
- **BUTTON_CONFIG**: 按钮配置（间距等）
- **STATUS_COLORS**: 状态标签颜色映射

**使用示例**:
```typescript
import { MODAL_CONFIG, DRAWER_CONFIG, FORM_LAYOUT } from '@/components/layout-templates';

// Modal 宽度
<Modal width={MODAL_CONFIG.STANDARD_WIDTH} ...>

// Drawer 宽度
<Drawer width={DRAWER_CONFIG.STANDARD_WIDTH} ...>

// 表单布局
<ProForm
  layout={FORM_LAYOUT.VERTICAL}
  grid={true}
  rowProps={{ gutter: FORM_LAYOUT.GRID_GUTTER }}
>
```

---

## 🎯 使用原则

### 1. 统一使用模板

- ✅ 列表页面使用 `ListPageTemplate`
- ✅ 表单 Modal 使用 `FormModalTemplate`
- ✅ 详情 Drawer 使用 `DetailDrawerTemplate`
- ✅ 两栏布局使用 `TwoColumnLayout`

### 2. 使用布局常量

- ✅ 使用 `MODAL_CONFIG` 替代硬编码宽度
- ✅ 使用 `DRAWER_CONFIG` 替代硬编码宽度
- ✅ 使用 `FORM_LAYOUT` 统一表单布局
- ✅ 使用 `PAGE_SPACING` 统一页面间距

### 3. 遵循 Ant Design 规范

- ✅ 使用 Ant Design 原生组件
- ✅ 使用主题 token（`theme.useToken()`）
- ✅ 使用响应式设计（xs, sm, md, lg, xl, xxl）
- ✅ 使用标准间距系统（8px, 16px, 24px）

---

## 📚 完整导入示例

```typescript
import {
  // 布局模板
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  TwoColumnLayout,
  
  // 类型定义
  type ListPageTemplateProps,
  type StatCard,
  type FormModalTemplateProps,
  type DetailDrawerTemplateProps,
  type TwoColumnLayoutProps,
  type LeftPanelConfig,
  type RightPanelConfig,
  
  // 布局常量
  MODAL_CONFIG,
  DRAWER_CONFIG,
  FORM_LAYOUT,
  STAT_CARD_CONFIG,
  PAGE_SPACING,
  TWO_COLUMN_LAYOUT,
  TABLE_CONFIG,
  BUTTON_CONFIG,
  STATUS_COLORS,
} from '@/components/layout-templates';
```

---

## 🔄 迁移指南

### 从硬编码迁移到模板

**迁移前**:
```typescript
// ❌ 硬编码实现
<div style={{ padding: '16px 16px 0 16px' }}>
  <Row gutter={16} style={{ marginBottom: 24 }}>
    <Col span={6}>
      <Card>
        <Statistic title="今日订单数" value={12} />
      </Card>
    </Col>
  </Row>
</div>
<UniTable ... />
```

**迁移后**:
```typescript
// ✅ 使用模板
<ListPageTemplate
  statCards={[
    { title: '今日订单数', value: 12 },
  ]}
>
  <UniTable ... />
</ListPageTemplate>
```

### 从硬编码宽度迁移到常量

**迁移前**:
```typescript
// ❌ 硬编码宽度
<Modal width={800} ...>
<Drawer size={720} ...>
```

**迁移后**:
```typescript
// ✅ 使用常量
import { MODAL_CONFIG, DRAWER_CONFIG } from '@/components/layout-templates';

<Modal width={MODAL_CONFIG.STANDARD_WIDTH} ...>
<Drawer width={DRAWER_CONFIG.STANDARD_WIDTH} ...>
```

---

## 📝 注意事项

1. **仅用于主内容区**: 所有布局模板仅针对主内容区（PageContainer），不涉及左侧菜单、顶栏和标签栏

2. **响应式设计**: 统计卡片和表格都支持响应式布局，会根据屏幕尺寸自动调整

3. **主题适配**: 所有组件都使用主题 token，支持深色模式自动适配

4. **类型安全**: 所有组件都提供完整的 TypeScript 类型定义

---

---

## 📦 完整模板列表

### 基础布局模板（9个）

1. **ListPageTemplate** - 列表页面模板
2. **FormModalTemplate** - 表单 Modal 模板
3. **DetailDrawerTemplate** - 详情 Drawer 模板
4. **TwoColumnLayout** - 两栏布局模板
5. **CanvasPageTemplate** - 画板页布局模板（操作条 + 画板 + 右侧面板，流程设计、BOM 设计等）
6. **DashboardTemplate** - 工作台布局模板
7. **WizardTemplate** - 向导布局模板
8. **KanbanViewTemplate** - 看板视图布局模板
9. **TouchScreenTemplate** - 工位机触屏模式布局模板

### 视图组件模板（3个）

10. **CompareViewTemplate** - 对比视图布局模板
11. **ParameterConfigTemplate** - 参数配置布局模板
12. **CalculationResultTemplate** - 计算结果显示布局模板

---

## 🎨 设计规范

所有模板严格遵循 Ant Design 设计规范：

- **间距系统**: 8px 基础单位（8px/16px/24px）
- **颜色系统**: 使用主题 token（支持深色模式）
- **字体系统**: 标准字号（14px/16px/20px/24px）
- **圆角系统**: 统一圆角（4px/6px/8px）
- **响应式设计**: 支持断点适配（xs/sm/md/lg/xl/xxl）

---

## 📐 布局常量

所有布局常量统一在 `constants.ts` 中管理，包括：

- **MODAL_CONFIG**: Modal 标准配置
- **DRAWER_CONFIG**: Drawer 标准配置
- **FORM_LAYOUT**: 表单布局配置
- **STAT_CARD_CONFIG**: 统计卡片配置
- **PAGE_SPACING**: 页面间距配置
- **TWO_COLUMN_LAYOUT**: 两栏布局配置
- **CANVAS_PAGE_LAYOUT**: 画板页布局配置
- **ANT_DESIGN_TOKENS**: Ant Design 设计规范常量
- **TOUCH_SCREEN_CONFIG**: 工位机触屏模式配置
- **DASHBOARD_CONFIG**: 工作台配置

---

**最后更新**: 2025-12-26

