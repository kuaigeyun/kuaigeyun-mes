/**
 * 其他入库单管理页面
 *
 * 提供其他入库单的创建、查看、确认和管理功能（盘盈/样品/报废/其他）
 * 支持批号规则选择与自动生成批号
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getOtherInboundLifecycle } from '../../../utils/otherInboundLifecycle';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { materialApi, materialBatchApi, materialSerialApi } from '../../../../master-data/services/material';
import { batchRuleApi, serialRuleApi } from '../../../../master-data/services/batchSerialRules';

const REASON_TYPES = [
  { value: '盘盈', label: '盘盈' },
  { value: '样品', label: '样品' },
  { value: '报废', label: '报废' },
  { value: '其他', label: '其他' },
];

interface OtherInbound {
  id?: number;
  tenant_id?: number;
  inbound_code?: string;
  reason_type?: string;
  reason_desc?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  status?: string;
  receiver_id?: number;
  receiver_name?: string;
  receipt_time?: string;
  total_quantity?: number;
  total_amount?: number;
  notes?: string;
  created_at?: string;
}

interface OtherInboundDetail extends OtherInbound {
  items?: OtherInboundItem[];
}

interface OtherInboundItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  inbound_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  notes?: string;
}

/** 表单行项（含批号/序列号规则相关） */
interface FormItemRow {
  material_id: number;
  material_code: string;
  material_name: string;
  material_unit: string;
  material_uuid?: string;
  inbound_quantity: number;
  unit_price: number;
  batch_number?: string;
  batch_managed?: boolean;
  batch_rule_id?: number; // 可选覆盖，不填则用物料默认
  default_batch_rule_id?: number;
  serial_managed?: boolean;
  serial_rule_id?: number; // 可选覆盖
  default_serial_rule_id?: number;
  serial_numbers?: string[];
}

const OtherInboundPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [inboundDetail, setInboundDetail] = useState<OtherInboundDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<FormItemRow[]>([]);
  const [batchRules, setBatchRules] = useState<{ id: number; name: string; code: string }[]>([]);
  const [serialRules, setSerialRules] = useState<{ id: number; name: string; code: string }[]>([]);
  const [generatingBatchIdx, setGeneratingBatchIdx] = useState<number | null>(null);
  const [generatingSerialIdx, setGeneratingSerialIdx] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [wh, batchRes, serialRes] = await Promise.all([
          masterDataWarehouseApi.list({ limit: 1000, isActive: true }),
          batchRuleApi.list({ pageSize: 200, isActive: true }),
          serialRuleApi.list({ pageSize: 200, isActive: true }),
        ]);
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.items || []);
        setBatchRules(batchRes.items.map((r) => ({ id: r.id, name: r.name, code: r.code })));
        setSerialRules(serialRes.items.map((r) => ({ id: r.id, name: r.name, code: r.code })));
      } catch (e) {
        console.error('加载仓库/规则失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<OtherInbound>[] = [
    { title: '入库单编号', dataIndex: 'inbound_code', width: 140, ellipsis: true, fixed: 'left' },
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
        const lifecycle = getOtherInboundLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '待入库';
        const colorMap: Record<string, string> = { 待入库: 'default', 已入库: 'success', 已取消: 'error' };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    { title: '入库人', dataIndex: 'receiver_name', width: 100 },
    { title: '入库时间', dataIndex: 'receipt_time', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '待入库' && (
            <>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(record)} style={{ color: '#52c41a' }}>确认入库</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: OtherInbound) => {
    try {
      const detail = await warehouseApi.otherInbound.get(record.id!.toString());
      setInboundDetail(detail as OtherInboundDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取其他入库单详情失败');
    }
  };

  const handleConfirm = async (record: OtherInbound) => {
    Modal.confirm({
      title: '确认入库',
      content: `确定要确认入库单 "${record.inbound_code}" 吗？确认后将更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.otherInbound.confirm(record.id!.toString());
          messageApi.success('入库确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '入库确认失败');
        }
      },
    });
  };

  const handleDelete = async (record: OtherInbound) => {
    Modal.confirm({
      title: '删除入库单',
      content: `确定要删除入库单 "${record.inbound_code}" 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.otherInbound.delete(record.id!.toString());
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
      const validItems = formItems.filter((it) => it.material_id && it.inbound_quantity > 0);
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效明细');
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = wh?.name || wh?.warehouse_name || '';
      await warehouseApi.otherInbound.create({
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
          inbound_quantity: it.inbound_quantity,
          unit_price: it.unit_price || 0,
          batch_number: it.batch_number || undefined,
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
    setFormItems((prev) => [
      ...prev,
      {
        material_id: 0,
        material_code: '',
        material_name: '',
        material_unit: '',
        inbound_quantity: 1,
        unit_price: 0,
      },
    ]);
  };

  const onMaterialSelect = async (idx: number, _val: number | undefined, material: any | undefined) => {
    if (!material) return;
    const uuid = material.uuid || material.UUID;
    let batchManaged = material.batchManaged ?? material.batch_managed ?? false;
    let serialManaged = material.serialManaged ?? material.serial_managed ?? false;
    let defaultBatchRuleId = material.defaultBatchRuleId ?? material.default_batch_rule_id;
    let defaultSerialRuleId = material.defaultSerialRuleId ?? material.default_serial_rule_id;
    if (uuid) {
      try {
        const full = await materialApi.get(uuid);
        batchManaged = full.batchManaged ?? false;
        serialManaged = full.serialManaged ?? false;
        defaultBatchRuleId = full.defaultBatchRuleId;
        defaultSerialRuleId = full.defaultSerialRuleId;
      } catch {
        // 使用列表返回的字段
      }
    }
    const updated = [...formItems];
    updated[idx] = {
      ...updated[idx],
      material_id: material.id,
      material_code: material.mainCode || material.code || material.main_code || '',
      material_name: material.name || '',
      material_unit: material.baseUnit || material.base_unit || '',
      material_uuid: uuid,
      batch_managed: batchManaged,
      serial_managed: serialManaged,
      default_batch_rule_id: defaultBatchRuleId,
      default_serial_rule_id: defaultSerialRuleId,
    };
    setFormItems(updated);
  };

  const handleGenerateBatch = async (idx: number) => {
    const row = formItems[idx];
    if (!row?.material_uuid) {
      messageApi.warning('请先选择物料');
      return;
    }
    setGeneratingBatchIdx(idx);
    try {
      const res = await materialBatchApi.generate(row.material_uuid, {
        ruleId: row.batch_rule_id ?? row.default_batch_rule_id,
      });
      const updated = [...formItems];
      updated[idx] = { ...updated[idx], batch_number: res.batch_no };
      setFormItems(updated);
      messageApi.success('批号生成成功');
    } catch (e: any) {
      messageApi.error(e?.message || '批号生成失败');
    } finally {
      setGeneratingBatchIdx(null);
    }
  };

  const handleGenerateSerials = async (idx: number) => {
    const row = formItems[idx];
    if (!row?.material_uuid) {
      messageApi.warning('请先选择物料');
      return;
    }
    const count = Math.max(1, Math.floor(Number(row.inbound_quantity) || 1));
    if (count > 100) {
      messageApi.warning('单次最多生成100个序列号');
      return;
    }
    setGeneratingSerialIdx(idx);
    try {
      const res = await materialSerialApi.generate(row.material_uuid, count, {
        ruleId: row.serial_rule_id ?? row.default_serial_rule_id,
      });
      const updated = [...formItems];
      updated[idx] = { ...updated[idx], serial_numbers: res.serial_nos };
      setFormItems(updated);
      messageApi.success(`已生成 ${res.count} 个序列号`);
    } catch (e: any) {
      messageApi.error(e?.message || '序列号生成失败');
    } finally {
      setGeneratingSerialIdx(null);
    }
  };

  const detailColumns: ProDescriptionsItemProps<OtherInboundDetail>[] = [
    { title: '入库单编号', dataIndex: 'inbound_code' },
    { title: '原因类型', dataIndex: 'reason_type' },
    { title: '原因说明', dataIndex: 'reason_desc', span: 2 },
    { title: '仓库', dataIndex: 'warehouse_name' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const map: Record<string, { text: string; color: string }> = {
          '待入库': { text: '待入库', color: 'default' },
          '已入库': { text: '已入库', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(s as any) || ''] || { text: (s as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '入库人', dataIndex: 'receiver_name' },
    { title: '入库时间', dataIndex: 'receipt_time', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="其他入库"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.otherInbound.list({
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
              messageApi.error('获取其他入库单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`其他入库单详情${inboundDetail?.inbound_code ? ` - ${inboundDetail.inbound_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setInboundDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={inboundDetail || {}}
      >
        {inboundDetail?.items && inboundDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: '物料编码', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '单位', dataIndex: 'material_unit', width: 60 },
              { title: '入库数量', dataIndex: 'inbound_quantity', width: 100, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
              { title: '批次号', dataIndex: 'batch_number', width: 100 },
              { title: '备注', dataIndex: 'notes' },
            ]}
            dataSource={inboundDetail.items}
            pagination={false}
          />
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="新建其他入库单"
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
              <div key={idx} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12, background: '#fafafa' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ flex: '1 1 250px' }}>
                    <UniMaterialSelect
                      name={['items', idx, 'material_id']}
                      label=""
                      placeholder="请输入或选择物料"
                      onChange={(v, option) => onMaterialSelect(idx, v, option)}
                    />
                  </div>
                  <InputNumber placeholder="数量" min={0.01} value={it.inbound_quantity} onChange={(v) => {
                    const u = [...formItems]; u[idx] = { ...u[idx], inbound_quantity: v ?? 0 }; setFormItems(u);
                  }} />
                  <InputNumber placeholder="单价" min={0} value={it.unit_price} onChange={(v) => {
                    const u = [...formItems]; u[idx] = { ...u[idx], unit_price: v ?? 0 }; setFormItems(u);
                  }} />
                  <Button type="link" danger size="small" onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}>删除</Button>
                </div>
                {(it.batch_managed || it.serial_managed) && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                    {it.batch_managed && (
                      <>
                        <Select
                          placeholder="批号规则（可选）"
                          allowClear
                          style={{ width: 160 }}
                          value={it.batch_rule_id ?? it.default_batch_rule_id ?? undefined}
                          onChange={(v) => {
                            const u = [...formItems]; u[idx] = { ...u[idx], batch_rule_id: v ?? undefined }; setFormItems(u);
                          }}
                          options={batchRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
                        />
                        <Input
                          placeholder="批号（可手动输入或生成）"
                          value={it.batch_number ?? ''}
                          onChange={(e) => {
                            const u = [...formItems]; u[idx] = { ...u[idx], batch_number: e.target.value }; setFormItems(u);
                          }}
                          style={{ width: 160 }}
                        />
                        <Button
                          type="link"
                          size="small"
                          icon={<ThunderboltOutlined />}
                          loading={generatingBatchIdx === idx}
                          onClick={() => handleGenerateBatch(idx)}
                        >
                          生成批号
                        </Button>
                      </>
                    )}
                    {it.serial_managed && (
                      <>
                        <Select
                          placeholder="序列号规则（可选）"
                          allowClear
                          style={{ width: 160 }}
                          value={it.serial_rule_id ?? it.default_serial_rule_id ?? undefined}
                          onChange={(v) => {
                            const u = [...formItems]; u[idx] = { ...u[idx], serial_rule_id: v ?? undefined }; setFormItems(u);
                          }}
                          options={serialRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
                        />
                        <Button
                          type="link"
                          size="small"
                          icon={<ThunderboltOutlined />}
                          loading={generatingSerialIdx === idx}
                          onClick={() => handleGenerateSerials(idx)}
                        >
                          生成序列号
                        </Button>
                        {it.serial_numbers && it.serial_numbers.length > 0 && (
                          <span style={{ color: '#52c41a', fontSize: 12 }}>
                            已生成 {it.serial_numbers.length} 个
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
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

export default OtherInboundPage;
