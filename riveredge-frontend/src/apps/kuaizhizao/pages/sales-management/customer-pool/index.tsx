import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Tag } from 'antd';
import {
  PlusOutlined,
  UserAddOutlined,
  UserSwitchOutlined,
  RollbackOutlined,
  SyncOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useCustomerPoolPermissions } from '../../../hooks/useCustomerPoolPermissions';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';

import { UniTable } from '../../../../../components/uni-table';
import { UniDetail } from '../../../../../components/uni-detail';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ThemedSegmented } from '../../../../../components/themed-segmented';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { rowActionKind } from '../../../../../components/uni-action';
import { customerApi, getUserOptions } from '../../../../master-data/services/supply-chain';
import { CustomerFormModal } from '../../../../master-data/components/CustomerFormModal';
import { CustomerDetailDrawer } from '../../../../master-data/components/CustomerDetailDrawer';
import { CustomerFollowUpFormModal } from '../../../components/CustomerFollowUpFormModal';
import { customerPoolApi, type CustomerPoolItem, type CustomerPoolRule } from '../../../services/customer-pool';
import { batchImport } from '../../../../../utils/batchOperations';
import { downloadFile } from '../../../../../utils';
import {
  buildFactoryImportTemplate,
  resolveFactoryImportHeaderIndexMap,
} from '../../../../master-data/utils/factoryImportTemplate';
import {
  buildPartnerEnterpriseTypeImportOptions,
  buildPartnerInvoiceTypeImportOptions,
  buildPartnerSettlementMethodImportOptions,
  buildPartnerTaxpayerTypeImportOptions,
  parsePartnerEnterpriseTypeImport,
  parsePartnerInvoiceTypeImport,
  parsePartnerSettlementMethodImport,
  parsePartnerTaxpayerTypeImport,
} from '../../../../master-data/utils/partner-static-labels';
import { IMPORT_YES_NO_OPTIONS } from '../../../../../utils/loadImportDictionaryValues';
import { useImportDictionaryOptions } from '../../../../../hooks/useImportDictionaryOptions';
import type { CustomerCreate } from '../../../../master-data/types/supply-chain';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../shared/documentFieldAlignment';
import {
  formatCustomerPoolDateTimeCell,
  resolveCustomerPoolListParams,
} from '../../../utils/customerPoolListCore';

const CustomerPoolPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const poolDictOptions = useImportDictionaryOptions([
    'INDUSTRY_SECTOR',
    'CUSTOMER_LEVEL',
    'PARTNER_SOURCE_CHANNEL',
    'CUSTOMER_CATEGORY',
    'CONTACT_TITLE',
  ]);
  const parsePoolDict = poolDictOptions.parseDict;
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionRef = useRef<ActionType>(null);
  const [scope, setScope] = useState<'pool' | 'mine' | 'all'>('mine');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const tableRowsRef = useRef<CustomerPoolItem[]>([]);
  const lastListParamsRef = useRef<Record<string, string | number | undefined>>({});
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const handleScopeChange = useCallback((next: 'pool' | 'mine' | 'all') => {
    if (next === scopeRef.current) return;
    scopeRef.current = next;
    setScope(next);
    actionRef.current?.reload();
  }, []);
  const {
    canClaim,
    canAssign,
    canRelease,
    canRecycle,
    canUpdateRules,
  } = useCustomerPoolPermissions();
  const { canCreate: canCreateCustomer, canUpdate: canUpdateCustomer, canDelete: canDeleteCustomer } =
    useResourcePermissions('master-data:supply-chain:customer');
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUuid, setDetailUuid] = useState<string | null>(null);
  const [followUpCustomerId, setFollowUpCustomerId] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTargets, setAssignTargets] = useState<CustomerPoolItem[]>([]);
  const [assignUsers, setAssignUsers] = useState<Array<{ label: string; value: string | number }>>([]);
  const [salesmanOptions, setSalesmanOptions] = useState<Array<{ label: string; value: string | number }>>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rules, setRules] = useState<CustomerPoolRule | null>(null);
  const [assignForm] = Form.useForm<{ salesman_id: number; reason?: string }>();
  const [rulesForm] = Form.useForm<CustomerPoolRule>();
  const customerImportTemplate = useMemo(
    () =>
      buildFactoryImportTemplate(
        t,
        [
          { field: 'code', required: true, labelKey: 'field.customer.code' },
          { field: 'name', required: true, labelKey: 'field.customer.name' },
          { field: 'shortName', labelKey: 'field.customer.shortName' },
          { field: 'category', labelKey: 'field.customer.category' , options: poolDictOptions.CUSTOMER_CATEGORY },
          { field: 'contactPerson', labelKey: 'field.customer.contactPerson' },
          { field: 'contactTitle', labelKey: 'field.customer.contactTitle' , options: poolDictOptions.CONTACT_TITLE },
          { field: 'phone', labelKey: 'field.customer.phone' },
          { field: 'email', labelKey: 'field.customer.email' },
          { field: 'isActive', labelKey: 'field.customer.isActive' , options: [...IMPORT_YES_NO_OPTIONS] },
          { field: 'taxRegistrationNo', labelKey: 'field.partner.taxRegistrationNo' },
          { field: 'invoiceTitle', labelKey: 'field.partner.invoiceTitle' },
          { field: 'invoiceAddress', labelKey: 'field.partner.invoiceAddress' },
          { field: 'invoicePhone', labelKey: 'field.partner.invoicePhone' },
          { field: 'invoiceBankName', labelKey: 'field.partner.invoiceBankName' },
          { field: 'invoiceBankAccount', labelKey: 'field.partner.invoiceBankAccount' },
          { field: 'invoiceTypeCode', labelKey: 'field.partner.invoiceType' , options: buildPartnerInvoiceTypeImportOptions(t) },
          { field: 'taxpayerTypeCode', labelKey: 'field.partner.taxpayerType' , options: buildPartnerTaxpayerTypeImportOptions(t) },
          { field: 'industryCode', labelKey: 'field.customer.industry' , options: poolDictOptions.INDUSTRY_SECTOR },
          { field: 'customerLevelCode', labelKey: 'field.customer.level' , options: poolDictOptions.CUSTOMER_LEVEL },
          { field: 'leadSourceCode', labelKey: 'field.customer.leadSource' , options: poolDictOptions.PARTNER_SOURCE_CHANNEL },
          { field: 'estimatedAnnualPurchase', labelKey: 'field.customer.estimatedAnnualPurchase' },
          { field: 'creditLimit', labelKey: 'field.customer.creditLimit' },
          { field: 'legalRepresentative', labelKey: 'field.partner.legalRepresentative' },
          { field: 'enterpriseTypeCode', labelKey: 'field.partner.enterpriseType' , options: buildPartnerEnterpriseTypeImportOptions(t) },
          { field: 'paymentTermsDays', labelKey: 'field.partner.paymentTermsDays' },
          { field: 'settlementMethodCode', labelKey: 'field.partner.settlementMethod' , options: buildPartnerSettlementMethodImportOptions(t) },
          { field: 'deliveryContactName', labelKey: 'field.partner.deliveryContactName' },
          { field: 'deliveryContactPhone', labelKey: 'field.partner.deliveryContactPhone' },
          { field: 'deliveryAddress', labelKey: 'field.partner.deliveryAddress' },
        ],
        [
          t('app.master-data.customers.importExample.code'),
          t('app.master-data.customers.importExample.name'),
          t('app.master-data.customers.importExample.shortName'),
          t('app.master-data.customers.importExample.category'),
          t('app.master-data.customers.importExample.contactPerson'),
          '',
          t('app.master-data.customers.importExample.phone'),
          t('app.master-data.customers.importExample.email'),
          '是',
          '', '', '', '', '', '', '', '',
          '', '', '', '', '', '', '', '', '', '', '', '',
        ],
      ),
    [t, i18n.language, poolDictOptions],
  );

  const loadRules = async () => {
    const data = await customerPoolApi.getRules();
    setRules(data);
    rulesForm.setFieldsValue(data);
  };

  const openRules = async () => {
    try {
      await loadRules();
      setRulesOpen(true);
    } catch {
      message.error(t('app.kuaizhizao.customerPool.loadRulesFailed'));
    }
  };

  const openAssignModal = async (rows: CustomerPoolItem[]) => {
    setAssignTargets(rows);
    setAssignOpen(true);
    assignForm.resetFields();
    try {
      const options = await getUserOptions();
      setAssignUsers(options || []);
    } catch {
      setAssignUsers([]);
    }
  };

  const openFollowUp = (customerId: number) => {
    setFollowUpCustomerId(customerId);
    setFollowUpOpen(true);
  };

  const openEditCustomer = (uuid: string) => {
    setEditUuid(uuid);
    setEditOpen(true);
  };

  const openCreateCustomer = useCallback(() => {
    setEditUuid(null);
    setEditOpen(true);
  }, []);

  useNewShortcut(canCreateCustomer ? openCreateCustomer : undefined);

  const openDetailCustomer = (uuid: string) => {
    setDetailUuid(uuid);
    setDetailOpen(true);
  };

  const toQuotation = (customerId: number) => {
    navigate(`/apps/kuaizhizao/sales-management/quotations/new?customerId=${customerId}`);
  };

  const confirmReleaseCustomer = useCallback(
    (row: CustomerPoolItem) => {
      modal.confirm({
        title: t('app.kuaizhizao.customerPool.confirmReleaseTitle'),
        content: t('app.kuaizhizao.customerPool.confirmReleaseContent', { name: row.name }),
        okText: t('app.kuaizhizao.customerPool.confirmReleaseOk'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          try {
            await customerPoolApi.release(row.id);
            message.success(t('app.kuaizhizao.customerPool.releasedSuccess'));
            actionRef.current?.reload();
          } catch (error: any) {
            message.error(error?.message || t('app.kuaizhizao.customerPool.releaseFailed'));
            throw error;
          }
        },
      });
    },
    [message, modal, t],
  );

  const claimCustomers = async (rows: CustomerPoolItem[]) => {
    if (!rows.length) {
      message.warning(t('app.kuaizhizao.customerPool.selectPublicPoolCustomers'));
      return;
    }
    try {
      const results = await Promise.allSettled(rows.map((row) => customerPoolApi.claim(row.id)));
      const success = results.filter((item) => item.status === 'fulfilled').length;
      const failed = rows.length - success;
      if (success > 0) {
        message.success(
          success === 1
            ? t('app.kuaizhizao.customerPool.claimSuccess')
            : t('app.kuaizhizao.customerPool.claimSuccessBatch', { count: success }),
        );
      }
      if (failed > 0) {
        message.warning(t('app.kuaizhizao.customerPool.claimPartialFailed', { count: failed }));
      }
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error?.message || t('app.kuaizhizao.customerPool.claimFailed'));
    }
  };

  useEffect(() => {
    const customerId = searchParams.get('customerId');
    if (!customerId) return;
    handleScopeChange('all');
    const next = new URLSearchParams(searchParams);
    next.delete('customerId');
    setSearchParams(next, { replace: true });
  }, [handleScopeChange, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const options = await getUserOptions();
        if (!cancelled) setSalesmanOptions(options || []);
      } catch {
        if (!cancelled) setSalesmanOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesmanValueEnum = useMemo(
    () =>
      Object.fromEntries(
        salesmanOptions.map((option) => [String(option.value), { text: option.label }]),
      ),
    [salesmanOptions],
  );

  const poolStatusValueEnum = useMemo(
    () => ({
      pool: { text: t('app.kuaizhizao.customerPool.scopePublic') },
      owned: { text: t('app.kuaizhizao.customerPool.scopePrivate') },
    }),
    [t],
  );

  const handleDeleteCustomer = useCallback(async (row: CustomerPoolItem) => {
    if (!row.uuid) {
      message.warning(t('app.kuaizhizao.customerPool.missingUuidForDelete'));
      return;
    }
    try {
      await customerApi.delete(row.uuid);
      message.success(t('common.deleteSuccess'));
      setSelectedRowKeys((prev) => prev.filter((key) => String(key) !== String(row.id)));
      actionRef.current?.reload();
    } catch (error: any) {
      message.error(error?.message || t('common.deleteFailed'));
    }
  }, [message, t]);

  const columns: ProColumns<CustomerPoolItem>[] = useMemo(
    () => alignProColumns<CustomerPoolItem>([
      {
        title: t('field.customer.code'),
        dataIndex: 'code',
        hideInTable: true,
        order: 10,
        fieldProps: { allowClear: true, placeholder: t('field.customer.code') },
      },
      {
        title: t('field.customer.name'),
        dataIndex: 'name',
        hideInTable: true,
        order: 11,
        fieldProps: { allowClear: true, placeholder: t('field.customer.name') },
      },
      {
        title: t('field.customer.nameCode'),
        dataIndex: 'code',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        minWidth: 260,
        sorter: true,
        defaultSortOrder: 'descend',
        hideInSearch: true,
        render: (_, row) => (
          <UniTableStackedPrimaryCell
            primary={String(row.name ?? '')}
            secondary={String(row.code ?? '')}
          />
        ),
      },
      {
        title: t('field.customer.contactPerson'),
        dataIndex: 'contact_person',
        hideInTable: true,
        order: 12,
        fieldProps: { allowClear: true, placeholder: t('field.customer.contactPerson') },
      },
      {
        title: t('field.customer.phone'),
        dataIndex: 'phone',
        hideInTable: true,
        order: 13,
        fieldProps: { allowClear: true, placeholder: t('field.customer.phone') },
      },
      {
        title: `${t('field.customer.contactPerson')} / ${t('field.customer.phone')}`,
        dataIndex: 'contact_person',
        ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
        minWidth: 190,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => (
          <UniTableStackedPrimaryCell
            primary={String(row.contact_person ?? '')}
            secondary={String(row.phone ?? '')}
          />
        ),
      },
      {
        title: t('field.customer.salesman'),
        dataIndex: 'salesman_name',
        width: 120,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => row.salesman_name || '—',
      },
      {
        title: t('field.customer.salesman'),
        dataIndex: 'salesmanId',
        hideInTable: true,
        order: 20,
        valueType: 'select',
        valueEnum: salesmanValueEnum,
        fieldProps: {
          options: salesmanOptions,
          showSearch: true,
          optionFilterProp: 'label',
          filterOption: (input: string, option?: { label?: React.ReactNode }) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase()),
          allowClear: true,
          placeholder: t('field.customer.salesmanPlaceholder'),
        },
      },
      {
        title: t('field.customer.poolStatus'),
        dataIndex: 'poolStatus',
        hideInTable: true,
        order: 21,
        valueType: 'select',
        valueEnum: poolStatusValueEnum,
        hideInSearch: scope !== 'all',
        fieldProps: { allowClear: true },
      },
      {
        title: t('field.customer.poolStatus'),
        dataIndex: 'pool_status',
        width: 100,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => (
          row.pool_status === 'pool' ? (
            <Tag color="blue">{t('app.kuaizhizao.customerPool.scopePublic')}</Tag>
          ) : (
            <Tag color="green">{t('app.kuaizhizao.customerPool.scopePrivate')}</Tag>
          )
        ),
      },
      {
        title: t('field.customer.lastFollowUpAt'),
        dataIndex: 'last_follow_up_at',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => formatCustomerPoolDateTimeCell(row.last_follow_up_at),
      },
      {
        title: t('field.customer.lastFollowUpAt'),
        dataIndex: 'last_follow_up_at_range',
        valueType: 'dateTimeRange',
        hideInTable: true,
        order: 30,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('field.customer.recycleAt'),
        dataIndex: 'recycle_at',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => formatCustomerPoolDateTimeCell(row.recycle_at),
      },
      {
        title: t('field.customer.recycleAt'),
        dataIndex: 'recycle_at_range',
        valueType: 'dateTimeRange',
        hideInTable: true,
        order: 31,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('field.customer.assignedAt'),
        dataIndex: 'assigned_at',
        width: 132,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => formatCustomerPoolDateTimeCell(row.assigned_at),
      },
      {
        title: t('field.customer.assignedAt'),
        dataIndex: 'assigned_at_range',
        valueType: 'dateTimeRange',
        hideInTable: true,
        order: 32,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 148,
        uniTableKeepWidth: true,
        sorter: true,
        hideInSearch: true,
        render: (_, row) => {
          const hasUpdatedAt = Boolean(row.updated_at);
          const operator = hasUpdatedAt ? String(row.updated_by_name ?? '-') : String(row.created_by_name ?? '-');
          const timestamp = hasUpdatedAt ? formatCustomerPoolDateTimeCell(row.updated_at) : formatCustomerPoolDateTimeCell(row.created_at);
          return (
            <UniTableStackedPrimaryCell
              primary={operator}
              secondary={timestamp}
              secondaryCopyable={false}
              primaryBold={false}
            />
          );
        },
      },
      {
        title: t('common.createdAt'),
        dataIndex: 'created_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 33,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        order: 34,
        fieldProps: {
          placeholder: [t('app.kuaizhizao.quotation.dateRangeStart'), t('app.kuaizhizao.quotation.dateRangeEnd')],
        },
        formItemProps: formDateRangeFormItemProps,
      },
      {
        title: t('common.actions'),
        dataIndex: 'option',
        fixed: 'right',
        minWidth: 260,
        hideInSearch: true,
        render: (_, row) => {
          const actions: React.ReactNode[] = [];
          if (row.uuid) {
            actions.push(
              <Button {...rowActionKind('read')}
                key="detail"
                type="link"
                size="small"
                onClick={() => openDetailCustomer(row.uuid)}
              >
                {t('common.detail')}
              </Button>
            );
            if (canUpdateCustomer) {
              actions.push(
                <Button {...rowActionKind('update')}
                  key="edit"
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEditCustomer(row.uuid)}
                >
                  {t('common.edit')}
                </Button>
              );
            }
            if (canDeleteCustomer) {
              actions.push(
                <Popconfirm
                  {...rowActionKind('delete')}
                  key="delete"
                  title={t('app.kuaizhizao.customerPool.confirmDeleteCustomer')}
                  description={t('app.kuaizhizao.customerPool.confirmDeleteCustomerDesc', {
                    name: row.name || row.code || t('app.kuaizhizao.customerPool.customerFallback'),
                  })}
                  onConfirm={() => handleDeleteCustomer(row)}
                >
                  <Button type="link" size="small" danger>
                    {t('common.delete')}
                  </Button>
                </Popconfirm>,
              );
            }
          }
          if (row.pool_status === 'pool') {
          } else {
            actions.push(
              <Button {...rowActionKind('create')} key="follow-up" onClick={() => openFollowUp(row.id)}>
                {t('app.kuaizhizao.customerPool.newFollowUp')}
              </Button>
            );
            actions.push(
              <Button {...rowActionKind('create')} key="quote" onClick={() => toQuotation(row.id)}>
                {t('app.kuaizhizao.customerPool.goToQuotation')}
              </Button>
            );
            if (canRelease) {
              actions.push(
                <Button {...rowActionKind('release')}
                  key="release"
                  type="link"
                  size="small"
                  icon={<RollbackOutlined />}
                  onClick={() => {
                    confirmReleaseCustomer(row);
                  }}
                >
                  {t('components.uniAction.release')}
                </Button>
              );
            }
            if (canRecycle) {
              actions.push(
                <Button {...rowActionKind('recycle')}
                  key="recycle"
                  type="link"
                  size="small"
                  icon={<SyncOutlined />}
                  onClick={async () => {
                    try {
                      await customerPoolApi.recycle(row.id);
                      message.success(t('app.kuaizhizao.customerPool.recycledSuccess'));
                      actionRef.current?.reload();
                    } catch (error: any) {
                      message.error(error?.message || t('app.kuaizhizao.customerPool.recycleFailed'));
                    }
                  }}
                >
                  {t('app.kuaizhizao.customerPool.forceRecycle')}
                </Button>
              );
            }
          }
          return actions;
        },
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [canAssign, canClaim, canDeleteCustomer, canRecycle, canRelease, canUpdateCustomer, confirmReleaseCustomer, handleDeleteCustomer, navigate, poolStatusValueEnum, salesmanOptions, salesmanValueEnum, scope, t],
  );

  const handleBatchDelete = useCallback(async (keys: React.Key[]) => {
    if (!keys || keys.length === 0) {
      message.warning(t('app.kuaizhizao.customerPool.selectCustomersToDelete'));
      return;
    }
    const rowMap = new Map(tableRowsRef.current.map((row) => [String(row.id), row]));
    let success = 0;
    let failed = 0;
    for (const key of keys) {
      const row = rowMap.get(String(key));
      if (!row?.uuid) {
        failed += 1;
        continue;
      }
      try {
        await customerApi.delete(row.uuid);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    if (success > 0) message.success(t('app.kuaizhizao.customerPool.batchDeleteSuccess', { count: success }));
    if (failed > 0) message.warning(t('app.kuaizhizao.customerPool.batchDeletePartialFailed', { count: failed }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, [message, t]);

  const selectedPoolRows = useMemo(() => {
    const selectedSet = new Set(selectedRowKeys.map((key) => String(key)));
    return tableRowsRef.current.filter((row) => selectedSet.has(String(row.id)) && row.pool_status === 'pool');
  }, [selectedRowKeys]);

  const handleImport = useCallback(async (data: any[][]) => {
    if (!data || data.length === 0) {
      message.warning(t('app.master-data.importEmpty'));
      return;
    }
    const headers = (data[0] || []).map((h: any) => String(h || '').trim());
    const rows = data.slice(2);
    const nonEmptyRows = rows.filter((row: any[]) =>
      Array.isArray(row) && row.some((cell: any) => String(cell ?? '').trim() !== ''),
    );
    if (nonEmptyRows.length === 0) {
      message.warning(t('app.master-data.importNoRows'));
      return;
    }

    const headerIndexMap = resolveFactoryImportHeaderIndexMap(
      headers,
      customerImportTemplate.importHeaderMap,
    );
    const codeIndex = headerIndexMap.code;
    const nameIndex = headerIndexMap.name;
    if (codeIndex === undefined || nameIndex === undefined) {
      message.error(t('app.master-data.importMissingRequiredHeaders'));
      return;
    }

    const cellAt = (row: any[], field: string): string => {
      const idx = headerIndexMap[field];
      if (idx === undefined) return '';
      return String(row[idx] ?? '').trim();
    };
    const parseNum = (raw: string): number | undefined => {
      if (!raw) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };
    const parseActive = (raw: string): boolean => {
      if (!raw) return true;
      const v = raw.toLowerCase();
      if (['0', 'false', 'no', 'n', '否', '停用', 'inactive'].includes(v)) return false;
      return true;
    };

    const importData: CustomerCreate[] = [];
    for (const row of nonEmptyRows) {
      const code = String(row[codeIndex] ?? '').trim();
      const name = String(row[nameIndex] ?? '').trim();
      if (!code || !name) continue;
      const contactPerson = cellAt(row, 'contactPerson') || undefined;
      const contactTitle = parsePoolDict('CONTACT_TITLE', cellAt(row, 'contactTitle')) || undefined;
      const phone = cellAt(row, 'phone') || undefined;
      const email = cellAt(row, 'email') || undefined;
      const contacts =
        contactPerson || contactTitle || phone || email
          ? [{ contactPerson, contactTitle, phone, email }]
          : undefined;
      importData.push({
        code: code.toUpperCase(),
        name,
        shortName: cellAt(row, 'shortName') || undefined,
        category: parsePoolDict('CUSTOMER_CATEGORY', cellAt(row, 'category')),
        contacts,
        isActive: parseActive(cellAt(row, 'isActive')),
        taxRegistrationNo: cellAt(row, 'taxRegistrationNo') || undefined,
        invoiceTitle: cellAt(row, 'invoiceTitle') || undefined,
        invoiceAddress: cellAt(row, 'invoiceAddress') || undefined,
        invoicePhone: cellAt(row, 'invoicePhone') || undefined,
        invoiceBankName: cellAt(row, 'invoiceBankName') || undefined,
        invoiceBankAccount: cellAt(row, 'invoiceBankAccount') || undefined,
        invoiceTypeCode: parsePartnerInvoiceTypeImport(cellAt(row, 'invoiceTypeCode'), t),
        taxpayerTypeCode: parsePartnerTaxpayerTypeImport(cellAt(row, 'taxpayerTypeCode'), t),
        industryCode: parsePoolDict('INDUSTRY_SECTOR', cellAt(row, 'industryCode')),
        customerLevelCode: parsePoolDict('CUSTOMER_LEVEL', cellAt(row, 'customerLevelCode')),
        leadSourceCode: parsePoolDict('PARTNER_SOURCE_CHANNEL', cellAt(row, 'leadSourceCode')),
        estimatedAnnualPurchase: parseNum(cellAt(row, 'estimatedAnnualPurchase')),
        creditLimit: parseNum(cellAt(row, 'creditLimit')),
        legalRepresentative: cellAt(row, 'legalRepresentative') || undefined,
        enterpriseTypeCode: parsePartnerEnterpriseTypeImport(cellAt(row, 'enterpriseTypeCode'), t),
        paymentTermsDays: parseNum(cellAt(row, 'paymentTermsDays')),
        settlementMethodCode: parsePartnerSettlementMethodImport(cellAt(row, 'settlementMethodCode'), t),
        deliveryContactName: cellAt(row, 'deliveryContactName') || undefined,
        deliveryContactPhone: cellAt(row, 'deliveryContactPhone') || undefined,
        deliveryAddress: cellAt(row, 'deliveryAddress') || undefined,
      });
    }

    if (importData.length === 0) {
      message.warning(t('app.master-data.importNoRows'));
      return;
    }

    const result = await batchImport({
      items: importData,
      importFn: async (item: CustomerCreate) => customerApi.create(item),
      title: t('app.master-data.customers.importTitle'),
      concurrency: 5,
    });
    if (result.successCount > 0) {
      message.success(t('common.importSuccess', { count: result.successCount }));
      actionRef.current?.reload();
    }
    if (result.failureCount > 0) {
      message.warning(t('common.importPartialSuccess', { success: result.successCount, failed: result.failureCount }));
    }
  }, [customerImportTemplate.importHeaderMap, message, t]);

  const handleExport = useCallback(async (
    type: 'selected' | 'currentPage' | 'all',
    selectedKeys?: React.Key[],
    currentPageData?: CustomerPoolItem[],
  ) => {
    let exportData: CustomerPoolItem[] = [];
    if (type === 'selected' && selectedKeys?.length) {
      const selectedSet = new Set(selectedKeys.map((key) => String(key)));
      exportData = (currentPageData || []).filter((item) => selectedSet.has(String(item.id)));
    } else if (type === 'currentPage') {
      exportData = currentPageData || [];
    } else {
      const rows: CustomerPoolItem[] = [];
      const pageSize = 200;
      let skip = 0;
      let total = 0;
      do {
        const res = await customerPoolApi.list({
          scope: scopeRef.current,
          skip,
          limit: pageSize,
          ...lastListParamsRef.current,
        });
        rows.push(...(res.items || []));
        total = res.total || 0;
        skip += pageSize;
      } while (skip < total);
      exportData = rows;
    }

    if (exportData.length === 0) {
      message.warning(t('app.master-data.noExportData'));
      return;
    }

    const headers = [
      t('field.customer.code'),
      t('field.customer.name'),
      t('field.customer.contactPerson'),
      t('field.customer.phone'),
      t('field.customer.salesman'),
      t('field.customer.poolStatus'),
      t('field.customer.lastFollowUpAt'),
      t('field.customer.recycleAt'),
    ];
    const csvRows = [headers.join(',')];
    for (const row of exportData) {
      const status = row.pool_status === 'pool' ? t('app.kuaizhizao.customerPool.scopePublic') : t('app.kuaizhizao.customerPool.scopePrivate');
      const cells = [
        row.code ?? '',
        row.name ?? '',
        row.contact_person ?? '',
        row.phone ?? '',
        row.salesman_name ?? '',
        status,
        row.last_follow_up_at ? formatDateTime(row.last_follow_up_at, 'YYYY-MM-DD HH:mm:ss') : '',
        row.recycle_at ? formatDateTime(row.recycle_at, 'YYYY-MM-DD HH:mm:ss') : '',
      ];
      csvRows.push(cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob(['\ufeff' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, t('app.kuaizhizao.customerPool.exportFileName', { date: formatDateTime(new Date(), 'YYYY-MM-DD') }));
    message.success(t('common.exportSuccess', { count: exportData.length }));
  }, [message, t]);

  return (
    <>
      <ListPageTemplate style={{ padding: 0 }}>
        <UniTable<CustomerPoolItem>
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          columns={columns}
          headerTitle={t('app.kuaizhizao.menu.sales-management.customer-pool')}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          columnPersistenceId="apps.kuaizhizao.pages.sales-management.customer-pool"
          tanstackQuery={{ queryKeyPrefix: ['apps.kuaizhizao.pages.sales-management.customer-pool', scope] }}
          onTableDataChange={(data) => {
            tableRowsRef.current = data || [];
          }}
          beforeSearchButtons={
            <ThemedSegmented
              surfaceBackground
              value={scope}
              onChange={(v) => handleScopeChange(v as 'pool' | 'mine' | 'all')}
              options={[
                { label: t('app.kuaizhizao.customerPool.scopePrivate'), value: 'mine' },
                { label: t('app.kuaizhizao.customerPool.scopePublic'), value: 'pool' },
                { label: t('app.kuaizhizao.customerPool.scopeAll'), value: 'all' },
              ]}
            />
          }
          showCreateButton={canCreateCustomer}
          createButtonText={t('app.master-data.customers.create')}
          onCreate={openCreateCustomer}
          showImportButton
          onImport={handleImport}
          importHeaders={customerImportTemplate.importHeaders}
          importExampleRow={customerImportTemplate.importExampleRow}
          importColumnOptions={customerImportTemplate.importColumnOptions}
          importFieldMap={customerImportTemplate.importHeaderMap}
          showExportButton
          onExport={handleExport}
          request={async (params, sort, _filter, searchValues) => {
            try {
              const listParams = resolveCustomerPoolListParams(searchValues, sort);
              lastListParamsRef.current = listParams;
              const res = await customerPoolApi.list({
                scope: scopeRef.current,
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                ...listParams,
              });
              return { data: res.items || [], total: res.total || 0, success: true };
            } catch {
              message.error(t('app.kuaizhizao.customerPool.loadFailed'));
              tableRowsRef.current = [];
              return { data: [], total: 0, success: false };
            }
          }}
          showDeleteButton={canDeleteCustomer}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.customerPool.confirmBatchDeleteCustomers', { count })}
          toolBarActionsAfterDelete={[
            ...(canClaim
              ? [
                  <Button
                    {...rowActionKind('claim')}
                    key="claim"
                    disabled={selectedPoolRows.length === 0}
                    onClick={() => {
                      if (selectedPoolRows.length === 0) {
                        message.warning(t('app.kuaizhizao.customerPool.publicPoolClaimOnly'));
                        return;
                      }
                      void claimCustomers(selectedPoolRows);
                    }}
                  >
                    {selectedPoolRows.length > 1
                      ? t('app.kuaizhizao.customerPool.batchClaim')
                      : t('app.kuaizhizao.customerPool.claim')}
                  </Button>,
                ]
              : []),
            ...(canAssign
              ? [
                  <Button
                    {...rowActionKind('assign')}
                    key="assign"
                    disabled={selectedPoolRows.length === 0}
                    onClick={async () => {
                      if (selectedPoolRows.length === 0) {
                        message.warning(t('app.kuaizhizao.customerPool.publicPoolAssignOnly'));
                        return;
                      }
                      await openAssignModal(selectedPoolRows);
                    }}
                  >
                    {selectedPoolRows.length > 1
                      ? t('app.kuaizhizao.customerPool.batchAssign')
                      : t('app.kuaizhizao.customerPool.assign')}
                  </Button>,
                ]
              : []),
          ]}
          toolBarActionsAfterBatch={
            canUpdateRules
              ? [
                  <Button {...rowActionKind('update')} key="rules" onClick={openRules}>
                    {t('app.kuaizhizao.customerPool.recycleRules')}
                  </Button>,
                ]
              : undefined
          }
        />
      </ListPageTemplate>

      <Modal
        title={
          assignTargets.length > 1
            ? t('app.kuaizhizao.customerPool.batchAssignTitle')
            : t('app.kuaizhizao.customerPool.assignTitle')
        }
        open={assignOpen}
        onCancel={() => {
          setAssignOpen(false);
          setAssignTargets([]);
        }}
        onOk={async () => {
          try {
            const values = await assignForm.validateFields();
            if (!assignTargets.length) return;
            const results = await Promise.allSettled(
              assignTargets.map((target) =>
                customerPoolApi.assign(target.id, values.salesman_id, values.reason),
              ),
            );
            const success = results.filter((item) => item.status === 'fulfilled').length;
            const failed = assignTargets.length - success;
            if (success > 0) {
              message.success(
                success === 1
                  ? t('common.assignSuccess')
                  : t('app.kuaizhizao.customerPool.assignSuccessBatch', { count: success }),
              );
            }
            if (failed > 0) {
              message.warning(t('app.kuaizhizao.customerPool.assignPartialFailed', { count: failed }));
            }
            setAssignOpen(false);
            setAssignTargets([]);
            setSelectedRowKeys([]);
            actionRef.current?.reload();
          } catch (error: any) {
            if (!error?.errorFields) message.error(error?.message || t('app.kuaizhizao.customerPool.assignFailed'));
          }
        }}
      >
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="salesman_id"
            label={t('app.kuaizhizao.customerPool.assignToSalesman')}
            rules={[{ required: true, message: t('common.selectField', { field: t('field.customer.salesman') }) }]}
          >
            <Select showSearch options={assignUsers} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="reason" label={t('app.kuaizhizao.customerPool.assignReason')}>
            <Input placeholder={t('app.kuaizhizao.customerPool.assignReasonPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <UniDetail
        title={t('app.kuaizhizao.customerPool.rulesTitle')}
        open={rulesOpen}
        width={420}
        onClose={() => setRulesOpen(false)}
        extra={
          <Button
            type="primary"
            loading={rulesSaving}
            onClick={async () => {
              try {
                const values = await rulesForm.validateFields();
                setRulesSaving(true);
                const saved = await customerPoolApi.updateRules(values);
                setRules(saved);
                message.success(t('app.kuaizhizao.customerPool.rulesSaved'));
                setRulesOpen(false);
              } catch (error: any) {
                if (!error?.errorFields) message.error(error?.message || t('app.kuaizhizao.customerPool.rulesSaveFailed'));
              } finally {
                setRulesSaving(false);
              }
            }}
          >
            {t('common.save')}
          </Button>
        }
        basic={
          <Form form={rulesForm} layout="vertical" initialValues={rules || undefined}>
            <Form.Item name="recycle_enabled" label={t('app.kuaizhizao.customerPool.autoRecycleEnabled')} valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              name="recycle_after_days"
              label={t('app.kuaizhizao.customerPool.recycleAfterDays')}
              rules={[{ required: true, message: t('app.kuaizhizao.customerPool.recycleAfterDaysRequired') }]}
            >
              <InputNumber min={1} max={365} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="max_owned_customers"
              label={t('app.kuaizhizao.customerPool.maxOwnedCustomers')}
              rules={[{ required: true, message: t('app.kuaizhizao.customerPool.maxOwnedCustomersRequired') }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="allow_claim_others" label={t('app.kuaizhizao.customerPool.allowClaimOthers')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        }
        basicTitle={t('app.kuaizhizao.customerPool.rulesSectionTitle')}
      >
      </UniDetail>

      <CustomerFollowUpFormModal
        open={followUpOpen}
        editing={null}
        preset={followUpCustomerId ? { customer_id: followUpCustomerId } : null}
        onClose={() => {
          setFollowUpOpen(false);
          setFollowUpCustomerId(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      <CustomerFormModal
        open={editOpen}
        editUuid={editUuid}
        onClose={() => {
          setEditOpen(false);
          setEditUuid(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      <CustomerDetailDrawer
        open={detailOpen}
        customerUuid={detailUuid}
        onClose={() => {
          setDetailOpen(false);
          setDetailUuid(null);
        }}
      />
    </>
  );
};

export default CustomerPoolPage;

