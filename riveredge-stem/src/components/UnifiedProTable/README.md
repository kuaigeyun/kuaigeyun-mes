# UnifiedProTable - 统一表格组件

## 功能说明

`UnifiedProTable` 是一个封装了所有表格通用配置和功能的统一组件，确保所有表格使用统一的格式。后续完善时，只需修改此组件，所有表格都会同步更新。

## 主要特性

- ✅ **统一的排序处理**：自动处理排序参数转换（`ascend`/`descend` → `asc`/`desc`）
- ✅ **统一的按钮容器**：自动将按钮容器移动到表格内部
- ✅ **统一的分页配置**：默认分页大小、快速跳转等
- ✅ **统一的行选择**：可选的复选框行选择
- ✅ **统一的行编辑**：可选的表格行内编辑
- ✅ **统一的工具栏**：统一的工具栏按钮配置（右上角）
- ✅ **头部操作按钮**：在原来标题位置显示新建、修改、删除等按钮（左上角）
- ✅ **高级搜索集成**：内置 `QuerySearchButton` 支持，默认隐藏原生搜索表单
- ✅ **多视图支持**：支持表格、卡片、看板、统计等多种视图切换

## 使用方法

### 基础用法

```typescript
import { UnifiedProTable } from '@/components/UnifiedProTable';
import { ProColumns } from '@ant-design/pro-components';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface User {
  id: number;
  name: string;
  email: string;
}

const UserList: React.FC = () => {
  const columns: ProColumns<User>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 150,
      sorter: true,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
    },
  ];

  return (
    <UnifiedProTable<User>
      headerTitle="用户列表"
      columns={columns}
      request={async (params, sort, filter) => {
        // 排序参数已自动处理，sort 对象包含排序信息
        const result = await getUserList({
          page: params.current || 1,
          page_size: params.pageSize || 10,
          sort: sort.name === 'ascend' ? 'name' : sort.name === 'descend' ? '-name' : undefined,
        });
        return {
          data: result.items,
          success: true,
          total: result.total,
        };
      }}
      afterSearchButtons={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/users/create')}
        >
          新建用户
        </Button>
      }
    />
  );
};
```

### 启用行选择

```typescript
<UnifiedProTable<User>
  enableRowSelection={true}
  onRowSelectionChange={(selectedRowKeys) => {
    console.log('选中的行:', selectedRowKeys);
  }}
  // ... 其他配置
/>
```

### 启用行编辑

```typescript
<UnifiedProTable<User>
  enableRowEdit={true}
  onRowEditSave={async (key, row) => {
    await updateUser(row.id, row);
    message.success('保存成功');
  }}
  onRowEditDelete={async (key, row) => {
    await deleteUser(row.id);
    message.success('删除成功');
  }}
  // ... 其他配置
/>
```

### 启用导入功能

```typescript
<UnifiedProTable<User>
  showImportButton={true}
  onImport={(data) => {
    // data 是二维数组格式：[[row1_col1, row1_col2, ...], [row2_col1, row2_col2, ...], ...]
    console.log('导入的数据:', data);
    // 处理导入数据，例如调用后端 API
    // await importUsers(data);
  }}
  // ... 其他配置
/>
```

### 启用导出功能

```typescript
<UnifiedProTable<User>
  showExportButton={true}
  onExport={(type, selectedRowKeys, currentPageData) => {
    switch (type) {
      case 'selected':
        // 导出选中的行
        console.log('导出选中的行:', selectedRowKeys);
        // await exportSelected(selectedRowKeys);
        break;
      case 'currentPage':
        // 导出当前页数据
        console.log('导出当前页数据:', currentPageData);
        // await exportCurrentPage(currentPageData);
        break;
      case 'all':
        // 导出全部数据
        console.log('导出全部数据');
        // await exportAll();
        break;
    }
  }}
  // ... 其他配置
/>
```

**导出类型说明**：
- **导出选中**：导出用户选中的行（需要先选中行）
- **导出本页**：导出当前页面显示的所有数据
- **导出全部**：导出所有符合筛选条件的数据（可能需要调用 API 获取全部数据）

### 同时启用导入和导出

