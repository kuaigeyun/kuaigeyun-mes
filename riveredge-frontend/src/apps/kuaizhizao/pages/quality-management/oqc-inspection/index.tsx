import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDigit, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Alert, App, Button, Empty, Modal, Spin, Table, Typography } from 'antd';
import { EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { MaterialStackedCell, UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS } from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  qualifiedQuantityColumnProps,
  stackedPrimarySecondaryColumn,
  unqualifiedQuantityColumnProps,
} from '../components/qualityTableColumns';
import { DetailDrawerTemplate, FormModalTemplate, ListPageTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { OQCInspection, qualityImprovementApi } from '../../../services/quality-improvement';
import type { DocumentPushPreview } from '../../../services/purchase-requisition';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { oqcInspectionCapabilityReasonMessage, oqcInspectionRowGates } from '../../../../../hooks/useDocumentCapabilities';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { useTranslation } from 'react-i18next';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { getIncomingInspectionLifecycle } from '../../../utils/incomingInspectionLifecycle';
import {
  buildQualityInspectionDocStatusValueEnum,
  buildQualityInspectionQualityStatusValueEnum,
  normalizeQualityInspectionListResponse,
  QUALITY_INSPECTION_PINNED_STATUS_FIELD,
  resolveQualityInspectionListParams,
} from '../../../utils/qualityInspectionListCore';
import {
  getQualityInspectionResultValueEnum,
  getQualityQualityStatusValueEnum,
  getQualityReleaseDecisionValueEnum,
  qualityInspectionUniAuditProps,
  renderQualityQualityStatusTag,
  renderQualityResultTag,
  renderReleaseDecisionTag,
} from '../components/qualityMeta';

const OQC_RESOURCE = 'kuaizhizao:quality-management-oqc-inspection';

function renderOqcRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

type OqcPullSourceCandidate = {
  id: number;
  code: string;
  capabilities?: { pull_oqc_inspection?: { allowed?: boolean; reason?: string } };
};

type PullPreviewKind = 'shipment_notice' | 'sales_delivery';

const OQCInspectionPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromShipmentNoticeAction = resolveKuaizhizaoDocumentAction(t, 'oqc_inspection.pull_from_shipment_notice');
  const pullFromSalesDeliveryAction = resolveKuaizhizaoDocumentAction(t, 'oqc_inspection.pull_from_sales_delivery');
  const { message: messageApi } = App.useApp();
  const oqcPerms = useResourcePermissions(OQC_RESOURCE);
  const { canCreate, canUpdate } = oqcPerms;
  const oqcAuditEnabled = useAuditRequired('oqc_inspection', false);
  const oqcAuditColumn = useMemo(
    () => createListAuditPhaseColumn<OQCInspection>({ t, auditEnabled: oqcAuditEnabled }),
    [t, oqcAuditEnabled],
  );
  const inspectionDocStatusValueEnum = useMemo(() => buildQualityInspectionDocStatusValueEnum(t), [t]);
  const inspectionQualityStatusValueEnum = useMemo(
    () => buildQualityInspectionQualityStatusValueEnum(t),
    [t],
  );
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<OQCInspection[]>([]);
  const conductFormRef = useRef<any>(null);
  const [conductVisible, setConductVisible] = useState(false);
  const [currentRow, setCurrentRow] = useState<OQCInspection | null>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [detailRecord, setDetailRecord] = useState<OQCInspection | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is OQCInspection => row != null),
    [selectedRowKeys],
  );
  const oqcAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('oqc_inspection', ['approve', 'revoke']),
    [],
  );
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewConfirming, setPullPreviewConfirming] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullPreviewKind, setPullPreviewKind] = useState<PullPreviewKind | null>(null);
  const [pullSelectedItemIds, setPullSelectedItemIds] = useState<number[]>([]);
  const pullFromShipmentNoticeCloseRef = useRef<(() => void) | null>(null);
  const pullFromSalesDeliveryCloseRef = useRef<(() => void) | null>(null);

  const resetPullPreview = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewData(null);
    setPullPreviewKind(null);
    setPullSelectedItemIds([]);
  };

  const openPullPreview = async (kind: PullPreviewKind, sourceId: number) => {
    setPullPreviewKind(kind);
    setPullPreviewOpen(true);
    setPullPreviewLoading(true);
    setPullPreviewConfirming(false);
    setPullPreviewData(null);
    setPullPreviewSourceId(sourceId);
    setPullSelectedItemIds([]);
    try {
      const data =
        kind === 'shipment_notice'
          ? await qualityImprovementApi.oqc.previewPullFromShipmentNotice(sourceId)
          : await qualityImprovementApi.oqc.previewPullFromSalesDelivery(sourceId);
      setPullPreviewData(data as DocumentPushPreview);
      const ids = (data.items || [])
        .filter((row) => Number(row.max_push_quantity ?? 0) > 0)
        .map((row) => Number(row.item_id));
      setPullSelectedItemIds(ids);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.purchaseReturn.pull.previewFailed'));
      resetPullPreview();
    } finally {
      setPullPreviewLoading(false);
    }
  };

  const handlePullPreviewConfirm = async () => {
    if (!pullPreviewSourceId || !pullPreviewData || !pullPreviewKind) return;
    if (pullPreviewData.has_blocking_issues) return;
    const rowById = new Map(
      (pullPreviewData.items || []).map((row) => [Number(row.item_id), row]),
    );
    const selectedIds = pullSelectedItemIds.filter((id) => {
      const row = rowById.get(id);
      return row && Number(row.max_push_quantity ?? 0) > 0;
    });
    if (!selectedIds.length) {
      messageApi.warning(t('app.kuaizhizao.quality.oqc.pull.selectLinesFirst'));
      return;
    }
    setPullPreviewConfirming(true);
    try {
      const created =
        pullPreviewKind === 'shipment_notice'
          ? await qualityImprovementApi.oqc.createFromShipmentNotice(pullPreviewSourceId, selectedIds)
          : await qualityImprovementApi.oqc.createFromSalesDelivery(pullPreviewSourceId, selectedIds);
      messageApi.success(t('app.kuaizhizao.quality.oqc.messages.createSuccess', { count: created.length }));
      resetPullPreview();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.createFailed'));
    } finally {
      setPullPreviewConfirming(false);
    }
  };

  const pullFromShipmentNoticeQuery = useUniPullQuery<OqcPullSourceCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await qualityImprovementApi.oqc.listShipmentNoticePullCandidates({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        return {
          data: (res.data || []) as OqcPullSourceCandidate[],
          total: res.total ?? 0,
        };
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadShipmentNoticeFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => row.capabilities?.pull_oqc_inspection?.allowed === false,
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.selectShipmentNotice'));
        return;
      }
      pullFromShipmentNoticeCloseRef.current?.();
      await openPullPreview('shipment_notice', selected.id);
    },
  });
  pullFromShipmentNoticeCloseRef.current = pullFromShipmentNoticeQuery.closeModal;

  const pullFromSalesDeliveryQuery = useUniPullQuery<OqcPullSourceCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const res = await qualityImprovementApi.oqc.listSalesDeliveryPullCandidates({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        return {
          data: (res.data || []) as OqcPullSourceCandidate[],
          total: res.total ?? 0,
        };
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadSalesDeliveryFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => row.capabilities?.pull_oqc_inspection?.allowed === false,
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.selectSalesDelivery'));
        return;
      }
      pullFromSalesDeliveryCloseRef.current?.();
      await openPullPreview('sales_delivery', selected.id);
    },
  });
  pullFromSalesDeliveryCloseRef.current = pullFromSalesDeliveryQuery.closeModal;

  const openConductModal = useCallback((row: OQCInspection) => {
    setCurrentRow(row);
    setConductVisible(true);
    setTimeout(
      () =>
        conductFormRef.current?.setFieldsValue({
          inspection_result: row.inspection_result || '合格',
          quality_status: row.quality_status || '合格',
          release_decision: row.release_decision || 'pending',
          qualified_quantity: row.qualified_quantity,
          unqualified_quantity: row.unqualified_quantity,
          attachments: mapAttachmentsToUploadList(row.attachments),
        }),
      50,
    );
  }, []);

  const handleDetail = useCallback((record: OQCInspection) => {
    setDetailRecord(record);
    setDetailDrawerVisible(true);
  }, []);

  const renderOqcRowNodes = useCallback(
    (record: OQCInspection): React.ReactNode[] => {
      const gates = oqcInspectionRowGates(record, oqcPerms, t);
      if (gates.conduct.allowed) {
        return [
          <Button
            {...rowActionKind('execute')}
            key="inspect"
            size="small"
            type="primary"
            disabled={gates.conduct.disabled}
            title={gates.conduct.title}
            onClick={(e) => {
              e.stopPropagation();
              openConductModal(record);
            }}
          >
            {t('app.kuaizhizao.quality.oqc.actions.conduct')}
          </Button>,
        ];
      }
      const nodes: React.ReactNode[] = [
        <Button
          {...rowActionKind('read')}
          key="detail"
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            handleDetail(record);
          }}
        >
          {t('app.kuaizhizao.quality.common.actions.detail')}
        </Button>,
        <UniWorkflowActions
          {...rowActionKind('skip')}
          key="wf"
          record={record}
          {...qualityInspectionUniAuditProps({
            entityType: 'oqc_inspection',
            resourcePrefix: OQC_RESOURCE,
            entityName: t('app.kuaizhizao.quality.common.entity.oqcInspection'),
            onSuccess: () => actionRef.current?.reload(),
          })}
        />,
      ];
      return nodes;
    },
    [handleDetail, oqcPerms, openConductModal, t],
  );

  const columns: ProColumns<OQCInspection>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionTime'),
        dataIndex: 'inspection_time_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.updatedAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: inspectionDocStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.qualityStatus'),
        dataIndex: 'quality_status',
        valueType: 'select',
        valueEnum: inspectionQualityStatusValueEnum,
        hideInTable: true,
        search: { order: 21 } as ProColumns['search'],
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
        dataIndex: 'inspection_code',
        width: 150,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }} ellipsis>
            {r.inspection_code ?? '-'}
          </Typography.Text>
        ),
      },
      stackedPrimarySecondaryColumn<OQCInspection>(
        t('app.kuaizhizao.quality.oqc.columns.shipmentNoticeSalesOrder'),
        'noticeSalesOrder',
        ['shipment_notice_code', 'shipmentNoticeCode'],
        ['sales_order_code', 'salesOrderCode'],
        { dataIndex: 'shipment_notice_code' },
      ),
      { title: t('app.kuaizhizao.quality.oqc.columns.shipmentNotice'), dataIndex: 'shipment_notice_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.salesOrder'), dataIndex: 'sales_order_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.customer'), dataIndex: 'customer_name', width: 140, ellipsis: true, sorter: true, hideInSearch: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.sourceCode'), dataIndex: 'source_code', width: 130, sorter: true, hideInSearch: true },
      {
        title: t('app.kuaizhizao.quality.common.columns.material'),
        key: 'material',
        dataIndex: 'material_name',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        render: (_, r) => (
          <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.materialCode'), dataIndex: 'material_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', hideInTable: true },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
        dataIndex: 'inspection_quantity',
        valueType: 'digit',
        width: 100,
        align: 'right',
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'),
        dataIndex: 'qualified_quantity',
        sorter: true,
        hideInSearch: true,
        ...qualifiedQuantityColumnProps,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
        dataIndex: 'unqualified_quantity',
        sorter: true,
        hideInSearch: true,
        ...unqualifiedQuantityColumnProps,
      },
      {
        title: t('app.kuaizhizao.quality.oqc.columns.releaseDecision'),
        dataIndex: 'release_decision',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => renderReleaseDecisionTag(t, row.release_decision),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionResult'),
        dataIndex: 'inspection_result',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => renderQualityResultTag(t, r.inspection_result),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.qualityStatus'),
        dataIndex: 'quality_status',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => renderQualityQualityStatusTag(t, r.quality_status),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionTime'),
        dataIndex: 'inspection_time',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'dateTime',
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.inspection_time ? formatDateTime(r.inspection_time, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.updatedAt'),
        dataIndex: 'updated_at',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        sorter: true,
        defaultSortOrder: 'descend',
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      ...(oqcAuditColumn ? [oqcAuditColumn] : []),
      {
        title: t('app.kuaizhizao.quality.common.columns.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getIncomingInspectionLifecycle(record as Record<string, unknown>);
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
        title: t('app.kuaizhizao.quality.common.columns.actions'),
        key: 'action',
        width: 240,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => renderOqcRowActions(renderOqcRowNodes(record), `oqc-${record.id ?? 'row'}`),
      },
    ],
    [t, oqcAuditColumn, inspectionDocStatusValueEnum, inspectionQualityStatusValueEnum, renderOqcRowNodes],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-oqc-inspection:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.oqc.permission.noReadAccess')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<OQCInspection>
          headerTitle={t('app.kuaizhizao.quality.oqc.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          permissionResource={OQC_RESOURCE}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.oqc-inspection"
          showAdvancedSearch
          pinnedTabsField={QUALITY_INSPECTION_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          showExportButton
          onExport={async () => {
            try {
              const res = await qualityImprovementApi.oqc.export();
              const items = res.items || [];
              if (items.length === 0) {
                messageApi.warning(t('app.kuaizhizao.quality.common.messages.exportEmpty'));
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const exportDate = new Date().toISOString().slice(0, 10);
              a.download = `${t('app.kuaizhizao.quality.common.entity.oqcInspection')}_${exportDate}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.common.messages.exportFailed'));
            }
          }}
          showDeleteButton
          onDelete={async (keys) => {
            try {
              for (const key of keys) {
                await qualityImprovementApi.oqc.delete(Number(key));
              }
              messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: keys.length }));
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.quality.common.messages.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.oqc.messages.deleteConfirm', { count })}
          deleteConfirmDescription={t('app.kuaizhizao.quality.oqc.messages.deleteConfirmDescription')}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="oqc-inspection-batch-menu"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedRecordsForBatch}
              auditEnabled={oqcAuditEnabled}
              permGates={oqcPerms}
              handlers={oqcAuditBatchHandlers}
              onSuccess={() => {
                setSelectedRowKeys([]);
                actionRef.current?.reload();
              }}
              toolBarButtonSize="middle"
            />,
          ]}
          toolBarRender={() =>
            canCreate
              ? [
                  <Button
                    {...rowActionKind('create')}
                    key="from-notice"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={pullFromShipmentNoticeQuery.openModal}
                  >
                    {withSingleNewShortcutHint(pullFromShipmentNoticeAction.label)}
                  </Button>,
                  <Button
                    {...rowActionKind('create')}
                    key="from-delivery"
                    icon={<PlusOutlined />}
                    onClick={pullFromSalesDeliveryQuery.openModal}
                  >
                    {pullFromSalesDeliveryAction.label}
                  </Button>,
                ]
              : []
          }
          request={async (params, sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveQualityInspectionListParams(searchFormValues, sort);
            const result = await qualityImprovementApi.oqc.list({
              skip,
              limit: pageSize,
              ...listParams,
            });
            const { data, total } = normalizeQualityInspectionListResponse(result);
            tableRowsRef.current = data as OQCInspection[];
            return {
              success: true,
              data: data as OQCInspection[],
              total,
            };
          }}
        />

        <UniPullQueryModal<OqcPullSourceCandidate>
          open={pullFromShipmentNoticeQuery.open}
          title={pullFromShipmentNoticeAction.label}
          onCancel={pullFromShipmentNoticeQuery.closeModal}
          onOk={pullFromShipmentNoticeQuery.handleConfirm}
          rowKey="id"
          columns={[{ title: t('app.kuaizhizao.quality.oqc.form.shipmentNotice'), dataIndex: 'code', ellipsis: true }]}
          dataSource={pullFromShipmentNoticeQuery.dataSource}
          loading={pullFromShipmentNoticeQuery.loading}
          confirmLoading={pullFromShipmentNoticeQuery.confirmLoading}
          selectionType={pullFromShipmentNoticeQuery.selectionType}
          selectedRowKeys={pullFromShipmentNoticeQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromShipmentNoticeQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromShipmentNoticeQuery.isRowDisabled}
          searchDraft={pullFromShipmentNoticeQuery.searchDraft}
          onSearchDraftChange={pullFromShipmentNoticeQuery.setSearchDraft}
          onSearchApply={pullFromShipmentNoticeQuery.handleSearchApply}
          onSearchClear={pullFromShipmentNoticeQuery.handleSearchClear}
          appliedKeyword={pullFromShipmentNoticeQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.quality.oqc.form.shipmentNoticePlaceholder')}
          page={pullFromShipmentNoticeQuery.page}
          pageSize={pullFromShipmentNoticeQuery.pageSize}
          total={pullFromShipmentNoticeQuery.total}
          onPageChange={pullFromShipmentNoticeQuery.handlePageChange}
        />

        <UniPullQueryModal<OqcPullSourceCandidate>
          open={pullFromSalesDeliveryQuery.open}
          title={pullFromSalesDeliveryAction.label}
          onCancel={pullFromSalesDeliveryQuery.closeModal}
          onOk={pullFromSalesDeliveryQuery.handleConfirm}
          rowKey="id"
          columns={[{ title: t('app.kuaizhizao.quality.oqc.form.salesDelivery'), dataIndex: 'code', ellipsis: true }]}
          dataSource={pullFromSalesDeliveryQuery.dataSource}
          loading={pullFromSalesDeliveryQuery.loading}
          confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
          selectionType={pullFromSalesDeliveryQuery.selectionType}
          selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
          onSelectedRowKeysChange={pullFromSalesDeliveryQuery.handleSelectedRowKeysChange}
          isRowDisabled={pullFromSalesDeliveryQuery.isRowDisabled}
          searchDraft={pullFromSalesDeliveryQuery.searchDraft}
          onSearchDraftChange={pullFromSalesDeliveryQuery.setSearchDraft}
          onSearchApply={pullFromSalesDeliveryQuery.handleSearchApply}
          onSearchClear={pullFromSalesDeliveryQuery.handleSearchClear}
          appliedKeyword={pullFromSalesDeliveryQuery.appliedKeyword}
          searchPlaceholder={t('app.kuaizhizao.quality.oqc.form.salesDeliveryPlaceholder')}
          page={pullFromSalesDeliveryQuery.page}
          pageSize={pullFromSalesDeliveryQuery.pageSize}
          total={pullFromSalesDeliveryQuery.total}
          onPageChange={pullFromSalesDeliveryQuery.handlePageChange}
        />

        <Modal
          title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
          open={pullPreviewOpen}
          destroyOnClose
          width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
          onCancel={resetPullPreview}
          okText={
            pullPreviewKind === 'sales_delivery'
              ? pullFromSalesDeliveryAction.label
              : pullFromShipmentNoticeAction.label
          }
          cancelText={t('common.cancel')}
          confirmLoading={pullPreviewConfirming}
          onOk={() => void handlePullPreviewConfirm()}
          okButtonProps={{
            disabled:
              pullPreviewLoading ||
              !pullPreviewData ||
              !!pullPreviewData?.has_blocking_issues ||
              !pullSelectedItemIds.some((id) => {
                const row = (pullPreviewData?.items || []).find((item) => Number(item.item_id) === id);
                return row && Number(row.max_push_quantity ?? 0) > 0;
              }),
          }}
        >
          {pullPreviewLoading ? (
            <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Spin />
              <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
            </div>
          ) : pullPreviewData ? (
            <div>
              <p style={{ marginBottom: 12, fontWeight: 500 }}>{pullPreviewData.summary}</p>
              {pullPreviewData.has_blocking_issues && pullPreviewData.blocking_reason ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={oqcInspectionCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
                />
              ) : null}
              {pullPreviewData.items?.length > 0 ? (
                <Table
                  size="small"
                  dataSource={pullPreviewData.items}
                  rowKey={(row) => String(row.item_id)}
                  pagination={false}
                  scroll={{ x: 960 }}
                  rowSelection={{
                    selectedRowKeys: pullSelectedItemIds.map(String),
                    onChange: (keys) => setPullSelectedItemIds(keys.map((k) => Number(k))),
                    getCheckboxProps: (row) => ({
                      disabled: Number(row.max_push_quantity ?? 0) <= 0,
                    }),
                  }}
                  columns={[
                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                    { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right' },
                    { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' },
                    { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')} />
              )}
              {pullPreviewData.tip ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  {pullPreviewData.tip}
                </Typography.Paragraph>
              ) : null}
            </div>
          ) : null}
        </Modal>

        <DetailDrawerTemplate
          title={t('app.kuaizhizao.quality.common.modal.detailTitle', { code: detailRecord?.inspection_code || '' })}
          open={detailDrawerVisible}
          onClose={() => {
            setDetailDrawerVisible(false);
            setDetailRecord(null);
          }}
          width={DRAWER_CONFIG.HALF_WIDTH}
          columns={[]}
          customContent={
            detailRecord ? (
              <div style={{ padding: '16px 0' }}>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.inspectionCode')}:</strong> {detailRecord.inspection_code}</p>
                <p><strong>{t('app.kuaizhizao.quality.oqc.columns.shipmentNotice')}:</strong> {detailRecord.shipment_notice_code || '-'}</p>
                <p><strong>{t('app.kuaizhizao.quality.oqc.columns.salesOrder')}:</strong> {detailRecord.sales_order_code || '-'}</p>
                <p><strong>{t('app.kuaizhizao.quality.oqc.columns.customer')}:</strong> {detailRecord.customer_name || '-'}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.materialCode')}:</strong> {detailRecord.material_code}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.materialName')}:</strong> {detailRecord.material_name}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.inspectionQty')}:</strong> {detailRecord.inspection_quantity}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.qualifiedQty')}:</strong> {detailRecord.qualified_quantity}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.unqualifiedQty')}:</strong> {detailRecord.unqualified_quantity}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.inspectionResult')}:</strong> {renderQualityResultTag(t, detailRecord.inspection_result)}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.qualityStatus')}:</strong> {renderQualityQualityStatusTag(t, detailRecord.quality_status)}</p>
                <p><strong>{t('app.kuaizhizao.quality.oqc.columns.releaseDecision')}:</strong> {renderReleaseDecisionTag(t, detailRecord.release_decision)}</p>
                <p><strong>{t('app.kuaizhizao.quality.common.columns.inspectionTime')}:</strong> {detailRecord.inspection_time ? formatDateTime(detailRecord.inspection_time, 'YYYY-MM-DD HH:mm:ss') : '-'}</p>
                <div style={{ marginTop: 16 }}>
                  <Typography.Text strong>{t('app.kuaizhizao.quality.common.columns.lifecycle')}</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    {(() => {
                      const lifecycle = getIncomingInspectionLifecycle(detailRecord as Record<string, unknown>);
                      return (
                        <UniLifecycle
                          percent={lifecycle.percent}
                          stageName={lifecycle.stageName}
                          status={lifecycle.status}
                          subStages={lifecycle.subStages}
                          showLabel
                          size="small"
                        />
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : null
          }
        />

        <FormModalTemplate
          title={t('app.kuaizhizao.quality.oqc.modal.conductTitle', { code: currentRow?.inspection_code || '' })}
          open={conductVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          formRef={conductFormRef}
          onClose={() => {
            setConductVisible(false);
            setCurrentRow(null);
            conductFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (!canUpdate) {
              messageApi.error(t('app.kuaizhizao.quality.oqc.messages.noConductPermission'));
              return false;
            }
            await qualityImprovementApi.oqc.conduct(currentRow.id, {
              ...values,
              attachments: normalizeDocumentAttachments(values.attachments),
              ...pickInspectionConductExtras(values),
            });
            messageApi.success(t('app.kuaizhizao.quality.oqc.messages.conductSuccess'));
            setConductVisible(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          <InspectionTemplateConductFields
            inspection={currentRow as Record<string, unknown>}
            photoCategory="oqc_inspection_attachments"
          />
          <ProFormSelect
            name="inspection_result"
            label={t('app.kuaizhizao.quality.common.columns.inspectionResult')}
            valueEnum={getQualityInspectionResultValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="quality_status"
            label={t('app.kuaizhizao.quality.common.columns.qualityStatus')}
            valueEnum={getQualityQualityStatusValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="qualified_quantity"
            label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
            rules={[{ required: true }]}
          />
          <ProFormDigit
            name="unqualified_quantity"
            label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
            rules={[{ required: true }]}
          />
          <ProFormSelect
            name="release_decision"
            label={t('app.kuaizhizao.quality.oqc.columns.releaseDecision')}
            valueEnum={getQualityReleaseDecisionValueEnum(t)}
            rules={[{ required: true }]}
          />
          <ProFormTextArea name="release_note" label={t('app.kuaizhizao.quality.oqc.form.releaseNote')} />
          <DocumentAttachmentsField category="oqc_inspection_attachments" />
          <ProFormTextArea name="notes" label={t('app.kuaizhizao.quality.common.form.notes')} />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default OQCInspectionPage;
