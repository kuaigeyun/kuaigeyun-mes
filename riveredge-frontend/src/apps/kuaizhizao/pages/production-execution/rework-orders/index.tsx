/**
 * 返工单管理页面
 *
 * 提供返工单的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持从原工单创建返工单。
 *
 * Author: Luigi Lu
 * Date: 2026-01-05
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { renderRowActionsOverflow, rowActionKind } from '../../../../../components/uni-action';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormText, ProFormSelect, ProFormDatePicker, ProFormDigit, ProFormTextArea, ProFormItem, ProFormDependency } from '@ant-design/pro-components';
import { App, Button, Card, Col, Modal, Row, Tag, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, FormOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { UniPullQueryModal, useUniPullQuery } from '../../../../../components/uni-pull-query';
import { DetailDrawerActions, DetailDrawerSection, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import CodeField from '../../../../../components/code-field';
import { getDataDictionaryList, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { qualityApi, reworkOrderApi, workOrderApi } from '../../../services/production';
import { buildKuaizhizaoPullCreateMenuItems, resolveKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { getReworkOrderLifecycle } from '../../../utils/reworkOrderLifecycle';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { useTranslation } from 'react-i18next';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';

const REWORK_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_rework_orders';

interface ReworkOrder {
  id?: number;
  tenant_id?: number;
  code?: string;
  original_work_order_id?: number;
  original_work_order_uuid?: string;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  quantity?: number;
  rework_reason?: string;
  rework_type?: string;
  status?: string;
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
    work_order_operation_id: number;
    operation_name?: string;
    operation_code?: string;
    is_start?: boolean;
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
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const currentUser = useGlobalStore((s) => s.currentUser);

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

  useEffect(() => {
    if (reworkListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [reworkListCustomFields.length]);

  /**
   * 详情列定义
   */
  const detailColumns: ProDescriptionsItemProps<ReworkOrder>[] = useMemo(() => [
    {
      title: t('app.kuaizhizao.reworkOrder.colCode'),
      dataIndex: 'code',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colOriginalWorkOrderId'),
      dataIndex: 'original_work_order_id',
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
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colReworkType'),
      dataIndex: 'rework_type',
      render: (_, record) => {
        const text = String(record.rework_type ?? '');
        const typeMap: Record<string, { text: string; color: string }> = {
          '返工': { text: t('app.kuaizhizao.reworkOrder.typeRework'), color: 'blue' },
          '返修': { text: t('app.kuaizhizao.reworkOrder.typeRepair'), color: 'orange' },
          '报废': { text: t('app.kuaizhizao.reworkOrder.typeScrap'), color: 'red' },
        };
        const config = typeMap[text] || { text: text || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
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
  ], [t]);

  /**
   * 表格列定义
   */
  const columns: ProColumns<ReworkOrder>[] = useMemo(() => {
    const customFieldColumns = generateReworkCustomFieldColumns();
    return [
    {
      title: t('app.kuaizhizao.reworkOrder.colCode'),
      dataIndex: 'code',
      width: 180,
      fixed: 'left',
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colOriginalWorkOrderId'),
      dataIndex: 'original_work_order_id',
      width: 120,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colProductName'),
      dataIndex: 'product_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colQuantity'),
      dataIndex: 'quantity',
      width: 100,
      valueType: 'digit',
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colReworkType'),
      dataIndex: 'rework_type',
      width: 100,
      render: (_, record) => {
        const text = String(record.rework_type ?? '');
        const typeMap: Record<string, { text: string; color: string }> = {
          '返工': { text: t('app.kuaizhizao.reworkOrder.typeRework'), color: 'blue' },
          '返修': { text: t('app.kuaizhizao.reworkOrder.typeRepair'), color: 'orange' },
          '报废': { text: t('app.kuaizhizao.reworkOrder.typeScrap'), color: 'red' },
        };
        const config = typeMap[text] || { text: text || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colLifecycle'),
      dataIndex: 'lifecycle_stage',
      width: 140,
      fixed: 'right',
      valueEnum: {
        draft: { text: t('app.kuaizhizao.reworkOrder.lifecycleDraft'), status: 'Default' },
        released: { text: t('app.kuaizhizao.reworkOrder.lifecycleReleased'), status: 'Processing' },
        in_progress: { text: t('app.kuaizhizao.reworkOrder.lifecycleInProgress'), status: 'Processing' },
        completed: { text: t('app.kuaizhizao.reworkOrder.lifecycleCompleted'), status: 'Success' },
        cancelled: { text: t('app.kuaizhizao.reworkOrder.lifecycleCancelled'), status: 'Error' },
      },
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
    {
      title: t('app.kuaizhizao.reworkOrder.colPlannedStart'),
      dataIndex: 'planned_start_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('app.kuaizhizao.reworkOrder.colPlannedEnd'),
      dataIndex: 'planned_end_date',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('common.createdAt'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
      sorter: true,
    },
    ...customFieldColumns,
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 200,
      fixed: 'right',
      render: (_text, record) => {
        const lifecycle = getReworkOrderLifecycle(record);
        const canEdit = lifecycle.stageName !== '已完成' && lifecycle.stageName !== '已取消';
        const canDelete = lifecycle.stageName === '草稿';
        const canReport =
          lifecycle.stageName === '已下达' || lifecycle.stageName === '执行中';
        return renderRowActionsOverflow(
          [
            <Button key="view" {...rowActionKind('read')} onClick={() => handleDetail(record)}>{t('common.detail')}</Button>,
            canReport ? (
              <Button
                {...rowActionKind('execute')}
                key="report"
                icon={<FormOutlined />}
                onClick={() => void handleOpenReport(record)}
              >
                {t('app.kuaizhizao.reworkOrder.report')}
              </Button>
            ) : null,
            <Button
              key="edit"
              {...rowActionKind('update')}
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={!canEdit}
            >
              {t('common.edit')}
            </Button>,
            canDelete ? (
              <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDelete(record)}>{t('common.delete')}</Button>
            ) : null,
          ],
          { keyPrefix: `rework-order-actions-${record.id ?? 'row'}` },
        );
      },
    },
  ];
  }, [reworkListCustomFields, generateReworkCustomFieldColumns, t]);

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
    const remaining = Number(reportingOptions.remaining_rework_quantity ?? 0);
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
        reported_at: values.reported_at
          ? values.reported_at.toDate().toISOString()
          : new Date().toISOString(),
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

  /**
   * 处理删除
   */
  const handleDelete = async (record: ReworkOrder) => {
    Modal.confirm({
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

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentReworkOrder(null);
    setWorkOrderProduct(null);
    resetReworkFormFieldValues();
    setModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
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
        const created = await reworkOrderApi.create(standardValues);
        if (created?.id != null) {
          await saveReworkCustomFieldValues(created.id, customData);
        }
        messageApi.success(t('app.kuaizhizao.reworkOrder.createSuccess'));
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
    filter: Record<string, React.ReactText[] | null>
  ) => {
    try {
      const response = await reworkOrderApi.list({
        page: params.current || 1,
        page_size: params.pageSize || 20,
      });
      const list = Array.isArray(response) ? response : [];
      const enriched = await enrichReworkRecordsWithCustomFields(list);
      return {
        data: enriched,
        success: true,
        total: enriched.length,
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

  const pullFromFinishedGoodsQuery = useUniPullQuery<PullFinishedGoodsInspectionCandidate>({
    rowKey: 'id',
    selectionType: 'radio',
    isRowDisabled: (record) => {
      const allowPush = record.capabilities?.push_rework?.allowed !== false;
      const hasUnqualified = Number(record.unqualified_quantity || 0) > 0;
      const isUnqualified = String(record.quality_status || '') === '不合格';
      return !(allowPush && hasUnqualified && isUnqualified);
    },
    loadData: async ({ keyword, page, pageSize }) => {
      try {
        const response = await qualityApi.finishedGoodsInspection.list({
          skip: (page - 1) * pageSize,
          limit: pageSize,
          keyword: keyword.trim() || undefined,
        });
        const list = Array.isArray(response)
          ? response
          : (response as { data?: unknown[]; items?: unknown[] })?.data
            ?? (response as { items?: unknown[] })?.items
            ?? [];
        return {
          data: (Array.isArray(list) ? list : []) as PullFinishedGoodsInspectionCandidate[],
          total: Number((response as { total?: number })?.total ?? (Array.isArray(list) ? list.length : 0)),
        };
      } catch (error: any) {
        messageApi.error(
          error?.message || t('app.kuaizhizao.quality.common.messages.loadListFailed'),
        );
        return { data: [], total: 0 };
      }
    },
    onConfirm: async (keys, rows) => {
      const selected = rows.find((x) => String(x.id) === String(keys[0]));
      if (!selected?.id) {
        messageApi.warning(
          t('app.kuaizhizao.shipmentNotice.selectSource', {
            source: pullFromFinishedGoodsInspectionAction.sourceLabel,
          }),
        );
        return;
      }
      try {
        const result = await qualityApi.finishedGoodsInspection.pushToRework(String(selected.id));
        const reworkCode = (result as { rework_order_code?: string })?.rework_order_code;
        messageApi.success(
          reworkCode
            ? t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: reworkCode })
            : t('app.kuaizhizao.quality.common.messages.pushReworkSuccess', { code: '-' }),
        );
        pullFromFinishedGoodsQuery.closeModal();
        invalidateMenuBadgeCounts();
        actionRef.current?.reload();
      } catch (error: any) {
        messageApi.error(
          error?.message || t('app.kuaizhizao.quality.common.messages.pushReworkFailed'),
        );
      }
    },
  });
  useNewShortcut(handleCreate);
  const createButtonLabel = useMemo(
    () => withSingleNewShortcutHint(t('app.kuaizhizao.reworkOrder.createButton')),
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<ReworkOrder>
        columnPersistenceId="apps.kuaizhizao.pages.production-execution.rework-orders"
        headerTitle={t('app.kuaizhizao.reworkOrder.title')}
        actionRef={actionRef}
        columns={columns}
        request={handleRequest}
        rowKey="id"
        enableRowSelection={true}
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showCreateButton={false}
        createButtonText={createButtonLabel}
        onCreate={handleCreate}
        showDeleteButton={true}
        onDelete={handleDeleteFromSelection}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.reworkOrder.deleteSelectedConfirm', { count })}
        showAdvancedSearch={true}
        toolBarRender={() => [
          <UniPullCreateToolbar
            key="rework-order-create-with-pull"
            compactKey="rework-order-create-with-pull"
            createIcon={<PlusOutlined />}
            createLabel={createButtonLabel}
            onCreate={handleCreate}
            menuItems={buildKuaizhizaoPullCreateMenuItems(t, [
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
      />

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
        title={t('app.kuaizhizao.reworkOrder.detailTitle')}
        open={detailDrawerVisible}
        onClose={() => {
          setDetailDrawerVisible(false);
          resetReworkDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={reworkOrderDetail ?? undefined}
        extra={
          reworkOrderDetail && (() => {
            const lifecycle = getReworkOrderLifecycle(reworkOrderDetail);
            const canEdit = lifecycle.stageName === '草稿';
            return (
              <DetailDrawerActions
                items={[
                  {
                    key: 'report',
                    visible:
                      getReworkOrderLifecycle(reworkOrderDetail).stageName === '已下达'
                      || getReworkOrderLifecycle(reworkOrderDetail).stageName === '执行中',
                    render: () => (
                      <Button
                        type="link"
                        size="small"
                        icon={<FormOutlined />}
                        onClick={() => {
                          setDetailDrawerVisible(false);
                          void handleOpenReport(reworkOrderDetail);
                        }}
                      >
                        {t('app.kuaizhizao.reworkOrder.report')}
                      </Button>
                    ),
                  },
                  {
                    key: 'edit',
                    visible: canEdit,
                    render: () => (
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => {
                          setDetailDrawerVisible(false);
                          handleEdit(reworkOrderDetail);
                        }}
                      >
                        {t('common.edit')}
                      </Button>
                    ),
                  },
                  {
                    key: 'delete',
                    visible: canEdit,
                    render: () => (
                      <Button
                        type="link"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(reworkOrderDetail)}
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
      >
        {hasCustomFieldsDetailContent(reworkListCustomFields, reworkDetailCustomFieldValues) ? (
          <DetailDrawerSection title={t('app.kuaizhizao.reworkOrder.sectionCustomFields')}>
            <CustomFieldsDetailSection
              customFields={reworkListCustomFields}
              customFieldValues={reworkDetailCustomFieldValues}
            />
          </DetailDrawerSection>
        ) : null}
        {reworkOrderDetail && (() => {
          const lifecycle = getReworkOrderLifecycle(reworkOrderDetail);
          const mainStages = lifecycle.mainStages ?? [];
          if (mainStages.length === 0) return null;
          return (
            <DetailDrawerSection title={t('app.kuaizhizao.reworkOrder.sectionLifecycle')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {mainStages.length > 0 && (
                  <UniLifecycleStepper
                    steps={mainStages}
                    status={lifecycle.status}
                    showLabels
                    nextStepSuggestions={lifecycle.nextStepSuggestions}
                  />
                )}
              </div>
            </DetailDrawerSection>
          );
        })()}
        {reworkOrderDetail?.id && (
          <DetailDrawerSection title={t('app.kuaizhizao.reworkOrder.sectionOperationHistory')}>
            <DocumentTrackingPanel documentType="rework_order" documentId={reworkOrderDetail.id} />
          </DetailDrawerSection>
        )}
      </DetailDrawerTemplate>

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
                    {reportingOptions.remaining_rework_quantity}
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

