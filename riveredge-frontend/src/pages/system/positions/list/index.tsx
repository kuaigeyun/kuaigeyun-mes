/**
 * 职位管理列表页面
 * 
 * 用于系统管理员查看和管理组织内的职位。
 * 支持职位的 CRUD 操作。
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptions, ProForm, ProFormText, ProFormTextArea, ProFormSelect, ProFormSwitch, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Drawer, Modal } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../components/uni_table';
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
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<Array<{ label: string; value: string }>>([]);
  
  // Modal 相关状态（创建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentPositionUuid, setCurrentPositionUuid] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  
  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailData, setDetailData] = useState<Position | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /**
   * 加载部门选项
   */
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const response = await getDepartmentTree();
        const buildOptions = (items: DepartmentTreeItem[], level = 0): Array<{ label: string; value: string }> => {
          const options: Array<{ label: string; value: string }> = [];
          items.forEach(item => {
            const prefix = '  '.repeat(level);
            options.push({
              label: `${prefix}${item.name}`,
              value: item.uuid,
            });
            if (item.children && item.children.length > 0) {
              options.push(...buildOptions(item.children, level + 1));
            }
          });
          return options;
        };
        setDepartmentOptions(buildOptions(response.items));
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
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      is_active: true,
      sort_order: 0,
    });
  };

  // 导入处理函数
  const handleImport = async (data: any[][]) => {
    message.info('导入功能开发中...');
    console.log('导入数据:', data);
  };

  // 导出处理函数
  const handleExport = (
    type: 'selected' | 'currentPage' | 'all',
    selectedRowKeys?: React.Key[],
    currentPageData?: Position[]
  ) => {
    message.info('导出功能开发中...');
    console.log('导出类型:', type, '选中行:', selectedRowKeys, '当前页数据:', currentPageData);
  };

  /**
   * 处理编辑职位
   */
  const handleEdit = async (record: Position) => {
    try {
      setIsEdit(true);
      setCurrentPositionUuid(record.uuid);
      setModalVisible(true);
      
      const detail = await getPositionByUuid(record.uuid);
      formRef.current?.setFieldsValue({
        name: detail.name,
        code: detail.code,
        description: detail.description,
        department_uuid: detail.department_uuid,
        sort_order: detail.sort_order,
        is_active: detail.is_active,
      });
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
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async () => {
    try {
      setFormLoading(true);
      const values = await formRef.current?.validateFields();
      
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
    },
    {
      title: '职位代码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '所属部门',
      dataIndex: 'department',
      width: 200,
      render: (_, record) => record.department?.name || '-',
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      hideInSearch: true,
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
      title: '用户数',
      dataIndex: 'user_count',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 100,
      hideInSearch: true,
      sorter: true,
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
      title: '操作',
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space>
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
      <UniTable<Position>
        actionRef={actionRef}
        columns={columns}
        request={async (params, sort, filter, searchFormValues) => {
          const response = await getPositionList({
            page: params.current || 1,
            page_size: params.pageSize || 20,
            keyword: searchFormValues?.keyword,
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
        }}
        toolBarRender={() => [
          <Button key="create" type="primary" onClick={handleCreate}>
            新建职位
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

      {/* 创建/编辑 Modal */}
      <Modal
        title={isEdit ? '编辑职位' : '新建职位'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={formLoading}
        size={800}
      >
        <ProForm
          formRef={formRef}
          submitter={false}
          layout="vertical"
        >
          <ProFormText
            name="name"
            label="职位名称"
            rules={[{ required: true, message: '请输入职位名称' }]}
            placeholder="请输入职位名称"
          />
          <ProFormText
            name="code"
            label="职位代码"
            placeholder="请输入职位代码（可选）"
          />
          <ProFormTextArea
            name="description"
            label="描述"
            placeholder="请输入职位描述"
          />
          <ProFormSelect
            name="department_uuid"
            label="所属部门"
            placeholder="请选择所属部门（可选）"
            options={departmentOptions}
            allowClear
          />
          <ProFormText
            name="sort_order"
            label="排序"
            initialValue={0}
            fieldProps={{ type: 'number' }}
          />
          <ProFormSwitch
            name="is_active"
            label="是否启用"
            initialValue={true}
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="职位详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        size={600}
        loading={detailLoading}
      >
        {detailData && (
          <ProDescriptions
            column={2}
            dataSource={detailData}
            columns={[
              { title: '职位名称', dataIndex: 'name' },
              { title: '职位代码', dataIndex: 'code' },
              { title: '描述', dataIndex: 'description', span: 2 },
              { title: '所属部门', dataIndex: ['department', 'name'], render: (_, record) => record.department?.name || '-' },
              {
                title: '状态',
                dataIndex: 'is_active',
                render: (value) => (value ? '启用' : '禁用'),
              },
              { title: '用户数', dataIndex: 'user_count' },
              { title: '排序', dataIndex: 'sort_order' },
              { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime' },
              { title: '更新时间', dataIndex: 'updated_at', valueType: 'dateTime' },
            ]}
          />
        )}
      </Drawer>
    </>
  );
};

export default PositionListPage;

