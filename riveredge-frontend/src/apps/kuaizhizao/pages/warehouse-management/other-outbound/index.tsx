/**
 * 其他出库单管理页面
 *
 * 提供其他出库单的创建、查看、确认和管理功能（盘亏/样品/报废/其他）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, InputNumber, Input, Row, Col } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import type { Material } from '../../../../master-data/types/material';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import CodeField from '../../../../../components/code-field';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { getOtherOutboundLifecycle } from '../../../utils/otherOutboundLifecycle';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { useTranslation } from 'react-i18next';

const REASON_TYPES_FALLBACK = [
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
  [key: string]: any;
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [outboundDetail, setOutboundDetail] = useState<OtherOutboundDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [reasonTypeOptions, setReasonTypeOptions] = useState<Array<{ label: string; value: string }>>(REASON_TYPES_FALLBACK);

  const defaultOutboundItem = { material_id: undefined, material_code: '', material_name: '', material_unit: '', outbound_quantity: 1, unit_price: 0 };
  const [reasonTypeLoading, setReasonTypeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const wh = await masterDataWarehouseApi.list({ limit: 1000, isActive: true });
        setWarehouseList(Array.isArray(wh) ? wh : (wh as any)?.items || []);
      } catch (e) {
        console.error('加载仓库失败', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadReasonType = async () => {
      setReasonTypeLoading(true);
      try {
        const dict = await getDataDictionaryByCode('OUTBOUND_REASON_TYPE');
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

  const appendOtherOutboundItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultOutboundItem,
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
    setTimeout(() => formRef.current?.resetFields(), 0);
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = (values.items ?? []).filter((it: any) => it.material_id && (Number(it.outbound_quantity) || 0) > 0);
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效明细');
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = values.warehouse_name ?? wh?.name ?? wh?.warehouse_name ?? '';
      await warehouseApi.otherOutbound.create({
        outbound_code: values.outbound_code,
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
          outbound_quantity: Number(it.outbound_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
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
          createButtonText="新建其他出库单"
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
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条其他出库单吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await warehouseApi.otherOutbound.delete(String(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
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
        title={`其他出库单详情${outboundDetail?.outbound_code ? ` - ${outboundDetail.outbound_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setOutboundDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={outboundDetail || {}}
      >
        {outboundDetail?.items && outboundDetail.items.length > 0 && (
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
              { title: '出库数量', dataIndex: 'outbound_quantity', width: 100, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right' },
              { title: '批次号', dataIndex: 'batch_number', width: 100 },
              { title: '备注', dataIndex: 'notes' },
            ]}
            dataSource={outboundDetail.items}
            pagination={false}
          />
          </>
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
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-other-outbound"
              name="outbound_code"
              label="出库单编号"
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
              <Input.TextArea rows={2} placeholder="可选" />
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
                    dataIndex: 'outbound_quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'outbound_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
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
                        footer={() => (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                            <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultOutboundItem)}>
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
        onConfirm={appendOtherOutboundItemsFromMaterials}
      />
    </>
  );
};

export default OtherOutboundPage;
