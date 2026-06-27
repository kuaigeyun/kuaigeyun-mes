/**
 * 成品检验页面
 *
 * 提供生产完工成品的最终检验功能
 *
 * @author RiverEdge Team
 * @date 2025-12-29
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import type { DescriptionsProps } from 'antd';
import { useNavigate } from 'react-router-dom';
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
  Descriptions,
  Typography,
  Spin,
  Empty,
  theme as AntdTheme,
} from 'antd';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import {
  MaterialStackedCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import {
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
import InspectionTemplateConductFields from '../components/InspectionTemplateConductFields';
import InspectionTemplateConductResultsTable from '../components/InspectionTemplateConductResultsTable';
import InspectionDetailQualityActions from '../components/InspectionDetailQualityActions';
import { pickInspectionConductExtras } from '../components/inspectionTemplateUtils';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import {
  fetchWorkOrdersForInspection,
  type InspectionDropdownOption,
} from '../components/inspectionCreateSourceUtils';
import { downloadFile } from '../../../services/common';
import { countWithPagedRequests } from '../../../../../utils/pagedCount';
import dayjs from 'dayjs';
import { formatDateTime, formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { useTranslation } from 'react-i18next';
import { buildFactoryImportTemplate } from '../../../../../utils/spreadsheetImportTemplate';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { qualityInspectionRowGates } from '../../../../../hooks/useDocumentCapabilities';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import KuaizhizaoDocumentPrintModal from '../../../components/KuaizhizaoDocumentPrintModal';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import {
  getQualityFinishedDisposalFallback,
  renderQualityResultTag,
  renderQualityDocStatusTag,
  renderQualityQualityStatusTag,
  getQualityDefectTypeOptions,
  qualityInspectionUniAuditProps,
} from '../components/qualityMeta';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const FINISHED_RESOURCE = 'kuaizhizao:quality-management-finished-goods-inspection';
const FINISHED_GOODS_INSPECTION_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_finished_goods_inspections';
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

function renderFinishedRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, { keyPrefix });
}

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
  const { t, i18n } = useTranslation();
  const pushToReworkAction = resolveKuaizhizaoDocumentAction(t, 'rework_order.pull_from_finished_goods_inspection');
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(t, 'finished_goods_inspection.pull_from_work_order');

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
          { field: 'remark', labelKey: 'app.kuaizhizao.quality.finished.import.notes', aliases: ['备注'] },
        ],
        [
          t('app.kuaizhizao.quality.finished.importExample.workOrderCode'),
          t('app.kuaizhizao.quality.finished.importExample.inspectionQty'),
          t('app.kuaizhizao.quality.finished.importExample.qualifiedQty'),
          t('app.kuaizhizao.quality.finished.importExample.unqualifiedQty'),
          '',
        ],
      ),
    [t, i18n.language],
  );
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const { token } = AntdTheme.useToken();
  const finishedGoodsInspectionDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
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
        setDisposalOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
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

  useEffect(() => {
    if (inspectionListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [inspectionListCustomFields.length]);

  // 详情Drawer状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [certificatePrintOpen, setCertificatePrintOpen] = useState(false);
  const [inspectionDetail, setInspectionDetail] = useState<FinishedGoodsInspection | null>(null);

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
  const handleDetail = async (record: FinishedGoodsInspection) => {
    try {
      const detail = await qualityApi.finishedGoodsInspection.get(record.id!.toString());
      setInspectionDetail(detail);
      setDetailDrawerVisible(true);
      setFgiTrackingRefreshKey((k) => k + 1);
      if (record.id != null) {
        await loadInspectionFieldValuesForDetail(record.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.quality.common.messages.loadDetailFailed'));
    }
  };

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
      const { standardValues, customData } = extractInspectionFormValues(values);
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

  // 处理批量导入（UniTable 内置）
  const handleImport = async (data: any[][]) => {
    try {
      const result = await qualityApi.finishedGoodsInspection.import(data) as any;
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
  const handleExport = async (type: 'selected' | 'currentPage' | 'all', selectedRowKeys?: React.Key[], currentPageData?: FinishedGoodsInspection[]) => {
    try {
      if (type === 'all') {
        const blob = await qualityApi.finishedGoodsInspection.export();
        const exportDate = new Date().toISOString().slice(0, 10);
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
        const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const exportDate = new Date().toISOString().slice(0, 10);
        a.download = `${t('app.kuaizhizao.quality.common.entity.finishedInspection')}_${exportDate}.json`;
        a.click();
        URL.revokeObjectURL(url);
        messageApi.success(t('common.exportCountSuccess', { count: toExport.length }));
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.exportFailed'));
    }
  };

  const pullFromWorkOrderQuery = useUniPullQuery<{ id: number; code: string }>({
    rowKey: 'id',
    selectionType: 'radio',
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const options = await fetchWorkOrdersForInspection();
        const kw = keyword.trim().toLowerCase();
        const rows = options
          .map((it) => ({ id: Number(it.value), code: String(it.label || '') }))
          .filter((it) => (kw ? it.code.toLowerCase().includes(kw) : true));
        const start = (page - 1) * pageSize;
        return { data: rows.slice(start, start + pageSize), total: rows.length };
      } catch {
        messageApi.error(t('app.kuaizhizao.quality.finished.messages.loadWorkOrderFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(t('app.kuaizhizao.quality.finished.form.selectWorkOrder'));
        return;
      }
      try {
        await qualityApi.finishedGoodsInspection.createFromWorkOrder(String(selected.id));
        messageApi.success(t('app.kuaizhizao.quality.finished.messages.createSuccess'));
        pullFromWorkOrderQuery.closeModal();
        invalidateStats();
        actionRef.current?.reload();
      } catch (error: any) {
        messageApi.error(error.message || t('app.kuaizhizao.quality.finished.messages.createFailed'));
      }
    },
  });
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

  const handlePushToRework = async (record: FinishedGoodsInspection) => {
    if (!record.id) return;
    try {
      const result = await qualityApi.finishedGoodsInspection.pushToRework(record.id.toString());
      const reworkCode = (result as any)?.rework_order_code;
      messageApi.success(
        reworkCode
          ? t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: reworkCode })
          : t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: '-' })
      );
      invalidateStats();
      actionRef.current?.reload();
      if (inspectionDetail?.id === record.id) {
        const detail = await qualityApi.finishedGoodsInspection.get(record.id.toString());
        setInspectionDetail(detail as FinishedGoodsInspection);
      }
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.pushReworkFailed'));
    }
  };

  const detailBaseColumns: ProDescriptionsItemProps<FinishedGoodsInspection>[] = useMemo(
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
      {
        title: t('app.kuaizhizao.quality.common.columns.salesOrderCode'),
        dataIndex: 'sales_order_code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.sales_order_code ?? '') }}>{r.sales_order_code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.quality.common.columns.customer'), dataIndex: 'customer_name', render: (val) => val || '-' },
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

  const detailNotesColumn: ProDescriptionsItemProps<FinishedGoodsInspection> = useMemo(
    () => ({
      title: t('app.kuaizhizao.quality.common.columns.inspectionNotes'),
      dataIndex: 'notes',
      span: 2,
      render: (val) => val || '-',
    }),
    [t]
  );

  const inspectionCustomFieldColumns = generateInspectionCustomFieldColumns();

  const renderFinishedRowNodes = (record: FinishedGoodsInspection): React.ReactNode[] => {
    const gates = qualityInspectionRowGates(record, finishedPerms, ncPerms, t);
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
    const canPushRework = record.quality_status === '不合格' && Number(record.unqualified_quantity || 0) > 0;
    if (canPushRework) {
      nodes.push(
        <Button
          {...rowActionKind('audit')}
          key="push-rework"
          size="small"
          type="link"
          onClick={(e) => {
            e.stopPropagation();
            void handlePushToRework(record);
          }}
        >
          {pushToReworkAction.label}
        </Button>
      );
    }
    return nodes;
  };

  // 表格列定义
  const columns: ProColumns<FinishedGoodsInspection>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
      dataIndex: 'inspection_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.inspection_code ?? '') }} ellipsis>
          {r.inspection_code ?? '-'}
        </Typography.Text>
      ),
    },
    stackedPrimarySecondaryColumn<FinishedGoodsInspection>(
      t('app.kuaizhizao.quality.common.columns.workOrderSalesOrder'),
      'workOrderSalesOrder',
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
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionQty'),
      dataIndex: 'inspection_quantity',
      width: 100,
      align: 'right',
      render: (text) => text || 0,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.qualifiedQty'),
      dataIndex: 'qualified_quantity',
      ...qualifiedQuantityColumnProps,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
      dataIndex: 'unqualified_quantity',
      ...unqualifiedQuantityColumnProps,
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionResult'),
      dataIndex: 'inspection_result',
      width: 100,
      render: (_, r) => renderQualityResultTag(t, r.inspection_result),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.qualityStatus'),
      dataIndex: 'quality_status',
      width: 100,
      render: (_, r) => renderQualityQualityStatusTag(t, r.quality_status),
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.inspectionTime'),
      dataIndex: 'inspection_time',
      width: 160,
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.quality.common.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    ...inspectionCustomFieldColumns,
    ...(finishedAuditColumn ? [finishedAuditColumn] : []),
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
        renderFinishedRowActions(renderFinishedRowNodes(record), `fg-${record.id ?? 'row'}`),
    },
  ],
    [t, finishedAuditColumn, inspectionCustomFieldColumns],
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
        columnPersistenceId="apps.kuaizhizao.pages.quality-management.finished-goods-inspection"
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={async (params: any) => {
          try {
            const filters = {
              status: params.status,
              quality_status: params.quality_status,
              work_order_id: params.work_order_id,
              keyword: params.keyword,
            };
            const [response, total] = await Promise.all([
              qualityApi.finishedGoodsInspection.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                ...filters,
              }),
              countWithPagedRequests(
                (p) => qualityApi.finishedGoodsInspection.list(p),
                filters,
                { chunkSize: 100 },
              ),
            ]);
            // 后端返回的是数组
            const raw = Array.isArray(response) ? response : (response.data || []);
            const data = await enrichInspectionRecordsWithCustomFields(raw);
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
        showCreateButton={true}
        createButtonText={createButtonLabel}
        onCreate={pullFromWorkOrderQuery.openModal}
        enableRowSelection={true}
        onRowSelectionChange={setSelectedRowKeys}
        onRow={(record) => ({
          onClick: () => void handleDetail(record),
          style: { cursor: 'pointer' },
        })}
        showImportButton={true}
        onImport={handleImport}
        importHeaders={finishedInspectionImportTemplate.importHeaders}
        importExampleRow={finishedInspectionImportTemplate.importExampleRow}
        importFieldMap={finishedInspectionImportTemplate.importHeaderMap}
        showExportButton={true}
        onExport={handleExport}
        showDeleteButton={true}
        onDelete={async (keys) => {
          try {
            const ids = keys.map(Number);
            for (const id of keys) {
              await qualityApi.finishedGoodsInspection.delete(String(id));
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
        deleteConfirmTitle={(count) => t('app.kuaizhizao.quality.finished.messages.deleteConfirm', { count })}
        scroll={{ x: 1900 }}
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
                <strong>{t('app.kuaizhizao.quality.common.label.materialCode')}：</strong>{currentInspection.material_code}
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 8 }}>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.materialName')}：</strong>{currentInspection.material_name}
              </Col>
              <Col span={12}>
                <strong>{t('app.kuaizhizao.quality.common.label.inspectionQty')}：</strong>{currentInspection.inspection_quantity}
              </Col>
            </Row>
          </Card>
        )}
        <InspectionTemplateConductFields
          inspection={currentInspection as Record<string, unknown>}
          photoCategory="finished_goods_inspection_attachments"
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
        <DocumentAttachmentsField category="finished_goods_inspection_attachments" />
        <ProFormTextArea
          name="notes"
          label={t('app.kuaizhizao.quality.common.form.notes')}
          placeholder={t('app.kuaizhizao.quality.common.placeholder.notes')}
          fieldProps={{ rows: 3 }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate>

      <UniPullQueryModal<{ id: number; code: string }>
        open={pullFromWorkOrderQuery.open}
        title={pullFromWorkOrderAction.label}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={pullFromWorkOrderQuery.handleConfirm}
        rowKey="id"
        columns={[{ title: t('app.kuaizhizao.quality.finished.form.selectWorkOrder'), dataIndex: 'code', ellipsis: true }]}
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
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromWorkOrderQuery.page}
        pageSize={pullFromWorkOrderQuery.pageSize}
        total={pullFromWorkOrderQuery.total}
        onPageChange={pullFromWorkOrderQuery.handlePageChange}
      />

      {/* 成品检验详情 Drawer */}
      <DetailDrawerTemplate
        title={t('app.kuaizhizao.quality.finished.modal.detailTitle', { code: inspectionDetail?.inspection_code || '' })}
        open={detailDrawerVisible}
        zIndex={finishedGoodsInspectionDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setInspectionDetail(null);
          resetInspectionDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        extra={
          inspectionDetail && (
            <Space>
              {canPrintCertificate &&
              inspectionDetail.certificate_issued &&
              inspectionDetail.quality_status === '合格' ? (
                <Button
                  size="small"
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
          )
        }
        customContent={
          inspectionDetail ? (
            <>
              <InspectionDetailQualityActions
                inspection={inspectionDetail}
                inspectionType="finished"
                onRegisterDefect={() => handleCreateDefect(inspectionDetail)}
                canRegisterDefect={
                  qualityInspectionRowGates(inspectionDetail, finishedPerms, ncPerms, t).createDefect.allowed &&
                  !qualityInspectionRowGates(inspectionDetail, finishedPerms, ncPerms, t).createDefect.disabled
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
                      documentType='finished_goods_inspection'
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
                {finishedTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {finishedTracking.error && !finishedTracking.loading && (
                  <Typography.Text type="danger">{finishedTracking.error}</Typography.Text>
                )}
                {finishedTracking.data && !finishedTracking.loading && (
                  <DocumentTrackingTimelineBody data={finishedTracking.data} />
                )}
                {!finishedTracking.loading && !finishedTracking.data && !finishedTracking.error && (
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
