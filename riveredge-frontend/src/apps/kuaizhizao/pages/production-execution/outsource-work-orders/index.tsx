import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工单委外管理页面
 *
 * 提供工单委外的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 * 支持委外发料、委外收货等功能。
 *
 * 根据功能点2.1.10：工单委外管理（核心功能，新增）
 *
 * Author: Auto (AI Assistant)
 * Date: 2026-01-16
 * Updated: 2026-01-20（重命名为工单委外）
 */

import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import type { DescriptionsProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDigit,
  ProFormTextArea,
  ProFormDependency,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Tag,
  Modal,
  Descriptions,
  Typography,
  Dropdown,
  Empty,
  Spin,
  Form,
  theme as AntdTheme,
} from 'antd';
import { EditOutlined, EyeOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import CodeField from '../../../../../components/code-field';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import {
  ListPageTemplate,
  FormModalTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection, DetailDrawerInlineFullChain,
  MODAL_CONFIG,
  DRAWER_CONFIG,
  type StatCard,
} from '../../../../../components/layout-templates';
import { SimpleSparkline } from '../../../../../components';
import { outsourceWorkOrderApi, outsourceMaterialIssueApi, outsourceMaterialReceiptApi } from '../../../services/production';
import OutsourceIssueFormContent, { type OutsourceIssueLine } from '../../../components/OutsourceIssueFormContent';
import OutsourceReceiptFormContent, {
  buildReceiptLineFromWorkOrder,
  type OutsourceReceiptLine,
} from '../../../components/OutsourceReceiptFormContent';
import { getOutsourceWorkOrderLifecycle } from '../../../utils/outsourceWorkOrderLifecycle';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { WarehouseTraceBriefPrimaryActions } from '../../warehouse-management/WarehouseTraceBriefFooter';
import { supplierApi, unwrapSupplyPagedList } from '../../../../master-data/services/supply-chain';
import { materialApi } from '../../../../master-data/services/material';
import { warehouseApi } from '../../../../master-data/services/warehouse';
import dayjs from 'dayjs';
import { AmountDisplay } from '../../../../../components/permission';
import { KUAIZHIZAO_OUTSOURCE_ORDER_FIELD_RESOURCE as OO } from '../../../constants/fieldPermissionResources';
import { useTranslation } from 'react-i18next';
import { useCustomFields } from '../../../../../hooks/useCustomFields';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsFormSection,
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { mapAttachmentsToUploadList, normalizeDocumentAttachments } from '../../../utils/documentAttachments';

const OUTSOURCE_WORK_ORDER_CUSTOM_FIELD_TABLE = 'apps_kuaizhizao_outsource_work_orders';

interface OutsourceWorkOrder {
  id?: number;
  tenantId?: number;
  code?: string;
  name?: string;
  productId?: number;
  productCode?: string;
  productName?: string;
  quantity?: number;
  supplierId?: number;
  supplierCode?: string;
  supplierName?: string;
  outsourceOperation?: string;
  unitPrice?: number;
  totalAmount?: number;
  status?: string;
  priority?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  receivedQuantity?: number;
  qualifiedQuantity?: number;
  unqualifiedQuantity?: number;
  issuedQuantity?: number;
  isFrozen?: boolean;
  freezeReason?: string;
  frozenAt?: string;
  frozenBy?: number;
  frozenByName?: string;
  remarks?: string;
  attachments?: Array<{ uid?: string; name?: string; url?: string }>;
  createdAt?: string;
  updatedAt?: string;
  /** 后端 snake_case */
  tenant_id?: number;
  product_id?: number;
  product_code?: string;
  product_name?: string;
  supplier_id?: number;
  supplier_code?: string;
  supplier_name?: string;
  outsource_operation?: string;
  unit_price?: number;
  total_amount?: number;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  issued_quantity?: number;
  received_quantity?: number;
  qualified_quantity?: number;
  unqualified_quantity?: number;
  updated_at?: string;
}

const PRIORITY_FALLBACK = [
  { label: '低', value: 'low' },
  { label: '正常', value: 'normal' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' },
];

function unwrapMaterialList(response: unknown): any[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data;
    if (Array.isArray(r.items)) return r.items;
  }
  return [];
}

function buildDescriptionItemsFromColumns<T extends Record<string, any>>(
  dataSource: T,
  cols: ProDescriptionsItemProps<T>[]
): NonNullable<DescriptionsProps['items']> {
  return cols.map((col, index) => {
    const dataIndex = col.dataIndex as keyof T | undefined;
    const value = dataIndex != null ? dataSource[dataIndex] : undefined;
    let content: React.ReactNode = value as React.ReactNode;
    if (col.valueType === 'dateTime' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD HH:mm:ss');
    } else if (col.valueType === 'date' && value) {
      content = dayjs(value as string).format('YYYY-MM-DD');
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

function renderOwoRowActions(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode {
  return nodes;
}

const OWO_STAT_SPARK_1 = [2, 3, 4, 3, 5, 4, 6];
const OWO_STAT_SPARK_2 = [1, 2, 1, 0, 2, 1, 1];
const OWO_STAT_SPARK_3 = [3, 4, 5, 6, 5, 7, 8];

export const OutsourceWorkOrdersTable: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = AntdTheme.useToken();
  const outsourceWorkOrderDetailDrawerZIndex = token.zIndexPopupBase;
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [statsVersion, setStatsVersion] = useState(0);
  const [localStats, setLocalStats] = useState({ total: 0, draft: 0, inProgress: 0 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);


  // 产品列表状态（只显示委外件）
  const [productList, setProductList] = useState<any[]>([]);
  // 供应商列表状态
  const [supplierList, setSupplierList] = useState<any[]>([]);
  const [priorityOptions, setPriorityOptions] = useState<Array<{ label: string; value: string }>>(PRIORITY_FALLBACK);
  const [priorityLoading, setPriorityLoading] = useState(false);

  // Modal 相关状态（创建/编辑工单委外）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentWorkOrder, setCurrentWorkOrder] = useState<OutsourceWorkOrder | null>(null);
  const formRef = useRef<any>(null);

  const {
    customFields: owoFormCustomFields,
    customFieldValues: owoFormCustomFieldValues,
    loadFieldValues: loadOwoFormFieldValues,
    extractFormValues: extractOwoFormValues,
    saveCustomFieldValues: saveOwoCustomFieldValues,
    resetFieldValues: resetOwoFormFieldValues,
  } = useCustomFields({ tableName: OUTSOURCE_WORK_ORDER_CUSTOM_FIELD_TABLE, loadWhenOpen: true, open: modalVisible });

  const {
    customFields: owoListCustomFields,
    generateCustomFieldColumns: generateOwoCustomFieldColumns,
    enrichRecordsWithCustomFields: enrichOwoRecordsWithCustomFields,
    customFieldValues: owoDetailCustomFieldValues,
    loadFieldValuesForDetail: loadOwoFieldValuesForDetail,
    resetDetailFieldValues: resetOwoDetailFieldValues,
  } = useCustomFieldsForList<OutsourceWorkOrder>({ tableName: OUTSOURCE_WORK_ORDER_CUSTOM_FIELD_TABLE });

  useEffect(() => {
    if (owoListCustomFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [owoListCustomFields.length]);

  // 详情 Drawer 相关状态
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [workOrderDetail, setWorkOrderDetail] = useState<OutsourceWorkOrder | null>(null);

  const [owoTrackingRefreshKey, setOwoTrackingRefreshKey] = useState(0);

  const outsourceWorkOrderTracking = useDocumentTracking(
    drawerVisible && workOrderDetail?.id ? 'outsource_work_order' : undefined,
    workOrderDetail?.id,
    owoTrackingRefreshKey,
  );

  const refreshLocalStats = useCallback(async () => {
    try {
      const response = await outsourceWorkOrderApi.list({ skip: 0, limit: 1000 });
      const arr = Array.isArray(response)
        ? response
        : (response as any)?.data || (response as any)?.items || [];
      const list = Array.isArray(arr) ? arr : [];
      setLocalStats({
        total: list.length,
        draft: list.filter((x: OutsourceWorkOrder) => (x.status || '').trim() === 'draft').length,
        inProgress: list.filter((x: OutsourceWorkOrder) => (x.status || '').trim() === 'in_progress').length,
      });
    } catch {
      setLocalStats({ total: 0, draft: 0, inProgress: 0 });
    }
  }, []);

  useEffect(() => {
    void refreshLocalStats();
  }, [statsVersion, refreshLocalStats]);

  // 委外发料 Modal 相关状态
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [currentWorkOrderForIssue, setCurrentWorkOrderForIssue] = useState<OutsourceWorkOrder | null>(null);
  const [issueLines, setIssueLines] = useState<OutsourceIssueLine[]>([]);
  const [issuePreviewLoading, setIssuePreviewLoading] = useState(false);
  const [issuePreviewMessage, setIssuePreviewMessage] = useState<string | null>(null);
  const issueFormRef = useRef<any>(null);

  // 委外收货 Modal 相关状态
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [currentWorkOrderForReceipt, setCurrentWorkOrderForReceipt] = useState<OutsourceWorkOrder | null>(null);
  const [receiptLine, setReceiptLine] = useState<OutsourceReceiptLine | null>(null);
  const receiptFormRef = useRef<any>(null);

  // 当前选中产品的物料来源信息
  const [selectedMaterialSourceInfo, setSelectedMaterialSourceInfo] = useState<{
    sourceType?: string;
    sourceTypeName?: string;
    supplierId?: number;
    supplierCode?: string;
    supplierName?: string;
    outsourceOperation?: string;
    unitPrice?: number;
    validationErrors?: string[];
    canCreateWorkOrder?: boolean;
  } | null>(null);

  // 初始化数据
  useEffect(() => {
    const loadData = async () => {
      try {
        // 加载产品列表（只显示委外件）
        const productsRes = await materialApi.list({ isActive: true, limit: 1000 });
        const outsourceProducts = unwrapMaterialList(productsRes).filter((p: any) =>
          (p.sourceType === 'Outsource' || p.source_type === 'Outsource')
        );
        setProductList(outsourceProducts);

        // 加载供应商列表
        const suppliers = unwrapSupplyPagedList(await supplierApi.list({ isActive: true }));
        setSupplierList(suppliers);
      } catch (error) {
        window.console.error('获取数据失败:', error);
        messageApi.error('获取数据失败');
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadPriority = async () => {
      setPriorityLoading(true);
      try {
        const dict = await getDataDictionaryByCode('WORK_ORDER_PRIORITY');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPriorityOptions(items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value })));
      } catch {
        setPriorityOptions(PRIORITY_FALLBACK);
      } finally {
        setPriorityLoading(false);
      }
    };
    loadPriority();
  }, []);

  const detailBaseColumns: ProDescriptionsItemProps<OutsourceWorkOrder>[] = useMemo(
    () => [
      {
        title: '工单委外编号',
        dataIndex: 'code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
        ),
      },
      { title: '工单委外名称', dataIndex: 'name' },
      {
        title: '产品编号',
        dataIndex: ['productCode', 'product_code'] as any,
        render: (_, record) => (
          <Typography.Text copyable={{ text: String(record.productCode || record.product_code || '') }}>
            {record.productCode || record.product_code || '-'}
          </Typography.Text>
        ),
      },
      {
        title: '产品名称',
        dataIndex: ['productName', 'product_name'] as any,
        render: (_, record) => record.productName || record.product_name || '-',
      },
      {
        title: '委外数量',
        dataIndex: 'quantity',
        render: (_, record) => (record.quantity != null ? Number(record.quantity).toFixed(2) : '-'),
      },
      {
        title: '委外供应商',
        dataIndex: ['supplierName', 'supplier_name'] as any,
        render: (_, record) => record.supplierName || record.supplier_name || '-',
      },
      {
        title: '委外工序',
        dataIndex: ['outsourceOperation', 'outsource_operation'] as any,
        render: (_, record) => record.outsourceOperation || record.outsource_operation || '-',
      },
      {
        title: '委外单价',
        dataIndex: ['unitPrice', 'unit_price'] as any,
        render: (_, record) => {
          const price = record.unitPrice || record.unit_price;
          return price != null ? (
            <AmountDisplay resource={OO} fieldName="unit_price" value={Number(price)} />
          ) : (
            '-'
          );
        },
      },
      {
        title: '委外总金额',
        dataIndex: ['totalAmount', 'total_amount'] as any,
        render: (_, record) => {
          const amount = record.totalAmount || record.total_amount;
          return amount != null ? (
            <AmountDisplay resource={OO} fieldName="total_amount" value={Number(amount)} />
          ) : (
            '-'
          );
        },
      },
      {
        title: '状态',
        dataIndex: 'status',
        render: (_, record) => {
          const statusMap: Record<string, { color: string; text: string }> = {
            draft: { color: 'default', text: '草稿' },
            released: { color: 'processing', text: '已下达' },
            in_progress: { color: 'processing', text: '执行中' },
            completed: { color: 'success', text: '已完成' },
            cancelled: { color: 'error', text: '已取消' },
          };
          const status = statusMap[record.status || 'draft'] || { color: 'default', text: record.status || '未知' };
          return <Tag color={status.color}>{status.text}</Tag>;
        },
      },
      {
        title: '优先级',
        dataIndex: 'priority',
        render: (_, record) => {
          const priorityMap: Record<string, { color: string; text: string }> = {
            low: { color: 'default', text: '低' },
            normal: { color: 'blue', text: '正常' },
            high: { color: 'orange', text: '高' },
            urgent: { color: 'red', text: '紧急' },
          };
          const priority = priorityMap[record.priority || 'normal'] || { color: 'default', text: record.priority || '正常' };
          return <Tag color={priority.color}>{priority.text}</Tag>;
        },
      },
      {
        title: '已发料数量',
        dataIndex: ['issuedQuantity', 'issued_quantity'] as any,
        render: (_, record) => {
          const qty = record.issuedQuantity || record.issued_quantity;
          return qty ? Number(qty).toFixed(2) : '0.00';
        },
      },
      {
        title: '已收货数量',
        dataIndex: ['receivedQuantity', 'received_quantity'] as any,
        render: (_, record) => {
          const qty = record.receivedQuantity || record.received_quantity;
          return qty ? Number(qty).toFixed(2) : '0.00';
        },
      },
      {
        title: '合格数量',
        dataIndex: ['qualifiedQuantity', 'qualified_quantity'] as any,
        render: (_, record) => {
          const qty = record.qualifiedQuantity || record.qualified_quantity;
          return qty ? Number(qty).toFixed(2) : '0.00';
        },
      },
      {
        title: '不合格数量',
        dataIndex: ['unqualifiedQuantity', 'unqualified_quantity'] as any,
        render: (_, record) => {
          const qty = record.unqualifiedQuantity || record.unqualified_quantity;
          return qty ? Number(qty).toFixed(2) : '0.00';
        },
      },
      {
        title: '计划开始时间',
        dataIndex: ['plannedStartDate', 'planned_start_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.plannedStartDate || record.planned_start_date;
          return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: '计划结束时间',
        dataIndex: ['plannedEndDate', 'planned_end_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.plannedEndDate || record.planned_end_date;
          return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: '实际开始时间',
        dataIndex: ['actualStartDate', 'actual_start_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.actualStartDate || record.actual_start_date;
          return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
      {
        title: '实际结束时间',
        dataIndex: ['actualEndDate', 'actual_end_date'] as any,
        valueType: 'dateTime',
        render: (_, record) => {
          const date = record.actualEndDate || record.actual_end_date;
          return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
        },
      },
    ],
    []
  );

  const detailRemarksColumn: ProDescriptionsItemProps<OutsourceWorkOrder> = {
    title: '备注',
    dataIndex: 'remarks',
    span: 3,
    render: (text) => text || '-',
  };

  /** 产品选择变更：获取物料来源信息并自动填充 */
  const handleProductChange = async (value: number | undefined) => {
    if (value) {
      const selectedMaterial = productList.find(p => p.id === value);
      if (selectedMaterial) {
        try {
          const materialDetail = await materialApi.get(selectedMaterial.uuid);
          const sourceType = materialDetail.sourceType || materialDetail.source_type;
          const sourceConfig = materialDetail.sourceConfig || materialDetail.source_config || {};

          const sourceTypeNames: Record<string, string> = {
            Make: '自制件',
            Buy: '采购件',
            Phantom: '虚拟件',
            Outsource: '委外件',
            Configure: '配置件',
          };

          if (sourceType === 'Outsource') {
            const supplierId = sourceConfig.outsource_supplier_id;
            const supplierCode = sourceConfig.outsource_supplier_code;
            const supplierName = sourceConfig.outsource_supplier_name;
            const outsourceOperation = sourceConfig.outsource_operation;
            const unitPrice = sourceConfig.outsource_price;

            setSelectedMaterialSourceInfo({
              sourceType,
              sourceTypeName: sourceTypeNames[sourceType] || sourceType,
              supplierId,
              supplierCode,
              supplierName,
              outsourceOperation,
              unitPrice,
              canCreateWorkOrder: true,
            });

            if (supplierId) {
              formRef.current?.setFieldsValue({
                supplierId,
                outsourceOperation,
                unitPrice,
              });
            }
          } else {
            const st = String(sourceType ?? '');
            setSelectedMaterialSourceInfo({
              sourceType,
              sourceTypeName: sourceTypeNames[st] || st,
              canCreateWorkOrder: false,
              validationErrors: [`物料来源类型不是委外件（Outsource），当前类型：${st}`],
            });
          }
        } catch (error) {
          console.error('获取物料详情失败:', error);
          setSelectedMaterialSourceInfo(null);
        }
      } else {
        setSelectedMaterialSourceInfo(null);
      }
    } else {
      setSelectedMaterialSourceInfo(null);
    }
  };

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setIsEdit(false);
    setCurrentWorkOrder(null);
    setSelectedMaterialSourceInfo(null);
    resetOwoFormFieldValues();
    setModalVisible(true);
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
  };

  /**
   * 处理编辑工单委外
   */
  const handleEdit = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setIsEdit(true);
      setCurrentWorkOrder(detail);
      setModalVisible(true);
      window.setTimeout(() => {
        formRef.current?.setFieldsValue({
          name: detail.name,
          productId: detail.productId || detail.product_id,
          quantity: detail.quantity,
          supplierId: detail.supplierId || detail.supplier_id,
          outsourceOperation: detail.outsourceOperation || detail.outsource_operation,
          unitPrice: detail.unitPrice || detail.unit_price,
          priority: detail.priority,
          plannedStartDate: (detail.plannedStartDate || detail.planned_start_date) ? dayjs(detail.plannedStartDate || detail.planned_start_date) : undefined,
          plannedEndDate: (detail.plannedEndDate || detail.planned_end_date) ? dayjs(detail.plannedEndDate || detail.planned_end_date) : undefined,
          remarks: detail.remarks,
          attachments: mapAttachmentsToUploadList((detail as any).attachments),
        });
        if (detail.id != null) {
          loadOwoFormFieldValues(detail.id).then((fieldFormValues) => {
            formRef.current?.setFieldsValue(fieldFormValues);
          });
        }
      }, 100);
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理删除工单委外
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请选择要删除的工单委外');
      return;
    }
    try {
      const ids = keys.map((k) => Number(k));
      for (const id of keys) {
        await outsourceWorkOrderApi.delete(String(id));
      }
      messageApi.success(`成功删除 ${keys.length} 条记录`);
      setSelectedRowKeys([]);
      if (workOrderDetail?.id != null && ids.includes(workOrderDetail.id)) {
        setDrawerVisible(false);
        setWorkOrderDetail(null);
      }
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理查看详情
   */
  const handleDetail = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setWorkOrderDetail(detail);
      setDrawerVisible(true);
      setOwoTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        await loadOwoFieldValuesForDetail(detail.id);
      }
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理提交表单
   */
  const handleSubmit = async (values: any): Promise<void> => {
    try {
      const { customData, standardValues } = extractOwoFormValues(values);
      Object.keys(values).forEach((key) => {
        if (key.startsWith('custom_')) delete values[key];
      });
      Object.assign(values, standardValues);

      // 物料来源验证
      if (values.productId && selectedMaterialSourceInfo) {
        if (selectedMaterialSourceInfo.canCreateWorkOrder === false) {
          messageApi.error('该物料来源类型不允许创建工单委外，请选择其他物料');
          throw new Error('物料来源类型不允许创建工单委外');
        }
      }

      // 处理日期格式（转换为下划线命名）
      if (values.plannedStartDate) {
        values.planned_start_date = values.plannedStartDate.format('YYYY-MM-DD HH:mm:ss');
        delete values.plannedStartDate;
      }
      if (values.plannedEndDate) {
        values.planned_end_date = values.plannedEndDate.format('YYYY-MM-DD HH:mm:ss');
        delete values.plannedEndDate;
      }

      // 处理产品信息（转换为下划线命名）
      if (values.productId) {
        values.product_id = values.productId;
        delete values.productId;
        const selectedProduct = productList.find(p => p.id === values.product_id);
        if (selectedProduct) {
          values.product_code = selectedProduct.code || selectedProduct.mainCode;
          values.product_name = selectedProduct.name;
        }
      }

      // 处理供应商信息（转换为下划线命名）
      if (values.supplierId) {
        values.supplier_id = values.supplierId;
        delete values.supplierId;
        const selectedSupplier = supplierList.find(s => s.id === values.supplier_id);
        if (selectedSupplier) {
          values.supplier_code = selectedSupplier.code;
          values.supplier_name = selectedSupplier.name;
        }
      }

      // 如果从物料来源信息中获取了委外工序和单价，使用它们（转换为下划线命名）
      if (selectedMaterialSourceInfo) {
        if (!values.outsource_operation && selectedMaterialSourceInfo.outsourceOperation) {
          values.outsource_operation = selectedMaterialSourceInfo.outsourceOperation;
        }
        if (!values.unit_price && selectedMaterialSourceInfo.unitPrice) {
          values.unit_price = selectedMaterialSourceInfo.unitPrice;
        }
        if (!values.supplier_id && selectedMaterialSourceInfo.supplierId) {
          values.supplier_id = selectedMaterialSourceInfo.supplierId;
          values.supplier_code = selectedMaterialSourceInfo.supplierCode;
          values.supplier_name = selectedMaterialSourceInfo.supplierName;
        }
      }

      // 处理委外工序（转换为下划线命名）
      if (values.outsourceOperation) {
        values.outsource_operation = values.outsourceOperation;
        delete values.outsourceOperation;
      }

      // 计算总金额（转换为下划线命名）
      if (values.quantity && values.unit_price) {
        values.total_amount = values.quantity * values.unit_price;
      } else if (values.quantity && values.unitPrice) {
        values.unit_price = values.unitPrice;
        delete values.unitPrice;
        values.total_amount = values.quantity * values.unit_price;
      }

      values.attachments = normalizeDocumentAttachments(values.attachments);

      const wid = currentWorkOrder?.id;
      let recordId = wid;

      if (isEdit && wid) {
        await outsourceWorkOrderApi.update(wid.toString(), values);
        messageApi.success('工单委外更新成功');
      } else {
        const created = await outsourceWorkOrderApi.create(values);
        recordId = created?.id;
        messageApi.success('工单委外创建成功');
      }

      if (recordId != null) {
        await saveOwoCustomFieldValues(recordId, customData);
      }

      setModalVisible(false);
      resetOwoFormFieldValues();
      setSelectedMaterialSourceInfo(null);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
      setStatsVersion((v) => v + 1);
      if (recordId && workOrderDetail?.id === recordId) {
        try {
          const fresh = await outsourceWorkOrderApi.get(String(recordId));
          setWorkOrderDetail(fresh);
          setOwoTrackingRefreshKey((k) => k + 1);
          await loadOwoFieldValuesForDetail(recordId);
        } catch {
          /* ignore */
        }
      }
    } catch (error: any) {
      messageApi.error(error.message || '操作失败');
      throw error;
    }
  };

  /**
   * 处理委外发料
   */
  const handleIssue = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForIssue(detail);
      setIssueModalVisible(true);
      setIssueLines([]);
      setIssuePreviewMessage(null);
      setIssuePreviewLoading(true);
      setTimeout(() => {
        issueFormRef.current?.resetFields();
      }, 100);
      try {
        const preview = await outsourceMaterialIssueApi.issuePreview(detail.id!);
        const rawLines = preview?.lines ?? preview?.data?.lines ?? [];
        setIssuePreviewMessage(preview?.message ?? preview?.data?.message ?? null);
        setIssueLines(
          rawLines.map((l: any) => {
            const pending = Number(l.pendingQuantity ?? l.pending_quantity ?? 0);
            return {
              key: Number(l.materialId ?? l.material_id),
              materialId: Number(l.materialId ?? l.material_id),
              materialCode: l.materialCode ?? l.material_code ?? '',
              materialName: l.materialName ?? l.material_name ?? '',
              unit: l.unit ?? '',
              requiredQuantity: Number(l.requiredQuantity ?? l.required_quantity ?? 0),
              issuedQuantity: Number(l.issuedQuantity ?? l.issued_quantity ?? 0),
              pendingQuantity: pending,
              availableQuantity: Number(l.availableQuantity ?? l.available_quantity ?? 0),
              issueQuantity: pending > 0 ? pending : 0,
            };
          }),
        );
      } catch (err: any) {
        messageApi.error(err?.message || '加载待发物料明细失败');
      } finally {
        setIssuePreviewLoading(false);
      }
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理提交委外发料
   */
  const handleSubmitIssue = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForIssue?.id) {
        throw new Error('工单委外信息不存在');
      }

      const activeLines = issueLines.filter((l) => l.issueQuantity > 0);
      if (activeLines.length === 0) {
        messageApi.error('请至少填写一行本次发料数量');
        throw new Error('no lines');
      }
      if (!values.warehouseId) {
        messageApi.error('请选择出库仓库');
        throw new Error('no warehouse');
      }

      await outsourceMaterialIssueApi.createBatch({
        outsource_work_order_id: currentWorkOrderForIssue.id,
        outsource_work_order_code: currentWorkOrderForIssue.code,
        warehouse_id: values.warehouseId,
        warehouse_name: values.warehouseName,
        remarks: values.remarks,
        lines: activeLines.map((l) => ({
          material_id: l.materialId,
          material_code: l.materialCode,
          material_name: l.materialName,
          quantity: l.issueQuantity,
          unit: l.unit,
        })),
      });
      messageApi.success(`委外发料成功，共 ${activeLines.length} 条明细`);
      setIssueModalVisible(false);
      setCurrentWorkOrderForIssue(null);
      setIssueLines([]);
      setIssuePreviewMessage(null);
      issueFormRef.current?.resetFields();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message && error.message !== 'no lines' && error.message !== 'no warehouse') {
        messageApi.error(error.message || '创建委外发料单失败');
      }
      throw error;
    }
  };

  /**
   * 处理委外收货
   */
  const handleReceipt = async (record: OutsourceWorkOrder) => {
    try {
      const detail = await outsourceWorkOrderApi.get(record.id!.toString());
      setCurrentWorkOrderForReceipt(detail);
      setReceiptLine(buildReceiptLineFromWorkOrder(detail));
      setReceiptModalVisible(true);
      setTimeout(() => {
        receiptFormRef.current?.resetFields();
      }, 100);
    } catch (error) {
      messageApi.error('获取工单委外详情失败');
    }
  };

  /**
   * 处理提交委外收货
   */
  const handleSubmitReceipt = async (values: any): Promise<void> => {
    try {
      if (!currentWorkOrderForReceipt?.id || !receiptLine) {
        throw new Error('工单委外信息不存在');
      }
      if (receiptLine.receiptQuantity <= 0) {
        messageApi.error('请填写本次收货数量');
        throw new Error('no qty');
      }
      if (!values.warehouseId) {
        messageApi.error('请选择入库仓库');
        throw new Error('no warehouse');
      }
      if (receiptLine.receiptQuantity > receiptLine.pendingQuantity) {
        messageApi.error('收货数量不能超过待收数量');
        throw new Error('over qty');
      }

      const submitData = {
        outsource_work_order_id: currentWorkOrderForReceipt.id,
        outsource_work_order_code: currentWorkOrderForReceipt.code,
        quantity: receiptLine.receiptQuantity,
        qualified_quantity: receiptLine.qualifiedQuantity || 0,
        unqualified_quantity: receiptLine.unqualifiedQuantity || 0,
        unit: receiptLine.unit || '件',
        warehouse_id: values.warehouseId,
        warehouse_name: values.warehouseName,
        batch_number: values.batchNumber,
        remarks: values.remarks,
      };

      await outsourceMaterialReceiptApi.create(submitData);
      messageApi.success('委外收货单创建成功');
      setReceiptModalVisible(false);
      setCurrentWorkOrderForReceipt(null);
      setReceiptLine(null);
      receiptFormRef.current?.resetFields();
      setStatsVersion((v) => v + 1);
      invalidateMenuBadgeCounts();

      actionRef.current?.reload();
    } catch (error: any) {
      if (error?.message && !['no qty', 'no warehouse', 'over qty'].includes(error.message)) {
        messageApi.error(error.message || '创建委外收货单失败');
      }
      throw error;
    }
  };

  const renderOwoRowActionNodes = (record: OutsourceWorkOrder): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    nodes.push(
      <Button {...rowActionKind('read')}
        key="detail"
        type="link"
        size="small"
        icon={<EyeOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void handleDetail(record);
        }}
      >
        详情
      </Button>
    );
    nodes.push(
      <Button {...rowActionKind('update')}
        key="edit"
        type="link"
        size="small"
        icon={<EditOutlined />}
        disabled={record.status === 'completed' || record.status === 'cancelled'}
        onClick={(e) => {
          e.stopPropagation();
          void handleEdit(record);
        }}
      >
        编辑
      </Button>
    );
    if (record.status === 'released' || record.status === 'in_progress') {
      nodes.push(
        <Button {...rowActionKind('dispatch')}
          key="issue"
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            void handleIssue(record);
          }}
        >
          发料
        </Button>
      );
      nodes.push(
        <Button {...rowActionKind('read')}
          key="receipt"
          type="link"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            void handleReceipt(record);
          }}
        >
          收货
        </Button>
      );
    }
    return nodes;
  };

  const owoCustomFieldColumns = generateOwoCustomFieldColumns();
  const columns: ProColumns<OutsourceWorkOrder>[] = [
    {
      title: '工单委外编号',
      dataIndex: 'code',
      width: 168,
      fixed: 'left',
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '工单委外名称',
      dataIndex: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '产品编号',
      dataIndex: ['productCode', 'product_code'],
      width: 128,
      ellipsis: true,
      render: (_, record) => {
        const c = record.productCode || record.product_code;
        return (
          <Typography.Text copyable={{ text: String(c ?? '') }} ellipsis>
            {c ?? '-'}
          </Typography.Text>
        );
      },
    },
    {
      title: '产品名称',
      dataIndex: ['productName', 'product_name'],
      width: 200,
      ellipsis: true,
      render: (_, record) => record.productName || record.product_name,
    },
    {
      title: '委外数量',
      dataIndex: 'quantity',
      width: 100,
      render: (_, record) => (record.quantity != null ? Number(record.quantity).toFixed(2) : '-'),
    },
    {
      title: '委外供应商',
      dataIndex: ['supplierName', 'supplier_name'],
      width: 150,
      ellipsis: true,
      render: (_, record) => record.supplierName || record.supplier_name,
    },
    {
      title: '委外工序',
      dataIndex: ['outsourceOperation', 'outsource_operation'],
      width: 150,
      ellipsis: true,
      render: (_, record) => record.outsourceOperation || record.outsource_operation,
    },
    {
      title: '委外单价',
      dataIndex: ['unitPrice', 'unit_price'],
      width: 100,
      render: (_, record) => {
        const price = record.unitPrice || record.unit_price;
        return price != null && !(typeof price === 'string' && price === '') ? (
          <AmountDisplay resource={OO} fieldName="unit_price" value={Number(price)} />
        ) : (
          '-'
        );
      },
    },
    {
      title: '委外总金额',
      dataIndex: ['totalAmount', 'total_amount'],
      width: 120,
      render: (_, record) => {
        const amount = record.totalAmount || record.total_amount;
        return amount != null && !(typeof amount === 'string' && amount === '') ? (
          <AmountDisplay resource={OO} fieldName="total_amount" value={Number(amount)} />
        ) : (
          '-'
        );
      },
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (_, record) => {
        const priorityMap: Record<string, { color: string; text: string }> = {
          low: { color: 'default', text: '低' },
          normal: { color: 'blue', text: '正常' },
          high: { color: 'orange', text: '高' },
          urgent: { color: 'red', text: '紧急' },
        };
        const priority = priorityMap[record.priority || 'normal'] || { color: 'default', text: record.priority || '正常' };
        return <Tag color={priority.color}>{priority.text}</Tag>;
      },
    },
    {
      title: '已发料数量',
      dataIndex: ['issuedQuantity', 'issued_quantity'],
      width: 100,
      render: (_, record) => {
        const qty = record.issuedQuantity || record.issued_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '已收货数量',
      dataIndex: ['receivedQuantity', 'received_quantity'],
      width: 100,
      render: (_, record) => {
        const qty = record.receivedQuantity || record.received_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '合格数量',
      dataIndex: ['qualifiedQuantity', 'qualified_quantity'],
      width: 100,
      render: (_, record) => {
        const qty = record.qualifiedQuantity || record.qualified_quantity;
        return qty ? Number(qty).toFixed(2) : '0.00';
      },
    },
    {
      title: '计划开始时间',
      dataIndex: ['plannedStartDate', 'planned_start_date'],
      valueType: 'dateTime',
      width: 160,
      render: (_, record) => {
        const date = record.plannedStartDate || record.planned_start_date;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '计划结束时间',
      dataIndex: ['plannedEndDate', 'planned_end_date'],
      valueType: 'dateTime',
      width: 160,
      render: (_, record) => {
        const date = record.plannedEndDate || record.planned_end_date;
        return date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '更新时间',
      dataIndex: ['updatedAt', 'updated_at'] as any,
      width: 168,
      hideInSearch: true,
      defaultSortOrder: 'descend',
      render: (_, record) => {
        const d = record.updatedAt || (record as any).updated_at;
        return d ? dayjs(d).format('YYYY-MM-DD HH:mm:ss') : '-';
      },
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getOutsourceWorkOrderLifecycle(record as Record<string, unknown>);
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
    ...owoCustomFieldColumns,
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) =>
        renderOwoRowActions(renderOwoRowActionNodes(record), `owo-${record.id ?? 'row'}`),
    },
  ];

  const handleWorkOrderListRequest = async (params: any) => {
    try {
      const response = await outsourceWorkOrderApi.list({
        skip: (params.current! - 1) * params.pageSize!,
        limit: Math.min(params.pageSize ?? 100, 1000),
        ...params,
        keyword: params.keyword,
      });

      if (Array.isArray(response)) {
        const enriched = await enrichOwoRecordsWithCustomFields(response);
        return {
          data: enriched,
          success: true,
          total: enriched.length,
        };
      }
      if (response && typeof response === 'object') {
        const list = (response as any).data || (response as any).items || [];
        const enriched = await enrichOwoRecordsWithCustomFields(list);
        return {
          data: enriched,
          success: (response as any).success !== false,
          total: (response as any).total || enriched.length,
        };
      }

      return {
        data: [],
        success: false,
        total: 0,
      };
    } catch (error) {
      console.error('获取工单委外列表失败:', error);
      messageApi.error('获取工单委外列表失败');
      return {
        data: [],
        success: false,
        total: 0,
      };
    }
  };

  const statCards: StatCard[] = [
    {
      title: '工单委外总数',
      value: localStats.total,
      valueStyle: { color: token.colorPrimary },
      backgroundChart: <SimpleSparkline data={OWO_STAT_SPARK_1} color={token.colorPrimary} />,
    },
    {
      title: '草稿',
      value: localStats.draft,
      valueStyle: { color: token.colorWarning },
      backgroundChart: <SimpleSparkline data={OWO_STAT_SPARK_2} color={token.colorWarning} />,
    },
    {
      title: '执行中',
      value: localStats.inProgress,
      valueStyle: { color: token.colorSuccess },
      backgroundChart: <SimpleSparkline data={OWO_STAT_SPARK_3} color={token.colorSuccess} />,
    },
  ];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <UniTable<OutsourceWorkOrder>
          headerTitle="工单委外"
          columnPersistenceId="apps.kuaizhizao.pages.production-execution.outsource-work-orders"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          request={handleWorkOrderListRequest}
          enableRowSelection={true}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showCreateButton={true}
          createButtonText="新建工单委外"
          onCreate={handleCreate}
          showDeleteButton={true}
          onDelete={handleDelete}
          deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条工单委外吗？`}
          scroll={{ x: 2000 }}
          onRow={(record) => ({
            onClick: () => void handleDetail(record),
            style: { cursor: 'pointer' },
          })}
        />
      </ListPageTemplate>

      {/* 创建/编辑工单委外 Modal */}
      <FormModalTemplate
        title={isEdit ? '编辑工单委外' : '新建工单委外'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setCurrentWorkOrder(null);
          setSelectedMaterialSourceInfo(null);
          resetOwoFormFieldValues();
          formRef.current?.resetFields();
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        initialValues={isEdit && currentWorkOrder ? { ...currentWorkOrder, productId: currentWorkOrder.productId ?? currentWorkOrder.product_id, supplierId: currentWorkOrder.supplierId ?? currentWorkOrder.supplier_id } : undefined}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={true}
        formRef={formRef}
      >
        {!isEdit && (
          <CodeField
            pageCode="kuaizhizao-production-outsource-work-order"
            name="code"
            label="工单委外编号"
            autoGenerateOnCreate={true}
            context={{}}
            colProps={{ span: 12 }}
          />
        )}
        <ProFormText
          name="name"
          label="工单委外名称"
          placeholder="请输入工单委外名称（可选）"
          disabled={isEdit}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="productId"
          label="产品选择"
          placeholder="请选择产品（委外件）"
          rules={[{ required: true, message: '请选择产品' }]}
          colProps={{ span: 12 }}
          options={productList.map((product: any) => ({
            label: `${product.code || product.mainCode || ''} - ${product.name || ''}`.trim() || String(product.id),
            value: product.id,
          }))}
          fieldProps={{
            showSearch: true,
            allowClear: true,
            disabled: isEdit,
            optionFilterProp: 'label',
            onChange: (value) => handleProductChange(value),
            style: { width: '100%' },
          }}
        />
        {/* 物料来源信息显示 */}
        {
          selectedMaterialSourceInfo && (
            <div style={{ marginTop: -16, marginBottom: 16, padding: '12px', background: '#f5f5f5', borderRadius: 4, gridColumn: 'span 24' }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 'bold' }}>物料来源类型：</span>
                <Tag color="cyan">
                  {selectedMaterialSourceInfo.sourceTypeName || selectedMaterialSourceInfo.sourceType || '未配置'}
                </Tag>
              </div>
              {selectedMaterialSourceInfo.validationErrors && selectedMaterialSourceInfo.validationErrors.length > 0 && (
                <div style={{ marginTop: 8 }}>
                    {selectedMaterialSourceInfo.validationErrors.map((err, index) => (
                      <div key={index} style={{ color: '#ff4d4f', marginBottom: 4 }}>
                        {'\u00D7 '}{err}
                      </div>
                    ))}
                </div>
              )}
              {selectedMaterialSourceInfo.canCreateWorkOrder === false && (
                <div style={{ marginTop: 8, color: '#ff4d4f', fontWeight: 'bold' }}>
                  该物料来源类型不允许创建工单委外，请选择委外件物料
                </div>
              )}
              {selectedMaterialSourceInfo.canCreateWorkOrder && (
                <div style={{ marginTop: 8, color: '#52c41a' }}>
                  √ 物料来源验证通过，可以创建工单委外
                  {selectedMaterialSourceInfo.supplierName && (
                    <span style={{ marginLeft: 16 }}>
                      默认供应商：{selectedMaterialSourceInfo.supplierName}
                    </span>
                  )}
                  {selectedMaterialSourceInfo.outsourceOperation && (
                    <span style={{ marginLeft: 16 }}>
                      委外工序：{selectedMaterialSourceInfo.outsourceOperation}
                    </span>
                  )}
                  {selectedMaterialSourceInfo.unitPrice != null && (
                    <span style={{ marginLeft: 16 }}>
                      委外单价：
                      <AmountDisplay resource={OO} fieldName="unit_price" value={Number(selectedMaterialSourceInfo.unitPrice)} />
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        }
        <ProFormDigit
          name="quantity"
          label="计划委外数量"
          placeholder="请输入计划委外数量"
          min={0}
          precision={2}
          rules={[{ required: true, message: '请输入计划委外数量' }]}
          fieldProps={{
            onChange: (value: number | null) => {
              if (value !== null && value !== undefined) {
                const unitPrice = formRef.current?.getFieldValue('unitPrice');
                if (unitPrice) {
                  formRef.current?.setFieldsValue({
                    totalAmount: value * unitPrice,
                  });
                }
              }
            }
          }}
          colProps={{ span: 12 }}
        />
        <ProFormSelect
          name="supplierId"
          label="委外供应商"
          placeholder="请选择委外供应商"
          rules={[{ required: true, message: '请选择委外供应商' }]}
          colProps={{ span: 12 }}
          options={supplierList.map((supplier: any) => ({
            label: `${supplier.code ?? supplier.supplier_code ?? ''} - ${supplier.name ?? supplier.supplier_name ?? ''}`.trim() || String(supplier.id),
            value: supplier.id,
          }))}
          fieldProps={{
            showSearch: true,
            allowClear: true,
            disabled: isEdit,
            optionFilterProp: 'label',
            style: { width: '100%' },
          }}
        />
        <ProFormDigit
          name="unitPrice"
          label="委外单价"
          placeholder="请输入委外单价（将从物料配置中自动填充）"
          min={0}
          precision={2}
          fieldProps={{
            onChange: (value: number | null) => {
              if (value !== null && value !== undefined) {
                const quantity = formRef.current?.getFieldValue('quantity');
                if (quantity) {
                  formRef.current?.setFieldsValue({
                    totalAmount: quantity * value,
                  });
                }
              }
            }
          }}
          colProps={{ span: 12 }}
        />
        <ProFormDigit name="totalAmount" hidden />
        <ProFormDependency name={['quantity', 'unitPrice']}>
          {({ quantity, unitPrice }) => (
            <Form.Item label="委外总金额" style={{ marginBottom: 24 }}>
              <AmountDisplay
                resource={OO}
                fieldName="total_amount"
                value={(Number(quantity) || 0) * (Number(unitPrice) || 0)}
              />
            </Form.Item>
          )}
        </ProFormDependency>

        <ProFormSelect
          name="priority"
          label="优先级"
          initialValue="normal"
          placeholder="请选择优先级"
          colProps={{ span: 12 }}
          options={priorityOptions}
          fieldProps={{
            showSearch: true,
            allowClear: true,
            loading: priorityLoading,
            optionFilterProp: 'label',
            style: { width: '100%' },
          }}
        />
        <ProFormDatePicker
          name="plannedStartDate"
          label="计划开始时间"
          placeholder="请选择计划开始时间"
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />
        <ProFormDatePicker
          name="plannedEndDate"
          label="计划结束时间"
          placeholder="请选择计划结束时间"
          fieldProps={{ style: { width: '100%' } }}
          colProps={{ span: 12 }}
        />

        <CustomFieldsFormSection
          customFields={owoFormCustomFields}
          customFieldValues={owoFormCustomFieldValues}
          gridColumns={2}
        />

        <DocumentAttachmentsField category="outsource_work_order_attachments" />

        <ProFormTextArea
          name="remarks"
          label="备注"
          placeholder="请输入备注信息"
          fieldProps={{
            rows: 4,
          }}
          colProps={{ span: 24 }}
        />
      </FormModalTemplate >

      <DetailDrawerTemplate
        title={`工单委外详情${workOrderDetail?.code ? ` - ${workOrderDetail.code}` : ''}`}
        open={drawerVisible}
        zIndex={outsourceWorkOrderDetailDrawerZIndex}
        onClose={() => {
          setDrawerVisible(false);
          setWorkOrderDetail(null);
          resetOwoDetailFieldValues();
        }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={[]}
        column={3}
        dataSource={workOrderDetail || undefined}
        customContent={
          workOrderDetail && (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildDescriptionItemsFromColumns(workOrderDetail, detailBaseColumns)}
                />
                {hasCustomFieldsDetailContent(owoListCustomFields, owoDetailCustomFieldValues) ? (
                  <div style={{ marginTop: 16 }}>
                    <CustomFieldsDetailSection
                      customFields={owoListCustomFields}
                      customFieldValues={owoDetailCustomFieldValues}
                    />
                  </div>
                ) : null}
                <Descriptions
                  column={3}
                  size="small"
                  style={{ marginTop: 16 }}
                  items={buildDescriptionItemsFromColumns(workOrderDetail, [detailRemarksColumn])}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lifecycle = getOutsourceWorkOrderLifecycle(workOrderDetail as Record<string, unknown>);
                    const mainStages = lifecycle.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        status={lifecycle.status}
                        showLabels
                        nextStepSuggestions={lifecycle.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                  {workOrderDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='outsource_work_order'
                      documentId={workOrderDetail.id}
                      active={drawerVisible}
                      selfDocumentId={workOrderDetail.id}
                      renderBriefActions={(doc) => (
                  <WarehouseTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={() => {
                      setDrawerVisible(false);
                      setWorkOrderDetail(null);
                    }}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>

              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="工单委外无明细行表" />
              </DetailDrawerSection>

              <DetailDrawerSection title="操作记录">
                {outsourceWorkOrderTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {outsourceWorkOrderTracking.error && !outsourceWorkOrderTracking.loading && (
                  <Typography.Text type="danger">{outsourceWorkOrderTracking.error}</Typography.Text>
                )}
                {outsourceWorkOrderTracking.data && !outsourceWorkOrderTracking.loading && (
                  <DocumentTrackingTimelineBody data={outsourceWorkOrderTracking.data} />
                )}
                {!outsourceWorkOrderTracking.loading && !outsourceWorkOrderTracking.data && !outsourceWorkOrderTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          )
        }
      />

      {/* 委外发料 Modal */}
      < FormModalTemplate
        title="委外发料"
        open={issueModalVisible}
        onClose={() => {
          setIssueModalVisible(false);
          setCurrentWorkOrderForIssue(null);
          setIssueLines([]);
          setIssuePreviewMessage(null);
          issueFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitIssue}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={issueFormRef}
      >
        {currentWorkOrderForIssue && (
          <>
            <OutsourceIssueFormContent
              workOrder={currentWorkOrderForIssue}
              lines={issueLines}
              onLinesChange={setIssueLines}
              loading={issuePreviewLoading}
              previewMessage={issuePreviewMessage}
            />
            <UniWarehouseSelect
              name="warehouseId"
              label="出库仓库"
              placeholder="请选择仓库"
              required
              colProps={{ span: 12 }}
              onChange={(val, wh) => issueFormRef.current?.setFieldsValue({ warehouseName: wh?.name ?? '' })}
            />
            <ProFormText name="warehouseName" hidden />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注信息"
              fieldProps={{ rows: 2 }}
              colProps={{ span: 24 }}
            />
          </>
        )}
      </FormModalTemplate >

      {/* 委外收货 Modal */}
      < FormModalTemplate
        title="委外收货"
        open={receiptModalVisible}
        onClose={() => {
          setReceiptModalVisible(false);
          setCurrentWorkOrderForReceipt(null);
          setReceiptLine(null);
          receiptFormRef.current?.resetFields();
        }}
        onFinish={handleSubmitReceipt}
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={receiptFormRef}
      >
        {currentWorkOrderForReceipt && (
          <>
            <OutsourceReceiptFormContent
              workOrder={currentWorkOrderForReceipt}
              line={receiptLine}
              onLineChange={setReceiptLine}
            />
            <UniWarehouseSelect
              name="warehouseId"
              label="入库仓库"
              placeholder="请选择仓库"
              required
              colProps={{ span: 12 }}
              onChange={(val, wh) => receiptFormRef.current?.setFieldsValue({ warehouseName: wh?.name ?? '' })}
            />
            <ProFormText name="warehouseName" hidden />
            <ProFormText
              name="batchNumber"
              label="批次号"
              placeholder="请输入批次号（可选）"
              colProps={{ span: 12 }}
            />
            <ProFormTextArea
              name="remarks"
              label="备注"
              placeholder="请输入备注信息"
              fieldProps={{ rows: 2 }}
              colProps={{ span: 24 }}
            />
          </>
        )}
      </FormModalTemplate >
    </>
  );
};

const OutsourceWorkOrdersPage: React.FC = () => {
  return <OutsourceWorkOrdersTable />;
};

export default OutsourceWorkOrdersPage;
