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
import { ActionType, ProColumns, ProForm, ProFormSelect, ProFormText, ProFormDatePicker, ProFormTextArea, ProDescriptions } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Drawer, Table, Input, InputNumber, Select, Row, Col, Form as AntForm, DatePicker, Spin } from 'antd';
import { EyeOutlined, EditOutlined, CheckCircleOutlined, SendOutlined, ArrowDownOutlined, PlusOutlined, DeleteOutlined, RollbackOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { AmountDisplay } from '../../../../../components/permission';
import {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  submitSalesOrder,
  approveSalesOrder,
  unapproveSalesOrder,
  pushSalesOrderToComputation,
  withdrawSalesOrderFromComputation,
  bulkDeleteSalesOrders,
  SalesOrder,
  SalesOrderItem,
  SalesOrderStatus,
  ReviewStatus,
} from '../../../services/sales-order';
import { getDocumentRelations } from '../../../services/document-relation';
import DocumentRelationDisplay from '../../../../../components/document-relation-display';
import type { DocumentRelationData } from '../../../../../components/document-relation-display';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { materialApi } from '../../../../master-data/services/material';
import type { Material } from '../../../../master-data/types/material';
import { customerApi } from '../../../../master-data/services/supply-chain';
import type { Customer } from '../../../../master-data/types/supply-chain';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';



/** 展开行：订单明细子表格 */
const OrderItemsExpandedRow: React.FC<{ orderId: number }> = ({ orderId }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  useEffect(() => {
    setLoading(true);
    getSalesOrder(orderId, true)
      .then((res) => {
        setItems(res?.items || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [orderId]);
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="small" />
      </div>
    );
  }
  const itemColumns = [
    { title: '物料编码', dataIndex: 'material_code', key: 'material_code', width: 120, ellipsis: true },
    { title: '物料名称', dataIndex: 'material_name', key: 'material_name', width: 140, ellipsis: true },
    { title: '规格', dataIndex: 'material_spec', key: 'material_spec', width: 100, ellipsis: true },
    { title: '单位', dataIndex: 'material_unit', key: 'material_unit', width: 60 },
    { title: '需求数量', dataIndex: 'required_quantity', key: 'required_quantity', width: 90, align: 'right' as const },
    { 
      title: '单价', 
      dataIndex: 'unit_price', 
      key: 'unit_price', 
      width: 90, 
      align: 'right' as const, 
      render: (val: number) => <AmountDisplay resource="sales_order" value={val} /> 
    },
    { 
      title: '金额', 
      dataIndex: 'item_amount', 
      key: 'item_amount', 
      width: 100, 
      align: 'right' as const, 
      render: (val: number) => <AmountDisplay resource="sales_order" value={val} /> 
    },
    { title: '交货日期', dataIndex: 'delivery_date', key: 'delivery_date', width: 110 },
  ];
  return (
    <div
      className="sales-order-items-subtable"
      style={{
        padding: '0',
        overflow: 'hidden'
      }}
    >
      <style>{`
        .sales-order-items-subtable .ant-table-cell {
          margin-inline: 0 !important;
        }
        .sales-order-items-subtable .ant-table-wrapper {
          overflow-x: hidden !important;
        }
        .sales-order-items-subtable .ant-table-thead > tr > th {
          background-color: var(--ant-color-fill-alter) !important;
          font-weight: 600;
        }
        .sales-order-items-subtable .ant-table {
          border-top: 1px solid var(--ant-color-border);
        }
        .sales-order-items-subtable .ant-table-tbody > tr > td {
          border-bottom: 1px solid var(--ant-color-border);
        }
      `}</style>
      <Table
        size="small"
        columns={itemColumns}
        dataSource={items}
        rowKey={(r) => r.id ?? r.material_id ?? String(Math.random())}
        pagination={false}
      />
    </div>
  );
};

const SalesOrdersPage: React.FC = () => {
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);

  // 销售订单审核开关（从业务配置加载）
  const [auditEnabled, setAuditEnabled] = useState(true);

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

  // Modal 相关状态（新建/编辑）
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);

  // Drawer 相关状态（详情查看）
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentSalesOrder, setCurrentSalesOrder] = useState<SalesOrder | null>(null);
  const [documentRelations, setDocumentRelations] = useState<DocumentRelationData | null>(null);

  // 物料列表（用于物料选择器）
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  // 客户列表（对接技术数据管理-供应链-客户）
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  // 新建时预览的订单编码（用于提交时判断是否需正式占号）
  const [previewCode, setPreviewCode] = useState<string | null>(null);

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
        messageApi.error('加载物料列表失败');
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
        messageApi.error('加载客户列表失败');
      } finally {
        setCustomersLoading(false);
      }
    };
    loadCustomers();
  }, [messageApi]);

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
    setModalVisible(true);
    formRef.current?.resetFields();
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
          if (item.material_id) {
            // 转换明细中的日期字段
            return {
              ...item,
              delivery_date: item.delivery_date ? dayjs(item.delivery_date) : undefined,
            };
          }
          const matched = materials.find(m =>
            (m.mainCode || m.code) === item.material_code || m.name === item.material_name
          );
          if (matched) {
            return {
              ...item,
              material_id: matched.id,
              material_code: matched.mainCode || matched.code || item.material_code,
              material_name: matched.name || item.material_name,
              material_spec: matched.specification || item.material_spec,
              material_unit: matched.baseUnit || item.material_unit,
              delivery_date: item.delivery_date ? dayjs(item.delivery_date) : undefined,
            };
          }
          return {
            ...item,
            delivery_date: item.delivery_date ? dayjs(item.delivery_date) : undefined,
          };
        });
        const customerId = data.customer_id ?? customers.find(c => c.name === data.customer_name)?.id;

        // 转换主表单的日期字段为 dayjs 对象
        const formData = {
          ...data,
          items,
          customer_id: customerId,
          order_date: data.order_date ? dayjs(data.order_date) : undefined,
          delivery_date: data.delivery_date ? dayjs(data.delivery_date) : undefined,
        };

        formRef.current?.setFieldsValue(formData);
      } catch (error: any) {
        messageApi.error('获取销售订单详情失败');
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

        // 获取单据关联关系（使用 sales_order 作为文档类型）
        try {
          const relations = await getDocumentRelations('sales_order', id);
          setDocumentRelations(relations);
        } catch (error) {
          console.error('获取单据关联关系失败:', error);
          setDocumentRelations(null);
        }

        setDrawerVisible(true);
      } catch (error: any) {
        messageApi.error('获取销售订单详情失败');
      }
    }
  };

  /**
   * 处理删除销售订单
   */
  /**
   * 处理删除销售订单
   */
  const handleDelete = async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      messageApi.warning('请选择要删除的记录');
      return;
    }

    modalApi.confirm({
      title: '确认删除',
      content: `确定要删除选中 ${keys.length} 个销售订单吗？此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const ids = keys.map(k => Number(k));
          const res = await bulkDeleteSalesOrders(ids);

          if (res.failed_count === 0) {
            messageApi.success(`成功删除 ${res.success_count} 个销售订单`);
          } else {
            messageApi.warning(`删除完成：成功 ${res.success_count} 个，失败 ${res.failed_count} 个`);
            if (res.failed_items && res.failed_items.length > 0) {
              const errorMsg = res.failed_items.map(item => `订单ID ${item.id}: ${item.reason}`).join('\n');
              console.error('删除失败详情:', errorMsg);
              // 可以选择显示更详细的错误弹窗
            }
          }
          actionRef.current?.reload();
          // 清除选中项
          if (actionRef.current?.clearSelected) {
            actionRef.current.clearSelected();
          }
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
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
        messageApi.warning('请至少添加一条订单明细');
        return;
      }

      // 数据处理：回写客户名称、计算金额
      if (values.customer_id != null && customers.length) {
        const c = customers.find(x => x.id === values.customer_id);
        if (c) values.customer_name = c.name;
      }

      const q = (it: SalesOrderItem) => Number((it as any).required_quantity) || 0;
      const p = (it: SalesOrderItem) => Number((it as any).unit_price) || 0;

      // 格式化主表日期字段，避免后端报错
      if (values.order_date) {
        values.order_date = dayjs(values.order_date).format('YYYY-MM-DD');
      }
      if (values.delivery_date) {
        values.delivery_date = dayjs(values.delivery_date).format('YYYY-MM-DD');
      }

      values.items = items.map((it: SalesOrderItem) => {
        const amt = q(it) * p(it);
        const d = (it as any).delivery_date;
        const deliveryDateStr = d != null ? (typeof d === 'string' ? d.slice(0, 10) : dayjs(d).format('YYYY-MM-DD')) : undefined;
        return {
          ...it,
          delivery_date: deliveryDateStr ?? (values.delivery_date != null ? dayjs(values.delivery_date).format('YYYY-MM-DD') : undefined),
          item_amount: amt,
          order_quantity: q(it),
          remaining_quantity: (it as any).remaining_quantity != null ? Number((it as any).remaining_quantity) : q(it),
          total_amount: amt,
        };
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
      if (isEdit && currentId) {
        await updateSalesOrder(currentId, values);
        if (isDraft) messageApi.success('销售订单已更新');
      } else {
        const res = await createSalesOrder(values);
        // 假设 createSalesOrder 返回创建的对象或ID，如果返回void则需修改Service适配
        // 这里假设 res 包含 id，或者我们需要重新查询。为保险起见，如果 res 中没有 id，可能需要调整。
        // 通常 list 或 get 接口返回 id。假设 res 是 SalesOrder 对象。
        orderId = (res as any)?.id;
      }

      // 2. 如果不是草稿（即点击了“提交订单”），则执行后续流程
      if (!isDraft && orderId) {
        await submitSalesOrder(orderId);

        // 检查审核配置
        let currentAuditEnabled = auditEnabled;
        try {
          // 再次确认配置
          const config = await getBusinessConfig();
          currentAuditEnabled = config.parameters?.sales?.audit_enabled === true;
        } catch (e) {/* ignore */ }

        if (!currentAuditEnabled) {
          await approveSalesOrder(orderId);
          messageApi.success('订单已创建并自动通过审核');
        } else {
          messageApi.success('订单已创建并提交，请等待审核');
        }
      } else {
        if (!isEdit) messageApi.success('订单已保存为草稿');
      }

      setModalVisible(false);
      setPreviewCode(null);
      actionRef.current?.reload();
    } catch (error: any) {
      console.error(error);
      messageApi.error(error.message || '操作失败');
    }
  };

  const onModalSubmit = async (isDraft: boolean) => {
    const values = await formRef.current?.validateFields();
    if (values) {
      await handleSaveInternal(values, isDraft);
    }
  };

  /**
   * 物料选择时回填编码、名称、规格、单位（Form.List 内明细由表单托管，通过 setFieldsValue 更新）
   */
  const handleMaterialSelectForForm = (index: number, materialId: number | undefined) => {
    const items = formRef.current?.getFieldValue('items') ?? [];
    const next = [...items];
    if (next[index]) {
      const m = materials.find(mo => mo.id === materialId);
      next[index] = {
        ...next[index],
        material_id: materialId,
        material_code: m ? (m.mainCode || m.code || '') : '',
        material_name: m ? m.name || '' : '',
        material_spec: m ? (m.specification || '') : '',
        material_unit: m ? (m.baseUnit || '') : '',
      };
      formRef.current?.setFieldsValue({ items: next });
    }
  };

  /**
   * 处理提交销售订单
   */
  /**
   * 处理提交销售订单
   */
  /**
   * 处理提交销售订单
   */
  const handleSubmitDemand = async (id: number) => {
    // 提交前重新获取最新的业务配置（以防用户修改了配置但未刷新页面）
    let currentAuditEnabled = auditEnabled;
    try {
      const config = await getBusinessConfig();
      // 默认为关闭，与配置页面 Switch 组件行为一致
      currentAuditEnabled = config.parameters?.sales?.audit_enabled === true;
      setAuditEnabled(currentAuditEnabled);
    } catch (e) {
      console.warn('获取最新提交配置失败，将使用当前页面缓存的配置状态', e);
    }

    modalApi.confirm({
      title: '提交销售订单',
      content: currentAuditEnabled
        ? '确定要提交此销售订单吗？提交后将进入审核流程。'
        : '确定要提交此销售订单吗？提交后将自动通过审核。',
      onOk: async () => {
        try {
          await submitSalesOrder(id);

          if (!currentAuditEnabled) {
            // 如果审核功能关闭，提交后直接调用审核通过接口
            try {
              await approveSalesOrder(id);
              messageApi.success('销售订单提交成功并已自动通过审核');
            } catch (approveError: any) {
              messageApi.warning('订单已提交，但自动审核失败: ' + (approveError.message || '未知错误'));
            }
          } else {
            messageApi.success('销售订单提交成功');
          }

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '提交失败');
        }
      },
    });
  };

  /**
   * 处理审核通过
   */
  const handleApprove = async (id: number) => {
    modalApi.confirm({
      title: '审核通过',
      content: '确定要审核通过此销售订单吗？',
      onOk: async () => {
        try {
          await approveSalesOrder(id);
          messageApi.success('销售订单审核通过');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '审核失败');
        }
      },
    });
  };

  /**
   * 处理撤销审核
   */
  const handleRevokeAudit = async (id: number) => {
    modalApi.confirm({
      title: '撤销审核',
      content: '确定要撤销此销售订单的审核吗？撤销后状态将回退到待审核。',
      onOk: async () => {
        try {
          await unapproveSalesOrder(id);
          messageApi.success('撤销审核成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '撤销审核失败');
        }
      },
    });
  };

  /**
   * 处理下推到需求计算
   */
  const handlePushToComputation = async (id: number) => {
    modalApi.confirm({
      title: '下推到需求计算',
      content: '确定要将此销售订单下推到需求计算吗？',
      onOk: async () => {
        try {
          await pushSalesOrderToComputation(id);
          messageApi.success('下推成功，已创建需求计算任务');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '下推失败');
        }
      },
    });
  };

  /**
   * 处理撤回需求计算
   * 仅当需求计算尚未下推工单/采购单等下游单据时允许撤回
   */
  const handleWithdrawFromComputation = async (id: number) => {
    modalApi.confirm({
      title: '撤回需求计算',
      content: '确定要撤回此销售订单的需求计算吗？撤回后仍为已审核状态，可重新下推。',
      onOk: async () => {
        try {
          await withdrawSalesOrderFromComputation(id);
          messageApi.success('撤回成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error?.response?.data?.detail || error.message || '撤回失败');
        }
      },
    });
  };



  /**
   * 处理批量导入
   */
  const handleImport = async (data: any[][]) => {
    if (!data || data.length === 0) {
      messageApi.warning('导入数据为空');
      return;
    }

    try {
      // 第一行是表头，从第二行开始是数据
      const headers = data[0];
      const rows = data.slice(1);

      // 字段映射（表头名称 -> 字段名）（订单名称已去掉，不填时后端以订单编码作为展示名）
      const fieldMap: Record<string, string> = {
        '订单日期': 'order_date',
        '交货日期': 'delivery_date',
        '客户ID': 'customer_id',
        '客户名称': 'customer_name',
        '客户联系人': 'customer_contact',
        '客户电话': 'customer_phone',
        '销售员ID': 'salesman_id',
        '销售员姓名': 'salesman_name',
        '收货地址': 'shipping_address',
        '发货方式': 'shipping_method',
        '付款条件': 'payment_terms',
        '备注': 'notes',
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
        messageApi.warning('没有有效的数据行');
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
            error: error.message || '创建失败',
          });
          console.error('创建销售订单失败:', error);
        }
      }

      if (failureCount === 0) {
        messageApi.success(`批量导入成功！成功导入 ${successCount} 条销售订单`);
        actionRef.current?.reload();
      } else {
        messageApi.warning(
          `批量导入完成，成功 ${successCount} 条，失败 ${failureCount} 条`
        );
        // 显示错误详情
        if (errors.length > 0) {
          const errorMessages = errors
            .slice(0, 10) // 只显示前10个错误
            .map(err => `第 ${err.row} 行: ${err.error}`)
            .join('\n');
          modalApi.error({
            title: '导入错误详情',
            content: <pre style={{ whiteSpace: 'pre-wrap' }}>{errorMessages}</pre>,
            width: 600,
          });
        }
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error.message || '批量导入失败');
    }
  };

  // 表格列（仅订单行，明细在展开行中显示）
  const columns: ProColumns<SalesOrder>[] = [
    { title: '订单编号', dataIndex: 'order_code', width: 150, fixed: 'left' as const, ellipsis: true },
    { title: '客户名称', dataIndex: 'customer_name', width: 150, ellipsis: true },
    { title: '订单日期', dataIndex: 'order_date', valueType: 'date', width: 120 },
    { title: '交货日期', dataIndex: 'delivery_date', valueType: 'date', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        [SalesOrderStatus.DRAFT]: { text: '草稿', status: 'Default' },
        '已提交': { text: '已提交', status: 'Processing' }, // TBD if this state exists in backend
        [SalesOrderStatus.AUDITED]: { text: '已审核', status: 'Success' },
        [SalesOrderStatus.CONFIRMED]: { text: '已生效', status: 'Success' },
        '已完成': { text: '已完成', status: 'Success' },
        '已取消': { text: '已取消', status: 'Error' },
      },
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      width: 100,
      valueEnum: {
        [ReviewStatus.PENDING]: { text: '待审核', status: 'Processing' },
        [ReviewStatus.APPROVED]: { text: '审核通过', status: 'Success' },
        [ReviewStatus.REJECTED]: { text: '审核驳回', status: 'Error' },
      },
    },
    {
      title: '操作',
      width: 200,
      fixed: 'right' as const,
      valueType: 'option',
      render: (_: any, record: SalesOrder) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail([record.id!])}>
            详情
          </Button>
          {record.status === SalesOrderStatus.DRAFT && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit([record.id!])}>
              编辑
            </Button>
          )}
          {record.status === SalesOrderStatus.DRAFT && (
            <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleSubmitDemand(record.id!)}>
              提交
            </Button>
          )}
          {record.status === SalesOrderStatus.DRAFT && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete([record.id!])}
            >
              删除
            </Button>
          )}
          {record.review_status === ReviewStatus.PENDING && (
            <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleApprove(record.id!)}>
              审核
            </Button>
          )}
          {(record.review_status === ReviewStatus.APPROVED) && !record.pushed_to_computation && (
            <Button type="link" size="small" icon={<ArrowDownOutlined />} onClick={() => handlePushToComputation(record.id!)}>
              下推
            </Button>
          )}
          {(record.status === '已审核' || record.status === SalesOrderStatus.AUDITED) && record.pushed_to_computation && (
            <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleWithdrawFromComputation(record.id!)}>
              撤回计算
            </Button>
          )}
          {(record.status === '已审核' || record.status === '已驳回') && (
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRevokeAudit(record.id!)}
            >
              撤销审核
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<SalesOrder>
          headerTitle="销售订单"
          actionRef={actionRef}
          columns={columns}
          request={async (params: any, sort: any, _filter: any, searchFormValues: any) => {
            const apiParams: any = {
              skip: ((params.current || 1) - 1) * (params.pageSize || 20),
              limit: params.pageSize || 20,
            };
            if (searchFormValues?.status) apiParams.status = searchFormValues.status;
            if (searchFormValues?.review_status) apiParams.review_status = searchFormValues.review_status;
            if (searchFormValues?.customer_name) apiParams.customer_name = searchFormValues.customer_name;
            if (sort) {
              const sortKeys = Object.keys(sort);
              if (sortKeys.length > 0) {
                const key = sortKeys[0];
                apiParams.order_by = sort[key] === 'ascend' ? key : `-${key}`;
              }
            }
            try {
              const response = await listSalesOrders(apiParams);
              if (Array.isArray(response)) {
                return { data: response, success: true, total: response.length };
              }
              return {
                data: (response as any).data || [],
                success: (response as any).success !== false,
                total: (response as any).total ?? 0,
              };
            } catch (error: any) {
              messageApi.error(error?.message || '获取列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="id"
          showAdvancedSearch={true}
          enableRowSelection={true}
          expandable={{
            expandedRowRender: (record) =>
              record.id != null ? <OrderItemsExpandedRow orderId={record.id} /> : null,
            rowExpandable: (record) => record.id != null,
          }}
          showCreateButton={true}
          onCreate={handleCreate}
          showEditButton={false}
          showDeleteButton={true}
          deleteButtonText="批量删除"
          onDelete={handleDelete}
          showImportButton={true}
          onImport={handleImport}
          importHeaders={[
            '订单日期',
            '交货日期',
            '客户ID',
            '客户名称',
            '客户联系人',
            '客户电话',
            '销售员ID',
            '销售员姓名',
            '收货地址',
            '发货方式',
            '付款条件',
            '备注',
          ]}
          importExampleRow={[
            '2026-01-01',
            '2026-01-31',
            '',
            '客户A',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '批量导入示例',
          ]}
        />
      </ListPageTemplate>

      {/* 新建/编辑 Modal */}
      <Modal
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setPreviewCode(null);
        }}
        title={isEdit ? '编辑销售订单' : '新建销售订单'}
        width={1200}
        footer={null}
        destroyOnHidden
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
                label="订单编码"
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
              <ProFormSelect
                name="customer_id"
                label="客户名称"
                rules={[{ required: true, message: '请选择客户' }]}
                placeholder="请选择客户"
                fieldProps={{
                  showSearch: true,
                  allowClear: true,
                  loading: customersLoading,
                  style: { width: '100%' },
                  options: customers.map((c) => ({
                    label: (c.code ? `${c.code} - ` : '') + c.name,
                    value: c.id,
                  })),
                  filterOption: (input: string, option?: { label?: string }) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase()),
                  onChange: (id: number | undefined) => {
                    const c = id ? customers.find((x) => x.id === id) : null;
                    formRef.current?.setFieldsValue({
                      customer_name: c?.name ?? undefined,
                      customer_contact: c?.contactPerson ?? undefined,
                      customer_phone: c?.phone ?? undefined,
                    });
                  },
                }}
              />
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
              <ProFormText
                name="salesman_name"
                label="销售员姓名"
                placeholder="请输入销售员姓名"
              />
            </Col>
            <Col span={12}>
              <ProFormText
                name="shipping_address"
                label="收货地址"
                placeholder="请输入收货地址"
              />
            </Col>
            <Col span={6}>
              <ProFormText
                name="shipping_method"
                label="发货方式"
                placeholder="请输入发货方式"
              />
            </Col>
            <Col span={6}>
              <ProFormText
                name="payment_terms"
                label="付款条件"
                placeholder="请输入付款条件"
              />
            </Col>
          </Row>

          {/* 订单明细：Form.List + Table footer，与 BOM 子物料列表结构一致；超出宽度时横向滚动 */}
          <ProForm.Item
            label="订单明细"
            required
            style={{ width: '100%', minWidth: 0 }}
          >
            <ProForm.Item name="items" noStyle rules={[{ type: 'array', min: 1, message: '请至少添加一条订单明细' }]}>
              <AntForm.List name="items">
                {(fields, { add, remove }) => {
                  const orderDetailColumns = [
                    {
                      title: '物料',
                      dataIndex: 'material_id',
                      width: 200,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_id']} rules={[{ required: true, message: '请选择物料' }]} style={{ margin: 0 }}>
                          <Select
                            placeholder="请选择物料"
                            showSearch
                            allowClear
                            size="small"
                            style={{ width: '100%' }}
                            loading={materialsLoading}
                            filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                            options={materials.map(m => ({ label: `${m.mainCode || m.code || ''} - ${m.name || ''}`, value: m.id }))}
                            onChange={(id) => handleMaterialSelectForForm(index, id as number)}
                          />
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
                      dataIndex: 'material_unit',
                      width: 80,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                          <Input placeholder="单位" size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '数量',
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
                      title: '单价',
                      dataIndex: 'unit_price',
                      width: 100,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                          <InputNumber placeholder="单价" min={0} precision={2} prefix="¥" style={{ width: '100%' }} size="small" />
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '金额',
                      width: 110,
                      align: 'right' as const,
                      render: (_: any, __: any, index: number) => (
                        <AntForm.Item noStyle shouldUpdate={(prev: any, curr: any) => prev?.items !== curr?.items}>
                          {({ getFieldValue }: any) => {
                            const items = getFieldValue('items') ?? [];
                            const row = items[index];
                            const amt = (Number(row?.required_quantity) || 0) * (Number(row?.unit_price) || 0);
                            return <AmountDisplay resource="sales_order" value={amt} />;
                          }}
                        </AntForm.Item>
                      ),
                    },
                    {
                      title: '交货日期',
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
                      render: (_: any, __: any, index: number) => (
                        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                          删除
                        </Button>
                      ),
                    },
                  ];
                  const totalWidth = orderDetailColumns.reduce((s, c) => s + (c.width as number || 0), 0);
                  return (
                    <div style={{ width: '100%', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                      <style>{`
                        .sales-order-detail-table .ant-table-thead > tr > th {
                          background-color: var(--ant-color-fill-alter) !important;
                          font-weight: 600;
                        }
                        .sales-order-detail-table .ant-table {
                          border-top: 1px solid var(--ant-color-border);
                        }
                        .sales-order-detail-table .ant-table-tbody > tr > td {
                          border-bottom: 1px solid var(--ant-color-border);
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
                          scroll={{ x: totalWidth }}
                          style={{ width: totalWidth, margin: 0 }}
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
                                  item_amount: 0,
                                });
                              }}
                              block
                            >
                              添加明细
                            </Button>
                          )}
                        />
                      </div>
                    </div>
                  );
                }}
              </AntForm.List>
            </ProForm.Item>
          </ProForm.Item>

          <ProFormTextArea
            name="notes"
            label="备注"
            placeholder="请输入备注"
          />
        </ProForm>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        title="销售订单详情"
        styles={{ wrapper: { width: 720 } }}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {currentSalesOrder && (
          <>
            <ProDescriptions<SalesOrder>
              dataSource={currentSalesOrder}
              column={2}
              columns={[
                {
                  title: '订单编号',
                  dataIndex: 'order_code',
                },
                {
                  title: '订单日期',
                  dataIndex: 'order_date',
                  valueType: 'date',
                },
                {
                  title: '交货日期',
                  dataIndex: 'delivery_date',
                  valueType: 'date',
                },
                {
                  title: '客户名称',
                  dataIndex: 'customer_name',
                },
                {
                  title: '客户联系人',
                  dataIndex: 'customer_contact',
                },
                {
                  title: '客户电话',
                  dataIndex: 'customer_phone',
                },
                {
                  title: '销售员姓名',
                  dataIndex: 'salesman_name',
                },
                {
                  title: '收货地址',
                  dataIndex: 'shipping_address',
                  span: 2,
                },
                {
                  title: '发货方式',
                  dataIndex: 'shipping_method',
                },
                {
                  title: '付款条件',
                  dataIndex: 'payment_terms',
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (_, record) => (
                    <Tag color={record.status === '已生效' ? 'success' : 'default'}>
                      {record.status}
                    </Tag>
                  ),
                },
                {
                  title: '审核状态',
                  dataIndex: 'review_status',
                  render: (_, record) => (
                    <Tag color={record.review_status === '审核通过' ? 'success' : 'default'}>
                      {record.review_status}
                    </Tag>
                  ),
                },
                {
                  title: '备注',
                  dataIndex: 'notes',
                  span: 2,
                },
              ]}
            />

            {/* 订单明细 */}
            {currentSalesOrder.items && currentSalesOrder.items.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h3>订单明细</h3>
                <Table<SalesOrderItem>
                  size="small"
                  columns={[
                    { title: '物料编码', dataIndex: 'material_code', width: 120 },
                    { title: '物料名称', dataIndex: 'material_name', width: 200 },
                    { title: '物料规格', dataIndex: 'material_spec', width: 120 },
                    { title: '单位', dataIndex: 'material_unit', width: 80 },
                    { title: '数量', dataIndex: 'required_quantity', width: 100, align: 'right' as const },
                    { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right' as const, render: (val) => <AmountDisplay resource="sales_order" value={val} /> },
                    { title: '金额', dataIndex: 'item_amount', width: 120, align: 'right' as const, render: (val) => <AmountDisplay resource="sales_order" value={val} /> },
                    { title: '交货日期', dataIndex: 'delivery_date', width: 120 },
                    { title: '已交货数量', dataIndex: 'delivered_quantity', width: 100, align: 'right' as const, render: (text) => text || 0 },
                    { title: '剩余数量', dataIndex: 'remaining_quantity', width: 100, align: 'right' as const, render: (text) => text || 0 },
                  ]}
                  dataSource={currentSalesOrder.items}
                  rowKey="id"
                  pagination={false}
                  bordered
                />
              </div>
            )}

            {/* 操作记录与上下游 */}
            {currentSalesOrder?.id && (
              <div style={{ marginTop: 24 }}>
                <DocumentTrackingPanel
                  documentType="sales_order"
                  documentId={currentSalesOrder.id}
                  onDocumentClick={(type, id) => messageApi.info(`跳转到${type}#${id}`)}
                />
              </div>
            )}

            {/* 单据关联 */}
            {documentRelations && (
              <div style={{ marginTop: 24 }}>
                <DocumentRelationDisplay relations={documentRelations} />
              </div>
            )}
          </>
        )}
      </Drawer>
    </>
  );
};

export default SalesOrdersPage;
