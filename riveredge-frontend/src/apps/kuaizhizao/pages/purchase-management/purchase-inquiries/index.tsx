/**
 * 采购询价单
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProFormDatePicker, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, DatePicker, Descriptions, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, DeleteOutlined, EditOutlined, EyeOutlined, FormOutlined, PlusOutlined, SwapOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import {
  UniTableStackedPrimaryCell,
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, FORM_LAYOUT, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniPullCreateToolbar } from '../../../../../components/uni-pull';
import { buildUniPushMenuItems, UniPushToolbarButton } from '../../../../../components/uni-push';
import { buildKuaizhizaoPullCreateMenuItems, getKuaizhizaoDocumentAction } from '../../../constants/documentActionRegistry';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { LIST_LIFECYCLE_STAGE_FIELD } from '../../../../../utils/listLifecycleStage';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import {
  approvePurchaseInquiry,
  awardInquiryQuotes,
  closeInquiryQuoting,
  convertInquiryToPurchaseOrder,
  createInquiryFromRequisition,
  createPurchaseInquiry,
  deletePurchaseInquiry,
  getInquiryComparison,
  getPurchaseInquiry,
  listPurchaseInquiries,
  publishPurchaseInquiry,
  submitPurchaseInquiry,
  updatePurchaseInquiry,
  upsertSupplierQuote,
  withdrawPurchaseInquiryApproval,
  type ComparisonRow,
  type PurchaseInquiry,
  type PurchaseInquiryItem,
  type PurchaseInquiryVendor,
} from '../../../services/purchase-inquiry';
import {
  buildPurchaseInquiryLifecycleValueEnum,
  getPurchaseInquiryLifecycle,
  isInquiryAwarded,
  isInquiryDraft,
  isInquiryPendingCompare,
  isInquiryQuoting,
  resolvePurchaseInquiryListLifecycleParams,
} from '../../../utils/purchaseInquiryLifecycle';
import { getPurchaseRequisition, listPurchaseRequisitions } from '../../../services/purchase-requisition';
import { supplierApi } from '../../../../master-data/services/supply-chain';

type PullPurchaseRequisitionLineCandidate = {
  key: string;
  requisition_id: number;
  requisition_code: string;
  requisition_name: string;
  applicant_name: string;
  requisition_date: string;
  requisition_status: string;
  review_status: string;
  item_id: number;
  material_code: string;
  material_name: string;
  material_spec: string;
  unit: string;
  quantity: number;
  required_date: string;
  purchase_order_id?: number;
  converted: boolean;
};

function canUseRequisitionForInquiryPull(status: string): boolean {
  const s = status.trim();
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

const PurchaseInquiriesPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>();
  const lastInquiriesCacheRef = useRef<PurchaseInquiry[]>([]);
  const auditEnabled = useAuditRequired('kuaizhizao', 'purchase-inquiry');
  const pullFromRequisitionAction = getKuaizhizaoDocumentAction('purchase_inquiry.pull_from_requisition');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseInquiry | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [pendingEditFormValues, setPendingEditFormValues] = useState<Record<string, any> | null>(null);
  const [editItems, setEditItems] = useState<PurchaseInquiryItem[]>([]);
  const [editVendors, setEditVendors] = useState<PurchaseInquiryVendor[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteForm] = Form.useForm();
  const [pendingQuoteFormValues, setPendingQuoteFormValues] = useState<Record<string, unknown> | null>(null);
  const [quoteSupplierId, setQuoteSupplierId] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareRows, setCompareRows] = useState<ComparisonRow[]>([]);
  const [awardSelection, setAwardSelection] = useState<Record<number, number>>({});
  const [supplierOptions, setSupplierOptions] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [pullFromRequisitionVisible, setPullFromRequisitionVisible] = useState(false);
  const [pullRequisitionLoading, setPullRequisitionLoading] = useState(false);
  const [pullRequisitionSubmitting, setPullRequisitionSubmitting] = useState(false);
  const [pullRequisitionKeyword, setPullRequisitionKeyword] = useState('');
  const [pullRequisitionLineCandidates, setPullRequisitionLineCandidates] = useState<PullPurchaseRequisitionLineCandidate[]>([]);
  const [selectedPullRequisitionLineKeys, setSelectedPullRequisitionLineKeys] = useState<React.Key[]>([]);
  const [addVendorModalOpen, setAddVendorModalOpen] = useState(false);
  const [selectedSupplierIdsForAdd, setSelectedSupplierIdsForAdd] = useState<number[]>([]);

  const availableSuppliersForAdd = useMemo(
    () => supplierOptions.filter((s) => !editVendors.some((v) => v.supplier_id === s.id)),
    [supplierOptions, editVendors],
  );

  useEffect(() => {
    void supplierApi.list?.({ isActive: true, limit: 500 } as never).then((res: unknown) => {
      const list = Array.isArray(res) ? res : (res as { data?: Array<{ id: number; name: string; code?: string }> })?.data ?? [];
      setSupplierOptions(list.map((s) => ({ id: s.id, name: s.name, code: s.code })));
    }).catch(() => {});
  }, []);

  const openDetail = async (record: PurchaseInquiry) => {
    const full = await getPurchaseInquiry(record.id!);
    setDetail(full);
    setDetailOpen(true);
  };

  const openEdit = async (record: PurchaseInquiry) => {
    const full = await getPurchaseInquiry(record.id!);
    setEditingId(full.id!);
    setEditItems(full.items ?? []);
    setEditVendors(full.vendors ?? []);
    setPendingEditFormValues({
      inquiry_name: full.inquiry_name,
      inquiry_date: full.inquiry_date ? dayjs(full.inquiry_date) : undefined,
      quote_deadline: full.quote_deadline ? dayjs(full.quote_deadline) : undefined,
      notes: full.notes,
      __inquiry_edit_item: (full.items ?? []).map((item) => ({ material_id: item.material_id })),
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    const values = await editForm.validateFields();
    await updatePurchaseInquiry(editingId!, {
      inquiry_name: values.inquiry_name,
      inquiry_date: values.inquiry_date?.format('YYYY-MM-DD'),
      quote_deadline: values.quote_deadline?.format('YYYY-MM-DD'),
      notes: values.notes,
      items: editItems.map((item) => ({
        material_id: item.material_id!,
        material_code: item.material_code!,
        material_name: item.material_name!,
        material_spec: item.material_spec,
        unit: item.unit ?? '件',
        quantity: item.quantity!,
        required_date: item.required_date,
        source_requisition_item_id: item.source_requisition_item_id,
        notes: item.notes,
      })),
      vendors: editVendors.map((v) => ({
        supplier_id: v.supplier_id!,
        supplier_name: v.supplier_name!,
        notes: v.notes,
      })),
    });
    message.success('保存成功');
    setEditOpen(false);
    setPendingEditFormValues(null);
    actionRef.current?.reload();
  };

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    const doc = await createPurchaseInquiry({
      inquiry_name: values.inquiry_name,
      inquiry_date: values.inquiry_date?.format('YYYY-MM-DD'),
      quote_deadline: values.quote_deadline?.format('YYYY-MM-DD'),
      notes: values.notes,
      items: [],
      vendors: [],
    });
    message.success(`已创建 ${doc.inquiry_code}`);
    setCreateOpen(false);
    actionRef.current?.reload();
    await openEdit(doc);
  };

  const openQuoteEntry = (inquiry: PurchaseInquiry, supplierId: number) => {
    setQuoteSupplierId(supplierId);
    const existing = inquiry.quotes?.find((q) => q.supplier_id === supplierId);
    quoteForm.resetFields();
    const initial: Record<string, unknown> = {
      quote_date: existing?.quote_date ? dayjs(existing.quote_date) : dayjs(),
      valid_until: existing?.valid_until ? dayjs(existing.valid_until) : undefined,
      notes: existing?.notes,
    };
    (inquiry.items ?? []).forEach((item) => {
      const line = existing?.items?.find((i) => i.inquiry_item_id === item.id);
      initial[`qty_${item.id}`] = line?.quoted_quantity ?? item.quantity;
      initial[`price_${item.id}`] = line?.unit_price ?? 0;
      initial[`date_${item.id}`] = line?.delivery_date ? dayjs(line.delivery_date) : item.required_date ? dayjs(item.required_date) : undefined;
    });
    setPendingQuoteFormValues(initial);
    setQuoteOpen(true);
  };

  const saveQuote = async () => {
    if (!detail?.id || !quoteSupplierId) return;
    const values = await quoteForm.validateFields();
    const vendor = detail.vendors?.find((v) => v.supplier_id === quoteSupplierId);
    await upsertSupplierQuote(detail.id, {
      supplier_id: quoteSupplierId,
      supplier_name: vendor?.supplier_name,
      quote_date: values.quote_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
      notes: values.notes,
      items: (detail.items ?? []).map((item) => ({
        inquiry_item_id: item.id!,
        quoted_quantity: values[`qty_${item.id}`],
        unit_price: values[`price_${item.id}`],
        delivery_date: values[`date_${item.id}`]?.format('YYYY-MM-DD'),
      })),
    });
    message.success('报价已保存');
    setQuoteOpen(false);
    setDetail(await getPurchaseInquiry(detail.id));
    actionRef.current?.reload();
  };

  const openCompare = async (inquiry: PurchaseInquiry) => {
    const matrix = await getInquiryComparison(inquiry.id!);
    setCompareRows(matrix.rows);
    const init: Record<number, number> = {};
    matrix.rows.forEach((row) => {
      const awarded = row.cells.find((c) => c.is_awarded && c.quote_item_id);
      if (awarded?.quote_item_id) init[row.inquiry_item_id] = awarded.quote_item_id;
      else {
        const lowest = row.cells.find((c) => c.is_lowest_price && c.quote_item_id);
        if (lowest?.quote_item_id) init[row.inquiry_item_id] = lowest.quote_item_id;
      }
    });
    setAwardSelection(init);
    setCompareOpen(true);
  };

  const confirmAward = async () => {
    if (!detail?.id) return;
    const awards = Object.entries(awardSelection)
      .filter(([, quoteItemId]) => quoteItemId)
      .map(([inquiryItemId, quoteItemId]) => ({
        inquiry_item_id: Number(inquiryItemId),
        quote_item_id: Number(quoteItemId),
      }));
    if (!awards.length) {
      message.warning('请选择定标报价');
      return;
    }
    await awardInquiryQuotes(detail.id, awards);
    message.success('定标成功');
    setCompareOpen(false);
    setDetail(await getPurchaseInquiry(detail.id));
    actionRef.current?.reload();
  };

  const handleConvertPO = async (inquiry: PurchaseInquiry) => {
    modal.confirm({
      title: '下推采购订单',
      content: '将按定标供应商自动生成采购订单，是否继续？',
      onOk: async () => {
        const res = await convertInquiryToPurchaseOrder(inquiry.id!);
        message.success(`已生成 ${res.purchase_orders?.length ?? 0} 张采购订单`);
        setDetail(await getPurchaseInquiry(inquiry.id!));
        actionRef.current?.reload();
      },
    });
  };

  const loadPullRequisitionCandidates = async (keyword: string = '') => {
    setPullRequisitionLoading(true);
    try {
      const result = await listPurchaseRequisitions({
        skip: 0,
        limit: 30,
        keyword: keyword.trim() || undefined,
      });
      const rows = result.data ?? [];
      const details = await Promise.all(
        rows
          .filter((row) => row.id && row.requisition_code)
          .slice(0, 30)
          .map(async (row) => {
            try {
              const detail = await getPurchaseRequisition(Number(row.id));
              const status = detail.status || '';
              if (!canUseRequisitionForInquiryPull(status)) return [] as PullPurchaseRequisitionLineCandidate[];
              return (detail.items ?? [])
                .filter((item) => item.id != null)
                .map((item) => ({
                  key: `${detail.id}-${item.id}`,
                  requisition_id: Number(detail.id),
                  requisition_code: detail.requisition_code || '',
                  requisition_name: detail.requisition_name || '',
                  applicant_name: detail.applicant_name || '',
                  requisition_date: detail.requisition_date || '',
                  requisition_status: status,
                  review_status: detail.review_status || '',
                  item_id: Number(item.id),
                  material_code: item.material_code || '',
                  material_name: item.material_name || '',
                  material_spec: item.material_spec || '',
                  unit: item.unit || '',
                  quantity: Number(item.quantity || 0),
                  required_date: item.required_date || detail.required_date || '',
                  purchase_order_id: item.purchase_order_id ?? undefined,
                  converted: !!item.purchase_order_id,
                }));
            } catch {
              return [] as PullPurchaseRequisitionLineCandidate[];
            }
          }),
      );
      setPullRequisitionLineCandidates(details.flat());
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message || '加载采购申请列表失败');
      setPullRequisitionLineCandidates([]);
    } finally {
      setPullRequisitionLoading(false);
    }
  };

  const handlePullFromRequisition = () => {
    setPullRequisitionKeyword('');
    setSelectedPullRequisitionLineKeys([]);
    setPullRequisitionLineCandidates([]);
    setPullFromRequisitionVisible(true);
    void loadPullRequisitionCandidates('');
  };

  const handlePullFromRequisitionConfirm = async () => {
    const selectedLines = pullRequisitionLineCandidates.filter((line) => selectedPullRequisitionLineKeys.includes(line.key));
    if (!selectedLines.length) {
      message.warning('请先选择采购申请明细');
      return;
    }
    try {
      setPullRequisitionSubmitting(true);
      const grouped = selectedLines.reduce<Record<number, PullPurchaseRequisitionLineCandidate[]>>((acc, line) => {
        if (!acc[line.requisition_id]) acc[line.requisition_id] = [];
        acc[line.requisition_id].push(line);
        return acc;
      }, {});

      const createdCodes: string[] = [];
      let lastId: number | undefined;
      for (const [ridText, lines] of Object.entries(grouped)) {
        const requisitionId = Number(ridText);
        const doc = await createInquiryFromRequisition(requisitionId, {
          item_ids: lines.map((line) => line.item_id),
        });
        if (doc.inquiry_code) createdCodes.push(doc.inquiry_code);
        lastId = doc.id;
      }
      message.success(
        createdCodes.length
          ? `已创建${pullFromRequisitionAction.targetLabel}：${createdCodes.join('、')}`
          : `已从${pullFromRequisitionAction.sourceLabel}创建${pullFromRequisitionAction.targetLabel}`,
      );
      setPullFromRequisitionVisible(false);
      actionRef.current?.reload();
      if (lastId) {
        const full = await getPurchaseInquiry(lastId);
        await openEdit(full);
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string | { message?: string } } }; message?: string };
      const detail = err?.response?.data?.detail;
      const detailMsg = typeof detail === 'string' ? detail : detail?.message;
      message.error(detailMsg || err?.message || `从${pullFromRequisitionAction.sourceLabel}创建${pullFromRequisitionAction.targetLabel}失败`);
    } finally {
      setPullRequisitionSubmitting(false);
    }
  };

  const selectedInquiryForToolbar = useMemo(() => {
    if (selectedRowKeys.length !== 1) return null;
    const id = Number(selectedRowKeys[0]);
    if (!Number.isFinite(id) || id <= 0) return null;
    return lastInquiriesCacheRef.current.find((row) => row.id === id) ?? null;
  }, [selectedRowKeys]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) return;
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) {
        failed += 1;
        continue;
      }
      try {
        await deletePurchaseInquiry(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(`已删除 ${success} 条询价单`);
    if (failed > 0) message.warning(`${failed} 条删除失败`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleBatchSubmit = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning('请先选择询价单');
      return;
    }
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) {
        failed += 1;
        continue;
      }
      try {
        await submitPurchaseInquiry(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(`已提交 ${success} 条询价单`);
    if (failed > 0) message.warning(`${failed} 条提交失败`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleBatchApprove = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning('请先选择询价单');
      return;
    }
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) {
        failed += 1;
        continue;
      }
      try {
        await approvePurchaseInquiry(id, true);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(`已审核 ${success} 条询价单`);
    if (failed > 0) message.warning(`${failed} 条审核失败`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleBatchWithdraw = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning('请先选择询价单');
      return;
    }
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const id = Number(key);
      if (!Number.isFinite(id) || id <= 0) {
        failed += 1;
        continue;
      }
      try {
        await withdrawPurchaseInquiryApproval(id);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(`已撤回 ${success} 条询价单审核`);
    if (failed > 0) message.warning(`${failed} 条撤回失败`);
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const canUseToolbarPush = selectedInquiryForToolbar ? isInquiryAwarded(selectedInquiryForToolbar) : false;

  const toolbarPushMenuItems = useMemo(
    () =>
      selectedInquiryForToolbar && canUseToolbarPush
        ? buildUniPushMenuItems([
            {
              key: 'push-purchase-order',
              label: '下推采购订单',
              icon: <SwapOutlined />,
              onClick: () => {
                void handleConvertPO(selectedInquiryForToolbar);
              },
            },
          ])
        : [],
    [selectedInquiryForToolbar, canUseToolbarPush],
  );

  useEffect(() => {
    const id = searchParams.get('inquiryId');
    if (id) {
      getPurchaseInquiry(Number(id)).then((doc) => openEdit(doc)).finally(() => {
        searchParams.delete('inquiryId');
        setSearchParams(searchParams, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: ProColumns<PurchaseInquiry>[] = [
    {
      title: '名称 / 询价单号',
      key: 'inquiry_code',
      dataIndex: 'inquiry_code',
      ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
      fixed: 'left',
      render: (_, r) => (
        <UniTableStackedPrimaryCell
          primary={String(r.inquiry_name ?? '')}
          secondary={String(r.inquiry_code ?? '')}
        />
      ),
    },
    { title: '询价单号', dataIndex: 'inquiry_code', hideInTable: true, copyable: true },
    { title: '名称', dataIndex: 'inquiry_name', hideInTable: true, ellipsis: true },
    { title: '来源单号', dataIndex: 'source_code', width: 140 },
    { title: '采购员', dataIndex: 'buyer_name', width: 100 },
    {
      title: '报价截止',
      dataIndex: 'quote_deadline',
      width: 120,
      render: (_, r) => (r.quote_deadline ? dayjs(r.quote_deadline).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: LIST_LIFECYCLE_STAGE_FIELD,
      valueType: 'select',
      valueEnum: buildPurchaseInquiryLifecycleValueEnum(),
      render: (_, record) => {
        const lc = getPurchaseInquiryLifecycle(record as Record<string, unknown>);
        const tag = getDocumentLifecycleStageTagProps(lc.stageName ?? '-');
        return <Tag color={tag.color}>{lc.stageName}</Tag>;
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      fixed: 'right',
      render: (_, record) => [
            <Button {...rowActionKind('read')} key="view" onClick={() => openDetail(record)}>详情</Button>,
            isInquiryDraft(record) ? (
              <Button {...rowActionKind('update')} key="edit" onClick={() => openEdit(record)}>编辑</Button>
            ) : null,
            isInquiryDraft(record) ? (
              <Button {...rowActionKind('delete')} key="del" onClick={() => {
                modal.confirm({
                  title: '确认删除？',
                  onOk: async () => {
                    await deletePurchaseInquiry(record.id!);
                    message.success('已删除');
                    actionRef.current?.reload();
                  },
                });
              }}>删除</Button>
            ) : null,
          ],
    },
  ];

  const request = useCallback(async (params: Record<string, unknown>) => {
    const apiParams = resolvePurchaseInquiryListLifecycleParams(params, params);
    const list = await listPurchaseInquiries({
      skip: ((params.current as number) - 1) * (params.pageSize as number),
      limit: params.pageSize as number,
      lifecycle_stage: apiParams.lifecycle_stage,
      keyword: params.keyword as string | undefined,
    });
    lastInquiriesCacheRef.current = list.data ?? [];
    return { data: list.data ?? [], success: true, total: list.total ?? list.data?.length ?? 0 };
  }, []);

  const addEditItem = () => {
    setEditItems((prev) => {
      const next = [
        ...prev,
        { material_id: undefined, material_code: '', material_name: '', unit: '件', quantity: 1 },
      ];
      editForm.setFieldValue(
        '__inquiry_edit_item',
        next.map((item) => ({ material_id: item.material_id })),
      );
      return next;
    });
  };

  const openAddVendorModal = () => {
    setSelectedSupplierIdsForAdd([]);
    setAddVendorModalOpen(true);
  };

  const handleConfirmAddVendors = () => {
    if (!selectedSupplierIdsForAdd.length) {
      message.warning('请选择要添加的供应商');
      return;
    }
    const toAdd = supplierOptions.filter(
      (s) => selectedSupplierIdsForAdd.includes(s.id) && !editVendors.some((v) => v.supplier_id === s.id),
    );
    if (!toAdd.length) {
      message.warning('所选供应商均已添加');
      return;
    }
    setEditVendors((prev) => [
      ...prev,
      ...toAdd.map((s) => ({ supplier_id: s.id, supplier_name: s.name })),
    ]);
    setAddVendorModalOpen(false);
    setSelectedSupplierIdsForAdd([]);
    message.success(`已添加 ${toAdd.length} 家供应商`);
  };

  const formatSupplierLabel = (s: { id: number; name: string; code?: string }) =>
    s.code ? `${s.code} - ${s.name}` : s.name;

  return (
    <ListPageTemplate>
      <UniTable<PurchaseInquiry>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        columnPersistenceId="apps.kuaizhizao.pages.purchase-management.purchase-inquiries"
        pinnedTabsField={LIST_LIFECYCLE_STAGE_FIELD}
        pinnedTabsValueEnum={buildPurchaseInquiryLifecycleValueEnum()}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条询价单吗？`}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="purchase-inquiry-batch-menu"
            selectedRowKeys={selectedRowKeys}
            menuItems={[
              {
                key: 'submit',
                label: '批量提交',
                icon: <ThunderboltOutlined />,
                onClick: handleBatchSubmit,
              },
              ...(auditEnabled
                ? [
                    {
                      key: 'approve',
                      label: '批量审核通过',
                      icon: <CheckOutlined />,
                      onClick: handleBatchApprove,
                    },
                  ]
                : []),
              {
                key: 'withdraw',
                label: '批量撤回审核',
                icon: <EditOutlined />,
                onClick: handleBatchWithdraw,
              },
            ]}
          />,
        ]}
        toolBarRender={() => [
          <UniPullCreateToolbar
            key="create-purchase-inquiry-with-pull"
            compactKey="create-purchase-inquiry-with-pull"
            createIcon={<PlusOutlined />}
            createLabel="新建询价单"
            onCreate={() => { createForm.resetFields(); setCreateOpen(true); }}
            menuItems={buildKuaizhizaoPullCreateMenuItems([
              {
                key: 'pull-from-requisition',
                actionKey: 'purchase_inquiry.pull_from_requisition',
                onClick: handlePullFromRequisition,
              },
            ])}
          />,
          <UniPushToolbarButton
            key={`purchase-inquiry-push-${selectedInquiryForToolbar?.id ?? 'none'}`}
            menuItems={toolbarPushMenuItems}
            disabled={!selectedInquiryForToolbar || !canUseToolbarPush}
          />,
        ]}
      />

      <Modal title="新建询价单" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => void handleCreate()} {...MODAL_CONFIG}>
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item name="inquiry_name" label="询价名称" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="inquiry_date" label="询价日期" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item name="quote_deadline" label="报价截止日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <FormModalTemplate
        title="编辑询价单"
        open={editOpen}
        onClose={() => setEditOpen(false)}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingEditFormValues) {
              editForm.setFieldsValue(pendingEditFormValues);
            }
            return;
          }
          editForm.resetFields();
          setPendingEditFormValues(null);
        }}
        onFinish={handleSaveEdit}
        form={editForm}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={FORM_LAYOUT.GRID_GUTTER}>
          <Col span={10}>
            <ProFormText name="inquiry_name" label="询价名称" rules={[{ required: true }]} />
          </Col>
          <Col span={7}>
            <ProFormDatePicker
              name="inquiry_date"
              label="询价日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={7}>
            <ProFormDatePicker
              name="quote_deadline"
              label="报价截止日期"
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
        </Row>

        <div className="uni-table-detail" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>受邀供应商</span>
            {editVendors.length > 0 && (
              <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={openAddVendorModal}>
                新增供应商
              </Button>
            )}
          </div>
          {editVendors.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              rowKey={(r) => r.supplier_id!}
              dataSource={editVendors}
              columns={[
                {
                  title: '供应商',
                  dataIndex: 'supplier_name',
                  render: (name: string, record) => {
                    const matched = supplierOptions.find((s) => s.id === record.supplier_id);
                    return matched ? formatSupplierLabel(matched) : name;
                  },
                },
                {
                  title: '操作',
                  width: 80,
                  render: (_, r) => (
                    <Button type="link" danger size="small" onClick={() => setEditVendors((prev) => prev.filter((v) => v.supplier_id !== r.supplier_id))}>
                      移除
                    </Button>
                  ),
                },
              ]}
            />
          ) : (
            <div
              style={{
                padding: 24,
                background: '#fafafa',
                borderRadius: 4,
                border: '1px dashed var(--river-border-color)',
                textAlign: 'center',
                color: '#999',
              }}
            >
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无受邀供应商，点击下方按钮添加" />
              <Button type="primary" ghost icon={<PlusOutlined />} onClick={openAddVendorModal} style={{ marginTop: 12 }}>
                新增供应商
              </Button>
            </div>
          )}
        </div>

        <div className="uni-table-detail" style={{ marginBottom: 24 }}>
          <Space style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 500 }}>询价明细</span>
            <Button size="small" onClick={addEditItem}>添加行</Button>
          </Space>
          <Table
            size="small"
            pagination={false}
            style={{ width: '100%' }}
            scroll={{ x: 720 }}
            rowKey={(_, idx) => String(idx)}
            dataSource={editItems}
            columns={[
              {
                title: '物料',
                width: 280,
                render: (_, r, idx) => (
                  <UniMaterialSelect
                    name={['__inquiry_edit_item', idx, 'material_id']}
                    label=""
                    size="small"
                    formItemProps={{ style: { margin: 0 } }}
                    fallbackOption={
                      r.material_id
                        ? { value: r.material_id, label: `${r.material_code || ''} - ${r.material_name || ''}`.trim() || String(r.material_id) }
                        : undefined
                    }
                    onChange={(_, mat) => {
                      if (!mat) return;
                      setEditItems((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...next[idx],
                          material_id: mat.id,
                          material_code: mat.code,
                          material_name: mat.name,
                          material_spec: mat.spec,
                          unit: mat.unit ?? '件',
                        };
                        return next;
                      });
                    }}
                  />
                ),
              },
              {
                title: '数量',
                width: 120,
                render: (_, r, idx) => (
                  <InputNumber
                    min={0}
                    size="small"
                    style={{ width: '100%' }}
                    value={r.quantity}
                    onChange={(v) => setEditItems((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], quantity: v ?? 0 };
                      return next;
                    })}
                  />
                ),
              },
              {
                title: '要求交期',
                width: 160,
                render: (_, r, idx) => (
                  <DatePicker
                    size="small"
                    style={{ width: '100%' }}
                    value={r.required_date ? dayjs(r.required_date) : undefined}
                    onChange={(d) => setEditItems((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx], required_date: d?.format('YYYY-MM-DD') };
                      return next;
                    })}
                  />
                ),
              },
              {
                title: '操作',
                width: 60,
                fixed: 'right',
                render: (_, __, idx) => (
                  <Button type="link" danger size="small" onClick={() => setEditItems((prev) => prev.filter((_, i) => i !== idx))}>删</Button>
                ),
              },
            ]}
          />
        </div>

        <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>

      <Modal
        title="选择供应商"
        open={addVendorModalOpen}
        onOk={handleConfirmAddVendors}
        onCancel={() => {
          setAddVendorModalOpen(false);
          setSelectedSupplierIdsForAdd([]);
        }}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ disabled: selectedSupplierIdsForAdd.length === 0 }}
        destroyOnHidden
      >
        <Select
          mode="multiple"
          placeholder="搜索并选择供应商（可多选）"
          options={availableSuppliersForAdd.map((s) => ({
            label: formatSupplierLabel(s),
            value: s.id,
          }))}
          value={selectedSupplierIdsForAdd}
          onChange={setSelectedSupplierIdsForAdd}
          style={{ width: '100%' }}
          showSearch
          allowClear
          maxTagCount="responsive"
          filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
          notFoundContent={availableSuppliersForAdd.length === 0 ? '暂无可选供应商（可能已全部添加）' : undefined}
        />
        {availableSuppliersForAdd.length === 0 && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
            没有可用的供应商，请先在「供应商档案」中维护供应商。
          </Typography.Text>
        )}
      </Modal>

      <DetailDrawerTemplate
        title={`采购询价单 - ${detail?.inquiry_code ?? ''}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.LARGE_WIDTH ?? DRAWER_CONFIG.HALF_WIDTH}
        extra={
          detail ? (
            <Space wrap>
              {isInquiryDraft(detail) && (
                <Button icon={<EditOutlined />} onClick={() => { setDetailOpen(false); void openEdit(detail); }}>编辑</Button>
              )}
              {isInquiryDraft(detail) && (
                <Button icon={<ThunderboltOutlined />} onClick={async () => {
                  await submitPurchaseInquiry(detail.id!);
                  message.success('已提交');
                  setDetail(await getPurchaseInquiry(detail.id!));
                  actionRef.current?.reload();
                }}>提交</Button>
              )}
              {isInquiryDraft(detail) && (
                <Button type="primary" onClick={async () => {
                  await publishPurchaseInquiry(detail.id!);
                  message.success('已发布询价');
                  setDetail(await getPurchaseInquiry(detail.id!));
                  actionRef.current?.reload();
                }}>发布询价</Button>
              )}
              {isInquiryQuoting(detail) && (
                <Button onClick={async () => {
                  await closeInquiryQuoting(detail.id!);
                  message.success('已截止询价');
                  setDetail(await getPurchaseInquiry(detail.id!));
                  actionRef.current?.reload();
                }}>截止询价</Button>
              )}
              {(isInquiryPendingCompare(detail) || isInquiryQuoting(detail)) && (
                <Button onClick={() => void openCompare(detail)}>比价定标</Button>
              )}
              {isInquiryAwarded(detail) && (
                <Button icon={<SwapOutlined />} onClick={() => void handleConvertPO(detail)}>下推采购订单</Button>
              )}
              <UniWorkflowActions {...rowActionKind('skip')}
                record={detail}
                entityName="采购询价单"
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={['DRAFT', '草稿']}
                pendingStatuses={['PENDING', 'PENDING_REVIEW', '待审核']}
                approvedStatuses={['APPROVED', '已通过', '审核通过']}
                rejectedStatuses={['REJECTED', '已驳回']}
                autoApproveWhenSubmit={!auditEnabled}
                workflowAuditEnabled={auditEnabled}
                actions={{
                  approve: (id, approved, reason) => approvePurchaseInquiry(id, approved, reason),
                  revoke: withdrawPurchaseInquiryApproval,
                }}
                onSuccess={async () => {
                  actionRef.current?.reload();
                  if (detail.id) setDetail(await getPurchaseInquiry(detail.id));
                }}
              />
            </Space>
          ) : null
        }
      >
        {detail && (
          <>
            <UniLifecycle {...getPurchaseInquiryLifecycle(detail as Record<string, unknown>)} />
            <Descriptions column={2} size="small" style={{ marginTop: 16 }}>
              <Descriptions.Item label="来源">{detail.source_code || '-'}</Descriptions.Item>
              <Descriptions.Item label="采购员">{detail.buyer_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="询价日期">{detail.inquiry_date ? dayjs(detail.inquiry_date).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="报价截止">{detail.quote_deadline ? dayjs(detail.quote_deadline).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detail.notes || '-'}</Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ marginBottom: 8 }}>受邀供应商</h4>
              {isInquiryDraft(detail) && (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  发布询价后，请在此逐行录入各供应商报价。
                </Typography.Text>
              )}
              {(isInquiryQuoting(detail) || isInquiryPendingCompare(detail)) && (
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                  请逐行选择供应商，点击「在此录入报价」填写单价与交期。
                </Typography.Text>
              )}
              {(detail.vendors ?? []).length > 0 ? (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="supplier_id"
                  dataSource={detail.vendors ?? []}
                  columns={[
                    { title: '供应商', dataIndex: 'supplier_name', ellipsis: true },
                    {
                      title: '报价状态',
                      width: 100,
                      render: (_, v) => (
                        <Tag color={v.status === 'QUOTED' ? 'success' : 'default'}>
                          {v.status === 'QUOTED' ? '已报价' : '待报价'}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      width: 160,
                      render: (_, v) => {
                        const canQuote = isInquiryQuoting(detail) || isInquiryPendingCompare(detail);
                        if (!canQuote) {
                          return v.status === 'QUOTED' ? (
                            <Typography.Text type="secondary">已录入</Typography.Text>
                          ) : (
                            <Typography.Text type="secondary">—</Typography.Text>
                          );
                        }
                        const quoted = v.status === 'QUOTED';
                        return (
                          <Button
                            type={quoted ? 'link' : 'primary'}
                            size="small"
                            icon={<FormOutlined />}
                            onClick={() => openQuoteEntry(detail, v.supplier_id!)}
                          >
                            {quoted ? '修改报价' : '在此录入报价'}
                          </Button>
                        );
                      },
                    },
                  ]}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无受邀供应商，请编辑询价单添加" />
              )}
            </div>
            <div style={{ marginTop: 16 }}>
              <h4>询价明细</h4>
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.items ?? []}
                columns={[
                  { title: '物料编码', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name' },
                  { title: '数量', dataIndex: 'quantity', width: 90 },
                  { title: '单位', dataIndex: 'unit', width: 60 },
                  { title: '要求交期', dataIndex: 'required_date', width: 110, render: (v) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
                ]}
              />
            </div>
          </>
        )}
      </DetailDrawerTemplate>

      <Modal
        title={`录入供应商报价${quoteSupplierId && detail?.vendors ? ` - ${detail.vendors.find((v) => v.supplier_id === quoteSupplierId)?.supplier_name ?? ''}` : ''}`}
        open={quoteOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={() => {
          setQuoteOpen(false);
          setPendingQuoteFormValues(null);
        }}
        onOk={() => void saveQuote()}
        afterOpenChange={(open) => {
          if (open) {
            if (pendingQuoteFormValues) {
              quoteForm.setFieldsValue(pendingQuoteFormValues);
            }
            return;
          }
          quoteForm.resetFields();
          setPendingQuoteFormValues(null);
        }}
        destroyOnHidden
      >
        <Form form={quoteForm} layout="vertical">
          <Row gutter={FORM_LAYOUT.GRID_GUTTER}>
            <Col span={12}>
              <Form.Item name="quote_date" label="报价日期" rules={[{ required: true, message: '请选择报价日期' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="valid_until" label="有效期至">
                <DatePicker style={{ width: '100%' }} placeholder="请选择日期" />
              </Form.Item>
            </Col>
          </Row>

          <div className="uni-table-detail" style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>报价明细</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              请为每条询价物料填写报价数量、单价与承诺交期。
            </Typography.Text>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              scroll={{ x: 860 }}
              dataSource={detail?.items ?? []}
              columns={[
                { title: '物料编码', dataIndex: 'material_code', width: 120, ellipsis: true },
                { title: '物料名称', dataIndex: 'material_name', width: 180, ellipsis: true },
                {
                  title: '询价数量',
                  width: 100,
                  align: 'right',
                  render: (_, item) => `${item.quantity ?? '-'} ${item.unit ?? ''}`.trim(),
                },
                {
                  title: '报价数量',
                  width: 110,
                  render: (_, item) => (
                    <Form.Item
                      name={`qty_${item.id}`}
                      style={{ margin: 0 }}
                      rules={[{ required: true, message: '必填' }]}
                    >
                      <InputNumber min={0} precision={2} style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '单价',
                  width: 120,
                  render: (_, item) => (
                    <Form.Item
                      name={`price_${item.id}`}
                      style={{ margin: 0 }}
                      rules={[{ required: true, message: '必填' }]}
                    >
                      <InputNumber min={0} precision={4} style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '承诺交期',
                  width: 140,
                  render: (_, item) => (
                    <Form.Item name={`date_${item.id}`} style={{ margin: 0 }}>
                      <DatePicker style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  ),
                },
              ]}
            />
          </div>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="可填写报价说明、付款条件等" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="比价定标"
        open={compareOpen}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        onCancel={() => setCompareOpen(false)}
        onOk={() => void confirmAward()}
      >
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          绿色「最低」为系统推荐；点击价格按钮选定本条物料的中标报价（选中后显示勾选）。
        </Typography.Text>
        <Table
          size="small"
          pagination={false}
          rowKey="inquiry_item_id"
          dataSource={compareRows}
          scroll={{ x: 'max-content' }}
          columns={[
            { title: '物料', width: 220, render: (_, r) => `${r.material_code} ${r.material_name}` },
            { title: '数量', dataIndex: 'quantity', width: 80, align: 'right' },
            ...(compareRows[0]?.cells ?? []).map((cell, idx) => ({
              title: cell.supplier_name ?? `供应商${idx + 1}`,
              width: 148,
              align: 'center' as const,
              render: (_: unknown, row: ComparisonRow) => {
                const c = row.cells[idx];
                if (!c?.quote_item_id) return '-';
                const selected = awardSelection[row.inquiry_item_id] === c.quote_item_id;
                const priceText = c.unit_price != null ? Number(c.unit_price).toFixed(4) : '-';
                return (
                  <Space size={4} align="center" wrap={false} style={{ whiteSpace: 'nowrap' }}>
                    <Button
                      type={selected ? 'primary' : 'default'}
                      size="small"
                      icon={selected ? <CheckOutlined /> : undefined}
                      onClick={() => setAwardSelection((prev) => ({ ...prev, [row.inquiry_item_id]: c.quote_item_id! }))}
                      style={c.is_lowest_price && !selected ? { borderColor: '#52c41a', color: '#389e0d' } : undefined}
                    >
                      {priceText}
                    </Button>
                    {c.is_lowest_price ? (
                      <Tag color="success" style={{ margin: 0, fontSize: 11, lineHeight: '18px', flexShrink: 0 }}>
                        最低
                      </Tag>
                    ) : null}
                  </Space>
                );
              },
            })),
          ]}
        />
      </Modal>

      <Modal
        title={pullFromRequisitionAction.label}
        open={pullFromRequisitionVisible}
        width={1280}
        onCancel={() => setPullFromRequisitionVisible(false)}
        onOk={() => void handlePullFromRequisitionConfirm()}
        okText="创建询价单"
        cancelText="取消"
        okButtonProps={{ disabled: selectedPullRequisitionLineKeys.length === 0 || pullRequisitionLoading }}
        confirmLoading={pullRequisitionSubmitting}
        destroyOnHidden
      >
        <Space orientation="vertical" style={{ width: '100%', marginTop: 12 }} size={12}>
          <Input.Search
            allowClear
            value={pullRequisitionKeyword}
            placeholder="搜索采购申请明细（申请单号/申请名称）"
            enterButton="搜索"
            onChange={(e) => setPullRequisitionKeyword(e.target.value)}
            onSearch={(value) => {
              const keyword = value?.trim?.() || '';
              setPullRequisitionKeyword(keyword);
              void loadPullRequisitionCandidates(keyword);
            }}
          />
          <Table<PullPurchaseRequisitionLineCandidate>
            rowKey="key"
            loading={pullRequisitionLoading}
            size="small"
            pagination={false}
            locale={{ emptyText: pullRequisitionKeyword ? '未找到匹配采购申请明细' : '暂无可选采购申请明细' }}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedPullRequisitionLineKeys,
              onChange: (keys) => {
                setSelectedPullRequisitionLineKeys(keys);
              },
              getCheckboxProps: (record) => ({
                disabled: record.converted,
              }),
            }}
            onRow={(record) => ({
              onClick: () => {
                if (record.converted) return;
                const selected = selectedPullRequisitionLineKeys.includes(record.key);
                setSelectedPullRequisitionLineKeys((prev) =>
                  selected ? prev.filter((k) => k !== record.key) : [...prev, record.key],
                );
              },
            })}
            columns={[
              { title: '申请单号', dataIndex: 'requisition_code', width: 170 },
              { title: '申请名称', dataIndex: 'requisition_name', width: 160, ellipsis: true, render: (v: string) => v || '-' },
              { title: '物料编码', dataIndex: 'material_code', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: '物料名称', dataIndex: 'material_name', width: 170, ellipsis: true, render: (v: string) => v || '-' },
              { title: '规格', dataIndex: 'material_spec', width: 140, ellipsis: true, render: (v: string) => v || '-' },
              { title: '数量', dataIndex: 'quantity', width: 90, align: 'right' },
              { title: '单位', dataIndex: 'unit', width: 70, render: (v: string) => v || '-' },
              { title: '需求日期', dataIndex: 'required_date', width: 120, render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '-') },
              { title: '申请人', dataIndex: 'applicant_name', width: 100, render: (v: string) => v || '-' },
              {
                title: '状态',
                dataIndex: 'requisition_status',
                width: 100,
                render: (v: string) => <Tag color={v?.includes('转单') ? 'gold' : 'blue'}>{v || '-'}</Tag>,
              },
              {
                title: '转单状态',
                width: 160,
                render: (_: unknown, record: PullPurchaseRequisitionLineCandidate) =>
                  record.converted ? (
                    <Tag color="gold">已转采购订单#{record.purchase_order_id}</Tag>
                  ) : (
                    <Tag color="green">可询价</Tag>
                  ),
              },
            ]}
            dataSource={pullRequisitionLineCandidates}
            scroll={{ x: 1400, y: 320 }}
          />
          <Typography.Text type="secondary">
            已选择 {selectedPullRequisitionLineKeys.length} 条明细，同一采购申请将合并创建一张询价单。
          </Typography.Text>
        </Space>
      </Modal>
    </ListPageTemplate>
  );
};

export default PurchaseInquiriesPage;
