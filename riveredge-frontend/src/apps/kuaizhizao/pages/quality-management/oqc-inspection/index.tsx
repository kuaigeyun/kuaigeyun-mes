import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { Alert, App, Button, Card, Col, Empty, Modal, Row, Space, Spin, Table, Typography } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { DeleteOutlined, EyeOutlined, PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UniTable } from '../../../../../components/uni-table';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import {
  buildInspectorNameColumn,
  buildQualityInspectionListCodeColumn,
  buildQualityInspectionListKindColumn,
  buildQualityInspectionListMaterialColumn,
  buildQualityInspectionListMaterialHiddenColumns,
  buildQualityInspectionListQuantityResultColumns,
  buildQualityInspectionListSearchColumns,
  buildQualityInspectionPartnerStackedColumn,
  QUALITY_INSPECTION_EXTRA_KEY,
} from '../components/qualityTableColumns';
import {
  buildQualityInspectionDetailCodeColumn,
  buildQualityInspectionDetailMaterialColumns,
  buildQualityInspectionDetailNotesColumn,
  buildQualityInspectionDetailPeopleColumns,
  buildQualityInspectionDetailQuantityStatusColumns,
} from '../components/qualityDetailColumns';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { OQCInspection, qualityImprovementApi } from '../../../services/quality-improvement';
import type { DocumentPushPreview } from '../../../services/purchase-requisition';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import { QualityInspectionDetailDrawer } from '../components/QualityInspectionDetailDrawer';
import {
  InspectionUnqualifiedBanner,
  buildInspectionQualityExtraButtons,
} from '../components/InspectionDetailQualityActions';
import { useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import {
  getInspectionTemplateSource,
  hasInspectionPlanSteps,
  pickInspectionConductExtras,
} from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import {
  InspectionConductQuantityFields,
  normalizeInspectionConductPayload,
} from '../../../../../components/quantity-with-unit/inspectionConductQuantities';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { oqcInspectionCapabilityReasonMessage, oqcInspectionRowGates } from '../../../../../hooks/useDocumentCapabilities';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { useTranslation } from 'react-i18next';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
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
  renderReleaseDecisionTag,
} from '../components/qualityMeta';
import {
  filterDeletableQualityInspectionRecords,
  filterRevokeConductQualityInspectionRecords,
} from '../components/qualityRevokeConduct';
import {
  buildOqcSalesDeliveryPullColumns,
  buildOqcShipmentNoticePullColumns,
  type QualityPullCandidateBase,
} from '../components/qualityPullQueryColumns';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import {
  buildOqcInspectionExportColumns,
  mapOqcInspectionExportRows,
} from '../components/qualityInspectionExport';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
const OQC_RESOURCE = 'kuaizhizao:quality-management-oqc-inspection';

type OqcPullSourceCandidate = QualityPullCandidateBase & {
  notice_code?: string;
  delivery_code?: string;
  customer_name?: string;
  capabilities?: { pull_oqc_inspection?: { allowed?: boolean; reason?: string } };
};

type PullPreviewKind = 'shipment_notice' | 'sales_delivery';

const OQCInspectionPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const salesDeliveryIdFromQuery = searchParams.get('sales_delivery_id') || undefined;
  const oqcInspectionIdFromQuery = searchParams.get('oqc_inspection_id') || searchParams.get('id') || undefined;
  const pullFromShipmentNoticeAction = resolveKuaizhizaoDocumentAction(t, 'oqc_inspection.pull_from_shipment_notice');
  const pullFromSalesDeliveryAction = resolveKuaizhizaoDocumentAction(t, 'oqc_inspection.pull_from_sales_delivery');
  const { message: messageApi } = App.useApp();
  const oqcPerms = useResourcePermissions(OQC_RESOURCE);
  const { canCreate, canAction } = oqcPerms;
  const canConduct = canAction?.('execute') ?? false;
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
  const [oqcTrackingRefreshKey, setOqcTrackingRefreshKey] = useState(0);
  const oqcTracking = useDocumentTracking(
    detailDrawerVisible && detailRecord?.id ? 'oqc_inspection' : undefined,
    detailRecord?.id,
    oqcTrackingRefreshKey,
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is OQCInspection => row != null),
    [selectedRowKeys],
  );
  const oqcAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('oqc_inspection'),
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
      if (!created?.length) {
        messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.alreadyExists'));
      } else {
        messageApi.success(
          t('app.kuaizhizao.quality.oqc.messages.createSuccess', { count: created.length }),
        );
      }
      resetPullPreview();
      actionRef.current?.reload();
    } catch (e: any) {
      const errMsg = String(e?.message || '');
      if (errMsg.includes('均已存在检验单')) {
        messageApi.warning(t('app.kuaizhizao.quality.oqc.messages.alreadyExists'));
        resetPullPreview();
        actionRef.current?.reload();
      } else {
        messageApi.error(errMsg || t('common.createFailed'));
      }
    } finally {
      setPullPreviewConfirming(false);
    }
  };

  const isPullOqcInspectionSelectable = useCallback(
    (row: OqcPullSourceCandidate) => row.capabilities?.pull_oqc_inspection?.allowed !== false,
    [],
  );

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const oqcShipmentNoticePullColumns = useMemo(() => buildOqcShipmentNoticePullColumns(t), [t]);
  const oqcSalesDeliveryPullColumns = useMemo(() => buildOqcSalesDeliveryPullColumns(t), [t]);

  const pullFromShipmentNoticeQuery = useUniPullQuery<OqcPullSourceCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await qualityImprovementApi.oqc.listShipmentNoticePullCandidates({
          skip: 0,
          limit: 100,
          notice_code: keyword.trim() || undefined,
        });
        const rows = (res.data || []) as OqcPullSourceCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullOqcInspectionSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadShipmentNoticeFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => !isPullOqcInspectionSelectable(row),
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
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await qualityImprovementApi.oqc.listSalesDeliveryPullCandidates({
          skip: 0,
          limit: 100,
          delivery_code: keyword.trim() || undefined,
        });
        const rows = (res.data || []) as OqcPullSourceCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullOqcInspectionSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (e: any) {
        messageApi.error(e?.message || t('app.kuaizhizao.quality.oqc.messages.loadSalesDeliveryFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => !isPullOqcInspectionSelectable(row),
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

  const handleDeleteRow = useCallback(
    (record: OQCInspection) => {
      if (record.id == null) return;
      getAntdModal().confirm({
        title: t('app.kuaizhizao.quality.oqc.messages.deleteConfirm', { count: 1 }),
        content: t('app.kuaizhizao.quality.oqc.messages.deleteConfirmDescription'),
        onOk: async () => {
          await qualityImprovementApi.oqc.delete(Number(record.id));
          messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: 1 }));
          actionRef.current?.reload();
        },
      });
    },
    [messageApi, t],
  );

  const handleRevokeConduct = useCallback(
    (record: OQCInspection) => {
      if (record.id == null) return;
      getAntdModal().confirm({
        title: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmTitle'),
        content: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmContent', {
          code: record.inspection_code || record.id,
        }),
        onOk: async () => {
          await qualityImprovementApi.oqc.revokeConduct(Number(record.id));
          messageApi.success(t('app.kuaizhizao.quality.common.messages.revokeConductSuccess'));
          actionRef.current?.reload();
        },
      });
    },
    [messageApi, t],
  );

  const handleBatchRevokeConduct = useCallback(async () => {
    const targets = filterRevokeConductQualityInspectionRecords(selectedRecordsForBatch);
    if (!targets.length) {
      messageApi.warning(t('app.kuaizhizao.quality.common.messages.revokeConductBatchEmpty'));
      return;
    }
    getAntdModal().confirm({
      title: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmTitle'),
      content: t('app.kuaizhizao.quality.common.messages.revokeConductBatchConfirm', { count: targets.length }),
      onOk: async () => {
        try {
          for (const row of targets) {
            if (row.id == null) continue;
            await qualityImprovementApi.oqc.revokeConduct(Number(row.id));
          }
          messageApi.success(
            t('app.kuaizhizao.quality.common.messages.revokeConductBatchSuccess', { count: targets.length }),
          );
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(
            oqcInspectionCapabilityReasonMessage(error?.message, t) ||
              error?.message ||
              t('app.kuaizhizao.quality.common.messages.revokeConductFailed'),
          );
        }
      },
    });
  }, [messageApi, selectedRecordsForBatch, t]);

  const renderOqcRowNodes = useCallback(
    (record: OQCInspection): React.ReactNode[] => {
      const gates = oqcInspectionRowGates(record, oqcPerms, t);
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
          {t('common.detail')}
        </Button>,
      ];
      if (gates.conduct.allowed) {
        nodes.push(
          <Button
            {...rowActionKind('execute')}
            {...rowActionLabelKeep()}
            key="inspect"
            // 主业务动作：排在详情之后、删除之前，避免被「更多」折叠
            data-action-priority={15}
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
        );
      }
      nodes.push(
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
      );
      if (gates.revokeConduct.allowed) {
        nodes.push(
          <Button
            {...rowActionKind('update')}
            key="revoke-conduct"
            size="small"
            type="link"
            icon={<RollbackOutlined />}
            disabled={gates.revokeConduct.disabled}
            title={gates.revokeConduct.title}
            onClick={(e) => {
              e.stopPropagation();
              handleRevokeConduct(record);
            }}
          >
            {t('app.kuaizhizao.quality.common.actions.revokeConduct')}
          </Button>,
        );
      }
      if (gates.delete.allowed) {
        nodes.push(
          <Button
            {...rowActionKind('delete')}
            key="delete"
            size="small"
            type="link"
            danger
            icon={<DeleteOutlined />}
            disabled={gates.delete.disabled}
            title={gates.delete.title}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteRow(record);
            }}
          >
            {t('common.delete')}
          </Button>,
        );
      }
      return nodes;
    },
    [handleDeleteRow, handleDetail, handleRevokeConduct, oqcPerms, openConductModal, t],
  );

  const detailBaseColumns: ProDescriptionsItemProps<OQCInspection>[] = useMemo(
    () => [
      buildQualityInspectionDetailCodeColumn<OQCInspection>(t),
      ...buildQualityInspectionDetailMaterialColumns<OQCInspection>(t),
      {
        title: t('app.kuaizhizao.quality.oqc.columns.shipmentNotice'),
        dataIndex: 'shipment_notice_code',
      },
      {
        title: t('app.kuaizhizao.quality.oqc.columns.salesOrder'),
        dataIndex: 'sales_order_code',
      },
      { title: t('app.kuaizhizao.quality.oqc.columns.customer'), dataIndex: 'customer_name' },
      ...buildQualityInspectionDetailQuantityStatusColumns<OQCInspection>(t),
      {
        title: t('app.kuaizhizao.quality.oqc.columns.releaseDecision'),
        dataIndex: 'release_decision',
        render: (_, r) => renderReleaseDecisionTag(t, r.release_decision),
      },
      { title: t('app.kuaizhizao.quality.oqc.form.releaseNote'), dataIndex: 'release_note' },
      ...buildQualityInspectionDetailPeopleColumns<OQCInspection>(t),
      buildQualityInspectionDetailNotesColumn<OQCInspection>(t),
    ],
    [t],
  );

  const columns: ProColumns<OQCInspection>[] = useMemo(
    () => alignProColumns<OQCInspection>([
      ...buildQualityInspectionListSearchColumns<OQCInspection>(
        t,
        inspectionDocStatusValueEnum,
        inspectionQualityStatusValueEnum,
      ),
      buildQualityInspectionListCodeColumn<OQCInspection>(t),
      buildQualityInspectionListKindColumn<OQCInspection>(t),
      buildQualityInspectionPartnerStackedColumn<OQCInspection>(
        t('app.kuaizhizao.quality.oqc.columns.customer'),
        ['customer_name'],
        ['shipment_notice_code', 'shipmentNoticeCode'],
        { dataIndex: 'customer_name' },
      ),
      { title: t('app.kuaizhizao.quality.oqc.columns.shipmentNotice'), dataIndex: 'shipment_notice_code', hideInTable: true },
      { title: t('app.kuaizhizao.quality.oqc.columns.customer'), dataIndex: 'customer_name', hideInTable: true, hideInSearch: true },
      buildQualityInspectionListMaterialColumn<OQCInspection>(t),
      ...buildQualityInspectionListMaterialHiddenColumns<OQCInspection>(t),
      buildInspectorNameColumn<OQCInspection>(t('app.kuaizhizao.quality.common.columns.inspector')),
      ...buildQualityInspectionListQuantityResultColumns<OQCInspection>(t, [
        {
          title: t('app.kuaizhizao.quality.oqc.columns.releaseDecision'),
          key: QUALITY_INSPECTION_EXTRA_KEY,
          dataIndex: 'release_decision',
          width: 100,
          sorter: true,
          hideInSearch: true,
          render: (_, row) => renderReleaseDecisionTag(t, row.release_decision),
        },
      ]),
      ...buildDocumentAuditColumns<OQCInspection>(t),
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
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => renderOqcRowNodes(record),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, oqcAuditColumn, inspectionDocStatusValueEnum, inspectionQualityStatusValueEnum, renderOqcRowNodes],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-oqc-inspection:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.oqc.permission.noReadAccess')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<OQCInspection>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.oqcInspection)}
          headerTitle={t('app.kuaizhizao.quality.oqc.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          permissionResource={OQC_RESOURCE}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.oqc-inspection.rank-v7"
          showAdvancedSearch
          pinnedTabsField={QUALITY_INSPECTION_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          showExportButton
          onExport={async () => {
            try {
              const res = await qualityImprovementApi.oqc.export();
              const items = res.items || [];
              if (items.length === 0) {
                messageApi.warning(t('common.exportNoData'));
                return;
              }
              await downloadRecordsAsXlsx(
                mapOqcInspectionExportRows(t, items as Array<Record<string, unknown>>),
                `${t('app.kuaizhizao.quality.common.entity.oqcInspection')}_${todaySiteDateString()}.xlsx`,
                { columns: buildOqcInspectionExportColumns(t) },
              );
              messageApi.success(t('common.exportCountSuccess', { count: items.length }));
            } catch (e: any) {
              messageApi.error(e?.message || t('common.exportFailed'));
            }
          }}
          showDeleteButton
          onDelete={async () => {
            try {
              const deletable = filterDeletableQualityInspectionRecords(selectedRecordsForBatch);
              if (!deletable.length) {
                messageApi.warning(t('app.kuaizhizao.quality.common.messages.deleteBatchEmpty'));
                return;
              }
              for (const row of deletable) {
                if (row.id == null) continue;
                await qualityImprovementApi.oqc.delete(Number(row.id));
              }
              messageApi.success(
                t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: deletable.length }),
              );
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || t('common.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.oqc.messages.deleteConfirm', { count })}
          deleteConfirmDescription={t('app.kuaizhizao.quality.oqc.messages.deleteConfirmDescription')}
          toolBarActionsAfterDelete={[
            <Button key="revoke-conduct-batch" icon={<RollbackOutlined />} onClick={() => void handleBatchRevokeConduct()}>
              {t('app.kuaizhizao.quality.common.actions.revokeConduct')}
            </Button>,
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
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
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
          params={{
            sales_delivery_id: salesDeliveryIdFromQuery,
            oqc_inspection_id: oqcInspectionIdFromQuery,
          }}
          request={async (params, sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveQualityInspectionListParams(searchFormValues, sort);
            const salesDeliveryId = params.sales_delivery_id || salesDeliveryIdFromQuery;
            const oqcInspectionId = params.oqc_inspection_id || oqcInspectionIdFromQuery;
            const result = await qualityImprovementApi.oqc.list({
              skip,
              limit: pageSize,
              ...listParams,
              ...(salesDeliveryId ? { sales_delivery_id: Number(salesDeliveryId) } : {}),
              ...(oqcInspectionId && !salesDeliveryId ? { keyword: String(oqcInspectionId) } : {}),
            });
            let { data, total } = normalizeQualityInspectionListResponse(result);
            if (oqcInspectionId) {
              const idNum = Number(oqcInspectionId);
              if (Number.isFinite(idNum) && idNum > 0) {
                data = (data as OQCInspection[]).filter((row) => Number(row.id) === idNum);
                total = data.length;
              }
            }
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
          columns={oqcShipmentNoticePullColumns}
          dataSource={pullFromShipmentNoticeQuery.dataSource}
          loading={pullFromShipmentNoticeQuery.loading}
          confirmLoading={pullFromShipmentNoticeQuery.confirmLoading}
          selectionType={pullFromShipmentNoticeQuery.selectionType}
          selectedRowKeys={pullFromShipmentNoticeQuery.selectedRowKeys}
          selectedRows={pullFromShipmentNoticeQuery.selectedRows}
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
          scopeOptions={pullFromShipmentNoticeQuery.scopeOptions}
          scope={pullFromShipmentNoticeQuery.scope}
          onScopeChange={pullFromShipmentNoticeQuery.handleScopeChange}
        />

        <UniPullQueryModal<OqcPullSourceCandidate>
          open={pullFromSalesDeliveryQuery.open}
          title={pullFromSalesDeliveryAction.label}
          onCancel={pullFromSalesDeliveryQuery.closeModal}
          onOk={pullFromSalesDeliveryQuery.handleConfirm}
          rowKey="id"
          columns={oqcSalesDeliveryPullColumns}
          dataSource={pullFromSalesDeliveryQuery.dataSource}
          loading={pullFromSalesDeliveryQuery.loading}
          confirmLoading={pullFromSalesDeliveryQuery.confirmLoading}
          selectionType={pullFromSalesDeliveryQuery.selectionType}
          selectedRowKeys={pullFromSalesDeliveryQuery.selectedRowKeys}
          selectedRows={pullFromSalesDeliveryQuery.selectedRows}
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
          scopeOptions={pullFromSalesDeliveryQuery.scopeOptions}
          scope={pullFromSalesDeliveryQuery.scope}
          onScopeChange={pullFromSalesDeliveryQuery.handleScopeChange}
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
                    { title: t('common.quantity'), dataIndex: 'quantity', width: 90, align: 'right' , render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' , render: formatQuantity },
                    { title: t('app.kuaizhizao.salesOrder.colShippableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' , render: formatQuantity },
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

        <QualityInspectionDetailDrawer
          title={t('app.kuaizhizao.quality.common.modal.detailTitle', { code: detailRecord?.inspection_code || '' })}
          open={detailDrawerVisible}
          onClose={() => {
            setDetailDrawerVisible(false);
            setDetailRecord(null);
          }}
          inspection={detailRecord}
          documentType="oqc_inspection"
          extra={
            detailRecord ? (
              <Space wrap size="small">
                {buildInspectionQualityExtraButtons({
                  inspection: detailRecord,
                  inspectionType: 'oqc',
                  t,
                  navigate,
                  onCloseDrawer: () => {
                    setDetailDrawerVisible(false);
                    setDetailRecord(null);
                  },
                })}
                <UniWorkflowActions
                  {...rowActionKind('skip')}
                  record={detailRecord}
                  {...qualityInspectionUniAuditProps({
                    entityType: 'oqc_inspection',
                    resourcePrefix: OQC_RESOURCE,
                    entityName: t('app.kuaizhizao.quality.common.entity.oqcInspection'),
                    theme: 'default',
                    onSuccess: () => {
                      actionRef.current?.reload();
                      setOqcTrackingRefreshKey((k) => k + 1);
                    },
                  })}
                />
              </Space>
            ) : null
          }
          banner={<InspectionUnqualifiedBanner inspection={detailRecord} />}
          basicColumns={detailBaseColumns}
          tracking={oqcTracking}
          renderBriefActions={(doc) => (
            <WarehouseTraceBriefPrimaryActions
              doc={doc}
              t={t}
              navigate={navigate}
              closeDrawer={() => {
                setDetailDrawerVisible(false);
                setDetailRecord(null);
              }}
            />
          )}
        />

        <FormModalTemplate
          title={t('app.kuaizhizao.quality.oqc.modal.conductTitle', { code: currentRow?.inspection_code || '' })}
          open={conductVisible}
          width={
            hasInspectionPlanSteps(getInspectionTemplateSource(currentRow as Record<string, unknown>))
              ? MODAL_CONFIG.LARGE_WIDTH
              : MODAL_CONFIG.STANDARD_WIDTH
          }
          grid
          formRef={conductFormRef}
          onClose={() => {
            setConductVisible(false);
            setCurrentRow(null);
            conductFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!currentRow?.id) return;
            if (!canConduct) {
              messageApi.error(t('app.kuaizhizao.quality.oqc.messages.noConductPermission'));
              return false;
            }
            const normalized = await normalizeInspectionConductPayload(values, {
              materialId: currentRow.material_id,
              materialUnit: currentRow.material_unit,
              scenario: 'sale',
            });
            await qualityImprovementApi.oqc.conduct(currentRow.id, {
              ...normalized,
              attachments: normalizeDocumentAttachments(normalized.attachments),
              ...pickInspectionConductExtras(normalized),
            });
            messageApi.success(t('app.kuaizhizao.quality.oqc.messages.conductSuccess'));
            setConductVisible(false);
            setCurrentRow(null);
            actionRef.current?.reload();
          }}
        >
          {currentRow ? (
            <Col span={24}>
              <Card size="small" style={{ marginBottom: 8 }}>
                <Row gutter={16}>
                  <Col span={8}>
                    <strong>{t('app.kuaizhizao.quality.common.label.materialCode')}：</strong>
                    {currentRow.material_code}
                  </Col>
                  <Col span={8}>
                    <strong>{t('app.kuaizhizao.quality.common.label.materialName')}：</strong>
                    {currentRow.material_name}
                  </Col>
                  <Col span={8}>
                    <strong>{t('app.kuaizhizao.quality.common.label.inspectionQty')}：</strong>
                    {formatQuantityWithUnit(currentRow.inspection_quantity, currentRow.material_unit)}
                  </Col>
                </Row>
              </Card>
            </Col>
          ) : null}
          <InspectionTemplateConductFields
            inspection={currentRow as Record<string, unknown>}
            photoCategory="oqc_inspection_attachments"
          />
          <InspectionConductQuantityFields
            materialId={currentRow?.material_id}
            materialUnit={currentRow?.material_unit}
            scenario="sale"
            inspectionQuantity={Number(currentRow?.inspection_quantity || 0)}
            inspection={currentRow as Record<string, unknown> | undefined}
            t={t}
          />
          <ProFormSelect
            name="inspection_result"
            label={t('app.kuaizhizao.quality.common.columns.inspectionResult')}
            valueEnum={getQualityInspectionResultValueEnum(t)}
            rules={[{ required: true }]}
            colProps={{ span: 12 }}
          />
          <ProFormSelect
            name="quality_status"
            label={t('app.kuaizhizao.quality.common.columns.qualityStatus')}
            valueEnum={getQualityQualityStatusValueEnum(t)}
            rules={[{ required: true }]}
            colProps={{ span: 12 }}
          />
          <ProFormSelect
            name="release_decision"
            label={t('app.kuaizhizao.quality.oqc.columns.releaseDecision')}
            valueEnum={getQualityReleaseDecisionValueEnum(t)}
            rules={[{ required: true }]}
            colProps={{ span: 12 }}
          />
          <ProFormTextArea
            name="release_note"
            label={t('app.kuaizhizao.quality.oqc.form.releaseNote')}
            colProps={{ span: 24 }}
            fieldProps={{ rows: 2 }}
          />
          <ProFormTextArea
            name="notes"
            label={t('app.kuaizhizao.quality.common.form.notes')}
            colProps={{ span: 24 }}
            fieldProps={{ rows: 2 }}
          />
          <DocumentAttachmentsField category="oqc_inspection_attachments" />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default OQCInspectionPage;
