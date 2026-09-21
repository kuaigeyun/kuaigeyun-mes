/**
 * 实验委托列表（R-02）
 * 路由 /apps/kuaiplm/lab-requests ；待检看板 /lab-board
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Col,
  Form as AntForm,
  Input,
  InputNumber,
  Modal,
  Result,
  Row,
  Select,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../components/uni-table';
import { UniTableDetail } from '../../../../components/uni-table-detail';
import { rowActionKind } from '../../../../components/uni-action';
import {
  DetailDrawerTemplate,
  FormModalTemplate,
  ListPageTemplate,
  MODAL_CONFIG,
  detailDrawerBasicColumn,
} from '../../../../components/layout-templates';
import { detailDrawerDescriptionItems } from '../../../../components/layout-templates/detailDrawerDescriptionItems';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { formatDateTimeBySiteSetting } from '../../../../utils/format';
import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../utils/exportRecordsXlsx';
import { fetchAllListItems } from '../../../../utils/fetchAllListPages';
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../constants/statusBadges';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import {
  buildLabRequestExtensionPayload,
  flattenLabRequestForForm,
  getLabRequestExtensionValue,
} from '../../utils/labRequestExtension';
import {
  labRequestApi,
  type LabRequest,
  type LabRequestBusinessType,
  type LabRequestMeasureItem,
  type LabRequestStatus,
} from '../../services/lab-request';
import {
  labJudgmentRuleApi,
  type LabJudgmentRuleOption,
} from '../../services/lab-judgment-rule';

const RESOURCE = 'kuaiplm:lab-request';
const STATUS_KEYS: LabRequestStatus[] = [
  'draft',
  'pending',
  'in_lab',
  'completed',
  'rejected',
  'revoked',
];
const TYPE_KEYS: LabRequestBusinessType[] = [
  'iqc',
  'rd',
  'project_material',
  'project_product',
  'outsource',
  'general',
];
const COMPARE_OPTIONS = [
  { value: 'range', labelKey: 'range' },
  { value: 'eq', labelKey: 'eq' },
  { value: 'gte', labelKey: 'gte' },
  { value: 'lte', labelKey: 'lte' },
  { value: 'na', labelKey: 'na' },
] as const;

const EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'code', title: '委托单号' },
  { key: 'title', title: '试验名称' },
  { key: 'business_type_label', title: '类型' },
  { key: 'priority_label', title: '优先级' },
  { key: 'status_label', title: '状态' },
  { key: 'project_code', title: '项目代号' },
  { key: 'material_code', title: '物料编码' },
  { key: 'requester_name', title: '委托人' },
  { key: 'judgment', title: '判定' },
  { key: 'has_ng', title: '不合格' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const LabRequestsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const location = useLocation();
  const isBoard = location.pathname.includes('/lab-board');
  const perms = useResourcePermissions(RESOURCE);
  const canExecute = !!perms.canAction?.('execute');
  const canComplete = !!perms.canAction?.('complete');
  const canApprove = !!perms.canAction?.('approve');
  const canReject = !!perms.canAction?.('reject');
  const canSubmit = !!perms.canAction?.('submit');
  const canRevoke = !!perms.canAction?.('revoke');

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<LabRequest[]>([]);
  const formRef = useRef<ProFormInstance | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LabRequest | null>(null);
  const [detail, setDetail] = useState<LabRequest | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<LabRequest | null>(null);
  const [completeSummary, setCompleteSummary] = useState('');
  const [completeJudgment, setCompleteJudgment] = useState('pass');
  const [measureDraft, setMeasureDraft] = useState<Record<number, string>>({});
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideItem, setOverrideItem] = useState<LabRequestMeasureItem | null>(null);
  const [overrideJudgment, setOverrideJudgment] = useState('ng');
  const [overrideReason, setOverrideReason] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [reportSummary, setReportSummary] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceValue, setPriceValue] = useState<number | null>(null);
  const [ruleOptions, setRuleOptions] = useState<LabJudgmentRuleOption[]>([]);

  useEffect(() => {
    if (!modalOpen) return;
    void labJudgmentRuleApi
      .options({ limit: 200 })
      .then(setRuleOptions)
      .catch((error) => {
        messageApi.error(getApiErrorMessage(error));
        setRuleOptions([]);
      });
  }, [modalOpen, messageApi]);

  const typeLabel = useCallback(
    (v?: string) => t(`app.kuaiplm.labRequest.type.${v || 'general'}`),
    [t],
  );
  const statusLabel = useCallback(
    (v?: string) => t(`app.kuaiplm.labRequest.status.${v || 'draft'}`),
    [t],
  );
  const judgmentLabel = useCallback(
    (v?: string | null) =>
      v ? t(`app.kuaiplm.labRequest.judgment.${v}`, { defaultValue: v }) : '-',
    [t],
  );
  const reportStatusLabel = useCallback(
    (v?: string | null) =>
      t(`app.kuaiplm.labRequest.reportStatus.${v || 'none'}`, { defaultValue: v || '-' }),
    [t],
  );

  const openDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const row = await labRequestApi.get(id);
      setDetail(row);
      const draft: Record<number, string> = {};
      (row.measure_items || []).forEach((item) => {
        if (item.id != null) draft[item.id] = item.measured_value || '';
      });
      setMeasureDraft(draft);
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openEdit = useCallback(async (row: LabRequest) => {
    if (row.id == null) return;
    try {
      const full = await labRequestApi.get(row.id);
      setEditing(full);
      setModalOpen(true);
    } catch (e) {
      messageApi.error(getApiErrorMessage(e));
    }
  }, [messageApi]);

  const planColumns = useMemo<ColumnsType>(
    () => [
      {
        title: t('app.kuaiplm.labRequest.measure.judgmentRule'),
        dataIndex: 'judgment_rule_id',
        width: 200,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'judgment_rule_id']} style={{ marginBottom: 0 }}>
            <Select
              allowClear
              size="small"
              showSearch
              optionFilterProp="label"
              placeholder={t('app.kuaiplm.labRequest.measure.judgmentRulePlaceholder')}
              options={ruleOptions.map((o) => ({ value: o.id, label: o.label }))}
              style={{ width: '100%' }}
              onChange={(ruleId) => {
                if (ruleId == null) {
                  formRef.current?.setFieldValue(['measure_items', index, 'judgment_rule_id'], undefined);
                  return;
                }
                const opt = ruleOptions.find((o) => o.id === ruleId);
                if (!opt || !formRef.current) return;
                const base = ['measure_items', index] as const;
                formRef.current.setFieldValue([...base, 'judgment_rule_id'], opt.id);
                formRef.current.setFieldValue(
                  [...base, 'item_name'],
                  opt.item_name || opt.rule_name,
                );
                formRef.current.setFieldValue([...base, 'item_code'], opt.rule_code);
                formRef.current.setFieldValue(
                  [...base, 'compare_type'],
                  opt.compare_type || 'range',
                );
                formRef.current.setFieldValue(
                  [...base, 'standard_min'],
                  opt.standard_min || undefined,
                );
                formRef.current.setFieldValue(
                  [...base, 'standard_max'],
                  opt.standard_max || undefined,
                );
                formRef.current.setFieldValue(
                  [...base, 'standard_value'],
                  opt.standard_value || undefined,
                );
                formRef.current.setFieldValue([...base, 'unit'], opt.unit || undefined);
              }}
            />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.itemName'),
        dataIndex: 'item_name',
        width: 160,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'item_name']}
            rules={[{ required: true, message: t('common.required') }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.itemCode'),
        dataIndex: 'item_code',
        width: 110,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'item_code']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.compareType'),
        dataIndex: 'compare_type',
        width: 110,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'compare_type']} style={{ marginBottom: 0 }} initialValue="range">
            <Select
              size="small"
              options={COMPARE_OPTIONS.map((o) => ({
                value: o.value,
                label: t(`app.kuaiplm.labRequest.compare.${o.labelKey}`),
              }))}
              style={{ width: '100%' }}
            />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.standardMin'),
        dataIndex: 'standard_min',
        width: 90,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'standard_min']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.standardMax'),
        dataIndex: 'standard_max',
        width: 90,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'standard_max']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.standardValue'),
        dataIndex: 'standard_value',
        width: 90,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'standard_value']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
      {
        title: t('app.kuaiplm.labRequest.measure.unit'),
        dataIndex: 'unit',
        width: 70,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'unit']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
    ],
    [t, ruleOptions],
  );

  const columns = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaiplm.labRequest.fields.code'),
            dataIndex: 'code',
            key: 'code',
            copyable: true,
            width: 160,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.title'),
            dataIndex: 'title',
            key: 'title',
            width: 200,
            ellipsis: true,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.businessType'),
            dataIndex: 'business_type',
            key: 'business_type',
            width: 120,
            valueEnum: Object.fromEntries(TYPE_KEYS.map((k) => [k, { text: typeLabel(k) }])),
            render: (_, row) => (
              <MarkerTag variant="filled">{typeLabel(row.business_type)}</MarkerTag>
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.priority'),
            dataIndex: 'priority',
            key: 'priority',
            width: 90,
            hideInSearch: !isBoard,
            render: (_, row) => (
              <MarkerTag variant="filled">
                {t(`app.kuaiplm.labRequest.priority.${row.priority || 'normal'}`)}
              </MarkerTag>
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.ngFlag'),
            dataIndex: 'has_ng',
            key: 'has_ng',
            width: 88,
            hideInSearch: true,
            render: (_, row) =>
              row.has_ng ? (
                <MarkerTag variant="filled">{t('app.kuaiplm.labRequest.fields.ngYes')}</MarkerTag>
              ) : (
                '-'
              ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.reportStatus'),
            dataIndex: 'report_status',
            key: 'report_status',
            width: 100,
            hideInSearch: true,
            render: (_, row) => (
              <MarkerTag variant="filled">{reportStatusLabel(row.report_status)}</MarkerTag>
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.projectCode'),
            dataIndex: 'project_code',
            key: 'project_code',
            width: 120,
            hideInSearch: true,
          },
          {
            title: t('app.kuaiplm.labRequest.fields.materialCode'),
            dataIndex: 'material_code',
            key: 'material_code',
            width: 140,
            hideInSearch: true,
          },
          ...buildDocumentAuditColumns(t),
          {
            title: t('common.status'),
            key: 'lifecycle',
            dataIndex: 'status',
            fixed: 'right',
            valueEnum: Object.fromEntries(STATUS_KEYS.map((k) => [k, { text: statusLabel(k) }])),
            hideInSearch: isBoard,
            render: (_, row) =>
              renderDocumentStatusTag(statusLabel(row.status), row.status || 'draft'),
          },
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              <Button
                key="detail"
                {...rowActionKind('read')}
                onClick={() => row.id != null && void openDetail(row.id)}
              />,
              perms.canUpdate && (row.status === 'draft' || row.status === 'rejected') ? (
                <Button
                  key="edit"
                  {...rowActionKind('update')}
                  onClick={() => void openEdit(row)}
                />
              ) : null,
              canSubmit && (row.status === 'draft' || row.status === 'rejected') ? (
                <Button
                  key="submit"
                  {...rowActionKind('submit')}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.submit(row.id);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.submitSuccess'));
                    actionRef.current?.reload();
                  }}
                />
              ) : null,
              canExecute && row.status === 'pending' ? (
                <Button
                  key="accept"
                  {...rowActionKind('execute')}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.accept(row.id);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.acceptSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  {t('app.kuaiplm.labRequest.actions.accept')}
                </Button>
              ) : null,
              canComplete && row.status === 'in_lab' ? (
                <Button
                  key="complete"
                  {...rowActionKind('complete')}
                  onClick={() => {
                    setCompleteTarget(row);
                    setCompleteSummary(row.result_summary || '');
                    setCompleteJudgment(row.judgment || 'pass');
                    setCompleteOpen(true);
                  }}
                />
              ) : null,
              canReject && (row.status === 'pending' || row.status === 'in_lab') ? (
                <Button
                  key="reject"
                  {...rowActionKind('reject')}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.reject(row.id);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.rejectSuccess'));
                    actionRef.current?.reload();
                  }}
                />
              ) : null,
              canRevoke && row.status !== 'completed' && row.status !== 'revoked' ? (
                <Button
                  key="revoke"
                  {...rowActionKind('revoke')}
                  onClick={async () => {
                    if (row.id == null) return;
                    const reason = window.prompt(t('app.kuaiplm.labRequest.messages.revokeReason'));
                    if (!reason?.trim()) return;
                    await labRequestApi.revoke(row.id, reason.trim());
                    messageApi.success(t('app.kuaiplm.labRequest.messages.revokeSuccess'));
                    actionRef.current?.reload();
                  }}
                />
              ) : null,
              perms.canDelete &&
              (row.status === 'draft' || row.status === 'rejected' || row.status === 'revoked') ? (
                <Button
                  key="delete"
                  {...rowActionKind('delete')}
                  onClick={async () => {
                    if (row.id == null) return;
                    await labRequestApi.delete(row.id);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                />
              ) : null,
            ],
          },
        ] as ProColumns<LabRequest>[],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [
      canComplete,
      canExecute,
      canReject,
      canRevoke,
      canSubmit,
      isBoard,
      messageApi,
      openDetail,
      openEdit,
      perms.canDelete,
      perms.canUpdate,
      reportStatusLabel,
      statusLabel,
      t,
      typeLabel,
    ],
  );

  const detailItems = useMemo(() => {
    if (!detail) return [];
    return alignDescriptionColumns(
      [
        { key: 'code', label: t('app.kuaiplm.labRequest.fields.code'), children: detail.code },
        { key: 'title', label: t('app.kuaiplm.labRequest.fields.title'), children: detail.title },
        {
          key: 'business_type',
          label: t('app.kuaiplm.labRequest.fields.businessType'),
          children: typeLabel(detail.business_type),
        },
        {
          key: 'status',
          label: t('common.status'),
          children: statusLabel(detail.status),
        },
        {
          key: 'judgment',
          label: t('app.kuaiplm.labRequest.fields.judgment'),
          children: judgmentLabel(detail.judgment),
        },
        {
          key: 'report_status',
          label: t('app.kuaiplm.labRequest.fields.reportStatus'),
          children: reportStatusLabel(detail.report_status),
        },
        {
          key: 'report_title',
          label: t('app.kuaiplm.labRequest.fields.reportTitle'),
          children: detail.report_title || '-',
        },
        {
          key: 'report_url',
          label: t('app.kuaiplm.labRequest.fields.reportUrl'),
          children: detail.report_url || '-',
        },
        {
          key: 'project_code',
          label: t('app.kuaiplm.labRequest.fields.projectCode'),
          children: detail.project_code || '-',
        },
        {
          key: 'material_code',
          label: t('app.kuaiplm.labRequest.fields.materialCode'),
          children: detail.material_code || '-',
        },
        {
          key: 'delegate_dept',
          label: t('app.kuaiplm.labRequest.fields.delegateDept'),
          children: String(getLabRequestExtensionValue(detail, 'delegate_dept') || '-'),
        },
        {
          key: 'test_dept',
          label: t('app.kuaiplm.labRequest.fields.testDept'),
          children: String(getLabRequestExtensionValue(detail, 'test_dept') || '-'),
        },
        {
          key: 'inspection_slip_no',
          label: t('app.kuaiplm.labRequest.fields.inspectionSlipNo'),
          children: String(getLabRequestExtensionValue(detail, 'inspection_slip_no') || '-'),
        },
        {
          key: 'sample_desc',
          label: t('app.kuaiplm.labRequest.fields.sampleDesc'),
          children: detail.sample_desc || '-',
        },
        {
          key: 'test_items',
          label: t('app.kuaiplm.labRequest.fields.testItems'),
          children: detail.test_items || '-',
        },
        {
          key: 'test_reason',
          label: t('app.kuaiplm.labRequest.fields.testReason'),
          children: detail.test_reason || '-',
        },
        ...(detail.business_type === 'outsource'
          ? ([
              {
                key: 'outsource_price',
                label: t('app.kuaiplm.labRequest.fields.outsourcePrice'),
                children:
                  detail.outsource_price != null && detail.outsource_price !== ''
                    ? String(detail.outsource_price)
                    : '-',
              },
              {
                key: 'price_filled_by_name',
                label: t('app.kuaiplm.labRequest.fields.priceFilledBy'),
                children: detail.price_filled_by_name || '-',
              },
            ] as ProDescriptionsItemProps[])
          : []),
        {
          key: 'result_summary',
          label: t('app.kuaiplm.labRequest.fields.resultSummary'),
          children: detail.result_summary || '-',
        },
        {
          key: 'expected_complete_at',
          label: t('app.kuaiplm.labRequest.fields.expectedCompleteAt'),
          children: formatDateTimeBySiteSetting(detail.expected_complete_at) || '-',
        },
        {
          key: 'remarks',
          label: t('common.remark'),
          children: detail.remarks || '-',
        },
      ] as ProDescriptionsItemProps[],
      GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
    );
  }, [detail, judgmentLabel, reportStatusLabel, statusLabel, t, typeLabel]);

  const measureTableColumns: ColumnsType<LabRequestMeasureItem> = [
    {
      title: t('app.kuaiplm.labRequest.measure.itemName'),
      dataIndex: 'item_name',
      width: 140,
    },
    {
      title: t('app.kuaiplm.labRequest.measure.standard'),
      key: 'standard',
      width: 140,
      render: (_, row) => {
        if (row.compare_type === 'eq') return row.standard_value || '-';
        const lo = row.standard_min ?? '';
        const hi = row.standard_max ?? '';
        return `${lo} ~ ${hi}${row.unit ? ` ${row.unit}` : ''}`;
      },
    },
    {
      title: t('app.kuaiplm.labRequest.measure.measuredValue'),
      dataIndex: 'measured_value',
      width: 120,
      render: (_, row) =>
        detail?.status === 'in_lab' && canExecute && row.id != null ? (
          <Input
            size="small"
            value={measureDraft[row.id] ?? ''}
            onChange={(e) =>
              setMeasureDraft((prev) => ({ ...prev, [row.id!]: e.target.value }))
            }
          />
        ) : (
          row.measured_value || '-'
        ),
    },
    {
      title: t('app.kuaiplm.labRequest.measure.autoJudgment'),
      dataIndex: 'auto_judgment',
      width: 90,
      render: (v) => judgmentLabel(v as string),
    },
    {
      title: t('app.kuaiplm.labRequest.measure.finalJudgment'),
      dataIndex: 'final_judgment',
      width: 90,
      render: (v, row) => judgmentLabel((v as string) || (row.auto_judgment as string)),
    },
    {
      title: t('app.kuaiplm.labRequest.measure.ruleVersion'),
      dataIndex: 'rule_version',
      width: 160,
      ellipsis: true,
      render: (v) => (v as string) || '-',
    },
    {
      title: t('common.actions'),
      key: 'op',
      width: 180,
      render: (_, row) => {
        const fj = (row.final_judgment || row.auto_judgment || '').toLowerCase();
        const canLinkNg =
          canExecute &&
          detail?.status &&
          ['in_lab', 'completed'].includes(detail.status) &&
          row.id != null &&
          (fj === 'ng' || fj === 'fail') &&
          !row.quality_exception_id;
        return (
          <>
            {canExecute &&
            detail?.status &&
            ['in_lab', 'completed'].includes(detail.status) &&
            row.id != null ? (
              <Button
                type="link"
                size="small"
                onClick={() => {
                  setOverrideItem(row);
                  setOverrideJudgment(row.manual_judgment || row.final_judgment || 'ng');
                  setOverrideReason(row.manual_reason || '');
                  setOverrideOpen(true);
                }}
              >
                {t('app.kuaiplm.labRequest.actions.override')}
              </Button>
            ) : null}
            {canLinkNg ? (
              <Button
                type="link"
                size="small"
                onClick={async () => {
                  if (detail?.id == null || row.id == null) return;
                  try {
                    const updated = await labRequestApi.linkNgException(detail.id, row.id);
                    setDetail(updated);
                    messageApi.success(t('app.kuaiplm.labRequest.messages.exceptionLinked'));
                    actionRef.current?.reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              >
                {t('app.kuaiplm.labRequest.actions.linkException')}
              </Button>
            ) : null}
            {row.quality_exception_id ? (
              <MarkerTag variant="filled">
                {t('app.kuaiplm.labRequest.measure.exceptionLinked')}
              </MarkerTag>
            ) : null}
          </>
        );
      },
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<LabRequest>
        actionRef={actionRef}
        headerTitle={
          isBoard ? t('app.kuaiplm.menu.lab-board') : t('app.kuaiplm.menu.lab-requests')
        }
        permissionResource={RESOURCE}
        columnPersistenceId={
          isBoard ? 'apps.kuaiplm.pages.lab-board-v3' : 'apps.kuaiplm.pages.lab-requests-v3'
        }
        rowKey="id"
        columns={columns}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        showCreateButton={!isBoard}
        createButtonText={t('app.kuaiplm.labRequest.createButton')}
        onCreate={() => {
          setEditing(null);
          setModalOpen(true);
        }}
        showExportButton={!!perms.canExport}
        onExport={async () => {
          const items = await fetchAllListItems<LabRequest>(async ({ skip, limit }) => {
            const res = await labRequestApi.list({
              skip,
              limit,
              board: isBoard || undefined,
            });
            return { items: res.items, total: res.total };
          });
          const rows = items.map((r) => ({
            ...r,
            business_type_label: typeLabel(r.business_type),
            priority_label: t(`app.kuaiplm.labRequest.priority.${r.priority || 'normal'}`),
            status_label: statusLabel(r.status),
            has_ng: r.has_ng ? '是' : '否',
          }));
          downloadRecordsAsXlsx(
            isBoard ? 'lab-board' : 'lab-requests',
            EXPORT_COLUMNS,
            rows as Record<string, unknown>[],
          );
        }}
        request={async (params) => {
          const res = await labRequestApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            keyword: params.keyword,
            status: params.status,
            business_type: params.business_type,
            priority: params.priority,
            board: isBoard || undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
      />

      <FormModalTemplate
        key={editing?.id ?? 'create'}
        title={
          editing
            ? t('app.kuaiplm.labRequest.editTitle')
            : t('app.kuaiplm.labRequest.createTitle')
        }
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        formRef={formRef}
        grid={false}
        width={MODAL_CONFIG.LARGE_WIDTH}
        modalProps={{ destroyOnHidden: true }}
        initialValues={
          editing
            ? {
                ...flattenLabRequestForForm(editing),
                measure_items: (editing.measure_items || []).map((m, idx) => ({
                  line_no: m.line_no || idx + 1,
                  item_code: m.item_code,
                  item_name: m.item_name,
                  unit: m.unit,
                  compare_type: m.compare_type || 'range',
                  standard_min: m.standard_min,
                  standard_max: m.standard_max,
                  standard_value: m.standard_value,
                  judgment_rule_id: m.judgment_rule_id,
                })),
              }
            : {
                business_type: 'general',
                priority: 'normal',
                measure_items: [],
              }
        }
        onFinish={async (values) => {
          try {
            const extension_payload = buildLabRequestExtensionPayload(values);
            const {
              delegate_dept: _dd,
              test_dept: _td,
              inspection_slip_no: _is,
              ...rest
            } = values;
            const payload = {
              ...rest,
              extension_payload,
              measure_items: (values.measure_items || []).map(
                (row: Record<string, unknown>, idx: number) => ({
                  line_no: idx + 1,
                  item_code: row.item_code,
                  item_name: row.item_name,
                  unit: row.unit,
                  compare_type: row.compare_type || 'range',
                  standard_min: row.standard_min,
                  standard_max: row.standard_max,
                  standard_value: row.standard_value,
                  judgment_rule_id: row.judgment_rule_id ?? null,
                }),
              ),
            };
            if (editing?.id != null) {
              await labRequestApi.update(editing.id, payload);
            } else {
              await labRequestApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
            return false;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.labRequest.fields.title')}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="business_type"
              label={t('app.kuaiplm.labRequest.fields.businessType')}
              options={TYPE_KEYS.map((k) => ({ value: k, label: typeLabel(k) }))}
              rules={[{ required: true }]}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="priority"
              label={t('app.kuaiplm.labRequest.fields.priority')}
              options={[
                { value: 'normal', label: t('app.kuaiplm.labRequest.priority.normal') },
                { value: 'urgent', label: t('app.kuaiplm.labRequest.priority.urgent') },
              ]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="project_code"
              label={t('app.kuaiplm.labRequest.fields.projectCode')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="material_code"
              label={t('app.kuaiplm.labRequest.fields.materialCode')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="material_name"
              label={t('app.kuaiplm.labRequest.fields.materialName')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="requester_name"
              label={t('app.kuaiplm.labRequest.fields.requesterName')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="delegate_dept"
              label={t('app.kuaiplm.labRequest.fields.delegateDept')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="test_dept"
              label={t('app.kuaiplm.labRequest.fields.testDept')}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="inspection_slip_no"
              label={t('app.kuaiplm.labRequest.fields.inspectionSlipNo')}
            />
          </Col>
          <Col span={12}>
            <ProFormTextArea
              name="sample_desc"
              label={t('app.kuaiplm.labRequest.fields.sampleDesc')}
              fieldProps={{ rows: 1 }}
            />
          </Col>
          <Col span={12}>
            <ProFormTextArea
              name="test_items"
              label={t('app.kuaiplm.labRequest.fields.testItems')}
              fieldProps={{ rows: 1 }}
            />
          </Col>
          <Col span={12}>
            <ProFormTextArea
              name="test_reason"
              label={t('app.kuaiplm.labRequest.fields.testReason')}
              fieldProps={{ rows: 1 }}
            />
          </Col>
          <Col span={12}>
            <ProFormTextArea
              name="structure_special_test"
              label={t('app.kuaiplm.labRequest.fields.structureSpecialTest')}
              fieldProps={{ rows: 2 }}
            />
          </Col>
          <Col span={12}>
            <ProFormTextArea
              name="electronics_special_test"
              label={t('app.kuaiplm.labRequest.fields.electronicsSpecialTest')}
              fieldProps={{ rows: 2 }}
            />
          </Col>
        </Row>
        <UniTableDetail
          name="measure_items"
          title={t('app.kuaiplm.labRequest.measure.sectionTitle')}
          required={false}
          columns={planColumns}
          addText={t('app.kuaiplm.labRequest.measure.addItem')}
          initialValue={{
            item_name: '',
            compare_type: 'range',
          }}
          tableProps={{ size: 'small', style: { width: '100%', margin: 0 } }}
        />
        <Row gutter={16}>
          <Col span={24}>
            <ProFormTextArea
              name="remarks"
              label={t('common.remark')}
              fieldProps={{ rows: 2 }}
            />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={!!detail || detailLoading || !!detailError}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.code || t('app.kuaiplm.menu.lab-requests')}
        loading={detailLoading}
        basic={
          detailError ? (
            <Result
              status="error"
              title={detailError}
              extra={
                <Button onClick={() => detail?.id != null && void openDetail(detail.id)}>
                  {t('common.retry')}
                </Button>
              }
            />
          ) : detail ? (
            detailDrawerDescriptionItems({
              items: detailItems,
              column: detailDrawerBasicColumn(false),
            })
          ) : null
        }
        lines={
          detail && !detailError ? (
            <>
              {detail.status === 'in_lab' && canExecute ? (
                <div style={{ marginBottom: 8, textAlign: 'right' }}>
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (detail.id == null) return;
                      try {
                        const items = (detail.measure_items || [])
                          .filter((m) => m.id != null)
                          .map((m) => ({
                            id: m.id!,
                            measured_value: measureDraft[m.id!] ?? m.measured_value ?? '',
                          }));
                        const updated = await labRequestApi.saveMeasures(detail.id, items);
                        setDetail(updated);
                        messageApi.success(t('app.kuaiplm.labRequest.messages.measureSaved'));
                        actionRef.current?.reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.saveMeasures')}
                  </Button>
                </div>
              ) : null}
              <Table
                size="small"
                rowKey={(r) => String(r.id ?? r.line_no)}
                pagination={false}
                dataSource={detail.measure_items || []}
                columns={measureTableColumns}
                locale={{ emptyText: t('app.kuaiplm.labRequest.measure.empty') }}
                style={{ width: '100%', margin: 0 }}
              />
            </>
          ) : null
        }
        supplementary={
          detail && !detailError ? (
            <div>
              <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {detail.business_type === 'outsource' &&
                detail.status === 'pending' &&
                perms.canUpdate &&
                (detail.outsource_price == null || detail.outsource_price === '') ? (
                  <Button
                    type="primary"
                    onClick={() => {
                      setPriceValue(null);
                      setPriceOpen(true);
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.fillOutsourcePrice')}
                  </Button>
                ) : null}
                {(detail.status === 'in_lab' || detail.status === 'completed') &&
                canExecute &&
                detail.report_status !== 'pending' &&
                detail.report_status !== 'approved' ? (
                  <Button
                    onClick={() => {
                      setReportTitle(detail.report_title || '');
                      setReportSummary(detail.result_summary || '');
                      setReportUrl(detail.report_url || '');
                      setReportOpen(true);
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.editReport')}
                  </Button>
                ) : null}
                {(detail.status === 'in_lab' || detail.status === 'completed') &&
                canSubmit &&
                detail.report_status !== 'pending' &&
                detail.report_status !== 'approved' ? (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (detail.id == null) return;
                      try {
                        const updated = await labRequestApi.submitReport(detail.id, {
                          report_title: detail.report_title || undefined,
                          result_summary: detail.result_summary || undefined,
                          report_url: detail.report_url || undefined,
                          report_file_uuid: detail.report_file_uuid || undefined,
                        });
                        setDetail(updated);
                        messageApi.success(t('app.kuaiplm.labRequest.messages.reportSubmitted'));
                        actionRef.current?.reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.submitReport')}
                  </Button>
                ) : null}
                {canApprove && detail.report_status === 'pending' ? (
                  <Button
                    type="primary"
                    onClick={async () => {
                      if (detail.id == null) return;
                      try {
                        const updated = await labRequestApi.approveReport(detail.id);
                        setDetail(updated);
                        messageApi.success(t('app.kuaiplm.labRequest.messages.reportApproved'));
                        actionRef.current?.reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.approveReport')}
                  </Button>
                ) : null}
                {canReject && detail.report_status === 'pending' ? (
                  <Button
                    danger
                    onClick={async () => {
                      if (detail.id == null) return;
                      const reason = window.prompt(
                        t('app.kuaiplm.labRequest.messages.reportRejectReason'),
                      );
                      if (!reason?.trim()) return;
                      try {
                        const updated = await labRequestApi.rejectReport(
                          detail.id,
                          reason.trim(),
                        );
                        setDetail(updated);
                        messageApi.success(t('app.kuaiplm.labRequest.messages.reportRejected'));
                        actionRef.current?.reload();
                      } catch (e) {
                        messageApi.error(getApiErrorMessage(e));
                      }
                    }}
                  >
                    {t('app.kuaiplm.labRequest.actions.rejectReport')}
                  </Button>
                ) : null}
              </div>
              <div>
                {t('app.kuaiplm.labRequest.fields.reportStatus')}:{' '}
                {reportStatusLabel(detail.report_status)}
              </div>
              {detail.report_reject_reason ? (
                <div>
                  {t('app.kuaiplm.labRequest.fields.reportRejectReason')}:{' '}
                  {detail.report_reject_reason}
                </div>
              ) : null}
              {detail.report_approved_by_name ? (
                <div>
                  {t('app.kuaiplm.labRequest.fields.reportApprovedBy')}:{' '}
                  {detail.report_approved_by_name}
                </div>
              ) : null}
            </div>
          ) : null
        }
        supplementaryTitle={t('app.kuaiplm.labRequest.report.sectionTitle')}
      />

      <Modal
        title={t('app.kuaiplm.labRequest.actions.fillOutsourcePrice')}
        open={priceOpen}
        onCancel={() => setPriceOpen(false)}
        onOk={async () => {
          if (detail?.id == null || priceValue == null || priceValue <= 0) {
            messageApi.warning(t('app.kuaiplm.labRequest.messages.outsourcePriceRequired'));
            return;
          }
          try {
            const updated = await labRequestApi.fillOutsourcePrice(detail.id, priceValue);
            setDetail(updated);
            messageApi.success(t('common.saveSuccess'));
            setPriceOpen(false);
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
        destroyOnHidden
      >
        <div style={{ marginBottom: 8 }}>{t('app.kuaiplm.labRequest.fields.outsourcePrice')}</div>
        <InputNumber
          style={{ width: '100%' }}
          min={0.0001}
          precision={4}
          value={priceValue}
          onChange={(v) => setPriceValue(typeof v === 'number' ? v : null)}
        />
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.complete')}
        open={completeOpen}
        onCancel={() => setCompleteOpen(false)}
        onOk={async () => {
          if (completeTarget?.id == null) return;
          try {
            await labRequestApi.complete(completeTarget.id, {
              result_summary: completeSummary,
              judgment: completeJudgment,
            });
            messageApi.success(t('app.kuaiplm.labRequest.messages.completeSuccess'));
            setCompleteOpen(false);
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12 }}>
          <div>{t('app.kuaiplm.labRequest.fields.judgment')}</div>
          <Input
            value={completeJudgment}
            onChange={(e) => setCompleteJudgment(e.target.value)}
            placeholder="pass / fail / ng / na"
          />
        </div>
        <div>
          <div>{t('app.kuaiplm.labRequest.fields.resultSummary')}</div>
          <Input.TextArea
            rows={4}
            value={completeSummary}
            onChange={(e) => setCompleteSummary(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.override')}
        open={overrideOpen}
        onCancel={() => setOverrideOpen(false)}
        onOk={async () => {
          if (detail?.id == null || overrideItem?.id == null) return;
          if (!overrideReason.trim()) {
            messageApi.error(t('app.kuaiplm.labRequest.messages.overrideReasonRequired'));
            return;
          }
          try {
            const updated = await labRequestApi.overrideMeasure(detail.id, overrideItem.id, {
              judgment: overrideJudgment,
              reason: overrideReason.trim(),
            });
            setDetail(updated);
            setOverrideOpen(false);
            messageApi.success(t('app.kuaiplm.labRequest.messages.overrideSuccess'));
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12 }}>
          <div>{t('app.kuaiplm.labRequest.fields.judgment')}</div>
          <Input
            value={overrideJudgment}
            onChange={(e) => setOverrideJudgment(e.target.value)}
            placeholder="pass / fail / ng / na"
          />
        </div>
        <div>
          <div>{t('app.kuaiplm.labRequest.measure.manualReason')}</div>
          <Input.TextArea
            rows={3}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        title={t('app.kuaiplm.labRequest.actions.editReport')}
        open={reportOpen}
        onCancel={() => setReportOpen(false)}
        onOk={async () => {
          if (detail?.id == null) return;
          try {
            const updated = await labRequestApi.saveReport(detail.id, {
              report_title: reportTitle,
              result_summary: reportSummary,
              report_url: reportUrl,
            });
            setDetail(updated);
            setReportOpen(false);
            messageApi.success(t('app.kuaiplm.labRequest.messages.reportSaved'));
            actionRef.current?.reload();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12 }}>
          <div>{t('app.kuaiplm.labRequest.fields.reportTitle')}</div>
          <Input value={reportTitle} onChange={(e) => setReportTitle(e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div>{t('app.kuaiplm.labRequest.fields.reportUrl')}</div>
          <Input value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} />
        </div>
        <div>
          <div>{t('app.kuaiplm.labRequest.fields.resultSummary')}</div>
          <Input.TextArea
            rows={4}
            value={reportSummary}
            onChange={(e) => setReportSummary(e.target.value)}
          />
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default LabRequestsPage;
