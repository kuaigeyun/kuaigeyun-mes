/**
 * 报表模板管理页面
 *
 * 提供报表模板的列表、创建、编辑、删除等功能
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DRAWER_CONFIG } from '../../../components/layout-templates';
import { apiRequest } from '../../../services/api';

/**
 * 报表模板接口定义
 */
interface ReportTemplate {
  id?: number;
  uuid?: string;
  name?: string;
  code?: string;
  type?: string;
  category?: string;
  status?: string;
  is_default?: boolean;
  description?: string;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 报表模板管理页面组件
 */
const ReportTemplatesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const formRef = useRef<any>(null);

  /**
   * 处理新建
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentId(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      // 加载数据到表单
      try {
        const data = await apiRequest(`/core/reports/templates/${id}`, {
          method: 'GET',
        });
        formRef.current?.setFieldsValue(data);
      } catch (error) {
        messageApi.error('加载数据失败');
      }
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setCurrentId(id);
      setDrawerVisible(true);
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的模板');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${keys.length} 个模板吗？`,
      onOk: async () => {
        try {
          await Promise.all(
            keys.map((key) =>
              apiRequest(`/core/reports/templates/${key}`, {
                method: 'DELETE',
              })
            )
          );
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error) {
          messageApi.error('删除失败');
        }
      },
    });
  };

  /**
   * 处理保存
   */
  const handleSave = async (values: any) => {
    try {
      if (isEdit && currentId) {
        await apiRequest(`/core/reports/templates/${currentId}`, {
          method: 'PUT',
          data: values,
        });
        messageApi.success('更新成功');
      } else {
        await apiRequest('/core/reports/templates', {
          method: 'POST',
          data: values,
        });
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      messageApi.error(isEdit ? '更新失败' : '创建失败');
    }
  };

  /**
   * 处理设计报表
   */
  const handleDesign = (record: ReportTemplate) => {
    navigate(`/system/report-templates/${record.id}/design`);
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReportTemplate>[] = [
    {
      title: '模板名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
    },
    {
      title: '模板编码',
      dataIndex: 'code',
      width: 150,
    },
    {
      title: '报表类型',
      dataIndex: 'type',
      width: 120,
      valueEnum: {
        inventory: { text: '库存报表', status: 'default' },
        production: { text: '生产报表', status: 'processing' },
        quality: { text: '质量报表', status: 'success' },
        custom: { text: '自定义', status: 'warning' },
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      valueEnum: {
        system: { text: '系统', status: 'default' },
        department: { text: '部门', status: 'processing' },
        personal: { text: '个人', status: 'warning' },
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        draft: { text: '草稿', status: 'default' },
        published: { text: '已发布', status: 'success' },
        archived: { text: '已归档', status: 'error' },
      },
    },
    {
      title: '是否默认',
      dataIndex: 'is_default',
      width: 100,
      render: (_, record) => (
        record.is_default ? <Tag color="green">是</Tag> : <Tag>否</Tag>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'created_by_name',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 250,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail([record.id!])}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleDesign(record)}
          >
            设计
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete([record.id!])}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  /**
   * 表单字段定义
   */
  const formFields = [
    {
      name: 'name',
      label: '模板名称',
      type: 'input' as const,
      required: true,
      rules: [{ required: true, message: '请输入模板名称' }],
    },
    {
      name: 'code',
      label: '模板编码',
      type: 'input' as const,
      required: true,
      rules: [{ required: true, message: '请输入模板编码' }],
    },
    {
      name: 'type',
      label: '报表类型',
      type: 'select' as const,
      required: true,
      options: [
        { label: '库存报表', value: 'inventory' },
        { label: '生产报表', value: 'production' },
        { label: '质量报表', value: 'quality' },
        { label: '自定义', value: 'custom' },
      ],
      rules: [{ required: true, message: '请选择报表类型' }],
    },
    {
      name: 'category',
      label: '分类',
      type: 'select' as const,
      required: true,
      options: [
        { label: '系统', value: 'system' },
        { label: '部门', value: 'department' },
        { label: '个人', value: 'personal' },
      ],
      rules: [{ required: true, message: '请选择分类' }],
    },
    {
      name: 'status',
      label: '状态',
      type: 'select' as const,
      required: true,
      options: [
        { label: '草稿', value: 'draft' },
        { label: '已发布', value: 'published' },
        { label: '已归档', value: 'archived' },
      ],
      rules: [{ required: true, message: '请选择状态' }],
    },
    {
      name: 'is_default',
      label: '是否默认',
      type: 'switch' as const,
    },
    {
      name: 'description',
      label: '描述',
      type: 'textarea' as const,
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="报表模板管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          try {
            const result = await apiRequest('/core/reports/templates', {
              method: 'GET',
              params: {
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                type: params.type,
                category: params.category,
                status: params.status,
              },
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取模板列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showCreateButton
        createButtonText="新建报表模板"
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDetail={handleDetail}
        onDelete={handleDelete}
        showAdvancedSearch={true}
        showImportButton={false}
        showExportButton={true}
        onExport={async (type, _keys, pageData) => {
          try {
            const result = await apiRequest('/core/reports/templates', {
              method: 'GET',
              params: { skip: 0, limit: 10000 },
            });
            const items = Array.isArray(result) ? result : [];
            const toExport = type === 'currentPage' && pageData?.length ? pageData : items;
            if (toExport.length === 0) {
              messageApi.warning('暂无数据可导出');
              return;
            }
            const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `report-templates-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(`已导出 ${toExport.length} 条记录`);
          } catch (error: any) {
            messageApi.error('导出失败');
          }
        }}
      />

      {/* 表单Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑报表模板' : '新建报表模板'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={async () => {
          const values = await formRef.current?.validateFields();
          await handleSave(values);
        }}
        formRef={formRef}
        fields={formFields}
      />

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`报表模板详情 - ${currentId || ''}`}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={columns}
        request={async () => {
          if (!currentId) return null;
          return await apiRequest(`/core/reports/templates/${currentId}`, {
            method: 'GET',
          });
        }}
      />
    </ListPageTemplate>
  );
};

export default ReportTemplatesPage;

