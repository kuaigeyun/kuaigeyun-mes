import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormDatePicker,
  ProFormDependency,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Form, Input, InputNumber, Row, Select, Table, theme } from 'antd';
import { useLinkedDocumentDetail } from '../../../../../components/linked-document-detail';
import type { FormListFieldData } from 'antd/es/form/FormList';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { MODAL_NESTED_ABOVE_PARENT_OFFSET } from '../../../../../components/layout-templates/constants';
import { UniDropdown, QuickCreateModal } from '../../../../../components/uni-dropdown';
import { UniTable } from '../../../../../components/uni-table';
import { UniTableDetail } from '../../../../../components/uni-table-detail';
import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { UniAuditBatchMenuButton } from '../../../../../components/uni-batch';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useAuditRequired } from '../../../../../hooks/useAuditRequired';
import { formatCurrencyAmount } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { coerceFormDate, toApiDateString } from '../../../../../utils/formDate';
import { normalizeFormListItems } from '../../../../../utils/formListItems';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { pickSearchString } from '../../../../../utils/tableQueryKey';
import {
  assertBankAccountForPaymentMethod,
  BANK_TRANSFER_PAYMENT_METHOD,
  buildMiscVoucherStatusEnum,
  formatBankAccountOptionLabel,
  getPaymentMethodOptions,
} from '../../../utils/financeSharedOptions';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { bankAccountService, type BankAccount } from '../../../services/finance/bank-account';
import {
  financeMiscCategoryService,
  type MiscCategory,
  type MiscCategoryKind,
} from '../../../services/finance/finance-misc-category';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  FINANCE_DOC_PINNED_STATUS_FIELD,
  financeDocCodePartnerSearchColumns,
} from '../../../utils/financeListCore';
import {
  loadCustomerFormReferenceList,
  loadSupplierFormReferenceList,
  loadUserFormReferenceOptions,
  type DocumentFormSelectOption,
} from '../../../../../utils/documentFormReferenceLoad';

type VoucherKind = 'income' | 'expense';
type AuditEntityType = 'other_income' | 'other_expense';

type VoucherRow = {
  id: number;
  income_code?: string;
  expense_code?: string;
  business_date?: string;
  total_amount?: number;
  status?: string;
  counterparty_kind?: string;
  counterparty_id?: number | null;
  counterparty_name?: string;
  payment_method?: string;
  notes?: string;
  capabilities?: Record<string, { allowed: boolean }>;
  receivable_id?: number | null;
  receivable_code?: string | null;
  receipt_id?: number | null;
  receipt_code?: string | null;
  payable_id?: number | null;
  payable_code?: string | null;
  payment_id?: number | null;
  payment_code?: string | null;
};

type LineFormRow = {
  category_code?: string;
  amount?: number;
  description?: string;
};

type MiscVoucherListPageProps = {
  kind: VoucherKind;
  auditEntityType: AuditEntityType;
  resource: string;
  hostResource: string;
  menuTitleKey: string;
  i18nPrefix: string;
  columnPersistenceId: string;
  service: {
    list: (params?: Record<string, unknown>) => Promise<{ items: VoucherRow[]; total: number }>;
    get: (id: number) => Promise<VoucherRow & { lines?: LineFormRow[]; notes?: string; bank_account_id?: number; counterparty_kind?: string }>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (id: number, data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: number) => Promise<unknown>;
    submit: (id: number) => Promise<unknown>;
    approve: (id: number) => Promise<unknown>;
    reject: (id: number) => Promise<unknown>;
    confirm: (id: number) => Promise<unknown>;
    unconfirm: (id: number) => Promise<unknown>;
    cancel: (id: number) => Promise<unknown>;
  };
};

function capAllowed(row: VoucherRow, action: string) {
  return row.capabilities?.[action]?.allowed === true;
}

function resolveDocCode(row: VoucherRow, codeField: 'income_code' | 'expense_code') {
  return String(row[codeField] ?? '').trim();
}

const COUNTERPARTY_KINDS = ['none', 'customer', 'supplier', 'employee', 'other'] as const;

type MiscCategoryQuickSelectProps = {
  value?: string;
  onChange?: (value: string) => void;
  catKind: MiscCategoryKind;
  options: { label: string; value: string }[];
  onCategoriesReload: () => Promise<void>;
  canQuickCreate: boolean;
  i18nPrefix: string;
};

