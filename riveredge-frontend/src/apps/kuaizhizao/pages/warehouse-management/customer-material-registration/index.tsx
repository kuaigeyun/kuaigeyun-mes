/**
 * 代工来料管理页面
 *
 * 支持普通登记与扫码登记，确认后写入客供库存。
 */

import React, { useCallback, useRef, useState } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import {
  ActionType,
  ProColumns,
  ProFormText,
  ProFormDigit,
  ProFormTextArea,
  ProFormSelect,
  ProFormDatePicker,
  ProForm,
} from '@ant-design/pro-components';
import { App, Button, Space, Popconfirm, Row, Col, Typography, Segmented, Input, InputNumber, Form as AntForm } from 'antd';
import { EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ScanOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { customerMaterialRegistrationApi } from '../../../services/customer-material-registration';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getCustomerMaterialRegistrationLifecycle } from '../../../utils/customerMaterialRegistrationLifecycle';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { CustomerSelectDropdown } from '../../../../master-data/components/CustomerSelectDropdown';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import dayjs from 'dayjs';
import { coerceFormDate } from '../../../../../utils/formDate';

interface RegistrationItem {
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  quantity?: number;
  barcode?: string;
  batch_number?: string;
}

interface CustomerMaterialRegistration {
  id?: number;
  uuid?: string;
  registration_code?: string;
  customer_id?: number;
  customer_name?: string;
  barcode?: string;
  barcode_type?: string;
  mapped_material_id?: number;
  mapped_material_code?: string;
  mapped_material_name?: string;
  quantity?: number;
  total_quantity?: number;
  registration_date?: string;
  registered_by_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  status?: string;
  processed_at?: string;
  processed_by_name?: string;
  remarks?: string;
  items?: RegistrationItem[];
  created_at?: string;
  updated_at?: string;
}

const CustomerMaterialRegistrationPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [entryMode, setEntryMode] = useState<'scan' | 'document'>('document');
  const formRef = useRef<any>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentRegistration, setCurrentRegistration] = useState<CustomerMaterialRegistration | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [startProductionLoading, setStartProductionLoading] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const resourcePerms = useResourcePermissions('kuaizhizao:warehouse-management-customer-material-registration');
  const canStartProduction =
    !resourcePerms.enabled || (resourcePerms.canAction?.('execute') ?? false);

  const appendItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const isEmptyItemRow = (row: RegistrationItem | undefined) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const rowFromMaterial = (m: Material): RegistrationItem => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? '',
        quantity: 1,
      });
      const queue = selected.map(rowFromMaterial);
      const items = [...(formRef.current?.getFieldValue('items') ?? [])].map((row: RegistrationItem) => ({
        ...row,
      }));
      for (let i = 0; i < items.length && queue.length > 0; i++) {
        if (isEmptyItemRow(items[i])) {
          items[i] = queue.shift()!;
        }
      }
      while (queue.length > 0) {
        items.push(queue.shift()!);
      }
      formRef.current?.setFieldsValue({ items });
      setMaterialPickerOpen(false);
      messageApi.success(`已添加 ${selected.length} 条物料明细`);
    },
    [messageApi],
  );

  const buildCreatePayload = (values: any) => {
    if (!values.customer_id) {
      messageApi.error('请选择客户');
      throw new Error('no customer');
    }
    const payload: any = {
      customer_id: Number(values.customer_id),
      customer_name: values.customer_name || '',
      registration_date: coerceFormDate(values.registration_date)?.format('YYYY-MM-DD HH:mm:ss'),
      warehouse_id: values.warehouse_id,
      warehouse_name: values.warehouse_name,
      remarks: values.remarks,
    };

    if (entryMode === 'document') {
      const validItems = (values.items || []).filter(
        (it: RegistrationItem) => it.material_id && (it.quantity || 0) > 0
      );
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效明细');
        throw new Error('no items');
      }
      payload.items = validItems.map((it: RegistrationItem) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quantity: it.quantity,
        barcode: it.barcode,
        batch_number: it.batch_number,
      }));
    } else {
      if (!values.material_id) {
        messageApi.error('请选择来料物料，或快速新建物料');
        throw new Error('no material');
      }
      payload.barcode = values.barcode;
      payload.barcode_type = values.barcode_type || '1d';
      payload.quantity = values.quantity;
      payload.batch_number = values.batch_number;
      payload.material_id = values.material_id;
      payload.material_code = values.material_code;
      payload.material_name = values.material_name;
    }
    return payload;
  };

  const handleCreate = async () => {
    setCreateModalVisible(true);
    setEntryMode('document');
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({
      registration_date: dayjs(),
      barcode_type: '1d',
      items: [{ quantity: 1 }],
    });
  };

  const handleScanBarcode = async (barcode: string) => {
    try {
      setScanning(true);
      const result = await customerMaterialRegistrationApi.parseBarcode({
        barcode,
        barcode_type: formRef.current?.getFieldValue('barcode_type') || '1d',
        customer_id: formRef.current?.getFieldValue('customer_id'),
      });
      if (result.mapped_material_id) {
        formRef.current?.setFieldsValue({
          material_id: result.mapped_material_id,
          material_code: result.mapped_material_code,
          material_name: result.mapped_material_name,
        });
        messageApi.success('条码解析成功，已匹配内部物料');
      } else {
        messageApi.warning('未匹配到内部物料，请手动选择或快速新建物料');
      }
    } catch (error: any) {
      messageApi.warning(error.message || '条码解析失败，请手动填写物料信息');
    } finally {
      setScanning(false);
    }
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      setSubmitLoading(true);
      const payload = buildCreatePayload(values);
      const created = await customerMaterialRegistrationApi.create(payload);
      if (!created?.id) {
        throw new Error('客供料入库单创建失败');
      }
      await customerMaterialRegistrationApi.process(String(created.id));
      messageApi.success('客供料已确认入库');
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message !== 'no items' && error?.message !== 'no material' && error?.message !== 'no customer') {
        messageApi.error(error.message || '客供料入库失败');
      }
      throw error;
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleStartProduction = async () => {
    try {
      setStartProductionLoading(true);
      const values = await formRef.current?.validateFields();
      const payload = buildCreatePayload(values);
      const result = await customerMaterialRegistrationApi.createAndStartProduction(payload);
      const woLabel = result.work_order_group_code
        ? `组工单 ${result.work_order_group_code}`
        : (result.work_order_codes || []).join('、') || '—';
      const batchLabel = (result.batching_order_codes || []).join('、');
      messageApi.success(
        `已客供入库并开工：${result.registration?.registration_code || ''} → ${woLabel}${
          batchLabel ? `，配料单 ${batchLabel}` : ''
        }`
      );
      if (result.warnings?.length) {
        messageApi.warning(result.warnings.join('；'));
      }
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message !== 'no items' && error?.message !== 'no material' && error?.message !== 'no customer') {
        messageApi.error(error.message || '直接发料开工失败');
      }
    } finally {
      setStartProductionLoading(false);
    }
  };

  const handleDetail = async (record: CustomerMaterialRegistration) => {
    const detail = await customerMaterialRegistrationApi.get(record.id!.toString());
    setCurrentRegistration(detail);
    setDetailDrawerVisible(true);
  };

  const handleProcess = async (record: CustomerMaterialRegistration) => {
    try {
      await customerMaterialRegistrationApi.process(record.id!.toString());
      messageApi.success('代工来料已确认入库');
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '确认入库失败');
    }
  };

  const handleWithdraw = async (record: CustomerMaterialRegistration) => {
    await customerMaterialRegistrationApi.withdraw(record.id!.toString());
    messageApi.success('已撤回代工来料入库');
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  };

  const handleCancel = async (record: CustomerMaterialRegistration) => {
    await customerMaterialRegistrationApi.cancel(record.id!.toString());
    messageApi.success('代工来料单已取消');
    invalidateMenuBadgeCounts();
    actionRef.current?.reload();
  };

  const columns: ProColumns<CustomerMaterialRegistration>[] = [
    {
      title: '单号',
      dataIndex: 'registration_code',
      width: 150,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.registration_code ?? '') }} ellipsis>
          {r.registration_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: '工单', dataIndex: 'work_order_code', width: 120, ellipsis: true },
    { title: '物料', dataIndex: 'mapped_material_name', width: 140, ellipsis: true, hideInSearch: true },
    {
      title: '数量',
      dataIndex: 'total_quantity',
      width: 90,
      align: 'right',
      render: (_, r) => r.total_quantity ?? r.quantity ?? '-',
    },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: '登记日期',
      dataIndex: 'registration_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '状态',
      dataIndex: 'status',
      hideInTable: true,
      valueEnum: {
        pending: { text: '待入库', status: 'warning' },
        processed: { text: '已入库', status: 'success' },
        cancelled: { text: '已取消', status: 'error' },
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getCustomerMaterialRegistrationLifecycle(record as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Popconfirm title="确定确认入库吗？" onConfirm={() => handleProcess(record)}>
                <Button type="link" size="small" icon={<CheckCircleOutlined />}>
                  确认入库
                </Button>
              </Popconfirm>
              <Popconfirm title="确定取消吗？" onConfirm={() => handleCancel(record)}>
                <Button type="link" size="small" danger icon={<CloseCircleOutlined />}>
                  取消
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'processed' && (
            <Popconfirm title="确定撤回入库吗？将冲减客供库存。" onConfirm={() => handleWithdraw(record)}>
              <Button type="link" size="small" danger icon={<RollbackOutlined />}>
                撤回
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable
        headerTitle="代工来料"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.customer-material-registration"
        showAdvancedSearch
        showCreateButton
        createButtonText="客供料入库"
        onCreate={handleCreate}
        request={async (params: any) => {
          const pageSize = params.pageSize || 20;
          const skip = (params.current! - 1) * pageSize;
          const result = await customerMaterialRegistrationApi.list({
            skip,
            limit: pageSize,
            customer_id: params.customer_id,
            status: params.status,
          });
          const rows = Array.isArray(result) ? result : [];
          const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
          return { data: rows, success: true, total };
        }}
        scroll={{ x: 1500 }}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      />

      <FormModalTemplate
        title="代工来料"
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH || MODAL_CONFIG.STANDARD_WIDTH}
        grid={false}
        loading={submitLoading || startProductionLoading}
        submitText="客供料入库"
        extraFooter={
          canStartProduction ? (
            <Button type="default" loading={startProductionLoading} onClick={() => void handleStartProduction()}>
              直接发料开工
            </Button>
          ) : null
        }
      >
        <Segmented
          options={[
            { label: '普通登记', value: 'document' },
            { label: '扫码登记', value: 'scan' },
          ]}
          value={entryMode}
          onChange={(v) => {
            const mode = v as 'scan' | 'document';
            setEntryMode(mode);
            if (mode === 'document' && !(formRef.current?.getFieldValue('items') || []).length) {
              formRef.current?.setFieldsValue({ items: [{ quantity: 1 }] });
            }
          }}
          style={{ marginBottom: 16 }}
        />
        <Row gutter={16}>
          <Col span={12}>
            <ProForm.Item
              name="customer_id"
              label="客户"
              rules={[{ required: true, message: '请选择客户' }]}
            >
              <CustomerSelectDropdown
                hostResource="kuaizhizao:warehouse-management-customer-material-registration"
                placeholder="请选择客户"
                style={{ width: '100%' }}
                onCustomerPick={(c) => {
                  formRef.current?.setFieldsValue({
                    customer_name: c?.name ?? (c as { customer_name?: string })?.customer_name,
                  });
                }}
              />
            </ProForm.Item>
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="入库仓库"
              placeholder="请选择入库仓库"
              required
              onChange={(_val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="registration_date"
              label="登记日期"
              rules={[{ required: true }]}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
        </Row>

        {entryMode === 'scan' ? (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <ProFormText
                  name="barcode"
                  label="客户条码"
                  rules={[{ required: true }]}
                  fieldProps={{
                    onBlur: (e: any) => e.target.value && handleScanBarcode(e.target.value),
                    suffix: scanning ? <ScanOutlined spin /> : null,
                  }}
                />
              </Col>
              <Col span={12}>
                <ProFormSelect
                  name="barcode_type"
                  label="条码类型"
                  options={[
                    { label: '一维码', value: '1d' },
                    { label: '二维码', value: '2d' },
                  ]}
                />
              </Col>
            </Row>
            <UniMaterialSelect
              name="material_id"
              label="来料物料"
              placeholder="请选择或快速新建物料"
              required
              showQuickCreate
              showAdvancedSearch
              fillMapping={{
                material_code: 'mainCode',
                material_name: 'name',
              }}
            />
            <Row gutter={16}>
              <Col span={12}>
                <ProFormDigit name="quantity" label="来料数量" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} />
              </Col>
              <Col span={12}>
                <ProFormText name="batch_number" label="批号" />
              </Col>
            </Row>
          </>
        ) : (
          <UniTableDetail
            name="items"
            title="明细"
            required
            requiredMessage="请至少添加一条明细"
            initialValue={{ quantity: 1 }}
            containerStyle={{ width: '100%' }}
            onBatchSelect={() => setMaterialPickerOpen(true)}
            columns={[
              {
                title: '物料',
                dataIndex: 'material_id',
                width: 220,
                render: (_: unknown, __: unknown, index: number) => (
                  <AntForm.Item
                    noStyle
                    shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}
                  >
                    {({ getFieldValue }) => {
                      const row = getFieldValue('items')?.[index];
                      const mid = row?.material_id ? Number(row.material_id) : null;
                      const fallback =
                        mid && (row?.material_code || row?.material_name)
                          ? {
                              value: mid,
                              label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
                            }
                          : undefined;
                      return (
                        <div className="uni-detail-material-cell">
                          <UniMaterialSelect
                            name={[index, 'material_id']}
                            label=""
                            placeholder="请选择或快速新建物料"
                            required
                            size="small"
                            listFieldKey={index}
                            listFieldName="items"
                            fillMapping={{
                              material_code: 'mainCode',
                              material_name: 'name',
                              material_spec: 'specification',
                              material_unit: 'baseUnit',
                            }}
                            fallbackOption={fallback}
                            formItemProps={{ style: { margin: 0 } }}
                            showQuickCreate
                            showAdvancedSearch
                          />
                        </div>
                      );
                    }}
                  </AntForm.Item>
                ),
              },
              {
                title: '规格',
                dataIndex: 'material_spec',
                width: 120,
                ellipsis: true,
                render: (_: unknown, __: unknown, index: number) => (
                  <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                    <Input placeholder="规格" size="small" readOnly />
                  </AntForm.Item>
                ),
              },
              {
                title: '单位',
                dataIndex: 'material_unit',
                width: 90,
                render: (_: unknown, __: unknown, index: number) => (
                  <AntForm.Item
                    noStyle
                    shouldUpdate={(prev, curr) =>
                      prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                    }
                  >
                    {({ getFieldValue }) => {
                      const materialId = getFieldValue(['items', index, 'material_id']);
                      return (
                        <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                          <MaterialUnitSelect materialId={materialId} size="small" noStyle />
                        </AntForm.Item>
                      );
                    }}
                  </AntForm.Item>
                ),
              },
              {
                title: '数量',
                dataIndex: 'quantity',
                width: 100,
                align: 'right' as const,
                render: (_: unknown, __: unknown, index: number) => (
                  <AntForm.Item
                    name={[index, 'quantity']}
                    rules={[{ required: true, message: '必填' }]}
                    style={{ margin: 0 }}
                  >
                    <InputNumber min={0} precision={2} style={{ width: '100%' }} size="small" />
                  </AntForm.Item>
                ),
              },
              {
                title: '批号',
                dataIndex: 'batch_number',
                width: 120,
                render: (_: unknown, __: unknown, index: number) => (
                  <AntForm.Item name={[index, 'batch_number']} style={{ margin: 0 }}>
                    <Input size="small" placeholder="可选" />
                  </AntForm.Item>
                ),
              },
            ]}
          />
        )}
        <ProFormTextArea name="remarks" label="备注" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
        hostResource="kuaizhizao:warehouse-management-customer-material-registration"
      />

      <DetailDrawerTemplate
        title="代工来料详情"
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentRegistration(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        dataSource={currentRegistration || {}}
        columns={[
          { title: '单号', dataIndex: 'registration_code' },
          { title: '客户', dataIndex: 'customer_name' },
          { title: '工单', dataIndex: 'work_order_code' },
          { title: '销售订单', dataIndex: 'sales_order_code' },
          { title: '仓库', dataIndex: 'warehouse_name' },
          { title: '总数量', dataIndex: 'total_quantity' },
          {
            title: '状态',
            dataIndex: 'status',
            valueEnum: {
              pending: { text: '待入库' },
              processed: { text: '已入库' },
              cancelled: { text: '已取消' },
            },
          },
          { title: '确认人', dataIndex: 'processed_by_name' },
          { title: '备注', dataIndex: 'remarks' },
        ]}
      />
    </ListPageTemplate>
  );
};

export default CustomerMaterialRegistrationPage;
