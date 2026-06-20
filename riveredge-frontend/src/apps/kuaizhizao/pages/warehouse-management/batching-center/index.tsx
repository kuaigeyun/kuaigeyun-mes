/**
 * 物料中心页面
 *
 * 集中处理工单配料、产线叫料、委外收发等物料流转作业。
 *
 * Author: Luigi Lu
 * Date: 2026-02-28
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ProFormTextArea, ProFormDatePicker, ProFormRadio, ProFormDependency, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Card, Table, Form as AntForm, InputNumber, Row, Col, Tooltip } from 'antd';
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
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  MultiTabListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  WAREHOUSE_DETAIL_TABLE_STYLES,
} from '../../../../../components/layout-templates';
import { batchingOrderApi } from '../../../services/batching-order';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { workOrderApi } from '../../../services/work-order';
import BatchingTaskQueue from './BatchingTaskQueue';
import OutsourceMaterialPanel from './OutsourceMaterialPanel';
import {
  getMaterialCenterTabs,
  DEFAULT_MATERIAL_CENTER_TAB,
  isBatchingTaskTab,
  type MaterialCenterTabKey,
  type BatchingTaskTabKey,
} from './materialCenterTabs';
import { getBatchingOrderStageName, getBatchingOrderLifecycle } from '../../../utils/batchingOrderLifecycle';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';

interface BatchingOrder {
  id?: number;
  uuid?: string;
  code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  work_order_id?: number;
  work_order_code?: string;
  batching_date?: string;
  status?: string;
  total_items?: number;
  target_warehouse_id?: number;
  target_warehouse_name?: string;
  remarks?: string;
  executed_by?: number;
  executed_by_name?: string;
  executed_at?: string;
  created_at?: string;
  updated_at?: string;
  items?: BatchingOrderItem[];
}

interface BatchingOrderItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  unit?: string;
  required_quantity?: number;
  picked_quantity?: number;
  status?: string;
}

interface PullWorkOrderCandidate {
  id: number;
  code: string;
  name?: string;
  status?: string;
  planned_quantity?: number;
}

const BatchingCenterPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'batching_order.pull_from_work_order');
  const { message: messageApi } = App.useApp();

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [searchParams] = useSearchParams();
  const materialCenterTabs = useMemo(() => getMaterialCenterTabs(t), [t]);
  const initialTab = useMemo(() => {
    const tab = searchParams.get('tab');
    if (tab && materialCenterTabs.some((item) => item.key === tab)) {
      return tab as MaterialCenterTabKey;
    }
    return DEFAULT_MATERIAL_CENTER_TAB;
  }, [searchParams, materialCenterTabs]);
  const [activeTabKey, setActiveTabKey] = useState<MaterialCenterTabKey>(initialTab);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [selectedPullWorkOrder, setSelectedPullWorkOrder] = useState<PullWorkOrderCandidate | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<BatchingOrder | null>(null);
  const formRef = useRef<any>(null);
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

  const pullFromWorkOrderQuery = useUniPullQuery<PullWorkOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      const response = await workOrderApi.list({ status: 'released,in_progress', limit: 200 });
      const items = Array.isArray(response) ? response : (response as any)?.items || (response as any)?.data || [];
      const normalized = items
        .map((workOrder: any) => ({
          id: Number(workOrder.id),
          code: workOrder.code || '',
          name: workOrder.name || '',
          status: workOrder.status || '',
          planned_quantity: Number(workOrder.planned_quantity ?? 0),
        }))
        .filter((workOrder: PullWorkOrderCandidate) => {
          if (!keyword) {
            return true;
          }
          const keywordLower = keyword.toLowerCase();
          return (
            workOrder.code.toLowerCase().includes(keywordLower) ||
            (workOrder.name || '').toLowerCase().includes(keywordLower)
          );
        });
      const safePage = Math.max(1, Number(page || 1));
      const safePageSize = Math.max(1, Number(pageSize || 20));
      const start = (safePage - 1) * safePageSize;
      const paged = normalized.slice(start, start + safePageSize);
      return {
        data: paged,
        total: normalized.length,
      };
    },
    onConfirm: async (_selectedKeys, selectedRows) => {
      const selected = selectedRows?.[0];
      if (!selected) {
        messageApi.warning(t('app.kuaizhizao.batchingCenter.selectWorkOrder'));
        return;
      }
      setSelectedPullWorkOrder(selected);
      formRef.current?.setFieldsValue({
        work_order_id: selected.id,
        work_order_code: selected.code,
      });
      pullFromWorkOrderQuery.closeModal();
    },
  });

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
          batching_date: values.batching_date?.toISOString?.() || new Date().toISOString(),
          target_warehouse_id: values.target_warehouse_id || undefined,
          target_warehouse_name: values._target_warehouse_name || undefined,
          remarks: values.remarks,
          attachments: normalizeDocumentAttachments(values.attachments),
          allow_existing_draft: true,
        });
        messageApi.success(t('app.kuaizhizao.batchingCenter.pullFromWorkOrderSuccess'));
      } else {
        const items = values.items || [];
        if (items.length === 0) {
          messageApi.error(t('app.kuaizhizao.batchingCenter.manualNeedItems'));
          throw new Error('请添加配料明细');
        }
        const orderData: any = {
          warehouse_id: values.warehouse_id,
          warehouse_name: values._warehouse_name || '',
          batching_date: values.batching_date?.toISOString?.() || new Date().toISOString(),
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

  const openBatchingDetail = (orderId: number) => {
    batchingOrderApi.get(String(orderId)).then((order) => {
      setCurrentOrder(order);
      setDetailDrawerVisible(true);
    });
  };

  const tabIcons: Record<MaterialCenterTabKey, React.ReactNode> = {
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
        children: isBatchingTaskTab(tab.key) ? (
          <BatchingTaskQueue
            taskType={tab.key as BatchingTaskTabKey}
            onCreate={tab.key === 'batching_draft' ? () => handleCreate() : undefined}
            onOpenBatchingDetail={openBatchingDetail}
            onRefreshBatchingList={invalidateMenuBadgeCounts}
          />
        ) : (
          <OutsourceMaterialPanel mode={tab.key} />
        ),
      })),
    [materialCenterTabs, invalidateMenuBadgeCounts, t],
  );

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={(key) => setActiveTabKey(key as MaterialCenterTabKey)}
        tabs={taskTabs}
      />

      {/* 新建配料单 Modal */}
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
          { title: t('app.kuaizhizao.warehouseCommon.colStatus'), dataIndex: 'status', width: 140 },
          { title: t('app.kuaizhizao.batchingCenter.requiredQty'), dataIndex: 'planned_quantity', width: 120 },
        ]}
        rowKey="id"
        dataSource={pullFromWorkOrderQuery.dataSource}
        loading={pullFromWorkOrderQuery.loading}
        confirmLoading={pullFromWorkOrderQuery.confirmLoading}
        selectionType={pullFromWorkOrderQuery.selectionType}
        selectedRowKeys={pullFromWorkOrderQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromWorkOrderQuery.handleSelectedRowKeysChange}
        searchDraft={pullFromWorkOrderQuery.searchDraft}
        onSearchDraftChange={pullFromWorkOrderQuery.setSearchDraft}
        onSearchApply={pullFromWorkOrderQuery.handleSearchApply}
        onSearchClear={pullFromWorkOrderQuery.handleSearchClear}
        appliedKeyword={pullFromWorkOrderQuery.appliedKeyword}
        page={pullFromWorkOrderQuery.page}
        pageSize={pullFromWorkOrderQuery.pageSize}
        total={pullFromWorkOrderQuery.total}
        onPageChange={pullFromWorkOrderQuery.handlePageChange}
        searchPlaceholder={t('app.kuaizhizao.warehouseCommon.searchWorkOrderCodeOrName')}
      />

      {/* 详情 Drawer */}
      <DetailDrawerTemplate
        title={t('app.kuaizhizao.batchingCenter.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          setCurrentOrder(null);
        }}
        dataSource={currentOrder || {}}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[
          { title: t('app.kuaizhizao.batchingCenter.batchingCode'), dataIndex: 'code' },
          { title: t('app.kuaizhizao.warehouseCommon.colWarehouse'), dataIndex: 'warehouse_name' },
          { title: t('app.kuaizhizao.warehouseCommon.colWorkOrder'), dataIndex: 'work_order_code' },
          { title: t('app.kuaizhizao.batchingCenter.batchingDate'), dataIndex: 'batching_date', valueType: 'date' },
          {
            title: t('app.kuaizhizao.warehouseCommon.colStatus'),
            dataIndex: 'status',
            render: (_, entity) => {
              const stageName = getBatchingOrderStageName(entity?.status);
              return <Tag>{stageName}</Tag>;
            },
          },
          { title: t('app.kuaizhizao.warehouseCommon.colMaterialKindCount'), dataIndex: 'total_items' },
          { title: t('app.kuaizhizao.warehouseCommon.colTargetLineSideWarehouse'), dataIndex: 'target_warehouse_name' },
          { title: t('app.kuaizhizao.warehouseCommon.colRemarks'), dataIndex: 'remarks' },
          { title: t('app.kuaizhizao.warehouseCommon.colExecutor'), dataIndex: 'executed_by_name' },
          { title: t('app.kuaizhizao.warehouseCommon.colExecutedAt'), dataIndex: 'executed_at', valueType: 'dateTime' },
        ]}
      >
        <DetailDrawerSection title={t('app.kuaizhizao.warehouseCommon.lifecycleSection')}>
          {(() => {
            const lifecycle = getBatchingOrderLifecycle(currentOrder as unknown as Record<string, unknown>);
            const mainStages = lifecycle.mainStages ?? [];
            if (mainStages.length === 0) return null;
            return (
              <UniLifecycleStepper
                steps={mainStages}
                status={lifecycle.status}
                showLabels
                nextStepSuggestions={lifecycle.nextStepSuggestions}
              />
            );
          })()}
        </DetailDrawerSection>
        {currentOrder?.items && currentOrder.items.length > 0 && (
          <Card title={t('app.kuaizhizao.batchingCenter.batchingItems')} style={{ marginTop: 16 }}>
            <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
            <Table
              className="warehouse-detail-table"
              columns={[
                { title: t('app.kuaizhizao.warehouseCommon.colMaterialCode'), dataIndex: 'material_code', width: 120 },
                { title: t('app.kuaizhizao.warehouseCommon.colMaterialName'), dataIndex: 'material_name', width: 150 },
                { title: t('app.kuaizhizao.batchingCenter.requiredQty'), dataIndex: 'required_quantity', width: 100, align: 'right' },
                { title: t('app.kuaizhizao.warehouseCommon.colPickedQty'), dataIndex: 'picked_quantity', width: 100, align: 'right' },
                {
                  title: t('app.kuaizhizao.warehouseCommon.colStatus'),
                  dataIndex: 'status',
                  width: 100,
                  render: (status: string) => {
                    const map: Record<string, string> = {
                      pending: t('app.kuaizhizao.warehouseCommon.statusPendingPick'),
                      picked: t('app.kuaizhizao.warehouseCommon.statusPicked'),
                    };
                    return <Tag>{map[status] ?? status}</Tag>;
                  },
                },
              ]}
              dataSource={currentOrder.items}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        )}
      </DetailDrawerTemplate>
    </>
  );
};

export default BatchingCenterPage;
