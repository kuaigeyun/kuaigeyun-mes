/**
 * 销售预测页面
 *
 * 独立于需求管理的销售预测功能，使用销售预测专用 API 与服务。
 *
 * @author RiverEdge Team
 * @date 2026-02-02
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Drawer, Table, Input, InputNumber, Select, Form as AntForm, DatePicker, Row, Col } from 'antd';
import { EyeOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, SendOutlined, ArrowDownOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  listSalesForecasts,
  getSalesForecast,
  getSalesForecastItems,
  createSalesForecast,
  updateSalesForecast,
  deleteSalesForecast,
  submitSalesForecast,
  approveSalesForecast,
  pushSalesForecastToMrp,
  importSalesForecasts,
  exportSalesForecasts,
  type SalesForecast,
  type SalesForecastItem,
  type SalesForecastListParams,
} from '../../../services/sales-forecast';
import { getDocumentRelations } from '../../../services/document-relation';
import DocumentRelationDisplay from '../../../../../components/document-relation-display';
import type { DocumentRelationData } from '../../../../../components/document-relation-display';
import { materialApi } from '../../../../master-data/services/material';
import type { Material } from '../../../../master-data/types/material';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getSalesForecastLifecycle } from '../../../utils/salesForecastLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';

/** 销售预测状态 */
const SalesForecastStatus = {
  DRAFT: '草稿',
  PENDING_REVIEW: '待审核',
  AUDITED: '已审核',
  REJECTED: '已驳回',
} as const;

/** 审核状态 */
const ReviewStatus = {
  PENDING: '待审核',
  APPROVED: '通过',
  REJECTED: '驳回',
} as const;

