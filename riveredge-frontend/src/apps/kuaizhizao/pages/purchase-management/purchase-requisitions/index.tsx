/**
 * 采购申请管理页面
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormItem } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Table, Form as AntForm, Input, InputNumber, Select, Dropdown, Row, Col, Checkbox } from 'antd';
import { EyeOutlined, SwapOutlined, ThunderboltOutlined, MoreOutlined, PlusOutlined, DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerActions, FormModalTemplate, MODAL_CONFIG, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import type { Material } from '../../../../master-data/types/material';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { downloadFile } from '../../../../../utils';
import {
  listPurchaseRequisitions,
  getPurchaseRequisition,
  createPurchaseRequisition,
  deletePurchaseRequisition,
  submitPurchaseRequisition,
  approvePurchaseRequisition,
  withdrawPurchaseRequisition,
  fixPurchaseRequisitionStatus,
  convertToPurchaseOrder,
  urgentPurchase,
  PurchaseRequisition,
  PurchaseRequisitionItem,
} from '../../../services/purchase-requisition';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getPurchaseRequisitionLifecycle } from '../../../utils/purchaseRequisitionLifecycle';
import { getDocumentLifecycleStageTagProps } from '../../../../../utils/documentLifecycleStatusTag';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { supplierApi } from '../../../../master-data/services/supply-chain';
import { ROUTES } from '../../../constants/routes';
import { PriceHistoryInsight, SupplierPerformanceTag, MultiSupplierPriceComparison } from '../purchase-orders/ProcurementEmpowermentComponents';
import { useTranslation } from 'react-i18next';

const PurchaseRequisitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentReq, setCurrentReq] = useState<PurchaseRequisition | null>(null);
  const [supplierList, setSupplierList] = useState<Array<{ id: number; code?: string; name: string }>>([]);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const createFormRef = useRef<any>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);

  const initialCreateItems = [
    { material_id: undefined, material_code: '', material_name: '', material_spec: '', unit: '件', quantity: 1, suggested_unit_price: 0 },
  ];

  useEffect(() => {
    supplierApi.list?.({ isActive: true } as any).then((res: any) => {
      const list = Array.isArray(res) ? res : res?.data || res?.results || [];
      setSupplierList(list);
    }).catch(() => setSupplierList([]));
  }, []);

  const appendRequisitionItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const current = createFormRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        unit: m.baseUnit ?? '件',
        quantity: 1,
        suggested_unit_price: 0,
      }));
      createFormRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const columns: ProColumns<PurchaseRequisition>[] = [
    { title: '申请编号', dataIndex: 'requisition_code', width: 150, fixed: 'left' },
    { title: '申请名称', dataIndex: 'requisition_name', width: 180 },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueEnum: {
        '草稿': { text: '草稿', status: 'Default' },
        '待审核': { text: '待审核', status: 'Processing' },
        '已驳回': { text: '已驳回', status: 'Error' },
        '已通过': { text: '已通过', status: 'Success' },
        '部分转单': { text: '部分转单', status: 'Warning' },
        '全部转单': { text: '全部转单', status: 'Success' },
      },
      render: (_, record) => {
        const lifecycle = getPurchaseRequisitionLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        return <Tag {...getDocumentLifecycleStageTagProps(stageName)}>{stageName}</Tag>;
      },
    },
    { title: '来源', dataIndex: 'source_code', width: 140 },
    { title: '要求到货日期', dataIndex: 'required_date', valueType: 'date', width: 120 },
    { title: '明细数', dataIndex: 'items_count', width: 80, align: 'center' },
    {
      title: '紧急',
      dataIndex: 'is_urgent',
      width: 70,
      render: (v) => (v ? <Tag color="red">紧急</Tag> : '-'),
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      valueType: 'option',
      width: 320,
      fixed: 'right',
      render: (_, record) => {
        const s = (record.status ?? '').toString().trim();
        const isDraft = ['草稿', 'draft', 'DRAFT'].includes(s);
        const isPending = ['待审核', 'pending_review', 'PENDING_REVIEW'].includes(s);
        const isApprovedOrPartial = ['已通过', '部分转单', 'audited', 'approved', 'AUDITED', 'PARTIAL_CONVERTED'].includes(s);
        const moreItems = [
          ...(isDraft || isPending
            ? [{ key: 'urgent', label: '紧急采购', icon: <ThunderboltOutlined />, onClick: () => handleUrgent(record) }]
            : []),
          ...(isDraft
            ? [{ key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleDeleteOne(record) }]
            : []),
        ];
        return (
          <Space size={4} wrap>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>
              详情
            </Button>
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
              actions={{
                submit: (id) => submitPurchaseRequisition(id),
                approve: (id) => approvePurchaseRequisition(id, { approved: true, review_remarks: '' }),
                reject: (id, reason) => approvePurchaseRequisition(id, { approved: false, review_remarks: reason || '' }),
                revoke: (id) => withdrawPurchaseRequisition(id),
              }}
              onSuccess={() => actionRef.current?.reload()}
            />
            {isApprovedOrPartial && (
              <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvert(record)}>
                下推采购单
              </Button>
            )}
            {moreItems.length > 0 && (
              <Dropdown menu={{ items: moreItems }} trigger={['click']} placement="bottomRight">
                <Button type="link" size="small" icon={<MoreOutlined />}>
                  更多
                </Button>
              </Dropdown>
            )}
          </Space>
        );
      },
    },
  ];

  /** 参考销售订单：先打开弹窗，再请求 getCodeRulePageConfig + testGenerateCode 预填编号 */
  const handleCreate = async () => {
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    setCreateModalVisible(true);
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
              items: initialCreateItems,
            });
          }, 100);
        } catch (e) {
          console.warn('采购申请编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
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
                items: initialCreateItems,
              });
            }, 100);
          })
          .catch((e) => {
            console.warn('采购申请编号预生成失败:', e);
            setPreviewCode(null);
          });
      } else {
        setPreviewCode(null);
      }
    }
  };

  const handleCreateSubmit = async (values: { requisition_code?: string; requisition_name?: string; required_date?: any; notes?: string; items?: Array<{ material_id?: number; material_code?: string; material_name?: string; material_spec?: string; unit?: string; quantity?: number; suggested_unit_price?: number }> }) => {
    const requiredDate = values.required_date?.format?.('YYYY-MM-DD') ?? values.required_date;
    const validItems = (values.items ?? []).filter((i) => i.material_id && (Number(i.quantity) || 0) > 0);
    if (validItems.length === 0) {
      messageApi.error('请至少添加一条有效的申请明细');
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
        required_date: requiredDate,
        notes: values.notes,
        items: validItems.map((i) => ({
          material_id: i.material_id,
          material_code: i.material_code,
          material_name: i.material_name,
          material_spec: i.material_spec,
          unit: i.unit || '件',
          quantity: Number(i.quantity) || 0,
          suggested_unit_price: Number(i.suggested_unit_price) || 0,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      setEffectiveRuleCode(null);
      setEffectiveAutoGen(null);
      createFormRef.current?.resetFields();
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.response?.data?.detail || '创建失败');
      throw e;
    }
  };

  const handleDetail = async (record: PurchaseRequisition) => {
    try {
      const detail = await getPurchaseRequisition(record.id!);
      setCurrentReq(detail);
      setDetailVisible(true);
    } catch {
      messageApi.error('获取详情失败');
    }
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

  const handleConvert = async (record: PurchaseRequisition) => {
    try {
      if (!supplierList.length) {
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
      const defaultSupplierId = unconverted[0]?.supplier_id || supplierList[0]?.id;
      const quantities: Record<number, number> = {};
      unconverted.forEach((i) => {
        if (i.id != null) quantities[i.id] = Number(i.quantity ?? 0);
      });
      convertFormRef.current = {
        selectedIds: unconverted.map((i) => i.id!).filter(Boolean),
        supplierId: defaultSupplierId || 0,
        supplierName: supplierList.find((s) => s.id === defaultSupplierId)?.name || supplierList[0]?.name || '',
        itemQuantities: quantities,
        itemSuppliers: {},
        persistDefaultSupplier: false,
      };

      modalApi.confirm({
        title: '下推采购单',
        icon: null,
        width: MODAL_CONFIG.LARGE_WIDTH,
        content: (
          <ConvertForm
            items={allItems}
            unconvertedIds={unconverted.map((i) => i.id!).filter(Boolean)}
            suppliers={supplierList}
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

  const handleDeleteOne = (record: PurchaseRequisition) => {
    if (record.status !== '草稿') return;
    modalApi.confirm({
      title: '确认删除',
      content: `确定要删除采购申请 ${record.requisition_code} 吗？`,
      onOk: async () => {
        try {
          await deletePurchaseRequisition(record.id!);
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || '删除失败');
        }
      },
    });
  };

  const handleUrgent = (record: PurchaseRequisition) => {
    let reason = '';
    modalApi.confirm({
      title: '紧急采购',
      content: (
        <AntForm layout="vertical">
          <AntForm.Item label="紧急原因" required>
            <Input.TextArea
              rows={3}
              placeholder="请输入紧急原因（如：客户加急、设备故障补件）"
              onChange={(e) => (reason = e.target.value)}
            />
          </AntForm.Item>
        </AntForm>
      ),
      onOk: async () => {
        if (!reason?.trim()) {
          messageApi.error('请填写紧急原因');
          return Promise.reject();
        }
        try {
          await urgentPurchase(record.id!, { urgent_reason: reason.trim() });
          messageApi.success('紧急采购完成');
          actionRef.current?.reload();
        } catch (e: any) {
          messageApi.error(e?.response?.data?.detail || '操作失败');
          return Promise.reject();
        }
      },
    });
  };

  const detailColumns: ProDescriptionsItemProps<PurchaseRequisition>[] = [
    { title: '申请编号', dataIndex: 'requisition_code' },
    { title: '申请名称', dataIndex: 'requisition_name' },
    { title: '状态', dataIndex: 'status', render: (v: any) => <Tag>{v}</Tag> },
    { title: '来源', dataIndex: 'source_code' },
    { title: '要求到货日期', dataIndex: 'required_date' },
    { title: '是否紧急', dataIndex: 'is_urgent', render: (v: any) => (v ? '是' : '否') },
    { title: '紧急原因', dataIndex: 'urgent_reason', span: 2 },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="采购申请"
          actionRef={actionRef}
          request={async (params: any) => {
            const res = await listPurchaseRequisitions({
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
              status: params.lifecycle ?? params.status,
              source_type: params.source_type,
            });
            return {
              data: res.data || [],
              total: res.total || 0,
              success: res.success ?? true,
            };
          }}
          columns={columns}
          rowKey="id"
          showAdvancedSearch={true}
          search={false}
          showCreateButton
          createButtonText="新建采购申请"
          onCreate={handleCreate}
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

      <FormModalTemplate
        title="新建采购申请"
        open={createModalVisible}
        onClose={() => { setCreateModalVisible(false); setEffectiveRuleCode(null); setEffectiveAutoGen(null); }}
        onFinish={handleCreateSubmit}
        formRef={createFormRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
        initialValues={{ items: initialCreateItems }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="requisition_code"
              label="采购申请编号"
              placeholder={isAutoGenerateEnabled('kuaizhizao-purchase-requisition') ? '编号将根据编号规则自动生成，可修改' : '请输入采购申请编号'}
              rules={[{ required: true, message: '请输入采购申请编号' }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="requisition_name" label="申请名称" placeholder="请输入申请名称" />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker name="required_date" label="要求到货日期" />
          </Col>
          <Col span={12} />
        </Row>
        <ProFormItem label="申请明细" required style={{ width: '100%' }}>
          <ProForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条申请明细' }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => {
                const reqDetailColumns = [
                  {
                    title: '物料',
                    dataIndex: 'material_id',
                    width: 220,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                        {({ getFieldValue }: any) => {
                          const row = getFieldValue('items')?.[index];
                          const mid = row?.material_id ? Number(row.material_id) : null;
                          const fallback = mid && (row?.material_code || row?.material_name)
                            ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                            : undefined;
                          return (
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
                              formItemProps={{ style: { margin: 0, flex: 1 } }}
                              showQuickCreate
                              showAdvancedSearch
                            />
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
                    width: 80,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'unit']} style={{ margin: 0 }}>
                        <Input placeholder="单位" size="small" />
                      </AntForm.Item>
                    ),
                  },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                    width: 100,
                    align: 'right' as const,
                    render: (_: any, __: any, index: number) => (
                      <AntForm.Item name={[index, 'quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
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
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index]?.material_id !== curr?.items?.[index]?.material_id}>
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
                    title: '操作',
                    width: 60,
                    render: (_: any, __: any, index: number) => (
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} disabled={fields.length <= 1} />
                    ),
                  },
                ];
                return (
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <Table
                      size="small"
                      dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                      rowKey="key"
                      pagination={false}
                      columns={reqDetailColumns}
                      footer={() => (
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                          <Button
                            type="dashed"
                            icon={<PlusOutlined />}
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() =>
                              add({
                                material_id: undefined,
                                material_code: '',
                                material_name: '',
                                material_spec: '',
                                unit: '件',
                                quantity: 1,
                                suggested_unit_price: 0,
                              })
                            }
                          >
                            添加明细
                          </Button>
                          <Button
                            type="default"
                            icon={<ShoppingOutlined />}
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => setMaterialPickerOpen(true)}
                          >
                            {t('app.kuaizhizao.common.materialBatchSelect')}
                          </Button>
                        </div>
                      )}
                    />
                  </div>
                );
              }}
            </AntForm.List>
          </ProForm.Item>
        </ProFormItem>
        <ProFormTextArea name="notes" label="备注" placeholder="备注" />
        <MaterialBatchPickerModal
          open={materialPickerOpen}
          onCancel={() => setMaterialPickerOpen(false)}
          onConfirm={appendRequisitionItemsFromMaterials}
        />
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={`采购申请详情 - ${currentReq?.requisition_code || ''}`}
        open={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setCurrentReq(null);
        }}
        dataSource={currentReq || undefined}
        columns={detailColumns}
        width={DRAWER_CONFIG.HALF_WIDTH}
        extra={
          currentReq && (
            <DetailDrawerActions
              items={[
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
                      submit: (id) => submitPurchaseRequisition(id),
                      approve: (id) => approvePurchaseRequisition(id, { approved: true, review_remarks: '' }),
                      reject: (id, reason) => approvePurchaseRequisition(id, { approved: false, review_remarks: reason || '' }),
                      revoke: (id) => withdrawPurchaseRequisition(id),
                    }}
                    onSuccess={async () => {
                      actionRef.current?.reload();
                      if (currentReq?.id) {
                        try {
                          const res = await getPurchaseRequisition(currentReq.id);
                          setCurrentReq(res);
                        } catch { /* ignore */ }
                      }
                    }}
                  />
                ) },
                { key: 'convert', visible: currentReq.status === '已通过' || currentReq.status === '部分转单', render: () => <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => handleConvert(currentReq)}>下推采购单</Button> },
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
                <Row gutter={16}>
                  <Col span={8}><strong>申请编号：</strong>{currentReq.requisition_code}</Col>
                  <Col span={8}><strong>申请名称：</strong>{currentReq.requisition_name}</Col>
                  <Col span={8}><strong>状态：</strong><Tag>{currentReq.status}</Tag></Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={8}><strong>来源：</strong>{currentReq.source_code || '-'}</Col>
                  <Col span={8}><strong>要求到货日期：</strong>{currentReq.required_date || '-'}</Col>
                  <Col span={8}><strong>是否紧急：</strong>{currentReq.is_urgent ? '是' : '否'}</Col>
                </Row>
              </DetailDrawerSection>
              {(() => {
                const lifecycle = getPurchaseRequisitionLifecycle(currentReq);
                const mainStages = lifecycle.mainStages ?? [];
                const subStages = lifecycle.subStages ?? [];
                if (mainStages.length === 0 && subStages.length === 0) return null;
                return (
                  <DetailDrawerSection title="生命周期">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {mainStages.length > 0 && (
                        <UniLifecycleStepper
                          steps={mainStages}
                          status={lifecycle.status}
                          showLabels
                          nextStepSuggestions={lifecycle.nextStepSuggestions}
                        />
                      )}
                      {subStages.length > 0 && (
                        <div>
                          <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--ant-color-text-secondary)' }}>
                            执行中 · 全链路
                          </div>
                          <UniLifecycleStepper steps={subStages} showLabels />
                        </div>
                      )}
                    </div>
                  </DetailDrawerSection>
                );
              })()}
              {currentReq.items && currentReq.items.length > 0 && (
            <DetailDrawerSection title="申请明细">
              <Table
                size="small"
                columns={[
                  { title: '物料编号', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '数量', dataIndex: 'quantity', width: 90, align: 'right' },
                   { title: '单位', dataIndex: 'unit', width: 60 },
                  { 
                    title: '建议单价', 
                    dataIndex: 'suggested_unit_price', 
                    width: 130, 
                    align: 'right',
                    render: (v, record) => (
                      <Space size={4}>
                        ¥{Number(v || 0).toFixed(2)}
                        {record.material_id && <PriceHistoryInsight materialId={record.material_id} currentPrice={v} />}
                      </Space>
                    )
                  },
                  { title: '要求到货日期', dataIndex: 'required_date', width: 120 },
                  {
                    title: '已转单',
                    dataIndex: 'purchase_order_id',
                    width: 80,
                    render: (v) => (v ? <Tag color="success">是</Tag> : <Tag>否</Tag>),
                  },
                ]}
                dataSource={currentReq.items}
                pagination={false}
                rowKey="id"
                bordered
              />
            </DetailDrawerSection>
              )}
              {currentReq?.id && (
                <DetailDrawerSection title="操作历史">
                  <DocumentTrackingPanel documentType="purchase_requisition" documentId={currentReq.id} />
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
            width: 320,
            render: (_: unknown, record: PurchaseRequisitionItem) =>
              record.id != null && !record.purchase_order_id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择供应商"
                    value={rowSuppliers[record.id] || undefined}
                    onChange={(v: number) => setRowSuppliers((prev) => ({ ...prev, [record.id!]: v }))}
                    options={supplierOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                  {rowSuppliers[record.id] && (
                    <div style={{ transform: 'scale(0.85)', transformOrigin: 'left' }}>
                      <SupplierPerformanceTag supplierId={rowSuppliers[record.id]} />
                    </div>
                  )}
                </div>
              ) : record.purchase_order_id ? (
                '-'
              ) : null,
          },
          { 
            title: '比价助手', 
            width: 100, 
            align: 'center',
            render: (_: unknown, record: PurchaseRequisitionItem) => 
              record.id != null && record.material_id ? (
                <MultiSupplierPriceComparison 
                  materialId={record.material_id} 
                  onSelectSupplier={(sid) => setRowSuppliers((prev) => ({ ...prev, [record.id!]: sid }))}
                />
              ) : '-'
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
        scroll={{ x: 1100 }}
      />
    </div>
  );
};

export default PurchaseRequisitionsPage;
