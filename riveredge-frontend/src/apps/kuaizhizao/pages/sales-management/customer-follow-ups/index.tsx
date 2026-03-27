/**
 * 客户跟进（销售极简 CRM）
 *
 * 布局与「销售退货」等列表页一致：ListPageTemplate + UniTable
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Col, DatePicker, Form, Input, Modal, Row, Space, Switch, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { ListPageTemplate, FormModalTemplate } from '../../../../../components/layout-templates';
import { DictionarySelect } from '../../../../../components/dictionary-select';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import { useSubmitShortcut } from '../../../../../hooks/useSubmitShortcut';
import { SUBMIT_SHORTCUT_HINT } from '../../../../../utils/globalSubmitShortcut';

import { customerFollowUpApi, type CustomerFollowUp } from '../../../services/customer-follow-up';
import { listQuotations, type Quotation } from '../../../services/quotation';
import { listSalesOrders, type SalesOrder } from '../../../services/sales-order';
import { customerApi, getDictionaryOptions } from '../../../../master-data/services/supply-chain';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import type { Customer } from '../../../../master-data/types/supply-chain';
import { apiRequest } from '../../../../../services/api';

const DICT_CODE = 'SALES_FOLLOW_UP_TYPE';

const extractArrayFromResponse = (raw: any): any[] => {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.items)) return raw.items;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.data?.items)) return raw.data.items;
  if (Array.isArray(raw?.data?.data)) return raw.data.data;
  return [];
};

const getCustomerId = (c: any): number | null => {
  const id = Number(c?.id ?? c?.customer_id);
  return Number.isFinite(id) ? id : null;
};

const getCustomerName = (c: any): string => {
  const code = String(c?.code ?? c?.customer_code ?? '').trim();
  const name = String(c?.name ?? c?.customer_name ?? '').trim();
  return `${code} ${name}`.trim();
};

const CustomerFollowUpsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activityOptions, setActivityOptions] = useState<{ label: string; value: string }[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerFollowUp | null>(null);
  const [form] = Form.useForm();
  const modalCustomerId = Form.useWatch('customer_id', form);
  const [quotationList, setQuotationList] = useState<Quotation[]>([]);
  const [salesOrderList, setSalesOrderList] = useState<SalesOrder[]>([]);
  const [docListsLoading, setDocListsLoading] = useState(false);
  const [customerModalVisible, setCustomerModalVisible] = useState(false);
  const customerDropdownRef = useRef<any>(null);
  const contentInputRef = useRef<any>(null);
  const filtersRef = useRef({
    customer_id: undefined as number | undefined,
    pending_only: false,
  });

  const activityLabelMap = useMemo(() => {
    const m: Record<string, string> = {};
    activityOptions.forEach((o) => {
      m[o.value] = o.label;
    });
    return m;
  }, [activityOptions]);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    setDocListsLoading(true);
    (async () => {
      try {
        const [qRes, oRes] = await Promise.all([
          listQuotations({ limit: 500 }),
          listSalesOrders({ limit: 500 }),
        ]);
        if (cancelled) return;
        setQuotationList(Array.isArray(qRes.data) ? qRes.data : []);
        setSalesOrderList(Array.isArray(oRes.data) ? oRes.data : []);
      } catch {
        if (!cancelled) {
          setQuotationList([]);
          setSalesOrderList([]);
        }
      } finally {
        if (!cancelled) setDocListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  const quotationOptions = useMemo(() => {
    if (modalCustomerId == null) return [];
    return quotationList
      .filter((q) => q.id != null && q.customer_id === modalCustomerId)
      .map((q) => ({
        value: q.id as number,
        label: [q.quotation_code, q.customer_name].filter(Boolean).join(' · ') || `#${q.id}`,
      }));
  }, [quotationList, modalCustomerId]);

  const salesOrderOptions = useMemo(() => {
    if (modalCustomerId == null) return [];
    return salesOrderList
      .filter((o) => o.id != null && o.customer_id === modalCustomerId)
      .map((o) => ({
        value: o.id as number,
        label: [o.order_code, o.customer_name].filter(Boolean).join(' · ') || `#${o.id}`,
      }));
  }, [salesOrderList, modalCustomerId]);

  const quotationSelectOptions = useMemo(() => {
    if (
      editing?.quotation_id != null &&
      !quotationOptions.some((o) => o.value === editing.quotation_id)
    ) {
      return [
        ...quotationOptions,
        {
          value: editing.quotation_id,
          label: editing.quotation_code || `#${editing.quotation_id}`,
        },
      ];
    }
    return quotationOptions;
  }, [quotationOptions, editing]);

  const salesOrderSelectOptions = useMemo(() => {
    if (
      editing?.sales_order_id != null &&
      !salesOrderOptions.some((o) => o.value === editing.sales_order_id)
    ) {
      return [
        ...salesOrderOptions,
        {
          value: editing.sales_order_id,
          label: editing.sales_order_code || `#${editing.sales_order_id}`,
        },
      ];
    }
    return salesOrderOptions;
  }, [salesOrderOptions, editing]);

  const loadDictAndCustomers = async () => {
    const [custRes, custRes2, dictRes] = await Promise.allSettled([
      apiRequest<unknown>('/apps/master-data/supply-chain/customers', {
        params: { limit: 2000, is_active: true },
      }),
      customerApi.list({ limit: 2000, isActive: true } as any),
      getDictionaryOptions(DICT_CODE),
    ]);

    const primaryList = custRes.status === 'fulfilled' ? extractArrayFromResponse(custRes.value as any) : [];
    const fallbackList =
      custRes2.status === 'fulfilled' ? extractArrayFromResponse(custRes2.value as any) : [];
    const merged = [...primaryList, ...fallbackList];
    const uniq = new Map<number, any>();
    for (const c of merged) {
      const id = getCustomerId(c);
      if (id == null) continue;
      if (!uniq.has(id)) uniq.set(id, c);
    }
    setCustomers(Array.from(uniq.values()) as Customer[]);

    if (dictRes.status === 'fulfilled') {
      setActivityOptions(dictRes.value || []);
    } else {
      setActivityOptions([]);
    }
  };

  useEffect(() => {
    loadDictAndCustomers();
  }, []);

  const reloadTable = () => {
    actionRef.current?.reload();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      occurred_at: dayjs(),
    });
    setModalOpen(true);
  };

  const openEdit = (record: CustomerFollowUp) => {
    setEditing(record);
    form.setFieldsValue({
      customer_id: record.customer_id,
      activity_type_code: record.activity_type_code,
      content: record.content,
      occurred_at: record.occurred_at ? dayjs(record.occurred_at) : dayjs(),
      next_follow_up_at: record.next_follow_up_at ? dayjs(record.next_follow_up_at) : undefined,
      quotation_id: record.quotation_id ?? undefined,
      sales_order_id: record.sales_order_id ?? undefined,
    });
    setModalOpen(true);
    // 延时聚焦内容区域（如果是编辑，通常更关心跟进内容）
    setTimeout(() => {
      contentInputRef.current?.focus();
    }, 100);
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      const customerId = Number(v.customer_id);
      const customer = customers.find((c: any) => getCustomerId(c) === customerId);
      if (!customer) {
        message.error(t('app.kuaizhizao.customerFollowUp.customerRequired'));
        return;
      }
      const occurred = (v.occurred_at as dayjs.Dayjs).toISOString();
      const next =
        v.next_follow_up_at != null && v.next_follow_up_at !== ''
          ? (v.next_follow_up_at as dayjs.Dayjs).toISOString()
          : null;
      if (editing) {
        await customerFollowUpApi.update(editing.id, {
          customer_name: (customer as any).name ?? (customer as any).customer_name ?? '',
          activity_type_code: v.activity_type_code,
          content: v.content,
          occurred_at: occurred,
          next_follow_up_at: next,
          quotation_id: v.quotation_id ?? null,
          sales_order_id: v.sales_order_id ?? null,
        });
        message.success(t('pages.system.siteSettings.saveSuccess'));
      } else {
        await customerFollowUpApi.create({
          customer_id: customerId,
          activity_type_code: v.activity_type_code,
          content: v.content,
          occurred_at: occurred,
          next_follow_up_at: next,
          quotation_id: v.quotation_id ?? null,
          sales_order_id: v.sales_order_id ?? null,
        });
        message.success(t('common.createSuccess'));
      }
      setModalOpen(false);
      reloadTable();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || t('common.operationFailed'));
    }
  };

  const handleDelete = (record: CustomerFollowUp) => {
    Modal.confirm({
      title: t('app.kuaizhizao.customerFollowUp.deleteConfirm'),
      onOk: async () => {
        try {
          await customerFollowUpApi.delete(record.id);
          message.success(t('common.deleteSuccess'));
          reloadTable();
        } catch {
          message.error(t('common.deleteFailed'));
        }
      },
    });
  };

  useNewShortcut(openCreate);
  useSubmitShortcut(submit, modalOpen);

  const columns: ProColumns<CustomerFollowUp>[] = [
    {
      title: t('app.kuaizhizao.customerFollowUp.keywordPlaceholder'),
      dataIndex: 'keyword',
      hideInTable: true,
      valueType: 'text',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colCustomer'),
      dataIndex: 'customer_name',
      width: 160,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colActivityType'),
      dataIndex: 'activity_type_code',
      width: 120,
      hideInSearch: true,
      render: (_, row) => activityLabelMap[row.activity_type_code] || row.activity_type_code,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colContent'),
      dataIndex: 'content',
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colOccurredAt'),
      dataIndex: 'occurred_at',
      width: 170,
      hideInSearch: true,
      render: (_, row) =>
        row.occurred_at ? dayjs(row.occurred_at).format('YYYY-MM-DD HH:mm') : '',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colNextFollowUp'),
      dataIndex: 'next_follow_up_at',
      width: 170,
      hideInSearch: true,
      render: (_, row) =>
        row.next_follow_up_at ? dayjs(row.next_follow_up_at).format('YYYY-MM-DD HH:mm') : '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colQuotation'),
      dataIndex: 'quotation_code',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (v) => v || '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colSalesOrder'),
      dataIndex: 'sales_order_code',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (v) => v || '—',
    },
    {
      title: t('app.kuaizhizao.customerFollowUp.colCreator'),
      dataIndex: 'created_by_name',
      width: 100,
      ellipsis: true,
      hideInSearch: true,
    },
    {
      title: t('common.actions'),
      width: 140,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            {t('common.edit')}
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            {t('common.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<CustomerFollowUp>
          headerTitle={t('app.kuaizhizao.menu.sales-management.customer-follow-ups')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          options={{ reload: true, density: true, setting: true }}
          scroll={{ x: 1200 }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
          }}
          toolBarRender={() => [
            <Button key="new" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('app.kuaizhizao.customerFollowUp.new') + NEW_SHORTCUT_HINT}
            </Button>,
            <UniDropdown
              key="cust"
              allowClear
              showSearch
              placeholder={t('app.kuaizhizao.customerFollowUp.filterCustomer')}
              style={{ width: 200 }}
              options={customers
                .map((c: any) => {
                  const id = getCustomerId(c);
                  if (id == null) return null;
                  return { label: getCustomerName(c) || String(id), value: id };
                })
                .filter(Boolean) as Array<{ label: string; value: number }>}
              onChange={(v) => {
                filtersRef.current.customer_id = v != null ? Number(v) : undefined;
                reloadTable();
              }}
            />,
            <span key="pendingLabel">{t('app.kuaizhizao.customerFollowUp.pendingOnly')}</span>,
            <Switch
              key="pending"
              onChange={(v) => {
                filtersRef.current.pending_only = v;
                reloadTable();
              }}
            />,
          ]}
          request={async (params, _sort, _filter, searchFormValues) => {
            const f = filtersRef.current;
            const keyword =
              typeof searchFormValues?.keyword === 'string'
                ? searchFormValues.keyword.trim() || undefined
                : undefined;
            try {
              const res = await customerFollowUpApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword,
                customer_id: f.customer_id,
                pending_only: f.pending_only || undefined,
              });
              return {
                data: res.items || [],
                success: true,
                total: res.total ?? 0,
              };
            } catch {
              message.error(t('app.kuaizhizao.customerFollowUp.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editing ? t('app.kuaizhizao.customerFollowUp.editTitle') : t('app.kuaizhizao.customerFollowUp.createTitle')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onFinish={submit}
        formRef={form as any}
        width={960}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Card size="small" title={<Typography.Text strong>{t('pages.personal.profile.basicInfo')}</Typography.Text>}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="customer_id"
                  label={t('app.kuaizhizao.customerFollowUp.fieldCustomer')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <UniDropdown
                    ref={customerDropdownRef}
                    showSearch
                    optionFilterProp="label"
                    disabled={!!editing}
                    autoFocus={!editing}
                    quickCreate={{
                      label: t('app.kuaizhizao.customerFollowUp.quickAddCustomer') || '快速新增客户',
                      onClick: () => setCustomerModalVisible(true),
                    }}
                    options={customers
                      .map((c: any) => {
                        const id = getCustomerId(c);
                        if (id == null) return null;
                        return { label: getCustomerName(c) || String(id), value: id };
                      })
                      .filter(Boolean) as Array<{ label: string; value: number }>}
                    onChange={(value) => {
                      const customerId = value != null ? Number(value) : undefined;
                      form.setFieldsValue({ customer_id: customerId });
                      form.setFieldsValue({ quotation_id: undefined, sales_order_id: undefined });
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <DictionarySelect
                  dictionaryCode={DICT_CODE}
                  name="activity_type_code"
                  label={t('app.kuaizhizao.customerFollowUp.fieldActivityType')}
                  placeholder={t('app.kuaizhizao.customerFollowUp.activityTypePlaceholder')}
                  formRef={form as any}
                  required
                />
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="occurred_at"
                  label={t('app.kuaizhizao.customerFollowUp.fieldOccurredAt')}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="next_follow_up_at" label={t('app.kuaizhizao.customerFollowUp.fieldNextFollowUp')}>
                  <DatePicker 
                    showTime 
                    style={{ width: '100%' }} 
                    format="YYYY-MM-DD HH:mm"
                    renderExtraFooter={() => (
                      <Space style={{ padding: '8px 12px' }}>
                        <Button size="small" type="link" onClick={() => form.setFieldValue('next_follow_up_at', dayjs().add(1, 'day'))}>明天</Button>
                        <Button size="small" type="link" onClick={() => form.setFieldValue('next_follow_up_at', dayjs().add(3, 'day'))}>3天后</Button>
                        <Button size="small" type="link" onClick={() => form.setFieldValue('next_follow_up_at', dayjs().add(7, 'day'))}>1周后</Button>
                      </Space>
                    )}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title={<Typography.Text strong>关联单据</Typography.Text>}>
            <Row gutter={[16, 0]}>
              <Col xs={24} md={12}>
                <Form.Item name="quotation_id" label={t('app.kuaizhizao.customerFollowUp.fieldLinkedQuotation')}>
                  <UniDropdown
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={docListsLoading}
                    disabled={modalCustomerId == null}
                    placeholder={
                      modalCustomerId == null
                        ? t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
                        : t('app.kuaizhizao.customerFollowUp.optionalSelectDocument')
                    }
                    options={quotationSelectOptions}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="sales_order_id"
                  label={t('app.kuaizhizao.customerFollowUp.fieldLinkedSalesOrder')}
                >
                  <UniDropdown
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={docListsLoading}
                    disabled={modalCustomerId == null}
                    placeholder={
                      modalCustomerId == null
                        ? t('app.kuaizhizao.customerFollowUp.selectCustomerFirst')
                        : t('app.kuaizhizao.customerFollowUp.optionalSelectDocument')
                    }
                    options={salesOrderSelectOptions}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title={<Typography.Text strong>跟进记录</Typography.Text>}>
            <Form.Item
              name="content"
              rules={[{ required: true, message: t('common.required') }]}
              style={{ marginBottom: 0 }}
            >
              <Input.TextArea
                ref={contentInputRef}
                rows={8}
                showCount
                maxLength={2000}
                placeholder={t('app.kuaizhizao.customerFollowUp.fieldContent')}
                style={{ resize: 'vertical' }}
              />
            </Form.Item>
          </Card>
        </Space>
      </FormModalTemplate>

      <CustomerFormModal
        open={customerModalVisible}
        editUuid={null}
        onClose={() => setCustomerModalVisible(false)}
        onSuccess={(newCust) => {
          setCustomers(prev => [...prev, newCust]);
          form.setFieldValue('customer_id', newCust.id);
          setCustomerModalVisible(false);
          // 重新加载客户列表以防其他字段不一致
          loadDictAndCustomers();
        }}
      />
    </>
  );
};

export default CustomerFollowUpsPage;
