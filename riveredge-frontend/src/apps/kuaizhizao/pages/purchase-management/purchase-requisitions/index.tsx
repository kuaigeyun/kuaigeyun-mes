/**
 * 采购申请管理页面
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { ActionType, ProColumns, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Table, Form as AntForm, Input, InputNumber, Select, Dropdown, Row, Col, Checkbox, Descriptions, Empty, Spin, Typography, DatePicker, Modal, theme } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  SwapOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DetailDrawerActions, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import { MaterialUnitSelect, prefetchMaterialsForUnitSelect } from '../../../../../components/material-unit-select';
import { UniMaterialBatchPicker } from '../../../../../components/uni-material-batch-picker';
import type { Material } from '../../../../master-data/types/material';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { downloadFile } from '../../../../../utils';
import {
  listPurchaseRequisitions,
  getPurchaseRequisition,
  createPurchaseRequisition,
  updatePurchaseRequisition,
  deletePurchaseRequisition,
  submitPurchaseRequisition,
  approvePurchaseRequisition,
  withdrawPurchaseRequisition,
  fixPurchaseRequisitionStatus,
  convertToPurchaseOrder,
  PurchaseRequisition,
  PurchaseRequisitionItem,
} from '../../../services/purchase-requisition';
import {
  listDemandComputations,
  pushToPurchaseRequisition,
  getPushOptions,
} from '../../../services/demand-computation';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getPurchaseRequisitionLifecycle } from '../../../utils/purchaseRequisitionLifecycle';
import { formatPurchaseRequisitionSourceType } from '../../../utils/purchaseRequisitionSourceType';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { useDocumentTracking, DocumentTrackingTimelineBody } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { ROUTES } from '../../../constants/routes';
import { PriceHistoryInsight } from '../purchase-orders/ProcurementEmpowermentComponents';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../../../stores';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';

/** 采购申请详情只读明细表最小横向宽度 */
const PURCHASE_REQUISITION_DETAIL_ITEMS_MIN_WIDTH = 980;

const INITIAL_PR_FORM_ITEM_ROW = {
  material_id: undefined,
  material_code: '',
  material_name: '',
  material_spec: '',
  unit: '件',
  quantity: 1,
  suggested_unit_price: 0,
  required_date: undefined,
  demand_computation_item_id: undefined,
  supplier_id: undefined,
  notes: undefined,
};

type PullDemandComputationCandidate = {
  id: number;
  computation_code?: string;
  business_mode?: string;
  computation_status?: string;
  created_at?: string;
  updated_at?: string;
  has_purchase_items?: boolean;
  can_push_requisition?: boolean;
  disabled_reason?: string;
};

function renderPurchaseRequisitionRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return renderRowActionsOverflow(nodes, keyPrefix);
}

function canPushPurchaseRequisition(record: PurchaseRequisition): boolean {
  const s = (record.status ?? '').toString().trim();
  return [
    '已通过',
    '已确认',
    '部分转单',
    'approved',
    'confirmed',
    'audited',
    'APPROVED',
    'CONFIRMED',
    'AUDITED',
    'PARTIAL_CONVERTED',
  ].includes(s);
}

const PurchaseRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const purchaseRequestAuditEnabled = useAuditRequired('purchase_request', false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { token } = theme.useToken();
  const prqDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const lastRequisitionsCacheRef = useRef<PurchaseRequisition[]>([]);
  const deepLinkHandledRef = useRef<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReq, setCurrentReq] = useState<PurchaseRequisition | null>(null);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; code?: string; name: string }>>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [pullFromComputationVisible, setPullFromComputationVisible] = useState(false);
  const [pullComputationLoading, setPullComputationLoading] = useState(false);
  const [pullComputationSubmitting, setPullComputationSubmitting] = useState(false);
  const [pullComputationKeyword, setPullComputationKeyword] = useState('');
  const [pullComputationCandidates, setPullComputationCandidates] = useState<PullDemandComputationCandidate[]>([]);
  const [selectedPullComputationId, setSelectedPullComputationId] = useState<number | null>(null);
  /** 非空表示编辑该 id 的草稿采购申请 */
  const [editingId, setEditingId] = useState<number | null>(null);
  const createFormRef = useRef<any>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  const [prTrackingRefreshKey, setPrTrackingRefreshKey] = useState(0);

  const prTracking = useDocumentTracking(
    detailVisible ? 'purchase_requisition' : undefined,
    detailVisible ? currentReq?.id : undefined,
    prTrackingRefreshKey,
  );

  const ensureSupplierList = useCallback(async (): Promise<Array<{ id: number; code?: string; name: string }>> => {
    if (supplierList.length > 0) return supplierList;
    try {
      const res: any = await supplierApi.list?.({ isActive: true, limit: 500 } as any);
      const list = Array.isArray(res) ? res : res?.data || res?.results || res?.items || [];
      setSupplierList(list);
      return list;
    } catch {
      setSupplierList([]);
      return [];
    }
  }, [supplierList]);

  const initialCreateItems = [{ ...INITIAL_PR_FORM_ITEM_ROW }];

  const appendRequisitionItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const isEmptyItemRow = (row: any) => {
        if (row == null) return true;
        if (row.material_id != null && row.material_id !== '') return false;
        const code = row.material_code;
        return code == null || String(code).trim() === '';
      };
      const rowFromMaterial = (m: Material) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        unit: m.baseUnit ?? '件',
        quantity: 1,
        suggested_unit_price: 0,
        required_date: undefined,
        demand_computation_item_id: undefined,
        supplier_id: undefined,
        notes: undefined,
      });
      const queue = selected.map(rowFromMaterial);
      const items = [...(createFormRef.current?.getFieldValue('items') ?? [])].map((row: any) => ({ ...row }));
      for (let i = 0; i < items.length && queue.length > 0; i++) {
        if (isEmptyItemRow(items[i])) {
          items[i] = queue.shift()!;
        }
      }
      while (queue.length > 0) {
        items.push(queue.shift()!);
      }
      createFormRef.current?.setFieldsValue({ items });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const handleCopyRequisitionCode = useCallback(
    (code: string) => {
      if (!code) return;
      void navigator.clipboard
        .writeText(code)
        .then(() => messageApi.success('已复制'))
        .catch(() => messageApi.error('复制失败'));
    },
    [messageApi]
  );

  const handleEdit = useCallback(
    async (record: PurchaseRequisition) => {
      const s = (record.status ?? '').toString().trim();
      if (!['草稿', 'draft', 'DRAFT'].includes(s) || record.id == null) return;
      void ensureSupplierList();
      setEditingId(record.id);
      setPreviewCode(null);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      setCreateModalVisible(true);
      try {
        const detail = await getPurchaseRequisition(record.id);
          setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_code: detail.requisition_code ?? '',
            requisition_name: detail.requisition_name,
            requisition_date: detail.requisition_date ? dayjs(detail.requisition_date) : dayjs(),
            applicant_name: detail.applicant_name ?? '',
            required_date: detail.required_date ? dayjs(detail.required_date) : undefined,
            notes: detail.notes,
            items:
              detail.items && detail.items.length > 0
                ? detail.items.map((it) => ({
                    material_id: it.material_id,
                    material_code: it.material_code ?? '',
                    material_name: it.material_name ?? '',
                    material_spec: it.material_spec ?? '',
                    unit: it.unit ?? '件',
                    quantity: Number(it.quantity ?? 1),
                    suggested_unit_price: Number(it.suggested_unit_price ?? 0),
                    required_date: it.required_date ? dayjs(it.required_date) : undefined,
                    demand_computation_item_id: it.demand_computation_item_id,
                    supplier_id: it.supplier_id,
                    notes: it.notes,
                  }))
                : [{ ...INITIAL_PR_FORM_ITEM_ROW }],
          });
        }, 0);
      } catch {
        messageApi.error('加载采购申请失败');
        setCreateModalVisible(false);
        setEditingId(null);
      }
    },
    [messageApi, ensureSupplierList]
  );

  const lifecycleValueEnum = purchaseRequestAuditEnabled
    ? {
        草稿: { text: '草稿', status: 'Default' as const },
        待审核: { text: '待审核', status: 'Processing' as const },
        已驳回: { text: '已驳回', status: 'Error' as const },
        已通过: { text: '已通过', status: 'Success' as const },
        部分转单: { text: '部分转单', status: 'Warning' as const },
        全部转单: { text: '全部转单', status: 'Success' as const },
      }
    : {
        草稿: { text: '草稿', status: 'Default' as const },
        已通过: { text: '已通过', status: 'Success' as const },
        部分转单: { text: '部分转单', status: 'Warning' as const },
        全部转单: { text: '全部转单', status: 'Success' as const },
      };

  const columns: ProColumns<PurchaseRequisition>[] = [
    // 仅高级搜索、不在表身展示；必须放在最前，避免夹在可滚动列与右侧 fixed 列之间导致固定列顺序异常
    {
      title: '要求到货',
      dataIndex: 'required_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      hideInSearch: false,
      search: {
        transform: (value: any) => {
          if (!value || !Array.isArray(value)) return {};
          const [a, b] = value;
          return {
            required_date_from: a ? dayjs(a).format('YYYY-MM-DD') : undefined,
            required_date_to: b ? dayjs(b).format('YYYY-MM-DD') : undefined,
          };
        },
      },
    },
    {
      title: '申请编号',
      dataIndex: 'requisition_code',
      width: 176,
      fixed: 'left',
      hideInSearch: false,
      render: (_, record) => {
        const code = record.requisition_code ?? '';
        return (
          <Space size={4}>
            <span>{code}</span>
            {code ? (
              <Button
                type="link"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                onClick={() => handleCopyRequisitionCode(code)}
                aria-label="复制申请编号"
              />
            ) : null}
          </Space>
        );
      },
    },
    { title: '申请名称', dataIndex: 'requisition_name', width: 180, hideInSearch: false, ellipsis: true },
    { title: '来源编码', dataIndex: 'source_code', width: 132, hideInSearch: false, ellipsis: true },
    {
      title: '来源类型',
      dataIndex: 'source_type',
      width: 120,
      hideInSearch: false,
      ellipsis: true,
      valueEnum: {
        DemandComputation: {
          text: formatPurchaseRequisitionSourceType('DemandComputation', t),
        },
      },
      render: (_, record) => formatPurchaseRequisitionSourceType(record.source_type, t),
    },
    {
      title: '要求到货日期',
      dataIndex: 'required_date',
      valueType: 'date',
      width: 120,
      hideInSearch: true,
    },
    { title: '明细数', dataIndex: 'items_count', width: 80, align: 'center', hideInSearch: true },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160, hideInSearch: true },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      valueType: 'dateTime',
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
    },
    {
      title: '生命周期',
      key: 'lifecycle',
      dataIndex: 'lifecycle',
      width: 132,
      fixed: 'right',
      align: 'center',
      hideInSearch: false,
      valueEnum: lifecycleValueEnum,
      render: (_, record) => {
        const lifecycle = getPurchaseRequisitionLifecycle(record, purchaseRequestAuditEnabled);
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
      title: '操作',
      key: 'option',
      valueType: 'option',
      width: 280,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => {
        const s = (record.status ?? '').toString().trim();
        const isDraft = ['草稿', 'draft', 'DRAFT'].includes(s);
        const parts: React.ReactNode[] = [
          <Button key="d" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
            详情
          </Button>,
        ];
        if (isDraft) {
          parts.push(
            <Button key="submit" type="link" size="small" onClick={() => handleSubmitRequisition(record)}>
              提交
            </Button>
          );
          parts.push(
            <Button key="e" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          );
        }
        parts.push(
          <span key="wf">
            <UniWorkflowActions
              record={record}
              entityName="采购申请"
              statusField="status"
              reviewStatusField="review_status"
              draftStatuses={['草稿', 'draft', 'DRAFT']}
              pendingStatuses={['待审核', 'pending_review', 'PENDING_REVIEW']}
              approvedStatuses={['已通过', '已审核', '部分转单', '全部转单', 'audited', 'approved', 'AUDITED', 'PARTIAL_CONVERTED', 'FULL_CONVERTED']}
              rejectedStatuses={['已驳回', 'rejected', 'REJECTED']}
              theme="link"
              size="small"
              confirmMessages={{ revoke: '撤回后状态将变为待审核，可重新提交审核。' }}
              workflowAuditEnabled={purchaseRequestAuditEnabled}
              hideAuditActionsWhenDisabled={true}
              actions={{
                approve: (id) => approvePurchaseRequisition(id, { approved: true, review_remarks: '' }),
                reject: (id, reason) => approvePurchaseRequisition(id, { approved: false, review_remarks: reason || '' }),
                revoke: (id) => withdrawPurchaseRequisition(id),
              }}
              onSuccess={() => actionRef.current?.reload()}
            />
          </span>
        );
        if (isDraft) {
          parts.push(
            <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteOne(record)}>
              删除
            </Button>
          );
        }
        return renderPurchaseRequisitionRowActions(parts, `pr-${record.id ?? 'row'}`);
      },
    },
  ];

  /** 参考销售订单：先打开弹窗，再请求 getCodeRulePageConfig + testGenerateCode 预填编号 */
  const handleCreate = async () => {
    void ensureSupplierList();
    setEditingId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    setCreateModalVisible(true);
    createFormRef.current?.resetFields();
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-purchase-requisition');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-purchase-requisition');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-purchase-requisition');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        try {
          const res = await testGenerateCode({ rule_code: ruleCode });
          const preview = res.code;
          setPreviewCode(preview ?? null);
          setTimeout(() => {
            createFormRef.current?.setFieldsValue({
              requisition_code: preview ?? '',
              requisition_date: dayjs(),
              items: initialCreateItems,
            });
          }, 100);
        } catch (e) {
          console.warn('采购申请编号预生成失败:', e);
          setPreviewCode(null);
          setTimeout(() => {
            createFormRef.current?.setFieldsValue({
              requisition_date: dayjs(),
              items: initialCreateItems,
            });
          }, 100);
        }
      } else {
        setPreviewCode(null);
        setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        }, 100);
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-purchase-requisition');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-purchase-requisition'));
      if (isAutoGenerateEnabled('kuaizhizao-purchase-requisition') && ruleCode) {
        testGenerateCode({ rule_code: ruleCode })
          .then((res) => {
            const preview = res.code;
            setPreviewCode(preview ?? null);
            setTimeout(() => {
              createFormRef.current?.setFieldsValue({
                requisition_code: preview ?? '',
                requisition_date: dayjs(),
                items: initialCreateItems,
              });
            }, 100);
          })
          .catch((e) => {
            console.warn('采购申请编号预生成失败:', e);
            setPreviewCode(null);
            setTimeout(() => {
              createFormRef.current?.setFieldsValue({
                requisition_date: dayjs(),
                items: initialCreateItems,
              });
            }, 100);
          });
      } else {
        setPreviewCode(null);
        setTimeout(() => {
          createFormRef.current?.setFieldsValue({
            requisition_date: dayjs(),
            items: initialCreateItems,
          });
        }, 100);
      }
    }
  };

  const loadPullComputationCandidates = useCallback(
    async (keyword: string = '') => {
      setPullComputationLoading(true);
      try {
        const kw = keyword.trim();
        const listRes = await listDemandComputations({
          skip: 0,
          limit: 50,
          computation_status: '完成',
          computation_code: kw || undefined,
        });
        const rows = listRes?.data || [];
        const candidates = await Promise.all(
          rows
            .filter((row) => row.id != null)
            .map(async (row) => {
              let hasPurchaseItems = true;
              let canPushRequisition = true;
              let disabledReason: string | undefined;
              try {
                const options = await getPushOptions(row.id!);
                hasPurchaseItems = !!options.has_purchase_items;
                canPushRequisition = hasPurchaseItems && (options.purchase_choices || []).includes('requisition');
                if (!hasPurchaseItems) {
                  disabledReason = '无可转采购明细';
                } else if (!canPushRequisition) {
                  disabledReason = '采购申请已生成或当前不可转';
                }
              } catch {
                // 能力探测失败时保持可选，由后端最终校验
              }

              return {
                id: row.id!,
                computation_code: row.computation_code,
                business_mode: row.business_mode,
                computation_status: row.computation_status,
                created_at: row.created_at,
                updated_at: row.updated_at,
                has_purchase_items: hasPurchaseItems,
                can_push_requisition: canPushRequisition,
                disabled_reason: disabledReason,
              } as PullDemandComputationCandidate;
            }),
        );
        setPullComputationCandidates(candidates);
      } finally {
        setPullComputationLoading(false);
      }
    },
    [],
  );

  const handlePullFromComputation = useCallback(async () => {
    setPullFromComputationVisible(true);
    setPullComputationKeyword('');
    setSelectedPullComputationId(null);
    await loadPullComputationCandidates('');
  }, [loadPullComputationCandidates]);

  const handlePullFromComputationConfirm = useCallback(async () => {
    if (!selectedPullComputationId) {
      messageApi.warning('请选择需求运算单');
      return;
    }
    const selected = pullComputationCandidates.find((i) => i.id === selectedPullComputationId);
    if (selected && selected.can_push_requisition === false) {
      messageApi.warning(selected.disabled_reason || '该需求运算单当前不可用于创建采购申请');
      return;
    }

    setPullComputationSubmitting(true);
    try {
      const res = await pushToPurchaseRequisition(selectedPullComputationId);
      messageApi.success(res?.message || '已从需求运算创建采购申请');
      setPullFromComputationVisible(false);
      setSelectedPullComputationId(null);
      actionRef.current?.reload();
      invalidateMenuBadgeCounts();
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || '从需求运算创建采购申请失败');
    } finally {
      setPullComputationSubmitting(false);
    }
  }, [actionRef, invalidateMenuBadgeCounts, messageApi, pullComputationCandidates, selectedPullComputationId]);

  const mapItemsForApi = (
    validItems: Array<{
      material_id?: number;
      material_code?: string;
      material_name?: string;
      material_spec?: string;
      unit?: string;
      quantity?: number;
      suggested_unit_price?: number;
      required_date?: any;
      demand_computation_item_id?: number;
      supplier_id?: number;
      notes?: string;
    }>
  ) =>
    validItems.map((i) => ({
      material_id: i.material_id!,
      material_code: i.material_code || '',
      material_name: i.material_name || '',
      material_spec: i.material_spec,
      unit: i.unit || '件',
      quantity: Number(i.quantity) || 0,
      suggested_unit_price: Number(i.suggested_unit_price) || 0,
      required_date: i.required_date?.format?.('YYYY-MM-DD') ?? i.required_date ?? undefined,
      demand_computation_item_id: i.demand_computation_item_id,
      supplier_id: i.supplier_id ?? undefined,
      notes: typeof i.notes === 'string' && i.notes.trim() ? i.notes.trim() : undefined,
    }));

  const handleModalSubmit = async (values: {
    requisition_code?: string;
    requisition_name?: string;
    requisition_date?: any;
    required_date?: any;
    notes?: string;
    items?: Array<{
      material_id?: number;
      material_code?: string;
      material_name?: string;
      material_spec?: string;
      unit?: string;
      quantity?: number;
      suggested_unit_price?: number;
      required_date?: any;
      demand_computation_item_id?: number;
      supplier_id?: number;
      notes?: string;
    }>;
  }) => {
    const requisitionDate =
      values.requisition_date?.format?.('YYYY-MM-DD') ?? values.requisition_date ?? undefined;
    const requiredDate = values.required_date?.format?.('YYYY-MM-DD') ?? values.required_date;
    const validItems = (values.items ?? []).filter((i) => i.material_id && (Number(i.quantity) || 0) > 0);
    if (validItems.length === 0) {
      messageApi.error('请至少添加一条有效的申请明细');
      return;
    }
    if (editingId != null) {
      try {
        await updatePurchaseRequisition(editingId, {
          requisition_name: values.requisition_name,
          requisition_date: requisitionDate,
          required_date: requiredDate,
          notes: values.notes,
          items: mapItemsForApi(validItems),
        });
        messageApi.success('保存成功');
        setCreateModalVisible(false);
        setEditingId(null);
        setEffectiveRuleCode(null);
        setEffectiveAutoGen(null);
        createFormRef.current?.resetFields();
        invalidateMenuBadgeCounts();

        actionRef.current?.reload();
      } catch (e: any) {
        const d = e?.response?.data?.detail;
        messageApi.error(typeof d === 'string' ? d : d?.message || '保存失败');
        throw e;
      }
      return;
    }
    let requisitionCode = values.requisition_code;
    const ruleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-purchase-requisition');
    const autoGen = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-purchase-requisition');
    if (autoGen && ruleCode && (requisitionCode === previewCode || !requisitionCode)) {
      try {
        const res = await generateCode({ rule_code: ruleCode });
        requisitionCode = res.code;
      } catch (e) {
        console.warn('采购申请编号正式生成失败，使用当前值:', e);
      }
    }
    try {
      await createPurchaseRequisition({
        requisition_code: requisitionCode || undefined,
        requisition_name: values.requisition_name,
        requisition_date: requisitionDate,
        required_date: requiredDate,
        notes: values.notes,
        items: mapItemsForApi(validItems),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      createFormRef.current?.resetFields();
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      messageApi.error(typeof d === 'string' ? d : d?.message || '创建失败');
      throw e;
    }
  };

  const handleDetail = async (record: PurchaseRequisition) => {
    try {
      void ensureSupplierList();
      const detail = await getPurchaseRequisition(record.id!);
      void prefetchMaterialsForUnitSelect((detail.items ?? []).map((i) => i.material_id));
      setCurrentReq(detail);
      setDetailVisible(true);
      setPrTrackingRefreshKey((k) => k + 1);
    } catch {
      messageApi.error('获取详情失败');
    }
  };

  const handleSubmitRequisition = (record: PurchaseRequisition) => {
    if (!record.id) return;
    modalApi.confirm({
      title: '提交采购申请',
      content: purchaseRequestAuditEnabled ? '提交后将进入审核流程，是否继续？' : '提交后将直接生效（无需审核），是否继续？',
      onOk: async () => {
        try {
          await submitPurchaseRequisition(record.id!);
          messageApi.success('提交成功');
          invalidateMenuBadgeCounts();
          actionRef.current?.reload();
          if (currentReq?.id === record.id) {
            const refreshed = await getPurchaseRequisition(record.id!);
            setCurrentReq(refreshed);
          }
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || '提交失败');
        }
      },
    });
  };

  // handleSubmit removed as it is redundant with UniWorkflowActions

  const convertFormRef = React.useRef<{
    selectedIds: number[];
    supplierId: number;
    supplierName: string;
    itemQuantities: Record<number, number>;
    itemSuppliers: Record<number, number>;
    persistDefaultSupplier: boolean;
  }>({
    selectedIds: [],
    supplierId: 0,
    supplierName: '',
    itemQuantities: {},
    itemSuppliers: {},
    persistDefaultSupplier: false,
  });

  const selectedRequisitionForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return lastRequisitionsCacheRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const canUseToolbarPush = selectedRequisitionForToolbar
    ? canPushPurchaseRequisition(selectedRequisitionForToolbar)
    : false;

  const handleConvert = async (record: PurchaseRequisition) => {
    try {
      const suppliers = await ensureSupplierList();
      if (!suppliers.length) {
        messageApi.warning('请先维护供应商档案，才能下推采购单');
        return;
      }
      const detail = await getPurchaseRequisition(record.id!);
      const allItems = detail.items || [];
      const unconverted = allItems.filter((i) => !i.purchase_order_id);
      if (unconverted.length === 0) {
        messageApi.info('无可下推的明细，所有明细已转采购单');
        return;
      }
      const defaultSupplierId = unconverted[0]?.supplier_id || suppliers[0]?.id;
      const quantities: Record<number, number> = {};
      unconverted.forEach((i) => {
        if (i.id != null) quantities[i.id] = Number(i.quantity ?? 0);
      });
      convertFormRef.current = {
        selectedIds: unconverted.map((i) => i.id!).filter(Boolean),
        supplierId: defaultSupplierId || 0,
        supplierName: suppliers.find((s) => s.id === defaultSupplierId)?.name || suppliers[0]?.name || '',
        itemQuantities: quantities,
        itemSuppliers: {},
        persistDefaultSupplier: false,
      };

      modalApi.confirm({
        title: '下推采购单',
        icon: null,
        width: MODAL_CONFIG.EXTRA_LARGE_WIDTH,
        content: (
          <ConvertForm
            items={allItems}
            unconvertedIds={unconverted.map((i) => i.id!).filter(Boolean)}
            suppliers={suppliers}
            formRef={convertFormRef}
          />
        ),
        onOk: async () => {
          const {
            selectedIds,
            supplierId,
            supplierName,
            itemQuantities,
            itemSuppliers,
            persistDefaultSupplier,
          } = convertFormRef.current;
          if (selectedIds.length === 0) {
            messageApi.error('请选择要下推的明细');
            return Promise.reject();
          }
          const missing = selectedIds.some((id) => !itemSuppliers[id]);
          if (missing) {
            messageApi.error('请为每条选中明细选择供应商');
            return Promise.reject();
          }
          try {
            const res = await convertToPurchaseOrder(record.id!, {
              item_ids: selectedIds,
              supplier_id: supplierId || undefined,
              supplier_name: supplierName || undefined,
              item_quantities: itemQuantities,
              item_suppliers: Object.fromEntries(selectedIds.map((id) => [id, itemSuppliers[id]])),
              persist_default_supplier_to_material: persistDefaultSupplier,
            });
            const pos = res.purchase_orders?.length
              ? res.purchase_orders
              : [{ purchase_order_id: res.purchase_order_id, purchase_order_code: res.purchase_order_code, supplier_id: supplierId }];
            messageApi.success({
              content: (
                <span>
                  {res.message || '下推成功'}
                  {pos.map((p) => (
                    <Button
                      key={p.purchase_order_id}
                      type="link"
                      size="small"
                      style={{ paddingLeft: 8 }}
                      onClick={() => navigate(ROUTES.PURCHASE_ORDERS)}
                    >
                      查看 {p.purchase_order_code}
                    </Button>
                  ))}
                </span>
              ),
              duration: 6,
            });
            invalidateMenuBadgeCounts();

            actionRef.current?.reload();
          } catch (e: any) {
            messageApi.error(e?.response?.data?.detail || '下推失败');
            return Promise.reject();
          }
        },
      });
    } catch {
      messageApi.error('加载详情失败');
    }
  };

  /** 协调看板深链：requisitionId + action=pushPO */
  useEffect(() => {
    const requisitionIdRaw = searchParams.get('requisitionId');
    if (!requisitionIdRaw) return;

    const action = searchParams.get('action');
    const linkKey = `${requisitionIdRaw}:${action ?? ''}`;
    if (deepLinkHandledRef.current === linkKey) return;

    const requisitionId = Number(requisitionIdRaw);
    if (Number.isNaN(requisitionId) || requisitionId <= 0) return;

    deepLinkHandledRef.current = linkKey;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('requisitionId');
    nextParams.delete('action');
    const nextSearch = nextParams.toString();
    navigate(
      { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
      { replace: true },
    );

    if (action === 'pushPO') {
      setSelectedRowKeys([requisitionId]);
      void (async () => {
        try {
          await ensureSupplierList();
          const detail = await getPurchaseRequisition(requisitionId);
          void prefetchMaterialsForUnitSelect((detail.items ?? []).map((i) => i.material_id));
          setCurrentReq(detail);
          await handleConvert({ ...detail, id: requisitionId });
        } catch {
          messageApi.error('打开采购申请失败');
        }
      })();
      return;
    }

    void (async () => {
      try {
        const detail = await getPurchaseRequisition(requisitionId);
        void prefetchMaterialsForUnitSelect((detail.items ?? []).map((i) => i.material_id));
        setCurrentReq(detail);
        setDetailVisible(true);
        setPrTrackingRefreshKey((k) => k + 1);
      } catch {
        messageApi.error('打开采购申请失败');
        deepLinkHandledRef.current = null;
      }
    })();
  }, [searchParams, location.pathname, navigate, messageApi, ensureSupplierList]);

  const toolbarPushMenuItems = useMemo(
    () =>
      selectedRequisitionForToolbar && canUseToolbarPush
        ? buildUniPushMenuItems([
            {
              key: 'push-purchase-order',
              label: '下推采购单',
              icon: <SwapOutlined />,
              onClick: () => {
                void handleConvert(selectedRequisitionForToolbar);
              },
            },
          ])
        : [],
    [selectedRequisitionForToolbar, canUseToolbarPush],
  );

  const handleDeleteOne = (record: PurchaseRequisition) => {
    if (record.status !== '草稿') return;
    modalApi.confirm({
      title: '确认删除',
      content: `确定要删除采购申请 ${record.requisition_code} 吗？`,
      onOk: async () => {
        try {
          await deletePurchaseRequisition(record.id!);
          messageApi.success('删除成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="采购申请"
          columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-requisitions"
          actionRef={actionRef}
          request={async (params: any, _sort: any, _filter: any, searchFormValues?: Record<string, any>) => {
            const s = searchFormValues || {};
            const res = await listPurchaseRequisitions({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              status: s.lifecycle ?? s.status ?? params.lifecycle ?? params.status,
              source_type: s.source_type,
              keyword: s.keyword,
              requisition_code: s.requisition_code,
              requisition_name: s.requisition_name,
              required_date_from: s.required_date_from,
              required_date_to: s.required_date_to,
            });
            lastRequisitionsCacheRef.current = res.data || [];
            return {
              data: res.data || [],
              total: res.total || 0,
              success: res.success ?? true,
            };
          }}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          columns={columns}
          rowKey="id"
          showAdvancedSearch={true}
          search={false}
          showCreateButton={false}
          createButtonText="新建采购申请"
          onCreate={handleCreate}
          toolBarRender={() => [
            <Space.Compact key="create-purchase-requisition-with-pull">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                新建采购申请
              </Button>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'pull-from-demand-computation',
                      label: '从需求运算创建采购申请',
                      onClick: () => {
                        void handlePullFromComputation();
                      },
                    },
                  ],
                }}
              >
                <Button type="primary" icon={<DownOutlined />} />
              </Dropdown>
            </Space.Compact>,
            <UniPushToolbarButton
              key={`purchase-requisition-push-${selectedRequisitionForToolbar?.id ?? 'none'}`}
              menuItems={toolbarPushMenuItems}
              disabled={!selectedRequisitionForToolbar || !canUseToolbarPush}
            />,
          ]}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            modalApi.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条采购申请吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await deletePurchaseRequisition(Number(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  invalidateMenuBadgeCounts();

                  actionRef.current?.reload();
                } catch (e: any) {
                  messageApi.error(e?.response?.data?.detail || '删除失败');
                }
              },
            });
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listPurchaseRequisitions({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d: PurchaseRequisition) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              downloadFile(blob, `purchase-requisitions-${new Date().toISOString().slice(0, 10)}.json`);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
        />
      </ListPageTemplate>

      <Modal
        title="从需求运算创建采购申请"
        open={pullFromComputationVisible}
        width={1280}
        onCancel={() => {
          if (pullComputationSubmitting) return;
          setPullFromComputationVisible(false);
          setSelectedPullComputationId(null);
        }}
        onOk={() => {
          void handlePullFromComputationConfirm();
        }}
        okText="创建采购申请"
        confirmLoading={pullComputationSubmitting}
        destroyOnClose
      >
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Input.Search
            allowClear
            placeholder="按运算单号搜索"
            value={pullComputationKeyword}
            onChange={(e) => setPullComputationKeyword(e.target.value)}
            onSearch={(value) => {
              setPullComputationKeyword(value);
              void loadPullComputationCandidates(value);
            }}
            enterButton="搜索"
          />
          <Table<PullDemandComputationCandidate>
            rowKey="id"
            loading={pullComputationLoading}
            dataSource={pullComputationCandidates}
            pagination={false}
            scroll={{ x: 1100, y: 360 }}
            rowSelection={{
              type: 'radio',
              selectedRowKeys: selectedPullComputationId ? [selectedPullComputationId] : [],
              onChange: (keys) => {
                const next = Number(keys?.[0]);
                if (Number.isFinite(next)) {
                  setSelectedPullComputationId(next);
                } else {
                  setSelectedPullComputationId(null);
                }
              },
              getCheckboxProps: (record) => ({
                disabled: record.can_push_requisition === false,
              }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.can_push_requisition === false) return;
                setSelectedPullComputationId(record.id);
              },
            })}
            columns={[
              { title: '运算单号', dataIndex: 'computation_code', width: 220, ellipsis: true },
              { title: '业务模式', dataIndex: 'business_mode', width: 110, align: 'center' },
              { title: '运算状态', dataIndex: 'computation_status', width: 110, align: 'center' },
              {
                title: '创建时间',
                dataIndex: 'created_at',
                width: 180,
                render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
              },
              {
                title: '更新时间',
                dataIndex: 'updated_at',
                width: 180,
                render: (v) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
              },
              {
                title: '转单状态',
                key: 'convert_status',
                width: 180,
                align: 'center',
                render: (_, record) =>
                  record.can_push_requisition === false ? (
                    <Tag color="gold">{record.disabled_reason || '不可创建'}</Tag>
                  ) : (
                    <Tag color="success">可创建</Tag>
                  ),
              },
            ]}
          />
        </Space>
      </Modal>

      <FormModalTemplate
        title={editingId != null ? '编辑采购申请' : '新建采购申请'}
        open={createModalVisible}
        isEdit={editingId != null}
        onClose={() => {
          setCreateModalVisible(false);
          setEditingId(null);
          setEffectiveRuleCode(null);
          setEffectiveAutoGen(null);
        }}
        onFinish={handleModalSubmit}
        formRef={createFormRef}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        grid={false}
        initialValues={{ items: initialCreateItems }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="requisition_code"
              label="采购申请编号"
              disabled={editingId != null}
              placeholder={
                editingId != null
                  ? '草稿保存后不可修改编号'
                  : isAutoGenerateEnabled('kuaizhizao-purchase-requisition')
                    ? '编号将根据编号规则自动生成，可修改'
                    : '请输入采购申请编号'
              }
              rules={[{ required: true, message: '请输入采购申请编号' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="requisition_name" label="申请名称" placeholder="请输入申请名称" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="requisition_date"
              label="申请日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="required_date"
              label="要求到货日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            {editingId != null ? (
              <ProFormText name="applicant_name" label="申请人" disabled />
            ) : (
              <AntForm.Item label="申请人">
                <Typography.Text>{currentUser?.full_name || currentUser?.username || '—'}</Typography.Text>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    保存后写入为当前登录用户
                  </Typography.Text>
                </div>
              </AntForm.Item>
            )}
          </Col>
          <Col span={12} />
        </Row>
        {/* 申请明细：与销售订单 Modal 同款 — AntForm.List + Table + 内联样式 + 操作列 fixed right */}
        <div className="uni-table-detail" style={{ marginBottom: 24, width: '100%' }}>
          <UniTableDetailHeader title="申请明细" required />
          <AntForm.Item
            name="items"
            noStyle
            rules={[{ type: 'array', min: 1, message: '请至少添加一条申请明细' }]}
          >
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const prDetailColumns = [
                  {
                    title: '物料',
                    dataIndex: 'material_id',
                    width: 220,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}
                      >
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback =
                            mid && (row?.material_code || row?.material_name)
                              ? {
                                  value: mid,
                                  label:
                                    `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
                                }
                              : undefined;
                          return (
                            <>
                              <div
                                className="purchase-requisition-material-cell"
                                style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}
                              >
                                <div style={{ flex: 1, minWidth: 200 }}>
                                  <UniMaterialSelect
                                    name={[index, 'material_id']}
                                    label=""
                                    placeholder="请选择物料"
                                    required
                                    size="small"
                                    listFieldKey={index}
                                    listFieldName="items"
                                    fillMapping={{
                                      material_code: 'mainCode',
                                      material_name: 'name',
                                      material_spec: 'specification',
                                      unit: 'baseUnit',
                                    }}
                                    fallbackOption={fallback}
                                    formItemProps={{ style: { margin: 0 } }}
                                    showQuickCreate
                                    showAdvancedSearch
                                  />
                                </div>
                              </div>
                              <AntForm.Item name={[index, 'demand_computation_item_id']} hidden>
                                <Input type="hidden" />
                              </AntForm.Item>
                            </>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '规格',
                    dataIndex: 'material_spec',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                        <Input placeholder="规格" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '单位',
                    dataIndex: 'unit',
                    width: 100,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                        }
                      >
                        {({ getFieldValue }) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          return (
                            <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
                              <MaterialUnitSelect materialId={materialId} size="small" noStyle />
                            </AntForm.Item>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        name={[index, 'quantity']}
                        rules={[
                          { required: true, message: '必填' },
                          { type: 'number', min: 0.01, message: '>0' },
                        ]}
                        style={{ margin: 0 }}
                      >
                        <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '建议单价',
                    dataIndex: 'suggested_unit_price',
                    width: 130,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item
                        noStyle
                        shouldUpdate={(prev: any, curr: any) =>
                          prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id
                        }
                      >
                        {({ getFieldValue }: any) => {
                          const materialId = getFieldValue(['items', index, 'material_id']);
                          const price = getFieldValue(['items', index, 'suggested_unit_price']);
                          return (
                            <Space size={4}>
                              <AntForm.Item name={[index, 'suggested_unit_price']} style={{ margin: 0 }}>
                                <InputNumber placeholder="0" min={0} precision={2} style={{ width: 80 }} size="small" />
                              </AntForm.Item>
                              {materialId && <PriceHistoryInsight materialId={materialId} currentPrice={price} />}
                            </Space>
                          );
                        }}
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '建议供应商',
                    dataIndex: 'supplier_id',
                    width: 160,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'supplier_id']} style={{ margin: 0 }}>
                        <Select
                          allowClear
                          placeholder="可选"
                          size="small"
                          style={{ width: '100%' }}
                          options={supplierList.map((s) => ({ label: s.name, value: s.id }))}
                        />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '行到货日',
                    dataIndex: 'required_date',
                    width: 118,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'required_date']} style={{ margin: 0 }}>
                        <DatePicker size="small" style={{ width: '100%' }} placeholder="可选" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '行备注',
                    dataIndex: 'notes',
                    width: 120,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'notes']} style={{ margin: 0 }}>
                        <Input placeholder="备注" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '操作',
                    width: 70,
                    fixed: 'right' as const,
                    onHeaderCell: () => ({ className: 'purchase-requisition-fixed-op-header' }),
                    render: (_: any, __: any, index: number) => (
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        disabled={fields.length <= 1}
                        onClick={() => remove(index)}
                      >
                        删除
                      </Button>
                    ),
                  },
                ];
                const totalWidth = prDetailColumns.reduce((s, c) => s + (Number(c.width) || 0), 0);
                return (
                  <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <style>{`
                      .purchase-requisition-detail-table .ant-table-thead > tr > th {
                        background-color: var(--ant-color-fill-alter) !important;
                        font-weight: 600;
                      }
                      .purchase-requisition-detail-table .ant-table-thead > tr > th.purchase-requisition-fixed-op-header {
                        background: var(--ant-color-fill-alter) !important;
                      }
                      .purchase-requisition-detail-table .ant-table-cell-fix-right {
                        background: var(--ant-color-bg-container) !important;
                      }
                      .purchase-requisition-detail-table .ant-table {
                        border-top: 1px solid var(--ant-color-border);
                      }
                      .purchase-requisition-detail-table .ant-table-tbody > tr > td {
                        border-bottom: 1px solid var(--ant-color-border);
                        overflow: visible !important;
                      }
                      .purchase-requisition-detail-table .purchase-requisition-material-cell .ant-form-item,
                      .purchase-requisition-detail-table .purchase-requisition-material-cell .ant-form-item-control,
                      .purchase-requisition-detail-table .purchase-requisition-material-cell .ant-form-item-control-input,
                      .purchase-requisition-detail-table .purchase-requisition-material-cell .ant-select {
                        width: 100% !important;
                        min-width: 0;
                      }
                      .purchase-requisition-detail-table .ant-form-item-explain,
                      .purchase-requisition-detail-table .ant-form-item-explain-error {
                        display: none !important;
                      }
                      .purchase-requisition-detail-table .ant-input-number-input::selection,
                      .purchase-requisition-detail-table .ant-input::selection {
                        background-color: var(--ant-color-primary);
                        color: #fff;
                        border-radius: 0;
                      }
                    `}</style>
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                      <Table
                        className="purchase-requisition-detail-table"
                        size="small"
                        dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                        rowKey="key"
                        pagination={false}
                        columns={prDetailColumns}
                        scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                        style={{ width: '100%', margin: 0 }}
                        footer={() => (
                          <div
                            style={{
                              display: 'flex',
                              gap: 8,
                              width: '100%',
                              flexWrap: 'wrap',
                              boxSizing: 'border-box',
                            }}
                          >
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              style={{ flex: 1, minWidth: 120 }}
                              onClick={() => add({ ...INITIAL_PR_FORM_ITEM_ROW })}
                            >
                              添加明细
                            </Button>
                            <Button
                              type="default"
                              icon={<AppstoreAddOutlined />}
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
        <ProFormTextArea name="notes" label="备注" placeholder="备注" />
        <UniMaterialBatchPicker
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={appendRequisitionItemsFromMaterials}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`采购申请详情 - ${currentReq?.requisition_code || ''}`}
        open={detailVisible}
        zIndex={prqDetailDrawerZIndex}
        onClose={() => {
          setDetailVisible(false);
          setCurrentReq(null);
        }}
        dataSource={currentReq || undefined}
        columns={[]}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentReq && (
            <DetailDrawerActions
              items={[
                {
                  key: 'edit',
                  visible: ['草稿', 'draft', 'DRAFT'].includes((currentReq.status ?? '').toString().trim()),
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => {
                        const r = currentReq;
                        setDetailVisible(false);
                        if (r) void handleEdit(r);
                      }}
                    >
                      编辑
                    </Button>
                  ),
                },
                {
                  key: 'submit',
                  visible: ['草稿', 'draft', 'DRAFT'].includes((currentReq.status ?? '').toString().trim()),
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => currentReq && handleSubmitRequisition(currentReq)}
                    >
                      提交
                    </Button>
                  ),
                },
                { key: 'workflow', visible: true, render: () => (
                  <UniWorkflowActions
                    record={currentReq}
                    entityName="采购申请"
                    statusField="status"
                    reviewStatusField="review_status"
                    draftStatuses={['草稿', 'draft']}
                    pendingStatuses={['待审核', 'pending_review']}
                    approvedStatuses={['已通过', '已审核', '部分转单', '全部转单', 'audited', 'approved']}
                    rejectedStatuses={['已驳回', 'rejected']}
                    theme="default"
                    size="small"
                    confirmMessages={{ revoke: '撤回后状态将变为待审核，可重新提交审核。' }}
                    actions={{
                      approve: (id) => approvePurchaseRequisition(id, { approved: true, review_remarks: '' }),
                      reject: (id, reason) => approvePurchaseRequisition(id, { approved: false, review_remarks: reason || '' }),
                      revoke: (id) => withdrawPurchaseRequisition(id),
                    }}
                    workflowAuditEnabled={purchaseRequestAuditEnabled}
                    hideAuditActionsWhenDisabled={true}
                    onSuccess={async () => {
                      invalidateMenuBadgeCounts();

                      actionRef.current?.reload();
                      setPrTrackingRefreshKey((k) => k + 1);
                      if (currentReq?.id) {
                        try {
                          const res = await getPurchaseRequisition(currentReq.id);
                          setCurrentReq(res);
                        } catch { /* ignore */ }
                      }
                    }}
                  />
                ) },
                {
                  key: 'convert',
                  visible: canPushPurchaseRequisition(currentReq),
                  render: () => (
                    <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvert(currentReq)}>
                      下推采购单
                    </Button>
                  ),
                },
                {
                  key: 'fixStatus',
                  visible: ['全部转单', 'FULL_CONVERTED'].includes(currentReq.status ?? ''),
                  render: () => (
                    <Button
                      type="link"
                      size="small"
                      onClick={async () => {
                        if (!currentReq?.id) return;
                        try {
                          const res = await fixPurchaseRequisitionStatus(currentReq.id);
                          setCurrentReq(res);
                          setPrTrackingRefreshKey((k) => k + 1);
                          invalidateMenuBadgeCounts();

                          actionRef.current?.reload();
                          messageApi.success('状态已修正为部分转单');
                        } catch (e: any) {
                          messageApi.error(e?.response?.data?.detail || '修正失败');
                        }
                      }}
                    >
                      修正状态
                    </Button>
                  ),
                },
              ]}
            />
          )
        }
        customContent={
          currentReq && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={(() => {
                    const lc = getPurchaseRequisitionLifecycle(currentReq, purchaseRequestAuditEnabled);
                    const stageName = lc.stageName ?? currentReq.status ?? '草稿';
                    const fmtDate = (v: string | undefined) => (v ? dayjs(v).format('YYYY-MM-DD') : '-');
                    const fmtDt = (v: string | undefined) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-');
                    return [
                      {
                        key: 'code',
                        label: '申请编号',
                        children: (
                          <Space size={4}>
                            <span>{currentReq.requisition_code ?? '-'}</span>
                            {currentReq.requisition_code ? (
                              <Button
                                type="link"
                                size="small"
                                icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                onClick={() => handleCopyRequisitionCode(currentReq.requisition_code!)}
                                aria-label="复制申请编号"
                              />
                            ) : null}
                          </Space>
                        ),
                      },
                      { key: 'name', label: '申请名称', children: currentReq.requisition_name ?? '-' },
                      {
                        key: 'status',
                        label: '状态',
                        children: <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{stageName}</Tag>,
                      },
                      { key: 'src', label: '来源编码', children: currentReq.source_code ?? '-' },
                      {
                        key: 'stype',
                        label: '来源类型',
                        children: formatPurchaseRequisitionSourceType(currentReq.source_type, t),
                      },
                      { key: 'reqd', label: '要求到货日期', children: fmtDate(currentReq.required_date) },
                      {
                        key: 'notes',
                        label: '备注',
                        span: 3,
                        children: currentReq.notes?.trim() ? currentReq.notes : '-',
                      },
                      { key: 'rd', label: '申请日期', children: fmtDate(currentReq.requisition_date) },
                      { key: 'applicant', label: '申请人', children: currentReq.applicant_name ?? '-' },
                      { key: 'cat', label: '创建时间', children: fmtDt(currentReq.created_at) },
                      { key: 'uat', label: '更新时间', children: fmtDt(currentReq.updated_at) },
                    ];
                  })()}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getPurchaseRequisitionLifecycle(currentReq, purchaseRequestAuditEnabled);
                    const mainStages = lifecycle.mainStages ?? [];
                    return (
                      <>
                        {mainStages.length > 0 && (
                          <UniLifecycleStepper
                            steps={mainStages}
                            status={lifecycle.status}
                            showLabels
                            nextStepSuggestions={lifecycle.nextStepSuggestions}
                            hideNextStepSuggestions
                          />
                        )}
                      </>
                    );
                  })()}
                  {currentReq.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType="purchase_requisition"
                      documentId={currentReq.id}
                      active={detailVisible}
                      selfDocumentId={currentReq.id}
                      renderBriefActions={(doc) => (
                        <WarehouseTraceBriefPrimaryActions
                          doc={doc}
                          t={t}
                          navigate={navigate}
                          closeDrawer={() => {
                            setDetailVisible(false);
                            setCurrentReq(null);
                          }}
                        />
                      )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <style>{`
                  .purchase-requisition-detail-drawer-items .ant-table-wrapper .ant-table-body,
                  .purchase-requisition-detail-drawer-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                `}</style>
                {currentReq.items && currentReq.items.length > 0 ? (
                  <div
                    className="purchase-requisition-detail-drawer-items"
                    style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                  >
                    <Table
                      size="small"
                      rowKey="id"
                      tableLayout="fixed"
                      style={{ minWidth: PURCHASE_REQUISITION_DETAIL_ITEMS_MIN_WIDTH }}
                      pagination={false}
                      dataSource={currentReq.items}
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120, ellipsis: true },
                        { title: '物料名称', dataIndex: 'material_name', width: 160, ellipsis: true },
                        { title: '规格', dataIndex: 'material_spec', width: 120, ellipsis: true },
                        { title: '数量', dataIndex: 'quantity', width: 88, align: 'right' },
                        {
                          title: '单位',
                          dataIndex: 'unit',
                          width: 100,
                          ellipsis: true,
                          render: (_: unknown, record: PurchaseRequisitionItem) => (
                            <MaterialUnitSelect
                              materialId={record.material_id}
                              value={record.unit}
                              disabled
                              size="small"
                              noStyle
                            />
                          ),
                        },
                        {
                          title: '建议单价',
                          dataIndex: 'suggested_unit_price',
                          width: 140,
                          align: 'right',
                          render: (v: number, record: PurchaseRequisitionItem) => (
                            <Space size={4}>
                              ¥{Number(v || 0).toFixed(2)}
                              {record.material_id ? (
                                <PriceHistoryInsight materialId={record.material_id} currentPrice={v} />
                              ) : null}
                            </Space>
                          ),
                        },
                        {
                          title: '要求到货日期',
                          dataIndex: 'required_date',
                          width: 120,
                          ellipsis: true,
                          render: (v: string | undefined) => (v ? dayjs(v).format('YYYY-MM-DD') : '-'),
                        },
                        {
                          title: '已转单',
                          dataIndex: 'purchase_order_id',
                          width: 80,
                          render: (v: number | undefined) => (v ? <Tag color="success">是</Tag> : <Tag>否</Tag>),
                        },
                      ]}
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              {currentReq.id != null && (
                <DetailDrawerSection title="操作记录">
                  {prTracking.loading && (
                    <div style={{ textAlign: 'center', padding: 24 }}>
                      <Spin />
                    </div>
                  )}
                  {prTracking.error && !prTracking.loading && (
                    <Typography.Text type="danger">{prTracking.error}</Typography.Text>
                  )}
                  {prTracking.data && !prTracking.loading && (
                    <DocumentTrackingTimelineBody data={prTracking.data} />
                  )}
                </DetailDrawerSection>
              )}
            </>
          )
        }
      />
    </>
  );
};

const ConvertForm: React.FC<{
  items: PurchaseRequisitionItem[];
  unconvertedIds: number[];
  suppliers: Array<{ id: number; code?: string; name: string }>;
  formRef: React.MutableRefObject<{
    selectedIds: number[];
    supplierId: number;
    supplierName: string;
    itemQuantities: Record<number, number>;
    itemSuppliers: Record<number, number>;
    persistDefaultSupplier: boolean;
  }>;
}> = ({ items, unconvertedIds, suppliers, formRef }) => {
  const fallbackSupplierId = suppliers[0]?.id || 0;
  const [selected, setSelected] = useState<number[]>(unconvertedIds);
  const [batchSupplierId, setBatchSupplierId] = useState<number>(() => {
    const first = items.find((i) => i.id != null && unconvertedIds.includes(i.id) && !i.purchase_order_id);
    return first?.supplier_id || fallbackSupplierId;
  });
  const [rowSuppliers, setRowSuppliers] = useState<Record<number, number>>(() => {
    const m: Record<number, number> = {};
    items.forEach((i) => {
      if (i.id == null || i.purchase_order_id || !unconvertedIds.includes(i.id)) return;
      m[i.id] = i.supplier_id || fallbackSupplierId;
    });
    return m;
  });
  const [quantities, setQuantities] = useState<Record<number, number>>(() => {
    const q: Record<number, number> = {};
    items.filter((i) => !i.purchase_order_id).forEach((i) => {
      if (i.id != null) q[i.id] = Number(i.quantity ?? 0);
    });
    return q;
  });
  const [persistDefault, setPersistDefault] = useState(false);
  const hasSuppliers = suppliers && suppliers.length > 0;

  const applyBatchToSelected = () => {
    const selectedSet = new Set(selected);
    setRowSuppliers((prev) => {
      const next = { ...prev };
      items.forEach((i) => {
        if (i.id == null || !selectedSet.has(i.id) || i.purchase_order_id || !unconvertedIds.includes(i.id)) return;
        next[i.id] = batchSupplierId;
      });
      return next;
    });
  };

  const hasBatchTargetRows = selected.some((id) => {
    const i = items.find((x) => x.id === id);
    return i != null && i.id != null && !i.purchase_order_id && unconvertedIds.includes(i.id);
  });

  useEffect(() => {
    formRef.current.selectedIds = selected;
    formRef.current.itemQuantities = quantities;
    formRef.current.itemSuppliers = rowSuppliers;
    formRef.current.persistDefaultSupplier = persistDefault;
    const firstSelectedId = selected[0];
    const head = firstSelectedId ? rowSuppliers[firstSelectedId] : batchSupplierId;
    const currentSupplierId = (head || batchSupplierId || 0) as number;
    formRef.current.supplierId = currentSupplierId;
    formRef.current.supplierName = suppliers.find((x) => x.id === currentSupplierId)?.name || '';
  }, [selected, quantities, rowSuppliers, persistDefault, batchSupplierId, suppliers, formRef]);

  const supplierOptions = suppliers.map((s) => ({
    label: `${s.code ? `${s.code} - ` : ''}${s.name}`.trim(),
    value: s.id,
  }));

  return (
    <div style={{ margin: 0 }}>
      {hasSuppliers && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#666', whiteSpace: 'nowrap' }}>批量默认供应商</span>
          <Select
            style={{ minWidth: 220, flex: 1 }}
            placeholder="选择供应商后应用到勾选行"
            value={batchSupplierId || undefined}
            onChange={(v: number) => setBatchSupplierId(v)}
            options={supplierOptions}
          />
          <Button type="default" onClick={applyBatchToSelected} disabled={!hasBatchTargetRows}>
            应用到选中的行
          </Button>
        </div>
      )}
      {!hasSuppliers && (
        <p style={{ color: 'var(--ant-color-warning)', margin: '0 0 12px 0' }}>暂无供应商，请先在主数据中维护供应商档案</p>
      )}
      <div style={{ marginBottom: 12 }}>
        <Checkbox checked={persistDefault} onChange={(e) => setPersistDefault(e.target.checked)}>
          将各行所选供应商写回物料主数据中的默认供应商（仅「采购件」生效，便于下次自动带出）
        </Checkbox>
      </div>
      <Table
        size="small"
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as number[]),
          getCheckboxProps: (record: PurchaseRequisitionItem) => ({
            disabled: record.purchase_order_id != null,
          }),
        }}
        columns={[
          { title: '物料编号', dataIndex: 'material_code', width: 110 },
          { title: '物料名称', dataIndex: 'material_name', width: 160 },
          {
            title: '供应商',
            width: 380,
            render: (_: unknown, record: PurchaseRequisitionItem) =>
              record.id != null && !record.purchase_order_id ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'nowrap',
                    minWidth: 0,
                  }}
                >
                  <Select
                    style={{ flex: '1 1 auto', minWidth: 0 }}
                    placeholder="选择供应商"
                    value={rowSuppliers[record.id] || undefined}
                    onChange={(v: number) => setRowSuppliers((prev) => ({ ...prev, [record.id!]: v }))}
                    options={supplierOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </div>
              ) : record.purchase_order_id ? (
                '-'
              ) : null,
          },
          { title: '需求数量', dataIndex: 'quantity', width: 88, align: 'right', render: (v: any) => Number(v ?? 0) },
          {
            title: '已下推数量',
            width: 120,
            align: 'right',
            render: (_: unknown, record: PurchaseRequisitionItem) => {
              const draft = Number(record.converted_quantity_draft ?? 0);
              const confirmed = Number(record.converted_quantity_confirmed ?? 0);
              if (draft === 0 && confirmed === 0) return 0;
              const parts: string[] = [];
              if (draft > 0) parts.push(`草稿: ${draft}`);
              if (confirmed > 0) parts.push(`已确认: ${confirmed}`);
              return parts.join(' / ');
            },
          },
          { title: '最小起订量', width: 88, align: 'right', render: () => '-' },
          {
            title: '本次下推数量',
            width: 120,
            align: 'right',
            render: (_: unknown, record: PurchaseRequisitionItem) =>
              record.id != null && !record.purchase_order_id ? (
                <InputNumber
                  min={0.01}
                  value={quantities[record.id] ?? Number(record.quantity ?? 0)}
                  onChange={(v) => setQuantities((prev) => ({ ...prev, [record.id!]: Number(v) || 0 }))}
                  style={{ width: 100 }}
                />
              ) : record.purchase_order_id ? (
                '-'
              ) : null,
          },
        ]}
        dataSource={items}
        pagination={false}
        rowKey="id"
        scroll={{ x: 1160 }}
      />
    </div>
  );
};

export default PurchaseRequisitionsPage;
