/**
 * 模具管理页面
 *
 * 提供模具的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持模具信息、模具使用、模具维护、模具追溯等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { moldApi } from '../../../services/equipment';
import dayjs from 'dayjs';

interface Mold {
  id?: number;
  uuid?: string;
  tenant_id?: number;
  code?: string;
  name?: string;
  type?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  installation_date?: string;
  warranty_period?: number;
  status?: string;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const MoldsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态（创建/编辑模具）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentMold, setCurrentMold] = useState<Mold | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [moldDetail, setMoldDetail] = useState<Mold | null>(null);

  /**
   * 处理新建模具
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentMold(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理编辑模具
   */
  const handleEdit = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error('模具UUID不存在');
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setIsEdit(true);
      setCurrentMold(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          type: detail.type,
          category: detail.category,
          brand: detail.brand,
          model: detail.model,
          serial_number: detail.serial_number,
          manufacturer: detail.manufacturer,
          supplier: detail.supplier,
          purchase_date: detail.purchase_date ? dayjs(detail.purchase_date) : null,
          installation_date: detail.installation_date ? dayjs(detail.installation_date) : null,
          warranty_period: detail.warranty_period,
          status: detail.status,
          is_active: detail.is_active,
          description: detail.description,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取模具详情失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: Mold) => {
    try {
      if (!record.uuid) {
        messageApi.error('模具UUID不存在');
        return;
      }
      const detail = await moldApi.get(record.uuid);
      setMoldDetail(detail);
      setDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取模具详情失败');
    }
  };

  /**
   * 处理删除模具
   */
  const handleDelete = async (keys: React.Key[]) => {
    try {
      const records = keys as any[];
      await Promise.all(records.map(record => {
        if (record.uuid) {
          return moldApi.delete(record.uuid);
        }
        return Promise.resolve();
      }));
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        purchase_date: values.purchase_date ? values.purchase_date.format('YYYY-MM-DD') : null,
        installation_date: values.installation_date ? values.installation_date.format('YYYY-MM-DD') : null,
      };

      if (isEdit && currentMold?.uuid) {
        await moldApi.update(currentMold.uuid, submitData);
        messageApi.success('模具更新成功');
      } else {
        await moldApi.create(submitData);
        messageApi.success('模具创建成功');
      }
      setModalVisible(false);
      setCurrentMold(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<Mold>[] = [
    {
      title: '模具编码',
      dataIndex: 'code',
    },
    {
      title: '模具名称',
      dataIndex: 'name',
    },
    {
      title: '模具类型',
      dataIndex: 'type',
    },
    {
      title: '模具分类',
      dataIndex: 'category',
    },
    {
      title: '品牌',
      dataIndex: 'brand',
    },
    {
      title: '型号',
      dataIndex: 'model',
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
    },
    {
      title: '制造商',
      dataIndex: 'manufacturer',
    },
    {
      title: '供应商',
      dataIndex: 'supplier',
    },
    {
      title: '采购日期',
      dataIndex: 'purchase_date',
      valueType: 'date',
    },
    {
      title: '安装日期',
      dataIndex: 'installation_date',
      valueType: 'date',
    },
    {
      title: '保修期（月）',
      dataIndex: 'warranty_period',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '使用中': { text: '使用中', color: 'processing' },
          '维护中': { text: '维护中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
    },
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<Mold>[] = [
    {
      title: '模具编码',
      dataIndex: 'code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '模具名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '模具类型',
      dataIndex: 'type',
      width: 120,
    },
    {
      title: '模具分类',
      dataIndex: 'category',
      width: 120,
    },
    {
      title: '品牌',
      dataIndex: 'brand',
      width: 100,
    },
    {
      title: '型号',
      dataIndex: 'model',
      width: 120,
    },
    {
      title: '序列号',
      dataIndex: 'serial_number',
      width: 150,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '正常': { text: '正常', color: 'success' },
          '使用中': { text: '使用中', color: 'processing' },
          '维护中': { text: '维护中', color: 'warning' },
          '停用': { text: '停用', color: 'default' },
          '报废': { text: '报废', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '是否启用',
      dataIndex: 'is_active',
      width: 100,
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      sorter: true,
    },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_text, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleDetail(record)}
          >
            详情
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
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认删除',
                content: `确定要删除模具"${record.name}"吗？`,
                onOk: () => handleDelete([record]),
              });
            }}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Mold>
          headerTitle="模具管理"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showAdvancedSearch={true}
          request={async (params) => {
            try {
              const response = await moldApi.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...params,
              });
              return {
                data: response.items || [],
                success: true,
                total: response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取模具列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          toolBarRender={() => [
            <Button
              key="create"
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              新建模具
            </Button>,
          ]}
          onDelete={handleDelete}
        />
      </ListPageTemplate>

      {/* 创建/编辑模具 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑模具' : '新建模具'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentMold(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        <ProFormText
          name="name"
          label="模具名称"
          placeholder="请输入模具名称"
          rules={[{ required: true, message: '请输入模具名称' }]}
        />
        <ProFormSelect
          name="type"
          label="模具类型"
          placeholder="请选择模具类型"
          options={[
            { label: '注塑模具', value: '注塑模具' },
            { label: '压铸模具', value: '压铸模具' },
            { label: '冲压模具', value: '冲压模具' },
            { label: '其他', value: '其他' },
          ]}
        />
        <ProFormText
          name="category"
          label="模具分类"
          placeholder="请输入模具分类"
        />
        <ProFormText
          name="brand"
          label="品牌"
          placeholder="请输入品牌"
        />
        <ProFormText
          name="model"
          label="型号"
          placeholder="请输入型号"
        />
        <ProFormText
          name="serial_number"
          label="序列号"
          placeholder="请输入序列号"
        />
        <ProFormText
          name="manufacturer"
          label="制造商"
          placeholder="请输入制造商"
        />
        <ProFormText
          name="supplier"
          label="供应商"
          placeholder="请输入供应商"
        />
        <ProFormDatePicker
          name="purchase_date"
          label="采购日期"
          placeholder="请选择采购日期"
        />
        <ProFormDatePicker
          name="installation_date"
          label="安装日期"
          placeholder="请选择安装日期"
        />
        <ProFormDigit
          name="warranty_period"
          label="保修期（月）"
          placeholder="请输入保修期（月）"
          min={0}
        />
        <ProFormSelect
          name="status"
          label="模具状态"
          placeholder="请选择模具状态"
          options={[
            { label: '正常', value: '正常' },
            { label: '使用中', value: '使用中' },
            { label: '维护中', value: '维护中' },
            { label: '停用', value: '停用' },
            { label: '报废', value: '报废' },
          ]}
          rules={[{ required: true, message: '请选择模具状态' }]}
        />
        <ProFormSelect
          name="is_active"
          label="是否启用"
          placeholder="请选择是否启用"
          options={[
            { label: '启用', value: true },
            { label: '停用', value: false },
          ]}
          rules={[{ required: true, message: '请选择是否启用' }]}
        />
        <ProFormTextArea
          name="description"
          label="描述"
          placeholder="请输入描述（可选）"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 模具详情 Drawer */}
      <DetailDrawerTemplate
        title="模具详情"
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setMoldDetail(null);
        }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        dataSource={moldDetail}
        columns={detailColumns}
      />
    </>
  );
};

export default MoldsPage;

