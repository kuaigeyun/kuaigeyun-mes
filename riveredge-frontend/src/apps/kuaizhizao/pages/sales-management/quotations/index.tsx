/**
 * 报价单管理页面
 *
 * 提供报价单的创建、查看、编辑、删除和转销售订单功能。
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, InputNumber, Input, Row, Col, DatePicker, Dropdown, List, Typography } from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, DeleteOutlined, SwapOutlined, PrinterOutlined, ImportOutlined, MoreOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { ProForm, ProFormText, ProFormDatePicker, ProFormTextArea } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniImport } from '../../../../../components/uni-import';
import { MaterialUnitSelect } from '../../../../../components/material-unit-select';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { MaterialBatchPickerModal } from '../../../../../components/material-batch-picker-modal';
import type { Material } from '../../../../master-data/types/material';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { customerApi } from '../../../../master-data/services/supply-chain';
import SyncFromDatasetModal from '../../../../../components/sync-from-dataset-modal';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DRAWER_CONFIG, FormModalTemplate } from '../../../../../components/layout-templates';
import { AmountDisplay } from '../../../../../components/permission';
import { DictionaryLabel } from '../../../../../components/dictionary-label';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToOrder,
  Quotation,
} from '../../../services/quotation';
import { getQuotationLifecycle } from '../../../utils/quotationLifecycle';
import { UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import DocumentTrackingPanel from '../../../../../components/document-tracking-panel';
import { apiRequest } from '../../../../../services/api';
import { getDataDictionaryByCode, getDictionaryItemList } from '../../../../../services/dataDictionary';
import dayjs from 'dayjs';
import { generateCode, testGenerateCode, getCodeRulePageConfig } from '../../../../../services/codeRule';
import { isAutoGenerateEnabled, getPageRuleCode } from '../../../../../utils/codeRulePage';
import { batchImport } from '../../../../../utils/batchOperations';
import { useTranslation } from 'react-i18next';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  草稿: { text: '草稿', color: 'default' },
  已发送: { text: '已发送', color: 'processing' },
  已接受: { text: '已接受', color: 'success' },
  已拒绝: { text: '已拒绝', color: 'error' },
  已转订单: { text: '已转订单', color: 'success' },
};

/** 与销售订单明细表同一套 Table + Form.List 用法；物料列样式见 .quotation-detail-table */
const QuotationMaterialSelectCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const mid =
    row?.material_id != null && row?.material_id !== ''
      ? Number(row.material_id)
      : null;
  const fallback =
    mid != null &&
    Number.isFinite(mid) &&
    (row?.material_code || row?.material_name)
      ? {
          value: mid,
          label: `${row.material_code || ''} - ${row.material_name || ''}`.trim() || String(mid),
        }
      : undefined;
  return (
    <div
      className="quotation-material-cell"
      style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <UniMaterialSelect
          name={[index, 'material_id']}
          label=""
          placeholder="请选择物料（支持名称/编号搜索）"
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
          formItemProps={{ style: { margin: 0 } }}
          showQuickCreate
          showAdvancedSearch
        />
      </div>
    </div>
  );
};

const QuotationAmountCell: React.FC<{ index: number }> = ({ index }) => {
  const row = Form.useWatch(['items', index]);
  const amt = (Number(row?.quote_quantity) || 0) * (Number(row?.unit_price) || 0);
  return <AmountDisplay resource="sales_order" value={amt} />;
};

const QuotationsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [quotationDetail, setQuotationDetail] = useState<Quotation | null>(null);
  const [syncModalVisible, setSyncModalVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [effectiveRuleCode, setEffectiveRuleCode] = useState<string | null>(null);
  const [effectiveAutoGen, setEffectiveAutoGen] = useState<boolean | null>(null);
  const formRef = useRef<any>(null);
  const [customerList, setCustomerList] = useState<any[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [userList, setUserList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [customerCreateVisible, setCustomerCreateVisible] = useState(false);
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  /** 发货方式字典选项（数据字典 SHIPPING_METHOD） */
  const [shippingMethodOptions, setShippingMethodOptions] = useState<Array<{ label: string; value: string }>>([]);
  /** 付款条件字典选项（数据字典 PAYMENT_TERMS） */
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    const load = async () => {
      setCustomersLoading(true);
      setUsersLoading(true);
      try {
        const [custRes, matRes, userRes] = await Promise.all([
          apiRequest<unknown>('/apps/master-data/supply-chain/customers', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/apps/master-data/materials', { params: { limit: 1000, is_active: true } }),
          apiRequest<unknown>('/core/users', { params: { limit: 1000, is_active: true } }),
        ]);
        const custList = Array.isArray(custRes) ? custRes : (custRes as any)?.data ?? (custRes as any)?.items ?? [];
        const matList = Array.isArray(matRes) ? matRes : (matRes as any)?.data ?? (matRes as any)?.items ?? [];
        const usrList = Array.isArray(userRes) ? userRes : (userRes as any)?.data ?? (userRes as any)?.items ?? [];
        setCustomerList(Array.isArray(custList) ? custList : []);
        setMaterialList(Array.isArray(matList) ? matList : []);
        setUserList(Array.isArray(usrList) ? usrList : []);
      } catch {
        setCustomerList([]);
        setMaterialList([]);
        setUserList([]);
      } finally {
        setCustomersLoading(false);
        setUsersLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadShippingMethod = async () => {
      try {
        const dict = await getDataDictionaryByCode('SHIPPING_METHOD');
        const items = await getDictionaryItemList(dict.uuid, true);
        setShippingMethodOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        setShippingMethodOptions([]);
      }
    };
    const loadPaymentTerms = async () => {
      try {
        const dict = await getDataDictionaryByCode('PAYMENT_TERMS');
        const items = await getDictionaryItemList(dict.uuid, true);
        setPaymentTermsOptions(
          items.sort((a, b) => a.sort_order - b.sort_order).map((it) => ({ label: it.label, value: it.value }))
        );
      } catch (e: any) {
        setPaymentTermsOptions([]);
      }
    };
    loadShippingMethod();
    loadPaymentTerms();
  }, []);

  const columns: ProColumns<Quotation>[] = [
    { title: '报价单编号', dataIndex: 'quotation_code', width: 150, ellipsis: true, fixed: 'left' },
    { title: '客户', dataIndex: 'customer_name', width: 140, ellipsis: true },
    {
      title: '报价日期',
      dataIndex: 'quotation_date',
      width: 110,
      valueType: 'date',
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      width: 110,
      align: 'right',
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 100,
      valueEnum: {
        草稿: { text: '草稿', status: 'Default' },
        已发送: { text: '已发送', status: 'Processing' },
        已接受: { text: '已接受', status: 'Success' },
        已拒绝: { text: '已拒绝', status: 'Error' },
        已转订单: { text: '已转订单', status: 'Success' },
      },
      render: (_, record) => {
        const lifecycle = getQuotationLifecycle(record);
        const stageName = lifecycle.stageName ?? record.status ?? '草稿';
        const c = STATUS_MAP[stageName] || { text: stageName || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '销售员', dataIndex: 'salesman_name', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const moreItems = [
          ...(record.status !== '已转订单' && record.status !== '已拒绝'
            ? [{ key: 'convert', label: '转订单', icon: <SwapOutlined />, onClick: () => handleConvert(record) }]
            : []),
          { key: 'print', label: '打印', icon: <PrinterOutlined />, onClick: () => handlePrint(record) },
        ]
        return (
          <Space>
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record.id!)}>详情</Button>
            {record.status === '草稿' && (
              <>
                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
                <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
              </>
            )}
            <Dropdown menu={{ items: moreItems }} trigger={['click']}>
              <Button type="link" size="small" icon={<MoreOutlined />}>更多</Button>
            </Dropdown>
          </Space>
        )
      },
    },
  ];

  const handleDetail = async (id: number) => {
    try {
      const res = await getQuotation(id);
      if (res) {
        setQuotationDetail(res);
        setDetailDrawerVisible(true);
      }
    } catch (e: any) {
      messageApi.error('获取报价单详情失败');
    }
  };

  const handleEdit = async (record: Quotation) => {
    try {
      const detail = await getQuotation(record.id!, true);
      setQuotationDetail(detail);
      setEditingId(record.id!);
      setModalVisible(true);
      // Modal 使用 destroyOnHidden：挂载前 setFieldsValue 会丢。弹窗打开后再写入。
      const editValues = {
        quotation_code: detail.quotation_code,
        quotation_date: detail.quotation_date ? dayjs(detail.quotation_date) : undefined,
        valid_until: detail.valid_until ? dayjs(detail.valid_until) : undefined,
        delivery_date: detail.delivery_date ? dayjs(detail.delivery_date) : undefined,
        customer_id: detail.customer_id,
        customer_name: detail.customer_name,
        customer_contact: detail.customer_contact,
        customer_phone: detail.customer_phone,
        salesman_id: detail.salesman_id,
        salesman_name: detail.salesman_name,
        shipping_address: detail.shipping_address,
        shipping_method: detail.shipping_method,
        payment_terms: detail.payment_terms,
        notes: detail.notes,
        items: (detail.items || []).map((it) => ({
          material_id: it.material_id!,
          material_code: it.material_code || '',
          material_name: it.material_name || '',
          material_spec: it.material_spec,
          material_unit: it.material_unit || '',
          quote_quantity: Number(it.quote_quantity) || 0,
          unit_price: Number(it.unit_price) || 0,
          delivery_date: it.delivery_date ? dayjs(it.delivery_date) : undefined,
          notes: it.notes,
        })),
      };
      setTimeout(() => {
        formRef.current?.setFieldsValue(editValues);
      }, 50);
    } catch {
      messageApi.error('获取报价单详情失败');
    }
  };

  const handleDelete = (record: Quotation) => {
    Modal.confirm({
      title: '删除报价单',
      content: `确定要删除报价单 "${record.quotation_code}" 吗？`,
      onOk: async () => {
        try {
          await deleteQuotation(record.id!);
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handleItemImport = (data: any[][]) => {
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

        const material = materialList.find((m: any) => (m.main_code ?? m.mainCode ?? m.code) === materialCode);
        
        return {
          material_id: material?.id ?? material?.material_id,
          material_code: material?.main_code ?? material?.mainCode ?? material?.code ?? materialCode,
          material_name: material?.name ?? material?.material_name ?? '',
          material_spec: material?.specification ?? material?.material_spec ?? spec,
          material_unit: material?.base_unit ?? material?.baseUnit ?? material?.material_unit ?? unit,
          quote_quantity: quantity,
          unit_price: price,
          delivery_date: deliveryDate ? (dayjs(deliveryDate).isValid() ? dayjs(deliveryDate) : undefined) : undefined,
        };
      })
      .filter((it): it is NonNullable<typeof it> => it !== null && (it.material_id !== undefined || it.material_code !== ''));

    if (newItems.length === 0) {
      messageApi.warning('未检测到有效数据（请确保物料编号不为空）');
      return;
    }

    const currentItems = formRef.current?.getFieldValue('items') || [];
    formRef.current?.setFieldsValue({
      items: [...currentItems, ...newItems],
    });
    messageApi.success(`成功导入 ${newItems.length} 条明细`);
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${keys.length} 条报价单吗？`,
      onOk: async () => {
        try {
          for (const k of keys) {
            await deleteQuotation(Number(k));
          }
          messageApi.success(`已删除 ${keys.length} 条报价单`);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '批量删除失败');
        }
      },
    });
  };

  const handleSyncConfirm = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const payload: Partial<Quotation> = {
          quotation_code: row.quotation_code || row.quotationCode,
          quotation_date: row.quotation_date || row.quotationDate,
          customer_name: row.customer_name || row.customerName,
          total_amount: row.total_amount ?? row.totalAmount,
          status: row.status || '草稿',
          items: Array.isArray(row.items) ? row.items : [],
        };
        await createQuotation(payload);
        successCount += 1;
      }
      messageApi.success(`已同步 ${successCount} 条报价单`);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '同步失败');
    }
  };

  /**
   * 处理列表页批量导入报价单
   * 导入格式：报价单编号, 客户名称, 报价日期, 物料编号, 数量, 单价, 交货日期, 备注
   * 同一报价单编号的多行会合并为一条报价单的多个明细
   */
  const handleListImport = async (data: any[][]) => {
    if (!data || data.length < 2) {
      messageApi.warning('导入数据为空或格式不正确');
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2).filter((row: any[]) => row?.some((c: any) => c != null && String(c).trim() !== ''));

    if (rows.length === 0) {
      messageApi.warning('没有可导入的数据行（请从第3行开始填写）');
      return;
    }

    const col = (name: string) => headers.findIndex((h: string) => (h || '').replace(/\*+/, '').trim() === name || (h || '').trim() === name);
    const idx = {
      code: col('报价单编号') >= 0 ? col('报价单编号') : col('编号'),
      customer: col('客户名称') >= 0 ? col('客户名称') : col('客户'),
      date: col('报价日期') >= 0 ? col('报价日期') : col('日期'),
      material: col('物料编号') >= 0 ? col('物料编号') : col('物料'),
      qty: col('数量') >= 0 ? col('数量') : -1,
      price: col('单价') >= 0 ? col('单价') : -1,
      delivery: col('交货日期') >= 0 ? col('交货日期') : -1,
      notes: col('备注') >= 0 ? col('备注') : -1,
    };

    if (idx.customer < 0 || idx.date < 0 || idx.material < 0 || idx.qty < 0) {
      messageApi.error('缺少必需列：客户名称、报价日期、物料编号、数量');
      return;
    }

    const errors: Array<{ row: number; message: string }> = [];
    const groupMap = new Map<string, { code?: string; customer: string; date: string; items: any[] }>();

    rows.forEach((row: any[], i: number) => {
      const rowNum = i + 3;
      const customerName = (row[idx.customer] ?? '').toString().trim();
      const dateVal = (row[idx.date] ?? '').toString().trim();
      const materialCode = (row[idx.material] ?? '').toString().trim();
      const qtyVal = row[idx.qty];
      const qty = Number(qtyVal);
      if (!customerName) {
        errors.push({ row: rowNum, message: '客户名称不能为空' });
        return;
      }
      if (!dateVal) {
        errors.push({ row: rowNum, message: '报价日期不能为空' });
        return;
      }
      if (!materialCode) {
        errors.push({ row: rowNum, message: '物料编号不能为空' });
        return;
      }
      if (isNaN(qty) || qty <= 0) {
        errors.push({ row: rowNum, message: '数量必须大于0' });
        return;
      }

      const mat = materialList.find((m: any) => (m.mainCode || m.code || '').toUpperCase() === materialCode.toUpperCase());
      if (!mat) {
        errors.push({ row: rowNum, message: `未找到物料：${materialCode}` });
        return;
      }

      const code = idx.code >= 0 ? (row[idx.code] ?? '').toString().trim() : '';
      const price = idx.price >= 0 ? (Number(row[idx.price]) || 0) : 0;
      const delivery = idx.delivery >= 0 ? (row[idx.delivery] ?? '').toString().trim() : undefined;
      const notes = idx.notes >= 0 ? (row[idx.notes] ?? '').toString().trim() : undefined;

      const groupKey = code || `${customerName}|${dateVal}`;
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { code: code || undefined, customer: customerName, date: dateVal, items: [] });
      }
      const g = groupMap.get(groupKey)!;
      g.items.push({
        material_id: mat.id,
        material_code: mat.mainCode || mat.code,
        material_name: mat.name,
        material_spec: mat.specification || '',
        material_unit: mat.baseUnit || '件',
        quote_quantity: qty,
        unit_price: price,
        delivery_date: delivery || undefined,
        notes: notes || undefined,
      });
    });

    if (errors.length > 0) {
      Modal.warning({
        title: '数据验证失败',
        width: 600,
        content: (
          <div>
            <p>以下行存在错误，请修正后重新导入：</p>
            <List
              size="small"
              dataSource={errors}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text type="danger">第 {item.row} 行：{item.message}</Typography.Text>
                </List.Item>
              )}
            />
          </div>
        ),
      });
      return;
    }

    const toImport: Partial<Quotation>[] = [];
    groupMap.forEach((g) => {
      const cust = customerList.find((c: any) => ((c.name || c.code || '').trim() === g.customer.trim()) || ((c.customer_name || '').trim() === g.customer.trim()));
      toImport.push({
        quotation_code: g.code,
        quotation_date: g.date,
        customer_id: cust?.id,
        customer_name: g.customer,
        status: '草稿',
        items: g.items,
      });
    });

    if (toImport.length === 0) {
      messageApi.warning('没有可导入的数据');
      return;
    }

    try {
      const result = await batchImport({
        items: toImport,
        importFn: async (item) => createQuotation(item),
        title: '正在导入报价单',
        concurrency: 3,
      });

      if (result.failureCount > 0) {
        Modal.warning({
          title: '导入完成（部分失败）',
          width: 600,
          content: (
            <div>
              <p><strong>导入结果：成功 {result.successCount} 条，失败 {result.failureCount} 条</strong></p>
              {result.errors.length > 0 && (
                <List
                  size="small"
                  dataSource={result.errors}
                  renderItem={(e) => (
                    <List.Item><Typography.Text type="danger">第 {e.row} 行：{e.error}</Typography.Text></List.Item>
                  )}
                />
              )}
            </div>
          ),
        });
      } else {
        messageApi.success(`成功导入 ${result.successCount} 条报价单`);
      }
      if (result.successCount > 0) {
        actionRef.current?.reload();
      }
    } catch (error: any) {
      messageApi.error(error?.message || '导入失败');
    }
  };

  const handleConvert = (record: Quotation) => {
    Modal.confirm({
      title: '转为销售订单',
      content: `确定要将报价单 "${record.quotation_code}" 转为销售订单吗？转换后将创建新的销售订单并建立关联。`,
      onOk: async () => {
        try {
          const res = await convertQuotationToOrder(record.id!);
          messageApi.success(`已转为销售订单：${res.sales_order?.order_code || ''}`);
          actionRef.current?.reload();
          setDetailDrawerVisible(false);
          setQuotationDetail(null);
        } catch (error: any) {
          messageApi.error(error.message || '转订单失败');
        }
      },
    });
  };

  const handlePrint = async (record: Quotation) => {
    try {
      const result = await apiRequest<{ content?: string }>(`/apps/kuaizhizao/quotations/${record.id}/print`, {
        method: 'GET',
        params: { response_format: 'html', output_format: 'html' },
      });
      const html = result?.content || '';
      if (html) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>报价单打印</title></head><body>${html}</body></html>`);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        } else {
          messageApi.warning('无法打开打印窗口，请检查浏览器弹窗设置');
        }
      } else {
        messageApi.warning('打印内容为空');
      }
    } catch (error: any) {
      messageApi.error(error.message || '打印失败');
    }
  };

  /**
   * 处理新建报价单
   * 参考销售订单：先打开弹窗，再请求 testGenerateCode 预填编号（不占用序号）
   */
  const defaultQuoteItem = { material_id: undefined, material_code: '', material_name: '', material_spec: '', material_unit: '件', quote_quantity: 1, unit_price: 0, delivery_date: undefined, notes: '' };

  const handleCreate = async () => {
    formRef.current?.resetFields();
    setEditingId(null);
    setPreviewCode(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    setModalVisible(true);
    setTimeout(() => {
      formRef.current?.setFieldsValue({ items: [defaultQuoteItem] });
    }, 100);
    try {
      const config = await getCodeRulePageConfig('kuaizhizao-quotation');
      const autoGen = config?.autoGenerate ?? isAutoGenerateEnabled('kuaizhizao-quotation');
      const ruleCode = config?.ruleCode ?? getPageRuleCode('kuaizhizao-quotation');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(autoGen);
      if (autoGen && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ quotation_code: preview ?? '' });
        } catch (e) {
          console.warn('报价单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    } catch {
      const ruleCode = getPageRuleCode('kuaizhizao-quotation');
      setEffectiveRuleCode(ruleCode ?? null);
      setEffectiveAutoGen(isAutoGenerateEnabled('kuaizhizao-quotation'));
      if (isAutoGenerateEnabled('kuaizhizao-quotation') && ruleCode) {
        try {
          const codeResponse = await testGenerateCode({ rule_code: ruleCode });
          const preview = codeResponse.code;
          setPreviewCode(preview ?? null);
          formRef.current?.setFieldsValue({ quotation_code: preview ?? '' });
        } catch (e) {
          console.warn('报价单编号预生成失败:', e);
          setPreviewCode(null);
        }
      } else {
        setPreviewCode(null);
      }
    }
  };

  const submitCreate = async (values: any) => {
    const validItems = (values.items || []).filter((it: any) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
      throw new Error('请至少添加一条有效明细');
    }
    let quotationCode = values.quotation_code;
    const submitRuleCode = effectiveRuleCode || getPageRuleCode('kuaizhizao-quotation');
    const submitAutoEnabled = effectiveAutoGen ?? isAutoGenerateEnabled('kuaizhizao-quotation');
    if (submitAutoEnabled && submitRuleCode && (quotationCode === previewCode || !quotationCode)) {
      try {
        const codeResponse = await generateCode({ rule_code: submitRuleCode });
        quotationCode = codeResponse.code;
      } catch (e) {
        console.warn('报价单编号正式生成失败，使用当前值:', e);
      }
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
    await createQuotation({
      quotation_code: quotationCode || undefined,
      quotation_date: values.quotation_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
      delivery_date: values.delivery_date?.format('YYYY-MM-DD'),
      customer_id: values.customer_id,
      customer_name: customerName,
      customer_contact: values.customer_contact,
      customer_phone: values.customer_phone,
      salesman_id: values.salesman_id,
      salesman_name: values.salesman_name,
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      notes: values.notes,
      items: validItems.map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: it.delivery_date ? (dayjs.isDayjs(it.delivery_date) ? it.delivery_date.format('YYYY-MM-DD') : it.delivery_date) : undefined,
        notes: it.notes,
      })),
    });
    messageApi.success('创建成功');
    setModalVisible(false);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    actionRef.current?.reload();
  };

  const submitEdit = async (values: any) => {
    if (!editingId) return;
    const validItems = (values.items || []).filter((it: any) => it.material_id && it.quote_quantity > 0);
    if (!validItems.length) {
      messageApi.error('请至少添加一条有效明细');
      throw new Error('请至少添加一条有效明细');
    }
    const cust = customerList.find((c: any) => (c.id ?? c.customer_id) === values.customer_id);
    const customerName = cust?.name ?? cust?.customer_name ?? values.customer_name ?? '';
    await updateQuotation(editingId, {
      quotation_date: values.quotation_date?.format('YYYY-MM-DD'),
      valid_until: values.valid_until?.format('YYYY-MM-DD'),
      delivery_date: values.delivery_date?.format('YYYY-MM-DD'),
      customer_id: values.customer_id,
      customer_name: customerName,
      customer_contact: values.customer_contact,
      customer_phone: values.customer_phone,
      salesman_id: values.salesman_id,
      salesman_name: values.salesman_name,
      shipping_address: values.shipping_address,
      shipping_method: values.shipping_method,
      payment_terms: values.payment_terms,
      notes: values.notes,
      items: validItems.map((it: any) => ({
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_spec: it.material_spec,
        material_unit: it.material_unit,
        quote_quantity: it.quote_quantity,
        unit_price: it.unit_price,
        delivery_date: it.delivery_date ? (dayjs.isDayjs(it.delivery_date) ? it.delivery_date.format('YYYY-MM-DD') : it.delivery_date) : undefined,
        notes: it.notes,
      })),
    });
    messageApi.success('更新成功');
    setModalVisible(false);
    setEditingId(null);
    setEffectiveRuleCode(null);
    setEffectiveAutoGen(null);
    actionRef.current?.reload();
  };

  const detailColumns: ProDescriptionsItemProps<Quotation>[] = [
    { title: '报价单编号', dataIndex: 'quotation_code' },
    { title: '客户', dataIndex: 'customer_name' },
    { title: '联系人', dataIndex: 'customer_contact' },
    { title: '电话', dataIndex: 'customer_phone' },
    { title: '报价日期', dataIndex: 'quotation_date' },
    { title: '有效期至', dataIndex: 'valid_until' },
    { title: '预计交货日期', dataIndex: 'delivery_date' },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      render: (_, r) => <AmountDisplay resource="sales_order" value={r.total_amount} />,
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const c = STATUS_MAP[(s as string) || ''] || { text: (s as string) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '销售员', dataIndex: 'salesman_name' },
    { title: '收货地址', dataIndex: 'shipping_address', span: 2 },
    {
      title: '发货方式',
      dataIndex: 'shipping_method',
      render: (_, record) => {
        const val = record.shipping_method;
        const opt = shippingMethodOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    {
      title: '付款条件',
      dataIndex: 'payment_terms',
      render: (_, record) => {
        const val = record.payment_terms;
        const opt = paymentTermsOptions.find((o) => o.value === val);
        return opt?.label ?? val ?? '-';
      },
    },
    { title: '关联销售订单', dataIndex: 'sales_order_code' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  const appendQuotationItemsFromMaterials = useCallback(
    (selected: Material[]) => {
      const mainDelivery = formRef.current?.getFieldValue('delivery_date');
      const defaultDelivery =
        mainDelivery != null ? (dayjs.isDayjs(mainDelivery) ? mainDelivery : dayjs(mainDelivery)) : dayjs();
      const current = formRef.current?.getFieldValue('items') ?? [];
      const newRows = selected.map((m) => ({
        material_id: m.id,
        material_code: m.mainCode ?? m.code ?? '',
        material_name: m.name ?? '',
        material_spec: m.specification ?? '',
        material_unit: m.baseUnit ?? '',
        quote_quantity: 1,
        unit_price: 0,
        delivery_date: defaultDelivery,
        notes: '',
      }));
      formRef.current?.setFieldsValue({ items: [...current, ...newRows] });
      messageApi.success(t('app.kuaizhizao.common.materialBatchAdded', { count: selected.length }));
    },
    [messageApi, t]
  );

  const formItemContent = (
    <>
      <Row gutter={16}>
        <Col span={12}>
          <ProFormText
            name="quotation_code"
            label="报价单编号"
            placeholder={isAutoGenerateEnabled('kuaizhizao-quotation') ? '编号将根据编号规则自动生成，可修改' : '请输入报价单编号'}
            fieldProps={{ disabled: !!editingId }}
            rules={[{ required: true, whitespace: true, message: '请输入报价单编号' }]}
          />
        </Col>
        <Col span={12}>
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
              options={customerList.map((c: any) => ({
                value: c.id ?? c.customer_id,
                label: `${c.code ?? c.customer_code ?? ''} - ${c.name ?? c.customer_name ?? ''}`.trim() || String(c.id ?? c.customer_id),
              }))}
              onChange={(value, _option: any) => {
                const c = customerList.find((x: any) => (x.id ?? x.customer_id) === value);
                if (c) {
                  const sId = c.salesmanId ?? c.salesman_id;
                  const salesman = userList.find((u) => u.id === sId);
                  const sName = c.salesmanName ?? c.salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
                  formRef.current?.setFieldsValue({
                    customer_name: c.name ?? c.customer_name,
                    customer_contact: c.contactPerson ?? c.contact_person ?? c.contact ?? c.customer_contact,
                    customer_phone: c.phone ?? c.customer_phone,
                    salesman_id: sId,
                    salesman_name: sName,
                  });
                }
              }}
              quickCreate={{
                label: '快速新建',
                onClick: () => setCustomerCreateVisible(true),
              }}
              advancedSearch={{
                label: '高级搜索',
                fields: [
                  { name: 'code', label: '客户编号' },
                  { name: 'name', label: '客户名称' },
                  { name: 'contactPerson', label: '联系人' },
                ],
                onSearch: async (values) => {
                  let list: any[] = [];
                  try {
                    const res = await customerApi.list({ limit: 200, skip: 0 });
                    list = Array.isArray(res) ? res : (res as any)?.data ?? (res as any)?.items ?? [];
                  } catch {
                    return [];
                  }
                  let filtered = list;
                  if (values.code?.trim()) {
                    const k = values.code.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.code ?? '').toLowerCase().includes(k));
                  }
                  if (values.name?.trim()) {
                    const k = values.name.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.name ?? '').toLowerCase().includes(k));
                  }
                  if (values.contactPerson?.trim()) {
                    const k = values.contactPerson.trim().toLowerCase();
                    filtered = filtered.filter((c: any) => (c.contactPerson ?? '').toLowerCase().includes(k));
                  }
                  return filtered.map((c: any) => ({
                    value: c.id ?? c.uuid,
                    label: `${c.code ?? ''} - ${c.name ?? ''}`.trim() || String(c.id ?? c.uuid),
                  }));
                },
              }}
            />
          </ProForm.Item>
        </Col>
      </Row>
      {/* 归属业务员 + 日期 + 发货方式：五列等分（各约 20%） */}
      <Row gutter={16}>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProForm.Item name="salesman_id" label="归属业务员">
            <UniDropdown
              placeholder="请选择归属业务员"
              showSearch
              allowClear
              loading={usersLoading}
              style={{ width: '100%' }}
              options={userList.map((u: any) => ({
                value: u.id,
                label: u.full_name || u.username,
              }))}
              onChange={(_val, opt: any) => {
                formRef.current?.setFieldsValue({ salesman_name: opt?.label });
              }}
            />
          </ProForm.Item>
          <Form.Item name="salesman_name" hidden>
            <Input />
          </Form.Item>
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="quotation_date"
            label="报价日期"
            rules={[{ required: true }]}
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="valid_until"
            label="有效期至"
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <ProFormDatePicker
            name="delivery_date"
            label="预计交货日期"
            fieldProps={{ style: { width: '100%' } }}
          />
        </Col>
        <Col flex={1} style={{ minWidth: 0 }}>
          <DictionarySelect
            dictionaryCode="SHIPPING_METHOD"
            name="shipping_method"
            label="发货方式"
            placeholder="请选择发货方式"
            formRef={formRef}
          />
        </Col>
      </Row>
      {/* 联系人 1/6 · 电话 1/6 · 地址 1/3 · 付款条件 1/6 · 币种 1/6 */}
      <Row gutter={16}>
        <Col span={4}>
          <ProFormText name="customer_contact" label="联系人" />
        </Col>
        <Col span={4}>
          <ProFormText name="customer_phone" label="联系人电话" />
        </Col>
        <Col span={8}>
          <ProFormText name="shipping_address" label="收货地址" placeholder="请输入收货地址" />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="PAYMENT_TERMS"
            name="payment_terms"
            label="付款条件"
            placeholder="请选择付款条件"
            formRef={formRef}
          />
        </Col>
        <Col span={4}>
          <DictionarySelect
            dictionaryCode="CURRENCY"
            name="currency_code"
            label="币种"
            placeholder="请选择币种"
            formRef={formRef}
            initialValue="CNY"
          />
        </Col>
      </Row>
      <ProFormText name="customer_name" hidden />

      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <span style={{ fontWeight: 600, color: 'rgba(0, 0, 0, 0.88)' }}>
            <span style={{ color: '#ff4d4f', marginRight: 4, fontFamily: 'SimSun, sans-serif' }}>*</span>
            物料明细
          </span>
          <Button size="small" type="link" icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
            导入明细
          </Button>
        </div>
        {/* 与销售订单一致：Form.Item(noStyle) + Form.List + Table；勿再套一层 ProForm.Item 同名 items */}
        <Form.Item
          name="items"
          noStyle
          rules={[{ type: 'array' as const, min: 1, message: '请至少添加一条明细' }]}
        >
          <Form.List name="items">
            {(fields, { add, remove }) => {
              const quotationDetailColumns = [
                {
                  title: '物料',
                  dataIndex: 'material_id',
                  width: 260,
                  render: (_: unknown, __: unknown, index: number) => (
                    <QuotationMaterialSelectCell index={index} />
                  ),
                },
                {
                  title: '规格',
                  dataIndex: 'material_spec',
                  width: 120,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'material_spec']} style={{ margin: 0 }}>
                      <Input placeholder="规格" size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '单位',
                  dataIndex: 'material_unit',
                  width: 100,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev: unknown, curr: unknown) =>
                        (prev as { items?: unknown[] })?.items?.[index]?.material_id !==
                        (curr as { items?: unknown[] })?.items?.[index]?.material_id
                      }
                    >
                      {({ getFieldValue }) => {
                        const materialId = getFieldValue(['items', index, 'material_id']);
                        return (
                          <Form.Item name={[index, 'material_unit']} style={{ margin: 0 }}>
                            <MaterialUnitSelect materialId={materialId} size="small" noStyle />
                          </Form.Item>
                        );
                      }}
                    </Form.Item>
                  ),
                },
                {
                  title: '数量',
                  dataIndex: 'quote_quantity',
                  width: 100,
                  align: 'right' as const,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item
                      name={[index, 'quote_quantity']}
                      rules={[{ required: true, message: '必填' }]}
                      style={{ margin: 0 }}
                    >
                      <InputNumber placeholder="数量" min={0.01} precision={2} style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '单价',
                  dataIndex: 'unit_price',
                  width: 100,
                  align: 'right' as const,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'unit_price']} style={{ margin: 0 }}>
                      <InputNumber placeholder="单价" min={0} precision={2} prefix="¥" style={{ width: '100%' }} size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '金额',
                  width: 120,
                  align: 'right' as const,
                  render: (_: unknown, __: unknown, index: number) => <QuotationAmountCell index={index} />,
                },
                {
                  title: '交货日期',
                  dataIndex: 'delivery_date',
                  width: 120,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'delivery_date']} style={{ margin: 0 }}>
                      <DatePicker size="small" style={{ width: '100%' }} format="YYYY-MM-DD" />
                    </Form.Item>
                  ),
                },
                {
                  title: '备注',
                  dataIndex: 'notes',
                  width: 120,
                  render: (_: unknown, __: unknown, index: number) => (
                    <Form.Item name={[index, 'notes']} style={{ margin: 0 }}>
                      <Input placeholder="备注" size="small" />
                    </Form.Item>
                  ),
                },
                {
                  title: '操作',
                  width: 70,
                  fixed: 'right' as const,
                  onHeaderCell: () => ({ className: 'quotation-fixed-op-header' }),
                  render: (_: unknown, __: unknown, index: number) => (
                    <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)}>
                      删除
                    </Button>
                  ),
                },
              ];
              const totalWidth = quotationDetailColumns.reduce((s, c) => s + (Number(c.width) || 0), 0);
              return (
                <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  <style>{`
                    .quotation-detail-table .ant-table-thead > tr > th {
                      background-color: var(--ant-color-fill-alter) !important;
                      font-weight: 600;
                    }
                    .quotation-detail-table .ant-table-thead > tr > th.quotation-fixed-op-header {
                      background: var(--ant-color-fill-alter) !important;
                    }
                    .quotation-detail-table .ant-table-cell-fix-right {
                      background: var(--ant-color-bg-container) !important;
                    }
                    .quotation-detail-table .ant-table {
                      border-top: 1px solid var(--ant-color-border);
                    }
                    .quotation-detail-table .ant-table-tbody > tr > td {
                      border-bottom: 1px solid var(--ant-color-border);
                      overflow: visible !important;
                    }
                    .quotation-detail-table .quotation-material-cell .ant-form-item,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control,
                    .quotation-detail-table .quotation-material-cell .ant-form-item-control-input,
                    .quotation-detail-table .quotation-material-cell .ant-select {
                      width: 100% !important;
                      min-width: 0;
                    }
                    .quotation-detail-table .ant-form-item-explain,
                    .quotation-detail-table .ant-form-item-explain-error {
                      display: none !important;
                    }
                    .quotation-detail-table .ant-input-number-input::selection,
                    .quotation-detail-table .ant-input::selection {
                      background-color: var(--ant-color-primary);
                      color: #fff;
                      border-radius: 0;
                    }
                  `}</style>
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <Table
                      className="quotation-detail-table"
                      size="small"
                      dataSource={fields.map((f, i) => ({ ...f, key: f.key ?? i }))}
                      rowKey="key"
                      pagination={false}
                      columns={quotationDetailColumns}
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
                            onClick={() => {
                              add({
                                material_id: undefined,
                                material_code: '',
                                material_name: '',
                                material_spec: '',
                                material_unit: '',
                                quote_quantity: 1,
                                unit_price: 0,
                                delivery_date: undefined,
                                notes: '',
                              });
                            }}
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
          </Form.List>
        </Form.Item>
      </div>
      <ProFormTextArea name="notes" label="备注" fieldProps={{ rows: 2 }} />
      <MaterialBatchPickerModal
        open={materialPickerOpen}
        onCancel={() => setMaterialPickerOpen(false)}
        onConfirm={appendQuotationItemsFromMaterials}
      />
    </>
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="报价单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          showCreateButton
          createButtonText="新建报价单"
          onCreate={handleCreate}
          enableRowSelection
          showDeleteButton
          onDelete={handleBatchDelete}
          showImportButton={true}
          onImport={handleListImport}
          importHeaders={['报价单编号', '客户名称', '报价日期', '物料编号', '数量', '单价', '交货日期', '备注']}
          importExampleRow={['QT001', '客户A', '2025-03-08', 'MAT001', '10', '100', '2025-04-01', '']}
          importFieldMap={{
            '报价单编号': 'quotation_code',
            '客户名称': 'customer_name',
            '报价日期': 'quotation_date',
            '物料编号': 'material_code',
            '数量': 'quote_quantity',
            '单价': 'unit_price',
            '交货日期': 'delivery_date',
            '备注': 'notes',
          }}
          importFieldRules={{
            customer_name: { required: true },
            quotation_date: { required: true },
            material_code: { required: true },
            quote_quantity: { required: true },
          }}
          showExportButton
          onExport={async (type, keys, pageData) => {
            try {
              const res = await listQuotations({ skip: 0, limit: 10000 });
              let items = res.data || [];
              if (type === 'currentPage' && pageData?.length) {
                items = pageData;
              } else if (type === 'selected' && keys?.length) {
                items = items.filter((d) => d.id != null && keys.includes(d.id));
              }
              if (items.length === 0) {
                messageApi.warning('暂无数据可导出');
                return;
              }
              const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `quotations-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              messageApi.success(`已导出 ${items.length} 条记录`);
            } catch (error: any) {
              messageApi.error(error?.message || '导出失败');
            }
          }}
          showSyncButton
          onSync={() => setSyncModalVisible(true)}
          request={async (params) => {
            try {
              const response = await listQuotations({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.lifecycle ?? params.status,
                salesman_id: params.salesman_id,
                start_date: params.start_date,
                end_date: params.end_date,
              });
              return {
                data: response.data || [],
                success: true,
                total: response.total ?? 0,
              };
            } catch {
              messageApi.error('获取报价单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1100 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`报价单详情${quotationDetail?.quotation_code ? ` - ${quotationDetail.quotation_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setQuotationDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={quotationDetail || {}}
        extra={
          quotationDetail?.status !== '已转订单' && quotationDetail?.status !== '已拒绝' && (
            <Button type="primary" icon={<SwapOutlined />} onClick={() => quotationDetail && handleConvert(quotationDetail)}>转为销售订单</Button>
          )
        }
      >
        {quotationDetail && (() => {
          const lifecycle = getQuotationLifecycle(quotationDetail);
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
        {quotationDetail?.items && quotationDetail.items.length > 0 && (
          <DetailDrawerSection title="报价明细">
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: '物料编号', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '规格', dataIndex: 'material_spec', width: 100 },
              { title: '单位', dataIndex: 'material_unit', width: 60, render: (v: string) => <DictionaryLabel dictionaryCode="MATERIAL_UNIT" value={v} /> },
              { title: '报价数量', dataIndex: 'quote_quantity', width: 100, align: 'right' },
              { title: '单价', dataIndex: 'unit_price', width: 100, align: 'right', render: (v: number) => <AmountDisplay resource="sales_order" value={v} /> },
              { title: '金额', dataIndex: 'total_amount', width: 100, align: 'right', render: (v: number) => <AmountDisplay resource="sales_order" value={v} /> },
              { title: '交货日期', dataIndex: 'delivery_date', width: 110 },
              { title: '备注', dataIndex: 'notes' },
            ]}
            dataSource={quotationDetail.items}
            pagination={false}
          />
          </DetailDrawerSection>
        )}
        {quotationDetail?.id && (
          <DetailDrawerSection title="操作历史">
            <DocumentTrackingPanel documentType="quotation" documentId={quotationDetail.id} />
          </DetailDrawerSection>
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title={editingId != null ? '编辑报价单' : '新建报价单'}
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditingId(null); setEffectiveRuleCode(null); setEffectiveAutoGen(null); }}
        onFinish={async (values) => {
          if (editingId != null) await submitEdit(values);
          else await submitCreate(values);
        }}
        isEdit={editingId != null}
        formRef={formRef}
        width={1200}
        layout="vertical"
        initialValues={editingId == null ? { quotation_date: dayjs() } : undefined}
        onValuesChange={(changed, _all) => {
          if ('customer_id' in changed && changed.customer_id != null) {
            const c = customerList.find((x: any) => (x.id ?? x.customer_id) === changed.customer_id);
            if (c) {
              const sId = c.salesmanId ?? c.salesman_id;
              const salesman = userList.find((u) => u.id === sId);
              const sName = c.salesmanName ?? c.salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
              formRef.current?.setFieldsValue({
                customer_name: c.name ?? c.customer_name,
                customer_contact: c.contactPerson ?? c.contact_person ?? c.contact ?? c.customer_contact,
                customer_phone: c.phone ?? c.customer_phone,
                salesman_id: sId,
                salesman_name: sName,
              });
            }
          }
        }}
      >
        {formItemContent}
      </FormModalTemplate>

      <CustomerFormModal
        open={customerCreateVisible}
        onClose={() => setCustomerCreateVisible(false)}
        editUuid={null}
        onSuccess={(customer) => {
          setCustomerList((prev) => [...prev, customer]);
          const sId = customer.salesmanId ?? (customer as any).salesman_id;
          const salesman = userList.find((u) => u.id === sId);
          const sName = customer.salesmanName ?? (customer as any).salesman_name ?? (salesman ? (salesman.full_name || salesman.username) : '');
          formRef.current?.setFieldsValue({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_contact: customer.contactPerson ?? (customer as any).contact_person,
            customer_phone: customer.phone ?? (customer as any).customer_phone,
            salesman_id: sId,
            salesman_name: sName,
          });
          setCustomerCreateVisible(false);
        }}
      />

      <SyncFromDatasetModal
        open={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        onConfirm={handleSyncConfirm}
        title="从数据集同步报价单"
      />

      <UniImport
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onConfirm={handleItemImport}
        title="导入报价明细"
        headers={['物料编号', '规格', '单位', '数量', '单价', '交货日期']}
        exampleRow={['MAT001', 'Spec X', 'PCS', '100', '1.5', '2026-03-01']}
      />
    </>
  );
};

export default QuotationsPage;
