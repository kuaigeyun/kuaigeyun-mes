/**
 * 样品试用单管理页面
 *
 * 客户申请样品试用，可转正式销售订单，样品出库可通过其他出库（原因：样品）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, ExportOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { sampleTrialApi } from '../../../services/sample-trial';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { warehouseApi } from '../../../../master-data/services/warehouse';

interface SampleTrial {
  id?: number;
  trial_code?: string;
  customer_id?: number;
  customer_name?: string;
  customer_contact?: string;
  customer_phone?: string;
  trial_purpose?: string;
  trial_period_start?: string;
  trial_period_end?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  other_outbound_id?: number;
  other_outbound_code?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

interface SampleTrialDetail extends SampleTrial {
  items?: { id?: number; material_code: string; material_name: string; material_unit: string; trial_quantity: number; unit_price?: number; total_amount?: number }[];
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  草稿: { text: '草稿', color: 'default' },
  已审批: { text: '已审批', color: 'processing' },
  试用中: { text: '试用中', color: 'processing' },
  已归还: { text: '已归还', color: 'success' },
  已转订单: { text: '已转订单', color: 'success' },
  已关闭: { text: '已关闭', color: 'default' },
};

const SampleTrialsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [trialDetail, setTrialDetail] = useState<SampleTrialDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOutboundModalVisible, setCreateOutboundModalVisible] = useState(false);
  const [createOutboundTrialId, setCreateOutboundTrialId] = useState<number | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const outboundFormRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<Array<{ material_id: number; material_code: string; material_name: string; material_unit: string; trial_quantity: number; unit_price: number }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cust, mat, wh] = await Promise.all([
          customerApi.list({ limit: 1000, isActive: true }),
          materialApi.list({ limit: 2000, isActive: true }),
          warehouseApi.list({ limit: 1000, isActive: true }),
        ]);
        setCustomerList(Array.isArray(cust) ? cust : cust?.items || []);
        setMaterialList(Array.isArray(mat) ? mat : mat?.items || []);
        setWarehouseList(Array.isArray(wh) ? wh : wh?.items || []);
      } catch (e) {
        console.error('加载客户/物料/仓库失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<SampleTrial>[] = [
    { title: '试用单号', dataIndex: 'trial_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    { title: '试用目的', dataIndex: 'trial_purpose', width: 120, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => {
        const c = STATUS_MAP[(status as string) || ''] || { text: (status as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '试用开始', dataIndex: 'trial_period_start', valueType: 'date', width: 110 },
    { title: '试用结束', dataIndex: 'trial_period_end', valueType: 'date', width: 110 },
    { title: '关联销售订单', dataIndex: 'sales_order_code', width: 130, ellipsis: true },
    { title: '关联出库单', dataIndex: 'other_outbound_code', width: 130, ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '草稿' && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
          {!record.sales_order_id && record.status !== '已转订单' && (
            <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvertToOrder(record)} style={{ color: '#52c41a' }}>转订单</Button>
          )}
          {!record.other_outbound_id && (
            <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => handleOpenCreateOutbound(record)}>样品出库</Button>
          )}
          <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>打印</Button>
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: SampleTrial) => {
    try {
      const detail = await sampleTrialApi.get(record.id!.toString());
      setTrialDetail(detail as SampleTrialDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取样品试用单详情失败');
    }
  };

  const handleEdit = async (record: SampleTrial) => {
    try {
      const detail = await sampleTrialApi.get(record.id!.toString()) as SampleTrialDetail;
      setFormItems((detail.items || []).map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code || '',
        material_name: it.material_name || '',
        material_unit: it.material_unit || '',
        trial_quantity: Number(it.trial_quantity) || 0,
        unit_price: Number(it.unit_price) || 0,
      })));
      formRef.current?.setFieldsValue({
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        trial_purpose: detail.trial_purpose,
        trial_period_start: detail.trial_period_start ? dayjs(detail.trial_period_start) : undefined,
        trial_period_end: detail.trial_period_end ? dayjs(detail.trial_period_end) : undefined,
        status: detail.status,
        notes: detail.notes,
      });
      setEditingId(record.id!);
      setEditModalVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleDelete = (record: SampleTrial) => {
    Modal.confirm({
      title: '删除样品试用单',
      content: `确定要删除 "${record.trial_code}" 吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条样品试用单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await sampleTrialApi.delete(String(k));
          }
          messageApi.success(`已删除 ${keys.length} 条样品试用单`);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.message || '批量删除失败');
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload = {
          customer_id: row.customer_id ?? row.customerId,
          customer_name: row.customer_name || row.customerName,
          trial_purpose: row.trial_purpose,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await sampleTrialApi.create(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条样品试用单`);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  const handleConvertToOrder = (record: SampleTrial) => {
    Modal.confirm({
      title: '转为销售订单',
      content: `确定要将样品试用单 "${record.trial_code}" 转为销售订单吗？`,
      onOk: async () => {
        try {
          await sampleTrialApi.convertToOrder(record.id!.toString());
          messageApi.success('转换成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '转换失败');
        }
      },
    });
  };

  const handleOpenCreateOutbound = (record: SampleTrial) => {
    setCreateOutboundTrialId(record.id!);
    outboundFormRef.current?.resetFields();
    setCreateOutboundModalVisible(true);
  };

  const handleCreateOutboundSubmit = async () => {
    if (!createOutboundTrialId) return;
    try {
      const values = await outboundFormRef.current?.validateFields();
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = wh?.name || wh?.warehouse_name || '';
      await sampleTrialApi.createOutbound(createOutboundTrialId.toString(), {
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
      });
      messageApi.success('样品出库单创建成功');
      setCreateOutboundModalVisible(false);
      setCreateOutboundTrialId(null);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error.errorFields) messageApi.error('请选择出库仓库');
      else messageApi.error(error.message || '创建失败');
    }
  };

  const handlePrint = async (record: SampleTrial) => {
    try {
      const result = await sampleTrialApi.print(record.id!.toString()) as { success?: boolean; content?: string; message?: string };
      if (result?.success && result?.content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        }
      } else {
        messageApi.warning(result?.message || '打印功能暂未配置模板');
      }
    } catch {
      messageApi.error('打印失败');
    }
  };

  const handleCreate = () => {
    setFormItems([]);
    formRef.current?.resetFields();
    setEditingId(null);
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async (values: any) => {
    const validItems = formItems.filter((it) => it.material_id && it.trial_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    if (!cust) {
      messageApi.error('请选择客户');
      throw new Error('请选择客户');
    }
    try {
      await sampleTrialApi.create({
        customer_id: values.customer_id,
        customer_name: cust.name || cust.customer_name || cust.code,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        trial_purpose: values.trial_purpose,
        trial_period_start: values.trial_period_start ? dayjs(values.trial_period_start).format('YYYY-MM-DD') : undefined,
        trial_period_end: values.trial_period_end ? dayjs(values.trial_period_end).format('YYYY-MM-DD') : undefined,
        status: values.status || '草稿',
        notes: values.notes,
        items: validItems.map((it) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit,
          trial_quantity: it.trial_quantity,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const handleEditSubmit = async (values: any) => {
    if (!editingId) return;
    const validItems = formItems.filter((it) => it.material_id && it.trial_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    try {
      await sampleTrialApi.update(editingId.toString(), {
        customer_id: values.customer_id,
        customer_name: cust?.name || cust?.customer_name || values.customer_name,
        customer_contact: values.customer_contact,
        customer_phone: values.customer_phone,
        trial_purpose: values.trial_purpose,
        trial_period_start: values.trial_period_start ? dayjs(values.trial_period_start).format('YYYY-MM-DD') : undefined,
        trial_period_end: values.trial_period_end ? dayjs(values.trial_period_end).format('YYYY-MM-DD') : undefined,
        status: values.status || '草稿',
        notes: values.notes,
        items: validItems.map((it) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit,
          trial_quantity: it.trial_quantity,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success('更新成功');
      setEditModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '更新失败');
      throw error;
    }
  };

  const addItem = () => {
    setFormItems((prev) => [...prev, { material_id: 0, material_code: '', material_name: '', material_unit: '', trial_quantity: 1, unit_price: 0 }]);
  };

  const onMaterialSelect = (idx: number, materialId: number) => {
    const m = materialList.find((x: any) => (x.id || x.material_id) === materialId);
    if (!m) return;
    const updated = [...formItems];
    updated[idx] = {
      ...updated[idx],
      material_id: m.id || m.material_id,
      material_code: m.mainCode || m.code || m.material_code || '',
      material_name: m.name || m.material_name || '',
      material_unit: m.baseUnit || m.material_unit || m.unit || '',
    };
    setFormItems(updated);
  };

  const detailColumns: ProDescriptionsItemProps<SampleTrialDetail>[] = [
    { title: '试用单号', dataIndex: 'trial_code' },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '试用目的', dataIndex: 'trial_purpose', span: 2 },
    { title: '试用开始', dataIndex: 'trial_period_start', valueType: 'date' },
    { title: '试用结束', dataIndex: 'trial_period_end', valueType: 'date' },
    { title: '关联销售订单', dataIndex: 'sales_order_code' },
    { title: '关联出库单', dataIndex: 'other_outbound_code' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  const renderForm = (onFinish: (values: any) => Promise<void>) => (
    <>
      <Form.Item name="customer_id" label="客户" rules={[{ required: true }]}>
        <Select
          placeholder="请选择客户"
          options={customerList.map((c: any) => ({ value: c.id ?? c.customer_id, label: c.name || c.customer_name || c.code }))}
          onChange={(v) => {
            const cust = customerList.find((x: any) => (x.id ?? x.customer_id) === v);
            if (cust) formRef.current?.setFieldsValue({ customer_name: cust.name || cust.customer_name, customer_contact: cust.contact, customer_phone: cust.phone });
          }}
        />
      </Form.Item>
      <Form.Item name="customer_contact" label="联系人">
        <Input placeholder="联系人" />
      </Form.Item>
      <Form.Item name="customer_phone" label="电话">
        <Input placeholder="电话" />
      </Form.Item>
      <Form.Item name="trial_purpose" label="试用目的">
        <Input placeholder="试用目的" />
      </Form.Item>
      <Form.Item name="trial_period_start" label="试用开始日期">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="trial_period_end" label="试用结束日期">
        <DatePicker style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="明细">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="dashed" onClick={addItem} icon={<PlusOutlined />}>添加明细</Button>
          {formItems.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Select
                placeholder="物料"
                style={{ width: 200 }}
                options={materialList.map((m: any) => ({ value: m.id ?? m.material_id, label: `${m.mainCode || m.code || ''} ${m.name || ''}` }))}
                onChange={(v) => onMaterialSelect(idx, v)}
              />
              <InputNumber placeholder="数量" min={0.01} value={it.trial_quantity} onChange={(v) => {
                const u = [...formItems]; u[idx] = { ...u[idx], trial_quantity: v ?? 0 }; setFormItems(u);
              }} />
              <InputNumber placeholder="单价" min={0} value={it.unit_price} onChange={(v) => {
                const u = [...formItems]; u[idx] = { ...u[idx], unit_price: v ?? 0 }; setFormItems(u);
              }} />
              <Button type="link" danger size="small" onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}>删除</Button>
            </div>
          ))}
        </Space>
      </Form.Item>
      <Form.Item name="notes" label="备注">
        <Input.TextArea rows={2} />
      </Form.Item>
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="样品试用"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建样品试用"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={false}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const response = await sampleTrialApi.list({ skip: 0, limit: 10000 });
              const rawData = Array.isArray(response) ? response : response?.items || response?.data || [];
              let items = rawData;
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = rawData.filter((d: SampleTrial) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sample-trials-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const response = await sampleTrialApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                customer_id: params.customer_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1400 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`样品试用详情${trialDetail?.trial_code ? ` - ${trialDetail.trial_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setTrialDetail(null); }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={detailColumns}
        dataSource={trialDetail || {}}
      >
        {trialDetail?.items && trialDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey={(_, idx) => (trialDetail?.items?.[idx] as any)?.id ?? idx}
            columns={[
              { title: '物料编码', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '单位', dataIndex: 'material_unit', width: 60 },
              { title: '数量', dataIndex: 'trial_quantity', width: 90, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 90, align: 'right' },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
            ]}
            dataSource={trialDetail.items}
            pagination={false}
          />
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="新建样品试用单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        {renderForm(handleCreateSubmit)}
      </FormModalTemplate>

      <FormModalTemplate
        title="编辑样品试用单"
        open={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        formRef={formRef}
        onFinish={handleEditSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        {renderForm(handleEditSubmit)}
      </FormModalTemplate>

      <Modal
        title="创建样品出库"
        open={createOutboundModalVisible}
        onOk={handleCreateOutboundSubmit}
        onCancel={() => { setCreateOutboundModalVisible(false); setCreateOutboundTrialId(null); }}
        okText="确定"
      >
        <Form ref={outboundFormRef} layout="vertical">
          <Form.Item name="warehouse_id" label="出库仓库" rules={[{ required: true, message: '请选择出库仓库' }]}>
            <Select
              placeholder="请选择出库仓库"
              options={warehouseList.map((w: any) => ({ value: w.id ?? w.warehouse_id, label: w.name || w.warehouse_name || w.code }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步样品试用"
      />
    </>
  );
};

export default SampleTrialsPage;
