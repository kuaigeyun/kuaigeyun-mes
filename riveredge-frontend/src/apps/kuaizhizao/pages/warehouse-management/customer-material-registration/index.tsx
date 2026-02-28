/**
 * 客户来料登记管理页面
 *
 * 提供客户来料登记的管理功能，包括登记、查看、处理、取消等。
 *
 * Author: Luigi Lu
 * Date: 2026-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormText, ProFormDigit, ProFormTextArea, ProFormSelect, ProFormDatePicker } from '@ant-design/pro-components';
import { App, Button, Space, Popconfirm } from 'antd';
import { EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ScanOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import dayjs from 'dayjs';

interface CustomerMaterialRegistration {
  id?: number;
  uuid?: string;
  registration_code?: string;
  customer_id?: number;
  customer_name?: string;
  barcode?: string;
  barcode_type?: string;
  parsed_data?: any;
  mapped_material_id?: number;
  mapped_material_code?: string;
  mapped_material_name?: string;
  mapping_rule_id?: number;
  quantity?: number;
  registration_date?: string;
  registered_by?: number;
  registered_by_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  status?: string;
  processed_at?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

const CustomerMaterialRegistrationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Modal 相关状态
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRegistration, setCurrentRegistration] = useState<CustomerMaterialRegistration | null>(null);

  // 扫码解析状态
  const [scanning, setScanning] = useState(false);

  /**
   * 处理新建登记
   */
  const handleCreate = () => {
    setCreateModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      registration_date: dayjs(),
      barcode_type: '1d',
    });
  };

  /**
   * 处理扫码解析
   */
  const handleScanBarcode = async (barcode: string, customerId?: number) => {
    try {
      setScanning(true);
      const result = await customerMaterialRegistrationApi.parseBarcode({
        barcode,
        barcode_type: formRef.current?.getFieldValue('barcode_type') || '1d',
        customer_id: customerId || formRef.current?.getFieldValue('customer_id'),
      });

      // 自动填充解析结果
      if (result.mapped_material_id) {
        formRef.current?.setFieldsValue({
          mapped_material_id: result.mapped_material_id,
          mapped_material_code: result.mapped_material_code,
          mapped_material_name: result.mapped_material_name,
        });
      }

      messageApi.success('条码解析成功');
    } catch (error: any) {
      messageApi.warning(error.message || '条码解析失败，请手动填写物料信息');
    } finally {
      setScanning(false);
    }
  };

  /**
   * 处理条码输入变化
   */
  const handleBarcodeChange = (value: string) => {
    if (value && value.length > 5) {
      // 自动触发解析
      handleScanBarcode(value);
    }
  };

  /**
   * 处理提交新建
   */
  const handleCreateSubmit = async (values: any) => {
    try {
      await customerMaterialRegistrationApi.create({
        customer_id: values.customer_id,
        customer_name: values.customer_name,
        barcode: values.barcode,
        barcode_type: values.barcode_type || '1d',
        quantity: values.quantity,
        registration_date: values.registration_date?.format('YYYY-MM-DD HH:mm:ss'),
        warehouse_id: values.warehouse_id,
        warehouse_name: values.warehouse_name,
        remarks: values.remarks,
      });
      messageApi.success('客户来料登记成功');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '客户来料登记失败');
      throw error;
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: CustomerMaterialRegistration) => {
    try {
      const detail = await customerMaterialRegistrationApi.get(record.id!.toString());
      setCurrentRegistration(detail);
      setDetailDrawerVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || '获取客户来料登记详情失败');
    }
  };

  /**
   * 处理入库
   */
  const handleProcess = async (record: CustomerMaterialRegistration) => {
    try {
      await customerMaterialRegistrationApi.process(record.id!.toString());
      messageApi.success('客户来料登记已处理（入库）');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '处理客户来料登记失败');
    }
  };

  /**
   * 处理取消
   */
  const handleCancel = async (record: CustomerMaterialRegistration) => {
    try {
      await customerMaterialRegistrationApi.cancel(record.id!.toString());
      messageApi.success('客户来料登记已取消');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '取消客户来料登记失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CustomerMaterialRegistration>[] = [
    {
      title: '登记编码',
      dataIndex: 'registration_code',
      width: 150,
      ellipsis: true,
      fixed: 'left',
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '条码',
      dataIndex: 'barcode',
      width: 150,
      ellipsis: true,
    },
    {
      title: '映射物料编码',
      dataIndex: 'mapped_material_code',
      width: 150,
      ellipsis: true,
    },
    {
      title: '映射物料名称',
      dataIndex: 'mapped_material_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '来料数量',
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
    },
    {
      title: '登记日期',
      dataIndex: 'registration_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'warning' },
        processed: { text: '已处理', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '登记人',
      dataIndex: 'registered_by_name',
      width: 100,
      ellipsis: true,
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
            onClick={() => handleDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Popconfirm
                title="确定要处理（入库）这个客户来料登记吗？"
                onConfirm={() => handleProcess(record)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                >
                  处理
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定要取消这个客户来料登记吗？"
                onConfirm={() => handleCancel(record)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                >
                  取消
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="客户来料登记"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        showCreateButton={true}
        createButtonText="新建客户来料登记"
        onCreate={handleCreate}
        request={async (params: any) => {
          try {
            const result = await customerMaterialRegistrationApi.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              customer_id: params.customer_id,
              status: params.status,
              registration_date_start: params.registration_date_start,
              registration_date_end: params.registration_date_end,
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

      {/* 新建Modal */}
      <FormModalTemplate
        title="客户来料登记"
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        {...MODAL_CONFIG}
      >
        <ProFormText
          name="customer_id"
          label="客户ID"
          placeholder="请输入客户ID"
          rules={[{ required: true, message: '请输入客户ID' }]}
        />
        <ProFormText
          name="customer_name"
          label="客户名称"
          placeholder="请输入客户名称"
          rules={[{ required: true, message: '请输入客户名称' }]}
        />
        <ProFormText
          name="barcode"
          label="客户条码"
          placeholder="请扫描或输入客户条码（一维码或二维码）"
          rules={[{ required: true, message: '请输入客户条码' }]}
          fieldProps={{
            onBlur: (e: any) => {
              if (e.target.value) {
                handleBarcodeChange(e.target.value);
              }
            },
            suffix: scanning ? <ScanOutlined spin /> : null,
          }}
        />
        <ProFormSelect
          name="barcode_type"
          label="条码类型"
          options={[
            { label: '一维码', value: '1d' },
            { label: '二维码', value: '2d' },
          ]}
          rules={[{ required: true, message: '请选择条码类型' }]}
        />
        <ProFormText
          name="mapped_material_code"
          label="映射物料编码"
          placeholder="条码解析后自动填充"
          disabled
        />
        <ProFormText
          name="mapped_material_name"
          label="映射物料名称"
          placeholder="条码解析后自动填充"
          disabled
        />
        <ProFormDigit
          name="quantity"
          label="来料数量"
          placeholder="请输入来料数量"
          rules={[{ required: true, message: '请输入来料数量' }]}
          min={0}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDatePicker
          name="registration_date"
          label="登记日期"
          placeholder="请选择登记日期"
          rules={[{ required: true, message: '请选择登记日期' }]}
          fieldProps={{ showTime: true }}
        />
        <ProFormText
          name="warehouse_id"
          label="入库仓库ID"
          placeholder="请输入入库仓库ID（可选）"
        />
        <ProFormText
          name="warehouse_name"
          label="入库仓库名称"
          placeholder="请输入入库仓库名称（可选）"
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
        title="客户来料登记详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRegistration(null);
        }}
        dataSource={currentRegistration || {}}
        columns={[
          {
            title: '登记编码',
            dataIndex: 'registration_code',
          },
          {
            title: '客户名称',
            dataIndex: 'customer_name',
          },
          {
            title: '条码',
            dataIndex: 'barcode',
          },
          {
            title: '条码类型',
            dataIndex: 'barcode_type',
            valueEnum: {
              '1d': { text: '一维码' },
              '2d': { text: '二维码' },
            },
          },
          {
            title: '映射物料编码',
            dataIndex: 'mapped_material_code',
          },
          {
            title: '映射物料名称',
            dataIndex: 'mapped_material_name',
          },
          {
            title: '来料数量',
            dataIndex: 'quantity',
          },
          {
            title: '登记日期',
            dataIndex: 'registration_date',
            valueType: 'dateTime',
          },
          {
            title: '入库仓库',
            dataIndex: 'warehouse_name',
          },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              pending: { text: '待处理', status: 'warning' },
              processed: { text: '已处理', status: 'success' },
              cancelled: { text: '已取消', status: 'error' },
            },
          },
          {
            title: '处理时间',
            dataIndex: 'processed_at',
            valueType: 'dateTime',
          },
          {
            title: '登记人',
            dataIndex: 'registered_by_name',
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

export default CustomerMaterialRegistrationPage;
