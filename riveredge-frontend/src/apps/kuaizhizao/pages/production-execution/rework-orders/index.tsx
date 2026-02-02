/**
 * 返工单管理页面
 *
 * 提供返工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持从原工单创建返工单。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { reworkOrderApi } from '../../../services/production';

interface ReworkOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  original_work_order_id?: number;
  original_work_order_uuid?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  rework_reason?: string;
  rework_type?: string;
  status?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  workshop_id?: number;
  workshop_name?: string;
  work_center_id?: number;
  work_center_name?: string;
  completed_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const ReworkOrdersPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentReworkOrder, setCurrentReworkOrder] = useState<ReworkOrder | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [reworkOrderDetail, setReworkOrderDetail] = useState<ReworkOrder | null>(null);

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<ReworkOrder>[] = [
    {
      title: '返工单编码',
      dataIndex: 'code',
    },
    {
      title: '原工单ID',
      dataIndex: 'original_work_order_id',
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      span: 2,
    },
    {
      title: '返工数量',
      dataIndex: 'quantity',
    },
    {
      title: '返工类型',
      dataIndex: 'rework_type',
      render: (text) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          '返工': { text: '返工', color: 'blue' },
          '返修': { text: '返修', color: 'orange' },
          '报废': { text: '报废', color: 'red' },
        };
        const config = typeMap[text || ''] || { text: text || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '返工原因',
      dataIndex: 'rework_reason',
      span: 2,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          'draft': { text: '草稿', color: 'default' },
          'released': { text: '已下达', color: 'processing' },
          'in_progress': { text: '执行中', color: 'blue' },
          'completed': { text: '已完成', color: 'success' },
          'cancelled': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '车间',
      dataIndex: 'workshop_name',
    },
    {
      title: '工作中心',
      dataIndex: 'work_center_name',
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
    },
    {
      title: '实际开始时间',
      dataIndex: 'actual_start_date',
      valueType: 'dateTime',
      render: (text) => text || '-',
    },
    {
      title: '实际结束时间',
      dataIndex: 'actual_end_date',
      valueType: 'dateTime',
      render: (text) => text || '-',
    },
    {
      title: '已完成数量',
      dataIndex: 'completed_quantity',
      render: (text) => text || 0,
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ];

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReworkOrder>[] = [
    {
      title: '返工单编码',
      dataIndex: 'code',
      width: 180,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '原工单ID',
      dataIndex: 'original_work_order_id',
      width: 120,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '返工数量',
      dataIndex: 'quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '返工类型',
      dataIndex: 'rework_type',
      width: 100,
      render: (text) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          '返工': { text: '返工', color: 'blue' },
          '返修': { text: '返修', color: 'orange' },
          '报废': { text: '报废', color: 'red' },
        };
        const config = typeMap[text || ''] || { text: text || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '返工原因',
      dataIndex: 'rework_reason',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          'draft': { text: '草稿', color: 'default' },
          'released': { text: '已下达', color: 'processing' },
          'in_progress': { text: '执行中', color: 'blue' },
          'completed': { text: '已完成', color: 'success' },
          'cancelled': { text: '已取消', color: 'error' },
        };
        const config = statusMap[status || ''] || { text: status || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '计划开始时间',
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '计划结束时间',
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
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
      valueType: 'option',
      width: 180,
      fixed: 'right',
      render: (_text, record) => [
        <Button
          key="detail"
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleDetail(record)}
        >
          详情
        </Button>,
        <Button
          key="edit"
          type="link"
          size="small"
          icon={<EditOutlined />}
          onClick={() => handleEdit(record)}
          disabled={record.status === 'completed' || record.status === 'cancelled'}
        >
          编辑
        </Button>,
        <Button
          key="delete"
          type="link"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record)}
          disabled={record.status !== 'draft'}
        >
          删除
        </Button>,
      ],
    },
  ];

  /**
   * 处理详情查看
   */
  const handleDetail = async (record: ReworkOrder) => {
    try {
      const detail = await reworkOrderApi.get(record.id!.toString());
      setReworkOrderDetail(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取返工单详情失败');
    }
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (record: ReworkOrder) => {
    try {
      const detail = await reworkOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentReworkOrder(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          quantity: detail.quantity,
          rework_reason: detail.rework_reason,
          rework_type: detail.rework_type,
          status: detail.status,
          planned_start_date: detail.planned_start_date,
          planned_end_date: detail.planned_end_date,
          completed_quantity: detail.completed_quantity,
          qualified_quantity: detail.qualified_quantity,
          unqualified_quantity: detail.unqualified_quantity,
          remarks: detail.remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取返工单详情失败');
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: ReworkOrder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除返工单 "${record.code}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await reworkOrderApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理创建
   */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReworkOrder(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      if (isEdit && currentReworkOrder?.id) {
        await reworkOrderApi.update(currentReworkOrder.id.toString(), values);
        messageApi.success('返工单更新成功');
      } else {
        await reworkOrderApi.create(values);
        messageApi.success('返工单创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理表格请求
   */
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    filter: Record<string, React.ReactText[] | null>
  ) => {
    try {
      const response = await reworkOrderApi.list({
        page: params.current || 1,
        page_size: params.pageSize || 20,
      });
      return {
        data: response || [],
        success: true,
        total: response?.length || 0,
      };
    } catch (error: any) {
      messageApi.error('获取返工单列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  /**
   * 处理编辑（从选中行）
   */
  const handleEditFromSelection = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const detail = await reworkOrderApi.get(id.toString());
        setIsEdit(true);
        setCurrentReworkOrder(detail);
        setModalVisible(true);
        setTimeout(() => {
          formRef.current?.setFieldsValue({
            quantity: detail.quantity,
            rework_reason: detail.rework_reason,
            rework_type: detail.rework_type,
            status: detail.status,
            planned_start_date: detail.planned_start_date,
            planned_end_date: detail.planned_end_date,
            completed_quantity: detail.completed_quantity,
            qualified_quantity: detail.qualified_quantity,
            unqualified_quantity: detail.unqualified_quantity,
            remarks: detail.remarks,
          });
        }, 100);
      } catch (error) {
        messageApi.error('获取返工单详情失败');
      }
    } else {
      messageApi.warning('请选择一条返工单进行编辑');
    }
  };

  /**
   * 处理删除（从选中行）
   */
  const handleDeleteFromSelection = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的返工单');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${keys.length} 个返工单吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          for (const key of keys) {
            await reworkOrderApi.delete(key.toString());
          }
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  return (
    <ListPageTemplate>
      <UniTable<ReworkOrder>
        headerTitle="返工单"
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        showCreateButton={true}
        onCreate={handleCreate}
        showEditButton={true}
        onEdit={handleEditFromSelection}
        showDeleteButton={true}
        onDelete={handleDeleteFromSelection}
        showAdvancedSearch={true}
      />
      {/* 表单Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑返工单' : '新建返工单'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onFinish={handleSubmitForm}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <CodeField
          pageCode="kuaizhizao-production-rework-order"
          name="code"
          label="返工单编码"
          required={true}
          autoGenerateOnCreate={!isEdit}
          context={{}}
        />
        <ProFormText
          name="original_work_order_uuid"
          label="原工单UUID"
          placeholder="请输入原工单UUID"
          rules={[{ required: false }]}
        />
        <ProFormText
          name="product_id"
          label="产品ID"
          placeholder="请输入产品ID"
          rules={[{ required: true, message: '请输入产品ID' }]}
        />
        <ProFormText
          name="product_code"
          label="产品编码"
          placeholder="请输入产品编码"
          rules={[{ required: true, message: '请输入产品编码' }]}
        />
        <ProFormText
          name="product_name"
          label="产品名称"
          placeholder="请输入产品名称"
          rules={[{ required: true, message: '请输入产品名称' }]}
        />
        <ProFormDigit
          name="quantity"
          label="返工数量"
          placeholder="请输入返工数量"
          rules={[{ required: true, message: '请输入返工数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormSelect
          name="rework_type"
          label="返工类型"
          placeholder="请选择返工类型"
          rules={[{ required: true, message: '请选择返工类型' }]}
          options={[
            { label: '返工', value: '返工' },
            { label: '返修', value: '返修' },
            { label: '报废', value: '报废' },
          ]}
        />
        <ProFormTextArea
          name="rework_reason"
          label="返工原因"
          placeholder="请输入返工原因"
          rules={[{ required: true, message: '请输入返工原因' }]}
          fieldProps={{ rows: 3 }}
        />
        <ProFormSelect
          name="status"
          label="状态"
          placeholder="请选择状态"
          initialValue="draft"
          options={[
            { label: '草稿', value: 'draft' },
            { label: '已下达', value: 'released' },
            { label: '执行中', value: 'in_progress' },
            { label: '已完成', value: 'completed' },
            { label: '已取消', value: 'cancelled' },
          ]}
        />
        <ProFormDatePicker
          name="planned_start_date"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDatePicker
          name="planned_end_date"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ showTime: true }}
        />
        <ProFormDigit
          name="completed_quantity"
          label="已完成数量"
          placeholder="请输入已完成数量"
          initialValue={0}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="qualified_quantity"
          label="合格数量"
          placeholder="请输入合格数量"
          initialValue={0}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="unqualified_quantity"
          label="不合格数量"
          placeholder="请输入不合格数量"
          initialValue={0}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="返工单详情"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        dataSource={reworkOrderDetail}
        columns={detailColumns}
        {...DRAWER_CONFIG}
      />
    </ListPageTemplate>
  );
};

export default ReworkOrdersPage;

