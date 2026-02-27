/**
 * 其他出库单管理页面
 *
 * 提供其他出库单的创建、查看、确认和管理功能（盘亏/样品/报废/其他）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getOtherOutboundLifecycle } from '../../../utils/otherOutboundLifecycle';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { materialApi } from '../../../../master-data/services/material';

const REASON_TYPES = [
  { value: '盘亏', label: '盘亏' },
  { value: '样品', label: '样品' },
  { value: '报废', label: '报废' },
  { value: '其他', label: '其他' },
];

interface OtherOutbound {
  id?: number;
  tenant_id?: number;
  outbound_code?: string;
  reason_type?: string;
  reason_desc?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  status?: string;
  deliverer_id?: number;
  deliverer_name?: string;
  delivery_time?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

interface OtherOutboundDetail extends OtherOutbound {
  items?: OtherOutboundItem[];
}

interface OtherOutboundItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  outbound_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  notes?: string;
}

const OtherOutboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [outboundDetail, setOutboundDetail] = useState<OtherOutboundDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<Array<{ material_id: number; material_code: string; material_name: string; material_unit: string; outbound_quantity: number; unit_price: number }>>([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [wh, mat] = await Promise.all([
          masterDataWarehouseApi.list({ limit: 1000, isActive: true }),
          materialApi.list({ limit: 2000, isActive: true }),
        ]);
        setWarehouseList(Array.isArray(wh) ? wh : wh?.items || []);
        setMaterialList(Array.isArray(mat) ? mat : mat?.items || []);
      } catch (e) {
        console.error('加载仓库/物料失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<OtherOutbound>[] = [
    { title: '出库单编号', dataIndex: 'outbound_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: '原因类型',
      dataIndex: 'reason_type',
      width: 100,
      render: (v) => <Tag>{v || '-'}</Tag>,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      render: (_, record) => {
        const lifecycle = getOtherOutboundLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '待出库';
        const colorMap: Record<string, string> = { 待出库: 'default', 已出库: 'success', 已取消: 'error' };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    { title: '出库人', dataIndex: 'deliverer_name', width: 100 },
    { title: '出库时间', dataIndex: 'delivery_time', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '待出库' && (
            <>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(record)} style={{ color: '#52c41a' }}>确认出库</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: OtherOutbound) => {
    try {
      const detail = await warehouseApi.otherOutbound.get(record.id!.toString());
      setOutboundDetail(detail as OtherOutboundDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取其他出库单详情失败');
    }
  };

  const handleConfirm = async (record: OtherOutbound) => {
    Modal.confirm({
      title: '确认出库',
      content: `确定要确认出库单 "${record.outbound_code}" 吗？确认后将更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.otherOutbound.confirm(record.id!.toString());
          messageApi.success('出库确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '出库确认失败');
        }
      },
    });
  };

  const handleDelete = async (record: OtherOutbound) => {
    Modal.confirm({
      title: '删除出库单',
      content: `确定要删除出库单 "${record.outbound_code}" 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.otherOutbound.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleCreate = () => {
    setFormItems([]);
    formRef.current?.resetFields();
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = formItems.filter((it) => it.material_id && it.outbound_quantity > 0);
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效明细');
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = wh?.name || wh?.warehouse_name || '';
      await warehouseApi.otherOutbound.create({
        reason_type: values.reason_type,
        reason_desc: values.reason_desc,
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
        notes: values.notes,
        items: validItems.map((it) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit,
          outbound_quantity: it.outbound_quantity,
          unit_price: it.unit_price || 0,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== '请至少添加一条有效明细') messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const addItem = () => {
    setFormItems((prev) => [...prev, { material_id: 0, material_code: '', material_name: '', material_unit: '', outbound_quantity: 1, unit_price: 0 }]);
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

  const detailColumns: ProDescriptionsItemProps<OtherOutboundDetail>[] = [
    { title: '出库单编号', dataIndex: 'outbound_code' },
    { title: '原因类型', dataIndex: 'reason_type' },
    { title: '原因说明', dataIndex: 'reason_desc', span: 2 },
    { title: '仓库', dataIndex: 'warehouse_name' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const map: Record<string, { text: string; color: string }> = {
          '待出库': { text: '待出库', color: 'default' },
          '已出库': { text: '已出库', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(s as any) || ''] || { text: (s as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '出库人', dataIndex: 'deliverer_name' },
    { title: '出库时间', dataIndex: 'delivery_time', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="其他出库"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.otherOutbound.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                reason_type: params.reason_type,
                warehouse_id: params.warehouse_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取其他出库单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`其他出库单详情${outboundDetail?.outbound_code ? ` - ${outboundDetail.outbound_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setOutboundDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={outboundDetail || {}}
      >
        {outboundDetail?.items && outboundDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: '物料编码', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '单位', dataIndex: 'material_unit', width: 60 },
              { title: '出库数量', dataIndex: 'outbound_quantity', width: 100, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
              { title: '批次号', dataIndex: 'batch_number', width: 100 },
              { title: '备注', dataIndex: 'notes' },
            ]}
            dataSource={outboundDetail.items}
            pagination={false}
          />
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="新建其他出库单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
        initialValues={{ reason_type: '其他' }}
      >
        <Form.Item name="warehouse_id" label="仓库" rules={[{ required: true }]}>
          <Select
            placeholder="请选择仓库"
            options={warehouseList.map((w: any) => ({ value: w.id ?? w.warehouse_id, label: w.name || w.warehouse_name || w.code }))}
          />
        </Form.Item>
        <Form.Item name="reason_type" label="原因类型" rules={[{ required: true }]}>
          <Select options={REASON_TYPES} placeholder="请选择" />
        </Form.Item>
        <Form.Item name="reason_desc" label="原因说明">
          <Input.TextArea rows={2} placeholder="可选" />
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
                <InputNumber placeholder="数量" min={0.01} value={it.outbound_quantity} onChange={(v) => {
                  const u = [...formItems]; u[idx] = { ...u[idx], outbound_quantity: v ?? 0 }; setFormItems(u);
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
      </FormModalTemplate>
    </>
  );
};

export default OtherOutboundPage;
