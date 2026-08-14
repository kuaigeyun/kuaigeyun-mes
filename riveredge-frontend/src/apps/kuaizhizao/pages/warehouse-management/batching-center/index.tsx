import { formatQuantity } from '../../../../../utils/format';
import { toApiDateTimeString, nowSiteDateTimeString } from '../../../../../utils/formDate';
/**
 * 物料中心页面
 *
 * 集中处理工单线边备料、产线补料、委外收发等物料流转作业。
 *
 * Author: Luigi Lu
 * Date: 2026-02-28
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ProFormTextArea, ProFormDatePicker, ProFormRadio, ProFormDependency, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form as AntForm, InputNumber, Row, Col, Tooltip, Alert, Spin, Empty } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ShoppingOutlined,
  PhoneOutlined,
  CarryOutOutlined,
  BulbOutlined,
  WarningOutlined,
  ExportOutlined,
  ImportOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniPullQueryModal, filterByPullScope, paginatePullRows, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  MultiTabListPageTemplate,
  FormModalTemplate,
  MODAL_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { batchingOrderApi } from '../../../services/batching-order';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { batchingOrderCapabilityReasonMessage } from '../../../../../hooks/useDocumentCapabilities';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import BatchingTaskQueue from './BatchingTaskQueue';
import LineSidePrepSplitView from './LineSidePrepSplitView';
import OutsourceMaterialPanel from './OutsourceMaterialPanel';
import {
  MaterialCenterDetailDrawer,
  loadMaterialCenterDetail,
  type MaterialCenterDetailRequest,
} from './materialCenterDetail';
import {
  getMaterialCenterTabs,
  DEFAULT_MATERIAL_CENTER_TAB,
  isBatchingTaskTab,
  resolveMaterialCenterTabKey,
  type MaterialCenterTabKey,
  type BatchingTaskTabKey,
} from './materialCenterTabs';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { buildWorkOrderLifecycleValueEnum, translateWorkOrderLifecycleStatus } from '../../../utils/workOrderLifecycle';

const MATERIAL_CENTER_RESOURCE = 'kuaizhizao:warehouse-management-batching-center';

interface PullWorkOrderCandidate {
  id: number;
  code: string;
  name?: string;
  status?: string;
  planned_quantity?: number;
  pullable?: boolean;
  capabilities?: {
    push_batching_order?: { allowed?: boolean; reason?: string | null };
  };
}

type BatchingPullPreview = {
  work_order_id: number;
  work_order_code: string;
  items: Array<{
    item_id: number;
    material_code: string;
    material_name: string;
    quantity: number;
    pushed_quantity: number;
    max_push_quantity: number;
  }>;
  summary?: string;
  has_blocking_issues?: boolean;
  blocking_reason?: string | null;
};

const BatchingCenterPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'batching_order.pull_from_work_order');
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(MATERIAL_CENTER_RESOURCE);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [searchParams] = useSearchParams();
  const materialCenterTabs = useMemo(() => getMaterialCenterTabs(t), [t]);
  const workOrderStatusValueEnum = useMemo(() => buildWorkOrderLifecycleValueEnum(t), [t]);

  const renderWorkOrderStatusTag = useCallback(
    (status?: string | null) => {
      const raw = String(status ?? '').trim();
      if (!raw) return '-';
      const item = workOrderStatusValueEnum[raw];
      if (item) {
        const colorByProStatus: Record<string, string> = {
          Default: 'default',
          Processing: 'processing',
          Success: 'success',
          Error: 'error',
          Warning: 'warning',
        };
        return <Tag color={colorByProStatus[item.status ?? 'Default']} variant="solid">{item.text}</Tag>;
      }
      const label = translateWorkOrderLifecycleStatus(t, raw);
      return <Tag variant="solid">{label}</Tag>;
    },
    [t, workOrderStatusValueEnum],
  );
  const initialTab = useMemo(() => {
    const tab = searchParams.get('tab');
    const aliased = resolveMaterialCenterTabKey(tab);
    if (aliased) return aliased;
    if (tab && materialCenterTabs.some((item) => item.key === tab)) {
      return tab as MaterialCenterTabKey;
    }
    return DEFAULT_MATERIAL_CENTER_TAB;
  }, [searchParams, materialCenterTabs]);
  const [activeTabKey, setActiveTabKey] = useState<MaterialCenterTabKey>(initialTab);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [selectedPullWorkOrder, setSelectedPullWorkOrder] = useState<PullWorkOrderCandidate | null>(null);
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<BatchingPullPreview | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRequest, setDetailRequest] = useState<MaterialCenterDetailRequest | null>(null);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const formRef = useRef<any>(null);
  const pullQueryCloseRef = useRef<(() => void) | null>(null);
  const defaultBatchingItem = { material_id: undefined, material_code: '', material_name: '', material_unit: '', required_quantity: 1 };

  const appendBatchingItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        ...defaultBatchingItem,
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
  const handleCreate = (workOrderId?: number) => {
    setCreateModalVisible(true);
    setTimeout(() => {
      formRef.current?.resetFields();
      formRef.current?.setFieldsValue({
        create_mode: 'from_work_order',
        batching_date: dayjs(),
        work_order_id: workOrderId,
        work_order_code: '',
        items: [defaultBatchingItem],
      });
      setSelectedPullWorkOrder(null);
    }, 0);
  };

  const resetPullPreviewModal = useCallback(() => {
    setPullPreviewOpen(false);
    setPullPreviewData(null);
    setPullPreviewLoading(false);
  }, []);

  const showPullPreview = useCallback(
    (candidate: PullWorkOrderCandidate) => {
      pullQueryCloseRef.current?.();
      setPullPreviewOpen(true);
      setPullPreviewLoading(true);
      setPullPreviewData(null);
      batchingOrderApi
        .previewFromWorkOrder(candidate.id)
        .then((res) => setPullPreviewData(res as BatchingPullPreview))
        .catch((error: unknown) => {
          messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.batchingCenter.pullPreviewFailed')));
          resetPullPreviewModal();
        })
        .finally(() => setPullPreviewLoading(false));
    },
    [messageApi, resetPullPreviewModal, t],
  );

  const handlePullPreviewConfirm = useCallback(() => {
    if (!pullPreviewData || pullPreviewData.has_blocking_issues) return;
    if (!(pullPreviewData.items || []).some((row) => Number(row.max_push_quantity ?? 0) > 0)) {
      messageApi.warning(t('app.kuaizhizao.batchingCenter.pullPreviewNoLines'));
      return;
    }
    setSelectedPullWorkOrder({
      id: pullPreviewData.work_order_id,
      code: pullPreviewData.work_order_code,
    });
    formRef.current?.setFieldsValue({
      work_order_id: pullPreviewData.work_order_id,
      work_order_code: pullPreviewData.work_order_code,
    });
    resetPullPreviewModal();
  }, [messageApi, pullPreviewData, resetPullPreviewModal, t]);

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const isPullBatchingWorkOrderSelectable = useCallback(
    (record: PullWorkOrderCandidate) => record.capabilities?.push_batching_order?.allowed !== false,
    [],
  );

  const pullFromWorkOrderQuery = useUniPullQuery<PullWorkOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      const res = await batchingOrderApi.listPullCandidates({
        skip: 0,
        limit: 200,
        keyword: keyword.trim() || undefined,
      });
      const data = Array.isArray(res?.data) ? res.data : [];
      const filtered = filterByPullScope(data, scope, isPullBatchingWorkOrderSelectable);
      return paginatePullRows(filtered, page, pageSize);
    },
    isRowDisabled: (record) => !isPullBatchingWorkOrderSelectable(record),
    onConfirm: async (_selectedKeys, selectedRows) => {
      const selected = selectedRows?.[0];
      if (!selected) {
        messageApi.warning(t('app.kuaizhizao.batchingCenter.selectWorkOrder'));
        return;
      }
      if (selected.capabilities?.push_batching_order?.allowed === false) {
        messageApi.warning(
          batchingOrderCapabilityReasonMessage(selected.capabilities?.push_batching_order?.reason, t)
            || t('app.kuaizhizao.batchingCenter.cannotPull'),
        );
        return;
      }
      showPullPreview(selected);
    },
  });

  pullQueryCloseRef.current = pullFromWorkOrderQuery.closeModal;

  const handleCreateSubmit = async (values: any) => {
    try {
      if (values.create_mode === 'from_work_order') {
        if (!values.work_order_id) {
          messageApi.error(t('app.kuaizhizao.batchingCenter.selectWorkOrder'));
          throw new Error('请选择工单');
        }
        await batchingOrderApi.pullFromWorkOrder({
          work_order_id: values.work_order_id,
          warehouse_id: values.warehouse_id || undefined,
          warehouse_name: values._warehouse_name || undefined,
          batching_date: toApiDateTimeString(values.batching_date) ?? nowSiteDateTimeString(),
          target_warehouse_id: values.target_warehouse_id || undefined,
          target_warehouse_name: values._target_warehouse_name || undefined,
          remarks: values.remarks,
          attachments: normalizeDocumentAttachments(values.attachments),
        });
        messageApi.success(t('app.kuaizhizao.batchingCenter.pullFromWorkOrderSuccess'));
      } else {
        const items = values.items || [];
        if (items.length === 0) {
          messageApi.error(t('app.kuaizhizao.batchingCenter.manualNeedItems'));
          throw new Error(t('app.kuaizhizao.batchingCenter.manualNeedItems'));
        }
        const orderData: any = {
          warehouse_id: values.warehouse_id,
          warehouse_name: values._warehouse_name || '',
          batching_date: toApiDateTimeString(values.batching_date) ?? nowSiteDateTimeString(),
          remarks: values.remarks,
          attachments: normalizeDocumentAttachments(values.attachments),
        };
        const itemPayload = items.map((it: any) => ({
          material_id: it.material_id,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          unit: it.material_unit || '',
          required_quantity: Number(it.required_quantity) || 0,
          warehouse_id: values.warehouse_id,
          warehouse_name: values._warehouse_name || '',
        }));
        await batchingOrderApi.create({ ...orderData, items: itemPayload });
        messageApi.success(t('app.kuaizhizao.batchingCenter.createSuccess'));
      }
      setCreateModalVisible(false);
      formRef.current?.resetFields();
      setSelectedPullWorkOrder(null);
      invalidateMenuBadgeCounts();
    } catch (error: any) {
      if (error.message && !error.message.includes('请选择') && !error.message.includes('请添加')) {
        messageApi.error(error.message || t('app.kuaizhizao.batchingCenter.createFailed'));
      }
      throw error;
    }
  };

  const openMaterialCenterDetail = useCallback((request: MaterialCenterDetailRequest) => {
    setDetailRequest(request);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    loadMaterialCenterDetail(request)
      .then((data) => setDetailData(data))
      .catch((error: unknown) => {
        messageApi.error(getApiErrorMessage(error, t('common.loadFailed')));
        setDetailOpen(false);
        setDetailRequest(null);
      })
      .finally(() => setDetailLoading(false));
  }, [messageApi, t]);

  const closeMaterialCenterDetail = useCallback(() => {
    setDetailOpen(false);
    setDetailRequest(null);
    setDetailData(null);
  }, []);

  const tabIcons: Record<MaterialCenterTabKey, React.ReactNode> = {
    line_side_prep: <CarryOutOutlined />,
    batching_draft: <CarryOutOutlined />,
    material_call: <PhoneOutlined />,
    outsource_issue: <ExportOutlined />,
    outsource_receipt: <ImportOutlined />,
    outsource_material_return: <RollbackOutlined />,
    outsource_product_return: <RollbackOutlined />,
    proactive_prep: <BulbOutlined />,
    backflush_alert: <WarningOutlined />,
  };

  const taskTabs = useMemo(
    () =>
      materialCenterTabs.map((tab) => ({
        key: tab.key,
        label: (
          <Tooltip title={tab.hint}>
            <Space size={4}>
              {tabIcons[tab.key]}
              <span>{tab.label}</span>
            </Space>
          </Tooltip>
        ),
        children:
          tab.key === 'line_side_prep' ? (
            <LineSidePrepSplitView
              onCreate={() => handleCreate()}
              onOpenDetail={openMaterialCenterDetail}
              canRead={perms.canRead}
              onRefreshBatchingList={invalidateMenuBadgeCounts}
            />
          ) : isBatchingTaskTab(tab.key) ? (
            <BatchingTaskQueue
              taskType={tab.key as BatchingTaskTabKey}
              onOpenDetail={openMaterialCenterDetail}
              canRead={perms.canRead}
              onRefreshBatchingList={invalidateMenuBadgeCounts}
            />
          ) : (
            <OutsourceMaterialPanel mode={tab.key} onOpenDetail={openMaterialCenterDetail} canRead={perms.canRead} />
          ),
      })),
    [materialCenterTabs, invalidateMenuBadgeCounts, openMaterialCenterDetail, perms.canRead, t],
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={(key) => setActiveTabKey(key as MaterialCenterTabKey)}
        tabs={taskTabs}
      />

      {/* 新建线边备料单 Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.batchingCenter.createModalTitle')}
        open={createModalVisible}
        onClose={() => {
          setCreateModalVisible(false);
          formRef.current?.resetFields();
          setSelectedPullWorkOrder(null);
        }}
        onFinish={handleCreateSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        grid={false}
      >
        <ProFormRadio.Group
          name="create_mode"
          label={t('app.kuaizhizao.batchingCenter.createMode')}
          options={[
            { label: pullFromWorkOrderAction.label, value: 'from_work_order' },
            { label: t('app.kuaizhizao.batchingCenter.createManual'), value: 'manual' },
          ]}
          rules={[{ required: true }]}
        />
        <ProFormDependency name={['create_mode']}>
          {({ create_mode }) =>
            create_mode === 'from_work_order' ? (
              <>
                <ProFormItem
                  name="work_order_id"
                  hidden
                  rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.selectWorkOrder') }]}
                />
                <ProFormItem name="work_order_code" hidden />
                <ProFormItem
                  label={t('app.kuaizhizao.warehouseCommon.colWorkOrder')}
                  required
                  extra={
                    selectedPullWorkOrder?.name
                      ? `${selectedPullWorkOrder.code} - ${selectedPullWorkOrder.name}`
                      : undefined
                  }
                >
                  <Space>
                    <Button onClick={() => pullFromWorkOrderQuery.openModal()}>
                      {t('app.kuaizhizao.batchingCenter.selectWorkOrder')}
                    </Button>
                    {selectedPullWorkOrder?.code ? <Tag>{selectedPullWorkOrder.code}</Tag> : null}
                  </Space>
                </ProFormItem>
              </>
            ) : null
          }
        </ProFormDependency>
        <ProFormDependency name={['create_mode']}>
          {({ create_mode }) =>
            create_mode === 'manual' ? (
              <div className="uni-table-detail" style={{ width: '100%' }}>
                <UniTableDetailHeader title={t('app.kuaizhizao.batchingCenter.batchingItems')} required />
                <AntForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.batchingCenter.minOneItem') }]}>
                  <AntForm.List name="items">
                    {(fields, { add, remove }) => {
                      const cols = [
                        {
                          title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
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
                                      placeholder={t('app.kuaizhizao.warehouseCommon.selectMaterial')}
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
                          title: t('app.kuaizhizao.batchingCenter.requiredQty'),
                          dataIndex: 'required_quantity',
                          width: 120,
                          align: 'right' as const,
                          render: (_: any, __: any, index: number) => (
                            <AntForm.Item name={[index, 'required_quantity']} rules={[{ required: true, message: t('app.kuaizhizao.warehouseCommon.required') }, { type: 'number', min: 0.0001, message: t('app.kuaizhizao.batchingCenter.qtyGtZero') }]} style={{ margin: 0 }}>
                              <InputNumber placeholder={t('app.kuaizhizao.warehouseCommon.colQuantity')} min={0} precision={4} style={{ width: '100%' }} size="small" />
                            </AntForm.Item>
                          ),
                        },
                        {
                          title: t('app.kuaizhizao.warehouseCommon.colActions'),
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
                                  <Button type="dashed" icon={<PlusOutlined />} style={{ flex: 1, minWidth: 120 }} onClick={() => add(defaultBatchingItem)}>
                                    {t('app.kuaizhizao.warehouseCommon.addItem')}
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
                </AntForm.Item>
              </div>
            ) : null
          }
        </ProFormDependency>
        <Row gutter={16}>
          <Col span={12}>
            <UniWarehouseSelect
              name="warehouse_id"
              label={t('app.kuaizhizao.batchingCenter.pickingWarehouse')}
              placeholder={t('app.kuaizhizao.batchingCenter.selectPickingWarehouse')}
              required
              onChange={(val, wh) => formRef.current?.setFieldsValue({ _warehouse_name: wh?.name })}
            />
          </Col>
          <Col span={12}>
            <UniWarehouseSelect
              name="target_warehouse_id"
              label={t('app.kuaizhizao.batchingCenter.targetLineSideWarehouse')}
              placeholder={t('app.kuaizhizao.batchingCenter.selectTargetLineSideWarehouse')}
              onChange={(val, wh) => formRef.current?.setFieldsValue({ _target_warehouse_name: wh?.name })}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="batching_date"
              label={t('app.kuaizhizao.batchingCenter.batchingDate')}
              rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.selectBatchingDate') }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12} />
        </Row>
        <DocumentAttachmentsField category="batching_order_attachments" />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.warehouseCommon.colRemarks')}
          placeholder={t('app.kuaizhizao.warehouseCommon.placeholderRemarks')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <UniMaterialBatchPicker
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendBatchingItemsFromMaterials}
      />

      <UniPullQueryModal<PullWorkOrderCandidate>
        open={pullFromWorkOrderQuery.open}
        title={pullFromWorkOrderAction.label}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={pullFromWorkOrderQuery.handleConfirm}
        columns={[
          { title: t('app.kuaizhizao.warehouseCommon.colWorkOrderCode'), dataIndex: 'code', width: 180 },
          { title: t('app.kuaizhizao.warehouseCommon.colWorkOrderName'), dataIndex: 'name', width: 220 },
          {
            title: t('app.kuaizhizao.warehouseCommon.colStatus'),
            dataIndex: 'status',
            width: 140,
            align: 'center' as const,
            render: (_: unknown, r: PullWorkOrderCandidate) => renderWorkOrderStatusTag(r.status),
          },
          { title: t('app.kuaizhizao.batchingCenter.requiredQty'), dataIndex: 'planned_quantity', width: 120 },
          {
            title: t('app.kuaizhizao.batchingCenter.pullGateStatus'),
            key: 'gate_status',
            width: 180,
            align: 'center' as const,
            render: (_: unknown, r: PullWorkOrderCandidate) =>
              r.capabilities?.push_batching_order?.allowed === false ? (
                <Tag color="gold">
                  {batchingOrderCapabilityReasonMessage(r.capabilities?.push_batching_order?.reason, t)
                    || t('app.kuaizhizao.batchingCenter.cannotPull')}
                </Tag>
              ) : (
                <Tag color="success">{t('app.kuaizhizao.batchingCenter.canPull')}</Tag>
              ),
          },
        ]}
        rowKey="id"
        dataSource={pullFromWorkOrderQuery.dataSource}
        loading={pullFromWorkOrderQuery.loading}
        confirmLoading={pullFromWorkOrderQuery.confirmLoading}
        selectionType={pullFromWorkOrderQuery.selectionType}
        selectedRowKeys={pullFromWorkOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromWorkOrderQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromWorkOrderQuery.isRowDisabled}
        searchDraft={pullFromWorkOrderQuery.searchDraft}
        onSearchDraftChange={pullFromWorkOrderQuery.setSearchDraft}
        onSearchApply={pullFromWorkOrderQuery.handleSearchApply}
        onSearchClear={pullFromWorkOrderQuery.handleSearchClear}
        appliedKeyword={pullFromWorkOrderQuery.appliedKeyword}
        page={pullFromWorkOrderQuery.page}
        pageSize={pullFromWorkOrderQuery.pageSize}
        total={pullFromWorkOrderQuery.total}
        onPageChange={pullFromWorkOrderQuery.handlePageChange}
        scopeOptions={pullFromWorkOrderQuery.scopeOptions}
        scope={pullFromWorkOrderQuery.scope}
        onScopeChange={pullFromWorkOrderQuery.handleScopeChange}
        searchPlaceholder={t('app.kuaizhizao.warehouseCommon.searchWorkOrderCodeOrName')}
        okText={t('app.kuaizhizao.warehouseOutbound.action.nextStep')}
        cancelText={t('common.cancel')}
        okButtonProps={{ disabled: pullFromWorkOrderQuery.selectedRowKeys.length === 0 }}
      />

      <Modal
        title={pullFromWorkOrderAction.label}
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreviewModal}
        okText={t('app.kuaizhizao.batchingCenter.confirmPullPreview')}
        cancelText={t('common.cancel')}
        onOk={handlePullPreviewConfirm}
        okButtonProps={{
          disabled:
            pullPreviewLoading
            || !pullPreviewData
            || !!pullPreviewData?.has_blocking_issues
            || !(pullPreviewData?.items || []).some((row) => Number(row.max_push_quantity ?? 0) > 0),
        }}
      >
        {pullPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
          </div>
        ) : pullPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
            {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={pullPreviewData.blocking_reason} />
            ) : null}
            {(pullPreviewData.items || []).length > 0 ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                columns={[
                  { title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'), dataIndex: 'material_code', width: 130 },
                  { title: t('app.kuaizhizao.warehouseCommon.colMaterialName'), dataIndex: 'material_name', width: 160 },
                  { title: t('app.kuaizhizao.batchingCenter.requiredQty'), dataIndex: 'quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.warehouseCommon.colPickedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.batchingCenter.batchableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' , render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.batchingCenter.pullPreviewNoLines')} />
            )}
          </div>
        ) : null}
      </Modal>

      <MaterialCenterDetailDrawer
        kind={detailRequest?.kind ?? null}
        open={detailOpen}
        loading={detailLoading}
        detail={detailData}
        onClose={closeMaterialCenterDetail}
      />
    </>
  );
};

export default BatchingCenterPage;
