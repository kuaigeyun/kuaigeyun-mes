/**
 * 其他入库单管理页面
 *
 * 提供其他入库单的创建、查看、确认和管理功能（盘盈/样品/报废/其他）
 * 支持批号规则选择与自动生成批号
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, InputNumber, Input, Row, Col, Select, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, ThunderboltOutlined, ShoppingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import CodeField from '../../../../../components/code-field';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getOtherInboundLifecycle } from '../../../utils/otherInboundLifecycle';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { materialApi, materialBatchApi, materialSerialApi } from '../../../../master-data/services/material';
import { batchRuleApi, serialRuleApi } from '../../../../master-data/services/batchSerialRules';

const REASON_TYPES_FALLBACK = [
  { value: '盘盈', label: '盘盈' },
  { value: '调拨', label: '调拨' },
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
  updated_at?: string;
  [key: string]: any;
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

const defaultInboundItem = {
  material_id: undefined,
  material_code: '',
  material_name: '',
  material_unit: '',
  inbound_quantity: 1,
  unit_price: 0,
  material_uuid: undefined,
  batch_managed: false,
  serial_managed: false,
  batch_rule_id: undefined,
  default_batch_rule_id: undefined,
  serial_rule_id: undefined,
  default_serial_rule_id: undefined,
  batch_number: undefined,
  serial_numbers: undefined,
};

const OtherInboundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [inboundDetail, setInboundDetail] = useState<OtherInboundDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [reasonTypeOptions, setReasonTypeOptions] = useState<Array<{ label: string; value: string }>>(REASON_TYPES_FALLBACK);
  const [reasonTypeLoading, setReasonTypeLoading] = useState(false);
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

  useEffect(() => {
    const loadReasonType = async () => {
      setReasonTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('INBOUND_REASON_TYPE');
        const items = await getDictionaryItemList(dict.uuid, true);
        setReasonTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setReasonTypeOptions(REASON_TYPES_FALLBACK);
      } finally {
        setReasonTypeLoading(false);
      }
    };
    loadReasonType();
  }, []);

  const columns: ProColumns<OtherInbound>[] = [
    {
      title: '入库单编号',
      dataIndex: 'inbound_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.inbound_code ?? '') }} ellipsis>
          {r.inbound_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: '原因类型',
      dataIndex: 'reason_type',
      width: 100,
      render: (v) => <Tag>{v || '-'}</Tag>,
    },
    { title: '入库人', dataIndex: 'receiver_name', width: 100 },
    { title: '入库时间', dataIndex: 'receipt_time', valueType: 'dateTime', width: 160 },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getOtherInboundLifecycle(record as Record<string, unknown>);
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
          {record.status === '已入库' && (
            <Button type="link" size="small" icon={<ThunderboltOutlined />} onClick={() => handleWithdraw(record)} style={{ color: '#fa8c16' }}>撤销确认</Button>
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
          invalidateMenuBadgeCounts();

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
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleWithdraw = async (record: OtherInbound) => {
    Modal.confirm({
      title: '确认撤销入库',
      content: `确定要撤销入库单 "${record.inbound_code}" 的确认状态吗？撤销后将物理回滚已增加的库存数量。`,
      onOk: async () => {
        try {
          await warehouseApi.otherInbound.withdraw(record.id!.toString());
          messageApi.success('已成功撤销并扣减库存');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '撤销失败');
        }
      },
    });
  };

  const appendOtherInboundItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultInboundItem,
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_unit: m.baseUnit ?? '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({ items: [defaultInboundItem] });
    }, 0);
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.inbound_quantity) || 0) > 0);
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效明细');
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = values.warehouse_name ?? wh?.name ?? wh?.warehouse_name ?? '';
      await warehouseApi.otherInbound.create({
        inbound_code: values.inbound_code,
        reason_type: values.reason_type,
        reason_desc: values.reason_desc,
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
        notes: values.notes,
        items: validItems.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_unit: it.material_unit || '',
          inbound_quantity: Number(it.inbound_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          batch_number: it.batch_number || undefined,
          serial_numbers: it.serial_numbers || undefined,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== '请至少添加一条有效明细') messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const handleGenerateBatch = async (idx: number) => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const row = items[idx];
    if (!row?.material_uuid) {
      messageApi.warning('请先选择物料');
      return;
    }
    setGeneratingBatchIdx(idx);
    try {
      const res = await materialBatchApi.generate(row.material_uuid, {
        ruleId: row.batch_rule_id ?? row.default_batch_rule_id,
      });
      formRef.current?.setFieldValue(['items', idx, 'batch_number'], res.batch_no);
      messageApi.success('批号生成成功');
    } catch (e: any) {
      messageApi.error(e?.message || '批号生成失败');
    } finally {
      setGeneratingBatchIdx(null);
    }
  };

  const handleGenerateSerials = async (idx: number) => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const row = items[idx];
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
      formRef.current?.setFieldValue(['items', idx, 'serial_numbers'], res.serial_nos);
      messageApi.success(`已生成 ${res.count} 个序列号`);
    } catch (e: any) {
      messageApi.error(e?.message || '序列号生成失败');
    } finally {
      setGeneratingSerialIdx(null);
    }
  };

  const onMaterialSelectForBatchSerial = async (idx: number, _val: number | undefined, material: any | undefined) => {
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
    formRef.current?.setFieldValue(['items', idx, 'material_uuid'], uuid);
    formRef.current?.setFieldValue(['items', idx, 'batch_managed'], batchManaged);
    formRef.current?.setFieldValue(['items', idx, 'serial_managed'], serialManaged);
    formRef.current?.setFieldValue(['items', idx, 'default_batch_rule_id'], defaultBatchRuleId);
    formRef.current?.setFieldValue(['items', idx, 'default_serial_rule_id'], defaultSerialRuleId);
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
          columnPersistenceId="kuaizhizao-wm-other-inbound"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新建其他入库单"
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.otherInbound.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                reason_type: params.reason_type,
                warehouse_id: params.warehouse_id,
                keyword: (params as any).keyword,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取其他入库单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条其他入库单吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await warehouseApi.otherInbound.delete(String(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
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
          <>
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            <Table
              className="warehouse-detail-table"
              size="small"
              rowKey="id"
              columns={[
              { title: '物料编号', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '单位', dataIndex: 'material_unit', width: 60, render: (val) => <DictionaryLabel dictionaryCode="unit" value={val} /> },
              { title: '入库数量', dataIndex: 'inbound_quantity', width: 100, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
              { title: '批次号', dataIndex: 'batch_number', width: 100 },
              { title: '备注', dataIndex: 'notes' },
            ]}
            dataSource={inboundDetail.items}
            pagination={false}
          />
          </>
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
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-other-inbound"
              name="inbound_code"
              label="入库单编号"
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="仓库"
              placeholder="请选择仓库"
              required
              onChange={(_val, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
            />
          </Col>
        </Row>
        <AntForm.Item name="warehouse_name" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="reason_type" label="原因类型" rules={[{ required: true }]}>
              <UniDropdown
                placeholder="请选择原因类型"
                showSearch
                allowClear
                loading={reasonTypeLoading}
                style={{ width: '100%' }}
                options={reasonTypeOptions}
                quickCreate={{ label: '数据字典管理', onClick: () => navigate('/system/data-dictionaries') }}
              />
            </ProFormItem>
          </Col>
          <Col span={12}>
            <ProFormItem name="reason_desc" label="原因说明">
              <Input placeholder="可选" />
            </ProFormItem>
          </Col>
        </Row>
        <ProFormItem label="明细" required style={{ width: '100%' }}>
          <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const cols = [
                  {
                    title: '物料',
                    dataIndex: 'material_id',
                    width: 260,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
                            <div className="warehouse-detail-material-cell">
                              <UniMaterialSelect
                                name={[index, 'material_id']}
                                label=""
                                placeholder="请选择物料"
                                required
                                size="small"
                                listFieldKey={index}
                                listFieldName="items"
                                fillMapping={{
                                  material_code: 'mainCode',
                                  material_name: 'name',
                                  material_unit: 'baseUnit',
                                }}
                                fallbackOption={fallback}
                                formItemProps={{ style: { margin: 0 } }}
                                showQuickCreate
                                showAdvancedSearch
                                onChange={(v, m) => onMaterialSelectForBatchSerial(index, v, m)}
                              />
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '单位',
                    dataIndex: 'material_unit',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          return (
                            <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                              <MaterialUnitSelect 
                                materialId={materialId} 
                                size="small" 
                                noStyle 
                              />
                            </AntForm.Item>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '数量',
                    dataIndex: 'inbound_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'inbound_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                        <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '单价',
                    dataIndex: 'unit_price',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                        <InputNumber placeholder="0" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '操作',
                    width: 60,
                    render: (_: any, __: any, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                    ),
                  },
                ];
                const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
                const expandedRowRender = (_record: any, index: number) => {
                  const row = formRef.current?.getFieldValue('items')?.[index];
                  const batchManaged = row?.batch_managed;
                  const serialManaged = row?.serial_managed;
                  if (!batchManaged && !serialManaged) return null;
                  return (
                    <div style={{ padding: '8px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                      {batchManaged && (
                        <>
                          <Select
                            placeholder="批号规则（可选）"
                            allowClear
                            style={{ width: 160 }}
                            value={row?.batch_rule_id ?? row?.default_batch_rule_id ?? undefined}
                            onChange={(v) => formRef.current?.setFieldValue(['items', index, 'batch_rule_id'], v ?? undefined)}
                            options={batchRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
                          />
                          <AntForm.Item name={['items', index, 'batch_number']} style={{ margin: 0, width: 160 }}>
                            <Input placeholder="批号（可手动输入或生成）" size="small" />
                          </AntForm.Item>
                          <Button
                            type="link"
                            size="small"
                            icon={<ThunderboltOutlined />}
                            loading={generatingBatchIdx === index}
                            onClick={() => handleGenerateBatch(index)}
                          >
                            生成批号
                          </Button>
                        </>
                      )}
                      {serialManaged && (
                        <>
                          <Select
                            placeholder="序列号规则（可选）"
                            allowClear
                            style={{ width: 160 }}
                            value={row?.serial_rule_id ?? row?.default_serial_rule_id ?? undefined}
                            onChange={(v) => formRef.current?.setFieldValue(['items', index, 'serial_rule_id'], v ?? undefined)}
                            options={serialRules.map((r) => ({ label: `${r.name} (${r.code})`, value: r.id }))}
                          />
                          <Button
                            type="link"
                            size="small"
                            icon={<ThunderboltOutlined />}
                            loading={generatingSerialIdx === index}
                            onClick={() => handleGenerateSerials(index)}
                          >
                            生成序列号
                          </Button>
                          <AntForm.Item noStyle shouldUpdate={(prev, curr) => prev?.items?.[index] !== curr?.items?.[index]}>
                            {({ getFieldValue }: any) => {
                              const sn = getFieldValue(['items', index, 'serial_numbers']);
                              const count = Array.isArray(sn) ? sn.length : 0;
                              return count > 0 ? <span style={{ color: '#52c41a', fontSize: 12 }}>已生成 {count} 个</span> : null;
                            }}
                          </AntForm.Item>
                        </>
                      )}
                    </div>
                  );
                };
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="warehouse-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={cols}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        expandable={{
                          expandedRowRender: (record) => expandedRowRender(record, record.key),
                          rowExpandable: (record) => {
                            const row = formRef.current?.getFieldValue('items')?.[record.key];
                            return !!(row?.batch_managed || row?.serial_managed);
                          },
                        }}
                        footer={() => (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                            <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultInboundItem)}>
                              添加明细
                            </Button>
                            <Button
                              type="default"
                              icon={<ShoppingOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => setMaterialPickerOpen(true)}
                            >
                              {t('app.kuaizhizao.common.materialBatchSelect')}
                            </Button>
                          </div>
                        )}
                      />
                    </div>
                  </div>
                );
              }}
            </AntForm.List>
        </ProFormItem>
        <ProFormTextArea name="notes" label="备注" placeholder="可选" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendOtherInboundItemsFromMaterials}
      />
    </>
  );
};

export default OtherInboundPage;