const MiscCategoryQuickSelect: React.FC<MiscCategoryQuickSelectProps> = ({
  value,
  onChange,
  catKind,
  options,
  onCategoriesReload,
  canQuickCreate,
  i18nPrefix,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm<{ name: string }>();

  const handleCreate = async () => {
    const values = await createForm.validateFields();
    const name = String(values.name ?? '').trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await financeMiscCategoryService.createQuick(catKind, name);
      await onCategoriesReload();
      if (created?.code) {
        onChange?.(created.code);
      }
      setCreateOpen(false);
      createForm.resetFields();
      messageApi.success(t(`${i18nPrefix}.quickAddCategorySuccess`));
    } catch (e) {
      messageApi.error(getApiErrorMessage(e, t(`${i18nPrefix}.quickAddCategoryFailed`)));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <UniDropdown
        value={value}
        onChange={(v) => onChange?.(v == null ? '' : String(v))}
        options={options}
        size="small"
        showSearch
        allowClear
        style={{ width: '100%' }}
        optionFilterProp="label"
        placeholder={t(`${i18nPrefix}.line.categoryPlaceholder`)}
        quickCreate={
          canQuickCreate
            ? {
                label: t(`${i18nPrefix}.quickAddCategory`),
                onClick: () => {
                  createForm.resetFields();
                  setCreateOpen(true);
                },
              }
            : undefined
        }
      />
      <QuickCreateModal
        open={createOpen}
        title={t(`${i18nPrefix}.quickAddCategoryTitle`)}
        zIndex={token.zIndexPopupBase + MODAL_NESTED_ABOVE_PARENT_OFFSET}
        confirmLoading={creating}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onClose={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onConfirm={handleCreate}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            rules={[
              { required: true, whitespace: true, message: t(`${i18nPrefix}.quickAddCategoryNameRequired`) },
            ]}
            style={{ marginBottom: 0 }}
          >
            <Input
              placeholder={t(`${i18nPrefix}.quickAddCategoryNamePlaceholder`)}
              maxLength={100}
              autoFocus
            />
          </Form.Item>
        </Form>
      </QuickCreateModal>
    </>
  );
};

export const MiscVoucherListPage: React.FC<MiscVoucherListPageProps> = ({
  kind,
  auditEntityType,
  resource,
  hostResource,
  menuTitleKey,
  i18nPrefix,
  columnPersistenceId,
  service,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const linkedDetail = useLinkedDocumentDetail();
  const actionRef = useRef<ActionType>();
  const tableRowsRef = useRef<VoucherRow[]>([]);
  const perms = useResourcePermissions(resource);
  const miscCategoryPerms = useResourcePermissions('kuaicaiwu:finance-misc-category');
  const auditEnabled = useAuditRequired(auditEntityType, true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailRow, setDetailRow] = useState<(VoucherRow & { lines?: LineFormRow[]; notes?: string }) | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<MiscCategory[]>([]);
  const [customerOptions, setCustomerOptions] = useState<DocumentFormSelectOption[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<DocumentFormSelectOption[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<DocumentFormSelectOption[]>([]);
  const formRef = useRef<ProFormInstance>();
  const pendingFormValuesRef = useRef<Record<string, unknown> | null>(null);

  const catKind: MiscCategoryKind = kind;
  const codeField = kind === 'income' ? 'income_code' : 'expense_code';

  const selectedRowsForBatch = useMemo(
    () =>
      selectedRowKeys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is VoucherRow => row != null),
    [selectedRowKeys],
  );

  const auditBatchHandlers = useMemo(
    () => ({
      submit: (id: number) => service.submit(id),
      approve: (id: number) => service.approve(id),
    }),
    [service],
  );

  const paymentMethodOptions = useMemo(() => getPaymentMethodOptions(t), [t]);
  const miscStatusEnum = useMemo(() => buildMiscVoucherStatusEnum(t), [t]);
  const renderMiscStatusTag = useCallback(
    (status: string | null | undefined) => {
      const code = String(status ?? 'Draft');
      const label =
        miscStatusEnum[code as keyof typeof miscStatusEnum]?.text ?? code;
      return renderDocumentStatusTag(label, code);
    },
    [miscStatusEnum],
  );
  const categoryOptions = useMemo(
    () => categories.map((c) => ({ label: c.name, value: c.code })),
    [categories],
  );

  const canQuickAddCategory = perms.canCreate || miscCategoryPerms.canCreate;

  const reloadCategories = useCallback(async () => {
    const cats = await financeMiscCategoryService.list(catKind, {
      is_active: true,
      ensure_defaults: true,
    });
    setCategories(Array.isArray(cats) ? cats : []);
  }, [catKind]);

  const counterpartyKindOptions = useMemo(
    () =>
      COUNTERPARTY_KINDS.map((value) => ({
        value,
        label: t(`${i18nPrefix}.counterparty.${value}`),
      })),
    [i18nPrefix, t],
  );

  const loadMeta = useCallback(async () => {
    try {
      const [banks, cats, customers, suppliers, employees] = await Promise.all([
        bankAccountService.list({ limit: 200, is_active: true }),
        financeMiscCategoryService.list(catKind, { is_active: true, ensure_defaults: true }),
        loadCustomerFormReferenceList(hostResource),
        loadSupplierFormReferenceList(hostResource),
        loadUserFormReferenceOptions(hostResource),
      ]);
      setBankAccounts(banks.data ?? []);
      setCategories(Array.isArray(cats) ? cats : []);
      setCustomerOptions(
        customers.map((c) => ({
          value: c.id,
          label: String(c.name ?? c.code ?? c.id),
        })),
      );
      setSupplierOptions(
        suppliers.map((s) => ({
          value: s.id,
          label: String(s.name ?? s.code ?? s.id),
        })),
      );
      setEmployeeOptions(employees);
    } catch {
      setBankAccounts([]);
      setCategories([]);
      setCustomerOptions([]);
      setSupplierOptions([]);
      setEmployeeOptions([]);
    }
  }, [catKind, hostResource]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback(
    async (row: VoucherRow) => {
      if (!capAllowed(row, 'update')) {
        messageApi.warning(t('common.updateFailed'));
        return;
      }
      try {
        const full = await service.get(row.id);
        setEditing(row);
        pendingFormValuesRef.current = {
          business_date: full.business_date ? dayjs(full.business_date) : dayjs(),
          counterparty_kind: full.counterparty_kind ?? 'none',
          counterparty_id: full.counterparty_id,
          counterparty_name: full.counterparty_name,
          payment_method: full.payment_method,
          bank_account_id: full.bank_account_id,
          notes: full.notes,
          lines: (full.lines ?? []).length
            ? (full.lines ?? []).map((l) => ({
                category_code: l.category_code,
                amount: Number(l.amount),
                description: l.description,
              }))
            : [{}],
        };
        setModalOpen(true);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, t(`${i18nPrefix}.loadFailed`)));
      }
    },
    [i18nPrefix, messageApi, service, t],
  );

  const openDetail = useCallback(
    async (row: VoucherRow) => {
      setDetailOpen(true);
      setDetailLoading(true);
      try {
        const full = await service.get(row.id);
        setDetailRow(full);
      } catch (e) {
        setDetailRow(null);
        messageApi.error(getApiErrorMessage(e, t(`${i18nPrefix}.loadFailed`)));
      } finally {
        setDetailLoading(false);
      }
    },
    [i18nPrefix, messageApi, service, t],
  );

  const handleSave = async (values: Record<string, unknown>) => {
    assertBankAccountForPaymentMethod(
      String(values.payment_method ?? ''),
      values.bank_account_id as number | undefined,
      t,
    );
    const lines = normalizeFormListItems<LineFormRow>(values.lines)
      .filter((l) => l.category_code && l.amount != null && Number(l.amount) > 0)
      .map((l) => ({
        category_code: l.category_code,
        amount: l.amount,
        description: l.description,
      }));
    if (!lines.length) {
      throw new Error(t(`${i18nPrefix}.linesRequired`));
    }
    const kindValue = String(values.counterparty_kind || 'none');
    const counterpartyIdRaw = values.counterparty_id as number | undefined;
    let counterpartyName: string | undefined;
    if (kindValue === 'customer' && counterpartyIdRaw != null) {
      counterpartyName = String(
        customerOptions.find((o) => o.value === counterpartyIdRaw)?.label ?? '',
      ).trim();
    } else if (kindValue === 'supplier' && counterpartyIdRaw != null) {
      counterpartyName = String(
        supplierOptions.find((o) => o.value === counterpartyIdRaw)?.label ?? '',
      ).trim();
    } else if (kindValue === 'employee' && counterpartyIdRaw != null) {
      counterpartyName = String(
        employeeOptions.find((o) => o.value === counterpartyIdRaw)?.label ?? '',
      ).trim();
    } else if (kindValue === 'other') {
      counterpartyName = String(values.counterparty_name ?? '').trim() || undefined;
    }
    if (
      (kindValue === 'customer' || kindValue === 'supplier' || kindValue === 'employee') &&
      (counterpartyIdRaw == null || !counterpartyName)
    ) {
      throw new Error(t(`${i18nPrefix}.counterpartyPickRequired`));
    }
    if (kindValue === 'other' && !counterpartyName) {
      throw new Error(t(`${i18nPrefix}.counterpartyNameRequired`));
    }
    const payload = {
      business_date: toApiDateString(coerceFormDate(values.business_date)),
      counterparty_kind: kindValue,
      counterparty_id:
        kindValue === 'customer' || kindValue === 'supplier' || kindValue === 'employee'
          ? counterpartyIdRaw
          : undefined,
      counterparty_name: kindValue === 'none' ? undefined : counterpartyName,
      payment_method: values.payment_method,
      bank_account_id: values.bank_account_id,
      notes: values.notes,
      lines,
    };
    if (editing) {
      await service.update(editing.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await service.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalOpen(false);
    actionRef.current?.reload();
  };

  const runAction = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      try {
        await fn();
        messageApi.success(label);
        actionRef.current?.reload();
        if (detailOpen && detailRow) {
          const full = await service.get(detailRow.id);
          setDetailRow(full);
        }
      } catch (e) {
        messageApi.error(getApiErrorMessage(e, label));
      }
    },
    [detailOpen, detailRow, messageApi, service],
  );

  const handleBatchDelete = useCallback(
    async (keys: React.Key[]) => {
      if (!keys.length) return;
      const rows = keys
        .map((key) => tableRowsRef.current.find((row) => String(row.id) === String(key)))
        .filter((row): row is VoucherRow => row != null);
      const deletable = rows.filter((row) => capAllowed(row, 'delete'));
      if (deletable.length === 0) {
        messageApi.warning(t(`${i18nPrefix}.batchDeleteNoneDeletable`));
        return;
      }
      if (deletable.length < rows.length) {
        messageApi.warning(t(`${i18nPrefix}.batchDeletePartial`));
      }
      for (const row of deletable) {
        await service.delete(row.id);
      }
      messageApi.success(t(`${i18nPrefix}.batchDeleteSuccess`, { count: deletable.length }));
      setSelectedRowKeys([]);
      if (detailRow?.id != null && deletable.some((row) => row.id === detailRow.id)) {
        setDetailRow(null);
        setDetailOpen(false);
      }
      actionRef.current?.reload();
    },
    [detailRow?.id, i18nPrefix, messageApi, service, t],
  );

  const handleAuditBatchSuccess = useCallback(() => {
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  }, []);

  const columns: ProColumns<VoucherRow>[] = useMemo(
    () =>
      alignProColumns(
        [
          ...financeDocCodePartnerSearchColumns({
            docCodeLabel: t(`${i18nPrefix}.col.code`),
            docCodeField: codeField,
            partnerLabel: t(`${i18nPrefix}.col.counterparty`),
            partnerIdField: 'counterparty_id',
            partnerNameField: 'counterparty_name',
          }),
          {
            title: t(`${i18nPrefix}.col.code`),
            key: 'finance_doc_partner_stacked',
            dataIndex: codeField,
            width: 240,
            minWidth: 240,
            uniTableKeepWidth: true,
            uniTablePrimaryFlex: false,
            resizable: false,
            fixed: 'left',
            hideInSearch: true,
            ellipsis: false,
            render: (_, row) => {
              const partner = String(row.counterparty_name ?? '').trim() || '—';
              const code = resolveDocCode(row, codeField);
              return (
                <UniTableStackedPrimaryCell
                  primary={partner}
                  secondary={code}
                  onSecondaryClick={() => void openDetail(row)}
                />
              );
            },
          },
          {
            title: t(`${i18nPrefix}.col.counterparty`),
            dataIndex: 'counterparty_name',
            hideInTable: true,
          },
          {
            title: t(`${i18nPrefix}.col.businessDate`),
            key: 'business_date',
            dataIndex: 'business_date',
            valueType: 'date',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
          },
          {
            title: t(`${i18nPrefix}.col.businessDate`),
            dataIndex: 'business_date_range',
            valueType: 'dateRange',
            hideInTable: true,
            order: 20,
            formItemProps: formDateRangeFormItemProps,
          },
          {
            title: t(`${i18nPrefix}.col.amount`),
            key: 'total_amount',
            dataIndex: 'total_amount',
            align: 'right',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            sorter: true,
            render: (_, r) => formatCurrencyAmount(r.total_amount),
          },
          {
            title: t(`${i18nPrefix}.field.notes`),
            dataIndex: 'notes',
            minWidth: 160,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            hideInSearch: true,
            ellipsis: true,
            render: (_, r) => r.notes?.trim() || '—',
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            hideInTable: true,
            order: 22,
            valueEnum: miscStatusEnum,
          },
          ...buildDocumentAuditColumns<VoucherRow>(t),
          {
            title: t('common.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            hideInSearch: true,
            render: (_, r) => renderMiscStatusTag(r.status),
          },
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => {
              const code = resolveDocCode(row, codeField);
              const nodes: React.ReactNode[] = [];
              if (perms.canRead) {
                nodes.push(
                  <Button key="read" {...rowActionKind('read')} onClick={() => void openDetail(row)} />,
                );
              }
              if (perms.canUpdate && capAllowed(row, 'update')) {
                nodes.push(
                  <Button key="edit" {...rowActionKind('update')} onClick={() => void openEdit(row)} />,
                );
              }
              if (perms.canAction?.('submit') && capAllowed(row, 'submit')) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="submit"
                    title={t(`${i18nPrefix}.submitConfirmTitle`)}
                    description={t(`${i18nPrefix}.submitConfirmDesc`, { code })}
                    onConfirm={() => void runAction(t(`${i18nPrefix}.submit`), () => service.submit(row.id))}
                  >
                    <Button {...rowActionKind('submit')} onClick={(e) => e.stopPropagation()} />
                  </ActionConfirmPopconfirm>,
                );
              }
              if (perms.canAction?.('approve') && capAllowed(row, 'approve')) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="approve"
                    title={t(`${i18nPrefix}.approveConfirmTitle`)}
                    description={t(`${i18nPrefix}.approveConfirmDesc`, { code })}
                    onConfirm={() => void runAction(t(`${i18nPrefix}.approve`), () => service.approve(row.id))}
                  >
                    <Button {...rowActionKind('audit')} onClick={(e) => e.stopPropagation()} />
                  </ActionConfirmPopconfirm>,
                );
              }
              if (perms.canAction?.('reject') && capAllowed(row, 'reject')) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="reject"
                    title={t(`${i18nPrefix}.rejectConfirmTitle`)}
                    description={t(`${i18nPrefix}.rejectConfirmDesc`, { code })}
                    onConfirm={() => void runAction(t('components.uniAction.reject'), () => service.reject(row.id))}
                  >
                    <Button {...rowActionKind('reject')} onClick={(e) => e.stopPropagation()} />
                  </ActionConfirmPopconfirm>,
                );
              }
              const pushAction = kind === 'income' ? 'push_receipt' : 'push_payment';
              const pushLabel =
                kind === 'income' ? t('app.kuaicaiwu.otherIncome.pushReceipt') : t('app.kuaicaiwu.otherExpense.pushPayment');
              if (perms.canAction?.('audit') && capAllowed(row, pushAction)) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="push-finance"
                    title={pushLabel}
                    description={t(`${i18nPrefix}.confirmPostDesc`, { code })}
                    onConfirm={() => void runAction(pushLabel, () => service.confirm(row.id))}
                  >
                    <Button {...rowActionKind('execute')} onClick={(e) => e.stopPropagation()}>
                      {pushLabel}
                    </Button>
                  </ActionConfirmPopconfirm>,
                );
              } else if (perms.canAction?.('audit') && capAllowed(row, 'confirm')) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="confirm"
                    title={t(`${i18nPrefix}.confirmPostTitle`)}
                    description={t(`${i18nPrefix}.confirmPostDesc`, { code })}
                    onConfirm={() => void runAction(t(`${i18nPrefix}.confirm`), () => service.confirm(row.id))}
                  >
                    <Button {...rowActionKind('audit')} onClick={(e) => e.stopPropagation()} />
                  </ActionConfirmPopconfirm>,
                );
              }
              if (perms.canAction?.('revoke') && capAllowed(row, 'unconfirm')) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="unconfirm"
                    title={t(`${i18nPrefix}.unconfirmTitle`)}
                    description={t(`${i18nPrefix}.unconfirmDesc`, { code })}
                    onConfirm={() => void runAction(t(`${i18nPrefix}.unconfirm`), () => service.unconfirm(row.id))}
                  >
                    <Button {...rowActionKind('revoke')} onClick={(e) => e.stopPropagation()} />
                  </ActionConfirmPopconfirm>,
                );
              }
              if (perms.canAction?.('revoke') && capAllowed(row, 'cancel')) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="cancel"
                    title={t(`${i18nPrefix}.voidTitle`)}
                    description={t(`${i18nPrefix}.voidDesc`, { code })}
                    onConfirm={() => void runAction(t('app.kuaicaiwu.common.void'), () => service.cancel(row.id))}
                  >
                    <Button {...rowActionKind('revoke')} onClick={(e) => e.stopPropagation()} />
                  </ActionConfirmPopconfirm>,
                );
              }
              if (perms.canDelete && capAllowed(row, 'delete')) {
                nodes.push(
                  <ActionConfirmPopconfirm
                    key="delete"
                    title={t(`${i18nPrefix}.deleteTitle`)}
                    description={t(`${i18nPrefix}.deleteDesc`, { code })}
                    okType="danger"
                    onConfirm={() => void runAction(t('common.deleteSuccess'), () => service.delete(row.id))}
                  >
                    <Button {...rowActionKind('delete')} onClick={(e) => e.stopPropagation()} />
                  </ActionConfirmPopconfirm>,
                );
              }
              return nodes;
            },
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [codeField, i18nPrefix, miscStatusEnum, openDetail, openEdit, perms, renderMiscStatusTag, runAction, service, t],
  );

  const createButtonText = t(`${i18nPrefix}.createButton`);

  const rowSelectionEnabled =
    perms.canDelete ||
    Boolean(perms.canAction?.('submit')) ||
    Boolean(perms.canAction?.('approve')) ||
    Boolean(perms.canAction?.('audit'));

  return (
    <>
      <ListPageTemplate>
        <UniTable<VoucherRow>
          actionRef={actionRef}
          permissionResource={resource}
          columnPersistenceId={columnPersistenceId}
          headerTitle={t(menuTitleKey)}
          rowKey="id"
          columns={columns}
          pinnedTabsField={FINANCE_DOC_PINNED_STATUS_FIELD}
          showAdvancedSearch
          showCreateButton={Boolean(perms.canCreate)}
          createButtonText={createButtonText}
          onCreate={openCreate}
          enableRowSelection={rowSelectionEnabled}
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton={Boolean(perms.canDelete)}
          deleteButtonText={t('common.batchDelete')}
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t(`${i18nPrefix}.confirmBatchDelete`, { count })}
          toolBarActionsAfterDelete={[
            <UniAuditBatchMenuButton
              key="misc-voucher-batch-audit"
              selectedRowKeys={selectedRowKeys}
              selectedRecords={selectedRowsForBatch}
              auditEnabled={auditEnabled}
              permGates={perms}
              handlers={auditBatchHandlers}
              onSuccess={handleAuditBatchSuccess}
              toolBarButtonSize="middle"
            />,
          ]}
          onTableDataChange={(rows) => {
            tableRowsRef.current = rows;
          }}
          request={async (params, _sort, _filter, searchFormValues) => {
            const res = await service.list({
              skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
              limit: params.pageSize ?? 20,
              keyword: pickSearchString(searchFormValues, codeField) ?? params.keyword,
              status: pickSearchString(searchFormValues, 'status') ?? params.status,
            });
            return { data: res.items, success: true, total: res.total };
          }}
        />
      </ListPageTemplate>

      <FormModalTemplate
        open={modalOpen}
        formRef={formRef}
        isEdit={editing != null}
        title={editing ? t(`${i18nPrefix}.editTitle`) : t(`${i18nPrefix}.createTitle`)}
        onClose={() => setModalOpen(false)}
        afterOpenChange={(open) => {
          if (!open) {
            formRef.current?.resetFields();
            setEditing(null);
            pendingFormValuesRef.current = null;
            return;
          }
          const pending = pendingFormValuesRef.current;
          if (pending) {
            formRef.current?.setFieldsValue(pending);
            pendingFormValuesRef.current = null;
            return;
          }
          if (editing == null) {
            formRef.current?.setFieldsValue({
              business_date: dayjs(),
              counterparty_kind: 'none',
              payment_method: BANK_TRANSFER_PAYMENT_METHOD,
              lines: [{}],
            });
          }
        }}
        onFinish={async (values) => {
          try {
            await handleSave(values as Record<string, unknown>);
          } catch (e) {
            messageApi.error(getApiErrorMessage(e, t('common.saveFailed')));
          }
        }}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormDatePicker
              name="business_date"
              label={t(`${i18nPrefix}.field.businessDate`)}
              rules={[{ required: true }]}
              fieldProps={{ style: { width: '100%' } }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="payment_method"
              label={t(`${i18nPrefix}.field.paymentMethod`)}
              options={paymentMethodOptions}
              rules={[{ required: true }]}
            />
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="bank_account_id"
              label={t(`${i18nPrefix}.field.bankAccount`)}
              options={bankAccounts.map((a) => ({
                label: formatBankAccountOptionLabel(a),
                value: a.id,
              }))}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="counterparty_kind"
              label={t(`${i18nPrefix}.field.counterpartyKind`)}
              options={counterpartyKindOptions}
              fieldProps={{
                onChange: () => {
                  formRef.current?.setFieldsValue({
                    counterparty_id: undefined,
                    counterparty_name: undefined,
                  });
                },
              }}
            />
          </Col>
        </Row>
        <ProFormDependency name={['counterparty_kind']} formItemProps={{ style: { marginBottom: 0 } }}>
          {({ counterparty_kind: cpKind }) => {
            const kindStr = String(cpKind ?? 'none');
            if (kindStr === 'none') {
              return null;
            }
            return (
              <Row gutter={16}>
                <Col span={12}>
                  {kindStr === 'customer' && (
                    <ProFormSelect
                      name="counterparty_id"
                      label={t(`${i18nPrefix}.field.counterpartyCustomer`)}
                      rules={[{ required: true, message: t('common.required') }]}
                      options={customerOptions}
                      fieldProps={{
                        showSearch: true,
                        optionFilterProp: 'label',
                      }}
                    />
                  )}
                  {kindStr === 'supplier' && (
                    <ProFormSelect
                      name="counterparty_id"
                      label={t(`${i18nPrefix}.field.counterpartySupplier`)}
                      rules={[{ required: true, message: t('common.required') }]}
                      options={supplierOptions}
                      fieldProps={{
                        showSearch: true,
                        optionFilterProp: 'label',
                      }}
                    />
                  )}
                  {kindStr === 'employee' && (
                    <ProFormSelect
                      name="counterparty_id"
                      label={t(`${i18nPrefix}.field.counterpartyEmployee`)}
                      rules={[{ required: true, message: t('common.required') }]}
                      options={employeeOptions}
                      fieldProps={{
                        showSearch: true,
                        optionFilterProp: 'label',
                      }}
                    />
                  )}
                  {kindStr === 'other' && (
                    <ProFormText
                      name="counterparty_name"
                      label={t(`${i18nPrefix}.field.counterpartyName`)}
                      rules={[{ required: true, message: t('common.required') }]}
                    />
                  )}
                </Col>
              </Row>
            );
          }}
        </ProFormDependency>
        <UniTableDetail
          name="lines"
          title={t(`${i18nPrefix}.linesTitle`)}
          required
          initialValue={{}}
          columns={[
            {
              title: t(`${i18nPrefix}.line.category`),
              dataIndex: 'category_code',
              width: 200,
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item
                  name={[field.name, 'category_code']}
                  style={{ margin: 0 }}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <MiscCategoryQuickSelect
                    catKind={catKind}
                    options={categoryOptions}
                    onCategoriesReload={reloadCategories}
                    canQuickCreate={canQuickAddCategory}
                    i18nPrefix={i18nPrefix}
                  />
                </Form.Item>
              ),
            },
            {
              title: t(`${i18nPrefix}.line.amount`),
              dataIndex: 'amount',
              width: 140,
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item
                  name={[field.name, 'amount']}
                  style={{ margin: 0 }}
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <InputNumber size="small" min={0.01} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              ),
            },
            {
              title: t(`${i18nPrefix}.line.description`),
              dataIndex: 'description',
              render: (_: unknown, field: FormListFieldData) => (
                <Form.Item name={[field.name, 'description']} style={{ margin: 0 }}>
                  <Input size="small" />
                </Form.Item>
              ),
            },
          ]}
        />
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="notes"
              label={t(`${i18nPrefix}.field.notes`)}
              fieldProps={{ rows: 2 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        title={detailRow ? resolveDocCode(detailRow, codeField) : ''}
        loading={detailLoading}
      >
        {detailRow && (
          <>
            <Descriptions column={2} size="small">
              <Descriptions.Item label={t(`${i18nPrefix}.col.businessDate`)}>{detailRow.business_date}</Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>
                {renderMiscStatusTag(detailRow.status)}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${i18nPrefix}.col.amount`)}>
                {formatCurrencyAmount(detailRow.total_amount)}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${i18nPrefix}.col.counterparty`)}>
                {detailRow.counterparty_name || '—'}
              </Descriptions.Item>
              <Descriptions.Item label={t(`${i18nPrefix}.field.notes`)} span={2}>
                {detailRow.notes || '—'}
              </Descriptions.Item>
              {kind === 'income' && detailRow.receivable_id ? (
                <Descriptions.Item label={t('app.kuaicaiwu.otherIncome.finance.receivable')}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => linkedDetail?.openLinkedDocumentDetail('receivable', Number(detailRow.receivable_id))}
                  >
                    {detailRow.receivable_code || detailRow.receivable_id}
                  </Button>
                </Descriptions.Item>
              ) : null}
              {kind === 'income' && detailRow.receipt_id ? (
                <Descriptions.Item label={t('app.kuaicaiwu.otherIncome.finance.receipt')}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => linkedDetail?.openLinkedDocumentDetail('receipt', Number(detailRow.receipt_id))}
                  >
                    {detailRow.receipt_code || detailRow.receipt_id}
                  </Button>
                </Descriptions.Item>
              ) : null}
              {kind === 'expense' && detailRow.payable_id ? (
                <Descriptions.Item label={t('app.kuaicaiwu.otherExpense.finance.payable')}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => linkedDetail?.openLinkedDocumentDetail('payable', Number(detailRow.payable_id))}
                  >
                    {detailRow.payable_code || detailRow.payable_id}
                  </Button>
                </Descriptions.Item>
              ) : null}
              {kind === 'expense' && detailRow.payment_id ? (
                <Descriptions.Item label={t('app.kuaicaiwu.otherExpense.finance.payment')}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => linkedDetail?.openLinkedDocumentDetail('payment', Number(detailRow.payment_id))}
                  >
                    {detailRow.payment_code || detailRow.payment_id}
                  </Button>
                </Descriptions.Item>
              ) : null}
            </Descriptions>
            <Table
              size="small"
              style={{ marginTop: 16 }}
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={detailRow.lines ?? []}
              columns={[
                { title: t(`${i18nPrefix}.line.category`), dataIndex: 'category_name' },
                { title: t(`${i18nPrefix}.line.amount`), dataIndex: 'amount', render: (v) => formatCurrencyAmount(v) },
                { title: t(`${i18nPrefix}.line.description`), dataIndex: 'description' },
              ]}
            />
          </>
        )}
      </DetailDrawerTemplate>
    </>
  );
};

export default MiscVoucherListPage;
