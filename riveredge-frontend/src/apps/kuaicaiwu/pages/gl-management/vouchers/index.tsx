/**
 * 总账凭证
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import {
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { ThunderboltOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useNumericPrecisionPlaces } from '../../../../../hooks/useNumericPrecision';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';
import { UniTable } from '../../../../../components/uni-table';
import {
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { StatusTag } from '../../../../../constants/statusBadges';
import { alignProColumns, GLOBAL_DOC_LIST_FIELD_RANK } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useLinkedDocumentDetail } from '../../../../../components/linked-document-detail';
import { canOpenLinkedDocumentDetail } from '../../../../kuaizhizao/utils/linkedDocumentDetail';
import { glService, type GlAccount, type GlVoucher, type GlVoucherLine } from '../../../services/gl';
import { apiRequest } from '../../../../../services/api';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const NS = 'app.kuaicaiwu.gl.vouchers';

const asList = <T,>(res: unknown): T[] => {
  if (Array.isArray(res)) return res as T[];
  const obj = res as { data?: T[]; items?: T[] } | null;
  return obj?.data ?? obj?.items ?? [];
};

type DraftLine = {
  key: string;
  account_id?: number;
  debit_amount: number;
  credit_amount: number;
  summary?: string;
  customer_id?: number;
  customer_name?: string;
  supplier_id?: number;
  supplier_name?: string;
  department_id?: number;
  department_name?: string;
  employee_id?: number;
  employee_name?: string;
  project_id?: number;
  project_name?: string;
  cash_flow_item_id?: number;
};

const emptyLine = (): DraftLine => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  debit_amount: 0,
  credit_amount: 0,
  summary: '',
});

const GlVouchersPage: React.FC = () => {
  const { t } = useTranslation();
  const amountDecimals = useNumericPrecisionPlaces('amount');
  const { message: messageApi } = App.useApp();
  const linked = useLinkedDocumentDetail();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<ProFormInstance>();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GlVoucher | null>(null);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [genLoading, setGenLoading] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<{ label: string; value: number }[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<{ label: string; value: number }[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<{ label: string; value: number }[]>([]);
  const [employeeOptions, setEmployeeOptions] = useState<{ label: string; value: number }[]>([]);
  const [projectOptions, setProjectOptions] = useState<{ label: string; value: number }[]>([]);
  const [cashFlowOptions, setCashFlowOptions] = useState<{ label: string; value: number }[]>([]);
  const [enableVoucherWords, setEnableVoucherWords] = useState(true);

  const accountById = useMemo(() => {
    const map = new Map<number, GlAccount>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, settingsRes, custRes, suppRes, deptRes, usersRes, projRes, cfRes] =
          await Promise.all([
            glService.listAccounts({ is_active: true }),
            glService.getSettings(),
            apiRequest<unknown>('/apps/master-data/supply-chain/customers', {
              params: { limit: 1000, is_active: true },
            }),
            apiRequest<unknown>('/apps/master-data/supply-chain/suppliers', {
              params: { limit: 1000, is_active: true },
            }),
            apiRequest<unknown>('/core/departments/tree', { method: 'GET' }),
            apiRequest<unknown>('/core/users', { params: { limit: 500, is_active: true } }),
            glService.listProjects(),
            glService.listCashFlowItems(),
          ]);
        if (cancelled) return;
        setAccounts(asList<GlAccount>(accRes).filter((a) => a.is_leaf));
        setEnableVoucherWords(Boolean((settingsRes as any)?.enable_voucher_words ?? true));
        const mapPartner = (res: unknown) =>
          asList<Record<string, unknown>>(res).map((c) => ({
            label: String(c.name || c.customer_name || c.supplier_name || c.code || c.id),
            value: Number(c.id),
          }));
        setCustomerOptions(mapPartner(custRes));
        setSupplierOptions(mapPartner(suppRes));
        const flattenDept = (nodes: any[], out: { label: string; value: number }[] = []) => {
          for (const n of nodes || []) {
            if (n?.id) out.push({ label: String(n.name || n.title || n.id), value: Number(n.id) });
            if (n?.children) flattenDept(n.children, out);
          }
          return out;
        };
        const deptTree = (deptRes as any)?.items || (deptRes as any)?.data || deptRes;
        setDepartmentOptions(flattenDept(Array.isArray(deptTree) ? deptTree : []));
        setEmployeeOptions(
          asList<Record<string, unknown>>(usersRes).map((u) => ({
            label: String(u.full_name || u.username || u.name || u.id),
            value: Number(u.id),
          })),
        );
        setProjectOptions(
          asList<Record<string, unknown>>(projRes).map((p) => ({
            label: `${p.project_code} ${p.project_name}`,
            value: Number(p.id),
          })),
        );
        setCashFlowOptions(
          asList<Record<string, unknown>>(cfRes).map((p) => ({
            label: `${p.item_code} ${p.item_name}`,
            value: Number(p.id),
          })),
        );
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountOptions = useMemo(
    () =>
      accounts.map((a) => ({
        label: `${a.account_code} ${a.account_name}`,
        value: a.id,
      })),
    [accounts],
  );

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: t(`${NS}.status.draft`, { defaultValue: '制单' }),
      reviewed: t(`${NS}.status.reviewed`, { defaultValue: '已审核' }),
      posted: t(`${NS}.status.posted`, { defaultValue: '已记账' }),
      cancelled: t(`${NS}.status.cancelled`, { defaultValue: '已作废' }),
    };
    return map[status] || status;
  };

  const statusColor = (status: string): 'default' | 'processing' | 'success' | 'error' | 'warning' => {
    if (status === 'draft') return 'default';
    if (status === 'reviewed') return 'processing';
    if (status === 'posted') return 'success';
    if (status === 'cancelled') return 'error';
    return 'default';
  };

  const reload = () => actionRef.current?.reload();

  const runAction = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      messageApi.success(okMsg);
      reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed', { defaultValue: '操作失败' })));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setLines([emptyLine(), emptyLine()]);
    setModalOpen(true);
  };

  const openEdit = async (record: GlVoucher) => {
    try {
      const detail = (await glService.getVoucher(record.id)) as GlVoucher;
      setEditing(detail);
      const detailLines = (detail.lines || []).map((l: GlVoucherLine) => ({
        key: `${l.id || Math.random()}`,
        account_id: l.account_id,
        debit_amount: Number(l.debit_amount || 0),
        credit_amount: Number(l.credit_amount || 0),
        summary: l.summary || '',
        customer_id: l.customer_id || undefined,
        customer_name: l.customer_name || undefined,
        supplier_id: l.supplier_id || undefined,
        supplier_name: l.supplier_name || undefined,
        department_id: l.department_id || undefined,
        department_name: l.department_name || undefined,
        employee_id: l.employee_id || undefined,
        employee_name: l.employee_name || undefined,
        project_id: l.project_id || undefined,
        project_name: l.project_name || undefined,
        cash_flow_item_id: l.cash_flow_item_id || undefined,
      }));
      setLines(detailLines.length >= 2 ? detailLines : [...detailLines, emptyLine(), emptyLine()].slice(0, Math.max(2, detailLines.length)));
      setModalOpen(true);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })));
    }
  };

  const columns: ProColumns<GlVoucher>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t(`${NS}.col.voucherCode`),
            dataIndex: 'voucher_code',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            copyable: true,
            ellipsis: true,
          },
          {
            title: t(`${NS}.col.keyword`),
            dataIndex: 'keyword',
            hideInTable: true,
            fieldProps: { allowClear: true },
          },
          {
            title: t(`${NS}.col.voucherDate`),
            dataIndex: 'voucher_date',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
          },
          {
            title: t(`${NS}.col.period`),
            key: 'period',
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            render: (_, r) => {
              if (r.period_year && r.period_month) {
                return `${r.period_year}-${String(r.period_month).padStart(2, '0')}`;
              }
              if (r.voucher_date) {
                const d = dayjs(r.voucher_date);
                if (d.isValid()) return d.format('YYYY-MM');
              }
              return '—';
            },
          },
          {
            // 摘要长短不一：唯一 RemainderFlex
            title: t(`${NS}.col.summary`),
            dataIndex: 'summary',
            minWidth: 140,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: true,
            hideInSearch: true,
            render: (_, r) => r.summary || '—',
          },
          {
            title: t(`${NS}.col.source`),
            key: 'gl_voucher_source',
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            ellipsis: true,
            render: (_, r) => {
              const type = String(r.source_doc_type || '');
              const id = Number(r.source_doc_id || 0);
              if (!type || !id) return '—';
              const label = `${type}#${id}`;
              if (canOpenLinkedDocumentDetail(type)) {
                return (
                  <a
                    onClick={() => {
                      linked.openLinkedDocumentDetail(type, id);
                    }}
                  >
                    {label}
                  </a>
                );
              }
              return label;
            },
          },
          {
            title: t(`${NS}.col.debitAccounts`, { defaultValue: '借方科目' }),
            dataIndex: 'debit_accounts',
            width: 200,
            minWidth: 180,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            ellipsis: true,
            render: (_, r) => r.debit_accounts || '—',
          },
          {
            title: t(`${NS}.col.creditAccounts`, { defaultValue: '贷方科目' }),
            dataIndex: 'credit_accounts',
            width: 200,
            minWidth: 180,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            ellipsis: true,
            render: (_, r) => r.credit_accounts || '—',
          },
          {
            title: t(`${NS}.col.debit`),
            dataIndex: 'total_debit',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
          },
          {
            title: t(`${NS}.col.credit`),
            dataIndex: 'total_credit',
            valueType: 'money',
            align: 'right',
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
          },
          {
            title: t('common.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            valueType: 'select',
            valueEnum: {
              draft: { text: t(`${NS}.status.draft`) },
              reviewed: { text: t(`${NS}.status.reviewed`) },
              posted: { text: t(`${NS}.status.posted`) },
              cancelled: { text: t(`${NS}.status.cancelled`) },
            },
            render: (_, r) => (
              <StatusTag color={statusColor(r.status)}>{statusLabel(r.status)}</StatusTag>
            ),
          },
          {
            title: t('common.actions'),
            key: 'action',
            fixed: 'right',
            hideInSearch: true,
            render: (_, record) => {
              const acts: React.ReactNode[] = [];
              if (record.status === 'draft') {
                acts.push(
                  <Button key="edit" {...rowActionKind('update')} onClick={() => void openEdit(record)} />,
                );
                acts.push(
                  <Button
                    key="review"
                    {...rowActionKind('audit')}
                    {...rowActionLabelKeep()}
                    onClick={() =>
                      void runAction(
                        () => glService.reviewVoucher(record.id),
                        t(`${NS}.reviewSuccess`),
                      )
                    }
                  >
                    {t(`${NS}.action.review`)}
                  </Button>,
                );
                acts.push(
                  <Popconfirm
                    key="obsolete"
                    title={t(`${NS}.confirmObsolete`)}
                    onConfirm={() =>
                      void runAction(
                        () => glService.obsoleteVoucher(record.id),
                        t(`${NS}.obsoleteSuccess`),
                      )
                    }
                  >
                    <Button {...rowActionKind('obsolete')} />
                  </Popconfirm>,
                );
              }
              if (record.status === 'reviewed') {
                acts.push(
                  <Button
                    key="unreview"
                    {...rowActionKind('revoke')}
                    {...rowActionLabelKeep()}
                    onClick={() =>
                      void runAction(
                        () => glService.unreviewVoucher(record.id),
                        t(`${NS}.unreviewSuccess`),
                      )
                    }
                  >
                    {t(`${NS}.action.unreview`)}
                  </Button>,
                );
                acts.push(
                  <Button
                    key="post"
                    {...rowActionKind('execute')}
                    {...rowActionLabelKeep()}
                    onClick={() =>
                      void runAction(
                        () => glService.postVoucher(record.id),
                        t(`${NS}.postSuccess`),
                      )
                    }
                  >
                    {t(`${NS}.action.post`)}
                  </Button>,
                );
              }
              if (record.status === 'posted') {
                acts.push(
                  <Button
                    key="unpost"
                    {...rowActionKind('revoke')}
                    {...rowActionLabelKeep()}
                    onClick={() =>
                      void runAction(
                        () => glService.unpostVoucher(record.id),
                        t(`${NS}.unpostSuccess`),
                      )
                    }
                  >
                    {t(`${NS}.action.unpost`)}
                  </Button>,
                );
              }
              return acts;
            },
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, linked],
  );


  const lineTotalDebit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
  const lineTotalCredit = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);

  const handleSave = async (values: Record<string, unknown>) => {
    const validLines = lines.filter((l) => l.account_id);
    if (validLines.length < 2) {
      messageApi.error(t(`${NS}.needTwoLines`, { defaultValue: '至少需要两行分录' }));
      return;
    }
    if (Math.abs(lineTotalDebit - lineTotalCredit) > 0.005) {
      messageApi.error(t(`${NS}.unbalanced`, { defaultValue: '借贷不平衡' }));
      return;
    }
    const payload = {
      voucher_word: (values.voucher_word as string) || '记',
      voucher_date: values.voucher_date
        ? dayjs(values.voucher_date as string).format('YYYY-MM-DD')
        : undefined,
      summary: values.summary || undefined,
      lines: validLines.map((l) => ({
        account_id: l.account_id,
        debit_amount: Number(l.debit_amount || 0),
        credit_amount: Number(l.credit_amount || 0),
        summary: l.summary || values.summary || undefined,
        customer_id: l.customer_id || undefined,
        customer_name: l.customer_name || undefined,
        supplier_id: l.supplier_id || undefined,
        supplier_name: l.supplier_name || undefined,
        department_id: l.department_id || undefined,
        department_name: l.department_name || undefined,
        employee_id: l.employee_id || undefined,
        employee_name: l.employee_name || undefined,
        project_id: l.project_id || undefined,
        project_name: l.project_name || undefined,
        cash_flow_item_id: l.cash_flow_item_id || undefined,
      })),
    };
    try {
      if (editing?.id) {
        await glService.updateVoucher(editing.id, payload);
        messageApi.success(t('common.updateSuccess', { defaultValue: '更新成功' }));
      } else {
        await glService.createVoucher(payload);
        messageApi.success(t('common.createSuccess', { defaultValue: '创建成功' }));
      }
      setModalOpen(false);
      setEditing(null);
      reload();
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.saveFailed', { defaultValue: '保存失败' })));
    }
  };

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const res = (await glService.generateFromEvents(50)) as { created?: number; count?: number };
      messageApi.success(
        t(`${NS}.generateSuccess`, {
          defaultValue: '已从业务事件生成凭证',
          count: res.created ?? res.count ?? 0,
        }),
      );
      reload();
    } catch (error) {
      messageApi.error(
        getApiErrorMessage(error, t(`${NS}.generateFailed`, { defaultValue: '生成失败' })),
      );
    } finally {
      setGenLoading(false);
    }
  };

  const lineColumns = [
    {
      title: t(`${NS}.line.account`, { defaultValue: '科目' }),
      dataIndex: 'account_id',
      width: 220,
      render: (_: unknown, record: DraftLine, index: number) => (
        <Select
          size="medium"
          value={record.account_id}
          options={accountOptions}
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          onChange={(v: number) => {
            setLines((prev) =>
              prev.map((l, i) => (i === index ? { ...l, account_id: v } : l)),
            );
          }}
        />
      ),
    },
    {
      title: t(`${NS}.line.summary`, { defaultValue: '摘要' }),
      dataIndex: 'summary',
      width: 140,
      render: (_: unknown, record: DraftLine, index: number) => (
        <Input
          size="medium"
          value={record.summary}
          onChange={(e) => {
            const v = e.target.value;
            setLines((prev) => prev.map((l, i) => (i === index ? { ...l, summary: v } : l)));
          }}
        />
      ),
    },
    {
      title: t(`${NS}.line.customer`, { defaultValue: '客户' }),
      dataIndex: 'customer_id',
      width: 140,
      render: (_: unknown, record: DraftLine, index: number) => {
        const acc = record.account_id ? accountById.get(record.account_id) : undefined;
        if (!acc?.aux_customer) return '—';
        return (
          <Select
            size="medium"
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={customerOptions}
            value={record.customer_id}
            allowClear
            onChange={(v, opt) => {
              const label = Array.isArray(opt) ? undefined : (opt as any)?.label;
              setLines((prev) =>
                prev.map((l, i) =>
                  i === index
                    ? {
                        ...l,
                        customer_id: v ? Number(v) : undefined,
                        customer_name: label ? String(label) : undefined,
                      }
                    : l,
                ),
              );
            }}
          />
        );
      },
    },
    {
      title: t(`${NS}.line.supplier`, { defaultValue: '供应商' }),
      dataIndex: 'supplier_id',
      width: 140,
      render: (_: unknown, record: DraftLine, index: number) => {
        const acc = record.account_id ? accountById.get(record.account_id) : undefined;
        if (!acc?.aux_supplier) return '—';
        return (
          <Select
            size="medium"
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={supplierOptions}
            value={record.supplier_id}
            allowClear
            onChange={(v, opt) => {
              const label = Array.isArray(opt) ? undefined : (opt as any)?.label;
              setLines((prev) =>
                prev.map((l, i) =>
                  i === index
                    ? {
                        ...l,
                        supplier_id: v ? Number(v) : undefined,
                        supplier_name: label ? String(label) : undefined,
                      }
                    : l,
                ),
              );
            }}
          />
        );
      },
    },
    {
      title: t(`${NS}.line.department`, { defaultValue: '部门' }),
      dataIndex: 'department_id',
      width: 140,
      render: (_: unknown, record: DraftLine, index: number) => {
        const acc = record.account_id ? accountById.get(record.account_id) : undefined;
        if (!acc?.aux_department) return '—';
        return (
          <Select
            size="medium"
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={departmentOptions}
            value={record.department_id}
            allowClear
            onChange={(v, opt) => {
              const label = Array.isArray(opt) ? undefined : (opt as any)?.label;
              setLines((prev) =>
                prev.map((l, i) =>
                  i === index
                    ? {
                        ...l,
                        department_id: v ? Number(v) : undefined,
                        department_name: label ? String(label) : undefined,
                      }
                    : l,
                ),
              );
            }}
          />
        );
      },
    },
    {
      title: t(`${NS}.line.employee`, { defaultValue: '职员' }),
      dataIndex: 'employee_id',
      width: 120,
      render: (_: unknown, record: DraftLine, index: number) => {
        const acc = record.account_id ? accountById.get(record.account_id) : undefined;
        if (!acc?.aux_employee) return '—';
        return (
          <Select
            size="medium"
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={employeeOptions}
            value={record.employee_id}
            allowClear
            onChange={(v, opt) => {
              const label = Array.isArray(opt) ? undefined : (opt as any)?.label;
              setLines((prev) =>
                prev.map((l, i) =>
                  i === index
                    ? {
                        ...l,
                        employee_id: v ? Number(v) : undefined,
                        employee_name: label ? String(label) : undefined,
                      }
                    : l,
                ),
              );
            }}
          />
        );
      },
    },
    {
      title: t(`${NS}.line.project`, { defaultValue: '项目' }),
      dataIndex: 'project_id',
      width: 140,
      render: (_: unknown, record: DraftLine, index: number) => {
        const acc = record.account_id ? accountById.get(record.account_id) : undefined;
        if (!acc?.aux_project) return '—';
        return (
          <Select
            size="medium"
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={projectOptions}
            value={record.project_id}
            allowClear
            onChange={(v, opt) => {
              const label = Array.isArray(opt) ? undefined : (opt as any)?.label;
              setLines((prev) =>
                prev.map((l, i) =>
                  i === index
                    ? {
                        ...l,
                        project_id: v ? Number(v) : undefined,
                        project_name: label ? String(label) : undefined,
                      }
                    : l,
                ),
              );
            }}
          />
        );
      },
    },
    {
      title: t(`${NS}.line.cashFlow`, { defaultValue: '现金流量' }),
      dataIndex: 'cash_flow_item_id',
      width: 160,
      render: (_: unknown, record: DraftLine, index: number) => {
        const acc = record.account_id ? accountById.get(record.account_id) : undefined;
        if (!acc?.is_cash_journal && !acc?.is_bank_journal) return '—';
        return (
          <Select
            size="medium"
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={cashFlowOptions}
            value={record.cash_flow_item_id}
            allowClear
            onChange={(v) => {
              setLines((prev) =>
                prev.map((l, i) =>
                  i === index ? { ...l, cash_flow_item_id: v ? Number(v) : undefined } : l,
                ),
              );
            }}
          />
        );
      },
    },
    {
      title: t(`${NS}.line.debit`, { defaultValue: '借方' }),
      dataIndex: 'debit_amount',
      width: 120,
      render: (_: unknown, record: DraftLine, index: number) => (
        <InputNumber
          size="medium"
          min={0}
          precision={amountDecimals}
          style={{ width: '100%' }}
          value={record.debit_amount}
          onChange={(v) => {
            setLines((prev) =>
              prev.map((l, i) =>
                i === index ? { ...l, debit_amount: Number(v || 0), credit_amount: 0 } : l,
              ),
            );
          }}
        />
      ),
    },
    {
      title: t(`${NS}.line.credit`, { defaultValue: '贷方' }),
      dataIndex: 'credit_amount',
      width: 120,
      render: (_: unknown, record: DraftLine, index: number) => (
        <InputNumber
          size="medium"
          min={0}
          precision={amountDecimals}
          style={{ width: '100%' }}
          value={record.credit_amount}
          onChange={(v) => {
            setLines((prev) =>
              prev.map((l, i) =>
                i === index ? { ...l, credit_amount: Number(v || 0), debit_amount: 0 } : l,
              ),
            );
          }}
        />
      ),
    },
    {
      title: t('common.actions', { defaultValue: '操作' }),
      key: 'op',
      width: 70,
      render: (_: unknown, __: DraftLine, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={lines.length <= 2}
          onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
        />
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<GlVoucher>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.voucher)}
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.gl-management.vouchers.list-v3"
        columns={columns}
        showAdvancedSearch
        skipFuzzyPinyinClientFilter
        request={async (params) => {
          try {
            const pageSize = params.pageSize ?? 20;
            const current = params.current ?? 1;
            const skip = (current - 1) * pageSize;
            const res = await glService.listVouchers({
              skip,
              limit: pageSize,
              status: params.status || undefined,
              keyword: params.keyword || undefined,
            });
            const data = asList<GlVoucher>(res);
            const total = data.length < pageSize ? skip + data.length : skip + data.length + 1;
            return { data, success: true, total };
          } catch (error) {
            messageApi.error(
              getApiErrorMessage(error, t('common.loadFailed', { defaultValue: '加载失败' })),
            );
            return { data: [], success: false, total: 0 };
          }
        }}
        showCreateButton
        createButtonText={t(`${NS}.create`, { defaultValue: '填制凭证' })}
        onCreate={openCreate}
        toolBarActionsAfterCreate={[
          <Button
            key="gen"
            icon={<ThunderboltOutlined />}
            loading={genLoading}
            onClick={() => void handleGenerate()}
          >
            {t(`${NS}.generateFromEvents`, { defaultValue: '从业务事件生成' })}
          </Button>,
        ]}
        showImportButton={false}
        showExportButton
        onExport={async (type, keys, pageData) => {
          try {
            let rows: GlVoucher[] =
              type === 'currentPage' && pageData?.length
                ? pageData
                : asList<GlVoucher>(await glService.listVouchers({ limit: 5000 }));
            if (type === 'selected' && keys?.length) {
              rows = rows.filter((r) => r.id != null && keys.includes(r.id));
            }
            if (rows.length === 0) {
              messageApi.warning(t('common.exportNoData', { defaultValue: '没有可导出的数据' }));
              return;
            }
            const header =
              'voucher_code,voucher_date,status,summary,debit_accounts,credit_accounts,total_debit,total_credit\n';
            const body = rows
              .map(
                (r) =>
                  `${r.voucher_code},${r.voucher_date},${r.status},"${String(r.summary || '').replace(/"/g, '""')}","${String(r.debit_accounts || '').replace(/"/g, '""')}","${String(r.credit_accounts || '').replace(/"/g, '""')}",${r.total_debit},${r.total_credit}`,
              )
              .join('\n');
            const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'vouchers.csv';
            a.click();
            URL.revokeObjectURL(url);
            messageApi.success(
              t('common.exportCountSuccess', {
                defaultValue: '已导出 {{count}} 条',
                count: rows.length,
              }),
            );
          } catch (error) {
            messageApi.error(
              getApiErrorMessage(error, t('common.exportFailed', { defaultValue: '导出失败' })),
            );
          }
        }}
      />

      <FormModalTemplate
        title={
          editing
            ? t(`${NS}.editTitle`, { defaultValue: '编辑凭证' })
            : t(`${NS}.createTitle`, { defaultValue: '填制凭证' })
        }
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        isEdit={Boolean(editing)}
        width={MODAL_CONFIG.EXTRA_LARGE_WIDTH}
        formRef={formRef}
        initialValues={
          editing
            ? {
                voucher_word: editing.voucher_word || '记',
                voucher_date: editing.voucher_date ? dayjs(editing.voucher_date) : dayjs(),
                summary: editing.summary,
              }
            : { voucher_date: dayjs(), voucher_word: '记' }
        }
        onFinish={handleSave}
      >
        {enableVoucherWords ? (
          <ProFormSelect
            name="voucher_word"
            label={t(`${NS}.field.voucherWord`, { defaultValue: '凭证字' })}
            options={[
              { label: '记', value: '记' },
              { label: '收', value: '收' },
              { label: '付', value: '付' },
              { label: '转', value: '转' },
            ]}
            rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          />
        ) : null}
        <ProFormDatePicker
          name="voucher_date"
          label={t(`${NS}.field.date`, { defaultValue: '凭证日期' })}
          rules={[{ required: true, message: t('common.required', { defaultValue: '必填' }) }]}
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormTextArea
          name="summary"
          label={t(`${NS}.field.summary`, { defaultValue: '摘要' })}
          fieldProps={{ rows: 2 }}
        />
        <div style={{ marginBottom: 8 }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Text strong>
              {t(`${NS}.lines`, { defaultValue: '分录' })}
            </Typography.Text>
            <Button size="medium" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
              {t(`${NS}.addLine`, { defaultValue: '增行' })}
            </Button>
          </Space>
        </div>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          columns={lineColumns}
          dataSource={lines}
          scroll={{ x: 800 }}
          footer={() => (
            <Space>
              <Typography.Text>
                {t(`${NS}.totalDebit`, { defaultValue: '借方合计' })}:{' '}
                {lineTotalDebit.toFixed(2)}
              </Typography.Text>
              <Typography.Text>
                {t(`${NS}.totalCredit`, { defaultValue: '贷方合计' })}:{' '}
                {lineTotalCredit.toFixed(2)}
              </Typography.Text>
            </Space>
          )}
        />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default GlVouchersPage;
