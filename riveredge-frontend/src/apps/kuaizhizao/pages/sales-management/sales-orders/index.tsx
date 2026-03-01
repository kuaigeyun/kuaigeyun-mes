/**
 * 销售订单管理页面
 *
 * 提供销售订单的独立管理功能，支持MTO模式。
 * 销售订单可以下推到需求管理（需求计算）。
 *
 * @author Luigi Lu
 * @date 2026-01-27
 */

import { getBusinessConfig } from '../../../../../services/businessConfig';
import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProDescriptions, ProFormUploadButton } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Table, Input, InputNumber, Row, Col, Form as AntForm, DatePicker, Spin, Switch, Progress, Tooltip, Dropdown, Select } from 'antd';
import { EyeOutlined, EditOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined, RollbackOutlined, ImportOutlined, FileTextOutlined, SendOutlined, CopyOutlined, BellOutlined, ApartmentOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { UniImport } from '../../../../../components/uni-import';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { MaterialInventoryIndicator } from '../../../components/MaterialInventoryIndicator';
import { MaterialBomIndicator } from '../../../components/MaterialBomIndicator';
import { SalesOrderIndicatorsProvider } from '../../../components/SalesOrderIndicatorsProvider';
import SalesOrderGanttChart from '../../../components/SalesOrderGanttChart';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { getSalesOrderLifecycle } from '../../../utils/salesOrderLifecycle';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, type StatCard } from '../../../../../components/layout-templates';
import { AmountDisplay } from '../../../../../components/permission';
import {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  submitSalesOrder,
  approveSalesOrder,
  unapproveSalesOrder,
  previewPushSalesOrderToComputation,
  previewPushSalesOrderToProductionPlan,
  previewPushSalesOrderToWorkOrder,
  pushSalesOrderToComputation,
  pushSalesOrderToProductionPlan,
  pushSalesOrderToWorkOrder,
  pushSalesOrderToShipmentNotice,
  pushSalesOrderToInvoice,
  withdrawSalesOrderFromComputation,
  createSalesOrderReminder,
  bulkDeleteSalesOrders,
  deleteSalesOrder,
  getSalesOrderStatistics,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  ReviewStatus,
  type PushPreviewResponse,
} from '../../../services/sales-order';

/** 已审核状态值集合（与后端 document_lifecycle _is_approved 一致，用于按钮显示） */
const APPROVED_STATUS_VALUES = ['已审核', SalesOrderStatus.AUDITED, ReviewStatus.APPROVED, '审核通过', '通过', '已通过'] as const;
const isApprovedRecord = (r: SalesOrder) => APPROVED_STATUS_VALUES.some((v) => r.status === v || r.review_status === v);
import { getSalesOrderChangeImpact, type ChangeImpactResponse } from '../../../services/document-relation';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { materialApi } from '../../../../master-data/services/material';
import type { Material } from '../../../../master-data/types/material';
import { customerApi } from '../../../../master-data/services/supply-chain';
import type { Customer } from '../../../../master-data/types/supply-chain';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { getFileDownloadUrl, uploadMultipleFiles } from '../../../../../services/file';
/** 用户列表：对接系统管理-用户管理-帐户管理（/core/users） */
import { getUserList, type User } from '../../../../../services/user';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/** 销售明细行（订单 + 明细合并，用于平铺表格） */
type SalesOrderItemRow = SalesOrderItem & {
  _rowKey: string;
  sales_order_id: number;
  order_code?: string;
  customer_name?: string;
  order_date?: string;
  order_delivery_date?: string;
  total_quantity?: number;
  total_amount?: number;
  delivery_progress?: number;
  status?: string;
  review_status?: string;
  pushed_to_computation?: boolean;
  lifecycle?: Record<string, unknown>;
  /** 生命周期阶段名，用于卡片分组 */
  _lifecycleStage?: string;
};

const SalesOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  /** 表格搜索表单 ref，用于 statCard 点击时设置筛选并刷新 */
  const tableSearchFormRef = useRef<any>(null);
  const rowKeyToOrderIdRef = useRef<Map<string, number>>(new Map());
  /** 视图切换缓存：始终请求 include_items=true，切换视图时从缓存转换，避免重复请求 */
  const lastOrdersCacheRef = useRef<{ orders: SalesOrder[]; total: number; paramsKey: string } | null>(null);
  const invalidateOrdersCache = () => { lastOrdersCacheRef.current = null; };
  /** 刷新左侧菜单销售订单数量徽章 */
  const invalidateMenuBadge = () => { queryClient.invalidateQueries({ queryKey: ['menuBadgeCounts'] }); };
  /** 刷新销售订单统计（指标卡片） */
  const invalidateStatistics = () => { queryClient.invalidateQueries({ queryKey: ['salesOrderStatistics'] }); };

  const { data: statistics } = useQuery({
    queryKey: ['salesOrderStatistics'],
    queryFn: getSalesOrderStatistics,
  });

  // 销售订单审核开关（从业务配置加载）
  const [auditEnabled, setAuditEnabled] = useState(true);
  // 与 UniTable viewTypes 同步：table=订单，detailTable/card/gantt=销售明细
  const [viewTypeState, setViewTypeState] = useState<'table' | 'detailTable' | 'card' | 'gantt' | 'help'>('table');
  const dataViewMode = viewTypeState === 'table' ? 'order' : 'detail';
  /** 视图模式 ref：切换时同步更新，确保 reload 时 request 使用正确模式（避免 setState 异步导致返回订单级数据） */
  const dataViewModeRef = useRef(dataViewMode);
  dataViewModeRef.current = dataViewMode;

  /**
   * 加载业务配置，判断是否开启审核
   */
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getBusinessConfig();
        // 默认为关闭，与配置页面 Switch 组件行为一致（undefined 为 false）
        // 只有明确设置为 true 时才开启
        const enabled = config.parameters?.sales?.audit_enabled === true;
        setAuditEnabled(enabled);
      } catch (error) {
        console.error('加载业务配置失败:', error);
        setAuditEnabled(true);
      }
    };
    loadConfig();
  }, []);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  /** 价税合计正在编辑的行：{ index, value }，失焦时反算单价 */
  const [editingIncl, setEditingIncl] = useState<{ index: number; value: number | null } | null>(null);
  const editingInclValueRef = useRef<number | null>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSalesOrder, setCurrentSalesOrder] = useState<SalesOrder | null>(null);
  const [changeImpactVisible, setChangeImpactVisible] = useState(false);
  const [changeImpactData, setChangeImpactData] = useState<ChangeImpactResponse | null>(null);
  const [changeImpactLoading, setChangeImpactLoading] = useState(false);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  // 提醒弹窗状态
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderSubmitting, setReminderSubmitting] = useState(false);
  const [reminderForm] = AntForm.useForm();

  // 物料列表（用于物料选择器）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  // 客户列表（对接技术数据管理-供应链-客户）
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  // 用户列表（系统管理-用户管理-帐户管理，用于销售员选择）
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // 新建时预览的订单编码（用于提交时判断是否需正式占号）
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [customerCreateVisible, setCustomerCreateVisible] = useState(false);
  /** 编辑时若销售员姓名不在用户列表中，用于下拉展示 */
  const [legacySalesmanName, setLegacySalesmanName] = useState<string | null>(null);
  /** 发货方式字典选项（数据字典 SHIPPING_METHOD） */
  const [shippingMethodOptions, setShippingMethodOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [shippingMethodLoading, setShippingMethodLoading] = useState(false);
  /** 付款条件字典选项（数据字典 PAYMENT_TERMS） */
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [paymentTermsLoading, setPaymentTermsLoading] = useState(false);

  /**
   * 加载物料列表
   */
  React.useEffect(() => {
    const loadMaterials = async () => {
      try {
        setMaterialsLoading(true);
        const result = await materialApi.list({ limit: 1000, isActive: true });
        setMaterials(result);
      } catch (error: any) {
        console.error('加载物料列表失败:', error);
        messageApi.error(t('app.kuaizhizao.salesOrder.loadMaterialsFailed'));
      } finally {
        setMaterialsLoading(false);
      }
    };
    loadMaterials();
  }, [messageApi]);

  /**
   * 加载客户列表（技术数据管理 - 供应链 - 客户）
   */
  React.useEffect(() => {
    const loadCustomers = async () => {
      try {
        setCustomersLoading(true);
        const result = await customerApi.list({ limit: 1000, isActive: true });
        setCustomers(result);
      } catch (error: any) {
        console.error('加载客户列表失败:', error);
        messageApi.error(t('app.kuaizhizao.salesOrder.loadCustomersFailed'));
      } finally {
        setCustomersLoading(false);
      }
    };
    loadCustomers();
  }, [messageApi]);

  /**
   * 加载用户列表（系统管理-用户管理-帐户管理 /core/users）
   */
  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        setUsersLoading(true);
        const result = await getUserList({ page: 1, page_size: 100, is_active: true });
        setUsers(result.items || []);
      } catch (error: any) {
        console.error('加载用户列表失败:', error);
        messageApi.error(t('app.kuaizhizao.salesOrder.loadUsersFailed'));
      } finally {
        setUsersLoading(false);
      }
    };
    loadUsers();
  }, [messageApi]);

  /**
   * 加载发货方式、付款条件数据字典
   */
  React.useEffect(() => {
    const loadShippingMethod = async () => {
      try {
        setShippingMethodLoading(true);
        const dict = await getDataDictionaryByCode('SHIPPING_METHOD');
        const items = await getDictionaryItemList(dict.uuid, true);
        setShippingMethodOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        console.warn('发货方式字典未配置或加载失败:', e?.message || e);
        setShippingMethodOptions([]);
      } finally {
        setShippingMethodLoading(false);
      }
    };
    const loadPaymentTerms = async () => {
      try {
        setPaymentTermsLoading(true);
        const dict = await getDataDictionaryByCode('PAYMENT_TERMS');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPaymentTermsOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        console.warn('付款条件字典未配置或加载失败:', e?.message || e);
        setPaymentTermsOptions([]);
      } finally {
        setPaymentTermsLoading(false);
      }
    };
    loadShippingMethod();
    loadPaymentTerms();
  }, []);

  /**
   * 新建弹窗打开后，等表单挂载完成再设置订单日期默认当天；交货日期由用户自行输入
   */
  useEffect(() => {
    if (modalVisible && !isEdit) {
      const timer = setTimeout(() => {
        formRef.current?.setFieldsValue({ order_date: dayjs() });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [modalVisible, isEdit]);

  /**
   * 处理新建销售订单
   * 若启用编码规则，用 testGenerateCode 预填订单编码（不占用序号）
   */
  const handleCreate = async () => {
    setIsEdit(false);
    setCurrentId(null);
    setLegacySalesmanName(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ price_type: 'tax_exclusive' });
    if (isAutoGenerateEnabled('kuaizhizao-sales-order')) {
      const ruleCode = getPageRuleCode('kuaizhizao-sales-order');
      if (ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ order_code: preview ?? '' });
        } catch (error: any) {
          console.warn('销售订单编码预生成失败:', error);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    } else {
      setPreviewCode(null);
    }
  };

  /**
   * 处理编辑销售订单
   */
  const handleEdit = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      setIsEdit(true);
      setCurrentId(id);
      setModalVisible(true);
      try {
        const data = await getSalesOrder(id, true);  // includeItems=true
        // 明细中若缺少 material_id，用物料列表按编码/名称匹配后填入，再一起写入表单
        const items = (data.items || []).map((item: SalesOrderItem) => {
          const mid = item.material_id != null ? Number(item.material_id) : undefined;
          const matchedById = mid ? materials.find((m: any) => m.id === mid) : null;
          const matchedByCodeOrName = !mid
            ? materials.find((m: any) => (m.mainCode || m.main_code || m.code) === item.material_code || m.name === item.material_name)
            : null;
          const matched = matchedById ?? matchedByCodeOrName;
          const materialCode = item.material_code || (matched ? ((matched as any).mainCode || (matched as any).main_code || (matched as any).code) : undefined);
          const base = {
            ...item,
            material_id: mid ?? (matched ? matched.id : undefined),
            material_code: materialCode ?? item.material_code ?? '',
            required_quantity: Number(item.required_quantity) || 0,
            unit_price: item.unit_price != null ? Number(item.unit_price) : undefined,
            tax_rate: item.tax_rate != null ? Number(item.tax_rate) : 0,
            delivery_date: item.delivery_date ? dayjs(item.delivery_date) : undefined,
          };
          return base;
        });
        const customerId = data.customer_id ?? customers.find(c => c.name === data.customer_name)?.id;
        const salesmanName = data.salesman_name;
        const matchedUser = users.find(u => (u.full_name || u.username) === salesmanName);
        const salesmanUuid = matchedUser ? matchedUser.uuid : (salesmanName ? `__name__${salesmanName}` : undefined);
        setLegacySalesmanName(salesmanName && !matchedUser ? salesmanName : null);

        // 转换主表单的日期字段为 dayjs 对象
        const formData = {
          ...data,
          items,
          customer_id: customerId,
          salesman_uuid: salesmanUuid,
          order_date: data.order_date ? dayjs(data.order_date) : undefined,
          delivery_date: data.delivery_date ? dayjs(data.delivery_date) : undefined,
          attachments: (data as any).attachments || [],
        };

        formRef.current?.setFieldsValue(formData);
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.salesOrder.detailFailed'));
        console.error('编辑销售订单错误:', error);
      }
    }
  };

  /**
   * 处理详情查看
   */
  const handleDetail = async (keys: React.Key[]) => {
    if (keys.length === 1) {
      const id = Number(keys[0]);
      try {
        const data = await getSalesOrder(id, true, true);  // includeItems=true, includeDuration=true
        setCurrentSalesOrder(data);

        setDrawerVisible(true);
      } catch (error: any) {
        messageApi.error(t('app.kuaizhizao.salesOrder.detailFailed'));
      }
    }
  };

  /**
   * 处理删除销售订单（批量）
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.selectToDelete'));
      return;
    }
    const orderIds = [...new Set(keys.map((k) => rowKeyToOrderIdRef.current.get(String(k))).filter((id): id is number => id != null))];
    const count = orderIds.length;

    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.confirmDelete'),
      content: t('app.kuaizhizao.salesOrder.deleteConfirm', { count }),
      okText: t('app.kuaizhizao.salesOrder.okDelete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          const ids = orderIds;
          const res = await bulkDeleteSalesOrders(ids);

          if (res.failed_count === 0) {
            messageApi.success(t('app.kuaizhizao.salesOrder.deleteSuccess', { count: res.success_count }));
          } else {
            messageApi.warning(t('app.kuaizhizao.salesOrder.deletePartial', { success: res.success_count, failed: res.failed_count }));
            if (res.failed_items && res.failed_items.length > 0) {
              const errorMsg = res.failed_items.map(item => `订单ID ${item.id}: ${item.reason}`).join('\n');
              console.error('删除失败详情:', errorMsg);
              // 可以选择显示更详细的错误弹窗
            }
          }
          invalidateOrdersCache();
          invalidateMenuBadge();
          invalidateStatistics();
          actionRef.current?.reload();
          // 清除选中项
          if (actionRef.current?.clearSelected) {
            actionRef.current.clearSelected();
          }
        } catch (error: any) {
          messageApi.error(error.message || t('app.kuaizhizao.salesOrder.deleteFailed'));
        }
      },
    });
  };

  /**
   * 处理删除销售订单（单条，草稿或待审核）
   */
  const handleDeleteSingle = async (id: number) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.confirmDelete'),
      content: t('app.kuaizhizao.salesOrder.deleteConfirm', { count: 1 }),
      okText: t('app.kuaizhizao.salesOrder.okDelete'),
      okType: 'danger',
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await deleteSalesOrder(id);
          messageApi.success(t('app.kuaizhizao.salesOrder.deleteSuccess', { count: 1 }));
          invalidateOrdersCache();
          invalidateMenuBadge();
          invalidateStatistics();
          actionRef.current?.reload();
          if (currentSalesOrder?.id === id) {
            setDrawerVisible(false);
            setCurrentSalesOrder(null);
          }
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.deleteFailed'));
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<SalesOrder> = {
          order_date: row.order_date || row.orderDate,
          delivery_date: row.delivery_date || row.deliveryDate,
          customer_id: row.customer_id ?? row.customerId,
          customer_name: row.customer_name || row.customerName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createSalesOrder(payload);
        successCount += 1;
      }
      messageApi.success(t('app.kuaizhizao.salesOrder.syncSuccess', { count: successCount }));
      invalidateOrdersCache();
      invalidateMenuBadge();
      invalidateStatistics();
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.syncFailed'));
    }
  };

  /**
   * 处理提交表单
   * 新建且启用编码规则时：若订单编码未改或为空，则正式生成编码再创建
   */
  /**
   * 通用保存逻辑（内部使用）
   * @param values 表单数据
   * @param isDraft 是否为草稿（true=保存草稿，false=直接提交）
   */
  const handleSaveInternal = async (values: any, isDraft: boolean) => {
    try {
      const items = values.items ?? [];
      if (!items.length) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.itemsRequired'));
        return;
      }

      // 数据处理：回写客户名称、计算金额
      if (values.customer_id != null && customers.length) {
        const c = customers.find(x => x.id === values.customer_id);
        if (c) values.customer_name = c.name;
      }

      // 销售员：从 salesman_uuid 解析 salesman_name，后端只需 salesman_name
      if (values.salesman_uuid != null) {
        if (typeof values.salesman_uuid === 'string' && values.salesman_uuid.startsWith('__name__')) {
          values.salesman_name = values.salesman_uuid.replace(/^__name__/, '');
        } else {
          const u = users.find(x => x.uuid === values.salesman_uuid);
          if (u) values.salesman_name = u.full_name || u.username;
        }
      }
      delete values.salesman_uuid;

      const q = (it: SalesOrderItem) => Number((it as any).required_quantity) || 0;
      const p = (it: SalesOrderItem) => Number((it as any).unit_price) || 0;
      const taxR = (it: SalesOrderItem) => Number((it as any).tax_rate) || 0;

      // 计算明细合计（价税合计）、总金额
      const subtotal = items.reduce((sum: number, it: SalesOrderItem) => {
        const excl = q(it) * p(it);
        const incl = excl * (1 + taxR(it) / 100);
        return sum + incl;
      }, 0);
      values.total_amount = subtotal;
      values.price_type = values.price_type || 'tax_exclusive';
      values.discount_amount = 0;

      // 格式化主表日期字段，避免后端报错
      if (values.order_date) {
        values.order_date = dayjs(values.order_date).format('YYYY-MM-DD');
      }
      if (values.delivery_date) {
        values.delivery_date = dayjs(values.delivery_date).format('YYYY-MM-DD');
      }

      const mainDeliveryStr = values.delivery_date != null ? dayjs(values.delivery_date).format('YYYY-MM-DD') : undefined;
      values.items = items.map((it: SalesOrderItem) => {
        const exclAmt = q(it) * p(it);
        const inclAmt = exclAmt * (1 + taxR(it) / 100);
        const d = (it as any).delivery_date;
        const deliveryDateStr = d != null ? (typeof d === 'string' ? d.slice(0, 10) : dayjs(d).format('YYYY-MM-DD')) : mainDeliveryStr;
        return {
          material_id: (it as any).material_id,
          material_code: (it as any).material_code ?? '',
          material_name: (it as any).material_name ?? '',
          material_spec: (it as any).material_spec,
          material_unit: (it as any).material_unit,
          required_quantity: q(it),
          delivery_date: deliveryDateStr ?? mainDeliveryStr ?? dayjs().format('YYYY-MM-DD'),
          unit_price: p(it),
          tax_rate: taxR(it),
          item_amount: inclAmt,
          notes: (it as any).notes,
        };
      });

      // 处理附件
      const formAttachments = values.attachments || [];
      values.attachments = formAttachments.map((f: any) => {
        if (f.response) {
          if (Array.isArray(f.response) && f.response.length > 0) {
            return { uid: f.response[0].uuid, name: f.response[0].original_name, status: 'done', url: getFileDownloadUrl(f.response[0].uuid) };
          }
          if (f.response.uuid) {
            return { uid: f.response.uuid, name: f.response.original_name, status: 'done', url: getFileDownloadUrl(f.response.uuid) };
          }
        }
        return { uid: f.uid, name: f.name, status: 'done', url: f.url };
      });

      // 如果是直接提交，先生成正式编码（如果配置了规则）
      if (!isDraft && !isEdit && isAutoGenerateEnabled('kuaizhizao-sales-order')) {
        const ruleCode = getPageRuleCode('kuaizhizao-sales-order');
        const currentCode = values.order_code;
        if (ruleCode && (currentCode === previewCode || !currentCode)) {
          try {
            const codeResponse = await generateCode({ rule_code: ruleCode });
            values.order_code = codeResponse.code;
          } catch (error: any) {
            console.warn('正式生成订单编码失败，使用预览编码:', error);
          }
        }
      }

      let orderId = currentId;

      // 1. 创建或更新订单
      let updateRes: any = null;
      if (isEdit && currentId) {
        updateRes = await updateSalesOrder(currentId, values);
      } else {
        const res = await createSalesOrder(values);
        orderId = (res as any)?.id;
      }

      // 2. 草稿保存直接提示
      if (isDraft) {
         messageApi.success(isEdit ? t('app.kuaizhizao.salesOrder.updated') : t('app.kuaizhizao.salesOrder.savedDraft'));
      } else if (orderId) {
        // 非草稿（即点击了“提交订单”或“更新”），则执行提交。编辑时若 update 已自动审核则跳过 submit，避免重复审核
        const alreadyApproved = updateRes?.status === 'AUDITED' || updateRes?.status === '已审核';
        try {
          const submitRes = alreadyApproved ? updateRes : await submitSalesOrder(orderId);
          // 判断后端返回的状态是否已经是“已审核”
          const isApproved = submitRes?.status === 'AUDITED' || submitRes?.status === '已审核';
          const syncTip = submitRes?.demand_synced ? t('app.kuaizhizao.salesOrder.demandSyncTip') : '';
          if (isApproved) {
             messageApi.success(isEdit ? t('app.kuaizhizao.salesOrder.orderUpdatedAndAutoApproved', { syncTip }) : t('app.kuaizhizao.salesOrder.orderCreatedAndAutoApproved', { syncTip }));
          } else {
             messageApi.success(isEdit ? t('app.kuaizhizao.salesOrder.orderResubmitted') : t('app.kuaizhizao.salesOrder.orderCreatedAndSubmitted'));
          }
        } catch (submitError: any) {
          messageApi.error(t('app.kuaizhizao.salesOrder.saveSuccessSubmitFailed', { message: submitError.message || t('app.kuaizhizao.salesOrder.unknownError') }));
        }
      }

      setModalVisible(false);
      setPreviewCode(null);
      invalidateOrdersCache();
      invalidateMenuBadge();
      invalidateStatistics();
      actionRef.current?.reload();
      if (orderId && drawerVisible && currentSalesOrder?.id === orderId) {
        refreshDrawerOrder(orderId);
      }
    } catch (error: any) {
      console.error(error);
      messageApi.error(error.message || t('app.kuaizhizao.salesOrder.operationFailed'));
    }
  };

  const onModalSubmit = async (isDraft: boolean) => {
    try {
      const values = await formRef.current?.validateFields();
      if (values) {
        await handleSaveInternal(values, isDraft);
      }
    } catch (err: any) {
      // 表单校验失败（如必填项未填），由表单项显示错误，不重复弹窗
      if (err?.errorFields?.length) {
        messageApi.warning(err?.message ?? t('app.kuaizhizao.salesOrder.completeRequired'));
      } else {
        messageApi.error(err?.message ?? t('app.kuaizhizao.salesOrder.operationFailed'));
      }
    }
  };

  /**
   * 处理撤销审核
   * 改由 UniWorkflowActions 组件内部管理，保留空壳防止报错或直接删除
   * （在组件级别已经由 UniWorkflowActions 全面接管了审核和提交操作按钮）
   */

  /** 下推预览弹窗状态 */
  const [pushPreviewOpen, setPushPreviewOpen] = useState(false);
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false);
  const [pushPreviewData, setPushPreviewData] = useState<PushPreviewResponse | null>(null);
  const [pushPreviewAction, setPushPreviewAction] = useState<{
    doPush: () => Promise<any>;
    onSuccess: () => void;
    orderId: number;
  } | null>(null);
  const [pushPreviewConfirming, setPushPreviewConfirming] = useState(false);

  /**
   * 打开下推预览：先拉取预览，再展示弹窗
   */
  const showPushPreviewModal = (
    fetchPreview: () => Promise<PushPreviewResponse>,
    doPush: () => Promise<any>,
    onSuccess: () => void,
    orderId: number,
  ) => {
    setPushPreviewOpen(true);
    setPushPreviewLoading(true);
    setPushPreviewData(null);
    setPushPreviewAction({ doPush, onSuccess, orderId });
    fetchPreview()
      .then((res) => {
        setPushPreviewData(res);
        setPushPreviewLoading(false);
      })
      .catch((err) => {
        messageApi.error(err?.response?.data?.detail || err.message || t('app.kuaizhizao.salesOrder.loadPreviewFailed'));
        setPushPreviewOpen(false);
        setPushPreviewLoading(false);
      });
  };

  /** 确认下推（执行实际下推） */
  const handlePushPreviewConfirm = async () => {
    if (!pushPreviewAction || !pushPreviewData) return;
    setPushPreviewConfirming(true);
    try {
      await pushPreviewAction.doPush();
      messageApi.success(t('app.kuaizhizao.salesOrder.pushSuccess'));
      pushPreviewAction.onSuccess();
      setPushPreviewOpen(false);
      setPushPreviewData(null);
      setPushPreviewAction(null);
    } catch (error: any) {
      messageApi.error(error?.response?.data?.detail || error.message || '下推失败');
    } finally {
      setPushPreviewConfirming(false);
    }
  };

  /**
   * 处理下推到需求计算（含预览）
   */
  const handlePushToComputation = async (id: number) => {
    showPushPreviewModal(
      () => previewPushSalesOrderToComputation(id),
      () => pushSalesOrderToComputation(id),
      () => refreshDrawerOrder(id),
      id,
    );
  };

  /** 处理下推到发货通知单 */
  const handlePushToShipmentNotice = async (id: number) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.pushToShipmentTitle'),
      content: t('app.kuaizhizao.salesOrder.pushToShipmentConfirm'),
      onOk: async () => {
        try {
          const res = await pushSalesOrderToShipmentNotice(id);
          messageApi.success(res?.message || t('app.kuaizhizao.salesOrder.shipmentNoticeCreated'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.pushFailed'));
        }
      },
    });
  };

  /** 处理下推到销售发票 */
  const handlePushToInvoice = async (id: number) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.pushToInvoiceTitle'),
      content: t('app.kuaizhizao.salesOrder.pushToInvoiceConfirm'),
      onOk: async () => {
        try {
          const res = await pushSalesOrderToInvoice(id);
          messageApi.success(res?.message || t('app.kuaizhizao.salesOrder.invoiceCreated'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.pushFailed'));
        }
      },
    });
  };

  /** 直推生产计划（含预览） */
  const handlePushToProductionPlan = async (id: number) => {
    showPushPreviewModal(
      () => previewPushSalesOrderToProductionPlan(id),
      () => pushSalesOrderToProductionPlan(id),
      () => refreshDrawerOrder(id),
      id,
    );
  };

  /** 直推工单（含预览） */
  const handlePushToWorkOrder = async (id: number) => {
    showPushPreviewModal(
      () => previewPushSalesOrderToWorkOrder(id),
      () => pushSalesOrderToWorkOrder(id),
      () => refreshDrawerOrder(id),
      id,
    );
  };

  /** 打开提醒弹窗 */
  const handleOpenReminder = () => {
    reminderForm.resetFields();
    setReminderModalOpen(true);
  };

  /** 打开变更影响（排程管理增强） */
  const handleOpenChangeImpact = async () => {
    if (!currentSalesOrder?.id) return;
    setChangeImpactVisible(true);
    setChangeImpactLoading(true);
    setChangeImpactData(null);
    try {
      const data = await getSalesOrderChangeImpact(currentSalesOrder.id);
      setChangeImpactData(data);
    } catch (e) {
      messageApi.error(t('common.loadFailed') ?? '加载失败');
    } finally {
      setChangeImpactLoading(false);
    }
  };

  /** 提交提醒 */
  const handleReminderSubmit = async () => {
    if (!currentSalesOrder?.id) return;
    try {
      const values = await reminderForm.validateFields();
      setReminderSubmitting(true);
      await createSalesOrderReminder(currentSalesOrder.id, {
        recipient_user_uuid: values.recipient_user_uuid,
        action_type: values.action_type,
        remarks: values.remarks,
      });
      messageApi.success(t('app.kuaizhizao.salesOrder.reminderSent'));
      setReminderModalOpen(false);
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.sendFailed'));
    } finally {
      setReminderSubmitting(false);
    }
  };

  /**
   * 处理撤回需求计算
   * 仅当需求计算尚未下推工单/采购单等下游单据时允许撤回
   */
  const handleWithdrawFromComputation = async (id: number) => {
    modalApi.confirm({
      title: t('app.kuaizhizao.salesOrder.withdrawTitle'),
      content: t('app.kuaizhizao.salesOrder.withdrawConfirm'),
      onOk: async () => {
        try {
          await withdrawSalesOrderFromComputation(id);
          messageApi.success(t('app.kuaizhizao.salesOrder.withdrawSuccess'));
          refreshDrawerOrder(id);
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || error.message || t('app.kuaizhizao.salesOrder.withdrawFailed'));
        }
      },
    });
  };

  /** 刷新抽屉内订单数据并刷新列表 */
  const refreshDrawerOrder = async (id?: number) => {
    const targetId = id ?? currentSalesOrder?.id;
    if (targetId) {
      try {
        const res = await getSalesOrder(targetId, true, true);
        setCurrentSalesOrder(res);
        setTrackingRefreshKey((k) => k + 1);
      } catch {
        // 忽略
      }
    }
    invalidateOrdersCache();
    actionRef.current?.reload();
  };



  /**
   * 处理批量导入
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.importDataEmpty'));
      return;
    }

    try {
      // 第一行是表头，从第二行开始是数据
      const headers = data[0];
      const rows = data.slice(1);

      // 字段映射（表头名称 -> 字段名），支持当前语言
      const fieldMap: Record<string, string> = {
        [t('app.kuaizhizao.salesOrder.orderDate')]: 'order_date',
        [t('app.kuaizhizao.salesOrder.deliveryDate')]: 'delivery_date',
        [t('app.kuaizhizao.salesOrder.importHeaderCustomerId')]: 'customer_id',
        [t('app.kuaizhizao.salesOrder.customerName')]: 'customer_name',
        [t('app.kuaizhizao.salesOrder.customerContact')]: 'customer_contact',
        [t('app.kuaizhizao.salesOrder.customerPhone')]: 'customer_phone',
        [t('app.kuaizhizao.salesOrder.importHeaderSalesmanId')]: 'salesman_id',
        [t('app.kuaizhizao.salesOrder.salesman')]: 'salesman_name',
        [t('app.kuaizhizao.salesOrder.shippingAddress')]: 'shipping_address',
        [t('app.kuaizhizao.salesOrder.shippingMethod')]: 'shipping_method',
        [t('app.kuaizhizao.salesOrder.paymentTerms')]: 'payment_terms',
        [t('app.kuaizhizao.salesOrder.notes')]: 'notes',
      };

      // 转换数据
      const salesOrders: Partial<SalesOrder>[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
          continue; // 跳过空行
        }

        const salesOrder: any = {
          status: SalesOrderStatus.DRAFT,
          review_status: ReviewStatus.PENDING,
        };

        // 映射字段
        for (let j = 0; j < headers.length && j < row.length; j++) {
          const header = headers[j]?.toString().trim();
          const value = row[j]?.toString().trim();

          if (!header || !value) continue;

          const fieldName = fieldMap[header];
          if (fieldName) {
            // 处理日期字段
            if (fieldName.includes('date')) {
              salesOrder[fieldName] = value;
            }
            // 处理数字字段
            else if (fieldName.includes('_id')) {
              salesOrder[fieldName] = value ? parseInt(value, 10) : null;
            }
            // 其他字段直接赋值
            else {
              salesOrder[fieldName] = value;
            }
          }
        }

        salesOrders.push(salesOrder);
      }

      if (salesOrders.length === 0) {
        messageApi.warning(t('app.kuaizhizao.salesOrder.noValidRows'));
        return;
      }

      // 批量创建销售订单
      let successCount = 0;
      let failureCount = 0;
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < salesOrders.length; i++) {
        const order = salesOrders[i];
        try {
          await createSalesOrder(order);
          successCount++;
        } catch (error: any) {
          failureCount++;
          errors.push({
            row: i + 2, // +2 因为第一行是表头，索引从0开始
            error: error.message || t('app.kuaizhizao.salesOrder.createFailed'),
          });
          console.error('创建销售订单失败:', error);
        }
      }

      if (failureCount === 0) {
        messageApi.success(t('app.kuaizhizao.salesOrder.importSuccess', { count: successCount }));
        invalidateOrdersCache();
        invalidateMenuBadge();
        invalidateStatistics();
        actionRef.current?.reload();
      } else {
        messageApi.warning(
          t('app.kuaizhizao.salesOrder.importPartialSuccess', { success: successCount, failed: failureCount })
        );
        // 显示错误详情
        if (errors.length > 0) {
          const errorMessages = errors
            .slice(0, 10) // 只显示前10个错误
            .map(err => t('app.kuaizhizao.salesOrder.importRowError', { row: err.row, error: err.error }))
            .join('\n');
          modalApi.error({
            title: t('app.kuaizhizao.salesOrder.importErrorDetail'),
            content: <pre style={{ whiteSpace: 'pre-wrap' }}>{errorMessages}</pre>,
            width: 600,
          });
        }
        invalidateOrdersCache();
        invalidateMenuBadge();
        invalidateStatistics();
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.salesOrder.batchImportFailed'));
    }
  };

  const handleItemImport = (data: any[][]) => {
    // 假设数据从第3行开始（0:表头, 1:示例）
    const rows = data.slice(2);
    const newItems = rows
      .map((row) => {
        const materialCode = String(row[0] || '').trim();
        const spec = String(row[1] || '').trim();
        const unit = String(row[2] || '').trim();
        const quantity = parseFloat(row[3]) || 0;
        const price = parseFloat(row[4]) || 0;
        const deliveryDate = row[5];

        if (!materialCode) return null;

        const material = materials.find(m => m.mainCode === materialCode || m.code === materialCode);
        
        return {
          material_id: material?.id,
          material_code: material?.mainCode || material?.code || materialCode,
          material_name: material?.name || '',
          material_spec: material?.specification || spec,
          material_unit: material?.baseUnit || unit,
          required_quantity: quantity,
          unit_price: price,
          delivery_date: deliveryDate ? (dayjs(deliveryDate).isValid() ? dayjs(deliveryDate) : undefined) : undefined,
          tax_rate: 0,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id !== undefined || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning(t('app.kuaizhizao.salesOrder.noValidData'));
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(t('app.kuaizhizao.salesOrder.importSuccessItems', { count: newItems.length }));
  };

  // 订单视图列（一行一单，可展开明细）
  const orderColumns: ProColumns<SalesOrder>[] = [
    { title: t('app.kuaizhizao.salesOrder.orderCode'), dataIndex: 'order_code', width: 150, fixed: 'left' as const, ellipsis: true, sorter: true },
    { title: t('app.kuaizhizao.salesOrder.customerName'), dataIndex: 'customer_name', width: 150, ellipsis: true, sorter: true },
    { title: t('app.kuaizhizao.salesOrder.orderDate'), dataIndex: 'order_date', valueType: 'date', width: 120, sorter: true },
    { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', valueType: 'date', width: 120, sorter: true },
    { title: t('app.kuaizhizao.salesOrder.totalQuantity'), dataIndex: 'total_quantity', width: 100, align: 'right' as const, sorter: true },
    { title: t('app.kuaizhizao.salesOrder.totalAmountLabel'), dataIndex: 'total_amount', width: 120, align: 'right' as const, sorter: true, render: (_: unknown, r: SalesOrder) => <AmountDisplay resource="sales_order" value={r.total_amount} /> },
    {
      title: t('app.kuaizhizao.salesOrder.deliveryProgress'),
      dataIndex: 'delivery_progress',
      width: 80,
      render: (_: unknown, record: SalesOrder) => {
        const p = record.delivery_progress ?? 0;
        const percent = Math.min(100, Math.max(0, Number(p)));
        return <Tooltip title={`${Math.round(percent)}%`}><Progress percent={Math.round(percent)} size="small" showInfo={false} style={{ margin: 0 }} /></Tooltip>;
      },
    },
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: 'lifecycle',
      width: 100,
      valueType: 'select',
      valueEnum: {
        草稿: { text: t('app.kuaizhizao.salesOrder.lifecycleDraft') },
        待审核: { text: t('app.kuaizhizao.salesOrder.lifecyclePendingReview') },
        已审核: { text: t('app.kuaizhizao.salesOrder.lifecycleAudited') },
        已生效: { text: t('app.kuaizhizao.salesOrder.lifecycleEffective') },
        执行中: { text: t('app.kuaizhizao.salesOrder.lifecycleInProgress') },
        已交货: { text: t('app.kuaizhizao.salesOrder.lifecycleDelivered') },
        已完成: { text: t('app.kuaizhizao.salesOrder.lifecycleCompleted') },
        已驳回: { text: t('app.kuaizhizao.salesOrder.lifecycleRejected') },
        已取消: { text: t('app.kuaizhizao.salesOrder.lifecycleCancelled') },
      },
      render: (_: unknown, record: SalesOrder) => {
        const lifecycle = getSalesOrderLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = {
          草稿: 'default',
          待审核: 'warning',
          已审核: 'green',
          已生效: 'purple',
          执行中: 'cyan',
          已交货: 'orange',
          已完成: 'gold',
          已驳回: 'error',
          已取消: 'default',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.salesOrder.actions'),
      width: 200,
      fixed: 'right' as const,
      valueType: 'option',
      render: (_: any, record: SalesOrder) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail([record.id!])}>
            {t('app.kuaizhizao.salesOrder.viewDetail')}
          </Button>
          {(() => {
            const lifecycle = getSalesOrderLifecycle(record);
            const canEdit = ['草稿', '待审核', '已驳回'].includes(lifecycle.stageName ?? '');
            const canDelete = ['草稿', '待审核'].includes(lifecycle.stageName ?? '') || record.status === SalesOrderStatus.DRAFT || record.status === 'PENDING_REVIEW';
            return (
              <>
                {canEdit && (
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit([record.id!])}>
                    {t('app.kuaizhizao.salesOrder.editAction')}
                  </Button>
                )}
                {canDelete && (
                  <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDeleteSingle(record.id!)}>
                    {t('app.kuaizhizao.salesOrder.delete')}
                  </Button>
                )}
              </>
            );
          })()}
          <UniWorkflowActions
            record={record}
            entityName={t('app.kuaizhizao.salesOrder.entityName')}
            statusField="status"
            reviewStatusField="review_status"
            draftStatuses={[SalesOrderStatus.DRAFT]}
            pendingStatuses={[ReviewStatus.PENDING, '待审核']}
            approvedStatuses={[...APPROVED_STATUS_VALUES]}
            rejectedStatuses={['已驳回', SalesOrderStatus.REJECTED]}
            autoApproveWhenSubmit={!auditEnabled}
            theme="link"
            size="small"
            actions={{ submit: async (id) => submitSalesOrder(id), approve: approveSalesOrder, revoke: unapproveSalesOrder }}
            onSuccess={() => { invalidateOrdersCache(); invalidateMenuBadge(); invalidateStatistics(); actionRef.current?.reload(); }}
            confirmMessages={{ submit: auditEnabled ? t('app.kuaizhizao.salesOrder.submitConfirmAudit') : t('app.kuaizhizao.salesOrder.submitConfirmAuto') }}
          />
          {isApprovedRecord(record) && (
            <Dropdown
              menu={{
                items: [
                  { key: 'computation', label: t('app.kuaizhizao.salesOrder.demandComputation'), icon: <ArrowDownOutlined />, disabled: !!record.pushed_to_computation, onClick: () => !record.pushed_to_computation && handlePushToComputation(record.id!) },
                  { key: 'plan', label: t('app.kuaizhizao.salesOrder.pushToProductionPlan'), icon: <ArrowDownOutlined />, onClick: () => handlePushToProductionPlan(record.id!) },
                  { key: 'workorder', label: t('app.kuaizhizao.salesOrder.pushToWorkOrder'), icon: <ArrowDownOutlined />, onClick: () => handlePushToWorkOrder(record.id!) },
                  { type: 'divider' },
                  { key: 'shipment', label: t('app.kuaizhizao.salesOrder.shipmentNotice'), icon: <SendOutlined />, onClick: () => handlePushToShipmentNotice(record.id!) },
                  { key: 'invoice', label: t('app.kuaizhizao.salesOrder.salesInvoice'), icon: <FileTextOutlined />, onClick: () => handlePushToInvoice(record.id!) },
                  ...(record.pushed_to_computation ? [{ type: 'divider' as const }, { key: 'withdraw', label: t('app.kuaizhizao.salesOrder.withdrawComputation'), icon: <RollbackOutlined />, onClick: () => handleWithdrawFromComputation(record.id!) }] : []),
                ],
              }}
            >
              <Button type="link" size="small" icon={<ArrowDownOutlined />}>{t('app.kuaizhizao.salesOrder.push')}</Button>
            </Dropdown>
          )}
        </Space>
      ),
    },
  ];

  // 表格列：销售明细平铺视图（订单 + 明细）
  const detailColumns: ProColumns<SalesOrderItemRow>[] = [
    {
      title: t('app.kuaizhizao.salesOrder.orderCode'),
      dataIndex: 'order_code',
      width: 140,
      fixed: 'left' as const,
      ellipsis: true,
      render: (_, record) => (
        <Space size={4}>
          <span>{record.order_code ?? '-'}</span>
          <Tooltip title={t('field.invitationCode.copy')}>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined style={{ fontSize: 12 }} />}
              onClick={(e) => {
                e.stopPropagation();
                const text = record.order_code ?? '';
                if (text) {
                  navigator.clipboard.writeText(text).then(
                    () => messageApi.success(t('common.copySuccess')),
                    () => messageApi.error(t('common.copyFailed'))
                  );
                }
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
    { title: t('app.kuaizhizao.salesOrder.customerName'), dataIndex: 'customer_name', width: 130, ellipsis: true, hideInSearch: false },
    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 110, ellipsis: true },
    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 140, ellipsis: true },
    { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 100, ellipsis: true },
    { title: t('app.kuaizhizao.salesOrder.unit'), dataIndex: 'material_unit', width: 60 },
    {
      title: t('app.kuaizhizao.salesOrder.quantity'),
      dataIndex: 'required_quantity',
      width: 100,
      align: 'right' as const,
      render: (val: number, record: SalesOrderItemRow) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
          <MaterialInventoryIndicator materialId={record.material_id} requiredQuantity={record.required_quantity} />
          {val ?? 0}
        </span>
      ),
    },
    { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 90, align: 'right' as const, render: (val: number) => <AmountDisplay resource="sales_order" value={val} /> },
    { title: t('app.kuaizhizao.salesOrder.taxRate'), dataIndex: 'tax_rate', width: 70, align: 'right' as const, render: (val: number) => val ?? 0 },
    { title: t('app.kuaizhizao.salesOrder.inclAmount'), dataIndex: 'item_amount', width: 100, align: 'right' as const, render: (val: number) => <AmountDisplay resource="sales_order" value={val} /> },
    { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 110 },
    { title: t('app.kuaizhizao.salesOrder.deliveredQty'), dataIndex: 'delivered_quantity', width: 90, align: 'right' as const, render: (text: number) => text ?? 0 },
    { title: t('app.kuaizhizao.salesOrder.remainingQty'), dataIndex: 'remaining_quantity', width: 90, align: 'right' as const, render: (text: number) => text ?? 0 },
    {
      title: t('app.kuaizhizao.salesOrder.bomCheck'),
      key: 'bom_check',
      width: 70,
      render: (_: unknown, record: SalesOrderItemRow) => <MaterialBomIndicator materialId={record.material_id} />,
    },
    {
      title: t('app.kuaizhizao.salesOrder.lifecycle'),
      dataIndex: 'lifecycle',
      width: 90,
      hideInSearch: false,
      valueType: 'select',
      valueEnum: {
        草稿: { text: t('app.kuaizhizao.salesOrder.lifecycleDraft') },
        待审核: { text: t('app.kuaizhizao.salesOrder.lifecyclePendingReview') },
        已审核: { text: t('app.kuaizhizao.salesOrder.lifecycleAudited') },
        已生效: { text: t('app.kuaizhizao.salesOrder.lifecycleEffective') },
        执行中: { text: t('app.kuaizhizao.salesOrder.lifecycleInProgress') },
        已交货: { text: t('app.kuaizhizao.salesOrder.lifecycleDelivered') },
        已完成: { text: t('app.kuaizhizao.salesOrder.lifecycleCompleted') },
        已驳回: { text: t('app.kuaizhizao.salesOrder.lifecycleRejected') },
        已取消: { text: t('app.kuaizhizao.salesOrder.lifecycleCancelled') },
      },
      render: (_: unknown, record: SalesOrderItemRow) => {
        const orderRecord = { id: record.sales_order_id, status: record.status, review_status: record.review_status } as SalesOrder;
        const lifecycle = getSalesOrderLifecycle(orderRecord);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const colorMap: Record<string, string> = {
          草稿: 'default',
          待审核: 'warning',
          已审核: 'green',
          已生效: 'purple',
          执行中: 'cyan',
          已交货: 'orange',
          已完成: 'gold',
          已驳回: 'error',
          已取消: 'default',
        };
        return <Tag color={colorMap[stageName] ?? 'default'}>{stageName}</Tag>;
      },
    },
    // 明细表格视图以每行订单明细为展示维度，纯查看用途，不提供操作按钮
  ];

  const columns = dataViewMode === 'detail' ? detailColumns : orderColumns;

  const handleDeleteResolved = dataViewMode === 'order'
    ? async (keys: React.Key[]) => {
        const ids = keys.map((k) => Number(k)).filter((id) => !Number.isNaN(id));
        if (ids.length === 0) {
          messageApi.warning(t('app.kuaizhizao.salesOrder.selectToDelete'));
          return;
        }
        modalApi.confirm({
          title: t('app.kuaizhizao.salesOrder.confirmDelete'),
          content: t('app.kuaizhizao.salesOrder.deleteConfirm', { count: ids.length }),
          okText: t('app.kuaizhizao.salesOrder.okDelete'),
          okType: 'danger',
          cancelText: t('common.cancel'),
          onOk: async () => {
            try {
              const res = await bulkDeleteSalesOrders(ids);
              if (res.failed_count === 0) {
                messageApi.success(t('app.kuaizhizao.salesOrder.deleteSuccess', { count: res.success_count }));
              } else {
                messageApi.warning(t('app.kuaizhizao.salesOrder.deletePartial', { success: res.success_count, failed: res.failed_count }));
              }
              invalidateOrdersCache();
              invalidateMenuBadge();
              invalidateStatistics();
              actionRef.current?.reload();
              if (actionRef.current?.clearSelected) actionRef.current.clearSelected();
            } catch (error: any) {
              messageApi.error(error.message || t('app.kuaizhizao.salesOrder.deleteFailed'));
            }
          },
        });
      }
    : handleDelete;

  const statCards: StatCard[] = statistics
    ? [
        {
          title: t('app.kuaizhizao.salesOrder.statActive'),
          value: statistics.active_count,
        },
        {
          title: t('app.kuaizhizao.salesOrder.lifecyclePendingReview'),
          value: statistics.pending_review_count,
          valueStyle: statistics.pending_review_count > 0 ? { color: '#faad14' } : undefined,
          onClick:
            statistics.pending_review_count > 0
              ? () => {
                  tableSearchFormRef.current?.setFieldsValue?.({ lifecycle: '待审核' });
                  actionRef.current?.reload?.();
                }
              : undefined,
        },
        {
          title: t('app.kuaizhizao.salesOrder.lifecycleInProgress'),
          value: statistics.in_progress_count,
        },
        {
          title: t('app.kuaizhizao.salesOrder.statOverdue'),
          value: statistics.overdue_count,
          valueStyle: statistics.overdue_count > 0 ? { color: '#ff4d4f' } : undefined,
        },
        {
          title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
          value: statistics.total_amount ?? 0,
          prefix: '¥',
          precision: 2,
        },
      ]
    : [];

  return (
    <>
      <ListPageTemplate statCards={statCards}>
        <SalesOrderIndicatorsProvider>
        <UniTable
          formRef={tableSearchFormRef}
          headerTitle={t('app.kuaizhizao.salesOrder.title')}
          viewTypes={['table', 'detailTable', 'card', 'gantt', 'help']}
          defaultViewType="table"
          onViewTypeChange={(v) => {
            const nextMode = v === 'table' ? 'order' : 'detail';
            dataViewModeRef.current = nextMode;
            setViewTypeState(v as 'table' | 'detailTable' | 'card' | 'gantt' | 'help');
            setTimeout(() => actionRef.current?.reload(), 0);
          }}
          detailTableColumns={detailColumns}
          cardViewConfig={{
            groupByField: '_lifecycleStage',
            layout: 'waterfall',
            renderCard: (item: SalesOrderItemRow) => (
              <div
                key={item._rowKey}
                style={{
                  padding: 12,
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  background: '#fff',
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: 500 }}>
                  {item.order_code} · {item.customer_name}
                </div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {item.material_code} {item.material_name} × {item.required_quantity ?? 0} {item.material_unit}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                  {t('app.kuaizhizao.salesOrder.deliveryDate')}: {item.delivery_date ?? '-'}
                </div>
              </div>
            ),
          }}
          ganttViewConfig={{
            renderGantt: (data) => <SalesOrderGanttChart items={data as SalesOrderItemRow[]} />,
          }}
          helpViewConfig={{
            content: (
              <div style={{ lineHeight: 1.8 }}>
                <p><strong>表格视图</strong>：按订单维度展示。</p>
                <p><strong>明细表格</strong>：以每行订单明细为展示维度，纯查看用途，支持库存/BOM 检查。</p>
                <p><strong>卡片视图</strong>：按生命周期分组，瀑布流展示。</p>
                <p><strong>甘特图</strong>：按交货日期展示时间轴。</p>
              </div>
            ),
          }}
          actionRef={actionRef}
          toolBarButtonSize="middle"
          columns={columns}
          rowKey={dataViewMode === 'detail' ? '_rowKey' : 'id'}
          request={async (params: any, sort: any, _filter: any, searchFormValues: any) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };
            // 以 lifecycle 为唯一展示入口：搜索时按 lifecycle 阶段映射到后端 status
            if (searchFormValues?.lifecycle) {
              const lifecycleToStatus: Record<string, string> = {
                草稿: 'DRAFT',
                待审核: 'PENDING_REVIEW',
                已审核: 'AUDITED',
                已确认: 'CONFIRMED',
                已生效: 'EFFECTIVE',
                执行中: 'IN_PROGRESS',
                已交货: 'DELIVERED',
                已完成: 'COMPLETED',
                已驳回: 'REJECTED',
                已取消: 'CANCELLED',
              };
              apiParams.status = lifecycleToStatus[searchFormValues.lifecycle] ?? searchFormValues.lifecycle;
            }
            if (searchFormValues?.customer_name) apiParams.customer_name = searchFormValues.customer_name;
            if (sort) {
              const sortKeys = Object.keys(sort);
              if (sortKeys.length > 0) {
                const key = sortKeys[0];
                apiParams.order_by = sort[key] === 'ascend' ? key : `-${key}`;
              }
            }
            // 始终请求 include_items=true，切换视图时从缓存转换，避免重复请求
            apiParams.include_items = true;
            const paramsKey = JSON.stringify({ skip: apiParams.skip, limit: apiParams.limit, status: apiParams.status, customer_name: apiParams.customer_name, order_by: apiParams.order_by });

            const toFlatRows = (orders: SalesOrder[]) => {
              const map = new Map<string, number>();
              const flatRows: SalesOrderItemRow[] = [];
              for (const order of orders) {
                const lifecycle = getSalesOrderLifecycle(order as SalesOrder);
                const stageName = lifecycle.stageName ?? order.status ?? '草稿';
                const items = order.items ?? [];
                if (items.length === 0) {
                  const rowKey = `order-${order.id}-empty`;
                  map.set(rowKey, order.id);
                  flatRows.push({
                    _rowKey: rowKey,
                    _lifecycleStage: stageName,
                    sales_order_id: order.id,
                    order_code: order.order_code,
                    customer_name: order.customer_name,
                    order_date: order.order_date,
                    order_delivery_date: order.delivery_date,
                    total_quantity: order.total_quantity,
                    total_amount: order.total_amount,
                    delivery_progress: order.delivery_progress,
                    status: order.status,
                    review_status: order.review_status,
                    pushed_to_computation: order.pushed_to_computation,
                    material_code: '-',
                    material_name: '-',
                    required_quantity: 0,
                    delivery_date: order.delivery_date ?? '',
                  } as SalesOrderItemRow);
                } else {
                  items.forEach((item: SalesOrderItem, idx: number) => {
                    const rowKey = item.id ? `order-${order.id}-item-${item.id}` : `order-${order.id}-idx-${idx}`;
                    map.set(rowKey, order.id);
                    flatRows.push({
                      ...item,
                      _rowKey: rowKey,
                      _lifecycleStage: stageName,
                      sales_order_id: order.id,
                      order_code: order.order_code,
                      customer_name: order.customer_name,
                      order_date: order.order_date,
                      order_delivery_date: order.delivery_date,
                      total_quantity: order.total_quantity,
                      total_amount: order.total_amount,
                      delivery_progress: order.delivery_progress,
                      status: order.status,
                      review_status: order.review_status,
                      pushed_to_computation: order.pushed_to_computation,
                      material_code: item.material_code ?? '',
                      material_name: item.material_name ?? '',
                      material_spec: item.material_spec ?? '',
                      material_unit: item.material_unit ?? '',
                      required_quantity: item.required_quantity ?? 0,
                      unit_price: item.unit_price,
                      tax_rate: item.tax_rate,
                      item_amount: item.item_amount,
                      delivered_quantity: item.delivered_quantity,
                      remaining_quantity: item.remaining_quantity,
                      delivery_date: item.delivery_date ?? order.delivery_date ?? '',
                    } as SalesOrderItemRow);
                  });
                }
              }
              rowKeyToOrderIdRef.current = map;
              return flatRows;
            };

            try {
              const cache = lastOrdersCacheRef.current;
              let orders: SalesOrder[];
              let total: number;

              if (cache?.paramsKey === paramsKey && cache.orders) {
                orders = cache.orders;
                total = cache.total;
              } else {
                const response = await listSalesOrders(apiParams);
                orders = Array.isArray(response) ? response : (response as any).data || [];
                total = (response as any).total ?? orders.length;
                lastOrdersCacheRef.current = { orders, total, paramsKey };
              }

              const mode = dataViewModeRef.current;
              if (mode === 'order') {
                return { data: orders, success: true, total };
              }
              return { data: toFlatRows(orders), success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.getListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          showAdvancedSearch={true}
          enableRowSelection={viewTypeState !== 'detailTable'}
          showCreateButton={true}
          createButtonText={t('app.kuaizhizao.salesOrder.create')}
          onCreate={handleCreate}
          showEditButton={false}
          showDeleteButton={viewTypeState !== 'detailTable'}
          deleteButtonText={t('app.kuaizhizao.salesOrder.batchDelete')}
          onDelete={handleDeleteResolved}
          showImportButton={true}
          onImport={handleImport}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listSalesOrders({ skip: 0, limit: 10000, include_items: true });
              const orders = (res as any).data || [];
              const flatRows: SalesOrderItemRow[] = [];
              for (const order of orders) {
                const items = order.items ?? [];
                if (items.length === 0) {
                  flatRows.push({
                    _rowKey: `order-${order.id}-empty`,
                    sales_order_id: order.id,
                    order_code: order.order_code,
                    customer_name: order.customer_name,
                    material_code: '-',
                    material_name: '-',
                    required_quantity: 0,
                    delivery_date: order.delivery_date ?? '',
                  } as SalesOrderItemRow);
                } else {
                  items.forEach((item: SalesOrderItem, idx: number) => {
                    flatRows.push({
                      ...item,
                      _rowKey: item.id ? `order-${order.id}-item-${item.id}` : `order-${order.id}-idx-${idx}`,
                      sales_order_id: order.id,
                      order_code: order.order_code,
                      customer_name: order.customer_name,
                    } as SalesOrderItemRow);
                  });
                }
              }
              let toExport = flatRows;
              if (type === 'currentPage' && pageData?.length) {
                toExport = pageData as SalesOrderItemRow[];
              } else if (type === 'selected' && keys?.length) {
                toExport = flatRows.filter((r) => keys.includes(r._rowKey));
              }
              if (toExport.length === 0) {
                messageApi.warning(t('app.kuaizhizao.salesOrder.noDataToExport'));
                return;
              }
              const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sales-order-items-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(t('app.kuaizhizao.salesOrder.exportSuccess', { count: toExport.length }));
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.salesOrder.exportFailed'));
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          importHeaders={[
            t('app.kuaizhizao.salesOrder.orderDate'),
            t('app.kuaizhizao.salesOrder.deliveryDate'),
            t('app.kuaizhizao.salesOrder.importHeaderCustomerId'),
            t('app.kuaizhizao.salesOrder.customerName'),
            t('app.kuaizhizao.salesOrder.customerContact'),
            t('app.kuaizhizao.salesOrder.customerPhone'),
            t('app.kuaizhizao.salesOrder.importHeaderSalesmanId'),
            t('app.kuaizhizao.salesOrder.salesman'),
            t('app.kuaizhizao.salesOrder.shippingAddress'),
            t('app.kuaizhizao.salesOrder.shippingMethod'),
            t('app.kuaizhizao.salesOrder.paymentTerms'),
            t('app.kuaizhizao.salesOrder.notes'),
          ]}
          importExampleRow={[
            '2026-01-01',
            '2026-01-31',
            '',
            t('app.kuaizhizao.salesOrder.importExampleCustomer'),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            t('app.kuaizhizao.salesOrder.importExampleNotes'),
          ]}
        />
        </SalesOrderIndicatorsProvider>
      </ListPageTemplate>

      {/* 新建/编辑 Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setPreviewCode(null);
        }}
        title={isEdit ? t('app.kuaizhizao.salesOrder.edit') : t('app.kuaizhizao.salesOrder.create')}
        width={1200}
        footer={null}
        destroyOnHidden
        styles={{ body: { maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' } }}
      >
        <ProForm
          formRef={formRef}
          onFinish={async () => true} // Prevent default submission
          layout="vertical"
          submitter={{
            render: () => (
              <div style={{ textAlign: 'left', marginTop: 16 }}>
                <Space>
                  <Button onClick={() => setModalVisible(false)}>取消</Button>
                  {!isEdit && (
                    <Button onClick={() => onModalSubmit(true)}>
                      保存为草稿
                    </Button>
                  )}
                  <Button type="primary" onClick={() => onModalSubmit(false)}>
                    {isEdit ? '更新' : '提交订单'}
                  </Button>
                </Space>
              </div>
            ),
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <ProFormText
                name="order_code"
                label={
                  <span>
                    订单编码
                    <a
                      href="/system/code-rules"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/system/code-rules');
                      }}
                      style={{ marginLeft: 8, fontSize: 12 }}
                    >
                      编码规则设置
                    </a>
                  </span>
                }
                placeholder={isAutoGenerateEnabled('kuaizhizao-sales-order') ? '编码将根据编码规则自动生成，可修改' : '请输入订单编码'}
                rules={[{ required: true, message: '请输入订单编码' }]}
                fieldProps={{ disabled: isEdit }}
              />
            </Col>
            <Col span={6}>
              <ProFormDatePicker
                name="order_date"
                label="订单日期"
                rules={[{ required: true, message: '请选择订单日期' }]}
                fieldProps={{ style: { width: '100%' } }}
              />
            </Col>
            <Col span={6}>
              <ProFormDatePicker
                name="delivery_date"
                label="交货日期"
                rules={[{ required: true, message: '请选择交货日期' }]}
                fieldProps={{
                  style: { width: '100%' },
                  onChange: (val: any) => {
                    const items = formRef.current?.getFieldValue('items') ?? [];
                    if (items.length && val != null) {
                      const next = items.map((it: any) => ({ ...it, delivery_date: val }));
                      formRef.current?.setFieldsValue({ items: next });
                    }
                  },
                }}
              />
            </Col>
            <Col span={6}>
              <ProForm.Item
                name="customer_id"
                label={
                  <span>
                    客户名称
                    <a
                      href="/apps/master-data/supply-chain/customers"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate('/apps/master-data/supply-chain/customers');
                      }}
                      style={{ marginLeft: 8, fontSize: 12 }}
                    >
                      客户信息管理
                    </a>
                  </span>
                }
                rules={[{ required: true, message: '请选择客户' }]}
              >
                <UniDropdown
                  placeholder="请选择客户"
                  showSearch
                  allowClear
                  loading={customersLoading}
                  style={{ width: '100%' }}
                  options={customers.map((c) => ({
                    label: (c.code ? `${c.code} - ` : '') + c.name,
                    value: c.id,
                  }))}
                  onChange={(id: number | undefined) => {
                    const c = id ? customers.find((x) => x.id === id) : null;
                    formRef.current?.setFieldsValue({
                      customer_name: c?.name ?? undefined,
                      customer_contact: c?.contactPerson ?? (c as any)?.contact ?? undefined,
                      customer_phone: c?.phone ?? undefined,
                    });
                  }}
                  quickCreate={{
                    label: '快速新建',
                    onClick: () => setCustomerCreateVisible(true),
                  }}
                  advancedSearch={{
                    label: '高级搜索',
                    fields: [
                      { name: 'code', label: '客户编码' },
                      { name: 'name', label: '客户名称' },
                      { name: 'contactPerson', label: '联系人' },
                    ],
                    onSearch: async (values) => {
                      const list = await customerApi.list({ limit: 200, skip: 0 });
                      let filtered = list;
                      if (values.code?.trim()) {
                        const k = values.code.trim().toLowerCase();
                        filtered = filtered.filter((c) => (c.code ?? '').toLowerCase().includes(k));
                      }
                      if (values.name?.trim()) {
                        const k = values.name.trim().toLowerCase();
                        filtered = filtered.filter((c) => (c.name ?? '').toLowerCase().includes(k));
                      }
                      if (values.contactPerson?.trim()) {
                        const k = values.contactPerson.trim().toLowerCase();
                        filtered = filtered.filter((c) => (c.contactPerson ?? '').toLowerCase().includes(k));
                      }
                      return filtered.map((c) => ({
                        value: c.id,
                        label: `${c.code ?? ''} - ${c.name ?? ''}`.trim() || String(c.id),
                      }));
                    },
                  }}
                />
              </ProForm.Item>
            </Col>
            <Col span={6}>
              <ProFormText
                name="customer_contact"
                label="客户联系人"
                placeholder="请输入客户联系人"
              />
            </Col>
            <Col span={6}>
              <ProFormText
                name="customer_phone"
                label="客户电话"
                placeholder="请输入客户电话"
              />
            </Col>
            <Col span={6}>
              <ProForm.Item name="salesman_uuid" label="销售员姓名">
                <UniDropdown
                  placeholder="请选择销售员"
                  showSearch
                  allowClear
                  loading={usersLoading}
                  style={{ width: '100%' }}
                  options={[
                    ...users.map((u) => ({
                      label: u.full_name ? `${u.full_name} (${u.username})` : u.username,
                      value: u.uuid,
                    })),
                    ...(legacySalesmanName
                      ? [{ label: legacySalesmanName, value: `__name__${legacySalesmanName}` }]
                      : []),
                  ]}
                  advancedSearch={{
                    label: '高级搜索',
                    fields: [
                      { name: 'username', label: '账号' },
                      { name: 'full_name', label: '姓名' },
                      { name: 'phone', label: '手机号' },
                    ],
                    onSearch: async (searchValues) => {
                      const result = await getUserList({
                        page: 1,
                        page_size: 100,
                        is_active: true,
                        ...(searchValues.username?.trim() && { username: searchValues.username.trim() }),
                        ...(searchValues.full_name?.trim() && { full_name: searchValues.full_name.trim() }),
                        ...(searchValues.phone?.trim() && { phone: searchValues.phone.trim() }),
                      });
                      const list = result.items || [];
                      return list.map((u) => ({
                        value: u.uuid,
                        label: u.full_name ? `${u.full_name} (${u.username})` : u.username,
                      }));
                    },
                  }}
                />
              </ProForm.Item>
            </Col>
            <Col span={12}>
              <ProFormText
                name="shipping_address"
                label="收货地址"
                placeholder="请输入收货地址"
              />
            </Col>
            <Col span={6}>
              <ProForm.Item name="shipping_method" label="发货方式">
                <UniDropdown
                  placeholder="请选择发货方式"
                  showSearch
                  allowClear
                  loading={shippingMethodLoading}
                  style={{ width: '100%' }}
                  options={shippingMethodOptions}
                  quickCreate={{
                    label: '数据字典管理',
                    onClick: () => navigate('/system/data-dictionaries'),
                  }}
                />
              </ProForm.Item>
            </Col>
            <Col span={6}>
              <ProForm.Item name="payment_terms" label="付款条件">
                <UniDropdown
                  placeholder="请选择付款条件"
                  showSearch
                  allowClear
                  loading={paymentTermsLoading}
                  style={{ width: '100%' }}
                  options={paymentTermsOptions}
                  quickCreate={{
                    label: '数据字典管理',
                    onClick: () => navigate('/system/data-dictionaries'),
                  }}
                />
              </ProForm.Item>
            </Col>
          </Row>

          {/* 订单明细：标题 + 价格类型开关 + 导入按钮 */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
              <Space align="center" size={12}>
                <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
                  <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
                  {t('app.kuaizhizao.salesOrder.orderItems')}
                </span>
                <ProForm.Item
                  name="price_type"
                  initialValue="tax_exclusive"
                  noStyle
                  valuePropName="checked"
                  getValueProps={(v: string) => ({ checked: v === 'tax_inclusive' })}
                  getValueFromEvent={(checked: boolean) => (checked ? 'tax_inclusive' : 'tax_exclusive')}
                >
                  <Switch
                    checkedChildren={t('app.kuaizhizao.salesOrder.taxInclusive')}
                    unCheckedChildren={t('app.kuaizhizao.salesOrder.taxExclusive')}
                  />
                </ProForm.Item>
              </Space>
              <Button 
                size="small" 
                icon={<ImportOutlined />} 
                onClick={() => setImportModalVisible(true)}
              >
                {t('app.kuaizhizao.salesOrder.importItems')}
              </Button>
            </div>
            <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.price_type !== curr?.price_type}>
              {({ getFieldValue: getFormValue }: any) => {
                const priceType = getFormValue('price_type') ?? 'tax_exclusive';
                const showTaxColumns = priceType === 'tax_inclusive';
                return (
            <ProForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: t('app.kuaizhizao.salesOrder.itemsRequired') }]}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const orderDetailColumns = [
                    {
                      title: t('app.kuaizhizao.salesOrder.material'),
                      dataIndex: 'material_id',
                      width: 200,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items?.[index] !== curr?.items?.[index]}>
                          {({ getFieldValue }: any) => {
                            const row = getFieldValue('items')?.[index];
                            const mid = row?.material_id ? Number(row.material_id) : null;
                            const fallback = mid && (row?.material_code || row?.material_name)
                              ? { value: mid, label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid) }
                              : undefined;
                            return (
                              <Space size={0} align="center" style={{ display: 'flex', width: '100%' }}>
                                <MaterialInventoryIndicator
                                  materialId={mid}
                                  requiredQuantity={Number(row?.required_quantity) || 0}
                                />
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
                                    material_unit: 'baseUnit',
                                  }}
                                  fallbackOption={fallback}
                                  formItemProps={{ style: { margin: 0, flex: 1 } }}
                                  showQuickCreate
                                  showAdvancedSearch
                                />
                              </Space>
                            );
                          }}
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.spec'),
                      dataIndex: 'material_spec',
                      width: 120,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                          <Input placeholder="规格" size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.unit'),
                      dataIndex: 'material_unit',
                      width: 80,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                          <Input placeholder="单位" size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.quantity'),
                      dataIndex: 'required_quantity',
                      width: 100,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'required_quantity']} rules={[{ required: true, message: '必填' }, { type: 'number', min: 0.01, message: '>0' }]} style={{ margin: 0 }}>
                          <InputNumber placeholder="数量" min={0} precision={2} style={{ width: '100%' }} size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.unitPrice'),
                      dataIndex: 'unit_price',
                      width: 100,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                          <InputNumber placeholder={t('app.kuaizhizao.salesOrder.unitPricePlaceholder')} min={0} precision={2} prefix="¥" style={{ width: '100%' }} size="small" />
                        </AntForm.Item>
                      ),
                    },
                    ...(showTaxColumns
                      ? [
                          {
                            title: t('app.kuaizhizao.salesOrder.exclAmount'),
                            width: 110,
                            align: 'right' as const,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue }: any) => {
                                  const items = getFieldValue('items') ?? [];
                                  const row = items[index];
                                  const qty = Number(row?.required_quantity) || 0;
                                  const price = Number(row?.unit_price) || 0;
                                  const exclAmt = qty * price;
                                  return <AmountDisplay resource="sales_order" value={exclAmt} />;
                                }}
                              </AntForm.Item>
                            ),
                          },
                        ]
                      : []),
                    ...(showTaxColumns
                      ? [
                          {
                            title: (
                              <span>
                                {t('app.kuaizhizao.salesOrder.taxRate')}
                                <Button type="link" size="small" style={{ padding: '0 4px', height: 'auto' }} onClick={() => {
                                  const items = formRef.current?.getFieldValue('items') ?? [];
                                  if (items.length === 0) return;
                                  const rate = prompt(t('app.kuaizhizao.salesOrder.taxRateBatch'), '13');
                                  if (rate != null && rate !== '') {
                                    const num = parseFloat(rate);
                                    if (!isNaN(num) && num >= 0 && num <= 100) {
                                      const next = items.map((it: any) => ({ ...it, tax_rate: num }));
                                      formRef.current?.setFieldsValue({ items: next });
                                    }
                                  }
                                }}>
                                  {t('app.kuaizhizao.salesOrder.batch')}
                                </Button>
                              </span>
                            ),
                            dataIndex: 'tax_rate',
                            width: 100,
                            align: 'right' as const,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item name={[index, 'tax_rate']} initialValue={0} style={{ margin: 0 }}>
                                <InputNumber placeholder="0" min={0} max={100} precision={2} addonAfter="%" style={{ width: '100%' }} size="small" />
                              </AntForm.Item>
                            ),
                          },
                          {
                            title: t('app.kuaizhizao.salesOrder.taxAmount'),
                            width: 100,
                            align: 'right' as const,
                            render: (_: any, __: any, index: number) => (
                              <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                                {({ getFieldValue }: any) => {
                                  const items = getFieldValue('items') ?? [];
                                  const row = items[index];
                                  const qty = Number(row?.required_quantity) || 0;
                                  const price = Number(row?.unit_price) || 0;
                                  const taxRate = Number(row?.tax_rate) || 0;
                                  const exclAmt = qty * price;
                                  const taxAmt = exclAmt * (taxRate / 100);
                                  return <AmountDisplay resource="sales_order" value={taxAmt} />;
                                }}
                              </AntForm.Item>
                            ),
                          },
                        ]
                      : []),
                    {
                      title: t('app.kuaizhizao.salesOrder.inclAmount'),
                      width: 120,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                          {({ getFieldValue }: any) => {
                            const items = getFieldValue('items') ?? [];
                            const row = items[index];
                            const qty = Number(row?.required_quantity) || 0;
                            const price = Number(row?.unit_price) || 0;
                            const taxRate = Number(row?.tax_rate) || 0;
                            const exclAmt = qty * price;
                            const taxAmt = exclAmt * (taxRate / 100);
                            const totalIncl = exclAmt + taxAmt;
                            const isEditing = editingIncl?.index === index;
                            const displayValue = isEditing ? editingIncl.value : totalIncl;
                            return (
                              <InputNumber
                                placeholder={t('app.kuaizhizao.salesOrder.inclAmountPlaceholder')}
                                min={0}
                                precision={2}
                                prefix="¥"
                                style={{ width: '100%' }}
                                size="small"
                                value={displayValue}
                                onChange={(val) => {
                                  const v = val ?? null;
                                  editingInclValueRef.current = v;
                                  setEditingIncl({ index, value: v });
                                }}
                                onFocus={() => {
                                  setEditingIncl((prev) => (prev?.index === index ? prev : { index, value: totalIncl }));
                                  editingInclValueRef.current = totalIncl;
                                }}
                                onBlur={() => {
                                  const incl = editingInclValueRef.current;
                                  if (editingIncl?.index === index && incl != null && qty > 0) {
                                    const excl = (1 + taxRate / 100) > 0 ? incl / (1 + taxRate / 100) : incl;
                                    const newPrice = excl / qty;
                                    const next = [...items];
                                    next[index] = { ...row, unit_price: newPrice };
                                    formRef.current?.setFieldsValue({ items: next });
                                  }
                                  setEditingIncl(null);
                                }}
                              />
                            );
                          }}
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.deliveryDate'),
                      dataIndex: 'delivery_date',
                      width: 120,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'delivery_date']} rules={[{ required: true, message: '必填' }]} style={{ margin: 0 }}>
                          <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '操作',
                      width: 70,
                      fixed: 'right' as const,
                      onHeaderCell: () => ({ className: 'sales-order-fixed-op-header' }),
                      render: (_: any, __: any, index: number) => (
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                          {t('app.kuaizhizao.salesOrder.delete')}
                        </Button>
                      ),
                    },
                  ];
                  const totalWidth = orderDetailColumns.reduce((s, c) => s + (c.width as number || 0), 0);
                  return (
                    <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                      <style>{`
                        .sales-order-detail-table .ant-table-thead > tr > th {
                          background-color: var(--ant-color-fill-alter) !important;
                          font-weight: 600;
                        }
                        /* 固定操作列表头：不透明背景，避免与下拉/相邻列重叠（通过 onHeaderCell 精确命中） */
                        .sales-order-detail-table .ant-table-thead > tr > th.sales-order-fixed-op-header {
                          background: #fafafa !important;
                        }
                        .sales-order-detail-table .ant-table {
                          border-top: 1px solid var(--ant-color-border);
                        }
                        .sales-order-detail-table .ant-table-tbody > tr > td {
                          border-bottom: 1px solid var(--ant-color-border);
                          overflow: visible !important;
                        }
                        /* 明细行验证错误：仅红色边框提示，不显示文字 */
                        .sales-order-detail-table .ant-form-item-explain,
                        .sales-order-detail-table .ant-form-item-explain-error {
                          display: none !important;
                        }
                        /* 选中文字背景样式 */
                        .sales-order-detail-table .ant-input-number-input::selection,
                        .sales-order-detail-table .ant-input::selection {
                          background-color: var(--ant-color-primary);
                          color: #fff;
                          border-radius: 0;
                        }
                      `}</style>
                      <div style={{ width: '100%', overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch' }}>
                        <Table
                          className="sales-order-detail-table"
                          size="small"
                          dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                          rowKey="key"
                          pagination={false}
                          columns={orderDetailColumns}
                          scroll={fields.length > 0 ? { x: totalWidth } : undefined}
                          style={{ width: '100%', margin: 0 }}
                          footer={() => (
                            <Button
                              type="dashed"
                              icon={<PlusOutlined />}
                              onClick={() => {
                                const mainDelivery = formRef.current?.getFieldValue('delivery_date');
                                const defaultDelivery = mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
                                add({
                                  material_id: undefined,
                                  material_code: '',
                                  material_name: '',
                                  material_spec: '',
                                  material_unit: '',
                                  required_quantity: 0,
                                  delivery_date: defaultDelivery,
                                  unit_price: 0,
                                  tax_rate: 0,
                                });
                              }}
                              block
                            >
                                {t('app.kuaizhizao.salesOrder.addItem')}
                                </Button>
                          )}
                        />
                      </div>
                      <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                        {({ getFieldValue }: any) => {
                          const items = getFieldValue('items') ?? [];
                          const subtotal = items.reduce((sum: number, it: any) => {
                            const excl = (Number(it?.required_quantity) || 0) * (Number(it?.unit_price) || 0);
                            const taxRate = Number(it?.tax_rate) || 0;
                            const incl = excl * (1 + taxRate / 100);
                            return sum + incl;
                          }, 0);
                          return (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '12px 0', marginTop: 8, borderTop: '1px solid var(--ant-color-border)', fontSize: 14 }}>
                              <span>{t('app.kuaizhizao.salesOrder.subtotal')}：<AmountDisplay resource="sales_order" value={subtotal} /></span>
                              <span style={{ fontWeight: 600 }}>{t('app.kuaizhizao.salesOrder.totalAmount')}：<AmountDisplay resource="sales_order" value={subtotal} /></span>
                            </div>
                          );
                        }}
                      </AntForm.Item>
                    </div>
                  );
                }}
              </AntForm.List>
            </ProForm.Item>
                );
              }}
            </AntForm.Item>
          </div>

          <ProFormUploadButton
            name="attachments"
            label="附件"
            max={10}
            fieldProps={{
              multiple: true,
              customRequest: async (options) => {
                try {
                  const res = await uploadMultipleFiles([options.file as File], { category: 'sales_order_attachments' });
                  if (options.onSuccess) {
                    options.onSuccess(res[0], options.file as any);
                  }
                } catch (err) {
                  if (options.onError) {
                    options.onError(err as any);
                  }
                }
              }
            }}
          />

          <ProFormTextArea
            name="notes"
            label="备注"
            placeholder="请输入备注"
          />
        </ProForm>

        <UniImport
          visible={importModalVisible}
          onCancel={() => setImportModalVisible(false)}
          onConfirm={handleItemImport}
          title={t('app.kuaizhizao.salesOrder.importItemsTitle')}
          headers={[t('app.kuaizhizao.salesOrder.materialCode'), t('app.kuaizhizao.salesOrder.spec'), t('app.kuaizhizao.salesOrder.unit'), t('app.kuaizhizao.salesOrder.quantity'), t('app.kuaizhizao.salesOrder.unitPrice'), t('app.kuaizhizao.salesOrder.deliveryDate')]}
          exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
        />
      </Modal>

      <CustomerFormModal
        open={customerCreateVisible}
        onClose={() => setCustomerCreateVisible(false)}
        editUuid={null}
        onSuccess={(customer) => {
          setCustomers((prev) => [...prev, customer]);
          formRef.current?.setFieldsValue({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_contact: customer.contactPerson,
            customer_phone: customer.phone,
          });
          setCustomerCreateVisible(false);
        }}
      />

      {/* 详情 Drawer */}
      <Drawer
        title={
          <Space size={4}>
            <span>{t('app.kuaizhizao.salesOrder.detail')}</span>
            {currentSalesOrder?.order_code && (
              <>
                <span style={{ color: 'var(--ant-color-text-secondary)', fontWeight: 'normal' }}>
                  {currentSalesOrder.order_code}
                </span>
                <Tooltip title={t('field.invitationCode.copy')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined style={{ fontSize: 12 }} />}
                    onClick={() => {
                      navigator.clipboard.writeText(currentSalesOrder.order_code ?? '').then(
                        () => messageApi.success(t('common.copySuccess')),
                        () => messageApi.error(t('common.copyFailed'))
                      );
                    }}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        }
        width="50%"
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          currentSalesOrder && (
            <Space size="small">
              <Button icon={<ApartmentOutlined />} onClick={handleOpenChangeImpact}>
                变更影响
              </Button>
              <Button icon={<BellOutlined />} onClick={handleOpenReminder}>
                {t('app.kuaizhizao.salesOrder.reminder')}
              </Button>
              {(() => {
                const lifecycle = getSalesOrderLifecycle(currentSalesOrder);
                const canEdit = ['草稿', '待审核', '已驳回'].includes(lifecycle.stageName ?? '');
                const isDraft = (lifecycle.stageName ?? currentSalesOrder.status) === '草稿' || currentSalesOrder.status === SalesOrderStatus.DRAFT;
                const canDelete = ['草稿', '待审核'].includes(lifecycle.stageName ?? '') || currentSalesOrder.status === SalesOrderStatus.DRAFT || currentSalesOrder.status === 'PENDING_REVIEW';
                return (
                  <>
                    {canEdit && (
                      <Button icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit([currentSalesOrder.id!]); }}>
                        {t('app.kuaizhizao.salesOrder.editAction')}
                      </Button>
                    )}
                    {canDelete && (
                      <Button danger icon={<DeleteOutlined />} onClick={() => handleDeleteSingle(currentSalesOrder.id!)}>
                        {t('app.kuaizhizao.salesOrder.delete')}
                      </Button>
                    )}
                  </>
                );
              })()}
              <UniWorkflowActions
                record={currentSalesOrder}
                entityName={t('app.kuaizhizao.salesOrder.entityName')}
                statusField="status"
                reviewStatusField="review_status"
                draftStatuses={[SalesOrderStatus.DRAFT]}
                pendingStatuses={[ReviewStatus.PENDING, '待审核']}
                approvedStatuses={[...APPROVED_STATUS_VALUES]}
                rejectedStatuses={['已驳回', SalesOrderStatus.REJECTED]}
                autoApproveWhenSubmit={!auditEnabled}
                theme="default"
                actions={{
                  submit: async (id) => {
                    // 后端在 audit_required=False 时 submit 内部已自动审核，无需再调用 approve，否则会重复记录状态变更
                    return submitSalesOrder(id);
                  },
                  approve: approveSalesOrder,
                  revoke: unapproveSalesOrder,
                }}
                onSuccess={() => { invalidateMenuBadge(); invalidateStatistics(); refreshDrawerOrder(currentSalesOrder?.id); }}
                confirmMessages={{
                  submit: auditEnabled ? t('app.kuaizhizao.salesOrder.submitConfirmAudit') : t('app.kuaizhizao.salesOrder.submitConfirmAuto'),
                }}
              />
              {isApprovedRecord(currentSalesOrder) && (
                <Dropdown
                  menu={{
                    items: [
                      { key: 'computation', label: t('app.kuaizhizao.salesOrder.demandComputation'), icon: <ArrowDownOutlined />, disabled: !!currentSalesOrder.pushed_to_computation, onClick: () => !currentSalesOrder.pushed_to_computation && handlePushToComputation(currentSalesOrder.id!) },
                      { key: 'plan', label: t('app.kuaizhizao.salesOrder.pushToProductionPlan'), icon: <ArrowDownOutlined />, onClick: () => handlePushToProductionPlan(currentSalesOrder.id!) },
                      { key: 'workorder', label: t('app.kuaizhizao.salesOrder.pushToWorkOrder'), icon: <ArrowDownOutlined />, onClick: () => handlePushToWorkOrder(currentSalesOrder.id!) },
                      { type: 'divider' },
                      { key: 'shipment', label: t('app.kuaizhizao.salesOrder.shipmentNotice'), icon: <SendOutlined />, onClick: () => handlePushToShipmentNotice(currentSalesOrder.id!) },
                      { key: 'invoice', label: t('app.kuaizhizao.salesOrder.salesInvoice'), icon: <FileTextOutlined />, onClick: () => handlePushToInvoice(currentSalesOrder.id!) },
                    ],
                  }}
                >
                  <Button icon={<ArrowDownOutlined />}>
                    {t('app.kuaizhizao.salesOrder.push')}
                  </Button>
                </Dropdown>
              )}
              {isApprovedRecord(currentSalesOrder) && currentSalesOrder.pushed_to_computation && (
              <Button icon={<RollbackOutlined />} onClick={() => handleWithdrawFromComputation(currentSalesOrder.id!)}>
                {t('app.kuaizhizao.salesOrder.withdrawComputation')}
              </Button>
              )}
            </Space>
          )
        }
      >
        {currentSalesOrder && (
          <>
            <ProDescriptions<SalesOrder>
              dataSource={currentSalesOrder}
              column={2}
              columns={[
                {
                  title: t('app.kuaizhizao.salesOrder.orderCode'),
                  dataIndex: 'order_code',
                  render: (_, record) => (
                    <Space size={4}>
                      <span>{record.order_code ?? '-'}</span>
                      <Tooltip title={t('field.invitationCode.copy')}>
                        <Button
                          type="text"
                          size="small"
                          icon={<CopyOutlined style={{ fontSize: 12 }} />}
                          onClick={() => {
                            const text = record.order_code ?? '';
                            if (text) {
                              navigator.clipboard.writeText(text).then(
                                () => messageApi.success(t('common.copySuccess')),
                                () => messageApi.error(t('common.copyFailed'))
                              );
                            }
                          }}
                        />
                      </Tooltip>
                    </Space>
                  ),
                },
                {
                  title: t('app.kuaizhizao.salesOrder.orderDate'),
                  dataIndex: 'order_date',
                  valueType: 'date',
                },
                {
                  title: t('app.kuaizhizao.salesOrder.deliveryDate'),
                  dataIndex: 'delivery_date',
                  valueType: 'date',
                },
                {
                  title: t('app.kuaizhizao.salesOrder.customerName'),
                  dataIndex: 'customer_name',
                },
                {
                  title: t('app.kuaizhizao.salesOrder.customerContact'),
                  dataIndex: 'customer_contact',
                },
                {
                  title: t('app.kuaizhizao.salesOrder.customerPhone'),
                  dataIndex: 'customer_phone',
                },
                {
                  title: t('app.kuaizhizao.salesOrder.salesman'),
                  dataIndex: 'salesman_name',
                },
                {
                  title: t('app.kuaizhizao.salesOrder.shippingAddress'),
                  dataIndex: 'shipping_address',
                  span: 2,
                },
                {
                  title: t('app.kuaizhizao.salesOrder.shippingMethod'),
                  dataIndex: 'shipping_method',
                  render: (_, record) => {
                    const val = record.shipping_method;
                    const opt = shippingMethodOptions.find((o) => o.value === val);
                    return opt?.label ?? val ?? '-';
                  },
                },
                {
                  title: t('app.kuaizhizao.salesOrder.paymentTerms'),
                  dataIndex: 'payment_terms',
                  render: (_, record) => {
                    const val = record.payment_terms;
                    const opt = paymentTermsOptions.find((o) => o.value === val);
                    return opt?.label ?? val ?? '-';
                  },
                },
                {
                  title: t('app.kuaizhizao.salesOrder.priceType'),
                  dataIndex: 'price_type',
                  render: (_, record) => (record.price_type === 'tax_inclusive' ? t('app.kuaizhizao.salesOrder.taxInclusive') : t('app.kuaizhizao.salesOrder.taxExclusive')),
                },
                {
                  title: t('app.kuaizhizao.salesOrder.totalAmountLabel'),
                  dataIndex: 'total_amount',
                  render: (_, record) => <AmountDisplay resource="sales_order" value={record.total_amount ?? 0} />,
                },
                {
                  title: t('app.kuaizhizao.salesOrder.notes'),
                  dataIndex: 'notes',
                  span: 2,
                },
              ]}
            />

            {/* 生命周期状态（与需求管理统一布局） */}
            {(() => {
              const lifecycle = getSalesOrderLifecycle(currentSalesOrder);
              const mainStages = lifecycle.mainStages ?? [];
              const subStages = lifecycle.subStages ?? [];
              if (mainStages.length === 0 && subStages.length === 0) return null;
              return (
                <div style={{ marginTop: 24, marginBottom: 24 }}>
                  <h4 style={{ marginBottom: 12 }}>{t('app.kuaizhizao.salesOrder.lifecycle')}</h4>
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
                </div>
              );
            })()}

            {/* 订单明细 */}
            {currentSalesOrder.items && currentSalesOrder.items.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3>{t('app.kuaizhizao.salesOrder.detailItems')}</h3>
                <Table<SalesOrderItem>
                  size="small"
                  columns={[
                    { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', width: 120 },
                    { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', width: 200 },
                    { title: t('app.kuaizhizao.salesOrder.materialSpec'), dataIndex: 'material_spec', width: 120 },
                    { title: t('app.kuaizhizao.salesOrder.unit'), dataIndex: 'material_unit', width: 80 },
                    {
                      title: t('app.kuaizhizao.salesOrder.bomCheck'),
                      key: 'bom_check',
                      width: 80,
                      render: (_: unknown, record: SalesOrderItem) => (
                        <MaterialBomIndicator materialId={record.material_id} />
                      ),
                    },
                    {
                      title: t('app.kuaizhizao.salesOrder.quantity'),
                      dataIndex: 'required_quantity',
                      width: 100,
                      align: 'right' as const,
                      render: (val: number, record: SalesOrderItem) => (
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                          <MaterialInventoryIndicator
                            materialId={record.material_id}
                            requiredQuantity={record.required_quantity}
                          />
                          {val ?? 0}
                        </span>
                      ),
                    },
                    { title: t('app.kuaizhizao.salesOrder.unitPrice'), dataIndex: 'unit_price', width: 100, align: 'right' as const, render: (val) => <AmountDisplay resource="sales_order" value={val} /> },
                    { title: t('app.kuaizhizao.salesOrder.taxRate'), dataIndex: 'tax_rate', width: 80, align: 'right' as const, render: (val) => val ?? 0 },
                    { title: t('app.kuaizhizao.salesOrder.inclAmount'), dataIndex: 'item_amount', width: 120, align: 'right' as const, render: (val) => <AmountDisplay resource="sales_order" value={val} /> },
                    { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', width: 120 },
                    { title: t('app.kuaizhizao.salesOrder.deliveredQty'), dataIndex: 'delivered_quantity', width: 100, align: 'right' as const, render: (text) => text || 0 },
                    { title: t('app.kuaizhizao.salesOrder.remainingQty'), dataIndex: 'remaining_quantity', width: 100, align: 'right' as const, render: (text) => text || 0 },
                  ]}
                  dataSource={currentSalesOrder.items}
                  rowKey="id"
                  pagination={false}
                  bordered
                />
              </div>
            )}

            {/* 操作记录（含上下游关联） */}
            {currentSalesOrder?.id && (
              <div style={{ marginTop: 24 }}>
                <DocumentTrackingPanel
                  documentType="sales_order"
                  documentId={currentSalesOrder.id}
                  refreshKey={trackingRefreshKey}
                  onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                />
              </div>
            )}
          </>
        )}
      </Drawer>

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title={t('app.kuaizhizao.salesOrder.syncFromDataset')}
      />

      {/* 提醒弹窗 */}
      <Modal
        title={t('app.kuaizhizao.salesOrder.reminderModalTitle')}
        open={reminderModalOpen}
        onCancel={() => setReminderModalOpen(false)}
        onOk={handleReminderSubmit}
        okText={t('app.kuaizhizao.salesOrder.reminderSend')}
        cancelText={t('common.cancel')}
        confirmLoading={reminderSubmitting}
        destroyOnHidden
      >
        <AntForm form={reminderForm} layout="vertical" style={{ marginTop: 16 }}>
          <AntForm.Item
            name="recipient_user_uuid"
            label={t('app.kuaizhizao.salesOrder.reminderRecipient')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.reminderRecipientRequired') }]}
          >
            <Select
              placeholder={t('app.kuaizhizao.salesOrder.reminderRecipientPlaceholder')}
              showSearch
              optionFilterProp="label"
              loading={usersLoading}
              options={users.map((u) => ({
                value: u.uuid,
                label: u.full_name ? `${u.full_name} (${u.username})` : u.username,
              }))}
            />
          </AntForm.Item>
          <AntForm.Item
            name="action_type"
            label={t('app.kuaizhizao.salesOrder.reminderAction')}
            rules={[{ required: true, message: t('app.kuaizhizao.salesOrder.reminderActionRequired') }]}
          >
            <Select
              placeholder={t('app.kuaizhizao.salesOrder.reminderActionPlaceholder')}
              options={[
                { value: 'review', label: t('app.kuaizhizao.salesOrder.reminderActionReview') },
                { value: 'delivery', label: t('app.kuaizhizao.salesOrder.reminderActionDelivery') },
                { value: 'invoice', label: t('app.kuaizhizao.salesOrder.reminderActionInvoice') },
                { value: 'follow_up', label: t('app.kuaizhizao.salesOrder.reminderActionFollowUp') },
                { value: 'other', label: t('app.kuaizhizao.salesOrder.reminderActionOther') },
              ]}
            />
          </AntForm.Item>
          <AntForm.Item name="remarks" label={t('app.kuaizhizao.salesOrder.notes')}>
            <Input.TextArea rows={3} placeholder={t('app.kuaizhizao.salesOrder.remarksPlaceholder')} maxLength={500} showCount />
          </AntForm.Item>
        </AntForm>
      </Modal>

      {/* 变更影响弹窗（排程管理增强） */}
      <Modal
        title="变更影响"
        open={changeImpactVisible}
        onCancel={() => { setChangeImpactVisible(false); setChangeImpactData(null); }}
        footer={null}
        width={560}
      >
        {changeImpactLoading ? (
          <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip="加载中..." />
          </div>
        ) : changeImpactData ? (
          <div>
            <p style={{ marginBottom: 12, color: 'var(--ant-color-text-secondary)' }}>
              上游变更：{changeImpactData.upstream_change.code ?? changeImpactData.upstream_change.name ?? '-'}
              {changeImpactData.upstream_change.changed_at && `（${dayjs(changeImpactData.upstream_change.changed_at).format('YYYY-MM-DD HH:mm')}）`}
            </p>
            {(changeImpactData.affected_demands?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>受影响的需求</div>
                <Table size="small" dataSource={changeImpactData.affected_demands} rowKey="id" pagination={false}
                  columns={[{ title: '编码', dataIndex: 'code', key: 'code' }, { title: '名称', dataIndex: 'name', key: 'name' }, { title: '状态', dataIndex: 'status', key: 'status' }]} />
              </div>
            )}
            {(changeImpactData.affected_computations?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>受影响的需求计算</div>
                <Table size="small" dataSource={changeImpactData.affected_computations} rowKey="id" pagination={false}
                  columns={[{ title: '编码', dataIndex: 'code', key: 'code' }, { title: '状态', dataIndex: 'status', key: 'status' }]} />
              </div>
            )}
            {(changeImpactData.affected_plans?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>受影响的生产计划</div>
                <Table size="small" dataSource={changeImpactData.affected_plans} rowKey="id" pagination={false}
                  columns={[{ title: '编码', dataIndex: 'code', key: 'code' }, { title: '名称', dataIndex: 'name', key: 'name' }, { title: '状态', dataIndex: 'status', key: 'status' }]} />
              </div>
            )}
            {(changeImpactData.affected_work_orders?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>受影响的工单</div>
                <Table size="small" dataSource={changeImpactData.affected_work_orders} rowKey="id" pagination={false}
                  columns={[{ title: '编码', dataIndex: 'code', key: 'code' }, { title: '名称', dataIndex: 'name', key: 'name' }, { title: '状态', dataIndex: 'status', key: 'status' }]} />
              </div>
            )}
            {(changeImpactData.recommended_actions?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>建议操作</div>
                <Space wrap>
                  {changeImpactData.recommended_actions.map((a, i) => (
                    <Tag key={i} color="blue">{a}</Tag>
                  ))}
                </Space>
              </div>
            )}
            {!changeImpactData.affected_demands?.length && !changeImpactData.affected_computations?.length &&
             !changeImpactData.affected_plans?.length && !changeImpactData.affected_work_orders?.length && (
              <p style={{ color: 'var(--ant-color-text-secondary)' }}>暂无下游受影响单据</p>
            )}
          </div>
        ) : null}
      </Modal>

      {/* 下推预览弹窗 */}
      <Modal
        title={t('app.kuaizhizao.salesOrder.pushPreviewTitle')}
        open={pushPreviewOpen}
        onCancel={() => {
          setPushPreviewOpen(false);
          setPushPreviewData(null);
          setPushPreviewAction(null);
        }}
        okText={t('app.kuaizhizao.salesOrder.confirmPush')}
        cancelText={t('common.cancel')}
        width={560}
        confirmLoading={pushPreviewConfirming}
        onOk={handlePushPreviewConfirm}
        okButtonProps={{ disabled: pushPreviewLoading || !pushPreviewData }}
      >
        {pushPreviewLoading ? (
          <div style={{ minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin tip={t('app.kuaizhizao.salesOrder.loadingPreview')} />
          </div>
        ) : pushPreviewData ? (
          <div>
            <p style={{ marginBottom: 12, fontWeight: 500 }}>{pushPreviewData.summary}</p>
            {pushPreviewData.plan_name_preview && (
              <p style={{ marginBottom: 8, color: 'var(--ant-color-text-secondary)' }}>
                {t('app.kuaizhizao.salesOrder.planName')}：{pushPreviewData.plan_name_preview}
              </p>
            )}
            {pushPreviewData.items?.length > 0 && (
              <Table
                size="small"
                dataSource={pushPreviewData.items}
                columns={[
                  { title: t('app.kuaizhizao.salesOrder.materialCode'), dataIndex: 'material_code', key: 'material_code', width: 120, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.materialName'), dataIndex: 'material_name', key: 'material_name', width: 140, ellipsis: true },
                  { title: t('app.kuaizhizao.salesOrder.quantity'), dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right' as const },
                  { title: t('app.kuaizhizao.salesOrder.deliveryDate'), dataIndex: 'delivery_date', key: 'delivery_date', width: 100 },
                  ...(pushPreviewData.items[0]?.suggested_action
                    ? [{ title: t('app.kuaizhizao.salesOrder.suggestion'), dataIndex: 'suggested_action', key: 'suggested_action', width: 70 }]
                    : []),
                ]}
                rowKey={(r, i) => `${r.material_code}-${i}`}
                pagination={false}
                style={{ marginBottom: 8 }}
              />
            )}
            {pushPreviewData.tip && (
              <p style={{ marginTop: 8, color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
                {pushPreviewData.tip}
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
};

export default SalesOrdersPage;
