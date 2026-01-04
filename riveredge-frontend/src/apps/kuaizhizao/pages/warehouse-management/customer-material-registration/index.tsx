/**
 * 客户来料登记页面
 *
 * 提供客户来料登记功能，支持扫码登记、手动登记、条码映射等。
 *
 * @author Luigi Lu
 * @date 2025-01-15
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormDigit, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Tag, Button, Space, Modal, message, Card } from 'antd';
import { EyeOutlined, QrcodeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';

/**
 * 客户来料登记接口定义
 */
interface CustomerMaterialRegistration {
  id?: number;
  registration_code?: string;
  customer_id?: number;
  customer_name?: string;
  barcode?: string;
  barcode_type?: string;
  quantity?: number;
  registration_date?: string;
  status?: string;
  mapped_material_code?: string;
  mapped_material_name?: string;
  registered_by_name?: string;
  created_at?: string;
}

/**
 * 客户来料登记页面组件
 */
const CustomerMaterialRegistrationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  // Modal 相关状态
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);

  // Drawer 相关状态（详情查看）
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<CustomerMaterialRegistration | null>(null);

  /**
   * 处理扫码登记
   */
  const handleScan = () => {
    setScanModalVisible(true);
    setParsedData(null);
    formRef.current?.resetFields();
  };

  /**
   * 处理手动登记
   */
  const handleManual = () => {
    setManualModalVisible(true);
    formRef.current?.resetFields();
  };

  /**
   * 处理条码解析
   */
  const handleParseBarcode = async (barcode: string, barcodeType: string, customerId?: number) => {
    try {
      const result = await warehouseApi.customerMaterialRegistration.parseBarcode({
        barcode,
        barcode_type: barcodeType,
        customer_id: customerId,
      });
      setParsedData(result);
      // 自动填充表单
      if (result.mapped_material_id) {
        formRef.current?.setFieldsValue({
          mapped_material_id: result.mapped_material_id,
          mapped_material_code: result.mapped_material_code,
          mapped_material_name: result.mapped_material_name,
        });
      }
      messageApi.success('条码解析成功');
    } catch (error: any) {
      messageApi.error(error.message || '条码解析失败');
    }
  };

  /**
   * 处理创建登记
   */
  const handleCreateRegistration = async (values: any) => {
    try {
      setFormLoading(true);
      await warehouseApi.customerMaterialRegistration.create({
        ...values,
        registration_date: values.registration_date || new Date().toISOString(),
      });
      messageApi.success('登记成功');
      setScanModalVisible(false);
      setManualModalVisible(false);
      formRef.current?.resetFields();
      setParsedData(null);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '登记失败');
      throw error;
    } finally {
      setFormLoading(false);
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: CustomerMaterialRegistration) => {
    try {
      if (record.id) {
        const detailData = await warehouseApi.customerMaterialRegistration.get(record.id.toString());
        setCurrentRecord(detailData);
        setDetailDrawerVisible(true);
      }
    } catch (error) {
      messageApi.error('获取登记详情失败');
    }
  };

  /**
   * 表格列定义
   */
  const columns: ProColumns<CustomerMaterialRegistration>[] = [
    {
      title: '登记编码',
      dataIndex: 'registration_code',
      width: 140,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: '客户条码',
      dataIndex: 'barcode',
      width: 150,
      ellipsis: true,
    },
    {
      title: '条码类型',
      dataIndex: 'barcode_type',
      width: 100,
      render: (_, record) => (
        <Tag color={record.barcode_type === '2d' ? 'blue' : 'default'}>
          {record.barcode_type === '2d' ? '二维码' : '一维码'}
        </Tag>
      ),
    },
    {
      title: '映射物料编码',
      dataIndex: 'mapped_material_code',
      width: 120,
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
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending: { text: '待处理', status: 'default' },
        processed: { text: '已处理', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '登记日期',
      dataIndex: 'registration_date',
      valueType: 'date',
      width: 120,
    },
    {
      title: '登记人',
      dataIndex: 'registered_by_name',
      width: 100,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '操作',
      width: 120,
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
        request={async (params) => {
          try {
            const result = await warehouseApi.customerMaterialRegistration.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
            });
            return {
              data: result || [],
              success: true,
              total: result?.length || 0,
            };
          } catch (error) {
            messageApi.error('获取登记列表失败');
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        toolBarRender={() => [
          <Button
            key="scan"
            type="primary"
            icon={<QrcodeOutlined />}
            onClick={handleScan}
          >
            扫码登记
          </Button>,
          <Button
            key="create"
            type="default"
            icon={<PlusOutlined />}
            onClick={handleManual}
          >
            手动登记
          </Button>,
        ]}
      />

      {/* 扫码登记 Modal */}
      <FormModalTemplate
        title="扫码登记"
        open={scanModalVisible}
        onClose={() => {
          setScanModalVisible(false);
          setParsedData(null);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateRegistration}
        isEdit={false}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        layout="vertical"
        grid={true}
      >
        <ProFormSelect
          name="customer_id"
          label="客户"
          placeholder="请选择客户"
          rules={[{ required: true, message: '请选择客户' }]}
          request={async () => {
            try {
              const customers = await customerApi.list();
              return customers.map(c => ({ label: c.name, value: c.id }));
            } catch {
              return [];
            }
          }}
          fieldProps={{
            onChange: (value) => {
              // 客户变更时清空条码解析结果
              setParsedData(null);
            },
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="barcode_type"
          label="条码类型"
          placeholder="请选择条码类型"
          rules={[{ required: true, message: '请选择条码类型' }]}
          options={[
            { label: '一维码', value: '1d' },
            { label: '二维码', value: '2d' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="barcode"
          label="客户条码"
          placeholder="请扫描或输入客户条码"
          rules={[{ required: true, message: '请输入客户条码' }]}
          fieldProps={{
            onPressEnter: async (e) => {
              const barcode = e.currentTarget.value;
              const customerId = formRef.current?.getFieldValue('customer_id');
              const barcodeType = formRef.current?.getFieldValue('barcode_type') || '1d';
              if (barcode && barcodeType) {
                await handleParseBarcode(barcode, barcodeType, customerId);
              }
            },
          }}
          colProps={{ span: 24 }}
        />
        {parsedData && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <p><strong>解析结果：</strong></p>
            {parsedData.mapped_material_code && (
              <>
                <p>映射物料编码：{parsedData.mapped_material_code}</p>
                <p>映射物料名称：{parsedData.mapped_material_name}</p>
              </>
            )}
            {!parsedData.mapped_material_code && (
              <p style={{ color: '#ff4d4f' }}>未找到匹配的映射规则，请手动选择物料</p>
            )}
          </Card>
        )}
        <ProFormSelect
          name="mapped_material_id"
          label="物料"
          placeholder="请选择物料（条码解析后自动填充）"
          rules={[{ required: true, message: '请选择物料' }]}
          request={async (params) => {
            try {
              const materials = await materialApi.list({
                skip: 0,
                limit: 100,
                isActive: true,
                keyword: params.keyWords,
              });
              return materials.map(m => ({
                label: `${m.code} - ${m.name}`,
                value: m.id,
              }));
            } catch {
              return [];
            }
          }}
          fieldProps={{
            showSearch: true,
            filterOption: false,
          }}
          colProps={{ span: 24 }}
        />
        <ProFormDigit
          name="quantity"
          label="来料数量"
          placeholder="请输入来料数量"
          rules={[{ required: true, message: '请输入来料数量' }]}
          fieldProps={{ min: 0, precision: 2 }}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="registration_date"
          label="登记日期"
          placeholder="请选择登记日期"
          rules={[{ required: true, message: '请选择登记日期' }]}
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="warehouse_id"
          label="入库仓库"
          placeholder="请选择入库仓库（可选）"
          request={async (params) => {
            try {
              const warehouses = await masterDataWarehouseApi.list({
                skip: 0,
                limit: 100,
                isActive: true,
              });
              return warehouses.map(w => ({
                label: `${w.code} - ${w.name}`,
                value: w.id,
              }));
            } catch {
              return [];
            }
          }}
          fieldProps={{
            showSearch: true,
            filterOption: false,
          }}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 手动登记 Modal */}
      <FormModalTemplate
        title="手动登记"
        open={manualModalVisible}
        onClose={() => {
          setManualModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateRegistration}
        isEdit={false}
        loading={formLoading}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        layout="vertical"
        grid={true}
      >
        <ProFormSelect
          name="customer_id"
          label="客户"
          placeholder="请选择客户"
          rules={[{ required: true, message: '请选择客户' }]}
          request={async () => {
            try {
              const customers = await customerApi.list();
              return customers.map(c => ({ label: c.name, value: c.id }));
            } catch {
              return [];
            }
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="barcode_type"
          label="条码类型"
          placeholder="请选择条码类型"
          rules={[{ required: true, message: '请选择条码类型' }]}
          options={[
            { label: '一维码', value: '1d' },
            { label: '二维码', value: '2d' },
          ]}
          colProps={{ span: 12 }}
        />
        <ProFormText
          name="barcode"
          label="客户条码"
          placeholder="请输入客户条码"
          rules={[{ required: true, message: '请输入客户条码' }]}
          colProps={{ span: 24 }}
        />
        <ProFormSelect
          name="mapped_material_id"
          label="物料"
          placeholder="请选择物料"
          rules={[{ required: true, message: '请选择物料' }]}
          request={async (params) => {
            try {
              const materials = await materialApi.list({
                skip: 0,
                limit: 100,
                isActive: true,
                keyword: params.keyWords,
              });
              return materials.map(m => ({
                label: `${m.code} - ${m.name}`,
                value: m.id,
              }));
            } catch {
              return [];
            }
          }}
          fieldProps={{
            showSearch: true,
            filterOption: false,
          }}
          colProps={{ span: 24 }}
        />
        <ProFormDigit
          name="quantity"
          label="来料数量"
          placeholder="请输入来料数量"
          rules={[{ required: true, message: '请输入来料数量' }]}
          fieldProps={{ min: 0, precision: 2 }}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="registration_date"
          label="登记日期"
          placeholder="请选择登记日期"
          rules={[{ required: true, message: '请选择登记日期' }]}
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="warehouse_id"
          label="入库仓库"
          placeholder="请选择入库仓库（可选）"
          request={async (params) => {
            try {
              const warehouses = await masterDataWarehouseApi.list({
                skip: 0,
                limit: 100,
                isActive: true,
              });
              return warehouses.map(w => ({
                label: `${w.code} - ${w.name}`,
                value: w.id,
              }));
            } catch {
              return [];
            }
          }}
          fieldProps={{
            showSearch: true,
            filterOption: false,
          }}
          colProps={{ span: 12 }}
        />
        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注"
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={`登记详情 - ${currentRecord?.registration_code || ''}`}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={[]}
        customContent={
          currentRecord ? (
            <div style={{ padding: '16px 0' }}>
              <p><strong>登记编码：</strong>{currentRecord.registration_code}</p>
              <p><strong>客户名称：</strong>{currentRecord.customer_name}</p>
              <p><strong>客户条码：</strong>{currentRecord.barcode}</p>
              <p><strong>条码类型：</strong>
                <Tag color={currentRecord.barcode_type === '2d' ? 'blue' : 'default'}>
                  {currentRecord.barcode_type === '2d' ? '二维码' : '一维码'}
                </Tag>
              </p>
              <p><strong>映射物料编码：</strong>{currentRecord.mapped_material_code || '-'}</p>
              <p><strong>映射物料名称：</strong>{currentRecord.mapped_material_name || '-'}</p>
              <p><strong>来料数量：</strong>{currentRecord.quantity}</p>
              <p><strong>状态：</strong>
                <Tag color={
                  currentRecord.status === 'processed' ? 'success' :
                  currentRecord.status === 'cancelled' ? 'error' : 'default'
                }>
                  {currentRecord.status === 'processed' ? '已处理' :
                   currentRecord.status === 'cancelled' ? '已取消' : '待处理'}
                </Tag>
              </p>
              <p><strong>登记日期：</strong>{currentRecord.registration_date}</p>
              <p><strong>登记人：</strong>{currentRecord.registered_by_name}</p>
            </div>
          ) : null
        }
      />
    </ListPageTemplate>
  );
};

export default CustomerMaterialRegistrationPage;