```typescript
<UnifiedProTable<User>
  showImportButton={true}
  onImport={(data) => {
    console.log('导入的数据:', data);
  }}
  showExportButton={true}
  onExport={(selectedRowKeys) => {
    console.log('导出选中的行:', selectedRowKeys);
  }}
  // ... 其他配置
/>
```

**注意**：导入按钮会自动显示在导出按钮前面。

### 自定义工具栏按钮

```typescript
<UnifiedProTable<User>
  toolBarActions={[
    <Button key="custom1" onClick={() => {}}>自定义按钮1</Button>,
    <Button key="custom2" onClick={() => {}}>自定义按钮2</Button>,
  ]}
  showImportButton={true}
  showExportButton={true}
  // ... 其他配置
/>
```

### 禁用高级搜索

```typescript
<UnifiedProTable<User>
  showAdvancedSearch={false}
  // ... 其他配置
/>
```

### 使用头部操作按钮（新建、修改、删除）

```typescript
<UnifiedProTable<User>
  enableRowSelection={true}
  showCreateButton={true}
  onCreate={() => {
    navigate('/users/create');
  }}
  showEditButton={true}
  onEdit={(selectedRowKeys) => {
    navigate(`/users/${selectedRowKeys[0]}/edit`);
  }}
  showDeleteButton={true}
  onDelete={async (selectedRowKeys) => {
    await deleteUsers(selectedRowKeys);
    message.success('删除成功');
    actionRef.current?.reload();
  }}
  // ... 其他配置
/>
```

**注意**：
- 头部操作按钮显示在原来表格标题的位置（左上角）
- 修改按钮需要选中**一行**才能点击
- 删除按钮需要选中**至少一行**才能点击
- 新建按钮始终可用

### 自定义头部操作按钮

```typescript
<UnifiedProTable<User>
  headerActions={
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => {}}>
        新建
      </Button>
      <Button icon={<EditOutlined />} onClick={() => {}}>
        修改
      </Button>
      <Button danger icon={<DeleteOutlined />} onClick={() => {}}>
        删除
      </Button>
      <Button onClick={() => {}}>自定义按钮</Button>
    </Space>
  }
  // ... 其他配置
/>
```

**注意**：如果提供了 `headerActions`，将忽略 `showCreateButton`、`showEditButton`、`showDeleteButton` 等配置，直接使用自定义的 `headerActions`。

### 使用视图切换功能

```typescript
<UnifiedProTable<User>
  viewTypes={['table', 'card', 'kanban']}
  defaultViewType="table"
  onViewTypeChange={(viewType) => {
    console.log('切换到视图:', viewType);
  }}
  cardViewConfig={{
    renderCard: (item, index) => (
      <Card key={item.id} style={{ marginBottom: 16 }}>
        <Card.Meta
          title={item.name}
          description={item.email}
        />
      </Card>
    ),
    columns: { xs: 1, sm: 2, md: 3, lg: 4 },
  }}
  kanbanViewConfig={{
    statusField: 'status',
    statusGroups: {
      'active': { title: '激活', color: 'green' },
      'inactive': { title: '未激活', color: 'gray' },
      'suspended': { title: '已暂停', color: 'red' },
    },
    renderCard: (item, status) => (
      <Card key={item.id} style={{ marginBottom: 8 }}>
        <Card.Meta title={item.name} />
      </Card>
    ),
  }}
  // ... 其他配置
/>
```

**视图类型说明**：
- **表格视图（table）**：默认视图，适合所有列表数据
- **卡片视图（card）**：适合展示详细信息，如用户卡片、组织卡片
- **看板视图（kanban）**：适合有状态流转的数据，如工单、任务、组织审核
- **统计视图（stats）**：适合数据分析和可视化

**注意**：
- 视图切换按钮显示在按钮容器的右侧
- 只有当 `viewTypes` 包含多个视图时，才会显示视图切换按钮
- 所有视图共享同一数据源，切换时保持筛选条件

## API 文档

