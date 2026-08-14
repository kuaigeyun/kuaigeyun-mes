/**
 * 返工单管理页面
 *
 * 提供返工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持从原工单创建返工单。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormItem, ProFormDependency } from '@ant-design/pro-components';
import { App, Alert, Button, Card, Col, Descriptions, Empty, InputNumber, Modal, Row, Spin, Table, Typography, message } from 'antd';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { EditOutlined, DeleteOutlined, FormOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_BADGE_DATETIME_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniPullLoadButton } from '../../../../../components/uni-pull';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import {
  UniPullQueryModal,
  filterByPullScope,
  paginatePullRows,
  useUniPullQuery,
} from '../../../../../components/uni-pull-query';
import { DetailDrawerActions, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, detailDrawerDescriptionItems } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { qualityApi, reworkOrderApi, workOrderApi } from '../../../services/production';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import type { PushPreviewResponse } from '../../../services/sales-order';
import { getReworkOrderLifecycle, buildReworkOrderLifecycleValueEnum, resolveReworkOrderListLifecycleParams, reworkCapabilityAllowed } from '../../../utils/reworkOrderLifecycle';
import { resolveReworkTypeDisplay } from '../../../utils/reworkOrderType';
import {formatDateTime, formatDateTimeBySiteSetting, formatQuantity} from '../../../../../utils/format';
import { extractProTableSort } from '../../../../../utils/tableQueryKey';
import {
  formDateFormItemProps,
  formDateRangeFormItemProps,
  toApiDateTimeString,
} from '../../../../../utils/formDate';
import { alignProColumns, alignDescriptionColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import type { AuditPhaseRecord } from '../../../../../components/uni-audit/AuditPhaseBadge';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import ReworkOrderCreateModal from '../../../components/ReworkOrderCreateModal';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useTranslation } from 'react-i18next';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { getAntdModal } from '../../../../../utils/antdAppApis';
const REWORK_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_rework_orders';

interface ReworkOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  original_work_order_id?: number;
  original_work_order_uuid?: string;
  original_work_order_code?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  rework_reason?: string;
  rework_type?: string;
  status?: string;
  routing_mode?: string;
  verification_required?: boolean;
  source_inspection_id?: number;
  verification_inspection_id?: number;
  verification_inspection_type?: 'process_inspection' | 'finished_goods_inspection' | string;
  capabilities?: Record<string, { allowed?: boolean; reason?: string }>;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  workshop_id?: number;
  workshop_name?: string;
  work_center_id?: number;
  work_center_name?: string;
  completed_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  created_at?: string;
  updated_at?: string;
  start_work_order_operation_id?: number;
  rework_operations?: Array<{
    id?: number;
    work_order_operation_id: number;
    operation_name?: string;
    operation_code?: string;
    role?: string;
    status?: string;
    input_quantity?: number;
    qualified_quantity?: number;
    unqualified_quantity?: number;
    is_start?: boolean;
    is_current?: boolean;
    decision_reason?: string;
    decided_by_name?: string;
  }>;
}

type PullFinishedGoodsInspectionCandidate = {
  id: number;
  inspection_code?: string;
  work_order_code?: string;
  material_name?: string;
  customer_name?: string;
  inspection_time?: string;
  quality_status?: string;
  status?: string;
  unqualified_quantity?: number;
  capabilities?: {
    push_rework?: { allowed?: boolean; reason?: string };
  };
};

type PullReworkWorkOrderCandidate = {
  id: number;
  code?: string;
  name?: string;
  product_name?: string;
  quantity?: number;
  status?: string;
};

const REWORK_TYPE_FALLBACK = (translate: (key: string) => string) => [
  { label: translate('app.kuaizhizao.reworkOrder.typeRework'), value: '返工' },
  { label: translate('app.kuaizhizao.reworkOrder.typeRepair'), value: '返修' },
  { label: translate('app.kuaizhizao.reworkOrder.typeScrap'), value: '报废' },
];


const ReworkOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const pullFromFinishedGoodsInspectionAction = resolveKuaizhizaoDocumentAction(
    t,
    'rework_order.pull_from_finished_goods_inspection',
  );
  const pullFromWorkOrderAction = resolveKuaizhizaoDocumentAction(
    t,
    'rework_order.pull_from_work_order',
  );
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const currentUser = useCurrentUser();

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [reworkTypeOptions, setReworkTypeOptions] = useState<Array<{ label: string; value: string }>>(() => REWORK_TYPE_FALLBACK(t));
  const [reworkTypeLoading, setReworkTypeLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setReworkTypeLoading(true);
      try {
        // REWORK_TYPE 在部分租户未预置时，按 code 直查会返回 404；
        // 先走列表查询，无匹配即静默回退默认项，避免控制台噪音。
        const dictList = await getDataDictionaryList({ code: 'REWORK_TYPE', page: 1, page_size: 1 });
        const dict = dictList.items?.[0];
        if (!dict) {
          setReworkTypeOptions(REWORK_TYPE_FALLBACK(t));
          return;
        }
        const items = await getDictionaryItemList(dict.uuid, true);
        setReworkTypeOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setReworkTypeOptions(REWORK_TYPE_FALLBACK(t));
      } finally {
        setReworkTypeLoading(false);
      }
    };
    load();
  }, []);

  // Modal 相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentReworkOrder, setCurrentReworkOrder] = useState<ReworkOrder | null>(null);
  const formRef = useRef<any>(null);
  /** 选择原工单后，产品仅限该工单的产品 */
  const [workOrderProduct, setWorkOrderProduct] = useState<{ id: number; code: string; name: string } | null>(null);
  const [workOrderProductLoading, setWorkOrderProductLoading] = useState(false);

  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [reworkOrderDetail, setReworkOrderDetail] = useState<ReworkOrder | null>(null);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportSubmitLoading, setReportSubmitLoading] = useState(false);
  const [currentReworkOrderForReport, setCurrentReworkOrderForReport] = useState<ReworkOrder | null>(null);
  const [reportingOptions, setReportingOptions] = useState<any>(null);
  const reportFormRef = useRef<any>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [pullPreviewOpen, setPullPreviewOpen] = useState(false);
  const [pullPreviewLoading, setPullPreviewLoading] = useState(false);
  const [pullPreviewConfirming, setPullPreviewConfirming] = useState(false);
  const [pullPreviewData, setPullPreviewData] = useState<PushPreviewResponse | null>(null);
  const [pullPreviewSourceId, setPullPreviewSourceId] = useState<number | null>(null);
  const [pullPreviewQuantity, setPullPreviewQuantity] = useState<number>(0);
  const [createFromWorkOrderVisible, setCreateFromWorkOrderVisible] = useState(false);
  const [createFromWorkOrderLoading, setCreateFromWorkOrderLoading] = useState(false);
  const [createFromWorkOrderSubmitLoading, setCreateFromWorkOrderSubmitLoading] = useState(false);
  const [pullWorkOrderDetail, setPullWorkOrderDetail] = useState<Record<string, any> | null>(null);
  const [pullWorkOrderOperations, setPullWorkOrderOperations] = useState<Array<Record<string, any>>>([]);
  const [pullWorkOrderReworkableQty, setPullWorkOrderReworkableQty] = useState(0);
  const [pullWorkOrderDefaultStartOpId, setPullWorkOrderDefaultStartOpId] = useState<number | undefined>();

  const {
    customFields: reworkFormCustomFields,
    customFieldValues: reworkFormCustomFieldValues,
    loadFieldValues: loadReworkFormFieldValues,
    extractFormValues: extractReworkFormValues,
    saveCustomFieldValues: saveReworkCustomFieldValues,
    resetFieldValues: resetReworkFormFieldValues,
  } = useCustomFields({ tableName: REWORK_ORDER_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: reworkListCustomFields,
    generateCustomFieldColumns: generateReworkCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichReworkRecordsWithCustomFields,
    customFieldValues: reworkDetailCustomFieldValues,
    loadFieldValuesForDetail: loadReworkFieldValuesForDetail,
    resetDetailFieldValues: resetReworkDetailFieldValues,
  } = useCustomFieldsForList<ReworkOrder>({ tableName: REWORK_ORDER_CUSTOM_FIELD_TABLE });
  /**
   * 详情抽屉基本信息列
   */
  const detailBasicColumns: ProDescriptionsItemProps<ReworkOrder>[] = useMemo(() =>
    alignDescriptionColumns([
    {
      title: t('app.kuaizhizao.reworkOrder.colCode'),
      dataIndex: 'code',
      key: 'rework_code',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colOriginalWorkOrderId'),
      dataIndex: 'original_work_order_code',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colProductCode'),
      dataIndex: 'product_code',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colProductName'),
      dataIndex: 'product_name',
      span: 2,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colQuantity'),
      dataIndex: 'quantity',
      render: (_, record) => formatQuantity(record.quantity),
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colReworkType'),
      dataIndex: 'rework_type',
      render: (_, record) => {
        const { label, color } = resolveReworkTypeDisplay(t, record.rework_type);
        return <MarkerTag color={color}>{label}</MarkerTag>;
      },
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colStartOperation'),
      dataIndex: 'rework_operations',
      span: 2,
      render: (_: any, record: any) => {
        const startOp = (record.rework_operations || []).find((o: any) => o.is_start)
          || (record.rework_operations || [])[0];
        if (!startOp) return '-';
        return `${startOp.operation_code || ''} ${startOp.operation_name || ''}`.trim() || t('app.kuaizhizao.reworkOrder.operationFallback', { id: startOp.work_order_operation_id });
      },
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colWorkshop'),
      dataIndex: 'workshop_name',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colWorkCenter'),
      dataIndex: 'work_center_name',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colPlannedStart'),
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colPlannedEnd'),
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colActualStart'),
      dataIndex: 'actual_start_date',
      valueType: 'dateTime',
      render: (text) => formatDateTimeBySiteSetting(text),
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colActualEnd'),
      dataIndex: 'actual_end_date',
      valueType: 'dateTime',
      render: (text) => formatDateTimeBySiteSetting(text),
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colCompletedQty'),
      dataIndex: 'completed_quantity',
      render: (text) => text || 0,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colQualifiedQty'),
      dataIndex: 'qualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colUnqualifiedQty'),
      dataIndex: 'unqualified_quantity',
      render: (text) => text || 0,
    },
    {
      title: t('app.kuaizhizao.workReporting.colRemarks'),
      dataIndex: 'remarks',
      span: 2,
      render: (text) => text || '-',
    },
  ] as ProDescriptionsItemProps<ReworkOrder>[]), [t]);

  const detailCollaboration = useMemo(() => {
    if (!reworkOrderDetail) return undefined;
    const lifecycle = getReworkOrderLifecycle(reworkOrderDetail);
    const mainStages = lifecycle.mainStages ?? [];
    if (!mainStages.length) return undefined;
    const nextSteps = lifecycle.nextStepSuggestions;
    const hideNext = Boolean(nextSteps?.length);
    return {
      stepper: (
        <UniLifecycleStepper
          steps={mainStages}
          status={lifecycle.status}
          showLabels
          nextStepSuggestions={nextSteps}
          hideNextStepSuggestions={hideNext}
        />
      ),
      nextSteps,
    };
  }, [reworkOrderDetail]);

  const reworkOrderTraceDocument = useMemo(() => {
    if (reworkOrderDetail?.id == null) return null;
    return {
      documentType: 'rework_order',
      documentId: reworkOrderDetail.id,
      selfDocumentId: reworkOrderDetail.id,
      renderBriefActions: (doc: Parameters<typeof WarehouseTraceBriefPrimaryActions>[0]['doc']) => (
        <WarehouseTraceBriefPrimaryActions
          doc={doc}
          t={t}
          navigate={navigate}
          closeDrawer={() => {
            setDetailDrawerVisible(false);
            resetReworkDetailFieldValues();
          }}
        />
      ),
    };
  }, [navigate, reworkOrderDetail?.id, t]);

  const reworkOrderTracking = useDocumentTracking(
    detailDrawerVisible && reworkOrderDetail?.id ? 'rework_order' : undefined,
    reworkOrderDetail?.id,
  );

  /**
   * 表格列定义
   */
  const reworkOrderLifecycleValueEnum = useMemo(() => buildReworkOrderLifecycleValueEnum(t), [t]);

  const columns: ProColumns<ReworkOrder>[] = useMemo(() => {
    const customFieldColumns = generateReworkCustomFieldColumns();
    const reworkTypeValueEnum = Object.fromEntries(
      reworkTypeOptions.map((opt) => [opt.value, { text: opt.label }]),
    );
    return alignProColumns<ReworkOrder>([
    {
      title: t('app.kuaizhizao.reworkOrder.colPlannedStart'),
      dataIndex: 'planned_start_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      fieldProps: {
        placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
      },
      formItemProps: formDateRangeFormItemProps,
    },
    {
      title: `${t('app.kuaizhizao.reworkOrder.colProductName')} / ${t('app.kuaizhizao.reworkOrder.colCode')}`,
      key: 'product_name_code_stacked',
      dataIndex: 'code',
      width: 220,
      fixed: 'left',
      ellipsis: true,
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={String(record.product_name ?? '-')}
          secondary={String(record.code ?? '-')}
        />
      ),
    },
    {
      title: `${t('app.kuaizhizao.reworkOrder.colPlannedStart')} / ${t('app.kuaizhizao.reworkOrder.colPlannedEnd')}`,
      key: 'planned_start_end_stacked',
      dataIndex: 'planned_start_date',
      ...UNI_TABLE_STACKED_BADGE_DATETIME_COLUMN_DEFAULTS,
      sorter: true,
      hideInSearch: true,
      render: (_, record) => (
        <UniTableStackedPrimaryCell
          primary={record.planned_start_date ? formatDateTimeBySiteSetting(record.planned_start_date) : '-'}
          secondary={record.planned_end_date ? formatDateTimeBySiteSetting(record.planned_end_date) : '-'}
          secondaryCopyable={false}
          uniformText
          primaryBadge={t('common.start')}
          secondaryBadge={t('common.end')}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colCode'),
      dataIndex: 'code',
      hideInTable: true,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colOriginalWorkOrderId'),
      dataIndex: 'original_work_order_code',
      width: 180,
      uniTableKeepWidth: true,
      ellipsis: false,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colProductName'),
      dataIndex: 'product_name',
      hideInTable: true,
      hideInSearch: false,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colQuantity'),
      dataIndex: 'quantity',
      width: 100,
      align: 'right',
      sorter: true,
      hideInSearch: true,
      render: (_, record) => formatQuantity(record.quantity),
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colReworkType'),
      dataIndex: 'rework_type',
      width: 100,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: reworkTypeValueEnum,
      render: (_, record) => {
        const { label, color } = resolveReworkTypeDisplay(t, record.rework_type);
        return <MarkerTag color={color}>{label}</MarkerTag>;
      },
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colLifecycle'),
      // 搜索仍绑 status；key 声明列身份，UniTable 据此给出与审核状态列一致的宽度与对齐
      key: 'lifecycle',
      dataIndex: 'status',
      fixed: 'right',
      hideInSearch: false,
      valueType: 'select',
      valueEnum: reworkOrderLifecycleValueEnum,
      render: (_, record) => {
        const lifecycle = getReworkOrderLifecycle(record);
        const activeStage = lifecycle.mainStages?.find((stage) => stage.status === 'active');
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={activeStage?.label ?? lifecycle.stageName ?? record.status ?? t('app.kuaizhizao.reworkOrder.lifecycleDraft')}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    ...buildDocumentAuditColumns<ReworkOrder>(t),
    ...customFieldColumns,
    {
      title: t('common.actions'),
      valueType: 'option',
      fixed: 'right',
      render: (_text, record) => [
        <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>
          {t('common.detail')}
        </Button>,
        reworkCapabilityAllowed(record, 'release') ? (
          <Button
            key="release"
            {...rowActionKind('release')}
            onClick={() => void handleReleaseRework(record)}
          >
            {t('app.kuaizhizao.reworkOrder.actionRelease')}
          </Button>
        ) : null,
        reworkCapabilityAllowed(record, 'execute') ? (
          <Button
            {...rowActionKind('execute')}
            key="report"
            icon={<FormOutlined />}
            onClick={() => void handleOpenReport(record)}
          >
            {t('app.kuaizhizao.reworkOrder.report')}
          </Button>
        ) : null,
        reworkCapabilityAllowed(record, 'advance_next') ? (
          <Button
            key="advance"
            {...rowActionKind('execute')}
            onClick={() => void handleAdvanceNext(record)}
          >
            {t('app.kuaizhizao.reworkOrder.actionAdvanceNext')}
          </Button>
        ) : null,
        reworkCapabilityAllowed(record, 'request_complete') ? (
          <Button
            key="complete"
            {...rowActionKind('complete')}
            onClick={() => void handleRequestComplete(record)}
          >
            {t('app.kuaizhizao.reworkOrder.actionRequestComplete')}
          </Button>
        ) : null,
        String(record.status || '') === 'pending_verification' &&
        record.verification_inspection_id ? (
          <Button
            key="go-verify"
            {...rowActionKind('execute')}
            onClick={() => {
              const kind =
                record.verification_inspection_type ||
                (record.source_inspection_id ? 'finished_goods_inspection' : 'process_inspection');
              if (kind === 'finished_goods_inspection') {
                navigate(
                  `/apps/kuaizhizao/quality-management/finished-goods-inspection?finished_goods_inspection_id=${record.verification_inspection_id}`,
                );
              } else {
                navigate(
                  `/apps/kuaizhizao/quality-management/process-inspection?process_inspection_id=${record.verification_inspection_id}`,
                );
              }
            }}
          >
            {t('app.kuaizhizao.reworkOrder.actionGoVerification')}
          </Button>
        ) : null,
        reworkCapabilityAllowed(record, 'quality_release') ? (
          <Button
            key="quality_release"
            {...rowActionKind('audit')}
            onClick={() => void handleQualityRelease(record)}
          >
            {t('app.kuaizhizao.reworkOrder.actionQualityRelease')}
          </Button>
        ) : null,
        reworkCapabilityAllowed(record, 'close') ? (
          <Button key="close" {...rowActionKind('close')} onClick={() => void handleCloseRework(record)}>
            {t('app.kuaizhizao.reworkOrder.actionClose')}
          </Button>
        ) : null,
        reworkCapabilityAllowed(record, 'update') ? (
          <Button
            key="edit"
            {...rowActionKind('update')}
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            {t('common.edit')}
          </Button>
        ) : null,
        reworkCapabilityAllowed(record, 'delete') ? (
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDelete(record)}>
            {t('common.delete')}
          </Button>
        ) : null,
      ],
    },
  ], SALES_DOC_LIST_FIELD_RANK);
  }, [reworkListCustomFields, generateReworkCustomFieldColumns, reworkOrderLifecycleValueEnum, reworkTypeOptions, t]);

  /**
   * 处理详情查看
   */
  const handleDetail = async (record: ReworkOrder) => {
    try {
      const detail = await reworkOrderApi.get(record.id!.toString());
      setReworkOrderDetail(detail);
      setDetailDrawerVisible(true);
      if (detail.id != null) {
        await loadReworkFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.reworkOrder.loadDetailFailed'));
    }
  };

  /**
   * 处理编辑
   */
  const handleEdit = async (record: ReworkOrder) => {
    try {
      const detail = await reworkOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentReworkOrder(detail);
      setModalVisible(true);
      setTimeout(() => {
        if (detail.original_work_order_id && detail.product_id) {
          setWorkOrderProduct({
            id: detail.product_id,
            code: detail.product_code || '',
            name: detail.product_name || '',
          });
        } else {
          setWorkOrderProduct(null);
        }
        formRef.current?.setFieldsValue({
          code: detail.code,
          original_work_order_id: detail.original_work_order_id,
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          quantity: detail.quantity,
          rework_reason: detail.rework_reason,
          rework_type: detail.rework_type,
          planned_start_date: detail.planned_start_date,
          planned_end_date: detail.planned_end_date,
          completed_quantity: detail.completed_quantity,
          qualified_quantity: detail.qualified_quantity,
          unqualified_quantity: detail.unqualified_quantity,
          start_work_order_operation_id:
            detail.start_work_order_operation_id
            ?? (detail.rework_operations || []).find((o: any) => o.is_start)?.work_order_operation_id
            ?? (detail.rework_operations || [])[0]?.work_order_operation_id,
          remarks: detail.remarks,
          attachments: mapAttachmentsToUploadList(detail.attachments),
        });
        if (detail.id != null) {
          loadReworkFormFieldValues(detail.id).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }
      }, 100);
    } catch (error) {
      messageApi.error(t('app.kuaizhizao.reworkOrder.loadDetailFailed'));
    }
  };

  const handleOpenReport = async (record: ReworkOrder) => {
    if (!record.id) return;
    try {
      const [detail, options] = await Promise.all([
        reworkOrderApi.get(record.id.toString()),
        reworkOrderApi.getReportingOptions(record.id.toString()),
      ]);
      setCurrentReworkOrderForReport(detail);
      setReportingOptions(options);
      setReportModalVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.reworkOrder.loadReportingOptionsFailed'));
    }
  };

  const reportFormInitialValues = useMemo(() => {
    if (!reportModalVisible || !reportingOptions) return undefined;
    const defaultOp = reportingOptions.operations?.find((op: any) => op.selectable);
    const remaining = Number(reportingOptions.remaining_input_quantity ?? reportingOptions.remaining_rework_quantity ?? 0);
    return {
      work_order_operation_id: defaultOp?.work_order_operation_id,
      reported_quantity: remaining > 0 ? remaining : undefined,
      qualified_quantity: remaining > 0 ? remaining : undefined,
      unqualified_quantity: 0,
      work_hours: 0,
      reported_at: dayjs(),
    };
  }, [reportModalVisible, reportingOptions]);

  const handleSubmitReport = async (values: any): Promise<void> => {
    if (!currentReworkOrderForReport?.id) {
      throw new Error(t('app.kuaizhizao.reworkOrder.notFound'));
    }
    setReportSubmitLoading(true);
    try {
      const workerId = currentUser?.id;
      const workerName =
        currentUser?.full_name || currentUser?.username || values.worker_name || t('app.kuaizhizao.reworkOrder.fallbackWorker');
      if (!workerId) {
        throw new Error(t('app.kuaizhizao.reworkOrder.cannotGetCurrentUser'));
      }
      await reworkOrderApi.report(currentReworkOrderForReport.id.toString(), {
        work_order_operation_id: values.work_order_operation_id,
        worker_id: workerId,
        worker_name: workerName,
        reported_quantity: Number(values.reported_quantity),
        qualified_quantity: Number(values.qualified_quantity),
        unqualified_quantity: Number(values.unqualified_quantity ?? 0),
        work_hours: Number(values.work_hours ?? 0),
        reported_at: toApiDateTimeString(values.reported_at) ?? toApiDateTimeString(dayjs()),
        remarks: values.remarks || undefined,
      });
      messageApi.success(t('app.kuaizhizao.reworkOrder.reportSuccess'));
      setReportModalVisible(false);
      setCurrentReworkOrderForReport(null);
      setReportingOptions(null);
      reportFormRef.current?.resetFields();
      actionRef.current?.reload();
      if (reworkOrderDetail?.id === currentReworkOrderForReport.id) {
        const refreshed = await reworkOrderApi.get(currentReworkOrderForReport.id.toString());
        setReworkOrderDetail(refreshed);
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.reworkOrder.reportFailed'));
      throw error;
    } finally {
      setReportSubmitLoading(false);
    }
  };

  const refreshReworkDetail = async (id: number) => {
    const refreshed = await reworkOrderApi.get(String(id));
    setReworkOrderDetail(refreshed);
    return refreshed;
  };

  const handleReleaseRework = async (record: ReworkOrder) => {
    if (!record.id) return;
    try {
      await reworkOrderApi.release(String(record.id));
      messageApi.success(t('app.kuaizhizao.reworkOrder.releaseSuccess'));
      actionRef.current?.reload();
      if (reworkOrderDetail?.id === record.id) await refreshReworkDetail(record.id);
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
    }
  };

  const handleQualityRelease = async (record: ReworkOrder) => {
    if (!record.id) return;
    try {
      await reworkOrderApi.qualityRelease(String(record.id), {});
      messageApi.success(t('app.kuaizhizao.reworkOrder.qualityReleaseSuccess'));
      actionRef.current?.reload();
      if (reworkOrderDetail?.id === record.id) await refreshReworkDetail(record.id);
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
    }
  };

  const handleRequestComplete = async (record: ReworkOrder) => {
    if (!record.id) return;
    try {
      await reworkOrderApi.requestComplete(String(record.id), {});
      messageApi.success(t('app.kuaizhizao.reworkOrder.requestCompleteSuccess'));
      actionRef.current?.reload();
      if (reworkOrderDetail?.id === record.id) await refreshReworkDetail(record.id);
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
    }
  };

  const handleCloseRework = async (record: ReworkOrder) => {
    if (!record.id) return;
    try {
      await reworkOrderApi.close(String(record.id), {});
      messageApi.success(t('app.kuaizhizao.reworkOrder.closeSuccess'));
      actionRef.current?.reload();
      if (reworkOrderDetail?.id === record.id) await refreshReworkDetail(record.id);
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
    }
  };

  const handleAdvanceNext = async (record: ReworkOrder) => {
    if (!record.id || !record.original_work_order_id) return;
    try {
      const ops = await workOrderApi.getOperations(String(record.original_work_order_id));
      const options = (ops || []).map((op: any) => ({
        label: `${op.operation_code || ''} ${op.operation_name || ''}`.trim(),
        value: op.id,
      }));
      let nextOpId = options[0]?.value as number | undefined;
      getAntdModal().confirm({
        title: t('app.kuaizhizao.reworkOrder.actionAdvanceNext'),
        content: (
          <UniDropdown
            style={{ width: '100%' }}
            placeholder={t('app.kuaizhizao.reworkOrder.formReportOperationRequired')}
            options={options}
            defaultValue={nextOpId}
            onChange={(v) => { nextOpId = Number(v); }}
          />
        ),
        onOk: async () => {
          if (!nextOpId) throw new Error(t('app.kuaizhizao.reworkOrder.formReportOperationRequired'));
          await reworkOrderApi.advanceNext(String(record.id), {
            next_work_order_operation_id: nextOpId,
          });
          messageApi.success(t('app.kuaizhizao.reworkOrder.advanceNextSuccess'));
          actionRef.current?.reload();
          if (reworkOrderDetail?.id === record.id) await refreshReworkDetail(record.id);
        },
      });
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
    }
  };

  /**
   * 处理删除
   */
  const handleDelete = async (record: ReworkOrder) => {
    getAntdModal().confirm({
      title: t('app.kuaizhizao.reworkOrder.confirmDeleteTitle'),
      content: t('app.kuaizhizao.reworkOrder.confirmDeleteContent', { code: record.code }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await reworkOrderApi.delete(record.id!.toString());
          messageApi.success(t('common.deleteSuccess'));
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.deleteFailed'));
        }
      },
    });
  };

  const resetPullPreviewModal = () => {
    setPullPreviewOpen(false);
    setPullPreviewSourceId(null);
    setPullPreviewData(null);
    setPullPreviewQuantity(0);
  };

  const openPullPreview = async (inspectionId: number) => {
    setPullPreviewOpen(true);
    setPullPreviewLoading(true);
    setPullPreviewConfirming(false);
    setPullPreviewSourceId(inspectionId);
    setPullPreviewData(null);
    setPullPreviewQuantity(0);
    try {
      const data = await qualityApi.finishedGoodsInspection.previewPushToRework(String(inspectionId));
      setPullPreviewData(data);
      const line = data.items?.[0];
      const defaultQty = Number(line?.max_push_quantity ?? 0);
      setPullPreviewQuantity(Number.isFinite(defaultQty) && defaultQty > 0 ? defaultQty : 0);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.pushReworkFailed'));
      resetPullPreviewModal();
    } finally {
      setPullPreviewLoading(false);
    }
  };

  const handlePullPreviewConfirm = async () => {
    if (!pullPreviewSourceId || !pullPreviewData || pullPreviewData.has_blocking_issues) return;
    const maxQty = Number(pullPreviewData.items?.[0]?.max_push_quantity ?? 0);
    const qty = Number(pullPreviewQuantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyInvalid', { code: pullPreviewData.items?.[0]?.material_code || pullPreviewSourceId }));
      return;
    }
    if (qty > maxQty) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.pushQtyExceedsRemaining', { code: pullPreviewData.items?.[0]?.material_code || pullPreviewSourceId }));
      return;
    }
    setPullPreviewConfirming(true);
    try {
      const result = await qualityApi.finishedGoodsInspection.pushToRework(String(pullPreviewSourceId), {
        quantity: qty,
      });
      const reworkCode = (result as { rework_order_code?: string })?.rework_order_code;
      messageApi.success(
        reworkCode
          ? t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: reworkCode })
          : t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: '-' }),
      );
      resetPullPreviewModal();
      pullFromFinishedGoodsQuery.closeModal();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.quality.common.messages.pushReworkFailed'));
    } finally {
      setPullPreviewConfirming(false);
    }
  };

  const createFromWorkOrderInitialValues = useMemo(
    () => ({
      rework_type: reworkTypeOptions[0]?.value,
      routing_mode: 'DYNAMIC',
      verification_required: false,
      start_work_order_operation_id: pullWorkOrderDefaultStartOpId,
      quantity: pullWorkOrderReworkableQty > 0 ? pullWorkOrderReworkableQty : undefined,
    }),
    [reworkTypeOptions, pullWorkOrderDetail?.id, pullWorkOrderDefaultStartOpId, pullWorkOrderReworkableQty],
  );

  const resetCreateFromWorkOrderModal = () => {
    setCreateFromWorkOrderVisible(false);
    setCreateFromWorkOrderLoading(false);
    setCreateFromWorkOrderSubmitLoading(false);
    setPullWorkOrderDetail(null);
    setPullWorkOrderOperations([]);
    setPullWorkOrderReworkableQty(0);
    setPullWorkOrderDefaultStartOpId(undefined);
  };

  const refreshPullWorkOrderReworkPreview = useCallback(
    async (workOrderId: number, startWorkOrderOperationId?: number) => {
      const preview = await reworkOrderApi.previewFromWorkOrder(String(workOrderId), {
        start_work_order_operation_id: startWorkOrderOperationId,
      });
      setPullWorkOrderReworkableQty(Number(preview.reworkable_quantity) || 0);
    },
    [],
  );

  const openCreateFromWorkOrderModal = async (workOrderId: number) => {
    setCreateFromWorkOrderVisible(true);
    setCreateFromWorkOrderLoading(true);
    setCreateFromWorkOrderSubmitLoading(false);
    setPullWorkOrderDetail(null);
    setPullWorkOrderOperations([]);
    try {
      const [detail, operationsRaw] = await Promise.all([
        workOrderApi.get(String(workOrderId)),
        workOrderApi.getOperations(String(workOrderId)),
      ]);
      const operations = Array.isArray(operationsRaw) ? operationsRaw : [];
      setPullWorkOrderDetail(detail as Record<string, any>);
      setPullWorkOrderOperations(operations as Array<Record<string, any>>);
      const defaultStartOp = operations.find(
        (op) => Number(op.unqualified_quantity ?? op.unqualifiedQuantity ?? 0) > 0,
      );
      const defaultStartOpId =
        defaultStartOp?.id != null ? Number(defaultStartOp.id) : undefined;
      setPullWorkOrderDefaultStartOpId(defaultStartOpId);
      await refreshPullWorkOrderReworkPreview(workOrderId, defaultStartOpId);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.reworkOrder.loadWorkOrderFailed'));
      resetCreateFromWorkOrderModal();
    } finally {
      setCreateFromWorkOrderLoading(false);
    }
  };

  const handleSubmitFromWorkOrder = async (values: Record<string, any>): Promise<void> => {
    if (!pullWorkOrderDetail?.id) {
      throw new Error(t('app.kuaizhizao.reworkOrder.notFound'));
    }
    setCreateFromWorkOrderSubmitLoading(true);
    try {
      const payload = {
        rework_reason: values.rework_reason,
        rework_type: values.rework_type,
        routing_mode: values.routing_mode || 'DYNAMIC',
        verification_required: Boolean(values.verification_required),
        quantity: values.quantity != null ? Number(values.quantity) : undefined,
        start_work_order_operation_id: values.start_work_order_operation_id || undefined,
        predefined_operation_ids: values.predefined_operation_ids || undefined,
        planned_start_date: toApiDateTimeString(values.planned_start_date),
        planned_end_date: toApiDateTimeString(values.planned_end_date),
        remarks: values.remarks || undefined,
      };
      const created = await reworkOrderApi.createFromWorkOrder(String(pullWorkOrderDetail.id), payload);
      messageApi.success(
        t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', {
          code: (created as { code?: string })?.code || '-',
        }),
      );
      resetCreateFromWorkOrderModal();
      pullFromWorkOrderQuery.closeModal();
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('common.operationFailed'));
      throw error;
    } finally {
      setCreateFromWorkOrderSubmitLoading(false);
    }
  };

  /**
   * 处理提交表单（创建/更新）
   */
  const handleSubmitForm = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractReworkFormValues(values);
      standardValues.attachments = normalizeDocumentAttachments(standardValues.attachments);
      if (isEdit && currentReworkOrder?.id) {
        await reworkOrderApi.update(currentReworkOrder.id.toString(), standardValues);
        messageApi.success(t('app.kuaizhizao.reworkOrder.updateSuccess'));
        await saveReworkCustomFieldValues(currentReworkOrder.id, customData);
      } else {
        messageApi.warning(pullFromFinishedGoodsInspectionAction.label);
        throw new Error('rework order create requires pull from finished goods inspection');
      }
      setModalVisible(false);
      resetReworkFormFieldValues();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.operationFailed'));
      throw error;
    }
  };

  /**
   * 处理表格请求
   */
  const handleRequest = async (
    params: any,
    sort: Record<string, 'ascend' | 'descend' | null>,
    _filter: Record<string, React.ReactText[] | null>,
    searchFormValues?: Record<string, unknown>,
    meta?: UniTableRequestMeta,
  ) => {
    try {
      const s = searchFormValues ?? {};
      const lifecycleParams = resolveReworkOrderListLifecycleParams(s);
      const { sortBy, sortOrder } = extractProTableSort(sort);
      const orderBy =
        sortBy && sortOrder ? (sortOrder === 'desc' ? `-${sortBy}` : sortBy) : undefined;
      const fuzzyKeyword = typeof s.keyword === 'string' ? s.keyword.trim() : '';

      const apiParams: Parameters<typeof reworkOrderApi.list>[0] = {
        skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
        limit: params.pageSize ?? 20,
        ...lifecycleParams,
        order_by: orderBy,
        rework_type: s.rework_type as string | undefined,
      };

      if (fuzzyKeyword) {
        apiParams.keyword = fuzzyKeyword;
      } else {
        if (s.code != null && String(s.code).trim()) {
          apiParams.code = String(s.code).trim();
        }
        if (s.product_name != null && String(s.product_name).trim()) {
          apiParams.product_name = String(s.product_name).trim();
        }
        if (s.original_work_order_code != null && String(s.original_work_order_code).trim()) {
          apiParams.original_work_order_code = String(s.original_work_order_code).trim();
        }
      }

      const plannedRange = s.planned_start_date_range as [unknown, unknown] | undefined;
      if (plannedRange && Array.isArray(plannedRange) && plannedRange[0]) {
        apiParams.planned_start_from = formatDateTime(plannedRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.planned_start_to = plannedRange[1]
          ? formatDateTime(plannedRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.planned_start_from;
      }

      const createdRange = s.created_at_range as [unknown, unknown] | undefined;
      if (createdRange && Array.isArray(createdRange) && createdRange[0]) {
        apiParams.created_start_date = formatDateTime(createdRange[0] as string | Date, 'YYYY-MM-DD');
        apiParams.created_end_date = createdRange[1]
          ? formatDateTime(createdRange[1] as string | Date, 'YYYY-MM-DD')
          : apiParams.created_start_date;
      }

      const response = await reworkOrderApi.list(apiParams);
      const list = response.data ?? [];
      const enriched = meta?.purpose === 'prefetch'
        ? list
        : await enrichReworkRecordsWithCustomFields(list);
      return {
        data: enriched,
        success: response.success,
        total: response.total ?? 0,
      };
    } catch (error: any) {
      messageApi.error(t('app.kuaizhizao.reworkOrder.listLoadFailed'));
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  /**
   * 处理删除（从选中行）
   */
  const handleDeleteFromSelection = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.reworkOrder.selectToDelete'));
      return;
    }
    try {
      for (const key of keys) {
        await reworkOrderApi.delete(key.toString());
      }
      messageApi.success(t('common.deleteSuccess'));
      invalidateMenuBadgeCounts();
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const pullFromFinishedGoodsColumns: ProColumns<PullFinishedGoodsInspectionCandidate>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionCode'),
        dataIndex: 'inspection_code',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
        dataIndex: 'work_order_code',
        width: 140,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.materialName'),
        dataIndex: 'material_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.customer'),
        dataIndex: 'customer_name',
        width: 160,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'),
        dataIndex: 'unqualified_quantity',
        width: 120,
        align: 'right',
        render: (v) => Number(v || 0),
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.qualityStatus'),
        dataIndex: 'quality_status',
        width: 120,
        align: 'center',
        render: (v) => v || '-',
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionStatus'),
        dataIndex: 'status',
        width: 120,
        align: 'center',
        render: (v) => v || '-',
      },
      {
        title: t('app.kuaizhizao.quality.common.columns.inspectionTime'),
        dataIndex: 'inspection_time',
        width: 170,
        render: (v) => formatDateTimeBySiteSetting(v),
      },
    ],
    [t],
  );

  const pullFromWorkOrderColumns: ProColumns<PullReworkWorkOrderCandidate>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
        dataIndex: 'code',
        width: 180,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workOrder.colName'),
        dataIndex: 'name',
        width: 200,
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.reworkOrder.colProductName'),
        dataIndex: 'product_name',
        ellipsis: true,
      },
      {
        title: t('app.kuaizhizao.workOrder.colQuantity'),
        dataIndex: 'quantity',
        width: 120,
        align: 'right',
        render: (v) => formatQuantity(v),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 120,
        align: 'center',
        render: (v) => v || '-',
      },
    ],
    [t],
  );

  const pullDocumentScopeOptions = useMemo(
    () => [
      { label: t('components.uniPullQuery.scopePullable'), value: 'pullable' },
      { label: t('components.uniPullQuery.scopeAll'), value: 'all' },
    ],
    [t],
  );

  const isPullFinishedGoodsInspectionSelectable = useCallback(
    (record: PullFinishedGoodsInspectionCandidate) =>
      record.capabilities?.push_rework?.allowed === true,
    [],
  );

  const isPullReworkWorkOrderSelectable = useCallback(
    (record: PullReworkWorkOrderCandidate) =>
      ['in_progress', 'completed'].includes(String(record.status ?? '')),
    [],
  );

  const pullFromFinishedGoodsQuery = useUniPullQuery<PullFinishedGoodsInspectionCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullFinishedGoodsInspectionSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const response = await qualityApi.finishedGoodsInspection.list({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
        });
        const list = Array.isArray(response)
          ? response
          : (response as { data?: unknown[]; items?: unknown[] })?.data
            ?? (response as { items?: unknown[] })?.items
            ?? [];
        const candidates = (Array.isArray(list) ? list : []) as PullFinishedGoodsInspectionCandidate[];
        const filtered = filterByPullScope(candidates, scope, isPullFinishedGoodsInspectionSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (error: any) {
        messageApi.error(
          error?.message || t('app.kuaizhizao.quality.common.messages.loadListFailed'),
        );
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys) => {
      const selectedId = Number(keys[0]);
      if (!selectedId) {
        messageApi.warning(
          t('app.kuaizhizao.shipmentNotice.selectSource', {
            source: pullFromFinishedGoodsInspectionAction.sourceLabel,
          }),
        );
        return;
      }
      // 先关掉选单弹窗，再打开预览，避免同标题双层 Modal
      pullFromFinishedGoodsQuery.closeModal();
      await openPullPreview(selectedId);
    },
  });
  const pullFromWorkOrderQuery = useUniPullQuery<PullReworkWorkOrderCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    scopeOptions: pullDocumentScopeOptions,
    defaultScope: 'pullable',
    isRowDisabled: (record) => !isPullReworkWorkOrderSelectable(record),
    loadData: async ({ keyword, page, pageSize, scope }) => {
      try {
        const response = await workOrderApi.list({
          skip: 0,
          limit: 200,
          keyword: keyword.trim() || undefined,
        });
        const list = Array.isArray(response)
          ? response
          : (response as { data?: unknown[]; items?: unknown[] })?.data
            ?? (response as { items?: unknown[] })?.items
            ?? [];
        const candidates = (Array.isArray(list) ? list : []) as PullReworkWorkOrderCandidate[];
        const filtered = filterByPullScope(candidates, scope, isPullReworkWorkOrderSelectable);
        return paginatePullRows(filtered, page, pageSize);
      } catch (error: any) {
        messageApi.error(error?.message || t('app.kuaizhizao.reworkOrder.listLoadFailed'));
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys) => {
      const selectedId = Number(keys[0]);
      if (!selectedId) {
        messageApi.warning(
          t('app.kuaizhizao.shipmentNotice.selectSource', {
            source: pullFromWorkOrderAction.sourceLabel,
          }),
        );
        return;
      }
      // 先关掉选单弹窗，再打开创建表单，避免同标题双层 Modal 叠在一起
      pullFromWorkOrderQuery.closeModal();
      await openCreateFromWorkOrderModal(selectedId);
    },
  });
  useNewShortcut(() => {
    pullFromFinishedGoodsQuery.openModal();
  });

  return (
    <ListPageTemplate>
      <UniTable<ReworkOrder>
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.rework-orders.v2"
        headerTitle={t('app.kuaizhizao.reworkOrder.title')}
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showCreateButton={false}
        showDeleteButton={true}
        onDelete={handleDeleteFromSelection}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.reworkOrder.deleteSelectedConfirm', { count })}
        showAdvancedSearch={true}
        skipFuzzyPinyinClientFilter
        pinnedTabsField="status"
        pinnedTabsValueEnum={reworkOrderLifecycleValueEnum}
        toolBarActionsAfterCreate={[
          <UniPullLoadButton
            key="rework-order-pull-from-inspection"
            compactKey="rework-order-pull-from-inspection"
            label={t('app.kuaizhizao.reworkOrder.createButton')}
            type="primary"
            variant="solid"
            icon={<PlusOutlined />}
            menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
              {
                actionKey: 'rework_order.pull_from_work_order',
                onClick: () => {
                  pullFromWorkOrderQuery.openModal();
                },
              },
              {
                actionKey: 'rework_order.pull_from_finished_goods_inspection',
                onClick: () => {
                  pullFromFinishedGoodsQuery.openModal();
                },
              },
            ])}
          />,
        ]}
      />

      <UniPullQueryModal<PullFinishedGoodsInspectionCandidate>
        open={pullFromFinishedGoodsQuery.open}
        title={pullFromFinishedGoodsInspectionAction.label}
        onCancel={pullFromFinishedGoodsQuery.closeModal}
        onOk={() => {
          void pullFromFinishedGoodsQuery.handleConfirm();
        }}
        rowKey="id"
        columns={pullFromFinishedGoodsColumns}
        dataSource={pullFromFinishedGoodsQuery.dataSource}
        loading={pullFromFinishedGoodsQuery.loading}
        confirmLoading={pullFromFinishedGoodsQuery.confirmLoading}
        selectionType={pullFromFinishedGoodsQuery.selectionType}
        selectedRowKeys={pullFromFinishedGoodsQuery.selectedRowKeys}
        onSelectedRowKeysChange={pullFromFinishedGoodsQuery.handleSelectedRowKeysChange}
        isRowDisabled={pullFromFinishedGoodsQuery.isRowDisabled}
        searchDraft={pullFromFinishedGoodsQuery.searchDraft}
        onSearchDraftChange={pullFromFinishedGoodsQuery.setSearchDraft}
        onSearchApply={pullFromFinishedGoodsQuery.handleSearchApply}
        onSearchClear={pullFromFinishedGoodsQuery.handleSearchClear}
        appliedKeyword={pullFromFinishedGoodsQuery.appliedKeyword}
        searchPlaceholder={t('components.uniPullQuery.searchPlaceholder')}
        page={pullFromFinishedGoodsQuery.page}
        pageSize={pullFromFinishedGoodsQuery.pageSize}
        total={pullFromFinishedGoodsQuery.total}
        onPageChange={pullFromFinishedGoodsQuery.handlePageChange}
        scopeOptions={pullFromFinishedGoodsQuery.scopeOptions}
        scope={pullFromFinishedGoodsQuery.scope}
        onScopeChange={pullFromFinishedGoodsQuery.handleScopeChange}
        okText={t('common.next')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <UniPullQueryModal<PullReworkWorkOrderCandidate>
        open={pullFromWorkOrderQuery.open}
        title={pullFromWorkOrderAction.label}
        onCancel={pullFromWorkOrderQuery.closeModal}
        onOk={() => {
          void pullFromWorkOrderQuery.handleConfirm();
        }}
        rowKey="id"
        columns={pullFromWorkOrderColumns}
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
        okText={t('common.next')}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
      />

      <ReworkOrderCreateModal
        key={pullWorkOrderDetail?.id ? String(pullWorkOrderDetail.id) : 'rework-create-empty'}
        open={createFromWorkOrderVisible}
        title={pullFromWorkOrderAction.label}
        loading={createFromWorkOrderLoading || createFromWorkOrderSubmitLoading}
        initialValues={createFromWorkOrderInitialValues}
        workOrderCode={pullWorkOrderDetail?.code as string | undefined}
        productName={pullWorkOrderDetail?.product_name as string | undefined}
        reworkableQuantity={pullWorkOrderReworkableQty}
        operations={pullWorkOrderOperations.map((op) => ({
          id: op.id as number,
          sequence: op.sequence as number | undefined,
          operation_code: op.operation_code as string | undefined,
          operation_name: op.operation_name as string | undefined,
          workshop_name: op.workshop_name as string | undefined,
          standard_time: op.standard_time as number | undefined,
        }))}
        reworkTypeOptions={reworkTypeOptions}
        reworkTypeLoading={reworkTypeLoading}
        onClose={resetCreateFromWorkOrderModal}
        onStartOperationChange={(startOpId) => {
          if (!pullWorkOrderDetail?.id) return;
          void refreshPullWorkOrderReworkPreview(Number(pullWorkOrderDetail.id), startOpId);
        }}
        onFinish={handleSubmitFromWorkOrder}
      />

      <Modal
        title={pullFromFinishedGoodsInspectionAction.label}
        open={pullPreviewOpen}
        destroyOnClose
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={resetPullPreviewModal}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        confirmLoading={pullPreviewConfirming}
        onOk={() => void handlePullPreviewConfirm()}
        okButtonProps={{
          disabled:
            pullPreviewLoading ||
            !pullPreviewData ||
            !!pullPreviewData?.has_blocking_issues ||
            !(pullPreviewData?.items || []).some((row) => Number(row.max_push_quantity ?? 0) > 0) ||
            !(Number(pullPreviewQuantity) > 0),
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
            {pullPreviewData.has_blocking_issues ? (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={pullPreviewData.summary} />
            ) : null}
            {pullPreviewData.items?.length > 0 ? (
              <Table
                size="small"
                dataSource={pullPreviewData.items}
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
                          value={pullPreviewQuantity}
                          onChange={(val) => setPullPreviewQuantity(Number(val ?? 0))}
                        />
                      );
                    },
                  },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.workOrder.soPullPreviewNoLines')} />
            )}
            {pullPreviewData.tip ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {pullPreviewData.tip}
              </Typography.Paragraph>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* 表单Modal */}
      <FormModalTemplate
        title={isEdit ? t('app.kuaizhizao.reworkOrder.editModalTitle') : t('app.kuaizhizao.reworkOrder.createModalTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          resetReworkFormFieldValues();
        }}
        onFinish={handleSubmitForm}
        formRef={formRef}
        {...MODAL_CONFIG}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-production-rework-order"
              name="code"
              label={t('app.kuaizhizao.reworkOrder.colCode')}
              required={true}
              autoGenerateOnCreate={!isEdit}
              showGenerateButton={false}
              disabled={isEdit}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="original_work_order_id"
              label={t('app.kuaizhizao.reworkOrder.formOriginalWorkOrder')}
              placeholder={t('app.kuaizhizao.reworkOrder.formOriginalWorkOrderPlaceholder')}
              rules={[{ required: false }]}
              disabled={isEdit}
              fieldProps={{
                showSearch: true,
                filterOption: (input: string, option: any) =>
                  option?.label?.toLowerCase().includes(input.toLowerCase()),
                onChange: async (value: number) => {
                  if (value) {
                    setWorkOrderProductLoading(true);
                    try {
                      const wo = await workOrderApi.get(String(value));
                      setWorkOrderProduct({
                        id: wo.product_id,
                        code: wo.product_code || '',
                        name: wo.product_name || '',
                      });
                      formRef.current?.setFieldsValue({
                        product_id: wo.product_id,
                        product_code: wo.product_code,
                        product_name: wo.product_name,
                        quantity: wo.quantity ?? undefined,
                      });
                    } catch {
                      messageApi.error(t('app.kuaizhizao.reworkOrder.loadWorkOrderFailed'));
                      setWorkOrderProduct(null);
                    } finally {
                      setWorkOrderProductLoading(false);
                    }
                  } else {
                    setWorkOrderProduct(null);
                    formRef.current?.setFieldsValue({
                      product_id: undefined,
                      product_code: undefined,
                      product_name: undefined,
                      quantity: undefined,
                    });
                  }
                },
              }}
              request={async () => {
                const res = await workOrderApi.list({ limit: 200 });
                const items = res?.items ?? res?.data ?? (Array.isArray(res) ? res : []);
                return items.map((wo: any) => ({
                  label: `${wo.code || ''} - ${wo.name || wo.product_name || ''}`,
                  value: wo.id,
                }));
              }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDependency name={['original_work_order_id']}>
              {({ original_work_order_id }) =>
                original_work_order_id ? (
                  workOrderProduct ? (
                    <ProFormSelect
                      name="product_id"
                      label={t('app.kuaizhizao.reworkOrder.formProduct')}
                      placeholder={t('app.kuaizhizao.reworkOrder.formProductPlaceholder')}
                      required
                      options={[
                        {
                          value: workOrderProduct.id,
                          label: `${workOrderProduct.code} - ${workOrderProduct.name}`.trim() || String(workOrderProduct.id),
                        },
                      ]}
                      fieldProps={{ disabled: true }}
                    />
                  ) : (
                    <ProFormSelect
                      name="product_id"
                      label={t('app.kuaizhizao.reworkOrder.formProduct')}
                      placeholder={workOrderProductLoading ? t('app.kuaizhizao.reworkOrder.formProductLoading') : t('app.kuaizhizao.reworkOrder.formProductPlaceholder')}
                      required
                      options={[]}
                      fieldProps={{ disabled: true, loading: workOrderProductLoading }}
                    />
                  )
                ) : (
                  <UniMaterialSelect
                    name="product_id"
                    label={t('app.kuaizhizao.reworkOrder.formProduct')}
                    placeholder={t('app.kuaizhizao.reworkOrder.formProductPlaceholder')}
                    required
                    fillMapping={{
                      product_code: 'mainCode',
                      product_name: 'name',
                    }}
                    showQuickCreate
                    showAdvancedSearch
                  />
                )
              }
            </ProFormDependency>
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="quantity"
              label={t('app.kuaizhizao.reworkOrder.colQuantity')}
              placeholder={t('app.kuaizhizao.reworkOrder.formQuantityRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formQuantityRequired') }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
        </Row>
        <ProFormText name="product_code" hidden />
        <ProFormText name="product_name" hidden />
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="rework_type" label={t('app.kuaizhizao.reworkOrder.colReworkType')} rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formReworkTypeRequired') }]}>
              <UniDropdown
                placeholder={t('app.kuaizhizao.reworkOrder.formReworkTypePlaceholder')}
                showSearch
                allowClear
                loading={reworkTypeLoading}
                style={{ width: '100%' }}
                options={reworkTypeOptions}
                quickCreate={{ label: t('app.kuaizhizao.reworkOrder.dictManage'), onClick: () => navigate('/system/data-dictionaries') }}
              />
            </ProFormItem>
          </Col>
          <Col span={12} />
        </Row>
        <ProFormDependency name={['original_work_order_id']}>
          {({ original_work_order_id }) =>
            original_work_order_id ? (
              <ProFormSelect
                name="start_work_order_operation_id"
                label={t('app.kuaizhizao.reworkOrder.formStartOperation')}
                placeholder={t('app.kuaizhizao.reworkOrder.formStartOperationPlaceholder')}
                allowClear
                fieldProps={{
                  showSearch: true,
                  filterOption: (input: string, option: any) =>
                    option?.label?.toLowerCase().includes(input.toLowerCase()),
                }}
                request={async () => {
                  const ops = await workOrderApi.getOperations(String(original_work_order_id));
                  return (ops || []).map((op: any) => ({
                    label: t('app.kuaizhizao.reworkOrder.formReportOperationSequence', { sequence: op.sequence || '', name: op.operation_name || op.operation_code || '' }),
                    value: op.id,
                  }));
                }}
              />
            ) : null
          }
        </ProFormDependency>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_start_date"
              label={t('app.kuaizhizao.reworkOrder.formPlannedStart')}
              placeholder={t('app.kuaizhizao.reworkOrder.formPlannedStartPlaceholder')}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="planned_end_date"
              label={t('app.kuaizhizao.reworkOrder.formPlannedEnd')}
              placeholder={t('app.kuaizhizao.reworkOrder.formPlannedEndPlaceholder')}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormDigit
              name="completed_quantity"
              label={t('app.kuaizhizao.reworkOrder.formCompletedQty')}
              placeholder={t('app.kuaizhizao.reworkOrder.formCompletedQty')}
              initialValue={0}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
          <Col span={8}>
            <ProFormDigit
              name="qualified_quantity"
              label={t('app.kuaizhizao.reworkOrder.formQualifiedQty')}
              placeholder={t('app.kuaizhizao.reworkOrder.formQualifiedQty')}
              initialValue={0}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
          <Col span={8}>
            <ProFormDigit
              name="unqualified_quantity"
              label={t('app.kuaizhizao.reworkOrder.formUnqualifiedQty')}
              placeholder={t('app.kuaizhizao.reworkOrder.formUnqualifiedQty')}
              initialValue={0}
              min={0}
              fieldProps={{ precision: 2 }}
            />
          </Col>
        </Row>
        <ProFormTextArea
          name="rework_reason"
          label={t('app.kuaizhizao.reworkOrder.formReworkReason')}
          placeholder={t('app.kuaizhizao.reworkOrder.formReworkReasonRequired')}
          rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formReworkReasonRequired') }]}
          fieldProps={{ rows: 3 }}
        />
        <CustomFieldsFormSection
          customFields={reworkFormCustomFields}
          customFieldValues={reworkFormCustomFieldValues}
          gridColumns={2}
        />
        <DocumentAttachmentsField category="rework_order_attachments" />
        <ProFormTextArea
          name="remarks"
          label={t('app.kuaizhizao.workReporting.colRemarks')}
          placeholder={t('app.kuaizhizao.workReporting.formRemarksPlaceholder')}
          fieldProps={{ rows: 3 }}
        />
      </FormModalTemplate>

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`${t('app.kuaizhizao.reworkOrder.detailTitle')}${reworkOrderDetail?.code ? ` - ${reworkOrderDetail.code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          resetReworkDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          reworkOrderDetail && (() => {
            const detail = reworkOrderDetail;
            return (
              <DetailDrawerActions
                items={[
                  {
                    key: 'release',
                    visible: reworkCapabilityAllowed(detail, 'release'),
                    render: () => (
                      <Button onClick={() => void handleReleaseRework(detail)}>
                        {t('app.kuaizhizao.reworkOrder.actionRelease')}
                      </Button>
                    ),
                  },
                  {
                    key: 'report',
                    visible: reworkCapabilityAllowed(detail, 'execute'),
                    render: () => (
                      <Button
                        icon={<FormOutlined />}
                        onClick={() => {
                          setDetailDrawerVisible(false);
                          void handleOpenReport(detail);
                        }}
                      >
                        {t('app.kuaizhizao.reworkOrder.report')}
                      </Button>
                    ),
                  },
                  {
                    key: 'advance',
                    visible: reworkCapabilityAllowed(detail, 'advance_next'),
                    render: () => (
                      <Button onClick={() => void handleAdvanceNext(detail)}>
                        {t('app.kuaizhizao.reworkOrder.actionAdvanceNext')}
                      </Button>
                    ),
                  },
                  {
                    key: 'complete',
                    visible: reworkCapabilityAllowed(detail, 'request_complete'),
                    render: () => (
                      <Button onClick={() => void handleRequestComplete(detail)}>
                        {t('app.kuaizhizao.reworkOrder.actionRequestComplete')}
                      </Button>
                    ),
                  },
                  {
                    key: 'go-verify',
                    visible:
                      String(detail.status || '') === 'pending_verification' &&
                      Boolean(detail.verification_inspection_id),
                    render: () => (
                      <Button
                        onClick={() => {
                          setDetailDrawerVisible(false);
                          const kind =
                            detail.verification_inspection_type ||
                            (detail.source_inspection_id
                              ? 'finished_goods_inspection'
                              : 'process_inspection');
                          if (kind === 'finished_goods_inspection') {
                            navigate(
                              `/apps/kuaizhizao/quality-management/finished-goods-inspection?finished_goods_inspection_id=${detail.verification_inspection_id}`,
                            );
                          } else {
                            navigate(
                              `/apps/kuaizhizao/quality-management/process-inspection?process_inspection_id=${detail.verification_inspection_id}`,
                            );
                          }
                        }}
                      >
                        {t('app.kuaizhizao.reworkOrder.actionGoVerification')}
                      </Button>
                    ),
                  },
                  {
                    key: 'quality_release',
                    visible: reworkCapabilityAllowed(detail, 'quality_release'),
                    render: () => (
                      <Button onClick={() => void handleQualityRelease(detail)}>
                        {t('app.kuaizhizao.reworkOrder.actionQualityRelease')}
                      </Button>
                    ),
                  },
                  {
                    key: 'close',
                    visible: reworkCapabilityAllowed(detail, 'close'),
                    render: () => (
                      <Button onClick={() => void handleCloseRework(detail)}>
                        {t('app.kuaizhizao.reworkOrder.actionClose')}
                      </Button>
                    ),
                  },
                  {
                    key: 'edit',
                    visible: reworkCapabilityAllowed(detail, 'update'),
                    render: () => (
                      <Button
                        icon={<EditOutlined />}
                        onClick={() => {
                          setDetailDrawerVisible(false);
                          handleEdit(detail);
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                    ),
                  },
                  {
                    key: 'delete',
                    visible: reworkCapabilityAllowed(detail, 'delete'),
                    render: () => (
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(detail)}
                      >
                        {t('common.delete')}
                      </Button>
                    ),
                  },
                ]}
              />
            );
          })()
        }
        basic={
          reworkOrderDetail ? (
            <>
              <Descriptions
                column={3}
                size="small"
                items={detailDrawerDescriptionItems(
                  detailBasicColumns.filter((col) => {
                    if (col.dataIndex !== 'remarks') return true;
                    const remarks = String(reworkOrderDetail.remarks ?? '').trim();
                    return remarks.length > 0;
                  }),
                  reworkOrderDetail,
                )}
              />
              {hasCustomFieldsDetailContent(reworkListCustomFields, reworkDetailCustomFieldValues) ? (
                <div style={{ marginTop: 16 }}>
                  <CustomFieldsDetailSection
                    customFields={reworkListCustomFields}
                    customFieldValues={reworkDetailCustomFieldValues}
                  />
                </div>
              ) : null}
            </>
          ) : undefined
        }
        collaboration={detailCollaboration?.stepper}
        collaborationTitle={t('app.kuaizhizao.reworkOrder.sectionLifecycle')}
        collaborationTitleSuffix={
          detailCollaboration?.nextSteps?.length ? (
            <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              {t('components.uniLifecycle.nextStep')}：
              {detailCollaboration.nextSteps.join(t('components.uniLifecycle.nextStepSeparator'))}
            </Typography.Text>
          ) : undefined
        }
        collaborationAuditRecord={reworkOrderDetail as AuditPhaseRecord | null}
        linesTitle={t('app.kuaizhizao.reworkOrder.sectionRouteTimeline')}
        lines={
          reworkOrderDetail ? (
            (reworkOrderDetail.rework_operations || []).length > 0 ? (
              <Table
                size="small"
                pagination={false}
                rowKey={(row) => String(row.id ?? row.work_order_operation_id)}
                dataSource={reworkOrderDetail.rework_operations || []}
                columns={[
                  { title: t('app.kuaizhizao.reworkOrder.formReportOperationSequence', { sequence: '#', name: '' }).replace(' - ', ''), dataIndex: 'operation_name', render: (_: unknown, row) => row.operation_name || row.operation_code },
                  { title: t('app.kuaizhizao.reworkOrder.colLifecycle'), dataIndex: 'status' },
                  { title: t('app.kuaizhizao.reworkOrder.colQuantity'), dataIndex: 'input_quantity' },
                  { title: t('app.kuaizhizao.reworkOrder.colQualifiedQty'), dataIndex: 'qualified_quantity' },
                  { title: t('app.kuaizhizao.reworkOrder.colUnqualifiedQty'), dataIndex: 'unqualified_quantity' },
                ]}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.salesOrder.emptyItems')} />
            )
          ) : undefined
        }
        traceDocument={reworkOrderTraceDocument}
        timelineTitle={t('app.uniDetail.sectionTimeline')}
        timeline={
          reworkOrderDetail ? (
            <>
              {reworkOrderTracking.loading ? (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <Spin />
                </div>
              ) : null}
              {reworkOrderTracking.error && !reworkOrderTracking.loading ? (
                <Typography.Text type="danger">{reworkOrderTracking.error}</Typography.Text>
              ) : null}
              {reworkOrderTracking.data && !reworkOrderTracking.loading ? (
                <DocumentTrackingTimelineBody data={reworkOrderTracking.data} />
              ) : null}
              {!reworkOrderTracking.loading && !reworkOrderTracking.data && !reworkOrderTracking.error ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('components.documentTrackingPanel.noOperations')} />
              ) : null}
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title={t('app.kuaizhizao.reworkOrder.reportModalTitle')}
        open={reportModalVisible}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        loading={reportSubmitLoading}
        initialValues={reportFormInitialValues}
        onClose={() => {
          setReportModalVisible(false);
          setCurrentReworkOrderForReport(null);
          setReportingOptions(null);
          reportFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitReport}
        formRef={reportFormRef}
      >
        {currentReworkOrderForReport && reportingOptions ? (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <div>
                    {t('app.kuaizhizao.reworkOrder.reportCardOrder')}
                    {currentReworkOrderForReport.code}
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    {t('app.kuaizhizao.reworkOrder.reportCardQuantity')}
                    {reportingOptions.rework_quantity}
                  </div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div>
                    {t('app.kuaizhizao.reworkOrder.reportCardStartOperation')}
                    {reportingOptions.start_operation_name || '-'}
                  </div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div>
                    {t('app.kuaizhizao.reworkOrder.reportCardRemaining')}
                    {reportingOptions.remaining_input_quantity ?? reportingOptions.remaining_rework_quantity}
                  </div>
                </Col>
              </Row>
            </Card>
            <ProFormSelect
              name="work_order_operation_id"
              label={t('app.kuaizhizao.reworkOrder.formReportOperation')}
              placeholder={t('app.kuaizhizao.reworkOrder.formReportOperationRequired')}
              rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formReportOperationRequired') }]}
              options={(reportingOptions.operations || [])
                .filter((op: any) => op.selectable)
                .map((op: any) => ({
                  label: `${op.is_start_operation ? t('app.kuaizhizao.reworkOrder.formReportOperationStart') : ''}${t('app.kuaizhizao.reworkOrder.formReportOperationSequence', { sequence: op.sequence || '', name: op.operation_name || op.operation_code || op.work_order_operation_id })}${t('app.kuaizhizao.reworkOrder.formReportOperationReported', { qty: op.reported_quantity })}`,
                  value: op.work_order_operation_id,
                }))}
              fieldProps={{ showSearch: true }}
            />
            <ProFormDigit
              name="reported_quantity"
              label={t('app.kuaizhizao.workReporting.colReportedQty')}
              rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formReportedQtyRequired') }]}
              min={0.01}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="qualified_quantity"
              label={t('app.kuaizhizao.reworkOrder.formQualifiedQty')}
              rules={[{ required: true, message: t('app.kuaizhizao.workReporting.formQualifiedQtyRequired') }]}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="unqualified_quantity"
              label={t('app.kuaizhizao.reworkOrder.formUnqualifiedQty')}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDigit
              name="work_hours"
              label={t('app.kuaizhizao.workReporting.colWorkHours')}
              min={0}
              fieldProps={{ precision: 2 }}
            />
            <ProFormDatePicker
              name="reported_at"
              label={t('app.kuaizhizao.reworkOrder.formReportedAt')}
              rules={[{ required: true, message: t('app.kuaizhizao.reworkOrder.formReportedAtRequired') }]}
              {...formDateFormItemProps}
              fieldProps={{ showTime: true, style: { width: '100%' } }}
            />
            <ProFormTextArea name="remarks" label={t('app.kuaizhizao.workReporting.colRemarks')} fieldProps={{ rows: 2 }} />
          </>
        ) : null}
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default ReworkOrdersPage;

