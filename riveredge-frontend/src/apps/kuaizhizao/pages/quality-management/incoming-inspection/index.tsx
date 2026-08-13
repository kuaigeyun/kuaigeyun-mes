/**
 * 来料检验页面
 *
 * 提供采购到货物料的检验功能，支持合格/不合格判定和处理
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import type { DescriptionsProps } from 'antd';
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
  Button,
  Space,
  Card,
  Row,
  Col,
  Modal,
  Descriptions,
  Typography,
  Dropdown,
  Spin,
  Empty,
  Alert,
  Table,
  theme as AntdTheme,
} from 'antd';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EyeOutlined, RollbackOutlined } from '@ant-design/icons';
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
  buildInspectorTimeStackedColumn,
  buildQualityInspectionListCodeColumn,
  buildQualityInspectionListMaterialColumn,
  buildQualityInspectionListMaterialHiddenColumns,
  buildQualityInspectionListQuantityResultColumns,
  buildQualityInspectionListSearchColumns,
  stackedPrimarySecondaryColumn,
} from '../components/qualityTableColumns';
import {
  buildQualityInspectionDetailCodeColumn,
  buildQualityInspectionDetailMaterialColumns,
  buildQualityInspectionDetailPeopleColumns,
  buildQualityInspectionDetailQuantityStatusColumns,
} from '../components/qualityDetailColumns';
import {
  buildIncomingCustomerMaterialPullColumns,
  buildIncomingPurchaseReceiptPullColumns,
  type QualityPullCandidateBase,
} from '../components/qualityPullQueryColumns';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getIncomingInspectionLifecycle } from '../../../utils/incomingInspectionLifecycle';
import { DetailAuditPhaseTitleExtra } from '../../../../../components/uni-audit/DetailAuditPhaseRow';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../../../services/api';
import { qualityApi } from '../../../services/production';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import InspectionTemplateConductResultsTable from '../components/InspectionTemplateConductResultsTable';
import QualityInspectionDetailAttachments from '../components/QualityInspectionDetailAttachments';
import InspectionDetailQualityActions from '../components/InspectionDetailQualityActions';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { downloadFile } from '../../../services/common';
import type { DocumentPushPreview } from '../../../services/purchase-requisition';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { DocumentPushProgressBar, DOCUMENT_PROGRESS_COLUMN_DEFAULTS } from '../../sales-management/shared/DocumentPushProgressBar';
import { incomingInspectionReturnPushPercent } from '../../sales-management/shared/pushProgress';
import {
  buildQualityInspectionDocStatusValueEnum,
  buildQualityInspectionQualityStatusValueEnum,
  normalizeQualityInspectionListResponse,
  QUALITY_INSPECTION_PINNED_STATUS_FIELD,
  resolveQualityInspectionListParams,
} from '../../../utils/qualityInspectionListCore';
import dayjs from 'dayjs';
import {formatDateTime, formatDateTimeBySiteSetting, formatQuantity} from '../../../../../utils/format';
import { formatQuantityWithUnit } from '../../../../../utils/materialUnitDisplay';
import {
  InspectionConductQuantityFields,
  InspectionDefectQuantityField,
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
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  getQualityIncomingDisposalFallback,
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

const INCOMING_RESOURCE = 'kuaizhizao:quality-management-incoming-inspection';
const INCOMING_INSPECTION_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_incoming_inspections';
const NC_RESOURCE = 'kuaizhizao:quality-management-nonconforming-ledger';

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = formatDateTime(value as string, 'YYYY-MM-DD HH:mm:ss');
    }
    if (col.render && dataSource != null) {
            content = (col.render as (dom: import('react').ReactNode, entity: T, i: number) => import('react').ReactNode)(
        content,
        dataSource,
        index,
      );
    }
    return {
      key: String(col.key ?? col.dataIndex ?? index),
      label: col.title as React.ReactNode,
      children: content !== undefined && content !== null ? content : '-',
      span: col.span ?? 1,
    };
  });
}

// 来料检验接口定义
interface IncomingInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  purchase_receipt_id?: number;
  purchase_receipt_code?: string;
  supplier_id?: number;
  supplier_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  inspection_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  pushed_purchase_return_quantity?: number;
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
  status?: string;
  notes?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string; status?: string }>;
  created_at?: string;
  updated_at?: string;
  capabilities?: {
    conduct?: { allowed?: boolean; reason?: string };
    create_defect?: { allowed?: boolean; reason?: string };
    push_purchase_return?: { allowed?: boolean; reason?: string };
    update?: { allowed?: boolean; reason?: string };
  };
}

const IncomingInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const pushToPurchaseReturnAction = resolveKuaizhizaoDocumentAction(t, 'purchase_return.pull_from_incoming_inspection');
  const pullFromPurchaseReceiptAction = resolveKuaizhizaoDocumentAction(t, 'incoming_inspection.pull_from_purchase_receipt');
  const pullFromCustomerMaterialAction = resolveKuaizhizaoDocumentAction(t, 'incoming_inspection.pull_from_customer_material_registration');
  const urlListFiltersRef = useRef<{ purchase_receipt_id?: number }>({});
  const deepLinkOpenedRef = useRef(false);

  const importDictOptions = useImportDictionaryOptions(['DISPOSAL_METHOD']);
  const disposalImportOptions = importDictOptions.DISPOSAL_METHOD ?? [];

  const incomingInspectionImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'purchaseReceiptCode',
            labelKey: 'app.kuaizhizao.quality.incoming.import.purchaseReceiptCode',
            aliases: ['采购入库单号'],
          },
          {
            field: 'material',
            labelKey: 'app.kuaizhizao.quality.incoming.import.materialCode',
            aliases: ['物料编号'],
          },
          { field: 'inspectionQty', labelKey: 'app.kuaizhizao.quality.incoming.import.inspectionQty', aliases: ['检验数量'] },
          { field: 'qualifiedQty', labelKey: 'app.kuaizhizao.quality.incoming.import.qualifiedQty', aliases: ['合格数量'] },
          { field: 'unqualifiedQty', labelKey: 'app.kuaizhizao.quality.incoming.import.unqualifiedQty', aliases: ['不合格数量'] },
          {
            field: 'disposition',
            labelKey: 'app.kuaizhizao.quality.common.form.disposition',
            aliases: ['处置方式', 'disposition'],
            options: disposalImportOptions,
          },
          { field: 'remark', labelKey: 'app.kuaizhizao.quality.incoming.import.notes', aliases: ['备注'] },
        ],
        [
          t('app.kuaizhizao.quality.incoming.importExample.purchaseReceiptCode'),
          t('app.kuaizhizao.quality.incoming.importExample.materialCode'),
          t('app.kuaizhizao.quality.incoming.importExample.inspectionQty'),
          t('app.kuaizhizao.quality.incoming.importExample.qualifiedQty'),
          t('app.kuaizhizao.quality.incoming.importExample.unqualifiedQty'),
          pickImportExampleValue(disposalImportOptions, 'return'),
          '',
        ],
      ),
    [t, i18n.language, disposalImportOptions],
  );
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const currentUser = useCurrentUser();
  const { token } = AntdTheme.useToken();
  const incomingInspectionDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<IncomingInspection[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(pullFromPurchaseReceiptAction.label),
    [pullFromPurchaseReceiptAction.label],
  );

  const invalidateStats = () => queryClient.invalidateQueries({ queryKey: ['incoming-inspection-statistics'] });
  const incomingPerms = useResourcePermissions(INCOMING_RESOURCE);
  const incomingAuditEnabled = useAuditRequired('incoming_inspection');
  const incomingAuditColumn = useMemo(
    () => createListAuditPhaseColumn<IncomingInspection>({ t, auditEnabled: incomingAuditEnabled }),
    [t, incomingAuditEnabled],
  );
  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is IncomingInspection => row != null),
    [selectedRowKeys],
  );
  const incomingAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('incoming_inspection'),
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
  const { canRead: canReadNcLedger } = useResourcePermissions(NC_RESOURCE);
  const disposalFallback = useMemo(() => getQualityIncomingDisposalFallback(t), [t]);
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
  // 检验Modal状态
  const [inspectionModalVisible, setInspectionModalVisible] = useState(false);
  const [currentInspection, setCurrentInspection] = useState<IncomingInspection | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: inspectionFormCustomFields,
    customFieldValues: inspectionFormCustomFieldValues,
    extractFormValues: extractInspectionFormValues,
    saveCustomFieldValues: saveInspectionCustomFieldValues,
    loadFieldValues: loadInspectionFormFieldValues,
    resetFieldValues: resetInspectionFormFieldValues,
  } = useCustomFields({
    tableName: INCOMING_INSPECTION_CUSTOM_FIELD_TABLE,
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
  } = useCustomFieldsForList<IncomingInspection>({ tableName: INCOMING_INSPECTION_CUSTOM_FIELD_TABLE });
  // 详情Drawer状态
  const [detailVisible, setDetailVisible] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<IncomingInspection | null>(null);

  const [iiTrackingRefreshKey, setIiTrackingRefreshKey] = useState(0);

  const incomingTracking = useDocumentTracking(
    detailVisible && inspectionDetail?.id ? 'incoming_inspection' : undefined,
    inspectionDetail?.id,
    iiTrackingRefreshKey,
  );

  // 创建不合格品记录Modal状态
  const [createDefectModalVisible, setCreateDefectModalVisible] = useState(false);
  const [currentDefectInspection, setCurrentDefectInspection] = useState<IncomingInspection | null>(null);
  const [pushPurchaseReturnPreviewOpen, setPushPurchaseReturnPreviewOpen] = useState(false);
  const [pushPurchaseReturnPreviewLoading, setPushPurchaseReturnPreviewLoading] = useState(false);
  const [pushPurchaseReturnPreviewConfirming, setPushPurchaseReturnPreviewConfirming] = useState(false);
  const [pushPurchaseReturnPreviewData, setPushPurchaseReturnPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pushPurchaseReturnPreviewSourceId, setPushPurchaseReturnPreviewSourceId] = useState<number | null>(null);
  type PullPreviewKind = 'purchase_receipt' | 'customer_material';
  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewConfirming, setPullPreviewConfirming] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullPreviewKind, setPullPreviewKind] = useState<PullPreviewKind | null>(null);
  const pullFromPurchaseReceiptCloseRef = useRef<(() => void) | null>(null);
  const pullFromCustomerMaterialCloseRef = useRef<(() => void) | null>(null);
  const defectFormRef = useRef<any>(null);

  // 统计数据（从接口获取）
  const { data: statsData } = useQuery({
    queryKey: ['incoming-inspection-statistics'],
    queryFn: () => qualityApi.incomingInspection.statistics(),
    staleTime: 0,
  });
  const stats = {
    pendingCount: statsData?.pending_count ?? 0,
    qualifiedCount: statsData?.qualified_count ?? 0,
    unqualifiedCount: statsData?.unqualified_count ?? 0,
    totalInspected: statsData?.total_count ?? 0,
  };

  // 处理检验
  const handleInspect = async (record: IncomingInspection) => {
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
        scenario: 'purchase',
      });
      const { standardValues, customData } = extractInspectionFormValues(normalized);
      if (currentInspection?.id) {
        await qualityApi.incomingInspection.conduct(currentInspection.id.toString(), {
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

      messageApi.success(t('app.kuaizhizao.quality.common.messages.inspectSuccess'));
      setInspectionModalVisible(false);
      formRef.current?.resetFields();
      resetInspectionFormFieldValues();
      invalidateStats();
      actionRef.current?.reload();
      if (inspectionDetail?.id === currentInspection?.id && currentInspection?.id != null) {
        await loadInspectionFieldValuesForDetail(currentInspection.id);
      }
    } catch (error: any) {
      messageApi.error(t('app.kuaizhizao.quality.common.messages.inspectFailed'));
      throw error;
    }
  };

  // 处理详情查看
  const handleDetail = async (record: IncomingInspection) => {
    try {
      const detail = await qualityApi.incomingInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailVisible(true);
      setIiTrackingRefreshKey((k) => k + 1);
      if (record.id != null) {
        await loadInspectionFieldValuesForDetail(record.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.quality.common.messages.loadDetailFailed'));
    }
  };

  // URL 深链：入库确认「前往来料检验」带 purchase_receipt_id / incoming_inspection_id
  useEffect(() => {
    if (deepLinkOpenedRef.current) return;
    const receiptId = searchParams.get('purchase_receipt_id');
    const inspId = searchParams.get('incoming_inspection_id') || searchParams.get('id');

    if (inspId && /^\d+$/.test(inspId)) {
      deepLinkOpenedRef.current = true;
      void (async () => {
        try {
          const detail = await qualityApi.incomingInspection.get(inspId);
          if (detail.purchase_receipt_id != null) {
            urlListFiltersRef.current = { purchase_receipt_id: Number(detail.purchase_receipt_id) };
          }
          setInspectionDetail(detail);
          setDetailVisible(true);
          setIiTrackingRefreshKey((k) => k + 1);
          if (detail.id != null) {
            await loadInspectionFieldValuesForDetail(detail.id);
          }
          actionRef.current?.reload();
        } catch {
          messageApi.error(t('app.kuaizhizao.quality.common.messages.loadDetailFailed'));
        }
      })();
      return;
    }

    if (receiptId && /^\d+$/.test(receiptId)) {
      deepLinkOpenedRef.current = true;
      urlListFiltersRef.current = { purchase_receipt_id: Number(receiptId) };
      actionRef.current?.reload();
    }
  }, [searchParams, messageApi, t, loadInspectionFieldValuesForDetail]);

  // 处理批量导入（UniTable 内置）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await qualityApi.incomingInspection.import(data) as any;
      const successCount = result?.success_count ?? result?.data?.success_count ?? 0;
      const failureCount = result?.failure_count ?? result?.data?.failure_count ?? 0;
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
  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: IncomingInspection[]) => {
    try {
      if (type === 'all') {
        const blob = await qualityApi.incomingInspection.export();
        const exportDate = new Date().toISOString().slice(0, 10);
        const filename = `${t('app.kuaizhizao.quality.common.entity.incomingInspection')}_${exportDate}.xlsx`;
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
          `${t('app.kuaizhizao.quality.common.entity.incomingInspection')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        );
        messageApi.success(t('common.exportCountSuccess', { count: toExport.length }));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.exportFailed'));
    }
  };

  // 从采购入库单 / 代工来料单加载创建来料检验单
  type PullSourceCandidate = QualityPullCandidateBase & {
    receipt_code?: string;
    purchase_order_code?: string;
    supplier_name?: string;
    registration_code?: string;
    customer_name?: string;
    sales_order_code?: string;
    work_order_code?: string;
    registration_date?: string | null;
    total_quantity?: number | null;
    capabilities?: {
      pull_incoming_inspection?: { allowed?: boolean; reason?: string };
    };
  };

  const purchaseReceiptPullColumns = useMemo(
    () => buildIncomingPurchaseReceiptPullColumns(t),
    [t],
  );
  const customerMaterialPullColumns = useMemo(
    () => buildIncomingCustomerMaterialPullColumns(t),
    [t],
  );

  const resetPullPreview = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewKind(null);
    setPullPreviewData(null);
  };

  const openPullPreview = async (kind: PullPreviewKind, sourceId: number) => {
    setPullPreviewKind(kind);
    setPullPreviewOpen(true);
    setPullPreviewLoading(true);
    setPullPreviewConfirming(false);
    setPullPreviewSourceId(sourceId);
    setPullPreviewData(null);
    try {
      const data =
        kind === 'purchase_receipt'
          ? await qualityApi.incomingInspection.previewPullFromPurchaseReceipt(String(sourceId))
          : await qualityApi.incomingInspection.previewPullFromCustomerMaterial(String(sourceId));
      setPullPreviewData(data as DocumentPushPreview);
    } catch (error: any) {
      messageApi.error(
        error?.message || t('app.kuaizhizao.purchaseReturn.pull.previewFailed'),
      );
      resetPullPreview();
    } finally {
      setPullPreviewLoading(false);
    }
  };

  const handlePullPreviewConfirm = async () => {
    if (!pullPreviewSourceId || !pullPreviewData || !pullPreviewKind) return;
    if (pullPreviewData.has_blocking_issues) return;
    setPullPreviewConfirming(true);
    try {
      if (pullPreviewKind === 'purchase_receipt') {
        await qualityApi.incomingInspection.createFromPurchaseReceipt(String(pullPreviewSourceId));
        messageApi.success(t('app.kuaizhizao.quality.incoming.messages.createSuccess'));
      } else {
        await qualityApi.incomingInspection.createFromCustomerMaterial(String(pullPreviewSourceId));
        messageApi.success(t('app.kuaizhizao.quality.incoming.messages.createFromCustomerMaterialSuccess'));
      }
      resetPullPreview();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.incoming.messages.createFailed'));
    } finally {
      setPullPreviewConfirming(false);
    }
  };

  const isPullIncomingInspectionSelectable = useCallback(
    (row: PullSourceCandidate) => row.capabilities?.pull_incoming_inspection?.allowed !== false,
    [],
  );

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromPurchaseReceiptQuery = useUniPullQuery<PullSourceCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await qualityApi.incomingInspection.listPurchaseReceiptPullCandidates({
          skip: 0,
          limit: 100,
          keyword: keyword.trim() || undefined,
        });
        const rows = (res.data || []) as PullSourceCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullIncomingInspectionSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch {
        messageApi.error(t('app.kuaizhizao.quality.incoming.messages.loadReceiptFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => !isPullIncomingInspectionSelectable(row),
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.incoming.form.selectReceipt'));
        return;
      }
      pullFromPurchaseReceiptCloseRef.current?.();
      await openPullPreview('purchase_receipt', selected.id);
    },
  });
  pullFromPurchaseReceiptCloseRef.current = pullFromPurchaseReceiptQuery.closeModal;

  const pullFromCustomerMaterialQuery = useUniPullQuery<PullSourceCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await qualityApi.incomingInspection.listCustomerMaterialPullCandidates({
          skip: 0,
          limit: 100,
          keyword: keyword.trim() || undefined,
        });
        const rows = (res.data || []) as PullSourceCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullIncomingInspectionSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch {
        messageApi.error(t('app.kuaizhizao.quality.incoming.messages.loadCustomerMaterialFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => !isPullIncomingInspectionSelectable(row),
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.incoming.form.selectCustomerMaterial'));
        return;
      }
      pullFromCustomerMaterialCloseRef.current?.();
      await openPullPreview('customer_material', selected.id);
    },
  });
  pullFromCustomerMaterialCloseRef.current = pullFromCustomerMaterialQuery.closeModal;
  useNewShortcut(pullFromPurchaseReceiptQuery.openModal);

  // 处理创建不合格品记录
  const handleCreateDefect = (record: IncomingInspection) => {
    setCurrentDefectInspection(record);
    setCreateDefectModalVisible(true);
    defectFormRef.current?.setFieldsValue({
      defect_quantity: record.unqualified_quantity || 0,
      defect_type: 'other',
      defect_reason: '',
      disposition: 'return', // 来料检验不合格默认退货
      remarks: '',
    });
  };

  // 处理创建不合格品记录提交
  const handleCreateDefectSubmit = async (values: any) => {
    try {
      if (currentDefectInspection?.id) {
        await qualityApi.incomingInspection.createDefect(currentDefectInspection.id.toString(), {
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
                    `/apps/kuaizhizao/quality-management/nonconforming-ledger?incoming_inspection_id=${currentDefectInspection?.id || ''}`,
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

  const resetPushPurchaseReturnPreview = () => {
    setPushPurchaseReturnPreviewOpen(false);
    setPushPurchaseReturnPreviewSourceId(null);
    setPushPurchaseReturnPreviewData(null);
  };

  const openPushPurchaseReturnPreview = async (record: IncomingInspection) => {
    if (!record.id) return;
    setPushPurchaseReturnPreviewOpen(true);
    setPushPurchaseReturnPreviewLoading(true);
    setPushPurchaseReturnPreviewConfirming(false);
    setPushPurchaseReturnPreviewSourceId(record.id);
    setPushPurchaseReturnPreviewData(null);
    try {
      const data = await qualityApi.incomingInspection.previewPushToPurchaseReturn(String(record.id));
      setPushPurchaseReturnPreviewData(data);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.pushPurchaseReturnFailed'));
      resetPushPurchaseReturnPreview();
    } finally {
      setPushPurchaseReturnPreviewLoading(false);
    }
  };

  const handlePushPurchaseReturnPreviewConfirm = async () => {
    if (!pushPurchaseReturnPreviewSourceId || !pushPurchaseReturnPreviewData) return;
    if (pushPurchaseReturnPreviewData.has_blocking_issues) return;
    setPushPurchaseReturnPreviewConfirming(true);
    try {
      const result = await qualityApi.incomingInspection.pushToPurchaseReturn(
        String(pushPurchaseReturnPreviewSourceId),
      );
      const returnCode = (result as { return_code?: string })?.return_code;
      messageApi.success(
        returnCode
          ? t('app.kuaizhizao.quality.common.messages.pushPurchaseReturnSuccess', { code: returnCode })
          : t('app.kuaizhizao.quality.common.messages.pushPurchaseReturnSuccess', { code: '-' }),
      );
      resetPushPurchaseReturnPreview();
      invalidateStats();
      actionRef.current?.reload();
      if (inspectionDetail?.id === pushPurchaseReturnPreviewSourceId) {
        const detail = await qualityApi.incomingInspection.get(String(pushPurchaseReturnPreviewSourceId));
        setInspectionDetail(detail as IncomingInspection);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.pushPurchaseReturnFailed'));
    } finally {
      setPushPurchaseReturnPreviewConfirming(false);
    }
  };

  const selectedIncomingForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return tableRowsRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const canPushPurchaseReturnToolbar = selectedIncomingForToolbar?.capabilities?.push_purchase_return?.allowed === true;

  const toolbarPushDisabledReason = useMemo(() => {
    const base = buildUniPushToolbarDisabledReason(t, {
      selectedCount: selectedRowKeys.length,
      hasSelectedRecord: !!selectedIncomingForToolbar,
    });
    if (base) return base;
    if (selectedIncomingForToolbar && !canPushPurchaseReturnToolbar) {
      return (
        qualityInspectionCapabilityReasonMessage(
          selectedIncomingForToolbar.capabilities?.push_purchase_return?.reason,
          t,
        ) || t('components.uniPush.disabled.unavailable')
      );
    }
    return undefined;
  }, [canPushPurchaseReturnToolbar, selectedIncomingForToolbar, selectedRowKeys.length, t]);

  const toolbarPushMenuItems = useMemo(
    () =>
      buildUniPushMenuItems([
        {
          key: 'push-purchase-return',
          label: pushToPurchaseReturnAction.label,
          disabled: !selectedIncomingForToolbar || !canPushPurchaseReturnToolbar,
          title: selectedIncomingForToolbar && !canPushPurchaseReturnToolbar
            ? qualityInspectionCapabilityReasonMessage(
                selectedIncomingForToolbar.capabilities?.push_purchase_return?.reason,
                t,
              )
            : undefined,
          onClick: () => {
            if (selectedIncomingForToolbar && canPushPurchaseReturnToolbar) {
              void openPushPurchaseReturnPreview(selectedIncomingForToolbar);
            }
          },
        },
      ]),
    [
      canPushPurchaseReturnToolbar,
      pushToPurchaseReturnAction.label,
      selectedIncomingForToolbar,
      t,
    ],
  );

  const detailBaseColumns: ProDescriptionsItemProps<IncomingInspection>[] = useMemo(
    () => [
      buildQualityInspectionDetailCodeColumn<IncomingInspection>(t),
      ...buildQualityInspectionDetailMaterialColumns<IncomingInspection>(t),
      {
        title: t('app.kuaizhizao.quality.common.columns.purchaseReceiptCode'),
        dataIndex: 'purchase_receipt_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.purchase_receipt_code ?? '') }}>{r.purchase_receipt_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.supplier'), dataIndex: 'supplier_name' },
      ...buildQualityInspectionDetailQuantityStatusColumns<IncomingInspection>(t),
      ...buildQualityInspectionDetailPeopleColumns<IncomingInspection>(t),
    ],
    [t]
  );

  const detailNotesColumn: ProDescriptionsItemProps<IncomingInspection> = useMemo(
    () => ({
      title: t('app.kuaizhizao.quality.common.columns.inspectionNotes'),
      dataIndex: 'notes',
      span: 2,
      render: (val) => val || '-',
    }),
    [t]
  );

  const inspectionCustomFieldColumns = generateInspectionCustomFieldColumns();

  const handleDeleteRow = useCallback(
    (record: IncomingInspection) => {
      if (record.id == null) return;
      Modal.confirm({
        title: t('app.kuaizhizao.quality.incoming.messages.deleteConfirm', { count: 1 }),
        onOk: async () => {
          await qualityApi.incomingInspection.delete(String(record.id));
          messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: 1 }));
          if (inspectionDetail?.id === record.id) {
            setDetailVisible(false);
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
    (record: IncomingInspection) => {
      if (record.id == null) return;
      Modal.confirm({
        title: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmTitle'),
        content: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmContent', {
          code: record.inspection_code || record.id,
        }),
        onOk: async () => {
          await qualityApi.incomingInspection.revokeConduct(String(record.id));
          messageApi.success(t('app.kuaizhizao.quality.common.messages.revokeConductSuccess'));
          if (inspectionDetail?.id === record.id) {
            setDetailVisible(false);
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
    Modal.confirm({
      title: t('app.kuaizhizao.quality.common.actions.revokeConductConfirmTitle'),
      content: t('app.kuaizhizao.quality.common.messages.revokeConductBatchConfirm', { count: targets.length }),
      onOk: async () => {
        try {
          for (const row of targets) {
            if (row.id == null) continue;
            await qualityApi.incomingInspection.revokeConduct(String(row.id));
          }
          messageApi.success(
            t('app.kuaizhizao.quality.common.messages.revokeConductBatchSuccess', { count: targets.length }),
          );
          setSelectedRowKeys([]);
          if (inspectionDetail?.id != null && targets.some((row) => row.id === inspectionDetail.id)) {
            setDetailVisible(false);
            setInspectionDetail(null);
          }
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
  }, [inspectionDetail?.id, messageApi, selectedRecordsForBatch, t]);

  const renderIncomingRowNodes = (record: IncomingInspection): React.ReactNode[] => {
    const gates = qualityInspectionRowGates(record, incomingPerms, ncPerms, t);
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
          entityType: 'incoming_inspection',
          resourcePrefix: INCOMING_RESOURCE,
          entityName: t('app.kuaizhizao.quality.common.entity.incomingInspection'),
          onSuccess: () => {
            actionRef.current?.reload();
            invalidateStats();
            if (inspectionDetail?.id === record.id) {
              qualityApi.incomingInspection
                .get(record.id!.toString())
                .then(async (d) => {
                  setInspectionDetail(d);
                  setIiTrackingRefreshKey((k) => k + 1);
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
  const columns: ProColumns<IncomingInspection>[] = useMemo(
    () => alignProColumns<IncomingInspection>([
    ...buildQualityInspectionListSearchColumns<IncomingInspection>(
      t,
      inspectionDocStatusValueEnum,
      inspectionQualityStatusValueEnum,
    ),
    buildQualityInspectionListCodeColumn<IncomingInspection>(t),
    stackedPrimarySecondaryColumn<IncomingInspection>(
      t('app.kuaizhizao.quality.common.columns.supplierReceipt'),
      'supplierReceipt',
      ['supplier_name', 'supplierName'],
      ['purchase_receipt_code', 'purchaseReceiptCode'],
      { dataIndex: 'supplier_name' },
    ),
    {
      title: t('app.kuaizhizao.quality.common.columns.purchaseReceiptCode'),
      dataIndex: 'purchase_receipt_code',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.supplier'),
      dataIndex: 'supplier_name',
      hideInTable: true,
      ellipsis: true,
    },
    buildQualityInspectionListMaterialColumn<IncomingInspection>(t),
    ...buildQualityInspectionListMaterialHiddenColumns<IncomingInspection>(t),
    buildInspectorTimeStackedColumn<IncomingInspection>(t('app.kuaizhizao.quality.common.columns.inspector')),
    ...buildQualityInspectionListQuantityResultColumns<IncomingInspection>(t, [
      {
        title: t('app.kuaizhizao.salesManagement.pushProgress.title'),
        key: 'downstream_push_progress',
        dataIndex: 'pushed_purchase_return_quantity',
        ...DOCUMENT_PROGRESS_COLUMN_DEFAULTS,
        render: (_, record) => {
          const percent = incomingInspectionReturnPushPercent(
            record.pushed_purchase_return_quantity,
            record.unqualified_quantity,
          );
          return (
            <DocumentPushProgressBar
              percent={percent}
              tooltip={t('app.kuaizhizao.salesManagement.pushProgress.percentOnly', {
                percent: Math.round(percent),
              })}
            />
          );
        },
      },
    ]),
    ...buildDocumentAuditColumns<IncomingInspection>(t),
    ...inspectionCustomFieldColumns,
    ...(incomingAuditColumn ? [incomingAuditColumn] : []),
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
      render: (_, record) => renderIncomingRowNodes(record),
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [t, incomingAuditColumn, inspectionCustomFieldColumns, inspectionDocStatusValueEnum, inspectionQualityStatusValueEnum],
  );

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
      <UniTable<IncomingInspection>
        headerTitle={t('app.kuaizhizao.quality.incoming.pageTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.incoming-inspection.rank-v3"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        pinnedTabsField={QUALITY_INSPECTION_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        request={async (params, sort, _filter, searchFormValues, meta?: UniTableRequestMeta) => {
          try {
            const listParams = resolveQualityInspectionListParams(searchFormValues, sort);
            const response = await qualityApi.incomingInspection.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              ...listParams,
              ...urlListFiltersRef.current,
            });
            const { data: raw, total } = normalizeQualityInspectionListResponse(response);
            const data = meta?.purpose === 'prefetch'
              ? raw as IncomingInspection[]
              : await enrichInspectionRecordsWithCustomFields(raw as IncomingInspection[]);
            return {
              data,
              success: true,
              total,
            };
          } catch (error) {
            messageApi.error(t('app.kuaizhizao.quality.incoming.messages.loadListFailed'));
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
        onCreate={pullFromPurchaseReceiptQuery.openModal}
        toolBarRender={() => [
          <Button key="from-cm" onClick={pullFromCustomerMaterialQuery.openModal}>
            {pullFromCustomerMaterialAction.label}
          </Button>,
          <UniPushToolbarButton
            key={`incoming-inspection-push-${selectedIncomingForToolbar?.id ?? 'none'}`}
            menuItems={toolbarPushMenuItems}
            disabled={selectedRowKeys.length !== 1 || !selectedIncomingForToolbar}
            disabledReason={toolbarPushDisabledReason}
          />,
        ]}
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={incomingInspectionImportTemplate.importHeaders}
        importExampleRow={incomingInspectionImportTemplate.importExampleRow}
        importColumnOptions={incomingInspectionImportTemplate.importColumnOptions}
        importFieldMap={incomingInspectionImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            const deletable = filterDeletableQualityInspectionRecords(selectedRecordsForBatch);
            if (!deletable.length) {
              messageApi.warning(t('app.kuaizhizao.quality.common.messages.deleteBatchEmpty'));
              return;
            }
            const ids = deletable.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
            for (const id of ids) {
              await qualityApi.incomingInspection.delete(String(id));
            }
            messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: ids.length }));
            setSelectedRowKeys([]);
            if (inspectionDetail?.id != null && ids.includes(inspectionDetail.id)) {
              setDetailVisible(false);
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
            key="incoming-inspection-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedRecordsForBatch}
            auditEnabled={incomingAuditEnabled}
            permGates={incomingPerms}
            handlers={incomingAuditBatchHandlers}
            onSuccess={() => {
              setSelectedRowKeys([]);
              invalidateStats();
              actionRef.current?.reload();
            }}
            toolBarButtonSize="middle"
          />,
        ]}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.incoming.messages.deleteConfirm', { count })}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.quality.common.modal.inspectTitle', { code: currentInspection?.inspection_code || '' })}
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
          } : {}
        }
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        formRef={formRef}
      >
        {currentInspection && (
          <Card title={t('app.kuaizhizao.quality.common.sections.inspectionInfo')} size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.materialCode')}：</strong>{currentInspection.material_code}
              </Col>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.materialName')}：</strong>{currentInspection.material_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={24}>
                <strong>{t('app.kuaizhizao.quality.common.label.inspectionQty')}：</strong>
                {formatQuantityWithUnit(
                  currentInspection.inspection_quantity,
                  currentInspection.material_unit,
                )}
              </Col>
            </Row>
          </Card>
        )}
        <InspectionTemplateConductFields
          inspection={currentInspection as Record<string, unknown>}
          photoCategory="incoming_inspection_attachments"
          stepPhotoRequired={false}
        />
        <InspectionConductQuantityFields
          materialId={currentInspection?.material_id}
          materialUnit={currentInspection?.material_unit}
          scenario="purchase"
          inspectionQuantity={Number(currentInspection?.inspection_quantity || 0)}
          t={t}
        />
        <ProFormTextArea
          name="nonconformance_reason"
          label={t('app.kuaizhizao.quality.common.form.nonconformanceReason')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.nonconformanceReason')}
          fieldProps={{ rows: 2 }}
          colProps={{ span: 24 }}
        />
        <CustomFieldsFormSection
          customFields={inspectionFormCustomFields}
          customFieldValues={inspectionFormCustomFieldValues}
          gridColumns={2}
        />
        <DocumentAttachmentsField category="incoming_inspection_attachments" />
        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.quality.common.form.notes')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.notes')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.quality.common.modal.detailTitle', { code: inspectionDetail?.inspection_code || '' })}
        open={detailVisible}
        zIndex={incomingInspectionDetailDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setInspectionDetail(null);
          resetInspectionDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        extra={
          inspectionDetail ? (
            <UniWorkflowActions
              {...rowActionKind('skip')}
              record={inspectionDetail}
              {...qualityInspectionUniAuditProps({
                entityType: 'incoming_inspection',
                resourcePrefix: INCOMING_RESOURCE,
                entityName: t('app.kuaizhizao.quality.common.entity.incomingInspection'),
                theme: 'default',
                onSuccess: () => {
                  actionRef.current?.reload();
                  invalidateStats();
                  if (inspectionDetail?.id) {
                    qualityApi.incomingInspection
                      .get(inspectionDetail.id.toString())
                      .then(async (d) => {
                        setInspectionDetail(d);
                        setIiTrackingRefreshKey((k) => k + 1);
                        await loadInspectionFieldValuesForDetail(inspectionDetail.id!);
                      })
                      .catch(() => {});
                  }
                },
              })}
            />
          ) : null
        }
        customContent={
          inspectionDetail ? (
            <>
              <InspectionDetailQualityActions
                inspection={inspectionDetail}
                inspectionType="incoming"
                onRegisterDefect={() => handleCreateDefect(inspectionDetail)}
                canRegisterDefect={
                  qualityInspectionRowGates(inspectionDetail, incomingPerms, ncPerms, t).createDefect.allowed &&
                  !qualityInspectionRowGates(inspectionDetail, incomingPerms, ncPerms, t).createDefect.disabled
                }
              />
              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.basicInfo')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(inspectionDetail, detailBaseColumns)}
                />
                {hasCustomFieldsDetailContent(inspectionListCustomFields, inspectionDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={inspectionListCustomFields}
                      customFieldValues={inspectionDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                {inspectionDetail.notes ? (
                  <Descriptions
                    column={3}
                    size="small"
                    style={{ marginTop: 16 }}
                    items={buildDescriptionItemsFromColumns(inspectionDetail, [detailNotesColumn])}
                  />
                ) : null}
              </DetailDrawerSection>

              <DetailDrawerSection
                title={t('app.kuaizhizao.quality.common.sections.lifecycle')}
                titleExtra={<DetailAuditPhaseTitleExtra record={inspectionDetail} />}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getIncomingInspectionLifecycle(inspectionDetail as Record<string, unknown>);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                    
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.detailInfo')}>
                <InspectionTemplateConductResultsTable inspection={inspectionDetail as Record<string, unknown>} />
              </DetailDrawerSection>

              {Array.isArray(inspectionDetail.attachments) && inspectionDetail.attachments.length > 0 ? (
                <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.attachments')}>
                  <QualityInspectionDetailAttachments attachments={inspectionDetail.attachments} />
                </DetailDrawerSection>
              ) : null}


              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.operationLog')}>
                {incomingTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {incomingTracking.error && !incomingTracking.loading && (
                  <Typography.Text type="danger">{incomingTracking.error}</Typography.Text>
                )}
                {incomingTracking.data && !incomingTracking.loading && (
                  <DocumentTrackingTimelineBody data={incomingTracking.data} />
                )}
                {!incomingTracking.loading && !incomingTracking.data && !incomingTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.quality.common.empty.noActivityLog')} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      
                        traceDocument={
                          inspectionDetail?.id != null
                            ? {
                                documentType: 'incoming_inspection',
                                documentId: inspectionDetail.id,
                                selfDocumentId: inspectionDetail.id,
                              renderBriefActions: (doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDetailVisible(false);
                      setInspectionDetail(null);
                    }}
                  />
                )
                              }
                            : undefined
                        }
      />

      <UniPullQueryModal<PullSourceCandidate>
        open={pullFromCustomerMaterialQuery.open}
        title={pullFromCustomerMaterialAction.label}
        onCancel={pullFromCustomerMaterialQuery.closeModal}
        onOk={pullFromCustomerMaterialQuery.handleConfirm}
        rowKey="id"
        columns={customerMaterialPullColumns}
        dataSource={pullFromCustomerMaterialQuery.dataSource}
        loading={pullFromCustomerMaterialQuery.loading}
        confirmLoading={pullFromCustomerMaterialQuery.confirmLoading}
        selectionType={pullFromCustomerMaterialQuery.selectionType}
        selectedRowKeys={pullFromCustomerMaterialQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromCustomerMaterialQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromCustomerMaterialQuery.isRowDisabled}
        searchDraft={pullFromCustomerMaterialQuery.searchDraft}
        onSearchDraftChange={pullFromCustomerMaterialQuery.setSearchDraft}
        onSearchApply={pullFromCustomerMaterialQuery.handleSearchApply}
        onSearchClear={pullFromCustomerMaterialQuery.handleSearchClear}
        appliedKeyword={pullFromCustomerMaterialQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromCustomerMaterialQuery.page}
        pageSize={pullFromCustomerMaterialQuery.pageSize}
        total={pullFromCustomerMaterialQuery.total}
        onPageChange={pullFromCustomerMaterialQuery.handlePageChange}
        scopeOptions={pullFromCustomerMaterialQuery.scopeOptions}
        scope={pullFromCustomerMaterialQuery.scope}
        onScopeChange={pullFromCustomerMaterialQuery.handleScopeChange}
      />

      <UniPullQueryModal<PullSourceCandidate>
        open={pullFromPurchaseReceiptQuery.open}
        title={pullFromPurchaseReceiptAction.label}
        onCancel={pullFromPurchaseReceiptQuery.closeModal}
        onOk={pullFromPurchaseReceiptQuery.handleConfirm}
        rowKey="id"
        columns={purchaseReceiptPullColumns}
        dataSource={pullFromPurchaseReceiptQuery.dataSource}
        loading={pullFromPurchaseReceiptQuery.loading}
        confirmLoading={pullFromPurchaseReceiptQuery.confirmLoading}
        selectionType={pullFromPurchaseReceiptQuery.selectionType}
        selectedRowKeys={pullFromPurchaseReceiptQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromPurchaseReceiptQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromPurchaseReceiptQuery.isRowDisabled}
        searchDraft={pullFromPurchaseReceiptQuery.searchDraft}
        onSearchDraftChange={pullFromPurchaseReceiptQuery.setSearchDraft}
        onSearchApply={pullFromPurchaseReceiptQuery.handleSearchApply}
        onSearchClear={pullFromPurchaseReceiptQuery.handleSearchClear}
        appliedKeyword={pullFromPurchaseReceiptQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromPurchaseReceiptQuery.page}
        pageSize={pullFromPurchaseReceiptQuery.pageSize}
        total={pullFromPurchaseReceiptQuery.total}
        onPageChange={pullFromPurchaseReceiptQuery.handlePageChange}
        scopeOptions={pullFromPurchaseReceiptQuery.scopeOptions}
        scope={pullFromPurchaseReceiptQuery.scope}
        onScopeChange={pullFromPurchaseReceiptQuery.handleScopeChange}
      />

      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pullPreviewOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreview}
        okText={
          pullPreviewKind === 'customer_material'
            ? pullFromCustomerMaterialAction.label
            : pullFromPurchaseReceiptAction.label
        }
        cancelText={t('common.cancel')}
        confirmLoading={pullPreviewConfirming}
        onOk={handlePullPreviewConfirm}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            !!pullPreviewData?.has_blocking_issues ||
            !(pullPreviewData?.items || []).some(
              (row) => Number(row.max_push_quantity ?? 0) > 0,
            ),
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
                message={qualityInspectionCapabilityReasonMessage(
                  pullPreviewData.blocking_reason,
                  t,
                )}
              />
            ) : null}
            {pullPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' , render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')} />
            )}
            {pullPreviewData.tip ? (
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: '#666' }}>
                {pullPreviewData.tip}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pushPurchaseReturnPreviewOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPushPurchaseReturnPreview}
        okText={pushToPurchaseReturnAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pushPurchaseReturnPreviewConfirming}
        onOk={handlePushPurchaseReturnPreviewConfirm}
        okButtonProps={{
          disabled:
            pushPurchaseReturnPreviewLoading ||
            !pushPurchaseReturnPreviewData ||
            !!pushPurchaseReturnPreviewData?.has_blocking_issues ||
            !(pushPurchaseReturnPreviewData?.items || []).some(
              (row) => Number(row.max_push_quantity ?? 0) > 0,
            ),
        }}
      >
        {pushPurchaseReturnPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Spin />
            <div style={{ color: 'var(--ant-color-primary)' }}>{t('app.kuaizhizao.salesOrder.loadingPreview')}</div>
          </div>
        ) : pushPurchaseReturnPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPurchaseReturnPreviewData.summary}</p>
            {pushPurchaseReturnPreviewData.has_blocking_issues && pushPurchaseReturnPreviewData.blocking_reason ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={qualityInspectionCapabilityReasonMessage(
                  pushPurchaseReturnPreviewData.blocking_reason,
                  t,
                )}
              />
            ) : null}
            {pushPurchaseReturnPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pushPurchaseReturnPreviewData.items}
                rowKey={(row) => String(row.item_id)}
                pagination={false}
                scroll={{ x: 960 }}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 130, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushedQty'), dataIndex: 'pushed_quantity', width: 90, align: 'right' , render: formatQuantity },
                  { title: t('app.kuaizhizao.salesOrder.colPushableQty'), dataIndex: 'max_push_quantity', width: 90, align: 'right' , render: formatQuantity },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.purchaseReturn.pull.previewNoLines')} />
            )}
            {pushPurchaseReturnPreviewData.tip ? (
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: '#666' }}>
                {pushPurchaseReturnPreviewData.tip}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

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
    </ListPageTemplate>
  );
};

export default IncomingInspectionPage;