### UnifiedProTableProps

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `request` | `(params, sort, filter) => Promise<{data, success, total}>` | 必填 | 数据请求函数，已内置排序参数处理 |
| `columns` | `ProColumns<T>[]` | 必填 | 表格列定义 |
| `headerTitle` | `string` | - | 表格标题（已废弃，建议使用 `headerActions`） |
| `headerActions` | `ReactNode` | - | 头部操作按钮（显示在原来标题的位置） |
| `showCreateButton` | `boolean` | `false` | 是否显示新建按钮 |
| `onCreate` | `() => void` | - | 新建按钮点击回调 |
| `showEditButton` | `boolean` | `false` | 是否显示修改按钮（需要选中一行） |
| `onEdit` | `(selectedRowKeys: React.Key[]) => void` | - | 修改按钮点击回调 |
| `showDeleteButton` | `boolean` | `false` | 是否显示删除按钮（需要选中至少一行） |
| `onDelete` | `(selectedRowKeys: React.Key[]) => void` | - | 删除按钮点击回调 |
| `rowKey` | `string` | `'id'` | 行主键字段名 |
| `showAdvancedSearch` | `boolean` | `true` | 是否显示高级搜索按钮 |
| `beforeSearchButtons` | `ReactNode` | - | 高级搜索按钮前的自定义按钮 |
| `afterSearchButtons` | `ReactNode` | - | 高级搜索按钮后的自定义按钮 |
| `enableRowSelection` | `boolean` | `false` | 是否启用行选择 |
| `onRowSelectionChange` | `(selectedRowKeys) => void` | - | 行选择变化回调 |
| `enableRowEdit` | `boolean` | `false` | 是否启用行编辑 |
| `onRowEditSave` | `(key, row) => Promise<void>` | - | 行编辑保存回调 |
| `onRowEditDelete` | `(key, row) => Promise<void>` | - | 行编辑删除回调 |
| `toolBarActions` | `ReactNode[]` | `[]` | 工具栏自定义按钮 |
| `showImportButton` | `boolean` | `false` | 是否显示导入按钮 |
| `onImport` | `(data: any[][]) => void` | - | 导入按钮点击回调，data 是二维数组格式 |
| `showExportButton` | `boolean` | `false` | 是否显示导出按钮 |
| `onExport` | `(type, selectedRowKeys?, currentPageData?) => void` | - | 导出按钮点击回调，type 为导出类型（'selected' \| 'currentPage' \| 'all'） |
| `viewTypes` | `Array<'table' \| 'card' \| 'kanban' \| 'stats'>` | `['table']` | 支持的视图类型 |
| `defaultViewType` | `'table' \| 'card' \| 'kanban' \| 'stats'` | `'table'` | 默认视图类型 |
| `onViewTypeChange` | `(viewType) => void` | - | 视图切换回调 |
| `cardViewConfig` | `object` | - | 卡片视图配置 |
| `kanbanViewConfig` | `object` | - | 看板视图配置 |
| `statsViewConfig` | `object` | - | 统计视图配置 |
| `defaultPageSize` | `number` | `10` | 默认分页大小 |
| `showQuickJumper` | `boolean` | `true` | 是否显示快速跳转 |

### 其他 ProTable 属性

`UnifiedProTable` 继承所有 `ProTable` 的原生属性，可以通过 `...restProps` 传入。

## 注意事项

1. **排序参数处理**：`request` 函数接收的 `sort` 参数是 ProTable 的原始格式（`'ascend'`/`'descend'`），需要根据后端 API 的要求进行转换。

2. **按钮容器位置**：按钮容器会自动移动到 `ant-pro-table` 内部，确保样式统一。

3. **Ref 传递**：如果需要在外部控制表格（如手动刷新），可以传入 `actionRef` 和 `formRef`。

4. **后续完善**：所有表格相关的通用功能都会在此组件中统一完善，所有使用此组件的表格都会自动获得更新。

5. **导入功能**：导入功能使用 Luckysheet 在线表格编辑器，支持 Excel 格式的数据编辑和导入。导入的数据格式为二维数组 `any[][]`，第一行通常是表头，后续行是数据。

6. **按钮顺序**：工具栏按钮的显示顺序为：自定义按钮（`toolBarActions`） → 导入按钮 → 导出按钮。

