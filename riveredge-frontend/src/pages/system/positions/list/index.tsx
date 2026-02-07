/**
 * 职位管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的职位。
 * 支持职位的 CRUD 操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormTextArea, ProFormSwitch, ProFormTreeSelect } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../components/layout-templates';
import {
  getPositionList,
  getPositionByUuid,
  createPosition,
  updatePosition,
  deletePosition,
  Position,
  CreatePositionData,
  UpdatePositionData,
} from '../../../../services/position';
import { getDepartmentTree, DepartmentTreeItem } from '../../../../services/department';

/**
 * 职位管理列表页面组件
 */
const PositionListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deptTreeData, setDeptTreeData] = useState<DepartmentTreeItem[]>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPositionUuid, setCurrentPositionUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, any> | undefined>(undefined);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Position | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 加载部门数据（用于树形选择）
   */
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await getDepartmentTree();
        setDeptTreeData(response.items);
      } catch (error) {
        console.error('加载部门列表失败:', error);
      }
    };
    loadDepartments();
  }, []);

  /**
   * 处理新建职位
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentPositionUuid(null);
    setFormInitialValues({
      is_active: true,
      sort_order: 0,
    });
    setModalVisible(true);
  };

  // 导入处理函数
  const handleImport = async (data: any[][]) => {
    messageApi.info('导入功能开发中...');
    console.log('导入数据:', data);
  };

  // 导出处理函数
  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Position[]
  ) => {
    messageApi.info('导出功能开发中...');
    console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
  };

  /**
   * 处理编辑职位
   */
  const handleEdit = async (record: Position) => {
    try {
      setIsEdit(true);
      setCurrentPositionUuid(record.uuid);
      
      const detail = await getPositionByUuid(record.uuid);
      setFormInitialValues({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        department_uuid: detail.department_uuid,
        sort_order: detail.sort_order,
        is_active: detail.is_active,
      });
      setModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取职位详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleView = async (record: Position) => {
    try {
      setDetailLoading(true);
      setDrawerVisible(true);
      const detail = await getPositionByUuid(record.uuid);
      setDetailData(detail);
    } catch (error: any) {
      messageApi.error(error.message || '获取职位详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 处理删除职位
   */
  const handleDelete = async (record: Position) => {
    try {
      await deletePosition(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理批量删除职位
   */
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      messageApi.warning('请先选择要删除的记录');
      return;
    }

    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 条记录吗？此操作不可恢复。`,
      okText: '确定',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];

          for (const key of selectedRowKeys) {
            try {
              await deletePosition(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || '删除失败');
            }
          }

          if (successCount > 0) {
            messageApi.success(`成功删除 ${successCount} 条记录`);
          }
          if (failCount > 0) {
            messageApi.error(`删除失败 ${failCount} 条记录${errors.length > 0 ? '：' + errors.join('; ') : ''}`);
          }

          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      setFormLoading(true);
      
      if (isEdit && currentPositionUuid) {
        await updatePosition(currentPositionUuid, values as UpdatePositionData);
        messageApi.success('更新成功');
      } else {
        await createPosition(values as CreatePositionData);
        messageApi.success('创建成功');
      }
      
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error; // 重新抛出错误，让 FormModalTemplate 处理
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<Position>[] = [
    {
      title: '职位名称',
      dataIndex: 'name',
      width: 150,
      fixed: 'left',
      sorter: true,
    },
    {
      title: '职位代码',
      dataIndex: 'code',
      width: 150,
      copyable: true,
    },
    {
      title: '所属部门',
      dataIndex: 'department_uuid',
      width: 200,
      valueType: 'treeSelect',
      fieldProps: {
        treeData: deptTreeData,
        fieldNames: { label: 'name', value: 'uuid' },
      },
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      width: 100,
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 100,
      hideInSearch: true,
      sorter: true,
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
      sorter: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
      valueType: 'dateTime',
      hideInSearch: true,
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 200,
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
          <Popconfirm
            title="确定要删除这个职位吗？"
            onConfirm={() => handleDelete(record)}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Position>
          viewTypes={['table']}
          actionRef={actionRef}
          columns={columns}
          request={async (params, _sort, _filter, searchFormValues) => {
            const response = await getPositionList({
              page: params.current || 1,
              page_size: params.pageSize || 20,
              keyword: searchFormValues?.keyword,
              name: searchFormValues?.name,
              code: searchFormValues?.code,
              department_uuid: searchFormValues?.department_uuid,
              is_active: searchFormValues?.is_active,
            });
            return {
              data: response.items,
              success: true,
              total: response.total,
            };
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          toolBarRender={() => [
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              新建职位
            </Button>,
            <Button
              key="batch-delete"
              danger
              icon={<DeleteOutlined />}
              disabled={selectedRowKeys.length === 0}
              onClick={handleBatchDelete}
            >
              批量删除
            </Button>,
          ]}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          showImportButton={true}
          onImport={handleImport}
          showExportButton={true}
          onExport={handleExport}
        />
      </ListPageTemplate>

      {/* 创建/编辑 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑职位' : '新建职位'}
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
          label="职位名称"
          rules={[{ required: true, message: '请输入职位名称' }]}
          placeholder="请输入职位名称"
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="code"
          label="职位代码"
          rules={[{ required: true, message: '请输入职位代码' }]}
          placeholder="请输入职位代码"
          colProps={{ span: 12 }}
        />
        <ProFormTreeSelect
          name="department_uuid"
          label="所属部门"
          placeholder="请选择所属部门（可选）"
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
          placeholder="请输入职位描述"
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
        title="职位详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        dataSource={detailData as any}
        columns={[
          { title: '职位名称', dataIndex: 'name' },
          { title: '职位代码', dataIndex: 'code' },
          { title: '描述', dataIndex: 'description', span: 2 },
          { title: '所属部门', dataIndex: ['department', 'name'], render: (_: any, record: any) => record.department?.name || '-' },
          {
            title: '状态',
            dataIndex: 'is_active',
            render: (value: boolean) => (value ? '启用' : '禁用'),
          },
          { title: '用户数', dataIndex: 'user_count' },
          { title: '排序', dataIndex: 'sort_order' },
          { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
          { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
        ]}
      />
    </>
  );
};

export default PositionListPage;

