/**
 * 销售退货单管理页面
 *
 * 提供销售退货单的创建、查看和管理功能
 *
 * @author RiverEdge Team
 * @date 2026-01-17
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProForm, ProFormText, ProFormDatePicker, ProFormTextArea, ProFormDigit, ProFormSelect, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Table, Row, Col, Form as AntForm, InputNumber, Input, Dropdown, Tag, Card, Typography, Spin, Empty } from 'antd';
import { EyeOutlined, CheckCircleOutlined, PlusOutlined, AppstoreAddOutlined, ImportOutlined, MoreOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { theme as AntdTheme } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, DetailDrawerSection } from '../../../../../components/layout-templates';
import { UniImport } from '../../../../../components/uni-import';
import { getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { initializeSystemDictionaries } from '../../../../../services/dataDictionary';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import type { Material } from '../../../../master-data/types/material';
import { warehouseApi } from '../../../services/production';
import { customerApi } from '../../../../master-data/services/supply-chain';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import dayjs from 'dayjs';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getSalesReturnLifecycle } from '../../../utils/salesReturnLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  DocumentTrackingRelationsTabsBody,
  DocumentTrackingTimelineBody,
  TraceLinkedDocumentBrief,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { renderRowActionsOverflow } from '../../../../../utils/renderRowActionsOverflow';

// 销售退货单接口定义
interface SalesReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  sales_delivery_id?: number;
  sales_delivery_code?: string;
  sales_order_id?: number;
  sales_order_code?: string;
  customer_id?: number;
  customer_name?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  return_time?: string;
  returner_id?: number;
  returner_name?: string;
  reviewer_id?: number;
  reviewer_name?: string;
  review_time?: string;
  review_status?: string;
  review_remarks?: string;
  return_reason?: string;
  return_type?: string;
  status?: string;
  total_quantity?: number;
  total_amount?: number;
  shipping_method?: string;
  tracking_number?: string;
  shipping_address?: string;
  notes?: string;
  created_at?: string;
}

interface SalesReturnDetail extends SalesReturn {
  items?: SalesReturnItem[];
}

interface SalesReturnItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  return_quantity?: number;
  unit_price?: number;
  total_amount?: number;
  batch_number?: string;
  expiry_date?: string;
  location_code?: string;
  serial_numbers?: string[];
  notes?: string;
}

/** 与后端 `system_dictionaries.py` 一致，租户未同步字典时的下拉兜底 */
const FALLBACK_RETURN_REASON: { label: string; value: string }[] = [
  { label: '质量问题', value: 'QUALITY_ISSUE' },
  { label: '规格不符', value: 'SPEC_MISMATCH' },
  { label: '数量错误', value: 'QTY_ERROR' },
  { label: '包装破损', value: 'PACKAGE_DAMAGE' },
  { label: '错发漏发', value: 'WRONG_OR_MISSING' },
  { label: '客户取消', value: 'CUSTOMER_CANCEL' },
  { label: '其他', value: 'OTHER' },
];

const FALLBACK_RETURN_TYPE: { label: string; value: string }[] = [
  { label: '换货', value: 'EXCHANGE' },
  { label: '退款', value: 'REFUND' },
  { label: '返修', value: 'REWORK' },
  { label: '报废退货', value: 'SCRAP_RETURN' },
  { label: '其他', value: 'OTHER' },
];

const FALLBACK_SHIPPING_METHOD: { label: string; value: string }[] = [
  { label: '快递', value: 'EXPRESS' },
  { label: '物流', value: 'LOGISTICS' },
  { label: '自提', value: 'SELF_PICKUP' },
  { label: '专车配送', value: 'DEDICATED' },
  { label: '空运', value: 'AIR' },
  { label: '海运', value: 'SEA' },
];

