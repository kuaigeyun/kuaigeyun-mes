/**
 * 成品检验页面
 *
 * 提供生产完工成品的最终检验功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormTextArea,
  ProFormSelect,
  ProFormItem,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  Space,
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Empty,
  Modal,
  Table,
  InputNumber,
  theme as AntdTheme,
} from 'antd';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EyeOutlined, PrinterOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
  buildInspectorNameColumn,
  buildQualityInspectionListCodeColumn,
  buildQualityInspectionListKindColumn,
  buildQualityInspectionListMaterialColumn,
  buildQualityInspectionListMaterialHiddenColumns,
  buildQualityInspectionListPushProgressColumn,
  buildQualityInspectionListQuantityResultColumns,
  buildQualityInspectionListSearchColumns,
  buildQualityInspectionPartnerStackedColumn,
} from '../components/qualityTableColumns';
import {
  buildQualityInspectionDetailCodeColumn,
  buildQualityInspectionDetailMaterialColumns,
  buildQualityInspectionDetailNotesColumn,
  buildQualityInspectionDetailPeopleColumns,
  buildQualityInspectionDetailQuantityStatusColumns,
} from '../components/qualityDetailColumns';
import {
  buildFinishedWorkOrderPullColumns,
  type QualityPullCandidateBase,
} from '../components/qualityPullQueryColumns';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getIncomingInspectionLifecycle } from '../../../utils/incomingInspectionLifecycle';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../../../services/api';
import { qualityApi } from '../../../services/production';
import type { PushPreviewResponse } from '../../../services/sales-order';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import { QualityInspectionDetailDrawer } from '../components/QualityInspectionDetailDrawer';
import {
  InspectionUnqualifiedBanner,
  buildInspectionQualityExtraButtons,
} from '../components/InspectionDetailQualityActions';
import {
  getInspectionTemplateSource,
  hasInspectionPlanSteps,
  pickInspectionConductExtras,
} from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { downloadFile } from '../../../services/common';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { finishedGoodsReworkPushPercent } from '../../sales-management/shared/pushProgress';
import {
  buildQualityInspectionDocStatusValueEnum,
  buildQualityInspectionQualityStatusValueEnum,
  normalizeQualityInspectionListResponse,
  QUALITY_INSPECTION_PINNED_STATUS_FIELD,
  resolveQualityInspectionListParams,
} from '../../../utils/qualityInspectionListCore';
import dayjs from 'dayjs';
import { formatQuantity, todaySiteDateString } from '../../../../../utils/format';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import {
  InspectionConductQuantityFields,
  InspectionDefectQuantityField,
  InspectionNonconformanceReasonField,
  normalizeInspectionConductPayload,
} from '../../../../../components/quantity-with-unit/inspectionConductQuantities';
import { useTranslation } from 'react-i18next';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { qualityInspectionRowGates, qualityInspectionCapabilityReasonMessage } from '../../../../../hooks/useDocumentCapabilities';
import { buildUniPushMenuItems, buildUniPushToolbarDisabledReason, UniPushToolbarButton } from '../../../../../components/uni-push';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import KuaizhizaoDocumentPrintModal from '../../../components/KuaizhizaoDocumentPrintModal';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
} from '../../../../../components/custom-fields';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  getQualityFinishedDisposalFallback,
  mergeQualityDisposalOptions,
  renderQualityDocStatusTag,
  renderQualityQualityStatusTag,
  getQualityDefectTypeOptions,
  qualityInspectionUniAuditProps,
} from '../components/qualityMeta';
import { DowngradeDispositionFields } from '../components/DowngradeDispositionFields';
import {
  filterDeletableQualityInspectionRecords,
  filterRevokeConductQualityInspectionRecords,
} from '../components/qualityRevokeConduct';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { importExcelMatrixInChunks } from '../../../../../utils/chunkedBulkImport';
const FINISHED_RESOURCE = 'kuaizhizao:quality-management-finished-goods-inspection';
const FINISHED_GOODS_INSPECTION_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_finished_goods_inspections';
const NC_RESOURCE = 'kuaizhizao:quality-management-nonconforming-ledger';

// 成品检验接口定义
interface FinishedGoodsInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  batch_number?: string;
  inspection_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  pushed_rework_quantity?: number;
  inspection_result?: string;
  quality_status?: string;
  inspector_id?: number;
  inspector_name?: string;
  inspection_time?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  release_certificate?: string;
  certificate_issued?: boolean;
  status?: string;
  notes?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
  created_at?: string;
  updated_at?: string;
  lifecycle?: { main_stages?: Array<unknown> };
  capabilities?: {
    conduct?: { allowed?: boolean; reason?: string };
    create_defect?: { allowed?: boolean; reason?: string };
    push_rework?: { allowed?: boolean; reason?: string };
  };
}


const FinishedGoodsInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const pushToReworkAction = resolveKuaizhizaoDocumentAction(t, 'rework_order.pull_from_finished_goods_inspection');
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'finished_goods_inspection.pull_from_work_order');

  const importDictOptions = useImportDictionaryOptions(['DISPOSAL_METHOD']);
  const disposalImportOptions = importDictOptions.DISPOSAL_METHOD ?? [];

  const finishedInspectionImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'workOrderCode',
            labelKey: 'app.kuaizhizao.quality.finished.import.workOrderCode',
            aliases: ['工单编号'],
          },
          { field: 'inspectionQty', labelKey: 'app.kuaizhizao.quality.finished.import.inspectionQty', aliases: ['检验数量'] },
          { field: 'qualifiedQty', labelKey: 'app.kuaizhizao.quality.finished.import.qualifiedQty', aliases: ['合格数量'] },
          { field: 'unqualifiedQty', labelKey: 'app.kuaizhizao.quality.finished.import.unqualifiedQty', aliases: ['不合格数量'] },
          {
            field: 'disposition',
            labelKey: 'app.kuaizhizao.quality.common.form.disposition',
            aliases: ['处置方式', 'disposition'],
            options: disposalImportOptions,
          },
          { field: 'remark', labelKey: 'app.kuaizhizao.quality.finished.import.notes', aliases: ['备注'] },
        ],
        [
          t('app.kuaizhizao.quality.finished.importExample.workOrderCode'),
          t('app.kuaizhizao.quality.finished.importExample.inspectionQty'),
          t('app.kuaizhizao.quality.finished.importExample.qualifiedQty'),
          t('app.kuaizhizao.quality.finished.importExample.unqualifiedQty'),
          pickImportExampleValue(disposalImportOptions, 'rework'),
          '',
        ],
      ),
    [t, i18n.language, disposalImportOptions],
  );
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const currentUser = useCurrentUser();
  const { token } = AntdTheme.useToken();
  const finishedGoodsInspectionDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const urlListFiltersRef = useRef<{ work_order_id?: number }>({});
  const deepLinkOpenedRef = useRef(false);
  const deepLinkEnsureTriedRef = useRef(false);
  const tableRowsRef = useRef<FinishedGoodsInspection[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is FinishedGoodsInspection => row != null),
    [selectedRowKeys],
  );
  const [pushReworkPreviewOpen, setPushReworkPreviewOpen] = useState(false);
  const [pushReworkPreviewLoading, setPushReworkPreviewLoading] = useState(false);
  const [pushReworkPreviewConfirming, setPushReworkPreviewConfirming] = useState(false);
  const [pushReworkPreviewData, setPushReworkPreviewData] = useState<PushPreviewResponse | null>(null);
  const [pushReworkPreviewSourceId, setPushReworkPreviewSourceId] = useState<number | null>(null);
  const [pushReworkPreviewQuantity, setPushReworkPreviewQuantity] = useState<number>(0);
  const pullFromWorkOrderCloseRef = useRef<(() => void) | null>(null);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(pullFromWorkOrderAction.label),
    [pullFromWorkOrderAction.label],
  );

  const invalidateStats = () => queryClient.invalidateQueries({ queryKey: ['finished-goods-inspection-statistics'] });
  const disposalFallback = useMemo(() => getQualityFinishedDisposalFallback(t), [t]);
  const [disposalOptions, setDisposalOptions] = useState<Array<{ label: string; value: string }>>(disposalFallback);
  const [disposalLoading, setDisposalLoading] = useState(false);

  useEffect(() => {
    setDisposalOptions(disposalFallback);
  }, [disposalFallback]);

  useEffect(() => {
    const load = async () => {
      setDisposalLoading(true);
      try {
        const dictList = await getDataDictionaryList({ code: 'DISPOSAL_METHOD', page: 1, page_size: 1 });
        const dict = dictList.items?.[0];
        if (!dict) {
          setDisposalOptions(disposalFallback);
          return;
        }
        const items = await getDictionaryItemList(dict.uuid, true);
        setDisposalOptions(
          mergeQualityDisposalOptions(
            items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })),
            disposalFallback,
          ),
        );
      } catch {
        setDisposalOptions(disposalFallback);
      } finally {
        setDisposalLoading(false);
      }
    };
    load();
  }, [disposalFallback]);
  const finishedPerms = useResourcePermissions(FINISHED_RESOURCE);
  const finishedAuditEnabled = useAuditRequired('finished_goods_inspection');
  const finishedAuditColumn = useMemo(
    () => createListAuditPhaseColumn<FinishedGoodsInspection>({ t, auditEnabled: finishedAuditEnabled }),
    [t, finishedAuditEnabled],
  );
  const finishedAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('finished_goods_inspection'),
    [],
  );
  const inspectionDocStatusValueEnum = useMemo(
    () => buildQualityInspectionDocStatusValueEnum(t),
    [t],
  );
  const inspectionQualityStatusValueEnum = useMemo(
    () => buildQualityInspectionQualityStatusValueEnum(t),
    [t],
  );
  const ncPerms = useResourcePermissions(NC_RESOURCE);
  const { canPrint: canPrintCertificate } = useResourcePermissions(FINISHED_RESOURCE);
  const { canRead: canReadNcLedger } = useResourcePermissions(NC_RESOURCE);
  // 检验Modal状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<FinishedGoodsInspection | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: inspectionFormCustomFields,
    customFieldValues: inspectionFormCustomFieldValues,
    extractFormValues: extractInspectionFormValues,
    saveCustomFieldValues: saveInspectionCustomFieldValues,
    loadFieldValues: loadInspectionFormFieldValues,
    resetFieldValues: resetInspectionFormFieldValues,
  } = useCustomFields({
    tableName: FINISHED_GOODS_INSPECTION_CUSTOM_FIELD_TABLE,
    loadWhenOpen: true,
    open: inspectionModalVisible,
  });

  const {
    customFields: inspectionListCustomFields,
    generateCustomFieldColumns: generateInspectionCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichInspectionRecordsWithCustomFields,
    customFieldValues: inspectionDetailCustomFieldValues,
    loadFieldValuesForDetail: loadInspectionFieldValuesForDetail,
    resetDetailFieldValues: resetInspectionDetailFieldValues,
  } = useCustomFieldsForList<FinishedGoodsInspection>({ tableName: FINISHED_GOODS_INSPECTION_CUSTOM_FIELD_TABLE });
  // 详情Drawer状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [certificatePrintOpen, setCertificatePrintOpen] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<FinishedGoodsInspection | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailInspectionId, setDetailInspectionId] = useState<number | null>(null);

  const [fgiTrackingRefreshKey, setFgiTrackingRefreshKey] = useState(0);

  const finishedTracking = useDocumentTracking(
    detailDrawerVisible && inspectionDetail?.id ? 'finished_goods_inspection' : undefined,
    inspectionDetail?.id,
    fgiTrackingRefreshKey,
  );

  // 创建不合格品记录Modal状态
  const [createDefectModalVisible, setCreateDefectModalVisible] = useState(false);
  const [currentDefectInspection, setCurrentDefectInspection] = useState<FinishedGoodsInspection | null>(null);
  const defectFormRef = useRef<any>(null);

  // 统计数据（从接口获取）
  const { data: statsData } = useQuery({
    queryKey: ['finished-goods-inspection-statistics'],
    queryFn: () => qualityApi.finishedGoodsInspection.statistics(),
    staleTime: 0,
  });
  const stats = {
    pendingCount: statsData?.pending_count ?? 0,
    qualifiedCount: statsData?.qualified_count ?? 0,
    unqualifiedCount: statsData?.unqualified_count ?? 0,
    totalInspected: statsData?.total_count ?? 0,
  };

  // 处理详情查看
  const loadInspectionDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await qualityApi.finishedGoodsInspection.get(id.toString());
      setInspectionDetail(detail);
      setFgiTrackingRefreshKey((k) => k + 1);
      await loadInspectionFieldValuesForDetail(id);
      return detail;
    } catch (error: any) {
      setDetailError(error?.message || t('app.kuaizhizao.quality.common.messages.loadDetailFailed'));
      setInspectionDetail((prev) => (prev?.id === id ? prev : null));
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDetail = (record: FinishedGoodsInspection) => {
    if (record.id == null) return;
    setDetailInspectionId(record.id);
    setDetailDrawerVisible(true);
    setInspectionDetail((prev) => (prev?.id === record.id ? prev : null));
    void loadInspectionDetail(record.id);
  };

  // URL 深链：入库/关联面板带 work_order_id 或 finished_goods_inspection_id
  useEffect(() => {
    if (deepLinkOpenedRef.current) return;
    const woId = searchParams.get('work_order_id');
    const inspId = searchParams.get('finished_goods_inspection_id');

    if (inspId && /^\d+$/.test(inspId)) {
      deepLinkOpenedRef.current = true;
      void (async () => {
        setDetailInspectionId(Number(inspId));
        setDetailDrawerVisible(true);
        setInspectionDetail((prev) => (prev?.id === Number(inspId) ? prev : null));
        const detail = await loadInspectionDetail(Number(inspId));
        if (detail?.work_order_id != null) {
          urlListFiltersRef.current = { work_order_id: Number(detail.work_order_id) };
        }
        actionRef.current?.reload();
      })();
      return;
    }

    if (woId && /^\d+$/.test(woId)) {
      deepLinkOpenedRef.current = true;
      urlListFiltersRef.current = { work_order_id: Number(woId) };
      actionRef.current?.reload();
    }
  }, [searchParams, messageApi, t, loadInspectionFieldValuesForDetail]);

  // 处理检验
  const handleInspect = async (record: FinishedGoodsInspection) => {
    setCurrentInspection(record);
    setInspectionModalVisible(true);

    const baseValues = {
      qualified_quantity: record.inspection_quantity || 0,
      unqualified_quantity: 0,
      notes: '',
      attachments: mapAttachmentsToUploadList(record.attachments),
    };
    if (record.id != null) {
      const customFormValues = await loadInspectionFormFieldValues(record.id);
      formRef.current?.setFieldsValue({ ...baseValues, ...customFormValues });
    } else {
      formRef.current?.setFieldsValue(baseValues);
    }
  };

  // 处理检验提交
  const handleInspectionSubmit = async (values: any) => {
    try {
      const normalized = await normalizeInspectionConductPayload(values, {
        materialId: currentInspection?.material_id,
        materialUnit: currentInspection?.material_unit,
        scenario: 'production',
      });
      const { standardValues, customData } = extractInspectionFormValues(normalized);
      if (currentInspection?.id) {
        await qualityApi.finishedGoodsInspection.conduct(currentInspection.id.toString(), {
          qualified_quantity: standardValues.qualified_quantity,
          unqualified_quantity: standardValues.unqualified_quantity,
          notes: standardValues.notes,
          nonconformance_reason: standardValues.nonconformance_reason,
          attachments: normalizeDocumentAttachments(standardValues.attachments),
          ...pickInspectionConductExtras(standardValues),
        });
        if (Object.keys(customData).length > 0) {
          await saveInspectionCustomFieldValues(currentInspection.id, customData);
        }
      }

      messageApi.success(t('app.kuaizhizao.quality.finished.messages.inspectSuccess'));
      setInspectionModalVisible(false);
      formRef.current?.resetFields();
      resetInspectionFormFieldValues();
      invalidateStats();
      actionRef.current?.reload();
      if (inspectionDetail?.id === currentInspection?.id && currentInspection?.id != null) {
        await loadInspectionFieldValuesForDetail(currentInspection.id);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.quality.common.messages.inspectFailed'));
      throw error;
    }
  };

  // 处理批量导入（UniTable 内置，分片避免大文件超时）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await importExcelMatrixInChunks({
        data,
        hasExampleRow: true,
        title: t('common.importing', { defaultValue: '正在导入数据' }),
        importChunk: (matrix) => qualityApi.finishedGoodsInspection.import(matrix),
      });
      const successCount = result.success_count;
      const failureCount = result.failure_count;
      if (failureCount > 0) {
        messageApi.warning(t('common.importResult', { success_count: successCount, failure_count: failureCount }));
      } else {
        messageApi.success(t('common.importSuccess', { count: successCount }));
      }
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.importFailed'));
    }
  };

  // 处理批量导出（UniTable 内置）
  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: FinishedGoodsInspection[]) => {
    try {
      if (type === 'all') {
        const blob = await qualityApi.finishedGoodsInspection.export();
        const exportDate = todaySiteDateString();
        const filename = `${t('app.kuaizhizao.quality.common.entity.finishedInspection')}_${exportDate}.xlsx`;
        downloadFile(blob, filename);
        messageApi.success(t('app.kuaizhizao.quality.common.messages.exportSuccess'));
      } else {
        const toExport = type === 'selected' && selectedRowKeys?.length
          ? (currentPageData || []).filter((r) => r.id != null && selectedRowKeys.includes(r.id))
          : currentPageData || [];
        if (toExport.length === 0) {
          messageApi.warning(t('app.kuaizhizao.quality.common.messages.exportEmpty'));
          return;
        }
        await downloadRecordsAsXlsx(
          toExport as Array<Record<string, unknown>>,
          `${t('app.kuaizhizao.quality.common.entity.finishedInspection')}_${todaySiteDateString()}.xlsx`,
        );
        messageApi.success(t('common.exportCountSuccess', { count: toExport.length }));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.exportFailed'));
    }
  };

  type FinishedGoodsPullWorkOrderCandidate = QualityPullCandidateBase & {
    work_order_code?: string;
    product_name?: string;
    material_code?: string;
    sales_order_code?: string;
    planned_quantity?: number | null;
    completed_quantity?: number | null;
    capabilities?: { pull_finished_goods_inspection?: { allowed?: boolean; reason?: string } };
  };

  const isPullFinishedGoodsInspectionSelectable = useCallback(
    (row: FinishedGoodsPullWorkOrderCandidate) =>
      row.capabilities?.pull_finished_goods_inspection?.allowed !== false,
    [],
  );

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const finishedWorkOrderPullColumns = useMemo(() => buildFinishedWorkOrderPullColumns(t), [t]);

  const pullFromWorkOrderQuery = useUniPullQuery<FinishedGoodsPullWorkOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await qualityApi.finishedGoodsInspection.listWorkOrderPullCandidates({
          skip: 0,
          limit: 100,
          keyword: keyword.trim() || undefined,
        });
        const rows = (res.data || []) as FinishedGoodsPullWorkOrderCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullFinishedGoodsInspectionSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch {
        messageApi.error(t('app.kuaizhizao.quality.finished.messages.loadWorkOrderFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => !isPullFinishedGoodsInspectionSelectable(row),
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.finished.form.selectWorkOrder'));
        return;
      }
      pullFromWorkOrderCloseRef.current?.();
      try {
        await qualityApi.finishedGoodsInspection.createFromWorkOrder(String(selected.id));
        messageApi.success(t('app.kuaizhizao.quality.finished.messages.createSuccess'));
        invalidateStats();
        actionRef.current?.reload();
      } catch (error: any) {
        messageApi.error(
          qualityInspectionCapabilityReasonMessage(error?.message, t) ||
            error?.message ||
            t('app.kuaizhizao.quality.finished.messages.createFailed'),
        );
      }
    },
  });
  pullFromWorkOrderCloseRef.current = pullFromWorkOrderQuery.closeModal;
  useNewShortcut(pullFromWorkOrderQuery.openModal);

  // 处理创建不合格品记录
  const handleCreateDefect = (record: FinishedGoodsInspection) => {
    setCurrentDefectInspection(record);
    setCreateDefectModalVisible(true);
    defectFormRef.current?.setFieldsValue({
      defect_quantity: record.unqualified_quantity || 0,
      defect_type: 'other',
      defect_reason: '',
      disposition: 'rework', // 成品检验不合格默认返工
      remarks: '',
    });
  };

  // 处理创建不合格品记录提交
  const handleCreateDefectSubmit = async (values: any) => {
    try {
      if (currentDefectInspection?.id) {
        await qualityApi.finishedGoodsInspection.createDefect(currentDefectInspection.id.toString(), {
          defect_quantity: values.defect_quantity,
          defect_type: values.defect_type,
          defect_reason: values.defect_reason,
          disposition: values.disposition,
          downgrade_material_id: values.downgrade_material_id,
          downgrade_warehouse_id: values.downgrade_warehouse_id,
          remarks: values.remarks,
        });
      }

      messageApi.success(
        canReadNcLedger ? {
          content: (
            <Space>
              <span>{t('app.kuaizhizao.quality.common.messages.createDefectSuccess')}</span>
              <Button
                type="link"
                size="small"
                onClick={() =>
                  window.open(
                    `/apps/kuaizhizao/quality-management/nonconforming-ledger?finished_goods_inspection_id=${currentDefectInspection?.id || ''}`,
                    '_blank'
                  )
                }
              >
                {t('app.kuaizhizao.quality.common.actions.viewLedger')}
              </Button>
            </Space>
          ),
        } : t('app.kuaizhizao.quality.common.messages.createDefectSuccess')
      );
      setCreateDefectModalVisible(false);
      defectFormRef.current?.resetFields();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.quality.common.messages.createDefectFailed'));
      throw error;
    }
  };

  const resetPushReworkPreview = () => {
    setPushReworkPreviewOpen(false);
    setPushReworkPreviewSourceId(null);
    setPushReworkPreviewData(null);
    setPushReworkPreviewQuantity(0);
  };

  const openPushReworkPreview = async (record: FinishedGoodsInspection) => {
    if (!record.id) return;
    setPushReworkPreviewOpen(true);
    setPushReworkPreviewLoading(true);
    setPushReworkPreviewConfirming(false);
    setPushReworkPreviewSourceId(record.id);
    setPushReworkPreviewData(null);
    setPushReworkPreviewQuantity(0);
    try {
      const data = await qualityApi.finishedGoodsInspection.previewPushToRework(String(record.id));
      setPushReworkPreviewData(data);
      const line = data.items?.[0];
      const defaultQty = Number(line?.max_push_quantity ?? 0);
      setPushReworkPreviewQuantity(Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 0);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.pushReworkFailed'));
      resetPushReworkPreview();
    } finally {
      setPushReworkPreviewLoading(false);
    }
  };

  const handlePushReworkPreviewConfirm = async () => {
    if (!pushReworkPreviewSourceId || !pushReworkPreviewData || pushReworkPreviewData.has_blocking_issues) return;
    const maxQty = Number(pushReworkPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const qty = Number(pushReworkPreviewQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyInvalid', { code: pushReworkPreviewData.items?.[0]?.material_code || pushReworkPreviewSourceId }));
      return;
    }
    if (qty > maxQty) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyExceedsRemaining', { code: pushReworkPreviewData.items?.[0]?.material_code || pushReworkPreviewSourceId }));
      return;
    }
    setPushReworkPreviewConfirming(true);
    try {
      const result = await qualityApi.finishedGoodsInspection.pushToRework(String(pushReworkPreviewSourceId), {
        quantity: qty,
      });
      const reworkCode = (result as { rework_order_code?: string })?.rework_order_code;
      messageApi.success(
        reworkCode
          ? t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: reworkCode })
          : t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: '-' }),
      );
      resetPushReworkPreview();
      invalidateStats();
      actionRef.current?.reload();
      if (inspectionDetail?.id === pushReworkPreviewSourceId) {
        const detail = await qualityApi.finishedGoodsInspection.get(String(pushReworkPreviewSourceId));
        setInspectionDetail(detail as FinishedGoodsInspection);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.pushReworkFailed'));
    } finally {
      setPushReworkPreviewConfirming(false);
    }
  };

  const selectedFinishedForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const canPushReworkToolbar = selectedFinishedForToolbar?.capabilities?.push_rework?.allowed === true;

  const toolbarPushDisabledReason = useMemo(() => {
    const base = buildUniPushToolbarDisabledReason(t, {
      selectedCount: selectedRowKeys.length,
      hasSelectedRecord: !!selectedFinishedForToolbar,
    });
    if (base) return base;
    if (selectedFinishedForToolbar && !canPushReworkToolbar) {
      return (
        qualityInspectionCapabilityReasonMessage(
          selectedFinishedForToolbar.capabilities?.push_rework?.reason,
          t,
        ) || t('components.uniPush.disabled.unavailable')
      );
    }
    return undefined;
  }, [canPushReworkToolbar, selectedFinishedForToolbar, selectedRowKeys.length, t]);

  const toolbarPushMenuItems = useMemo(
    () =>
      buildUniPushMenuItems([
        {
          key: 'push-rework',
          label: pushToReworkAction.label,
          disabled: !selectedFinishedForToolbar || !canPushReworkToolbar,
          title: selectedFinishedForToolbar && !canPushReworkToolbar
            ? qualityInspectionCapabilityReasonMessage(
                selectedFinishedForToolbar.capabilities?.push_rework?.reason,
                t,
              )
            : undefined,
          onClick: () => {
            if (selectedFinishedForToolbar && canPushReworkToolbar) {
              void openPushReworkPreview(selectedFinishedForToolbar);
            }
          },
        },
      ]),
    [canPushReworkToolbar, pushToReworkAction.label, selectedFinishedForToolbar, t],
  );

  const detailBaseColumns: ProDescriptionsItemProps<FinishedGoodsInspection>[] = useMemo(
    () => [
      buildQualityInspectionDetailCodeColumn<FinishedGoodsInspection>(t),
      ...buildQualityInspectionDetailMaterialColumns<FinishedGoodsInspection>(t),
      { title: t('app.kuaizhizao.quality.common.columns.materialSpec'), dataIndex: 'material_spec' },
      { title: t('app.kuaizhizao.quality.common.columns.batchNo'), dataIndex: 'batch_number' },
      {
        title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
        dataIndex: 'work_order_code',
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.salesOrderCode'),
        dataIndex: 'sales_order_code',
      },
      { title: t('app.kuaizhizao.quality.common.columns.customer'), dataIndex: 'customer_name' },
      ...buildQualityInspectionDetailQuantityStatusColumns<FinishedGoodsInspection>(t),
      ...buildQualityInspectionDetailPeopleColumns<FinishedGoodsInspection>(t),
      buildQualityInspectionDetailNotesColumn<FinishedGoodsInspection>(t),
    ],
    [t]
  );

  const inspectionCustomFieldColumns = generateInspectionCustomFieldColumns();

  const handleDeleteRow = useCallback(
    (record: FinishedGoodsInspection) => {
      if (record.id == null) return;
      getAntdModal().confirm({
        title: t('app.kuaizhizao.quality.finished.messages.deleteConfirm', { count: 1 }),
        onOk: async () => {
          await qualityApi.finishedGoodsInspection.delete(String(record.id));
          messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: 1 }));
          if (inspectionDetail?.id === record.id) {
            setDetailDrawerVisible(false);
            setInspectionDetail(null);
          }
          invalidateStats();
          actionRef.current?.reload();
        },
      });
    },
    [inspectionDetail?.id, messageApi, t],
  );

  const handleRevokeConduct = useCallback(
    (record: FinishedGoodsInspection) => {
      if (record.id == null) return;
      getAntdModal().confirm({
        title: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmTitle'),
        content: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmContent', {
          code: record.inspection_code || record.id,
        }),
        onOk: async () => {
          await qualityApi.finishedGoodsInspection.revokeConduct(String(record.id));
          messageApi.success(t('app.kuaizhizao.quality.common.messages.revokeConductSuccess'));
          if (inspectionDetail?.id === record.id) {
            setDetailDrawerVisible(false);
            setInspectionDetail(null);
          }
          invalidateStats();
          actionRef.current?.reload();
        },
      });
    },
    [inspectionDetail?.id, messageApi, t],
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
            await qualityApi.finishedGoodsInspection.revokeConduct(String(row.id));
          }
          messageApi.success(
            t('app.kuaizhizao.quality.common.messages.revokeConductBatchSuccess', { count: targets.length }),
          );
          setSelectedRowKeys([]);
          invalidateStats();
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(
            qualityInspectionCapabilityReasonMessage(error?.message, t) ||
              error?.message ||
              t('app.kuaizhizao.quality.common.messages.revokeConductFailed'),
          );
        }
      },
    });
  }, [messageApi, selectedRecordsForBatch, t]);

  const renderFinishedRowNodes = (record: FinishedGoodsInspection): React.ReactNode[] => {
    const gates = qualityInspectionRowGates(record, finishedPerms, ncPerms, t);
    const nodes: React.ReactNode[] = [
      <Button {...rowActionKind('read')}
        key="detail"
        size="small"
        type="link"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        {t('app.kuaizhizao.quality.common.actions.detail')}
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
            void handleInspect(record);
          }}
        >
          {t('app.kuaizhizao.quality.common.actions.inspect')}
        </Button>,
      );
    }
    nodes.push(
      <UniWorkflowActions
        {...rowActionKind('skip')}
        key="wf"
        record={record}
        {...qualityInspectionUniAuditProps({
          entityType: 'finished_goods_inspection',
          resourcePrefix: FINISHED_RESOURCE,
          entityName: t('app.kuaizhizao.quality.common.entity.finishedInspection'),
          onSuccess: () => {
            actionRef.current?.reload();
            if (inspectionDetail?.id === record.id) {
              qualityApi.finishedGoodsInspection
                .get(record.id!.toString())
                .then(async (d) => {
                  setInspectionDetail(d);
                  setFgiTrackingRefreshKey((k) => k + 1);
                  if (record.id != null) {
                    await loadInspectionFieldValuesForDetail(record.id);
                  }
                })
                .catch(() => {});
            }
          },
        })}
      />,
    );
    if (gates.createDefect.allowed) {
      nodes.push(
        <Button
          {...rowActionKind('skip')}
          key="defect"
          size="small"
          type="link"
          danger
          disabled={gates.createDefect.disabled}
          title={gates.createDefect.title}
          onClick={(e) => {
            e.stopPropagation();
            handleCreateDefect(record);
          }}
        >
          {t('app.kuaizhizao.quality.common.actions.createDefect')}
        </Button>
      );
    }
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
  };

  // 表格列定义
  const columns: ProColumns<FinishedGoodsInspection>[] = useMemo(
    () => alignProColumns<FinishedGoodsInspection>([
    ...buildQualityInspectionListSearchColumns<FinishedGoodsInspection>(
      t,
      inspectionDocStatusValueEnum,
      inspectionQualityStatusValueEnum,
    ),
    buildQualityInspectionListCodeColumn<FinishedGoodsInspection>(t),
    buildQualityInspectionListKindColumn<FinishedGoodsInspection>(t),
    buildQualityInspectionPartnerStackedColumn<FinishedGoodsInspection>(
      t('app.kuaizhizao.quality.common.columns.workOrderSalesOrder'),
      ['work_order_code', 'workOrderCode'],
      ['sales_order_code', 'salesOrderCode'],
      { dataIndex: 'work_order_code' },
    ),
    {
      title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
      dataIndex: 'work_order_code',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.salesOrderCode'),
      dataIndex: 'sales_order_code',
      hideInTable: true,
    },
    buildQualityInspectionListMaterialColumn<FinishedGoodsInspection>(t),
    ...buildQualityInspectionListMaterialHiddenColumns<FinishedGoodsInspection>(t),
    buildInspectorNameColumn<FinishedGoodsInspection>(t('app.kuaizhizao.quality.common.columns.inspector')),
    ...buildQualityInspectionListQuantityResultColumns<FinishedGoodsInspection>(t, [
      buildQualityInspectionListPushProgressColumn<FinishedGoodsInspection>(t, {
        dataIndex: 'pushed_rework_quantity',
        getPercent: (record) =>
          finishedGoodsReworkPushPercent(record.pushed_rework_quantity, record.unqualified_quantity),
      }),
    ]),
    ...buildDocumentAuditColumns<FinishedGoodsInspection>(t),
    ...inspectionCustomFieldColumns,
    ...(finishedAuditColumn ? [finishedAuditColumn] : []),
    {
      title: t('app.kuaizhizao.quality.common.columns.lifecycle'),
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
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
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => renderFinishedRowNodes(record),
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [t, finishedAuditColumn, inspectionCustomFieldColumns, inspectionDocStatusValueEnum, inspectionQualityStatusValueEnum],
  );

  // 检验明细表格列定义 (当前未使用)
  // const detailColumns = [...];

  return (
    <ListPageTemplate
      statCards={[
        {
          title: t('app.kuaizhizao.quality.common.stats.pendingCount'),
          value: stats.pendingCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#faad14' },
        },
        {
          title: t('app.kuaizhizao.quality.common.stats.qualifiedCount'),
          value: stats.qualifiedCount,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          title: t('app.kuaizhizao.quality.common.stats.unqualifiedCount'),
          value: stats.unqualifiedCount,
          prefix: <CloseCircleOutlined />,
          valueStyle: { color: '#f5222d' },
        },
        {
          title: t('app.kuaizhizao.quality.common.stats.totalInspected'),
          value: stats.totalInspected,
          prefix: <CheckCircleOutlined />,
          valueStyle: { color: '#1890ff' },
        },
      ]}
    >
      <UniTable<FinishedGoodsInspection>
        headerTitle={t('app.kuaizhizao.quality.finished.pageTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.finished-goods-inspection.rank-v7"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        pinnedTabsField={QUALITY_INSPECTION_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          try {
            const listParams = resolveQualityInspectionListParams(searchFormValues, sort);
            const listRequest = async () => {
              const response = await qualityApi.finishedGoodsInspection.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...listParams,
                ...urlListFiltersRef.current,
              });
              return normalizeQualityInspectionListResponse(response);
            };

            let { data: raw, total } = await listRequest();

            // 深链带工单且尚无检验单时补建一次（末道报工自动建单失败后的缺口）
            const deepLinkWoId = urlListFiltersRef.current.work_order_id;
            if (
              total === 0 &&
              deepLinkWoId != null &&
              !deepLinkEnsureTriedRef.current &&
              (params.current === 1 || params.current == null)
            ) {
              deepLinkEnsureTriedRef.current = true;
              try {
                await qualityApi.finishedGoodsInspection.createFromWorkOrder(String(deepLinkWoId));
                ({ data: raw, total } = await listRequest());
              } catch {
                // 物料无需 FQC / 组织未开启等：保持空列表，由用户手工判断
              }
            }

            const data = meta?.purpose === 'prefetch'
              ? raw as FinishedGoodsInspection[]
              : await enrichInspectionRecordsWithCustomFields(raw as FinishedGoodsInspection[]);
            return {
              data,
              success: true,
              total,
            };
          } catch (error) {
            messageApi.error(t('app.kuaizhizao.quality.finished.messages.loadListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        showCreateButton={true}
        createButtonText={createButtonLabel}
        onCreate={pullFromWorkOrderQuery.openModal}
        toolBarRender={() => [
          <UniPushToolbarButton
            key={`finished-goods-push-${selectedFinishedForToolbar?.id ?? 'none'}`}
            menuItems={toolbarPushMenuItems}
            disabled={selectedRowKeys.length !== 1 || !selectedFinishedForToolbar}
            disabledReason={toolbarPushDisabledReason}
          />,
        ]}
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={finishedInspectionImportTemplate.importHeaders}
        importExampleRow={finishedInspectionImportTemplate.importExampleRow}
        importColumnOptions={finishedInspectionImportTemplate.importColumnOptions}
        importFieldMap={finishedInspectionImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
        showDeleteButton={true}
        onDelete={async () => {
          try {
            const deletable = filterDeletableQualityInspectionRecords(selectedRecordsForBatch);
            if (!deletable.length) {
              messageApi.warning(t('app.kuaizhizao.quality.common.messages.deleteBatchEmpty'));
              return;
            }
            const ids = deletable.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
            for (const id of ids) {
              await qualityApi.finishedGoodsInspection.delete(String(id));
            }
            messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: ids.length }));
            setSelectedRowKeys([]);
            if (inspectionDetail?.id != null && ids.includes(inspectionDetail.id)) {
              setDetailDrawerVisible(false);
              setInspectionDetail(null);
            }
            invalidateStats();
            actionRef.current?.reload();
          } catch (error: any) {
            messageApi.error(error.message || t('app.kuaizhizao.quality.common.messages.deleteFailed'));
          }
        }}
        toolBarActionsAfterDelete={[
          <Button key="revoke-conduct-batch" icon={<RollbackOutlined />} onClick={() => void handleBatchRevokeConduct()}>
            {t('app.kuaizhizao.quality.common.actions.revokeConduct')}
          </Button>,
          <UniAuditBatchMenuButton
            key="finished-goods-inspection-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedRecordsForBatch}
            auditEnabled={finishedAuditEnabled}
            permGates={finishedPerms}
            handlers={finishedAuditBatchHandlers}
            onSuccess={() => {
              setSelectedRowKeys([]);
              invalidateStats();
              actionRef.current?.reload();
            }}
            toolBarButtonSize="middle"
          />,
        ]}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.finished.messages.deleteConfirm', { count })}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.quality.finished.modal.inspectTitle', { code: currentInspection?.inspection_code || '' })}
        open={inspectionModalVisible}
        onClose={() => {
          setInspectionModalVisible(false);
          resetInspectionFormFieldValues();
        }}
        onFinish={handleInspectionSubmit}
        isEdit={false}
        initialValues={
          currentInspection ? {
            qualified_quantity: currentInspection.inspection_quantity || 0,
            unqualified_quantity: 0,
            notes: '',
          } : {}
        }
        width={
          hasInspectionPlanSteps(getInspectionTemplateSource(currentInspection as Record<string, unknown>))
            ? MODAL_CONFIG.LARGE_WIDTH
            : MODAL_CONFIG.STANDARD_WIDTH
        }
        grid
        formRef={formRef}
      >
        {currentInspection ? (
          <Col span={24}>
            <Card title={t('app.kuaizhizao.quality.common.sections.inspectionInfo')} size="small" style={{ marginBottom: 8 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <strong>{t('app.kuaizhizao.quality.common.label.workOrderCode')}：</strong>{currentInspection.work_order_code}
                </Col>
                <Col span={6}>
                  <strong>{t('app.kuaizhizao.quality.common.label.materialCode')}：</strong>{currentInspection.material_code}
                </Col>
                <Col span={6}>
                  <strong>{t('app.kuaizhizao.quality.common.label.materialName')}：</strong>{currentInspection.material_name}
                </Col>
                <Col span={6}>
                  <strong>{t('app.kuaizhizao.quality.common.label.inspectionQty')}：</strong>
                  {formatQuantityWithUnit(
                    currentInspection.inspection_quantity,
                    currentInspection.material_unit,
                  )}
                </Col>
              </Row>
            </Card>
          </Col>
        ) : null}
        <InspectionTemplateConductFields
          inspection={currentInspection as Record<string, unknown>}
          photoCategory="finished_goods_inspection_attachments"
        />
        <InspectionConductQuantityFields
          materialId={currentInspection?.material_id}
          materialUnit={currentInspection?.material_unit}
          scenario="production"
          inspectionQuantity={Number(currentInspection?.inspection_quantity || 0)}
          inspection={currentInspection as Record<string, unknown> | undefined}
          t={t}
        />
        <InspectionNonconformanceReasonField t={t} />
        <CustomFieldsFormSection
          customFields={inspectionFormCustomFields}
          customFieldValues={inspectionFormCustomFieldValues}
          gridColumns={2}
        />
        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.quality.common.form.notes')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.notes')}
          fieldProps={{ rows: 2 }}
          colProps={{ span: 24 }}
        />
        <DocumentAttachmentsField category="finished_goods_inspection_attachments" />
      </FormModalTemplate>

      <UniPullQueryModal<FinishedGoodsPullWorkOrderCandidate>
        open={pullFromWorkOrderQuery.open}
        title={pullFromWorkOrderAction.label}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={pullFromWorkOrderQuery.handleConfirm}
        rowKey="id"
        columns={finishedWorkOrderPullColumns}
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
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromWorkOrderQuery.page}
        pageSize={pullFromWorkOrderQuery.pageSize}
        total={pullFromWorkOrderQuery.total}
        onPageChange={pullFromWorkOrderQuery.handlePageChange}
        scopeOptions={pullFromWorkOrderQuery.scopeOptions}
        scope={pullFromWorkOrderQuery.scope}
        onScopeChange={pullFromWorkOrderQuery.handleScopeChange}
      />

      {/* 成品检验详情 Drawer */}
      <QualityInspectionDetailDrawer
        title={t('app.kuaizhizao.quality.finished.modal.detailTitle', { code: inspectionDetail?.inspection_code || '' })}
        open={detailDrawerVisible}
        zIndex={finishedGoodsInspectionDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setInspectionDetail(null);
          setDetailError(null);
          setDetailInspectionId(null);
          resetInspectionDetailFieldValues();
        }}
        inspection={inspectionDetail}
        documentType="finished_goods_inspection"
        loading={detailLoading}
        error={detailError}
        onRetry={detailInspectionId != null ? () => void loadInspectionDetail(detailInspectionId) : undefined}
        extra={
          inspectionDetail ? (
            <Space wrap size="small">
              {buildInspectionQualityExtraButtons({
                inspection: inspectionDetail,
                inspectionType: 'finished',
                t,
                navigate,
                onRegisterDefect: () => handleCreateDefect(inspectionDetail),
                canRegisterDefect:
                  qualityInspectionRowGates(inspectionDetail, finishedPerms, ncPerms, t).createDefect.allowed &&
                  !qualityInspectionRowGates(inspectionDetail, finishedPerms, ncPerms, t).createDefect.disabled,
                onCloseDrawer: () => {
                  setDetailDrawerVisible(false);
                  setInspectionDetail(null);
                },
              })}
              {canPrintCertificate &&
              inspectionDetail.certificate_issued &&
              inspectionDetail.quality_status === '合格' ? (
                <Button
                  icon={<PrinterOutlined />}
                  onClick={() => setCertificatePrintOpen(true)}
                >
                  {t('app.kuaizhizao.quality.finished.actions.printCertificate')}
                </Button>
              ) : null}
              <UniWorkflowActions
                {...rowActionKind('skip')}
                record={inspectionDetail}
                {...qualityInspectionUniAuditProps({
                  entityType: 'finished_goods_inspection',
                  resourcePrefix: FINISHED_RESOURCE,
                  entityName: t('app.kuaizhizao.quality.common.entity.finishedInspection'),
                  theme: 'default',
                  onSuccess: () => {
                    actionRef.current?.reload();
                    if (inspectionDetail?.id) {
                      qualityApi.finishedGoodsInspection
                        .get(inspectionDetail.id.toString())
                        .then(async (d) => {
                          setInspectionDetail(d);
                          setFgiTrackingRefreshKey((k) => k + 1);
                          await loadInspectionFieldValuesForDetail(inspectionDetail.id!);
                        })
                        .catch(() => {});
                    }
                  },
                })}
              />
            </Space>
          ) : null
        }
        banner={<InspectionUnqualifiedBanner inspection={inspectionDetail} />}
        basicColumns={detailBaseColumns}
        customFields={inspectionListCustomFields}
        customFieldValues={inspectionDetailCustomFieldValues}
        tracking={finishedTracking}
        renderBriefActions={(doc) => (
          <WarehouseTraceBriefPrimaryActions
            doc={doc}
            t={t}
            navigate={navigate}
            closeDrawer={() => {
              setDetailDrawerVisible(false);
              setInspectionDetail(null);
            }}
          />
        )}
      />

      {/* 创建不合格品记录Modal */}
      <FormModalTemplate
        title={t('app.kuaizhizao.quality.common.modal.createDefectTitle')}
        open={createDefectModalVisible}
        onClose={() => {
          setCreateDefectModalVisible(false);
          defectFormRef.current?.resetFields();
        }}
        onFinish={handleCreateDefectSubmit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={defectFormRef}
      >
        {currentDefectInspection && (
          <Card title={t('app.kuaizhizao.quality.common.sections.inspectionInfo')} size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.inspectionCode')}：</strong>{currentDefectInspection.inspection_code}
              </Col>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.materialName')}：</strong>{currentDefectInspection.material_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.unqualifiedQty')}：</strong>
                {formatQuantityWithUnit(
                  currentDefectInspection.unqualified_quantity,
                  currentDefectInspection.material_unit,
                )}
              </Col>
            </Row>
          </Card>
        )}
        <InspectionDefectQuantityField
          materialId={currentDefectInspection?.material_id}
          materialUnit={currentDefectInspection?.material_unit}
          maxQuantity={Number(currentDefectInspection?.unqualified_quantity || 0)}
          t={t}
        />
        <ProFormSelect
          name="defect_type"
          label={t('app.kuaizhizao.quality.common.form.defectType')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.defectType')}
          rules={[{ required: true, message: t('app.kuaizhizao.quality.common.validation.requiredDefectType') }]}
          options={getQualityDefectTypeOptions(t)}
        />
        <ProFormTextArea
          name="defect_reason"
          label={t('app.kuaizhizao.quality.common.form.defectReason')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.defectReason')}
          rules={[{ required: true, message: t('app.kuaizhizao.quality.common.validation.requiredDefectReason') }]}
          fieldProps={{ rows: 3 }}
        />
        <ProFormItem name="disposition" label={t('app.kuaizhizao.quality.common.form.disposition')} rules={[{ required: true, message: t('app.kuaizhizao.quality.common.validation.requiredDisposition') }]}>
          <UniDropdown
            placeholder={t('app.kuaizhizao.quality.common.form.selectDisposition')}
            showSearch
            allowClear
            loading={disposalLoading}
            options={disposalOptions}
            quickCreate={{ label: t('app.kuaizhizao.quality.common.form.dataDictionaryManage'), onClick: () => navigate('/system/data-dictionaries') }}
          />
        </ProFormItem>
        <DowngradeDispositionFields />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.quality.common.form.remarks')}
          placeholder={t('app.kuaizhizao.quality.common.form.remarks')}
          fieldProps={{ rows: 2 }}
        />
      </FormModalTemplate>

      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pushReworkPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPushReworkPreview}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        confirmLoading={pushReworkPreviewConfirming}
        onOk={() => void handlePushReworkPreviewConfirm()}
        okButtonProps={{
          disabled:
            pushReworkPreviewLoading ||
            !pushReworkPreviewData ||
            !!pushReworkPreviewData?.has_blocking_issues ||
            !(pushReworkPreviewData?.items || []).some((row) => Number(row.max_push_quantity ?? 0) > 0) ||
            !(Number(pushReworkPreviewQuantity) > 0),
        }}
      >
        {pushReworkPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushReworkPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushReworkPreviewData.summary}</p>
            {pushReworkPreviewData.has_blocking_issues && pushReworkPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={qualityInspectionCapabilityReasonMessage(
                  pushReworkPreviewData.blocking_reason,
                  t,
                )}
              />
            ) : null}
            {pushReworkPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushReworkPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 920 }}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' , render: formatQuantity },
                  {
                    title: t('app.kuaizhizao.salesOrder.colPushQty'),
                    width: 130,
                    render: (_: unknown, row: PushPreviewResponse['items'][number]) => {
                      const maxQty = Number(row.max_push_quantity ?? 0);
                      return (
                        <InputNumber
                          min={0}
                          max={Number.isFinite(maxQty) && maxQty > 0 ? maxQty : undefined}
                          precision={2}
                          style={{ width: '100%' }}
                          disabled={!(maxQty > 0)}
                          value={pushReworkPreviewQuantity}
                          onChange={(val) => setPushReworkPreviewQuantity(Number(val ?? 0))}
                        />
                      );
                    },
                  },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.workOrder.soPullPreviewNoLines')} />
            )}
            {pushReworkPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pushReworkPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <KuaizhizaoDocumentPrintModal
        open={certificatePrintOpen}
        onClose={() => setCertificatePrintOpen(false)}
        documentType="product_quality_certificate"
        documentId={inspectionDetail?.id ?? null}
        printApiPath={
          inspectionDetail?.id
            ? `/apps/kuaizhizao/finished-goods-inspections/${inspectionDetail.id}/print-certificate`
            : ''
        }
        title={t('app.kuaizhizao.quality.finished.modal.printCertificateTitle')}
      />
    </ListPageTemplate>
  );
};

export default FinishedGoodsInspectionPage;
