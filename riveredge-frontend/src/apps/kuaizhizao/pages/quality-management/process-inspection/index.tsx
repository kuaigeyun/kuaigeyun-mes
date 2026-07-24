/**
 * 过程检验页面
 *
 * 提供生产报工环节关键工序的检验功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import type { DescriptionsProps } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProFormSelect,
  ProFormTextArea,
  ProFormDigit,
  ProFormItem,
  ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  App,
  Alert,
  Button,
  Modal,
  Space,
  Card,
  Row,
  Col,
  Descriptions,
  Typography,
  Spin,
  Empty,
  Table,
  theme as AntdTheme,
} from 'antd';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
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
  qualifiedQuantityColumnProps,
  stackedPrimarySecondaryColumn,
  unqualifiedQuantityColumnProps,
} from '../components/qualityTableColumns';
import { ListPageTemplate, FormModalTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { getIncomingInspectionLifecycle } from '../../../utils/incomingInspectionLifecycle';
import { createListAuditPhaseColumn } from '../../sales-management/shared/listAuditPhaseColumn';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../../../../services/api';
import { qualityApi } from '../../../services/production';
import type { DocumentPushPreview } from '../../../services/purchase-requisition';
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import InspectionTemplateConductResultsTable from '../components/InspectionTemplateConductResultsTable';
import InspectionDetailQualityActions from '../components/InspectionDetailQualityActions';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { downloadFile } from '../../../services/common';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildQualityInspectionDocStatusValueEnum,
  buildQualityInspectionQualityStatusValueEnum,
  normalizeQualityInspectionListResponse,
  QUALITY_INSPECTION_PINNED_STATUS_FIELD,
  resolveQualityInspectionListParams,
} from '../../../utils/qualityInspectionListCore';
import dayjs from 'dayjs';
import {formatDateTime, formatDateTimeBySiteSetting, formatQuantity} from '../../../../../utils/format';
import { useTranslation } from 'react-i18next';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import { pickImportExampleValue } from '../../../../../utils/loadImportDictionaryValues';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { UniAuditBatchMenuButton, createUniAuditBatchHandlers } from '../../../../../components/uni-batch';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { qualityInspectionCapabilityReasonMessage, qualityInspectionRowGates } from '../../../../../hooks/useDocumentCapabilities';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import {
  getQualityFinishedDisposalFallback,
  renderQualityResultTag,
  renderQualityDocStatusTag,
  renderQualityQualityStatusTag,
  getQualityDefectTypeOptions,
  qualityInspectionUniAuditProps,
} from '../components/qualityMeta';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { downloadRecordsAsXlsx } from '../../../../../utils/exportRecordsXlsx';

const PROCESS_RESOURCE = 'kuaizhizao:quality-management-process-inspection';
const PROCESS_INSPECTION_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_process_inspections';
const NC_RESOURCE = 'kuaizhizao:quality-management-nonconforming-ledger';

type ProcessPullWorkOrderCandidate = {
  id: number;
  code: string;
  capabilities?: { pull_process_inspection?: { allowed?: boolean; reason?: string } };
};

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

function renderProcessRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

// 过程检验接口定义
interface ProcessInspection {
  id?: number;
  tenant_id?: number;
  inspection_code?: string;
  work_order_id?: number;
  work_order_code?: string;
  operation_id?: number;
  operation_code?: string;
  operation_name?: string;
  workshop_id?: number;
  workshop_name?: string;
  workstation_id?: number;
  workstation_name?: string;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  batch_number?: string;
  inspection_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
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
  lifecycle?: { main_stages?: Array<unknown> };
  capabilities?: {
    conduct?: { allowed?: boolean; reason?: string };
    create_defect?: { allowed?: boolean; reason?: string };
  };
}

const ProcessInspectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'process_inspection.pull_from_work_order');

  const importDictOptions = useImportDictionaryOptions(['DISPOSAL_METHOD']);
  const disposalImportOptions = importDictOptions.DISPOSAL_METHOD ?? [];

  const processInspectionImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          {
            field: 'workOrderCode',
            labelKey: 'app.kuaizhizao.quality.process.import.workOrderCode',
            aliases: ['工单编号'],
          },
          {
            field: 'operationCode',
            labelKey: 'app.kuaizhizao.quality.process.import.operationCode',
            aliases: ['工序编号'],
          },
          { field: 'inspectionQty', labelKey: 'app.kuaizhizao.quality.process.import.inspectionQty', aliases: ['检验数量'] },
          { field: 'qualifiedQty', labelKey: 'app.kuaizhizao.quality.process.import.qualifiedQty', aliases: ['合格数量'] },
          { field: 'unqualifiedQty', labelKey: 'app.kuaizhizao.quality.process.import.unqualifiedQty', aliases: ['不合格数量'] },
          {
            field: 'disposition',
            labelKey: 'app.kuaizhizao.quality.common.form.disposition',
            aliases: ['处置方式', 'disposition'],
            options: disposalImportOptions,
          },
          { field: 'remark', labelKey: 'app.kuaizhizao.quality.process.import.notes', aliases: ['备注'] },
        ],
        [
          t('app.kuaizhizao.quality.process.importExample.workOrderCode'),
          t('app.kuaizhizao.quality.process.importExample.operationCode'),
          t('app.kuaizhizao.quality.process.importExample.inspectionQty'),
          t('app.kuaizhizao.quality.process.importExample.qualifiedQty'),
          t('app.kuaizhizao.quality.process.importExample.unqualifiedQty'),
          pickImportExampleValue(disposalImportOptions, 'rework'),
          '',
        ],
      ),
    [t, i18n.language, disposalImportOptions],
  );
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { token } = AntdTheme.useToken();
  const processInspectionDetailDrawerZIndex = token.zIndexPopupBase;
  const processPerms = useResourcePermissions(PROCESS_RESOURCE);
  const processAuditEnabled = useAuditRequired('process_inspection');
  const processAuditColumn = useMemo(
    () => createListAuditPhaseColumn<ProcessInspection>({ t, auditEnabled: processAuditEnabled }),
    [t, processAuditEnabled],
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
  const actionRef = useRef<ActionType>(null);
  const urlListFiltersRef = useRef<{ work_order_id?: number; operation_id?: number }>({});
  const deepLinkOpenedRef = useRef(false);
  const tableRowsRef = useRef<ProcessInspection[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const selectedRecordsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is ProcessInspection => row != null),
    [selectedRowKeys],
  );
  const processAuditBatchHandlers = useMemo(
    () => createUniAuditBatchHandlers('process_inspection', ['approve']),
    [],
  );
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(pullFromWorkOrderAction.label),
    [pullFromWorkOrderAction.label],
  );

  const invalidateStats = () => queryClient.invalidateQueries({ queryKey: ['process-inspection-statistics'] });
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
        setDisposalOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
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
  const [currentInspection, setCurrentInspection] = useState<ProcessInspection | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: inspectionFormCustomFields,
    customFieldValues: inspectionFormCustomFieldValues,
    extractFormValues: extractInspectionFormValues,
    saveCustomFieldValues: saveInspectionCustomFieldValues,
    loadFieldValues: loadInspectionFormFieldValues,
    resetFieldValues: resetInspectionFormFieldValues,
  } = useCustomFields({
    tableName: PROCESS_INSPECTION_CUSTOM_FIELD_TABLE,
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
  } = useCustomFieldsForList<ProcessInspection>({ tableName: PROCESS_INSPECTION_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (inspectionListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [inspectionListCustomFields.length]);

  // 详情Drawer状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<ProcessInspection | null>(null);

  const [piTrackingRefreshKey, setPiTrackingRefreshKey] = useState(0);

  const processTracking = useDocumentTracking(
    detailDrawerVisible && inspectionDetail?.id ? 'process_inspection' : undefined,
    inspectionDetail?.id,
    piTrackingRefreshKey,
  );

  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewConfirming, setPullPreviewConfirming] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<DocumentPushPreview | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullSelectedOperationId, setPullSelectedOperationId] = useState<number | undefined>(undefined);
  const pullFromWorkOrderCloseRef = useRef<(() => void) | null>(null);

  // 创建不合格品记录Modal状态
  const [createDefectModalVisible, setCreateDefectModalVisible] = useState(false);
  const [currentDefectInspection, setCurrentDefectInspection] = useState<ProcessInspection | null>(null);
  const defectFormRef = useRef<any>(null);

  // 统计数据（从接口获取）
  const { data: statsData } = useQuery({
    queryKey: ['process-inspection-statistics'],
    queryFn: () => qualityApi.processInspection.statistics(),
    staleTime: 0,
  });
  const stats = {
    pendingCount: statsData?.pending_count ?? 0,
    qualifiedCount: statsData?.qualified_count ?? 0,
    unqualifiedCount: statsData?.unqualified_count ?? 0,
    totalInspected: statsData?.total_count ?? 0,
  };

  // 处理详情查看
  const handleDetail = async (record: ProcessInspection) => {
    try {
      const detail = await qualityApi.processInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailDrawerVisible(true);
      setPiTrackingRefreshKey((k) => k + 1);
      if (record.id != null) {
        await loadInspectionFieldValuesForDetail(record.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.quality.common.messages.loadDetailFailed'));
    }
  };

  useEffect(() => {
    if (deepLinkOpenedRef.current) return;
    const idParam = searchParams.get('id');
    if (idParam && /^\d+$/.test(idParam)) {
      deepLinkOpenedRef.current = true;
      void handleDetail({ id: Number(idParam) } as ProcessInspection);
      return;
    }
    const woId = searchParams.get('work_order_id');
    const opId = searchParams.get('operation_id');
    if (woId && /^\d+$/.test(woId) && opId && /^\d+$/.test(opId)) {
      deepLinkOpenedRef.current = true;
      urlListFiltersRef.current = {
        work_order_id: Number(woId),
        operation_id: Number(opId),
      };
      actionRef.current?.reload();
    }
  }, [searchParams]);

  // 处理检验
  const handleInspect = async (record: ProcessInspection) => {
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
      const { standardValues, customData } = extractInspectionFormValues(values);
      if (currentInspection?.id) {
        await qualityApi.processInspection.conduct(currentInspection.id.toString(), {
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

      messageApi.success(t('app.kuaizhizao.quality.process.messages.inspectSuccess'));
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

  // 处理批量导入（UniTable 内置）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await qualityApi.processInspection.import(data) as any;
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
  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: ProcessInspection[]) => {
    try {
      if (type === 'all') {
        const blob = await qualityApi.processInspection.export();
        const exportDate = new Date().toISOString().slice(0, 10);
        const filename = `${t('app.kuaizhizao.quality.common.entity.processInspection')}_${exportDate}.xlsx`;
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
          `${t('app.kuaizhizao.quality.common.entity.processInspection')}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        );
        messageApi.success(t('common.exportCountSuccess', { count: toExport.length }));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.exportFailed'));
    }
  };

  const isPullProcessInspectionSelectable = useCallback(
    (row: ProcessPullWorkOrderCandidate) => row.capabilities?.pull_process_inspection?.allowed !== false,
    [],
  );

  const pullQueryScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const pullFromWorkOrderQuery = useUniPullQuery<ProcessPullWorkOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullQueryScopeOptions,
    defaultScope: 'pullable',
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const res = await qualityApi.processInspection.listWorkOrderPullCandidates({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
        });
        const rows = (res.data || []) as ProcessPullWorkOrderCandidate[];
        const filtered = filterByPullScope(rows, scope, isPullProcessInspectionSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch {
        messageApi.error(t('app.kuaizhizao.quality.process.messages.loadWorkOrderFailed'));
        return { data: [], total: 0 };
      }
    },
    isRowDisabled: (row) => !isPullProcessInspectionSelectable(row),
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.process.form.selectWorkOrder'));
        return;
      }
      pullFromWorkOrderCloseRef.current?.();
      setPullPreviewOpen(true);
      setPullPreviewLoading(true);
      setPullPreviewConfirming(false);
      setPullPreviewData(null);
      setPullPreviewSourceId(selected.id);
      setPullSelectedOperationId(undefined);
      try {
        const data = await qualityApi.processInspection.previewPullFromWorkOrder(String(selected.id));
        setPullPreviewData(data as DocumentPushPreview);
        const firstPushable = (data.items || []).find(
          (row) => Number(row.max_push_quantity ?? 0) > 0,
        );
        if (firstPushable) {
          setPullSelectedOperationId(Number(firstPushable.item_id));
        }
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.purchaseReturn.pull.previewFailed'));
        setPullPreviewOpen(false);
        setPullPreviewSourceId(null);
      } finally {
        setPullPreviewLoading(false);
      }
    },
  });
  pullFromWorkOrderCloseRef.current = pullFromWorkOrderQuery.closeModal;

  const resetPullPreview = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewData(null);
    setPullSelectedOperationId(undefined);
  };

  const handlePullPreviewConfirm = async () => {
    if (!pullPreviewSourceId || !pullPreviewData) return;
    if (pullPreviewData.has_blocking_issues) return;
    const row = (pullPreviewData.items || []).find(
      (item) => Number(item.item_id) === pullSelectedOperationId,
    );
    if (!row || Number(row.max_push_quantity ?? 0) <= 0) {
      messageApi.warning(t('app.kuaizhizao.quality.process.pull.selectOperationFirst'));
      return;
    }
    setPullPreviewConfirming(true);
    try {
      await qualityApi.processInspection.createFromWorkOrder(
        String(pullPreviewSourceId),
        String(pullSelectedOperationId),
      );
      messageApi.success(t('app.kuaizhizao.quality.process.messages.createSuccess'));
      resetPullPreview();
      invalidateStats();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.process.messages.createFailed'));
    } finally {
      setPullPreviewConfirming(false);
    }
  };
  useNewShortcut(pullFromWorkOrderQuery.openModal);

  // 处理创建不合格品记录
  const handleCreateDefect = (record: ProcessInspection) => {
    setCurrentDefectInspection(record);
    setCreateDefectModalVisible(true);
    defectFormRef.current?.setFieldsValue({
      defect_quantity: record.unqualified_quantity || 0,
      defect_type: 'other',
      defect_reason: '',
      disposition: 'rework', // 过程检验不合格默认返工
      remarks: '',
    });
  };

  // 处理创建不合格品记录提交
  const handleCreateDefectSubmit = async (values: any) => {
    try {
      if (currentDefectInspection?.id) {
        await qualityApi.processInspection.createDefect(currentDefectInspection.id.toString(), {
          defect_quantity: values.defect_quantity,
          defect_type: values.defect_type,
          defect_reason: values.defect_reason,
          disposition: values.disposition,
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
                    `/apps/kuaizhizao/quality-management/nonconforming-ledger?process_inspection_id=${currentDefectInspection?.id || ''}`,
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

  const detailBaseColumns: ProDescriptionsItemProps<ProcessInspection>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
        dataIndex: 'inspection_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }}>{r.inspection_code ?? '-'}</Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
        dataIndex: 'work_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.work_order_code ?? '') }}>{r.work_order_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.operationName'), dataIndex: 'operation_name' },
      { title: t('app.kuaizhizao.quality.common.columns.workshop'), dataIndex: 'workshop_name', render: (val) => val || '-' },
      { title: t('app.kuaizhizao.quality.common.columns.workstation'), dataIndex: 'workstation_name', render: (val) => val || '-' },
      {
        title: t('app.kuaizhizao.quality.common.columns.materialCode'),
        dataIndex: 'material_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.material_code ?? '') }}>{r.material_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name' },
      { title: t('app.kuaizhizao.quality.common.columns.materialSpec'), dataIndex: 'material_spec', render: (val) => val || '-' },
      { title: t('app.kuaizhizao.quality.common.columns.batchNo'), dataIndex: 'batch_number', render: (val) => val || '-' },
      { title: t('app.kuaizhizao.quality.common.columns.inspectionQty'), dataIndex: 'inspection_quantity', valueType: 'digit' },
      { title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'), dataIndex: 'qualified_quantity', valueType: 'digit' },
      { title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'), dataIndex: 'unqualified_quantity', valueType: 'digit' },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionStatus'),
        dataIndex: 'status',
        render: (_, r) => renderQualityDocStatusTag(t, r.status),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.qualityStatus'),
        dataIndex: 'quality_status',
        render: (_, r) => renderQualityQualityStatusTag(t, r.quality_status),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionResult'),
        dataIndex: 'inspection_result',
        render: (_, r) => renderQualityResultTag(t, r.inspection_result),
      },
      { title: t('app.kuaizhizao.quality.common.columns.inspector'), dataIndex: 'inspector_name' },
      { title: t('app.kuaizhizao.quality.common.columns.inspectionTime'), dataIndex: 'inspection_time', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.quality.common.columns.reviewer'), dataIndex: 'reviewer_name', render: (val) => val || '-' },
      { title: t('app.kuaizhizao.quality.common.columns.reviewTime'), dataIndex: 'review_time', valueType: 'dateTime', render: (val) => formatDateTimeBySiteSetting(val) },
    ],
    [t]
  );

  const detailNotesColumn: ProDescriptionsItemProps<ProcessInspection> = useMemo(
    () => ({
      title: t('app.kuaizhizao.quality.common.columns.inspectionNotes'),
      dataIndex: 'notes',
      span: 2,
      render: (val) => val || '-',
    }),
    [t]
  );

  const inspectionCustomFieldColumns = generateInspectionCustomFieldColumns();

  const renderProcessRowNodes = (record: ProcessInspection): React.ReactNode[] => {
    const gates = qualityInspectionRowGates(record, processPerms, ncPerms, t);
    if (gates.conduct.allowed) {
      return [
        <Button {...rowActionKind('execute')}
          key="inspect"
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
      ];
    }
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
    nodes.push(
      <UniWorkflowActions
        {...rowActionKind('skip')}
        key="wf"
        record={record}
        {...qualityInspectionUniAuditProps({
          entityType: 'process_inspection',
          resourcePrefix: PROCESS_RESOURCE,
          entityName: t('app.kuaizhizao.quality.common.entity.processInspection'),
          onSuccess: () => {
            actionRef.current?.reload();
            if (inspectionDetail?.id === record.id) {
              qualityApi.processInspection
                .get(record.id!.toString())
                .then(async (d) => {
                  setInspectionDetail(d);
                  setPiTrackingRefreshKey((k) => k + 1);
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
        <Button {...rowActionKind('create')}
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
    return nodes;
  };

  // 表格列定义
  const columns: ProColumns<ProcessInspection>[] = useMemo(
    () => alignProColumns<ProcessInspection>([
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
      width: 140,
      ellipsis: true,
      fixed: 'left',
      sorter: true,
      search: { order: 30 } as ProColumns['search'],
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }} ellipsis>
          {r.inspection_code ?? '-'}
        </Typography.Text>
      ),
    },
    stackedPrimarySecondaryColumn<ProcessInspection>(
      t('app.kuaizhizao.quality.common.columns.operationWorkOrder'),
      'operationWorkOrder',
      ['operation_name', 'operationName'],
      ['work_order_code', 'workOrderCode'],
      { dataIndex: 'operation_name' },
    ),
    {
      title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
      dataIndex: 'work_order_code',
      hideInTable: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.operationName'),
      dataIndex: 'operation_name',
      hideInTable: true,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.material'),
      key: 'material_name',
      dataIndex: 'material_name',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      render: (_, r) => (
        <MaterialStackedCell material_name={r.material_name} material_code={r.material_code} />
      ),
    },
    { title: t('app.kuaizhizao.quality.common.columns.materialCode'), dataIndex: 'material_code', hideInTable: true },
    { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'material_name', hideInTable: true },
    buildInspectorTimeStackedColumn<ProcessInspection>(t('app.kuaizhizao.quality.common.columns.inspector')),
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
      dataIndex: 'inspection_quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (text) => text || 0,
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
      title: t('app.kuaizhizao.quality.common.columns.inspectionResult'),
      dataIndex: 'inspection_result',
      width: 100,
      sorter: true,
      hideInSearch: true,
      render: (_, r) => renderQualityResultTag(t, r.inspection_result),
    },
    ...buildDocumentAuditColumns<ProcessInspection>(t),
    ...inspectionCustomFieldColumns,
    ...(processAuditColumn ? [processAuditColumn] : []),
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
      render: (_, record) =>
        renderProcessRowActions(renderProcessRowNodes(record), `proc-${record.id ?? 'row'}`),
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [t, processAuditColumn, inspectionCustomFieldColumns, inspectionDocStatusValueEnum, inspectionQualityStatusValueEnum],
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
      <UniTable<ProcessInspection>
        headerTitle={t('app.kuaizhizao.quality.process.pageTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.process-inspection.material-qty-v2"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        pinnedTabsField={QUALITY_INSPECTION_PINNED_STATUS_FIELD}
        skipFuzzyPinyinClientFilter
        request={async (params, sort, _filter, searchFormValues) => {
          try {
            const listParams = resolveQualityInspectionListParams(searchFormValues, sort);
            const response = await qualityApi.processInspection.list({
              skip: (params.current! - 1) * params.pageSize!,
              limit: params.pageSize,
              ...listParams,
              ...urlListFiltersRef.current,
            });
            const { data: raw, total } = normalizeQualityInspectionListResponse(response);
            const data = await enrichInspectionRecordsWithCustomFields(raw as ProcessInspection[]);
            tableRowsRef.current = data;
            return {
              data,
              success: true,
              total,
            };
          } catch (error) {
            messageApi.error(t('app.kuaizhizao.quality.process.messages.loadListFailed'));
            return {
              data: [],
              success: false,
              total: 0,
            };
          }
        }}
        showCreateButton={true}
        createButtonText={createButtonLabel}
        onCreate={pullFromWorkOrderQuery.openModal}
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={processInspectionImportTemplate.importHeaders}
        importExampleRow={processInspectionImportTemplate.importExampleRow}
        importColumnOptions={processInspectionImportTemplate.importColumnOptions}
        importFieldMap={processInspectionImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            const ids = keys.map(Number);
            for (const id of keys) {
              await qualityApi.processInspection.delete(String(id));
            }
            messageApi.success(t('app.kuaizhizao.quality.common.messages.deleteSuccess', { count: keys.length }));
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
          <UniAuditBatchMenuButton
            key="process-inspection-batch-menu"
            selectedRowKeys={selectedRowKeys}
            selectedRecords={selectedRecordsForBatch}
            auditEnabled={processAuditEnabled}
            permGates={processPerms}
            handlers={processAuditBatchHandlers}
            onSuccess={() => {
              setSelectedRowKeys([]);
              invalidateStats();
              actionRef.current?.reload();
            }}
            toolBarButtonSize="middle"
          />,
        ]}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.process.messages.deleteConfirm', { count })}
        scroll={{ x: 1800 }}
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.quality.process.modal.inspectTitle', { code: currentInspection?.inspection_code || '' })}
        open={inspectionModalVisible}
        onClose={() => {
          setInspectionModalVisible(false);
          resetInspectionFormFieldValues();
        }}
        onFinish={handleInspectionSubmit}
        isEdit={false}
        initialValues={{
          qualified_quantity: currentInspection?.inspection_quantity || 0,
          unqualified_quantity: 0,
          notes: '',
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
      >
        {currentInspection && (
          <Card title={t('app.kuaizhizao.quality.common.sections.inspectionInfo')} size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.workOrderCode')}：</strong>{currentInspection.work_order_code}
              </Col>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.operationName')}：</strong>{currentInspection.operation_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.materialCode')}：</strong>{currentInspection.material_code}
              </Col>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.materialName')}：</strong>{currentInspection.material_name}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={24}>
                <strong>{t('app.kuaizhizao.quality.common.label.inspectionQty')}：</strong>{currentInspection.inspection_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <InspectionTemplateConductFields
          inspection={currentInspection as Record<string, unknown>}
          photoCategory="process_inspection_attachments"
        />
        <ProFormDigit
          name="qualified_quantity"
          label={t('app.kuaizhizao.quality.common.form.qualifiedQty')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.qualifiedQty')}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredQualifiedQty') },
            { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
            ({ getFieldValue }: any) => ({
              validator(_: any, value: any) {
                if (!currentInspection) return Promise.resolve();
                const unqualifiedQuantity = getFieldValue('unqualified_quantity') || 0;
                if (value + unqualifiedQuantity > (currentInspection.inspection_quantity || 0)) {
                  return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
        />
        <ProFormDigit
          name="unqualified_quantity"
          label={t('app.kuaizhizao.quality.common.form.unqualifiedQty')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.unqualifiedQty')}
          colProps={{ span: 12 }}
          rules={[
            { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredUnqualifiedQty') },
            { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
            ({ getFieldValue }: any) => ({
              validator(_: any, value: any) {
                if (!currentInspection) return Promise.resolve();
                const qualifiedQuantity = getFieldValue('qualified_quantity') || 0;
                if (qualifiedQuantity + value > (currentInspection.inspection_quantity || 0)) {
                  return Promise.reject(t('app.kuaizhizao.quality.common.validation.qtySumExceeds'));
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
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
        <DocumentAttachmentsField category="process_inspection_attachments" />
        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.quality.common.form.notes')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.notes')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <UniPullQueryModal<ProcessPullWorkOrderCandidate>
        open={pullFromWorkOrderQuery.open}
        title={pullFromWorkOrderAction.label}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={pullFromWorkOrderQuery.handleConfirm}
        rowKey="id"
        columns={[{ title: t('app.kuaizhizao.quality.process.form.selectWorkOrder'), dataIndex: 'code', ellipsis: true }]}
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

      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreview}
        okText={pullFromWorkOrderAction.label}
        cancelText={t('common.cancel')}
        confirmLoading={pullPreviewConfirming}
        onOk={() => void handlePullPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            !!pullPreviewData?.has_blocking_issues ||
            !pullSelectedOperationId ||
            !(pullPreviewData?.items || []).some(
              (row) =>
                Number(row.item_id) === pullSelectedOperationId &&
                Number(row.max_push_quantity ?? 0) > 0,
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
                message={qualityInspectionCapabilityReasonMessage(pullPreviewData.blocking_reason, t)}
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
                  type: 'radio',
                  selectedRowKeys: pullSelectedOperationId ? [String(pullSelectedOperationId)] : [],
                  onChange: (keys) => setPullSelectedOperationId(keys[0] ? Number(keys[0]) : undefined),
                  getCheckboxProps: (row) => ({
                    disabled: Number(row.max_push_quantity ?? 0) <= 0,
                  }),
                }}
                columns={[
                  { title: t('app.kuaizhizao.quality.common.columns.operationCode'), dataIndex: 'operation_code', width: 120, ellipsis: true },
                  { title: t('app.kuaizhizao.quality.common.columns.operationName'), dataIndex: 'operation_name', width: 160, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', width: 90, align: 'right' , render: formatQuantity },
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

      {/* 过程检验详情 Drawer */}
      <DetailDrawerTemplate
        title={t('app.kuaizhizao.quality.process.modal.detailTitle', { code: inspectionDetail?.inspection_code || '' })}
        open={detailDrawerVisible}
        zIndex={processInspectionDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
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
                entityType: 'process_inspection',
                resourcePrefix: PROCESS_RESOURCE,
                entityName: t('app.kuaizhizao.quality.common.entity.processInspection'),
                theme: 'default',
                onSuccess: () => {
                  actionRef.current?.reload();
                  if (inspectionDetail?.id) {
                    qualityApi.processInspection
                      .get(inspectionDetail.id.toString())
                      .then(async (d) => {
                        setInspectionDetail(d);
                        setPiTrackingRefreshKey((k) => k + 1);
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
                inspectionType="process"
                onRegisterDefect={() => handleCreateDefect(inspectionDetail)}
                canRegisterDefect={
                  qualityInspectionRowGates(inspectionDetail, processPerms, ncPerms, t).createDefect.allowed &&
                  !qualityInspectionRowGates(inspectionDetail, processPerms, ncPerms, t).createDefect.disabled
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

              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.lifecycle')}>
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
                  {inspectionDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='process_inspection'
                      documentId={inspectionDetail.id}
                      active={detailDrawerVisible}
                      selfDocumentId={inspectionDetail.id}
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
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.detailInfo')}>
                <InspectionTemplateConductResultsTable inspection={inspectionDetail as Record<string, unknown>} />
              </DetailDrawerSection>

              <DetailDrawerSection title={t('app.kuaizhizao.quality.common.sections.operationLog')}>
                {processTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {processTracking.error && !processTracking.loading && (
                  <Typography.Text type="danger">{processTracking.error}</Typography.Text>
                )}
                {processTracking.data && !processTracking.loading && (
                  <DocumentTrackingTimelineBody data={processTracking.data} />
                )}
                {!processTracking.loading && !processTracking.data && !processTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.quality.common.empty.noActivityLog')} />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
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
                <strong>{t('app.kuaizhizao.quality.common.label.unqualifiedQty')}：</strong>{currentDefectInspection.unqualified_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <ProFormDigit
          name="defect_quantity"
          label={t('app.kuaizhizao.quality.common.form.defectQty')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.defectQty')}
          rules={[
            { required: true, message: t('app.kuaizhizao.quality.common.validation.requiredDefectQty') },
            { type: 'number', min: 0, message: t('app.kuaizhizao.quality.common.validation.minZero') },
            () => ({
              validator(_: any, value: any) {
                if (!currentDefectInspection) return Promise.resolve();
                if (value > (currentDefectInspection.unqualified_quantity || 0)) {
                  return Promise.reject(t('app.kuaizhizao.quality.common.validation.defectQtyExceeds'));
                }
                return Promise.resolve();
              },
            }),
          ]}
          fieldProps={{ precision: 2 }}
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

export default ProcessInspectionPage;