/** 详情抽屉外左侧全链路浮层（与销售订单/销售预测一致） */
const SALES_RETURN_FULL_CHAIN_FLOAT_MARGIN = 16;
const SALES_RETURN_LEFT_CHAIN_GAP = 16;
const SALES_RETURN_CHAIN_DRAWER_GAP = 16;
const SALES_RETURN_CHAIN_VERTICAL_TRIM = SALES_RETURN_FULL_CHAIN_FLOAT_MARGIN * 2 + SALES_RETURN_LEFT_CHAIN_GAP;
const salesReturnChainHalfHeightCss = `calc((100vh - ${SALES_RETURN_CHAIN_VERTICAL_TRIM}px) / 2)`;
const salesReturnChainPanelWidthCss = `calc(50vw - ${SALES_RETURN_FULL_CHAIN_FLOAT_MARGIN * 2 + SALES_RETURN_CHAIN_DRAWER_GAP}px)`;
const salesReturnBriefPanelTopCss = `calc(${SALES_RETURN_FULL_CHAIN_FLOAT_MARGIN}px + (100vh - ${SALES_RETURN_CHAIN_VERTICAL_TRIM}px) / 2 + ${SALES_RETURN_LEFT_CHAIN_GAP}px)`;

const SalesReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const { token } = AntdTheme.useToken();
  const returnDetailDrawerZIndex = token.zIndexPopupBase;
  const returnChainOverlayZIndex = token.zIndexPopupBase + 1;

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  // Drawer 相关状态
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<SalesReturnDetail | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);
  const [fullChainRefreshKey, setFullChainRefreshKey] = useState(0);
  const [fullChainTraceLoading, setFullChainTraceLoading] = useState(false);
  const [fullChainBriefDoc, setFullChainBriefDoc] = useState<{ document_type: string; document_id: number } | null>(
    null,
  );
  const salesReturnTracking = useDocumentTracking(
    detailDrawerVisible && returnDetail?.id ? 'sales_return' : undefined,
    returnDetail?.id,
    trackingRefreshKey,
  );

  const onFullChainGraphNodeClick = useCallback(
    (type: string, id: number) => {
      if (!id) return;
      if (type === 'sales_return' && returnDetail?.id != null && id === returnDetail.id) {
        setFullChainBriefDoc(null);
        return;
      }
      setFullChainBriefDoc({ document_type: type, document_id: id });
    },
    [returnDetail?.id],
  );

  useEffect(() => {
    if (detailDrawerVisible && returnDetail?.id != null) {
      setFullChainBriefDoc(null);
    }
  }, [detailDrawerVisible, returnDetail?.id]);
  const handleCopy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      messageApi.success('复制成功');
    } catch {
      messageApi.error('复制失败');
    }
  };

  
  // 创建/编辑相关状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const formRef = useRef<ProFormInstance>(null);
  const [returnReasonOptions, setReturnReasonOptions] = useState(FALLBACK_RETURN_REASON);
  const [returnTypeOptions, setReturnTypeOptions] = useState(FALLBACK_RETURN_TYPE);
  const [shippingMethodOptions, setShippingMethodOptions] = useState(FALLBACK_SHIPPING_METHOD);
  const [dictOptionsLoading, setDictOptionsLoading] = useState(false);

  /** 打开表单时拉取字典；若租户未初始化则尝试同步系统字典（与 core 配置一致） */
  useEffect(() => {
    if (!modalVisible) return;
    let cancelled = false;
    (async () => {
      setDictOptionsLoading(true);
      const loadAll = async () => {
        const [reason, rtype, ship] = await Promise.all([
          getDictionaryOptions('RETURN_REASON'),
          getDictionaryOptions('RETURN_TYPE'),
          getDictionaryOptions('SHIPPING_METHOD'),
        ]);
        return { reason, rtype, ship };
      };
      try {
        let { reason, rtype, ship } = await loadAll();
        if (!cancelled && (reason.length === 0 || rtype.length === 0 || ship.length === 0)) {
          try {
            await initializeSystemDictionaries();
            if (!cancelled) ({ reason, rtype, ship } = await loadAll());
          } catch (e) {
            console.warn('initializeSystemDictionaries failed:', e);
          }
        }
        if (!cancelled) {
          setReturnReasonOptions(reason.length ? reason : FALLBACK_RETURN_REASON);
          setReturnTypeOptions(rtype.length ? rtype : FALLBACK_RETURN_TYPE);
          setShippingMethodOptions(ship.length ? ship : FALLBACK_SHIPPING_METHOD);
        }
      } finally {
        if (!cancelled) setDictOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalVisible]);

  const renderSalesReturnRowActions = (actions: React.ReactNode[]) => {
    return renderRowActionsOverflow(actions, 'sales-return');
  };

  // 表格列定义
  const columns: ProColumns<SalesReturn>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, record) => (
        <Space size={4}>
          <span>{record.return_code || '-'}</span>
          {record.return_code ? (
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined style={{ fontSize: 12 }} />}
              onClick={(e) => {
                e.stopPropagation();
                handleCopy(record.return_code);
              }}
            />
          ) : null}
        </Space>
      ),
    },
    {
      title: '销售出库单编号',
      dataIndex: 'sales_delivery_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
      width: 140,
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
      width: 120,
      ellipsis: true,
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalQuantity') || '总数量',
      dataIndex: 'total_quantity',
      width: 100,
      align: 'right',
    },
    {
      title: t('app.kuaizhizao.salesReturn.totalAmount') || '总金额',
      dataIndex: 'total_amount',
      width: 120,
      align: 'right',
      render: (text: any) => `¥${Number(text || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: t('app.kuaizhizao.salesReturn.returnTime') || '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: t('common.createdAt') || '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 160,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 132,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <UniLifecycle
          value={getSalesReturnLifecycle(record as any)}
          showLabel
          showCircleTooltip={false}
          size="small"
        />
      ),
    },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => renderSalesReturnRowActions([
        <Button key="detail" type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>,
        ...(record.status === '待退货' ? [
          <Button key="confirm" type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(record)}>确认退货</Button>,
        ] : []),
        ...(record.status === '已退货' ? [
          <Button key="withdraw" type="link" size="small" onClick={() => handleWithdraw(record)}>撤回确认</Button>,
        ] : []),
      ]),
    },
  ];

  // 处理详情查看
  const handleDetail = async (record: SalesReturn) => {
    try {
      const detail = await warehouseApi.salesReturn.get(record.id!.toString());
      setReturnDetail(detail as SalesReturnDetail);
      setDetailDrawerVisible(true);
      setTrackingRefreshKey((k) => k + 1);
      setFullChainRefreshKey((k) => k + 1);
    } catch (error) {
      messageApi.error('获取销售退货单详情失败');
    }
  };

  // 处理新增
  const handleCreate = () => {
    setEditingId(null);
    setModalVisible(true);
  };

  // 处理确认退货
  const handleConfirm = async (record: SalesReturn) => {
    Modal.confirm({
      title: '确认销售退货',
      content: `确定要确认销售退货单 "${record.return_code}" 吗？确认后将自动更新库存。`,
      onOk: async () => {
        try {
          await warehouseApi.salesReturn.confirm(record.id!.toString());
          messageApi.success('销售退货确认成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '销售退货确认失败');
        }
      },
    });
  };

  const handleWithdraw = async (record: SalesReturn) => {
    Modal.confirm({
      title: '撤回退货确认',
      content: `确定要撤回销售退货单 "${record.return_code}" 的确认状态吗？`,
      onOk: async () => {
        try {
          await warehouseApi.salesReturn.withdraw(record.id!.toString());
          messageApi.success('已撤回到待退货');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '撤回失败');
        }
      },
    });
  };

  // 处理批量删除
  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${keys.length} 条销售退货单吗？`,
      onOk: async () => {
        try {
          for (const id of keys) {
            await warehouseApi.salesReturn.delete(String(id));
          }
          messageApi.success(`成功删除 ${keys.length} 条记录`);
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  // 表单提交处理
  const onFinish = async (values: any) => {
    try {
      if (editingId) {
        // 更新逻辑
        messageApi.warning('非草稿状态不支持编辑');
      } else {
        await warehouseApi.salesReturn.create(values);
        messageApi.success('销售退货单创建成功');
      }
      setModalVisible(false);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      return true;
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      return false;
    }
  };

  // 物料选择器追加明细
  const appendItemsFromMaterials = (materials: Material[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = materials.map(m => ({
      material_id: m.id,
      material_code: m.mainCode,
      material_name: m.name,
      material_spec: m.specification,
      material_unit: m.baseUnit,
      return_quantity: 1,
      unit_price: m.defaultPrice || 0,
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems]
    });
    setMaterialPickerOpen(false);
  };

  // Excel导入处理
  const handleImport = (data: any[]) => {
    const currentItems = formRef.current?.getFieldValue('items') || [];
    const newItems = data.map(row => ({
      material_code: row['物料编号'],
      return_quantity: Number(row['退货数量'] || 1),
      unit_price: Number(row['单价'] || 0),
      batch_number: row['批次号'],
      notes: row['备注'],
    }));
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems]
    });
    setImportModalVisible(false);
  };

  // 详情列 definition
  const detailColumns: ProDescriptionsItemProps<SalesReturnDetail>[] = [
    {
      title: '退货单编号',
      dataIndex: 'return_code',
    },
    {
      title: '销售出库单编号',
      dataIndex: 'sales_delivery_code',
    },
    {
      title: '销售订单编号',
      dataIndex: 'sales_order_code',
    },
    {
      title: '客户',
      dataIndex: 'customer_name',
    },
    {
      title: '仓库',
      dataIndex: 'warehouse_name',
    },
    {
      title: '退货状态',
      dataIndex: 'status',
      render: (status) => {
        const statusMap: Record<string, { text: string; color: string }> = {
          '待退货': { text: '待退货', color: 'default' },
          '已退货': { text: '已退货', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const config = statusMap[(status as any) || ''] || { text: (status as any) || '-', color: 'default' };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '退货原因',
      dataIndex: 'return_reason',
    },
    {
      title: '退货类型',
      dataIndex: 'return_type',
    },
    {
      title: '总数量',
      dataIndex: 'total_quantity',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (text) => `¥${text?.toLocaleString() || 0}`,
    },
    {
      title: '退货时间',
      dataIndex: 'return_time',
      valueType: 'dateTime',
    },
    {
      title: '退货人',
      dataIndex: 'returner_name',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      span: 2,
      render: (text: any) => text || '-',
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="销售退货"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton={true}
          createButtonText="新建销售退货单"
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.salesReturn.list({
                skip: (params.current! - 1) * params.pageSize!,
                limit: params.pageSize,
                status: params.status,
                sales_delivery_id: params.sales_delivery_id,
                customer_id: params.customer_id,
              });
              return {
                data: Array.isArray(response) ? response : response.data || [],
                success: true,
                total: Array.isArray(response) ? response.length : response.total || 0,
              };
            } catch (error) {
              messageApi.error('获取销售退货单列表失败');
              return {
                data: [],
                success: false,
                total: 0,
              };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={handleDelete}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editingId ? '编辑销售退货单' : '新增销售退货单'}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={onFinish}
        formRef={formRef}
      >
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="customer_id"
              label="客户"
              placeholder="请选择客户"
              required
              request={async () => {
                const res = await customerApi.list({ limit: 1000, isActive: true });
                const list = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
                return list.map((c: any) => ({
                  label: c.name || c.customer_name || c.code || `客户${c.id}`,
                  value: c.id ?? c.customer_id,
                }));
              }}
              fieldProps={{
                showSearch: true,
                optionFilterProp: 'label',
                onChange: (_, option) => {
                  formRef.current?.setFieldsValue({ customer_name: (option as any)?.label ?? '' });
                },
              }}
              rules={[{ required: true, message: '请选择客户' }]}
            />
            <ProFormText name="customer_name" hidden />
          </Col>
          <Col span={8}>
            <UniWarehouseSelect
              name="warehouse_id"
              label="退入仓库"
              placeholder="请选择仓库"
              required
              onChange={(_, wh) => formRef.current?.setFieldsValue({ warehouse_name: wh?.name ?? '' })}
              rules={[{ required: true, message: '请选择仓库' }]}
            />
            <ProFormText name="warehouse_name" hidden />
          </Col>
          <Col span={8}>
            <ProFormDatePicker
              name="return_time"
              label="退货日期"
              required
              fieldProps={{ style: { width: '100%' } }}
              initialValue={dayjs()}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <ProFormSelect
              name="return_reason"
              label="退货原因"
              placeholder="请选择退货原因"
              options={returnReasonOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="return_type"
              label="退货类型"
              placeholder="请选择退货类型"
              options={returnTypeOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
          <Col span={8}>
            <ProFormSelect
              name="shipping_method"
              label="发货方式"
              placeholder="请选择发货方式"
              options={shippingMethodOptions}
              fieldProps={{ showSearch: true, allowClear: true, loading: dictOptionsLoading }}
            />
          </Col>
        </Row>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
              退货明细
            </span>
            <Button
              size="small"
              icon={<ImportOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              导入明细
            </Button>
          </div>
          <ProForm.Item name="items" noStyle rules={[{ required: true, message: '请添加至少一项明细' }]}>
            <AntForm.List name="items">
              {(fields, { add, remove }) => (
                <Table
                  size="small"
                  dataSource={fields}
                  pagination={false}
                  rowKey="key"
                  columns={[
                    {
                      title: '物料',
                      dataIndex: 'material_id',
                      width: 260,
                      render: (_, field) => (
                        <UniMaterialSelect
                          name={[field.name, 'material_id']}
                          label=""
                          placeholder="选择物料"
                          required
                          size="small"
                          listFieldKey={field.name}
                          listFieldName="items"
                          fillMapping={{
                            material_code: 'mainCode',
                            material_name: 'name',
                            material_spec: 'specification',
                            material_unit: 'baseUnit',
                          }}
                          showAdvancedSearch
                        />
                      ),
                    },
                    {
                      title: '退货数量',
                      dataIndex: 'return_quantity',
                      width: 120,
                      render: (_, field) => (
                        <AntForm.Item name={[field.name, 'return_quantity']} noStyle>
                          <InputNumber size="small" style={{ width: '100%' }} min={1} />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '单价',
                      dataIndex: 'unit_price',
                      width: 120,
                      render: (_, field) => (
                        <AntForm.Item name={[field.name, 'unit_price']} noStyle>
                          <InputNumber size="small" style={{ width: '100%' }} min={0} prefix="¥" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '操作',
                      width: 60,
                      render: (_, field) => (
                        <Button type="link" danger onClick={() => remove(field.name)}>删除</Button>
                      ),
                    },
                  ]}
                  footer={() => (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        style={{ flex: 1, minWidth: 120 }}
                        onClick={() => add({ return_quantity: 1, unit_price: 0 })}
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
              )}
            </AntForm.List>
          </ProForm.Item>
        </div>

        <ProFormTextArea name="notes" label="备注" placeholder="请输入备注说明" fieldProps={{ rows: 3 }} />
      </FormModalTemplate>

      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendItemsFromMaterials}
      />

      <UniImport
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onConfirm={handleImport}
        title="导入销售退货明细"
        headers={['物料编号', '退货数量', '单价', '批次号', '备注']}
        exampleRow={['MAT001', '10', '99.5', 'B20260117001', '备注说明']}
      />

      {detailDrawerVisible && returnDetail?.id != null ? (
        <>
          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.relationsFullChainTitle')}
            style={{
              position: 'fixed',
              left: SALES_RETURN_FULL_CHAIN_FLOAT_MARGIN,
              top: SALES_RETURN_FULL_CHAIN_FLOAT_MARGIN,
              width: salesReturnChainPanelWidthCss,
              height: salesReturnChainHalfHeightCss,
              zIndex: returnChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                    {t('components.documentTrackingPanel.relationsFullChainTitle')}
                  </div>
                </div>
                <Button
                  type="default"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={fullChainTraceLoading}
                  style={{ flexShrink: 0 }}
                  onClick={() => setFullChainRefreshKey((k) => k + 1)}
                >
                  {t('components.documentRelationGraph.refresh')}
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DocumentTrackingRelationsTabsBody
                documentType="sales_return"
                documentId={returnDetail.id}
                refreshKey={fullChainRefreshKey}
                onDocumentClick={onFullChainGraphNodeClick}
                compact
                hideInlineRefresh
                onTraceLoadingChange={setFullChainTraceLoading}
              />
            </div>
          </div>

          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.traceBriefTitle')}
            style={{
              position: 'fixed',
              left: SALES_RETURN_FULL_CHAIN_FLOAT_MARGIN,
              top: salesReturnBriefPanelTopCss,
              width: salesReturnChainPanelWidthCss,
              height: salesReturnChainHalfHeightCss,
              zIndex: returnChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 8,
                flexShrink: 0,
                color: 'var(--ant-color-text)',
              }}
            >
              {t('components.documentTrackingPanel.traceBriefTitle')}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <TraceLinkedDocumentBrief
                documentType={fullChainBriefDoc?.document_type}
                documentId={fullChainBriefDoc?.document_id}
                compactChrome
              />
            </div>
            {fullChainBriefDoc ? (
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: '1px solid var(--ant-color-border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                }}
              >
                <Space wrap>
                  <Button onClick={() => setFullChainBriefDoc(null)}>
                    {t('components.documentTrackingPanel.traceBriefDismiss')}
                  </Button>
                  {fullChainBriefDoc.document_type === 'quotation' ? (
                    <Button
                      type="primary"
                      onClick={() => {
                        setDetailDrawerVisible(false);
                        navigate('/apps/kuaizhizao/sales-management/quotations', {
                          state: { openQuotationDetailId: fullChainBriefDoc.document_id },
                        });
                      }}
                    >
                      {t('components.documentTrackingPanel.traceBriefOpenQuotation')}
                    </Button>
                  ) : null}
                </Space>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* 详情Drawer */}
      <DetailDrawerTemplate
        title={`销售退货单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        zIndex={returnDetailDrawerZIndex}
        onClose={() => {
          setDetailDrawerVisible(false);
          setReturnDetail(null);
          setFullChainBriefDoc(null);
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        dataSource={returnDetail || undefined}
        customContent={
          returnDetail ? (
            <div style={{ padding: '16px 0' }}>
              <DetailDrawerSection title="基本信息">
                <Table
                  size="small"
                  pagination={false}
                  columns={[
                    { title: '字段', dataIndex: 'k', width: 120 },
                    { title: '值', dataIndex: 'v' },
                  ]}
                  dataSource={[
                    {
                      key: 'return_code',
                      k: '退货单编号',
                      v: (
                        <Space size={4}>
                          <span>{returnDetail.return_code || '-'}</span>
                          {returnDetail.return_code ? <Button type="link" size="small" icon={<CopyOutlined style={{ fontSize: 12 }} />} onClick={() => handleCopy(returnDetail.return_code)} /> : null}
                        </Space>
                      ),
                    },
                    { key: 'sales_delivery_code', k: '销售出库单编号', v: returnDetail.sales_delivery_code || '-' },
                    { key: 'sales_order_code', k: '销售订单编号', v: returnDetail.sales_order_code || '-' },
                    { key: 'customer_name', k: '客户', v: returnDetail.customer_name || '-' },
                    { key: 'warehouse_name', k: '仓库', v: returnDetail.warehouse_name || '-' },
                    { key: 'status', k: '状态', v: returnDetail.status || '-' },
                    { key: 'return_reason', k: '退货原因', v: returnDetail.return_reason || '-' },
                    { key: 'return_type', k: '退货类型', v: returnDetail.return_type || '-' },
                    { key: 'return_time', k: '退货时间', v: returnDetail.return_time || '-' },
                    { key: 'notes', k: '备注', v: returnDetail.notes || '-' },
                  ]}
                  rowKey="key"
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getSalesReturnLifecycle(returnDetail as any);
                    return (
                      <>
                        {(lifecycle.mainStages ?? []).length > 0 && (
                          <UniLifecycleStepper
                            steps={lifecycle.mainStages ?? []}
                            status={lifecycle.status}
                            showLabels
                            nextStepSuggestions={lifecycle.nextStepSuggestions}
                            hideNextStepSuggestions
                          />
                        )}
                        {(lifecycle.subStages ?? []).length > 0 && <UniLifecycleStepper steps={lifecycle.subStages ?? []} showLabels />}
                      </>
                    );
                  })()}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <style>{`
                  .sales-return-detail-items .ant-table-wrapper .ant-table-body,
                  .sales-return-detail-items .ant-table-wrapper .ant-table-content {
                    overflow: visible !important;
                  }
                  .sales-return-detail-items .ant-table-thead > tr > th {
                    white-space: nowrap !important;
                  }
                `}</style>
                {returnDetail.items && returnDetail.items.length > 0 ? (
                  <div className="sales-return-detail-items" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                    <Table
                      size="small"
                      pagination={false}
                      tableLayout="fixed"
                      style={{ minWidth: 860 }}
                      columns={[
                        { title: '物料编号', dataIndex: 'material_code', width: 120 },
                        { title: '物料名称', dataIndex: 'material_name', width: 150 },
                        { title: '退货数量', dataIndex: 'return_quantity', width: 100, align: 'right' },
                        { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                        { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (text) => `¥${text || 0}` },
                        { title: '批次号', dataIndex: 'batch_number', width: 120 },
                        { title: '库位', dataIndex: 'location_code', width: 100 },
                      ]}
                      dataSource={returnDetail.items}
                      rowKey="id"
                    />
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细" />
                )}
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {salesReturnTracking.loading && <Spin />}
                {salesReturnTracking.error && <Typography.Text type="danger">{salesReturnTracking.error}</Typography.Text>}
                {salesReturnTracking.data && <DocumentTrackingTimelineBody data={salesReturnTracking.data} />}
              </DetailDrawerSection>
            </div>
          ) : null
        }
      />
    </>
  );
};

export default SalesReturnsPage;
