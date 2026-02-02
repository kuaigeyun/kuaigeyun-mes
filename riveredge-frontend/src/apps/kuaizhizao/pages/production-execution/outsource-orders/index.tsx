/**
 * 工序委外管理页面
 *
 * 提供工序委外的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持从工单工序创建工序委外单。
 *
 * Author: Luigi Lu
 * Date: 2025-01-04
 * Updated: 2026-01-20（重命名为工序委外）
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemType, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { outsourceOrderApi } from '../../../services/production';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import dayjs from 'dayjs';

interface OutsourceOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  work_order_id?: number;
  work_order_code?: string;
  work_order_operation_id?: number;
  operation_id?: number;
  operation_code?: string;
  operation_name?: string;
  supplier_id?: number;
  supplier_code?: string;
  supplier_name?: string;
  outsource_quantity?: number;
  received_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

interface Supplier {
  id: number;
  uuid: string;
  code: string;
  name: string;
  isActive: boolean;
}

export const OutsourceOrdersTable: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentOutsourceOrder, setCurrentOutsourceOrder] = useState<OutsourceOrder | null>(null);
  const formRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [outsourceOrderDetail, setOutsourceOrderDetail] = useState<OutsourceOrder | null>(null);

  // 供应商列表
  const [supplierList, setSupplierList] = useState<Supplier[]>([]);

  /**
   * 加载供应商列表
   */
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const suppliers = await supplierApi.list({ isActive: true });
        setSupplierList(suppliers || []);
      } catch (error) {
        console.error('加载供应商列表失败:', error);
      }
    };
    loadSuppliers();
  }, []);

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemType<OutsourceOrder>[] = [
    {
      title: '工序委外单编码',
      dataIndex: 'code',
    },
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
    },
    {
      title: '工序名称',
      dataIndex: 'operation_name',
    },
    {
      title: '供应商名称',
      dataIndex: 'supplier_name',
    },
    {
      title: '委外数量',
      dataIndex: 'outsource_quantity',
      valueType: 'digit',
    },
    {
      title: '已接收数量',
      dataIndex: 'received_quantity',
      valueType: 'digit',
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      valueType: 'digit',
    },
    {
      title: '不合格数量',
      dataIndex: 'unqualified_quantity',
      valueType: 'digit',
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      valueType: 'money',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      valueType: 'money',
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
      title: '采购入库单编码',
      dataIndex: 'purchase_receipt_code',
      render: (text) => text || '-',
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
  const columns: ProColumns<OutsourceOrder>[] = [
    {
      title: '工序委外单编码',
      dataIndex: 'code',
      width: 180,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '工单编码',
      dataIndex: 'work_order_code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工序名称',
      dataIndex: 'operation_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '供应商名称',
      dataIndex: 'supplier_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工序委外数量',
      dataIndex: 'outsource_quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '已接收数量',
      dataIndex: 'received_quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '合格数量',
      dataIndex: 'qualified_quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      width: 100,
      valueType: 'money',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 120,
      valueType: 'money',
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
          onClick={() => handleEditFromRecord(record)}
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
          onClick={() => handleDeleteFromRecord(record)}
          disabled={record.status === 'completed' || record.status === 'in_progress'}
        >
          删除
        </Button>,
      ],
    },
  ];

  /**
   * 处理详情查看
   */
  const handleDetail = async (record: OutsourceOrder) => {
    try {
      const detail = await outsourceOrderApi.get(record.id!.toString());
      setOutsourceOrderDetail(detail);
      setDetailDrawerVisible(true);
    } catch (error) {
      messageApi.error('获取工序委外单详情失败');
    }
  };

  /**
   * 处理编辑（从选中行）
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const detail = await outsourceOrderApi.get(id.toString());
        setIsEdit(true);
        setCurrentOutsourceOrder(detail);
        setModalVisible(true);
        setTimeout(() => {
          formRef.current?.setFieldsValue({
            supplier_id: detail.supplier_id,
            outsource_quantity: detail.outsource_quantity,
            unit_price: detail.unit_price,
            status: detail.status,
            planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : undefined,
            planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : undefined,
            received_quantity: detail.received_quantity,
            qualified_quantity: detail.qualified_quantity,
            unqualified_quantity: detail.unqualified_quantity,
            remarks: detail.remarks,
          });
        }, 100);
      } catch (error) {
        messageApi.error('获取工序委外单详情失败');
      }
    } else {
      messageApi.warning('请选择一条工序委外进行编辑');
    }
  };

  /**
   * 处理删除（从选中行）
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的工序委外');
      return;
    }

    const ids = keys.map(k => Number(k));
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${ids.length} 条工序委外吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.all(ids.map(id => outsourceOrderApi.delete(id.toString())));
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  /**
   * 处理编辑（从记录）
   */
  const handleEditFromRecord = async (record: OutsourceOrder) => {
    try {
      const detail = await outsourceOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentOutsourceOrder(detail);
      setModalVisible(true);
      setTimeout(() => {
        formRef.current?.setFieldsValue({
          supplier_id: detail.supplier_id,
          outsource_quantity: detail.outsource_quantity,
          unit_price: detail.unit_price,
          status: detail.status,
          planned_start_date: detail.planned_start_date ? dayjs(detail.planned_start_date) : undefined,
          planned_end_date: detail.planned_end_date ? dayjs(detail.planned_end_date) : undefined,
          received_quantity: detail.received_quantity,
          qualified_quantity: detail.qualified_quantity,
          unqualified_quantity: detail.unqualified_quantity,
          remarks: detail.remarks,
        });
      }, 100);
    } catch (error) {
      messageApi.error('获取工序委外单详情失败');
    }
  };

  /**
   * 处理删除（从记录）
   */
  const handleDeleteFromRecord = async (record: OutsourceOrder) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除工序委外单 "${record.code}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await outsourceOrderApi.delete(record.id!.toString());
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
    setCurrentOutsourceOrder(null);
    setModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      const submitData = {
        ...values,
        planned_start_date: values.planned_start_date ? values.planned_start_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
        planned_end_date: values.planned_end_date ? values.planned_end_date.format('YYYY-MM-DD HH:mm:ss') : undefined,
      };

      if (isEdit && currentOutsourceOrder?.id) {
        await outsourceOrderApi.update(currentOutsourceOrder.id.toString(), submitData);
        messageApi.success('工序委外单更新成功');
      } else {
        // 新建委外单需要更多字段，这里需要从工单创建，所以这里暂时不支持直接创建
        messageApi.warning('请从工单详情页创建工序委外单');
        throw new Error('请从工单详情页创建工序委外单');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理请求
   */
  const handleRequest = async (params: any, sorter: any, filter: any) => {
    try {
      const response = await outsourceOrderApi.list({
        skip: (params.current! - 1) * params.pageSize!,
        limit: params.pageSize,
        ...params,
      });
      return {
        data: response || [],
        success: true,
        total: response?.length || 0,
      };
    } catch (error) {
      messageApi.error('获取工序委外单列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  return (
    <>
      <UniTable<OutsourceOrder>
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        showCreateButton={false}
        onCreate={handleCreate}
        showEditButton={true}
        onEdit={handleEdit}
        showDeleteButton={true}
        onDelete={handleDelete}
        showAdvancedSearch={true}
        toolBarRender={() => [
          <Button
            key="create-outsource-order"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
            disabled={true}
          >
            新建工序委外
          </Button>,
        ]}
      />
      {/* 表单Modal（主要用于编辑） */}
      {isEdit && (
        <FormModalTemplate
          title="编辑工序委外"
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          onFinish={handleSubmitForm}
          formRef={formRef}
          {...MODAL_CONFIG}
        >
          <CodeField
            pageCode="kuaizhizao-production-outsource-order"
            name="code"
            label="工序委外单编码"
            required={true}
            autoGenerateOnCreate={!isEdit}
            context={{}}
            disabled={isEdit}
          />
          <ProFormSelect
            name="supplier_id"
            label="供应商"
            placeholder="请选择供应商"
            rules={[{ required: true, message: '请选择供应商' }]}
            options={supplierList.map(s => ({
              label: `${s.code} - ${s.name}`,
              value: s.id,
            }))}
            fieldProps={{
              showSearch: true,
              filterOption: (input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
            }}
          />
          <ProFormDigit
            name="outsource_quantity"
            label="工序委外数量"
            placeholder="请输入工序委外数量"
            rules={[{ required: true, message: '请输入工序委外数量' }]}
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormDigit
            name="unit_price"
            label="单价"
            placeholder="请输入单价"
            min={0}
            fieldProps={{ precision: 2 }}
          />
          <ProFormSelect
            name="status"
            label="状态"
            placeholder="请选择状态"
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
            name="received_quantity"
            label="已接收数量"
            placeholder="请输入已接收数量"
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
      )}

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title="工序委外详情"
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        dataSource={outsourceOrderDetail}
        columns={detailColumns}
        {...DRAWER_CONFIG}
      />
    </>
  );
};

const OutsourceOrdersPage: React.FC = () => {
  return (
    <ListPageTemplate>
      <OutsourceOrdersTable />
    </ListPageTemplate>
  );
};

export default OutsourceOrdersPage;

