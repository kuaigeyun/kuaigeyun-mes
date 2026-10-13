/**

 * 供应商评价与环保资料（R-03）

 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRequest } from 'ahooks';

import { useTranslation } from 'react-i18next';

import type { ActionType, ProColumns, ProDescriptionsItemProps, ProFormInstance } from '@ant-design/pro-components';

import {

  ProFormDatePicker,

  ProFormDependency,

  ProFormDigit,

  ProFormSelect,

  ProFormSwitch,

  ProFormText,

  ProFormTextArea,

  ProFormItem,

} from '@ant-design/pro-components';

import {
  App,
  Button,
  Card,
  Col,
  Form as AntForm,
  Input,
  InputNumber,
  Modal,
  Progress,
  Result,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
} from 'antd';

import type { ColumnsType } from 'antd/es/table';

import { UniTable } from '../../../../../components/uni-table';

import { UniTableStackedPrimaryCell } from '../../../../../components/uni-table/stackedPrimaryColumn';

import { UniTableDetail } from '../../../../../components/uni-table-detail';

import { rowActionKind } from '../../../../../components/uni-action';

import {

  DetailDrawerTemplate,

  DRAWER_CONFIG,

  FormModalTemplate,

  MODAL_CONFIG,

  MultiTabListPageTemplate,

  useDetailDrawerDescriptionItems,

} from '../../../../../components/layout-templates';

import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

import { getApiErrorMessage } from '../../../../../utils/errorHandler';

import {

  formatBusinessDateOnly,

  formatDateTimeBySiteSetting,

  todaySiteDateString,

} from '../../../../../utils/format';

import { downloadRecordsAsXlsx, type ExportXlsxColumn } from '../../../../../utils/exportRecordsXlsx';

import { fetchAllListItems } from '../../../../../utils/fetchAllListPages';

import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';

import { MarkerTag } from '../../../../../constants/statusBadges';

import {

  alignDescriptionColumns,

  alignProColumns,

  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,

  GLOBAL_DOC_LIST_FIELD_RANK,

} from '../../sales-management/shared/documentFieldAlignment';

import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';

import { useNewShortcut } from '../../../../../hooks/useNewShortcut';

import { SupplierSelectDropdown } from '../../../../master-data/components/SupplierSelectDropdown';

import { UniMaterialSelect } from '../../../../../components/uni-material-select';

import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import {
  resolveSupplierEvalEnvListParams,
  resolveSupplierEvalPlanListParams,
  resolveSupplierEvaluationListParams,
  resolveSupplierEvalTemplateListParams,
} from '../../../utils/supplierEvalListCore';

import {

  DEFAULT_GRADE_BANDS,
  supplierEvalEnvDocumentApi,
  supplierEvalPlanApi,
  supplierEvalSummaryApi,
  supplierEvalTemplateApi,
  supplierEvaluationApi,
  type SupplierEvalEnvDocument,
  type SupplierEvalPlan,
  type SupplierEvalPlanLine,
  type SupplierEvalPlanStatus,
  type SupplierEvalSummary,
  type SupplierEvalTemplate,
  type SupplierEvalTemplateClause,
  type SupplierEvaluation,
  type SupplierEvaluationLine,
  type SupplierEvaluationStatus,
} from '../../../services/supplier-evaluation';

import { fetchHostCapabilityData } from '../../../../../services/extensionHostCapabilities';

const RESOURCE = 'kuaizhizao:supplier-eval';

const P = 'app.kuaizhizao.supplierEval';

const EVAL_STATUS_KEYS: SupplierEvaluationStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'revoked',
];

const PLAN_STATUS_KEYS: SupplierEvalPlanStatus[] = ['draft', 'released', 'closed'];

const RECT_STATUS_KEYS = ['none', 'open', 'closed'] as const;

const PERIOD_TYPES = ['annual', 'quarterly'] as const;

const AUDIT_MODES = ['document', 'onsite'] as const;

const ENV_DOC_TYPES = ['rohs', 'reach', 'conflict_minerals', 'msds', 'other'] as const;

const EMPTY_CLAUSE: SupplierEvalTemplateClause = {
  clause_code: '',
  clause_name: '',
  weight: 1,
  max_score: 100,
};

const EMPTY_PLAN_LINE = { remarks: '' } as SupplierEvalPlanLine;

const EVAL_EXPORT_COLUMNS: ExportXlsxColumn[] = [

  { key: 'code', title: '评价单号' },

  { key: 'supplier_name', title: '供应商' },

  { key: 'template_name', title: '评价模板' },

  { key: 'period_type_label', title: '评价周期' },

  { key: 'period_year', title: '年度' },

  { key: 'period_quarter', title: '季度' },

  { key: 'score', title: '得分' },

  { key: 'grade', title: '等级' },

  { key: 'status_label', title: '状态' },

  { key: 'created_by_name', title: '创建人' },

  { key: 'updated_by_name', title: '更新人' },

];

function currentEvalYear(): number {

  const siteDate = todaySiteDateString();

  return Number(siteDate.slice(0, 4));

}

function canCloseRectification(row: SupplierEvaluation): boolean {

  return (

    Boolean(row.needs_rectification) &&

    row.rectification_status === 'open' &&

    row.status === 'approved' &&

    row.id != null

  );

}

const SupplierEvaluationsPage: React.FC = () => {

  const { t } = useTranslation();

  const { message: messageApi } = App.useApp();

  const perms = useResourcePermissions(RESOURCE);

  type SupplierAuditPlanGuide = {
    enabled?: boolean;
    line_fields?: Array<{ key: string; label: string; type?: string }>;
    month_tracking?: {
      months?: number[];
      row_kinds?: Array<{ key: string; label: string }>;
    };
  };

  const { data: auditPlanGuide } = useRequest(
    () => fetchHostCapabilityData<SupplierAuditPlanGuide>('host.supplier.audit_plan_guide'),
    { ready: perms.canRead },
  );
  const showAuditPlanGuide = Boolean(auditPlanGuide?.enabled);

  const evalActionRef = useRef<ActionType>();
  const envActionRef = useRef<ActionType>();
  const templateActionRef = useRef<ActionType>();
  const planActionRef = useRef<ActionType>();
  const evalFormRef = useRef<ProFormInstance>();
  const templateFormRef = useRef<ProFormInstance>();
  const planFormRef = useRef<ProFormInstance>();
  const evalRowsRef = useRef<SupplierEvaluation[]>([]);
  const envRowsRef = useRef<SupplierEvalEnvDocument[]>([]);
  const templateRowsRef = useRef<SupplierEvalTemplate[]>([]);
  const planRowsRef = useRef<SupplierEvalPlan[]>([]);
  const [activeTabKey, setActiveTabKey] = useState('plan');
  const [evalSelectedKeys, setEvalSelectedKeys] = useState<React.Key[]>([]);
  const [envSelectedKeys, setEnvSelectedKeys] = useState<React.Key[]>([]);
  const [templateSelectedKeys, setTemplateSelectedKeys] = useState<React.Key[]>([]);
  const [planSelectedKeys, setPlanSelectedKeys] = useState<React.Key[]>([]);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [auditPlanGuideOpen, setAuditPlanGuideOpen] = useState(false);
  const [editingEval, setEditingEval] = useState<SupplierEvaluation | null>(null);
  const [editingEnv, setEditingEnv] = useState<SupplierEvalEnvDocument | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<SupplierEvalTemplate | null>(null);
  const [editingPlan, setEditingPlan] = useState<SupplierEvalPlan | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<SupplierEvalSummary | null>(null);
  const [summaryPeriodType, setSummaryPeriodType] = useState<string>('annual');
  const [summaryPeriodYear, setSummaryPeriodYear] = useState<number>(currentEvalYear());
  const [summaryPeriodQuarter, setSummaryPeriodQuarter] = useState<number>(1);

  const [detailOpen, setDetailOpen] = useState(false);

  const [detail, setDetail] = useState<SupplierEvaluation | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);

  const [detailError, setDetailError] = useState<string | null>(null);

  const [activeTemplateOptions, setActiveTemplateOptions] = useState<

    { label: string; value: number }[]

  >([]);

  const [closeRectOpen, setCloseRectOpen] = useState(false);

  const [closeRectTarget, setCloseRectTarget] = useState<SupplierEvaluation | null>(null);

  const [closeRectResult, setCloseRectResult] = useState('');

  const [closeRectSubmitting, setCloseRectSubmitting] = useState(false);

  const statusEnum = useMemo(
    () =>
      Object.fromEntries(
        EVAL_STATUS_KEYS.map((key) => [key, { text: t(`${P}.status.${key}`) }]),
      ),
    [t],
  );

  const planStatusEnum = useMemo(
    () =>
      Object.fromEntries(
        PLAN_STATUS_KEYS.map((key) => [key, { text: t(`${P}.planStatus.${key}`) }]),
      ),
    [t],
  );

  const periodOptions = useMemo(

    () =>

      PERIOD_TYPES.map((value) => ({

        value,

        label: t(`${P}.periodType.${value}`),

      })),

    [t],

  );

  const auditModeOptions = useMemo(

    () =>

      AUDIT_MODES.map((value) => ({

        value,

        label: t(`${P}.auditMode.${value}`),

      })),

    [t],

  );

  const envDocTypeOptions = useMemo(

    () =>

      ENV_DOC_TYPES.map((value) => ({

        value,

        label: t(`${P}.envDocType.${value}`),

      })),

    [t],

  );

  const quarterOptions = useMemo(

    () =>

      [1, 2, 3, 4].map((value) => ({

        value,

        label: t(`${P}.quarterOption`, { quarter: value }),

      })),

    [t],

  );

  const loadActiveTemplates = useCallback(async () => {

    const res = await supplierEvalTemplateApi.list({ is_active: true, limit: 200 });

    setActiveTemplateOptions(

      (res.data || [])

        .filter((row) => row.id != null)

        .map((row) => ({

          value: row.id!,

          label: `${row.name} (${row.code})`,

        })),

    );

  }, []);

  useEffect(() => {
    if (evalModalOpen || planModalOpen) {
      void loadActiveTemplates();
    }
  }, [evalModalOpen, planModalOpen, loadActiveTemplates]);

  const reloadEval = useCallback(() => {
    evalActionRef.current?.reload();
  }, []);

  const reloadEnv = useCallback(() => {
    envActionRef.current?.reload();
  }, []);

  const reloadTemplate = useCallback(() => {
    templateActionRef.current?.reload();
  }, []);

  const reloadPlan = useCallback(() => {
    planActionRef.current?.reload();
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const params: Record<string, unknown> = {
        period_type: summaryPeriodType,
        period_year: summaryPeriodYear,
      };
      if (summaryPeriodType === 'quarterly') {
        params.period_quarter = summaryPeriodQuarter;
      }
      setSummaryData(await supplierEvalSummaryApi.get(params));
    } catch (e) {
      messageApi.error(getApiErrorMessage(e));
      setSummaryData(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [summaryPeriodType, summaryPeriodYear, summaryPeriodQuarter, messageApi]);

  useEffect(() => {
    if (activeTabKey === 'summary') {
      void loadSummary();
    }
  }, [activeTabKey, loadSummary]);

  const openEvalCreate = useCallback(() => {

    setEditingEval(null);

    setEvalModalOpen(true);

  }, []);

  const openEnvCreate = useCallback(() => {

    setEditingEnv(null);

    setEnvModalOpen(true);

  }, []);

  const openTemplateCreate = useCallback(() => {

    setEditingTemplate(null);

    setTemplateModalOpen(true);

  }, []);

  const openPlanCreate = useCallback(() => {
    setEditingPlan(null);
    setPlanModalOpen(true);
  }, []);

  useNewShortcut(() => {
    if (activeTabKey === 'plan' && perms.canCreate) {
      openPlanCreate();
    } else if (activeTabKey === 'eval' && perms.canCreate) {
      openEvalCreate();
    } else if (activeTabKey === 'env' && perms.canCreate) {
      openEnvCreate();
    } else if (activeTabKey === 'template' && perms.canCreate) {
      openTemplateCreate();
    }
  });

  const openDetail = async (record: SupplierEvaluation) => {

    if (!record.id) return;

    setDetailOpen(true);

    setDetailLoading(true);

    setDetailError(null);

    setDetail(null);

    try {

      setDetail(await supplierEvaluationApi.get(record.id));

    } catch (e) {

      setDetailError(getApiErrorMessage(e));

    } finally {

      setDetailLoading(false);

    }

  };

  const openEvalEdit = async (row: SupplierEvaluation) => {

    if (!row.id) return;

    try {

      const full = await supplierEvaluationApi.get(row.id);

      setEditingEval(full);

      setEvalModalOpen(true);

    } catch (e) {

      messageApi.error(getApiErrorMessage(e));

    }

  };

  const openTemplateEdit = async (row: SupplierEvalTemplate) => {
    if (!row.id) return;
    try {
      const full = await supplierEvalTemplateApi.get(row.id);
      setEditingTemplate(full);
      setTemplateModalOpen(true);
    } catch (e) {
      messageApi.error(getApiErrorMessage(e));
    }
  };

  const openPlanEdit = async (row: SupplierEvalPlan) => {
    if (!row.id) return;
    try {
      const full = await supplierEvalPlanApi.get(row.id);
      setEditingPlan(full);
      setPlanModalOpen(true);
    } catch (e) {
      messageApi.error(getApiErrorMessage(e));
    }
  };

  const handleEvalTemplateChange = async (templateId: number | undefined) => {

    if (!templateId) {

      evalFormRef.current?.setFieldsValue({ lines: [] });

      return;

    }

    try {

      const tpl = await supplierEvalTemplateApi.get(templateId);

      const lines: SupplierEvaluationLine[] = (tpl.clauses || []).map((c, idx) => ({

        line_no: c.line_no ?? idx + 1,

        clause_code: c.clause_code,

        clause_name: c.clause_name,

        weight: c.weight ?? 1,

        max_score: c.max_score ?? 100,

        score: undefined,

        remarks: c.remarks,

      }));

      evalFormRef.current?.setFieldsValue({ lines });

    } catch (e) {

      messageApi.error(getApiErrorMessage(e));

    }

  };

  const openCloseRectification = (row: SupplierEvaluation) => {

    setCloseRectTarget(row);

    setCloseRectResult('');

    setCloseRectOpen(true);

  };

  const submitCloseRectification = async () => {

    const result = closeRectResult.trim();

    if (!result) {

      messageApi.warning(t(`${P}.closeRectificationResultRequired`));

      return;

    }

    if (!closeRectTarget?.id) return;

    setCloseRectSubmitting(true);

    try {

      await supplierEvaluationApi.closeRectification(closeRectTarget.id, result);

      messageApi.success(t(`${P}.closeRectificationSuccess`));

      setCloseRectOpen(false);

      setCloseRectTarget(null);

      reloadEval();

      if (detailOpen && detail?.id === closeRectTarget.id) {

        void openDetail(closeRectTarget);

      }

    } catch (e) {

      messageApi.error(getApiErrorMessage(e));

    } finally {

      setCloseRectSubmitting(false);

    }

  };

  const renderRectificationStatus = (status?: string) => {
    const key = RECT_STATUS_KEYS.includes(status as (typeof RECT_STATUS_KEYS)[number])
      ? status
      : 'none';
    const color =
      key === 'open' ? 'orange' : key === 'closed' ? 'success' : 'default';
    return (
      <MarkerTag color={color}>
        {t(`${P}.rectificationStatus.${key}`)}
      </MarkerTag>
    );
  };

  const planGuideToolbar = useMemo(() => {
    if (!showAuditPlanGuide) {
      return undefined;
    }
    return [
      <Button key="audit-plan-guide" onClick={() => setAuditPlanGuideOpen(true)}>
        {t('core.extensionHost.supplierAuditPlan.viewGuide')}
      </Button>,
    ];
  }, [showAuditPlanGuide, t]);

  const renderPlanProgress = (row: SupplierEvalPlan) => {
    const total = row.line_count ?? 0;
    const generated = row.generated_count ?? 0;
    const percent = total > 0 ? Math.round((generated / total) * 100) : 0;
    return (
      <Space orientation="vertical" size={0} style={{ width: '100%', minWidth: 120 }}>
        <span>{t(`${P}.planProgressLabel`, { generated, total })}</span>
        <Progress percent={percent} size="small" showInfo={false} />
      </Space>
    );
  };

  const planColumns: ProColumns<SupplierEvalPlan>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t(`${P}.colPlanName`),
            dataIndex: 'name',
            key: 'name',
            minWidth: 200,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: false,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.name}
                secondary={record.code || '-'}
              />
            ),
          },
          {
            title: t(`${P}.colTemplate`),
            dataIndex: 'template_name',
            key: 'template_name',
            hideInSearch: true,
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t(`${P}.colPeriodType`),
            dataIndex: 'period_type',
            key: 'supplier_eval_period_type',
            valueType: 'select',
            fieldProps: { options: periodOptions },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) => (
              <MarkerTag color="blue">
                {t(`${P}.periodType.${record.period_type || 'annual'}`)}
              </MarkerTag>
            ),
          },
          {
            title: t(`${P}.colPeriodYear`),
            dataIndex: 'period_year',
            key: 'supplier_eval_period_year',
            hideInSearch: true,
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t(`${P}.colPeriodQuarter`),
            dataIndex: 'period_quarter',
            key: 'supplier_eval_period_quarter',
            hideInSearch: true,
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, record) =>
              record.period_type === 'quarterly' && record.period_quarter
                ? t(`${P}.quarterOption`, { quarter: record.period_quarter })
                : '-',
          },
          {
            title: t(`${P}.colPlanProgress`),
            dataIndex: 'generated_count',
            key: 'supplier_eval_plan_progress',
            hideInSearch: true,
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, record) => renderPlanProgress(record),
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'lifecycle',
            valueType: 'select',
            valueEnum: planStatusEnum,
            fixed: 'right',
            render: (_, record) =>
              renderDocumentStatusTag(
                t(`${P}.planStatus.${record.status || 'draft'}`),
                record.status || 'draft',
              ),
          },
          ...buildDocumentAuditColumns<SupplierEvalPlan>(t),
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => {
              const actions: React.ReactNode[] = [];
              if (row.status !== 'closed' && perms.canUpdate) {
              actions.push(
              <Button
              key="edit"
              {...rowActionKind('update')}
              onClick={() => void openPlanEdit(row)}
              >
              {t('common.edit')}
              </Button>,
              );
              }
              if (row.status === 'draft' && row.id) {
              actions.push(
              <Button
              key="release"
              {...rowActionKind('submit')}
              disabled={!perms.canAction('submit')}
              onClick={async () => {
              try {
              await supplierEvalPlanApi.release(row.id!);
              messageApi.success(t(`${P}.planReleaseSuccess`));
              reloadPlan();
              } catch (e) {
              messageApi.error(getApiErrorMessage(e));
              }
              }}
              >
              {t(`${P}.actionPlanRelease`)}
              </Button>,
              );
              }
              if ((row.status === 'draft' || row.status === 'released') && row.id) {
              actions.push(
              <Button
              key="generate"
              {...rowActionKind('execute')}
              disabled={!perms.canCreate}
              onClick={async () => {
              try {
              const res = await supplierEvalPlanApi.generate(row.id!);
              messageApi.success(
              t(`${P}.planGenerateSuccess`, {
              created: res.created,
              skipped: res.skipped,
              }),
              );
              reloadPlan();
              reloadEval();
              } catch (e) {
              messageApi.error(getApiErrorMessage(e));
              }
              }}
              >
              {t(`${P}.actionPlanGenerate`)}
              </Button>,
              );
              }
              if (row.status === 'released' && row.id && perms.canUpdate) {
              actions.push(
              <Button
              key="reopen"
              {...rowActionKind('revoke')}
              onClick={async () => {
              try {
              await supplierEvalPlanApi.reopenDraft(row.id!);
              messageApi.success(t(`${P}.planReopenSuccess`));
              reloadPlan();
              } catch (e) {
              messageApi.error(getApiErrorMessage(e));
              }
              }}
              >
              {t(`${P}.actionPlanReopen`)}
              </Button>,
              );
              }
              if (row.status !== 'closed' && row.id && perms.canUpdate) {
              actions.push(
              <Button
              key="close"
              {...rowActionKind('close')}
              onClick={async () => {
              try {
              await supplierEvalPlanApi.close(row.id!);
              messageApi.success(t(`${P}.planCloseSuccess`));
              reloadPlan();
              } catch (e) {
              messageApi.error(getApiErrorMessage(e));
              }
              }}
              >
              {t(`${P}.actionPlanClose`)}
              </Button>,
              );
              }
              return actions;
            },
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, periodOptions, planStatusEnum, perms, messageApi, reloadPlan],
  );

  const evalColumns: ProColumns<SupplierEvaluation>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t(`${P}.colSupplier`),
            dataIndex: 'supplier_name',
            key: 'supplier_name',
            minWidth: 200,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: false,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.supplier_name || '-'}
                secondary={record.code || '-'}
              />
            ),
          },
          {
            title: t(`${P}.colTemplate`),
            dataIndex: 'template_name',
            key: 'template_name',
            hideInSearch: true,
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t(`${P}.colPeriodType`),
            dataIndex: 'period_type',
            key: 'supplier_eval_period_type',
            valueType: 'select',
            fieldProps: { options: periodOptions },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) => (
              <MarkerTag color="blue">
                {t(`${P}.periodType.${record.period_type || 'annual'}`)}
              </MarkerTag>
            ),
          },
          {
            title: t(`${P}.colPeriodYear`),
            dataIndex: 'period_year',
            key: 'supplier_eval_period_year',
            hideInSearch: true,
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t(`${P}.colPeriodQuarter`),
            dataIndex: 'period_quarter',
            key: 'supplier_eval_period_quarter',
            hideInSearch: true,
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, record) =>
              record.period_type === 'quarterly' && record.period_quarter
                ? t(`${P}.quarterOption`, { quarter: record.period_quarter })
                : '-',
          },
          {
            title: t(`${P}.colScore`),
            dataIndex: 'score',
            key: 'supplier_eval_score',
            hideInSearch: true,
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t(`${P}.colGrade`),
            dataIndex: 'grade',
            key: 'supplier_eval_grade',
            hideInSearch: true,
            width: 80,
            minWidth: 80,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t(`${P}.colRectificationStatus`),
            dataIndex: 'rectification_status',
            key: 'supplier_eval_rectification',
            hideInSearch: true,
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) => renderRectificationStatus(record.rectification_status),
          },
          {
            title: t(`${P}.colAuditMode`),
            dataIndex: 'audit_mode',
            key: 'supplier_eval_audit_mode',
            valueType: 'select',
            fieldProps: { options: auditModeOptions, allowClear: true },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) => (
              <MarkerTag color="geekblue">
                {t(`${P}.auditMode.${record.audit_mode || 'document'}`)}
              </MarkerTag>
            ),
          },
          {
            title: t('common.status'),
            dataIndex: 'status',
            key: 'lifecycle',
            valueType: 'select',
            valueEnum: statusEnum,
            fixed: 'right',
            render: (_, record) =>
              renderDocumentStatusTag(
                t(`${P}.status.${record.status || 'draft'}`),
                record.status || 'draft',
              ),
          },
          ...buildDocumentAuditColumns<SupplierEvaluation>(t),
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => {

              const actions: React.ReactNode[] = [

              <Button key="view" {...rowActionKind('read')} onClick={() => void openDetail(row)}>

              {t('common.detail')}

              </Button>,

              ];

              if (row.status === 'draft' || row.status === 'rejected') {

              actions.push(

              <Button

              key="edit"

              {...rowActionKind('update')}

              disabled={!perms.canUpdate}

              onClick={() => void openEvalEdit(row)}

              >

              {t('common.edit')}

              </Button>,

              );

              }

              if ((row.status === 'draft' || row.status === 'rejected') && row.id) {

              actions.push(

              <Button

              key="recalculate"

              {...rowActionKind('execute')}

              disabled={!perms.canUpdate}

              onClick={async () => {

              try {

              await supplierEvaluationApi.recalculate(row.id!);

              messageApi.success(t(`${P}.recalculateSuccess`));

              reloadEval();

              } catch (e) {

              messageApi.error(getApiErrorMessage(e));

              }

              }}

              >

              {t(`${P}.actionRecalculate`)}

              </Button>,

              );

              actions.push(

              <Button

              key="submit"

              {...rowActionKind('submit')}

              disabled={!perms.canAction('submit')}

              onClick={async () => {

              try {

              await supplierEvaluationApi.submit(row.id!);

              messageApi.success(t(`${P}.submitSuccess`));

              reloadEval();

              } catch (e) {

              messageApi.error(getApiErrorMessage(e));

              }

              }}

              >

              {t(`${P}.actionSubmit`)}

              </Button>,

              );

              }

              if (row.status === 'pending' && row.id) {

              if (perms.canAction('approve')) {

              actions.push(

              <Button

              key="approve"

              {...rowActionKind('approve')}

              onClick={async () => {

              try {

              await supplierEvaluationApi.approve(row.id!);

              messageApi.success(t(`${P}.approveSuccess`));

              reloadEval();

              } catch (e) {

              messageApi.error(getApiErrorMessage(e));

              }

              }}

              />,

              );

              }

              if (perms.canAction('reject')) {

              actions.push(

              <Button

              key="reject"

              {...rowActionKind('reject')}

              onClick={async () => {

              try {

              await supplierEvaluationApi.reject(row.id!);

              messageApi.success(t(`${P}.rejectSuccess`));

              reloadEval();

              } catch (e) {

              messageApi.error(getApiErrorMessage(e));

              }

              }}

              />,

              );

              }

              }

              if (canCloseRectification(row)) {

              actions.push(

              <Button

              key="closeRect"

              {...rowActionKind('close')}

              disabled={!perms.canUpdate}

              onClick={() => openCloseRectification(row)}

              >

              {t(`${P}.actionCloseRectification`)}

              </Button>,

              );

              }

              return actions;
            },
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, periodOptions, auditModeOptions, statusEnum, perms, messageApi, reloadEval],
  );

  const templateColumns: ProColumns<SupplierEvalTemplate>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t(`${P}.colTemplate`),
            dataIndex: 'name',
            key: 'name',
            minWidth: 200,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: false,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.name}
                secondary={record.code || '-'}
              />
            ),
          },
          {
            title: t(`${P}.colTemplateVersion`),
            dataIndex: 'version',
            key: 'supplier_eval_template_version',
            hideInSearch: true,
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t(`${P}.colGradeVersion`),
            dataIndex: 'grade_version',
            key: 'supplier_eval_grade_version',
            hideInSearch: true,
            width: 100,
            minWidth: 100,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t(`${P}.colPeriodType`),
            dataIndex: 'period_type',
            key: 'supplier_eval_period_type',
            valueType: 'select',
            fieldProps: { options: periodOptions, allowClear: true },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) =>
              record.period_type ? (
                <MarkerTag color="blue">
                  {t(`${P}.periodType.${record.period_type}`)}
                </MarkerTag>
              ) : (
                '-'
              ),
          },
          {
            title: t(`${P}.colClauseCount`),
            dataIndex: 'clause_count',
            key: 'supplier_eval_clause_count',
            hideInSearch: true,
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t(`${P}.colTemplateActive`),
            dataIndex: 'is_active',
            valueType: 'select',
            valueEnum: {
              true: { text: t(`${P}.templateActiveYes`) },
              false: { text: t(`${P}.templateActiveNo`) },
            },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) =>
              record.is_active ? (
                <MarkerTag color="success">{t(`${P}.templateActiveYes`)}</MarkerTag>
              ) : (
                <MarkerTag color="default">{t(`${P}.templateActiveNo`)}</MarkerTag>
              ),
          },
          ...buildDocumentAuditColumns<SupplierEvalTemplate>(t),
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              perms.canUpdate ? (
              <Button
              key="edit"
              {...rowActionKind('update')}
              onClick={() => void openTemplateEdit(row)}
              >
              {t('common.edit')}
              </Button>
              ) : null,
            ].filter(Boolean),
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, periodOptions, perms.canUpdate],
  );

  const envColumns: ProColumns<SupplierEvalEnvDocument>[] = useMemo(
    () =>
      alignProColumns(
        [
          {
            title: t(`${P}.colSupplier`),
            dataIndex: 'supplier_name',
            key: 'supplier_name',
            minWidth: 200,
            uniTableRemainderFlex: true,
            uniTablePrimaryFlex: true,
            resizable: false,
            ellipsis: false,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.title || '-'}
                secondary={
                  [record.supplier_code, record.supplier_name].filter(Boolean).join(' ') || '-'
                }
              />
            ),
          },
          {
            title: t(`${P}.colMaterial`),
            dataIndex: 'material_code',
            key: 'supplier_eval_env_material',
            hideInSearch: true,
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
            render: (_, record) =>
              [record.material_code, record.material_name].filter(Boolean).join(' ') || '-',
          },
          {
            title: t(`${P}.colMaterialDescription`),
            dataIndex: 'material_description',
            key: 'supplier_eval_env_material_desc',
            hideInSearch: true,
            width: 160,
            minWidth: 160,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t(`${P}.colEnvDocType`),
            dataIndex: 'doc_type',
            key: 'supplier_eval_env_doc_type',
            valueType: 'select',
            fieldProps: { options: envDocTypeOptions },
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            render: (_, record) => (
              <MarkerTag color="cyan">
                {t(`${P}.envDocType.${record.doc_type || 'other'}`)}
              </MarkerTag>
            ),
          },
          {
            title: t(`${P}.colIssuedAt`),
            dataIndex: 'issued_at',
            hideInSearch: true,
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            render: (v) => formatBusinessDateOnly(v),
          },
          {
            title: t(`${P}.colExpiresAt`),
            dataIndex: 'expires_at',
            hideInSearch: true,
            width: 120,
            minWidth: 120,
            uniTableKeepWidth: true,
            resizable: false,
            render: (v) => formatBusinessDateOnly(v),
          },
          ...buildDocumentAuditColumns<SupplierEvalEnvDocument>(t),
          {
            title: t('common.actions'),
            key: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => [
              <Button
              key="edit"
              {...rowActionKind('update')}
              disabled={!perms.canUpdate}
              onClick={() => {
              setEditingEnv(row);
              setEnvModalOpen(true);
              }}
              >
              {t('common.edit')}
              </Button>,
            ],
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [t, envDocTypeOptions, perms.canUpdate],
  );

  const detailColumns: ProDescriptionsItemProps<SupplierEvaluation>[] = useMemo(

    () =>

      alignDescriptionColumns(

        [

          { title: t(`${P}.colCode`), dataIndex: 'code' },

          { title: t(`${P}.colSupplier`), dataIndex: 'supplier_name' },

          { title: t(`${P}.colTemplate`), dataIndex: 'template_name' },

          {

            title: t(`${P}.colPeriodType`),

            dataIndex: 'period_type',

            render: (_, r) => t(`${P}.periodType.${r.period_type || 'annual'}`),

          },

          { title: t(`${P}.colPeriodYear`), dataIndex: 'period_year' },

          {

            title: t(`${P}.colPeriodQuarter`),

            dataIndex: 'period_quarter',

            render: (_, r) =>

              r.period_type === 'quarterly' && r.period_quarter

                ? t(`${P}.quarterOption`, { quarter: r.period_quarter })

                : '-',

          },

          {

            title: t(`${P}.colAuditMode`),

            dataIndex: 'audit_mode',

            render: (_, r) => t(`${P}.auditMode.${r.audit_mode || 'document'}`),

          },

          { title: t(`${P}.colScore`), dataIndex: 'score' },

          { title: t(`${P}.colGrade`), dataIndex: 'grade' },

          { title: t(`${P}.colFormulaVersion`), dataIndex: 'formula_version' },

          { title: t(`${P}.colGradeVersion`), dataIndex: 'grade_version' },

          {

            title: t(`${P}.colNeedsRectification`),

            dataIndex: 'needs_rectification',

            render: (_, r) => (r.needs_rectification ? t('common.yes') : t('common.no')),

          },

          {

            title: t(`${P}.colRectificationStatus`),

            dataIndex: 'rectification_status',

            render: (_, r) => t(`${P}.rectificationStatus.${r.rectification_status || 'none'}`),

          },

          { title: t(`${P}.colRectificationPlan`), dataIndex: 'rectification_plan', span: 2 },

          {

            title: t(`${P}.colRectificationDue`),

            dataIndex: 'rectification_due',

            render: (v) => formatBusinessDateOnly(v),

          },

          {

            title: t(`${P}.colRectificationResult`),

            dataIndex: 'rectification_result',

            span: 2,

          },

          {

            title: t(`${P}.colRectificationClosedAt`),

            dataIndex: 'rectification_closed_at',

            render: (v) => formatDateTimeBySiteSetting(v),

          },

          {

            title: t(`${P}.colRectificationClosedBy`),

            dataIndex: 'rectification_closed_by_name',

          },

          {

            title: t('common.status'),

            dataIndex: 'status',

            render: (_, r) => t(`${P}.status.${r.status || 'draft'}`),

          },

          {

            title: t(`${P}.colSubmittedAt`),

            dataIndex: 'submitted_at',

            render: (v) => formatDateTimeBySiteSetting(v),

          },

          {

            title: t(`${P}.colApprovedAt`),

            dataIndex: 'approved_at',

            render: (v) => formatDateTimeBySiteSetting(v),

          },

          { title: t('common.remark'), dataIndex: 'remarks', span: 2 },

        ],

        GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,

      ),

    [t],

  );

  const detailItems = useDetailDrawerDescriptionItems(detailColumns, detail, 'supplier_evaluation');

  const templateClauseColumns = useMemo<ColumnsType>(

    () => [

      {

        title: t(`${P}.colClauseCode`),

        dataIndex: 'clause_code',

        width: 120,

        render: (_: unknown, __: unknown, index: number) => (

          <AntForm.Item

            name={[index, 'clause_code']}

            rules={[{ required: true, message: t('common.required') }]}

            style={{ marginBottom: 0 }}

          >

            <Input size="small" />

          </AntForm.Item>

        ),

      },

      {

        title: t(`${P}.colClauseName`),

        dataIndex: 'clause_name',

        width: 180,

        render: (_: unknown, __: unknown, index: number) => (

          <AntForm.Item

            name={[index, 'clause_name']}

            rules={[{ required: true, message: t('common.required') }]}

            style={{ marginBottom: 0 }}

          >

            <Input size="small" />

          </AntForm.Item>

        ),

      },

      {

        title: t(`${P}.colWeight`),

        dataIndex: 'weight',

        width: 88,

        render: (_: unknown, __: unknown, index: number) => (

          <AntForm.Item name={[index, 'weight']} style={{ marginBottom: 0 }}>

            <InputNumber size="small" min={0} style={{ width: '100%' }} />

          </AntForm.Item>

        ),

      },

      {

        title: t(`${P}.colMaxScore`),

        dataIndex: 'max_score',

        width: 96,

        render: (_: unknown, __: unknown, index: number) => (

          <AntForm.Item name={[index, 'max_score']} style={{ marginBottom: 0 }}>

            <InputNumber size="small" min={0} style={{ width: '100%' }} />

          </AntForm.Item>

        ),

      },

    ],

    [t],

  );

  const evalScoreLineColumns = useMemo<ColumnsType>(
    () => [
      {
        title: t(`${P}.colClauseName`),
        dataIndex: 'clause_name',
        width: 200,
        render: (_: unknown, __: unknown, index: number) => (
          <>
            <AntForm.Item name={[index, 'clause_code']} hidden>
              <Input />
            </AntForm.Item>
            <AntForm.Item name={[index, 'clause_name']} style={{ marginBottom: 0 }}>
              <Input size="small" readOnly variant="borderless" />
            </AntForm.Item>
          </>
        ),
      },
      {
        title: t(`${P}.colWeight`),
        dataIndex: 'weight',
        width: 80,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'weight']} style={{ marginBottom: 0 }}>
            <InputNumber size="small" readOnly variant="borderless" style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t(`${P}.colMaxScore`),
        dataIndex: 'max_score',
        width: 96,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'max_score']} style={{ marginBottom: 0 }}>
            <InputNumber size="small" readOnly variant="borderless" style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t(`${P}.colScore`),
        dataIndex: 'score',
        width: 100,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'score']} style={{ marginBottom: 0 }}>
            <InputNumber size="small" min={0} style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
    ],
    [t],
  );

  const planModalSupplierLineColumns = useMemo<ColumnsType>(
    () => [
      {
        title: t(`${P}.colSupplier`),
        dataIndex: 'supplier_id',
        width: 280,
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item
            name={[index, 'supplier_id']}
            rules={[{ required: true, message: t(`${P}.supplierRequired`) }]}
            style={{ marginBottom: 0 }}
          >
            <SupplierSelectDropdown hostResource={RESOURCE} style={{ width: '100%' }} />
          </AntForm.Item>
        ),
      },
      {
        title: t('common.remark'),
        dataIndex: 'remarks',
        render: (_: unknown, __: unknown, index: number) => (
          <AntForm.Item name={[index, 'remarks']} style={{ marginBottom: 0 }}>
            <Input size="small" />
          </AntForm.Item>
        ),
      },
    ],
    [t],
  );

  const summaryStatusRows = useMemo(
    () =>
      EVAL_STATUS_KEYS.map((key) => ({
        key,
        status: key,
        count: summaryData?.by_status?.[key] ?? 0,
      })),
    [summaryData],
  );

  const summaryGradeRows = useMemo(() => {
    const grades = summaryData?.by_grade ?? {};
    return Object.keys(grades)
      .sort()
      .map((grade) => ({
        key: grade,
        grade,
        count: grades[grade] ?? 0,
      }));
  }, [summaryData]);

  const detailLineColumns = useMemo(

    () => [

      { title: t(`${P}.colClauseCode`), dataIndex: 'clause_code', width: 100 },

      { title: t(`${P}.colClauseName`), dataIndex: 'clause_name' },

      { title: t(`${P}.colWeight`), dataIndex: 'weight', width: 72 },

      { title: t(`${P}.colMaxScore`), dataIndex: 'max_score', width: 88 },

      { title: t(`${P}.colScore`), dataIndex: 'score', width: 72 },

    ],

    [t],

  );

  const detailExtra = detail && canCloseRectification(detail) && perms.canUpdate ? (

    <Button type="primary" onClick={() => openCloseRectification(detail)}>

      {t(`${P}.actionCloseRectification`)}

    </Button>

  ) : undefined;

  return (

    <>

      <MultiTabListPageTemplate

        activeTabKey={activeTabKey}

        onTabChange={setActiveTabKey}

        preserveMounted

        tabs={[

          {

            key: 'plan',

            label: t(`${P}.tabPlan`),

            children: (

              <UniTable<SupplierEvalPlan>

                columnPersistenceId="apps.kuaizhizao.pages.quality-management.supplier-evaluations-plan-width-v2"

                headerTitle={t(`${P}.tabPlan`)}

                permissionResource={RESOURCE}

                actionRef={planActionRef}

                columns={planColumns}

                rowKey="id"

                enableRowSelection

                selectedRowKeys={planSelectedKeys}

                onRowSelectionChange={setPlanSelectedKeys}

                onTableDataChange={(rows) => {

                  planRowsRef.current = rows;

                }}

                toolBarActionsBeforeCreate={planGuideToolbar}

                showCreateButton={perms.canCreate}

                createButtonText={t(`${P}.createPlan`)}

                onCreate={openPlanCreate}

                showDeleteButton={perms.canDelete}

                onDelete={async (keys) => {

                  for (const key of keys) {

                    await supplierEvalPlanApi.delete(String(key));

                  }

                  messageApi.success(t('common.deleteSuccess'));

                  setPlanSelectedKeys([]);

                  reloadPlan();

                }}

                request={async (params, _sort, _filter, searchFormValues) => {

                  const res = await supplierEvalPlanApi.list(
                    resolveSupplierEvalPlanListParams(searchFormValues, params),
                  );

                  return { data: res.data || [], success: true, total: res.total || 0 };

                }}

              />

            ),

          },

          {

            key: 'summary',

            label: t(`${P}.tabSummary`),

            children: (

              <Spin spinning={summaryLoading}>

                <Space orientation="vertical" size={16} style={{ width: '100%' }}>

                  <Card size="small" title={t(`${P}.summaryFiltersTitle`)}>

                    <Space wrap>

                      <Select

                        style={{ width: 140 }}

                        value={summaryPeriodType}

                        options={periodOptions}

                        onChange={setSummaryPeriodType}

                      />

                      <Select

                        style={{ width: 120 }}

                        value={summaryPeriodYear}

                        options={Array.from({ length: 11 }, (_, i) => {

                          const year = currentEvalYear() - 5 + i;

                          return { value: year, label: String(year) };

                        })}

                        onChange={setSummaryPeriodYear}

                      />

                      {summaryPeriodType === 'quarterly' ? (

                        <Select

                          style={{ width: 120 }}

                          value={summaryPeriodQuarter}

                          options={quarterOptions}

                          onChange={setSummaryPeriodQuarter}

                        />

                      ) : null}

                      <Button type="primary" onClick={() => void loadSummary()}>

                        {t(`${P}.summaryQuery`)}

                      </Button>

                    </Space>

                  </Card>

                  <Row gutter={16}>

                    <Col xs={24} sm={12} md={6}>

                      <Card>

                        <Statistic title={t(`${P}.summaryTotal`)} value={summaryData?.total ?? 0} />

                      </Card>

                    </Col>

                    <Col xs={24} sm={12} md={6}>

                      <Card>

                        <Statistic

                          title={t(`${P}.summaryApproved`)}

                          value={summaryData?.approved_count ?? 0}

                        />

                      </Card>

                    </Col>

                    <Col xs={24} sm={12} md={6}>

                      <Card>

                        <Statistic
                          title={t(`${P}.summaryAvgScore`)}
                          value={
                            summaryData?.avg_score != null
                              ? Number(summaryData.avg_score)
                              : '-'
                          }
                          precision={summaryData?.avg_score != null ? 2 : undefined}
                        />

                      </Card>

                    </Col>

                    <Col xs={24} sm={12} md={6}>

                      <Card>

                        <Statistic

                          title={t(`${P}.summaryOpenRectification`)}

                          value={summaryData?.open_rectification ?? 0}

                        />

                      </Card>

                    </Col>

                  </Row>

                  <Row gutter={16}>

                    <Col xs={24} md={12}>

                      <Card size="small" title={t(`${P}.summaryByStatus`)}>

                        <Table

                          size="small"

                          pagination={false}

                          rowKey="key"

                          dataSource={summaryStatusRows}

                          columns={[

                            {

                              title: t('common.status'),

                              dataIndex: 'status',

                              render: (status: string) =>
                                renderDocumentStatusTag(
                                  t(`${P}.status.${status || 'draft'}`),
                                  status || 'draft',
                                ),

                            },

                            {

                              title: t(`${P}.summaryCount`),

                              dataIndex: 'count',

                              width: 88,

                            },

                          ]}

                        />

                      </Card>

                    </Col>

                    <Col xs={24} md={12}>

                      <Card size="small" title={t(`${P}.summaryByGrade`)}>

                        <Table

                          size="small"

                          pagination={false}

                          rowKey="key"

                          dataSource={summaryGradeRows}

                          locale={{ emptyText: t(`${P}.summaryNoGrade`) }}

                          columns={[

                            {

                              title: t(`${P}.colGrade`),

                              dataIndex: 'grade',

                              render: (grade: string) => (

                                <MarkerTag color="blue">{grade}</MarkerTag>

                              ),

                            },

                            {

                              title: t(`${P}.summaryCount`),

                              dataIndex: 'count',

                              width: 88,

                            },

                          ]}

                        />

                      </Card>

                    </Col>

                  </Row>

                </Space>

              </Spin>

            ),

          },

          {

            key: 'eval',

            label: t(`${P}.tabEval`),

            children: (

              <UniTable<SupplierEvaluation>

                columnPersistenceId="apps.kuaizhizao.pages.quality-management.supplier-evaluations-eval-width-v4"

                headerTitle={t(`${P}.title`)}

                permissionResource={RESOURCE}

                actionRef={evalActionRef}

                columns={evalColumns}

                rowKey="id"

                enableRowSelection

                selectedRowKeys={evalSelectedKeys}

                onRowSelectionChange={setEvalSelectedKeys}

                onTableDataChange={(rows) => {

                  evalRowsRef.current = rows;

                }}

                showCreateButton={perms.canCreate}

                createButtonText={t(`${P}.createEval`)}

                onCreate={openEvalCreate}

                showDeleteButton={perms.canDelete}

                onDelete={async (keys) => {

                  for (const key of keys) {

                    await supplierEvaluationApi.delete(String(key));

                  }

                  messageApi.success(t('common.deleteSuccess'));

                  setEvalSelectedKeys([]);

                  reloadEval();

                }}

                showExportButton={perms.canExport}

                onExport={async () => {

                  try {

                    const items = await fetchAllListItems(async ({ skip, limit }) => {

                      const res = await supplierEvaluationApi.list({ skip, limit });

                      return { items: res.data || [], total: res.total || 0 };

                    });

                    const rows = items.map((row) => ({

                      ...row,

                      period_type_label: t(`${P}.periodType.${row.period_type || 'annual'}`),

                      status_label: t(`${P}.status.${row.status || 'draft'}`),

                    }));

                    downloadRecordsAsXlsx(

                      rows,

                      EVAL_EXPORT_COLUMNS,

                      `supplier-evaluations-${todaySiteDateString()}`,

                    );

                  } catch (e) {

                    messageApi.error(getApiErrorMessage(e, t('common.exportFailed')));

                  }

                }}

                request={async (params, _sort, _filter, searchFormValues) => {

                  const res = await supplierEvaluationApi.list(
                    resolveSupplierEvaluationListParams(searchFormValues, params),
                  );

                  return { data: res.data || [], success: true, total: res.total || 0 };

                }}

              />

            ),

          },

          {

            key: 'env',

            label: t(`${P}.tabEnv`),

            children: (

              <UniTable<SupplierEvalEnvDocument>

                columnPersistenceId="apps.kuaizhizao.pages.quality-management.supplier-evaluations-env-width-v4"

                headerTitle={t(`${P}.tabEnv`)}

                permissionResource={RESOURCE}

                actionRef={envActionRef}

                columns={envColumns}

                rowKey="id"

                enableRowSelection

                selectedRowKeys={envSelectedKeys}

                onRowSelectionChange={setEnvSelectedKeys}

                onTableDataChange={(rows) => {

                  envRowsRef.current = rows;

                }}

                showCreateButton={perms.canCreate}

                createButtonText={t(`${P}.createEnv`)}

                onCreate={openEnvCreate}

                showDeleteButton={perms.canDelete}

                onDelete={async (keys) => {

                  for (const key of keys) {

                    await supplierEvalEnvDocumentApi.delete(String(key));

                  }

                  messageApi.success(t('common.deleteSuccess'));

                  setEnvSelectedKeys([]);

                  reloadEnv();

                }}

                request={async (params, _sort, _filter, searchFormValues) => {

                  const res = await supplierEvalEnvDocumentApi.list(
                    resolveSupplierEvalEnvListParams(searchFormValues, params),
                  );

                  return { data: res.data || [], success: true, total: res.total || 0 };

                }}

              />

            ),

          },

          {

            key: 'template',

            label: t(`${P}.tabTemplate`),

            children: (

              <UniTable<SupplierEvalTemplate>

                columnPersistenceId="apps.kuaizhizao.pages.quality-management.supplier-evaluations-template-width-v3"

                headerTitle={t(`${P}.tabTemplate`)}

                permissionResource={RESOURCE}

                actionRef={templateActionRef}

                columns={templateColumns}

                rowKey="id"

                enableRowSelection

                selectedRowKeys={templateSelectedKeys}

                onRowSelectionChange={setTemplateSelectedKeys}

                onTableDataChange={(rows) => {

                  templateRowsRef.current = rows;

                }}

                showCreateButton={perms.canCreate}

                createButtonText={t(`${P}.createTemplate`)}

                onCreate={openTemplateCreate}

                showDeleteButton={perms.canDelete}

                onDelete={async (keys) => {

                  for (const key of keys) {

                    await supplierEvalTemplateApi.delete(String(key));

                  }

                  messageApi.success(t('common.deleteSuccess'));

                  setTemplateSelectedKeys([]);

                  reloadTemplate();

                }}

                request={async (params, _sort, _filter, searchFormValues) => {

                  const res = await supplierEvalTemplateApi.list(
                    resolveSupplierEvalTemplateListParams(searchFormValues, params),
                  );

                  return { data: res.data || [], success: true, total: res.total || 0 };

                }}

              />

            ),

          },

        ]}

      />

      <FormModalTemplate

        key={editingPlan?.id ?? 'plan-create'}

        title={editingPlan ? t(`${P}.editPlan`) : t(`${P}.createPlan`)}

        open={planModalOpen}

        width={MODAL_CONFIG.LARGE_WIDTH}

        grid={false}

        formRef={planFormRef}

        modalProps={{ destroyOnHidden: true }}

        initialValues={

          editingPlan

            ? {

                name: editingPlan.name,

                period_type: editingPlan.period_type ?? 'annual',

                period_year: editingPlan.period_year ?? currentEvalYear(),

                period_quarter: editingPlan.period_quarter,

                template_id: editingPlan.template_id,

                audit_mode: editingPlan.audit_mode ?? 'document',

                remarks: editingPlan.remarks,

                lines: (editingPlan.lines || []).map((line, idx) => ({

                  ...line,

                  line_no: line.line_no ?? idx + 1,

                })),

              }

            : {

                period_type: 'annual',

                period_year: currentEvalYear(),

                audit_mode: 'document',

                lines: [],

              }

        }

        onClose={() => {

          setPlanModalOpen(false);

          setEditingPlan(null);

        }}

        onFinish={async (values) => {

          try {

            const payload = {

              ...values,

              lines: (values.lines || []).map(

                (line: SupplierEvalPlanLine, idx: number) => ({

                  ...line,

                  line_no: line.line_no ?? idx + 1,

                }),

              ),

            };

            if (editingPlan?.id) {

              const updatePayload =

                editingPlan.status === 'released'

                  ? (({ lines: _lines, ...headerOnly }) => headerOnly)(payload)

                  : payload;

              await supplierEvalPlanApi.update(editingPlan.id, updatePayload);

              messageApi.success(t('common.updateSuccess'));

            } else {

              await supplierEvalPlanApi.create(payload);

              messageApi.success(t('common.createSuccess'));

            }

            setPlanModalOpen(false);

            setEditingPlan(null);

            reloadPlan();

          } catch (e) {

            messageApi.error(getApiErrorMessage(e));

            throw e;

          }

        }}

      >

        <Row gutter={16}>

          <Col span={12}>

            <ProFormText

              name="name"

              label={t(`${P}.colPlanName`)}

              rules={[{ required: true, message: t(`${P}.planNameRequired`) }]}

            />

          </Col>

          <Col span={12}>

            <ProFormSelect

              name="template_id"

              label={t(`${P}.colTemplate`)}

              options={activeTemplateOptions}

              rules={[{ required: true, message: t(`${P}.templateRequired`) }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={12}>

            <ProFormSelect

              name="period_type"

              label={t(`${P}.colPeriodType`)}

              options={periodOptions}

              rules={[{ required: true }]}

            />

          </Col>

          <Col span={12}>

            <ProFormDigit

              name="period_year"

              label={t(`${P}.colPeriodYear`)}

              min={2000}

              max={2100}

              fieldProps={{ precision: 0 }}

              rules={[{ required: true }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={12}>

            <ProFormDependency name={['period_type']}>

              {({ period_type }) =>

                period_type === 'quarterly' ? (

                  <ProFormSelect

                    name="period_quarter"

                    label={t(`${P}.colPeriodQuarter`)}

                    options={quarterOptions}

                    rules={[{ required: true, message: t(`${P}.quarterRequired`) }]}

                  />

                ) : null

              }

            </ProFormDependency>

          </Col>

          <Col span={12}>

            <ProFormSelect

              name="audit_mode"

              label={t(`${P}.colAuditMode`)}

              options={auditModeOptions}

              rules={[{ required: true }]}

            />

          </Col>

        </Row>

        <UniTableDetail

          name="lines"

          title={t(`${P}.sectionPlanSuppliers`)}

          required

          requiredMessage={t(`${P}.planSuppliersRequired`)}

          columns={planModalSupplierLineColumns}

          initialValue={EMPTY_PLAN_LINE}

          disabledAdd={editingPlan?.status === 'released' || editingPlan?.status === 'closed'}

          disabledRemove={editingPlan?.status === 'released' || editingPlan?.status === 'closed'}

        />

        <Row gutter={16}>

          <Col span={24}>

            <ProFormTextArea name="remarks" label={t('common.remark')} />

          </Col>

        </Row>

      </FormModalTemplate>

      <FormModalTemplate

        key={editingEval?.id ?? 'eval-create'}

        title={editingEval ? t(`${P}.editEval`) : t(`${P}.createEval`)}

        open={evalModalOpen}

        width={MODAL_CONFIG.LARGE_WIDTH}

        grid={false}

        formRef={evalFormRef}

        modalProps={{ destroyOnHidden: true }}

        initialValues={

          editingEval || {

            period_type: 'annual',

            period_year: currentEvalYear(),

            audit_mode: 'document',

            needs_rectification: false,

            lines: [],

          }

        }

        onClose={() => {

          setEvalModalOpen(false);

          setEditingEval(null);

        }}

        onFinish={async (values) => {

          try {

            if (editingEval?.id) {

              await supplierEvaluationApi.update(editingEval.id, values);

              messageApi.success(t('common.updateSuccess'));

            } else {

              await supplierEvaluationApi.create(values);

              messageApi.success(t('common.createSuccess'));

            }

            setEvalModalOpen(false);

            setEditingEval(null);

            reloadEval();

          } catch (e) {

            messageApi.error(getApiErrorMessage(e));

            throw e;

          }

        }}

      >

        <Row gutter={16}>

          <Col span={12}>

            <ProFormItem

              name="supplier_id"

              label={t(`${P}.colSupplier`)}

              rules={[{ required: true, message: t(`${P}.supplierRequired`) }]}

            >

              <SupplierSelectDropdown hostResource={RESOURCE} style={{ width: '100%' }} />

            </ProFormItem>

          </Col>

          <Col span={12}>

            <ProFormSelect

              name="template_id"

              label={t(`${P}.colTemplate`)}

              options={activeTemplateOptions}

              fieldProps={{

                style: { width: '100%' },

                onSelect: (value: number) => void handleEvalTemplateChange(value),

              }}

              rules={[{ required: true, message: t(`${P}.templateRequired`) }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={12}>

            <ProFormSelect

              name="period_type"

              label={t(`${P}.colPeriodType`)}

              options={periodOptions}

              rules={[{ required: true }]}

            />

          </Col>

          <Col span={12}>

            <ProFormDigit

              name="period_year"

              label={t(`${P}.colPeriodYear`)}

              min={2000}

              max={2100}

              fieldProps={{ precision: 0 }}

              rules={[{ required: true }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={12}>

            <ProFormDependency name={['period_type']}>

              {({ period_type }) =>

                period_type === 'quarterly' ? (

                  <ProFormSelect

                    name="period_quarter"

                    label={t(`${P}.colPeriodQuarter`)}

                    options={quarterOptions}

                    rules={[{ required: true, message: t(`${P}.quarterRequired`) }]}

                  />

                ) : null

              }

            </ProFormDependency>

          </Col>

          <Col span={12}>

            <ProFormSelect

              name="audit_mode"

              label={t(`${P}.colAuditMode`)}

              options={auditModeOptions}

              rules={[{ required: true }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={24}>

            <ProFormSwitch name="needs_rectification" label={t(`${P}.colNeedsRectification`)} />

          </Col>

        </Row>

        <ProFormDependency name={['needs_rectification']}>

          {({ needs_rectification }) =>

            needs_rectification ? (

              <>

                <ProFormTextArea

                  name="rectification_plan"

                  label={t(`${P}.colRectificationPlan`)}

                />

                <Row gutter={16}>

                  <Col span={12}>

                    <ProFormDatePicker

                      name="rectification_due"

                      label={t(`${P}.colRectificationDue`)}

                      fieldProps={EQUIPMENT_DATE_FIELD_PROPS}

                    />

                  </Col>

                </Row>

              </>

            ) : null

          }

        </ProFormDependency>

        <UniTableDetail

          name="lines"

          title={t(`${P}.sectionScoreLines`)}

          required

          requiredMessage={t(`${P}.scoreLinesRequired`)}

          columns={evalScoreLineColumns}

          disabledAdd

          disabledRemove

          hideOperation

        />

        <Row gutter={16}>

          <Col span={24}>

            <ProFormTextArea name="remarks" label={t('common.remark')} />

          </Col>

        </Row>

      </FormModalTemplate>

      <FormModalTemplate

        key={editingTemplate?.id ?? 'template-create'}

        title={editingTemplate ? t(`${P}.editTemplate`) : t(`${P}.createTemplate`)}

        open={templateModalOpen}

        width={MODAL_CONFIG.LARGE_WIDTH}

        grid={false}

        formRef={templateFormRef}

        modalProps={{ destroyOnHidden: true }}

        initialValues={

          editingTemplate

            ? {

                code: editingTemplate.code,

                name: editingTemplate.name,

                version: editingTemplate.version,

                grade_version: editingTemplate.grade_version,

                grade_bands: editingTemplate.grade_bands ?? DEFAULT_GRADE_BANDS,

                period_type: editingTemplate.period_type,

                is_active: editingTemplate.is_active ?? true,

                remarks: editingTemplate.remarks,

                clauses: (editingTemplate.clauses || []).map((c, idx) => ({

                  ...c,

                  line_no: c.line_no ?? idx + 1,

                })),

              }

            : {

                version: 'v1',

                grade_version: 'v1',

                grade_bands: DEFAULT_GRADE_BANDS,

                period_type: 'annual',

                is_active: true,

                clauses: [],

              }

        }

        onClose={() => {

          setTemplateModalOpen(false);

          setEditingTemplate(null);

        }}

        onFinish={async (values) => {

          try {

            const payload = {

              ...values,

              grade_bands: values.grade_bands ?? DEFAULT_GRADE_BANDS,

              clauses: (values.clauses || []).map(

                (c: SupplierEvalTemplateClause, idx: number) => ({

                  ...c,

                  line_no: c.line_no ?? idx + 1,

                }),

              ),

            };

            if (editingTemplate?.id) {

              await supplierEvalTemplateApi.update(editingTemplate.id, payload);

              messageApi.success(t('common.updateSuccess'));

            } else {

              await supplierEvalTemplateApi.create(payload);

              messageApi.success(t('common.createSuccess'));

            }

            setTemplateModalOpen(false);

            setEditingTemplate(null);

            reloadTemplate();

          } catch (e) {

            messageApi.error(getApiErrorMessage(e));

            throw e;

          }

        }}

      >

        <Row gutter={16}>

          <Col span={12}>

            <ProFormText

              name="code"

              label={t(`${P}.colTemplateCode`)}

              disabled={Boolean(editingTemplate)}

            />

          </Col>

          <Col span={12}>

            <ProFormText

              name="name"

              label={t(`${P}.colTemplateName`)}

              rules={[{ required: true }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={8}>

            <ProFormText name="version" label={t(`${P}.colTemplateVersion`)} />

          </Col>

          <Col span={8}>

            <ProFormText name="grade_version" label={t(`${P}.colGradeVersion`)} />

          </Col>

          <Col span={8}>

            <ProFormSelect

              name="period_type"

              label={t(`${P}.colPeriodType`)}

              options={periodOptions}

              allowClear

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={12}>

            <ProFormSwitch name="is_active" label={t(`${P}.colTemplateActive`)} />

          </Col>

          <Col span={12}>

            <ProFormItem label={t(`${P}.colGradeBands`)}>

              <Space wrap size={8}>

                {DEFAULT_GRADE_BANDS.map((band) => (

                  <MarkerTag key={band.grade} color="blue">

                    {t(`${P}.gradeBandLabel`, { grade: band.grade, min: band.min })}

                  </MarkerTag>

                ))}

              </Space>

            </ProFormItem>

          </Col>

        </Row>

        <ProFormItem name="grade_bands" hidden initialValue={DEFAULT_GRADE_BANDS}>

          <Input />

        </ProFormItem>

        <UniTableDetail

          name="clauses"

          title={t(`${P}.sectionClauses`)}

          required

          requiredMessage={t(`${P}.clausesRequired`)}

          columns={templateClauseColumns}

          initialValue={EMPTY_CLAUSE}

        />

        <Row gutter={16}>

          <Col span={24}>

            <ProFormTextArea name="remarks" label={t('common.remark')} />

          </Col>

        </Row>

      </FormModalTemplate>

      <FormModalTemplate

        title={editingEnv ? t(`${P}.editEnv`) : t(`${P}.createEnv`)}

        open={envModalOpen}

        width={MODAL_CONFIG.STANDARD_WIDTH}

        grid={false}

        initialValues={editingEnv || { doc_type: 'other' }}

        onClose={() => setEnvModalOpen(false)}

        onFinish={async (values) => {

          try {

            if (editingEnv?.id) {

              await supplierEvalEnvDocumentApi.update(editingEnv.id, values);

              messageApi.success(t('common.updateSuccess'));

            } else {

              await supplierEvalEnvDocumentApi.create(values);

              messageApi.success(t('common.createSuccess'));

            }

            setEnvModalOpen(false);

            reloadEnv();

          } catch (e) {

            messageApi.error(getApiErrorMessage(e));

            throw e;

          }

        }}

      >

        <Row gutter={16}>

          <Col span={12}>

            <ProFormItem

              name="supplier_id"

              label={t(`${P}.colSupplier`)}

              rules={[{ required: true, message: t(`${P}.supplierRequired`) }]}

            >

              <SupplierSelectDropdown hostResource={RESOURCE} style={{ width: '100%' }} />

            </ProFormItem>

          </Col>

          <Col span={12}>

            <ProFormSelect

              name="doc_type"

              label={t(`${P}.colEnvDocType`)}

              options={envDocTypeOptions}

              rules={[{ required: true }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={12}>

            <UniMaterialSelect

              name="material_id"

              label={t(`${P}.colMaterial`)}

              required

              placeholder={t('common.selectMaterial')}

              fallbackOption={

                editingEnv?.material_id

                  ? {

                      value: editingEnv.material_id,

                      label: [editingEnv.material_code, editingEnv.material_name]

                        .filter(Boolean)

                        .join(' '),

                    }

                  : undefined

              }

            />

          </Col>

          <Col span={12}>

            <ProFormText

              name="material_description"

              label={t(`${P}.colMaterialDescription`)}

              rules={[{ required: true, message: t(`${P}.materialDescriptionRequired`) }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={24}>

            <ProFormText

              name="title"

              label={t(`${P}.colEnvTitle`)}

              rules={[{ required: true }]}

            />

          </Col>

        </Row>

        <Row gutter={16}>

          <Col span={12}>

            <ProFormDatePicker

              name="issued_at"

              label={t(`${P}.colIssuedAt`)}

              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}

            />

          </Col>

          <Col span={12}>

            <ProFormDatePicker

              name="expires_at"

              label={t(`${P}.colExpiresAt`)}

              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}

            />

          </Col>

        </Row>

        <ProFormTextArea name="remarks" label={t('common.remark')} />

      </FormModalTemplate>

      <DetailDrawerTemplate

        title={detail?.code || t(`${P}.title`)}

        open={detailOpen}

        width={DRAWER_CONFIG.HALF_WIDTH}

        loading={detailLoading}

        onClose={() => setDetailOpen(false)}

        extra={detailExtra}

        basic={

          detailError ? (

            <Result

              status="error"

              title={t('common.loadFailed')}

              subTitle={detailError}

              extra={

                <Button type="primary" onClick={() => detail?.id && void openDetail(detail)}>

                  {t('common.retry')}

                </Button>

              }

            />

          ) : detail ? (

            detailItems

          ) : undefined

        }

        linesTitle={t(`${P}.sectionScoreLines`)}

        lines={

          detail ? (

            <Table

              size="small"

              pagination={false}

              rowKey={(row, i) => String((row as SupplierEvaluationLine).id ?? i)}

              dataSource={detail.lines || []}

              columns={detailLineColumns}

              locale={{ emptyText: t(`${P}.emptyScoreLines`) }}

            />

          ) : undefined

        }

      />

      <Modal
        title={t('core.extensionHost.supplierAuditPlan.modalTitle')}
        open={auditPlanGuideOpen}
        destroyOnHidden
        width={920}
        footer={null}
        onCancel={() => setAuditPlanGuideOpen(false)}
      >
        <Table
          size="small"
          rowKey="key"
          pagination={false}
          style={{ marginBottom: 16 }}
          dataSource={auditPlanGuide?.line_fields || []}
          columns={[
            {
              title: t('core.extensionHost.supplierAuditPlan.colField'),
              dataIndex: 'label',
            },
            {
              title: t('core.extensionHost.supplierAuditPlan.colType'),
              dataIndex: 'type',
              width: 120,
            },
          ]}
        />
        {auditPlanGuide?.month_tracking ? (
          <Table
            size="small"
            rowKey="key"
            pagination={false}
            dataSource={auditPlanGuide.month_tracking.row_kinds || []}
            columns={[
              {
                title: t('core.extensionHost.supplierAuditPlan.monthTracking'),
                dataIndex: 'label',
              },
              {
                title: t('core.extensionHost.supplierAuditPlan.months'),
                render: () => (auditPlanGuide.month_tracking?.months || []).join('、'),
              },
            ]}
          />
        ) : null}
      </Modal>

      <Modal

        title={t(`${P}.closeRectificationTitle`)}

        open={closeRectOpen}

        onCancel={() => {

          setCloseRectOpen(false);

          setCloseRectTarget(null);

        }}

        onOk={() => void submitCloseRectification()}

        confirmLoading={closeRectSubmitting}

        destroyOnHidden

      >

        <Input.TextArea
          rows={4}
          value={closeRectResult}
          onChange={(e) => setCloseRectResult(e.target.value)}
          placeholder={t(`${P}.closeRectificationPlaceholder`)}
        />

      </Modal>

    </>

  );

};

export default SupplierEvaluationsPage;