/** 展开行：预测明细子表格 */
const ForecastItemsExpandedRow: React.FC<{ forecastId: number }> = ({ forecastId }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SalesForecastItem[]>([]);
  useEffect(() => {
    setLoading(true);
    getSalesForecastItems(forecastId)
      .then((res) => setItems(Array.isArray(res) ? res : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [forecastId]);
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <span>加载中...</span>
      </div>
    );
  }
  const itemColumns = [
    { title: '物料编码', dataIndex: 'material_code', key: 'material_code', width: 120, ellipsis: true },
    { title: '物料名称', dataIndex: 'material_name', key: 'material_name', width: 140, ellipsis: true },
    { title: '规格', dataIndex: 'material_spec', key: 'material_spec', width: 100, ellipsis: true },
    { title: '单位', dataIndex: 'material_unit', key: 'material_unit', width: 60 },
    { title: '预测数量', dataIndex: 'forecast_quantity', key: 'forecast_quantity', width: 100, align: 'right' as const },
    { title: '预测日期', dataIndex: 'forecast_date', key: 'forecast_date', width: 110 },
  ];
  return (
    <div className="sales-forecast-items-subtable" style={{ padding: 0, overflow: 'hidden' }}>
      <Table
        size="small"
        columns={itemColumns}
        dataSource={items}
        rowKey={(r) => r.id ?? r.material_id ?? String(Math.random())}
        pagination={false}
      />
    </div>
  );
};

const SalesForecastsPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentForecast, setCurrentForecast] = useState<SalesForecast | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelationData | null>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(Array.isArray(result) ? result : []);
      } catch (e: any) {
        messageApi.error(e?.message || '加载物料列表失败');
      } finally {
        setMaterialsLoading(false);
      }
    };
    load();
  }, [messageApi]);

  const handleMaterialSelectForForecastItem = (index: number, materialId: number | undefined) => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const next = [...items];
    if (next[index]) {
      const m = materials.find((mo) => mo.id === materialId);
      next[index] = {
        ...next[index],
        material_id: materialId,
        material_code: m ? (m.mainCode || m.code || '') : '',
        material_name: m ? m.name || '' : '',
        material_spec: m ? (m.specification || '') : '',
        material_unit: m ? (m.baseUnit || '') : '',
      };
      formRef.current?.setFieldsValue({ items: next });
    }
  };

  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentId(null);
    setPreviewCode(null);
    formRef.current?.resetFields();
    if (isAutoGenerateEnabled('kuaizhizao-sales-forecast')) {
      const ruleCode = getPageRuleCode('kuaizhizao-sales-forecast');
      if (ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ forecast_code: preview ?? '' });
        } catch (e) {
          console.warn('销售预测编码预生成失败:', e);
          setPreviewCode(null);
        }
      }
    }
    setModalVisible(true);
  };

  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length !== 1) return;
    const id = Number(keys[0]);
    setIsEdit(true);
    setCurrentId(id);
    setModalVisible(true);
    try {
      const [data, itemsRes] = await Promise.all([getSalesForecast(id), getSalesForecastItems(id)]);
      const items = Array.isArray(itemsRes) ? itemsRes : [];
      const itemsForm = items.map((it: SalesForecastItem) => ({
        ...it,
        forecast_date: it.forecast_date ? dayjs(it.forecast_date) : undefined,
      }));
      formRef.current?.setFieldsValue({
        forecast_code: data.forecast_code,
        forecast_name: data.forecast_name,
        forecast_type: data.forecast_type ?? 'MTS',
        forecast_period: data.forecast_period,
        start_date: data.start_date ? dayjs(data.start_date) : undefined,
        end_date: data.end_date ? dayjs(data.end_date) : undefined,
        notes: data.notes,
        items: itemsForm,
      });
    } catch (e: any) {
      messageApi.error(e?.message || '获取详情失败');
    }
  };

  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length !== 1) return;
    const id = Number(keys[0]);
    try {
      const data = await getSalesForecast(id);
      setCurrentForecast(data);
      try {
        const relations = await getDocumentRelations('sales_forecast', id);
        setDocumentRelations(relations);
      } catch {
        setDocumentRelations(null);
      }
      setDrawerVisible(true);
    } catch (e: any) {
      messageApi.error(e?.message || '获取详情失败');
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    if (!keys?.length) {
      messageApi.warning('请选择要删除的记录');
      return;
    }
    modalApi.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${keys.length} 条销售预测吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          for (const k of keys) {
            await deleteSalesForecast(Number(k));
          }
          messageApi.success(`已删除 ${keys.length} 条记录`);
          actionRef.current?.reload();
          if (actionRef.current?.clearSelected) actionRef.current.clearSelected();
        } catch (e: any) {
          messageApi.error(e?.message || '删除失败');
        }
      },
    });
  };

  const formatItem = (it: any) => {
    const fd = it.forecast_date;
    const forecastDateStr =
      fd == null ? undefined
        : typeof fd?.format === 'function' ? fd.format('YYYY-MM-DD')
        : typeof fd === 'string' ? fd.slice(0, 10) : undefined;
    return {
      material_id: it.material_id,
      material_code: it.material_code ?? '',
      material_name: it.material_name ?? '',
      material_spec: it.material_spec ?? undefined,
      material_unit: it.material_unit ?? '',
      forecast_quantity: Number(it.forecast_quantity) || 0,
      forecast_date: forecastDateStr,
      historical_sales: it.historical_sales != null ? Number(it.historical_sales) : undefined,
      notes: it.notes ?? undefined,
    };
  };

  const handleSave = async (values: any) => {
    try {
      const rawItems = values.items ?? [];
      if (!rawItems.length) {
        messageApi.warning('请至少添加一条预测明细');
        return;
      }
      const items = rawItems.map(formatItem).filter((it: any) => it.material_id && it.forecast_quantity > 0 && it.forecast_date);
      if (!items.length) {
        messageApi.warning('请填写完整的预测明细（物料、数量、预测日期）');
        return;
      }
      let forecastCode: string | undefined;
      if (!isEdit) {
        forecastCode = values.forecast_code;
        if (isAutoGenerateEnabled('kuaizhizao-sales-forecast')) {
          const ruleCode = getPageRuleCode('kuaizhizao-sales-forecast');
          if (ruleCode && (forecastCode === previewCode || !forecastCode)) {
            try {
              const codeResponse = await generateCode({ rule_code: ruleCode });
              forecastCode = codeResponse.code;
            } catch (e) {
              console.warn('销售预测编码正式生成失败，使用当前值:', e);
            }
          }
        }
        if (!forecastCode) forecastCode = undefined;
      }
      const basePayload = {
        forecast_name: values.forecast_name,
        forecast_type: values.forecast_type ?? 'MTS',
        forecast_period: values.forecast_period,
        start_date: typeof values.start_date?.format === 'function' ? values.start_date.format('YYYY-MM-DD') : values.start_date,
        end_date: typeof values.end_date?.format === 'function' ? values.end_date.format('YYYY-MM-DD') : values.end_date,
        notes: values.notes,
      };
      if (isEdit && currentId) {
        const res = await updateSalesForecast(currentId, { ...basePayload, items });
        const syncTip = '已同步至关联需求，若已下推计算请前往需求计算重新执行。';
        messageApi.success(res?.demand_synced ? `更新成功。${syncTip}` : '更新成功');
      } else {
        await createSalesForecast({ ...basePayload, forecast_code: forecastCode, items } as SalesForecast);
        messageApi.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败');
      throw e;
    }
  };

  const handlePushToMrp = (id: number) => {
    modalApi.confirm({
      title: '下推到需求计算',
      content: '确定要将此销售预测下推到需求计算吗？',
      onOk: async () => {
        try {
          await pushSalesForecastToMrp(id);
          messageApi.success('下推成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.message || '下推失败');
        }
      },
    });
  };

  const handleImport = async (data: any[][]) => {
    if (!data?.length) {
      messageApi.warning('导入数据为空');
      return;
    }
    try {
      const result = await importSalesForecasts(data);
      if (result.failure_count === 0) {
        messageApi.success(`导入成功，共 ${result.success_count} 条`);
      } else {
        messageApi.warning(`导入完成：成功 ${result.success_count} 条，失败 ${result.failure_count} 条`);
      }
      if (result.success_count > 0) actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '导入失败');
    }
  };

  const handleExport = async () => {
    try {
      const params: SalesForecastListParams = {};
      const blob = await exportSalesForecasts(params);
      const url = window.URL.createObjectURL(blob as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_forecasts_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      messageApi.success('导出成功');
    } catch (e: any) {
      messageApi.error(e?.message || '导出失败');
    }
  };

  const columns: ProColumns<SalesForecast>[] = [
    { title: '预测编码', dataIndex: 'forecast_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '预测名称', dataIndex: 'forecast_name', width: 180, ellipsis: true },
    { title: '类型', dataIndex: 'forecast_type', width: 80, valueEnum: { MTS: { text: 'MTS' } } },
    { title: '预测周期', dataIndex: 'forecast_period', width: 100 },
    { title: '开始日期', dataIndex: 'start_date', valueType: 'date', width: 110 },
    { title: '结束日期', dataIndex: 'end_date', valueType: 'date', width: 110 },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueType: 'select',
      valueEnum: {
        草稿: { text: '草稿' },
        待审核: { text: '待审核' },
        已审核: { text: '已审核' },
        已下推: { text: '已下推' },
        已驳回: { text: '已驳回' },
      },
      render: (_: unknown, record: SalesForecast) => {
        const lifecycle = getSalesForecastLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = {
          草稿: 'default',
          待审核: 'warning',
          已审核: 'green',
          已下推: 'blue',
          已驳回: 'error',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail([record.id!])}>
            详情
          </Button>
          {record.status === SalesForecastStatus.DRAFT && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit([record.id!])}>
                编辑
              </Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete([record.id!])}>
                删除
              </Button>
            </>
          )}
          <UniWorkflowActions
            record={record}
            entityName="销售预测"
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[SalesForecastStatus.DRAFT]}
            pendingStatuses={[SalesForecastStatus.PENDING_REVIEW]}
            approvedStatuses={[SalesForecastStatus.AUDITED]}
            rejectedStatuses={[SalesForecastStatus.REJECTED]}
            theme="link"
            size="small"
            actions={{
              submit: (id) => submitSalesForecast(id),
              approve: (id) => approveSalesForecast(id),
              reject: (id, reason) => approveSalesForecast(id, reason || ''),
            }}
            onSuccess={() => actionRef.current?.reload()}
          />
          {record.status === SalesForecastStatus.AUDITED && (
            <Button type="link" size="small" icon={<ArrowDownOutlined />} onClick={() => handlePushToMrp(record.id!)}>
              下推需求计算
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<SalesForecast>
          headerTitle="销售预测"
          actionRef={actionRef}
          columns={columns}
          request={async (params: any, sort: any, _filter: any, searchFormValues: any) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };
            if (searchFormValues?.lifecycle) apiParams.status = searchFormValues.lifecycle;
            else if (searchFormValues?.status) apiParams.status = searchFormValues.status;
            if (searchFormValues?.forecast_period) apiParams.forecast_period = searchFormValues.forecast_period;
            if (searchFormValues?.keyword) apiParams.keyword = searchFormValues.keyword;
            try {
              const response = await listSalesForecasts(apiParams);
              const data = (response as any).data ?? (Array.isArray(response) ? response : []);
              const total = (response as any).total ?? data.length;
              return { data, success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || '获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          expandable={{
            expandedRowRender: (record) =>
              record.id != null ? <ForecastItemsExpandedRow forecastId={record.id} /> : null,
            rowExpandable: (record) => record.id != null,
          }}
          showCreateButton={true}
          onCreate={handleCreate}
          showEditButton={true}
          onEdit={handleEdit}
          showDeleteButton={true}
          onDelete={handleDelete}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={['预测名称', '预测周期', '开始日期', '结束日期', '备注']}
          importExampleRow={['2026年1月预测', '2026-01', '2026-01-01', '2026-01-31', '示例']}
          showExportButton={true}
          onExport={async () => { await handleExport(); }}
        />
      </ListPageTemplate>

      <Modal
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        title={isEdit ? '编辑销售预测' : '新建销售预测'}
        width={1200}
        footer={null}
        destroyOnHidden
      >
        <ProForm
          formRef={formRef}
          onFinish={handleSave}
          layout="vertical"
          submitter={{
            searchConfig: { submitText: isEdit ? '更新' : '提交', resetText: '取消' },
            resetButtonProps: { onClick: () => setModalVisible(false) },
            render: (_, dom) => (
              <div style={{ textAlign: 'left', marginTop: 16 }}>
                <Space>{dom}</Space>
              </div>
            ),
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="forecast_code"
                label="预测编码"
                placeholder={isAutoGenerateEnabled('kuaizhizao-sales-forecast') ? '编码将根据编码规则自动生成，可修改' : '请输入预测编码'}
                fieldProps={{ disabled: isEdit }}
              />
            </Col>
            <Col span={12}>
              <ProFormText name="forecast_name" label="预测名称" placeholder="请输入预测名称" rules={[{ required: true }]} />
            </Col>
            <Col span={6}>
              <ProFormText name="forecast_period" label="预测周期" placeholder="如 2026-01" rules={[{ required: true }]} />
            </Col>
            <Col span={6}>
              <ProFormDatePicker name="start_date" label="开始日期" fieldProps={{ style: { width: '100%' } }} rules={[{ required: true }]} />
            </Col>
            <Col span={6}>
              <ProFormDatePicker name="end_date" label="结束日期" fieldProps={{ style: { width: '100%' } }} rules={[{ required: true }]} />
            </Col>
          </Row>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
                <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
                预测明细
              </span>
            </div>
            <ProForm.Item name="items" noStyle rules={[{ type: 'array' as const, min: 1, message: '请至少添加一条预测明细' }]}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const cols = [
                    {
                      title: '物料',
                      dataIndex: 'material_id',
                      width: 200,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_id']} rules={[{ required: true, message: '请选择物料' }]} style={{ margin: 0 }}>
                          <Select
                            placeholder="请选择物料"
                            showSearch
                            allowClear
                            size="small"
                            style={{ width: '100%' }}
                            loading={materialsLoading}
                            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                            options={materials.map((m) => ({ label: `${m.mainCode || m.code || ''} - ${m.name || ''}`, value: m.id }))}
                            onChange={(id) => handleMaterialSelectForForecastItem(index, id as number)}
                          />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '规格',
                      dataIndex: 'material_spec',
                      width: 120,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                          <Input placeholder="规格" size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '单位',
                      dataIndex: 'material_unit',
                      width: 80,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                          <Input placeholder="单位" size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '预测数量',
                      dataIndex: 'forecast_quantity',
                      width: 110,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'forecast_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number' as const, min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                          <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '预测日期',
                      dataIndex: 'forecast_date',
                      width: 120,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'forecast_date']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                          <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '历史销量',
                      dataIndex: 'historical_sales',
                      width: 100,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'historical_sales']} style={{ margin: 0 }}>
                          <InputNumber placeholder="选填" min={0} precision={2} style={{ width: '100%' }} size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '备注',
                      dataIndex: 'notes',
                      width: 100,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                          <Input placeholder="选填" size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '操作',
                      width: 70,
                      fixed: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                          删除
                        </Button>
                      ),
                    },
                  ];
                  const totalWidth = cols.reduce((s, c) => s + (c.width as number || 0), 0);
                  return (
                    <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                      <style>{`
                        .sales-forecast-detail-table .ant-table-thead > tr > th {
                          background-color: var(--ant-color-fill-alter) !important;
                          font-weight: 600;
                        }
                        .sales-forecast-detail-table .ant-table { border-top: 1px solid var(--ant-color-border); }
                        .sales-forecast-detail-table .ant-table-tbody > tr > td { border-bottom: 1px solid var(--ant-color-border); }
                      `}</style>
                      <div style={{ width: '100%', overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch' }}>
                        <Table
                          className="sales-forecast-detail-table"
                          size="small"
                          dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                          rowKey="key"
                          pagination={false}
                          columns={cols}
                          scroll={{ x: totalWidth }}
                          style={{ width: '100%', margin: 0 }}
                          footer={() => (
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                const mainEnd = formRef.current?.getFieldValue('end_date');
                                const defaultDate = mainEnd != null ? (dayjs.isDayjs(mainEnd) ? mainEnd : dayjs(mainEnd)) : dayjs();
                                add({
                                  material_id: undefined,
                                  material_code: '',
                                  material_name: '',
                                  material_spec: '',
                                  material_unit: '',
                                  forecast_quantity: undefined,
                                  forecast_date: defaultDate,
                                  historical_sales: undefined,
                                  notes: '',
                                });
                              }}
                              block
                            >
                              添加明细
                            </Button>
                          )}
                        />
                      </div>
                    </div>
                  );
                }}
              </AntForm.List>
            </ProForm.Item>
          </div>
          <ProFormTextArea name="notes" label="备注" placeholder="选填" fieldProps={{ rows: 2 }} />
        </ProForm>
      </Modal>

      <Drawer
        title="销售预测详情"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width="50%"
        styles={{ wrapper: { width: '50%' } }}
      >
        {currentForecast && (
          <>
            <ProDescriptions
              column={1}
              dataSource={currentForecast}
              columns={[
                { title: '预测编码', dataIndex: 'forecast_code' },
                { title: '预测名称', dataIndex: 'forecast_name' },
                { title: '类型', dataIndex: 'forecast_type' },
                { title: '预测周期', dataIndex: 'forecast_period' },
                { title: '开始日期', dataIndex: 'start_date' },
                { title: '结束日期', dataIndex: 'end_date' },
                { title: '状态', dataIndex: 'status' },
                { title: '审核状态', dataIndex: 'review_status' },
                { title: '备注', dataIndex: 'notes' },
              ]}
            />
            {(() => {
              const lifecycle = getSalesForecastLifecycle(currentForecast);
              const mainStages = lifecycle.mainStages ?? [];
              const subStages = lifecycle.subStages ?? [];
              if (mainStages.length === 0 && subStages.length === 0) return null;
              return (
                <div style={{ marginTop: 24, marginBottom: 24 }}>
                  <h4 style={{ marginBottom: 12 }}>生命周期状态</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {mainStages.length > 0 && (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                      />
                    )}
                    {subStages.length > 0 && (
                      <div>
                        <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                          执行中 · 全链路
                        </div>
                        <UniLifecycleStepper steps={subStages} showLabels />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {currentForecast.id != null && (
              <>
                <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 600 }}>预测明细</div>
                <ForecastItemsExpandedRow forecastId={currentForecast.id} />
              </>
            )}
            {currentForecast.id != null && (
              <div style={{ marginTop: 24 }}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>操作历史</div>
                <DocumentTrackingPanel documentType="sales_forecast" documentId={currentForecast.id} />
              </div>
            )}
            {documentRelations && (
              <div style={{ marginTop: 24 }}>
                <DocumentRelationDisplay relations={documentRelations} />
              </div>
            )}
            <div style={{ marginTop: 24 }}>
              <Space>
                {currentForecast.status === SalesForecastStatus.DRAFT && (
                  <Button onClick={() => { setDrawerVisible(false); handleEdit([currentForecast.id!]); }}>编辑</Button>
                )}
                <UniWorkflowActions
                  record={currentForecast}
                  entityName="销售预测"
                  statusField="status"
                  reviewStatusField="review_status"
                  draftStatuses={[SalesForecastStatus.DRAFT]}
                  pendingStatuses={[SalesForecastStatus.PENDING_REVIEW]}
                  approvedStatuses={[SalesForecastStatus.AUDITED]}
                  rejectedStatuses={[SalesForecastStatus.REJECTED]}
                  actions={{
                    submit: (id) => submitSalesForecast(id),
                    approve: (id) => approveSalesForecast(id),
                    reject: (id, reason) => {
                      if (!reason?.trim()) throw new Error('请输入驳回原因');
                      return approveSalesForecast(id, reason.trim());
                    },
                  }}
                  onSuccess={() => {
                    actionRef.current?.reload();
                    setDrawerVisible(false);
                  }}
                />
                {currentForecast.status === SalesForecastStatus.AUDITED && (
                  <Button type="primary" onClick={() => handlePushToMrp(currentForecast.id!)}>下推需求计算</Button>
                )}
              </Space>
            </div>
          </>
        )}
      </Drawer>
    </>
  );
};

export default SalesForecastsPage;
