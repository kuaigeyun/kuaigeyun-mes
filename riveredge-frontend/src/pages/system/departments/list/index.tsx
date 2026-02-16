/**
 * 部门管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的部门。
 * 使用树形表格展示，支持统计、创建、编辑、删除等功能。
 */

import React, { useRef, useState } from 'react';
import { ProFormText, ProFormTextArea, ProFormSwitch, ProColumns, ProFormTreeSelect } from '@ant-design/pro-components';
import { EditOutlined, DeleteOutlined, PlusOutlined, ApartmentOutlined, TeamOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { App, Button, Tag, Space, Modal, List, Popconfirm, Tooltip } from 'antd';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import { UniTable } from '../../../../components/uni-table';
import {
  getDepartmentTree,
  getDepartmentByUuid,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  importDepartments,
  Department,
  DepartmentTreeItem,
  CreateDepartmentData,
  UpdateDepartmentData,
} from '../../../../services/department';
// import { getUserList, User } from '../../../../services/user';

/**
 * 部门管理列表页面组件
 */
const DepartmentListPage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const actionRef = useRef<any>();
  
  // 统计数据状态
  const [stats, setStats] = useState({
    totalCount: 0,
    activeCount: 0,
    userCount: 0,
  });

  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentDepartmentUuid, setCurrentDepartmentUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // 部门树数据缓存（用于父部门选择）
  const [deptTreeData, setDeptTreeData] = useState<DepartmentTreeItem[]>([]);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);

  // 展开/收起状态
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  // 选中行状态（用于批量删除）
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 缓存原始列表数据用于批量操作校验
  const [allDepts, setAllDepts] = useState<Department[]>([]);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Department | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 递归获取所有部门 UUID（用于一键展开）
   */
  const getAllKeys = (data: DepartmentTreeItem[]): string[] => {
    let keys: string[] = [];
    data.forEach((item) => {
      keys.push(item.uuid);
      if (item.children && item.children.length > 0) {
        keys.push(...getAllKeys(item.children));
      }
    });
    return keys;
  };

  // 批量导入相关状态
  // const [importVisible, setImportVisible] = useState(false); // UniTable 自带导入功能，这里预留

  /**
   * 加载数据
   */
  const loadData = async (params: any, _sort: any, _filter: any, searchFormValues?: any) => {
    try {
      // 记录参数以便后续支持后端分页和过滤
      console.log('加载部门数据参数:', { params, searchFormValues });
      
      // ⚠️ 修复：从 searchFormValues 中提取搜索参数
      const keyword = searchFormValues?.keyword || searchFormValues?.name || searchFormValues?.code;
      const is_active = searchFormValues?.is_active !== undefined && searchFormValues?.is_active !== '' 
        ? (searchFormValues.is_active === 'true' || searchFormValues.is_active === true)
        : undefined;

      // 调用后端 API，传入搜索和筛选参数
      const response = await getDepartmentTree({
        keyword,
        is_active,
      });
      
      // 更新统计数据
      // 需要遍历树来计算
      let active = 0;
      let users = 0;
      const allKeys: string[] = [];
      const traverse = (nodes: DepartmentTreeItem[]) => {
        nodes.forEach(node => {
          allKeys.push(node.uuid);
          if (node.is_active) active++;
          users += (node.user_count || 0);
          if (node.children) traverse(node.children);
        });
      };
      traverse(response.items);
      
      setStats({
        totalCount: response.total,
        activeCount: active,
        userCount: users,
      });

      // 缓存扁平化数据用于批量操作时的快速查找/校验
      const flatDepts: Department[] = [];
      const flatten = (nodes: DepartmentTreeItem[]) => {
        nodes.forEach(node => {
          const { children, ...rest } = node;
          flatDepts.push(rest as Department);
          if (children) flatten(children);
        });
      };
      flatten(response.items);
      setAllDepts(flatDepts);

      // 缓存树数据用于选择父部门
      setDeptTreeData(response.items);

      // 如果是第一次加载，默认全部展开
      if (expandedRowKeys.length === 0) {
        setExpandedRowKeys(allKeys);
      }

      return {
        data: response.items,
        success: true,
        total: response.total,
      };
    } catch (error: any) {
      messageApi.error(error.message || '加载部门数据失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  /**
   * 处理新建部门
   */
  const handleCreate = (parentUuid?: string) => {
    setIsEdit(false);
    setCurrentDepartmentUuid(null);
    setFormInitialValues({
      parent_uuid: parentUuid || null,
      is_active: true,
      sort_order: 0,
    });
    setModalVisible(true);
  };

  /**
   * 处理编辑部门
   */
  const handleEdit = async (record: Department) => {
    try {
      setIsEdit(true);
      setCurrentDepartmentUuid(record.uuid);
      
      const detail = await getDepartmentByUuid(record.uuid);
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        parent_uuid: detail.parent_uuid,
        sort_order: detail.sort_order,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取部门详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Department) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getDepartmentByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取部门详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除部门
   */
  /**
   * 校验部门是否满足删除条件
   */
  const checkCanDelete = (record: Department): { can: boolean; reason?: string } => {
    // 后端接口通常也会校验，但前端提前拦截并提示体验更好
    if ((record.children_count || 0) > 0) {
      return { can: false, reason: '该部门包含子部门，请先删除或移动子部门' };
    }
    // 注意：这里同时检查 user_count (关联人员) 和 position_count (关联职位)
    if ((record.position_count || 0) > 0) {
      return { can: false, reason: '该部门包含关联职位，请先处理关联职位' };
    }
    if ((record.user_count || 0) > 0) {
      return { can: false, reason: '该部门包含关联人员，请先移除人员' };
    }
    return { can: true };
  };

  /**
   * 处理删除部门
   */
  const handleDelete = async (record: Department) => {
    try {
        await deleteDepartment(record.uuid);
        messageApi.success('删除成功');
        actionRef.current?.reload();
    } catch (error: any) {
        messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除
   */
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的部门');
      return;
    }

    // 筛选出不能删除的部门
    const cannotDeleteNames: string[] = [];
    const canDeleteKeys: string[] = [];

    selectedRowKeys.forEach(key => {
      const dept = allDepts.find(d => d.uuid === key);
      if (dept) {
        const check = checkCanDelete(dept);
        if (!check.can) {
          cannotDeleteNames.push(`${dept.name}(${check.reason})`);
        } else {
          canDeleteKeys.push(dept.uuid);
        }
      }
    });

    if (cannotDeleteNames.length > 0) {
      modal.error({
        title: '批量删除受阻',
        content: (
          <div>
            以下部门不满足删除条件：
            <ul style={{ marginTop: 8 }}>
              {cannotDeleteNames.map(name => <li key={name}>{name}</li>)}
            </ul>
            请处理后再试。
          </div>
        ),
      });
      return;
    }

    modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个部门吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          // 这里可以考虑后端是否支持批量接口，如果不支持则前端循环调用
          await Promise.all(canDeleteKeys.map(key => deleteDepartment(key)));
          messageApi.success('批量删除成功');
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '部分部门删除失败');
          actionRef.current?.reload();
        }
      }
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentDepartmentUuid) {
        await updateDepartment(currentDepartmentUuid, values as UpdateDepartmentData);
        messageApi.success('更新成功');
      } else {
        await createDepartment(values as CreateDepartmentData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      // throw error; // 不抛出，避免 Modal 关闭异常
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理导入
   */
  const handleImport = async (data: any[][]) => {
    try {
        const result = await importDepartments(data);
        if (result.success_count > 0) {
            messageApi.success(`成功导入 ${result.success_count} 条数据`);
            actionRef.current?.reload();
        }
        if (result.failure_count > 0) {
             Modal.error({
                title: '导入部分失败',
                content: (
                    <List
                        size="small"
                        dataSource={result.errors}
                        renderItem={(item) => <List.Item>行 {item.row}: {item.error}</List.Item>}
                    />
                ),
            });
        }
    } catch (error: any) {
         messageApi.error(error.message || '导入失败');
    }
  }


  /**
   * 表格列定义
   */
  const columns: ProColumns<Department>[] = [
    {
      title: '部门名称',
      dataIndex: 'name',
      width: 250,
      fixed: 'left',
      render: (_, record) => (
          <Space>
              <span style={{ fontWeight: 500 }}>{record.name}</span>
              {(record.children_count || 0) > 0 && (
                <Tag color="blue" style={{ marginLeft: 4 }}>
                  {record.children_count} 子部门
                </Tag>
              )}
          </Space>
      )
    },
    {
      title: '部门代码',
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '人员数量',
      dataIndex: 'user_count',
      width: 100,
      align: 'center',
      hideInSearch: true,
      render: (_, record) => (
        record.user_count ? <Tag color="blue">{record.user_count} 人</Tag> : '-'
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 80,
      valueType: 'digit',
      hideInSearch: true,
      sorter: (a, b) => a.sort_order - b.sort_order,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleCreate(record.uuid)}
          >
            添加子部门
          </Button>
          <Popconfirm
            title={`确定要删除部门 "${record.name}" 吗？`}
            description="删除后不可恢复。"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
            disabled={!checkCanDelete(record).can}
          >
            <Tooltip title={checkCanDelete(record).reason}>
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!checkCanDelete(record).can}
              >
                删除
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate
      statCards={[
        {
          title: '部门总数',
          value: stats.totalCount,
          prefix: <ApartmentOutlined />,
          valueStyle: { color: '#1890ff' },
        },
        {
          title: '启用部门',
          value: stats.activeCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: '总人员数',
          value: stats.userCount,
          prefix: <TeamOutlined />,
          valueStyle: { color: '#722ed1' },
        },
      ]}
    >
      <UniTable<Department>
        viewTypes={['table', 'help']}
        actionRef={actionRef}
        headerTitle="部门列表"
        rowKey="uuid"
        columns={columns}
        request={loadData}
        showCreateButton={false}
        toolBarRender={() => [
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleCreate()}
          >
            新建部门
          </Button>,
          <Button
            key="batchDelete"
            danger
            icon={<DeleteOutlined />}
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除
          </Button>,
          <Button
            key="toggleExpand"
            onClick={() => {
              if (expandedRowKeys.length > 0) {
                setExpandedRowKeys([]);
              } else {
                setExpandedRowKeys(getAllKeys(deptTreeData));
              }
            }}
          >
            {expandedRowKeys.length > 0 ? '一键收起' : '一键展开'}
          </Button>,
        ]}
        showImportButton={true}
        onImport={handleImport}
        pagination={{
          defaultPageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        showAdvancedSearch={true}
        expandable={{
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as React.Key[]),
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        search={{
          labelWidth: 'auto',
        }}
        showQuickJumper={false}
      />

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑部门' : '新建部门'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={formInitialValues}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText
          name="name"
          label="部门名称"
          rules={[{ required: true, message: '请输入部门名称' }]}
          placeholder="请输入部门名称"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="code"
          label="部门代码"
          rules={[{ required: true, message: '请输入部门代码' }]}
          placeholder="请输入部门代码"
          colProps={{ span: 12 }}
        />
        <ProFormTreeSelect
          name="parent_uuid"
          label="父部门"
          placeholder="请选择父部门（可选）"
          allowClear
          fieldProps={{
            showSearch: true,
            filterTreeNode: true,
            treeNodeFilterProp: 'name',
            fieldNames: {
              label: 'name',
              value: 'uuid',
              children: 'children',
            },
            treeData: deptTreeData,
            treeDefaultExpandAll: true,
          }}
          colProps={{ span: 24 }}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入部门描述"
          colProps={{ span: 24 }}
        />
        <ProFormText
          name="sort_order"
          label="排序"
          placeholder="数字越小越靠前"
          fieldProps={{ type: 'number' }}
          colProps={{ span: 12 }}
        />
        <ProFormSwitch
          name="is_active"
          label="是否启用"
          initialValue={true}
          colProps={{ span: 12 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title="部门详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData as any}
        columns={[
          { title: '部门名称', dataIndex: 'name' },
          { title: '部门代码', dataIndex: 'code' },
          { title: '父部门', dataIndex: ['parent', 'name'], span: 2, render: (_: any, record: any) => record?.parent_name || '-' },
          {
            title: '状态',
            dataIndex: 'is_active',
            render: (_: any, entity: any) => (entity?.is_active ? '启用' : '禁用'),
          },
          { title: '人员数量', dataIndex: 'user_count' },
          { title: '排序', dataIndex: 'sort_order' },
          { title: '查询码', dataIndex: 'query_code' },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
          { title: '描述', dataIndex: 'description', span: 2 },
        ]}
      />
    </ListPageTemplate>
  );
};

export default DepartmentListPage;
