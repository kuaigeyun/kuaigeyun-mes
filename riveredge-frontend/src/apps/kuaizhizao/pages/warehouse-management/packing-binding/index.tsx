/**
 * 装箱打包绑定管理页面
 *
 * 提供装箱打包绑定记录的管理功能，包括查看、更新、删除等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDigit, ProFormTextArea, ProFormSelect } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, message, Popconfirm } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { packingBindingApi } from '../../../services/packing-binding';
import { materialApi } from '../../../../master-data/services/material';
import dayjs from 'dayjs';

interface PackingBinding {
  id?: number;
  uuid?: string;
  finished_goods_receipt_id?: number;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  product_serial_no?: string;
  packing_material_id?: number;
  packing_material_code?: string;
  packing_material_name?: string;
  packing_quantity?: number;
  box_no?: string;
  binding_method?: string;
  barcode?: string;
  bound_by?: number;
  bound_by_name?: string;
  bound_at?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const PackingBindingPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentBinding, setCurrentBinding] = useState<PackingBinding | null>(null);

  // 当前编辑的绑定记录ID
  const [currentBindingId, setCurrentBindingId] = useState<number | null>(null);

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: PackingBinding) => {
    try {
      const detail = await packingBindingApi.get(record.id!.toString());
      setCurrentBinding(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取装箱绑定记录详情失败');
    }
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (record: PackingBinding) => {
    try {
      setCurrentBindingId(record.id!);
      setEditModalVisible(true);
      const detail = await packingBindingApi.get(record.id!.toString());
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        packing_quantity: detail.packing_quantity,
        box_no: detail.box_no,
        remarks: detail.remarks,
      });
    } catch (error: any) {
      messageApi.error(error.message || '获取装箱绑定记录详情失败');
    }
  };

  /**
   * 处理提交编辑
   */
  const handleEditSubmit = async (values: any) => {
    try {
      if (!currentBindingId) {
        messageApi.error('装箱绑定记录ID不存在');
        return;
      }

      await packingBindingApi.update(currentBindingId.toString(), {
        packing_quantity: values.packing_quantity,
        box_no: values.box_no,
        remarks: values.remarks,
      });
      messageApi.success('装箱绑定记录更新成功');
      setEditModalVisible(false);
      setCurrentBindingId(null);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '更新装箱绑定记录失败');
      throw error;
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: PackingBinding) => {
    try {
      await packingBindingApi.delete(record.id!.toString());
      messageApi.success('装箱绑定记录删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除装箱绑定记录失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<PackingBinding>[] = [
    {
      title: '箱号',
      dataIndex: 'box_no',
      width: 150,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '产品编码',
      dataIndex: 'product_code',
      width: 120,
      ellipsis: true,
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '产品序列号',
      dataIndex: 'product_serial_no',
      width: 150,
      ellipsis: true,
    },
    {
      title: '装箱数量',
      dataIndex: 'packing_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '包装物料',
      dataIndex: 'packing_material_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '绑定方式',
      dataIndex: 'binding_method',
      width: 100,
      valueEnum: {
        scan: { text: '扫码', status: 'success' },
        manual: { text: '手动', status: 'default' },
      },
    },
    {
      title: '绑定人',
      dataIndex: 'bound_by_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '绑定时间',
      dataIndex: 'bound_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
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
          <Popconfirm
            title="确定要删除这个装箱绑定记录吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
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
    <ListPageTemplate>
      <UniTable
        headerTitle="装箱打包绑定管理"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params) => {
          try {
            const result = await packingBindingApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              receipt_id: params.receipt_id,
              product_id: params.product_id,
              box_no: params.box_no,
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />

      {/* 编辑Modal */}
      <FormModalTemplate
        title="编辑装箱绑定记录"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setCurrentBindingId(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleEditSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <ProFormDigit
          name="packing_quantity"
          label="装箱数量"
          placeholder="请输入装箱数量"
          rules={[{ required: true, message: '请输入装箱数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormText
          name="box_no"
          label="箱号"
          placeholder="请输入箱号（留空则自动生成）"
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
        title="装箱绑定记录详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentBinding(null);
        }}
        dataSource={currentBinding || {}}
        columns={[
          {
            title: '箱号',
            dataIndex: 'box_no',
          },
          {
            title: '产品编码',
            dataIndex: 'product_code',
          },
          {
            title: '产品名称',
            dataIndex: 'product_name',
          },
          {
            title: '产品序列号',
            dataIndex: 'product_serial_no',
          },
          {
            title: '装箱数量',
            dataIndex: 'packing_quantity',
          },
          {
            title: '包装物料编码',
            dataIndex: 'packing_material_code',
          },
          {
            title: '包装物料名称',
            dataIndex: 'packing_material_name',
          },
          {
            title: '绑定方式',
            dataIndex: 'binding_method',
            valueEnum: {
              scan: { text: '扫码', status: 'success' },
              manual: { text: '手动', status: 'default' },
            },
          },
          {
            title: '条码',
            dataIndex: 'barcode',
          },
          {
            title: '绑定人',
            dataIndex: 'bound_by_name',
          },
          {
            title: '绑定时间',
            dataIndex: 'bound_at',
            valueType: 'dateTime',
          },
          {
            title: '备注',
            dataIndex: 'remarks',
          },
        ]}
      />
    </ListPageTemplate>
  );
};

export default PackingBindingPage;
