/**
 * 试流列表（R-08）
 * 菜单待 DoD 后挂入；路由 /apps/kuaiplm/trial-flows
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import type { ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ActionType,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Descriptions,
  Input,
  Modal,
  Result,
  Select,
  Space,
  Table,
} from 'antd';
import { UniTable } from '../../../../components/uni-table';
import { rowActionKind, RowActionButton } from '../../../../components/uni-action';
import TrialFlowFormModal from '../../components/TrialFlowFormModal';
import {
  DetailDrawerSection,
  DetailDrawerTemplate,
  ListPageTemplate,
  detailDrawerBasicColumn,
} from '../../../../components/layout-templates';
import { detailDrawerDescriptionItems } from '../../../../components/layout-templates/detailDrawerDescriptionItems';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { getApiErrorMessage } from '../../../../utils/errorHandler';
import { todaySiteDateString } from '../../../../utils/format';
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
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';
import {
  trialFlowApi,
  type TrialFlow,
  type TrialFlowBusinessType,
  type TrialFlowFormProfile,
  type TrialFlowStatus,
} from '../../services/trial-flow';
import { isIndustryFormProfileActive } from '../../../../utils/industryFormProfile';
import {
  formatHeaderFieldDisplayValue,
  sortedHeaderFields,
} from '../../utils/trialFlowFormProfile';

const RESOURCE = 'kuaiplm:trial-flow';
const STATUS_KEYS: TrialFlowStatus[] = [
  'draft',
  'pending',
  'approved',
  'in_progress',
  'concluded',
  'closed',
];
const TYPE_KEYS: TrialFlowBusinessType[] = ['component', 'structure', 'complete'];

const TRIAL_FLOW_EXPORT_COLUMNS: ExportXlsxColumn[] = [
  { key: 'trial_code', title: '试流单号' },
  { key: 'project_code', title: '项目代号' },
  { key: 'project_name', title: '项目名称' },
  { key: 'business_type_label', title: '业务类型' },
  { key: 'title', title: '标题' },
  { key: 'current_step_key', title: '当前工序' },
  { key: 'status_label', title: '状态' },
  { key: 'conclusion', title: '结论' },
  { key: 'remarks', title: '备注' },
  { key: 'created_by_name', title: '创建人' },
  { key: 'updated_by_name', title: '更新人' },
  { key: 'created_at', title: '创建时间' },
  { key: 'updated_at', title: '更新时间' },
];

const TrialFlowsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const [searchParams] = useSearchParams();
  const filterProjectId = searchParams.get('project_id')
    ? Number(searchParams.get('project_id'))
    : undefined;

  const actionRef = useRef<ActionType>(null);
  const tableRowsRef = useRef<TrialFlow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formProfile, setFormProfile] = useState<TrialFlowFormProfile | null>(null);
  const [editing, setEditing] = useState<TrialFlow | null>(null);
  const [detail, setDetail] = useState<TrialFlow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [fillOpen, setFillOpen] = useState(false);
  const [fillStepKey, setFillStepKey] = useState<string | null>(null);
  const [fillResult, setFillResult] = useState<string>('pass');
  const [fillNotes, setFillNotes] = useState('');
  const [fillDescription, setFillDescription] = useState('');
  const [fillDefectRate, setFillDefectRate] = useState<string>('');
  const [concludeOpen, setConcludeOpen] = useState(false);
  const [conclusion, setConclusion] = useState<string>('pass');
  const [conclusionSummary, setConclusionSummary] = useState('');

  useEffect(() => {
    let cancelled = false;
    void trialFlowApi
      .formProfile()
      .then((p) => {
        if (!cancelled) setFormProfile(p);
      })
      .catch(() => {
        if (!cancelled) setFormProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const industryProfileActive = isIndustryFormProfileActive(formProfile);
  const profileHeaderFields = useMemo(
    () => sortedHeaderFields(formProfile, industryProfileActive),
    [formProfile, industryProfileActive],
  );

  const reload = useCallback(() => actionRef.current?.reload(), []);
  const refreshDetail = useCallback(async (id: number) => {
    const full = await trialFlowApi.get(id);
    setDetail(full);
    reload();
    return full;
  }, [reload]);
  const openCreate = useCallback(() => {
    setEditing(null);
    setModalOpen(true);
  }, []);

  const statusLabel = useCallback(
    (s: string) => t(`app.kuaiplm.trialFlow.status.${s}`, { defaultValue: s }),
    [t],
  );
  const typeLabel = useCallback(
    (s: string) => t(`app.kuaiplm.trialFlow.businessType.${s}`, { defaultValue: s }),
    [t],
  );

  const openDetail = useCallback(async (row: TrialFlow) => {
    if (!row.id) return;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(row);
    try {
      setDetail(await trialFlowApi.get(row.id));
    } catch (e) {
      setDetailError(getApiErrorMessage(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const openEdit = useCallback(
    async (row: TrialFlow) => {
      if (!row.id) return;
      try {
        const full = await trialFlowApi.get(row.id);
        setEditing(full);
        setModalOpen(true);
      } catch (e) {
        messageApi.error(getApiErrorMessage(e));
      }
    },
    [messageApi],
  );

  const columns = useMemo<ProColumns<TrialFlow>[]>(() => {
    const cols: ProColumns<TrialFlow>[] = [
      {
        title: t('app.kuaiplm.trialFlow.fields.code'),
        dataIndex: 'trial_code',
        key: 'document_code',
        width: 140,
        minWidth: 140,
        copyable: true,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.trialFlow.fields.project'),
        dataIndex: 'project_name',
        key: 'project_name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        render: (_, r) => `${r.project_name || ''} (${r.project_code || ''})`,
      },
      {
        title: t('app.kuaiplm.trialFlow.fields.businessType'),
        dataIndex: 'business_type',
        key: 'business_type',
        width: 110,
        minWidth: 110,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, r) => <MarkerTag>{typeLabel(r.business_type)}</MarkerTag>,
      },
      {
        title: t('app.kuaiplm.trialFlow.fields.title'),
        dataIndex: 'title',
        key: 'title',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        ellipsis: true,
      },
      {
        title: t('app.kuaiplm.trialFlow.fields.currentStep'),
        dataIndex: 'current_step_key',
        key: 'current_step_key',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        render: (_, r) => r.current_step_key || '—',
      },
      {
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        title: t('common.status'),
        dataIndex: 'status',
        key: 'lifecycle',
        fixed: 'right',
        valueEnum: Object.fromEntries(STATUS_KEYS.map((k) => [k, { text: statusLabel(k) }])),
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      ...buildDocumentAuditColumns(t),
      {
        title: t('common.action'),
        valueType: 'option',
        key: 'option',
        fixed: 'right',
        render: (_, row) => {
          const actions: React.ReactNode[] = [
            <Button
              key="detail"
              type="link"
              size="small"
              {...rowActionKind('read')}
              onClick={() => void openDetail(row)}
            />,
          ];
          if (row.status === 'draft' && perms.canUpdate) {
            actions.push(
              <Button
                key="edit"
                type="link"
                size="small"
                {...rowActionKind('update')}
                onClick={() => void openEdit(row)}
              />,
            );
          }
          if (row.status === 'draft' && perms.canAction?.('submit') && row.id) {
            actions.push(
              <Button
                key="submit"
                type="link"
                size="small"
                {...rowActionKind('submit')}
                onClick={async () => {
                  try {
                    await trialFlowApi.submit(row.id!);
                    messageApi.success(t('app.kuaiplm.trialFlow.messages.submitSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('approve') && row.id) {
            actions.push(
              <Button
                key="approve"
                type="link"
                size="small"
                {...rowActionKind('approve')}
                onClick={async () => {
                  try {
                    await trialFlowApi.approve(row.id!);
                    messageApi.success(t('app.kuaiplm.trialFlow.messages.approveSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          if (row.status === 'pending' && perms.canAction?.('reject') && row.id) {
            actions.push(
              <Button
                key="reject"
                type="link"
                size="small"
                {...rowActionKind('reject')}
                onClick={async () => {
                  try {
                    await trialFlowApi.reject(row.id!);
                    messageApi.success(t('app.kuaiplm.trialFlow.messages.rejectSuccess'));
                    reload();
                  } catch (e) {
                    messageApi.error(getApiErrorMessage(e));
                  }
                }}
              />,
            );
          }
          return actions;
        },
      },
    ];
    return cols;
  }, [t, statusLabel, typeLabel, openDetail, openEdit, perms, messageApi, reload]);

  const basicColumns = useMemo(() => {
    const cols: ProDescriptionsItemProps<TrialFlow>[] = [
      {
        key: 'document_code',
        title: t('app.kuaiplm.trialFlow.fields.code'),
        dataIndex: 'trial_code',
      },
      {
        key: 'project_name',
        title: t('app.kuaiplm.trialFlow.fields.project'),
        dataIndex: 'project_name',
        render: (_, r) => `${r.project_name} (${r.project_code})`,
      },
      {
        key: 'business_type',
        title: t('app.kuaiplm.trialFlow.fields.businessType'),
        dataIndex: 'business_type',
        render: (_, r) => typeLabel(r.business_type),
      },
      { key: 'title', title: t('app.kuaiplm.trialFlow.fields.title'), dataIndex: 'title' },
      ...profileHeaderFields.map((field) => ({
        key: field.key,
        title: field.label,
        dataIndex: field.key,
        render: (_: unknown, r: TrialFlow) =>
          formatHeaderFieldDisplayValue(field, r.extension_payload?.[field.key], t),
      })),
      {
        key: 'lifecycle',
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(statusLabel(r.status), r.status),
      },
      {
        key: 'current_step_key',
        title: t('app.kuaiplm.trialFlow.fields.currentStep'),
        dataIndex: 'current_step_key',
      },
      {
        key: 'conclusion',
        title: t('app.kuaiplm.trialFlow.fields.conclusion'),
        dataIndex: 'conclusion',
      },
      { key: 'updated_at', title: t('common.updatedAt'), dataIndex: 'updated_at' },
    ];
    return alignDescriptionColumns(
      cols as ProDescriptionsItemProps<Record<string, unknown>>[],
      GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
    );
  }, [t, statusLabel, typeLabel, profileHeaderFields]);

  return (
    <ListPageTemplate>
      <UniTable<TrialFlow>
        headerTitle={t('app.kuaiplm.trialFlow.title')}
        actionRef={actionRef}
        rowKey="uuid"
        permissionResource={RESOURCE}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        columns={alignProColumns(columns, GLOBAL_DOC_LIST_FIELD_RANK)}
        columnPersistenceId="apps.kuaiplm.pages.trial-flows.width-v2"
        showCreateButton={perms.canCreate}
        createButtonText={t('app.kuaiplm.trialFlow.createButton') + NEW_SHORTCUT_HINT}
        onCreate={openCreate}
        showDeleteButton={perms.canDelete}
        onDelete={async (keys) => {
          const rows = tableRowsRef.current.filter((r) => keys.includes(r.uuid));
          const drafts = rows.filter((r) => r.status === 'draft' && r.id);
          if (!drafts.length) {
            messageApi.warning(t('app.kuaiplm.trialFlow.messages.deleteOnlyDraft'));
            return;
          }
          await Promise.all(drafts.map((r) => trialFlowApi.remove(r.id!)));
          messageApi.success(t('common.deleteSuccess'));
          setSelectedRowKeys([]);
          reload();
        }}
        showExportButton={perms.canExport}
        onExport={async (type, keys, pageData) => {
          try {
            let items =
              type === 'currentPage' && pageData?.length
                ? (pageData as TrialFlow[])
                : await fetchAllListItems((p) =>
                    trialFlowApi.list({
                      ...p,
                      project_id: filterProjectId,
                    }),
                  );
            if (type === 'selected' && keys?.length) {
              items = items.filter((d) => d.uuid != null && keys.includes(d.uuid));
            }
            if (items.length === 0) {
              messageApi.warning(t('app.kuaiplm.trialFlow.messages.noExportData'));
              return;
            }
            const rows = items.map((r) => ({
              ...r,
              status_label: statusLabel(r.status),
              business_type_label: typeLabel(r.business_type),
            }));
            await downloadRecordsAsXlsx(
              rows as Array<Record<string, unknown>>,
              `trial-flows-${todaySiteDateString()}.xlsx`,
              { columns: TRIAL_FLOW_EXPORT_COLUMNS, sheetName: '试流管理' },
            );
            messageApi.success(t('common.exportSuccess', { count: items.length }));
          } catch (err) {
            messageApi.error(getApiErrorMessage(err, t('common.exportFailed')));
          }
        }}
        request={async (params) => {
          const res = await trialFlowApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            status: params.status as string | undefined,
            business_type: params.business_type as string | undefined,
            keyword: (params.keyword || params.title) as string | undefined,
            project_id: filterProjectId,
          });
          return { data: res.items, total: res.total, success: true };
        }}
      />

      <TrialFlowFormModal
        open={modalOpen}
        editing={editing}
        filterProjectId={filterProjectId}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSuccess={reload}
      />

      <DetailDrawerTemplate
        open={!!detail}
        onClose={() => {
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.trial_code || t('app.kuaiplm.trialFlow.title')}
        loading={detailLoading}
        extra={
          detail && !detailError && detail.id ? (
            <Space size={8} wrap>
              {detail.status === 'in_progress' &&
              perms.canAction?.('execute') &&
              !(detail.steps || []).some((s) => s.status === 'pending') ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    setConclusion('pass');
                    setConclusionSummary('');
                    setConcludeOpen(true);
                  }}
                >
                  {t('app.kuaiplm.trialFlow.actions.conclude')}
                </Button>
              ) : null}
              {detail.status === 'concluded' && perms.canAction?.('execute') ? (
                <Button
                  type="primary"
                  size="small"
                  onClick={async () => {
                    try {
                      await trialFlowApi.close(detail.id!);
                      messageApi.success(t('app.kuaiplm.trialFlow.messages.closeSuccess'));
                      await refreshDetail(detail.id!);
                    } catch (e) {
                      messageApi.error(getApiErrorMessage(e));
                    }
                  }}
                >
                  {t('app.kuaiplm.trialFlow.actions.close')}
                </Button>
              ) : null}
            </Space>
          ) : null
        }
        plainBody={
          detailError ? (
            <Result
              status="error"
              title={t('common.loadFailed')}
              subTitle={detailError}
              extra={
                detail?.id ? (
                  <Button type="primary" onClick={() => void openDetail(detail)}>
                    {t('common.retry')}
                  </Button>
                ) : null
              }
            />
          ) : undefined
        }
        basic={
          detail && !detailError ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              size="small"
              items={detailDrawerDescriptionItems(basicColumns, detail)}
            />
          ) : detailError ? null : (
            <div style={{ minHeight: 80 }} />
          )
        }
        lines={
          detail && !detailError ? (
            <>
              <DetailDrawerSection title={t('app.kuaiplm.trialFlow.fields.materials')} titleAccent>
                <Table
                  size="small"
                  rowKey={(r) => String(r.id ?? r.material_code)}
                  pagination={false}
                  dataSource={detail.materials || []}
                  columns={[
                    {
                      title: t('app.kuaiplm.trialFlow.fields.materialCode'),
                      dataIndex: 'material_code',
                    },
                    {
                      title: t('app.kuaiplm.trialFlow.fields.materialName'),
                      dataIndex: 'material_name',
                    },
                    { title: t('app.kuaiplm.trialFlow.fields.qty'), dataIndex: 'qty', width: 80 },
                    { title: t('app.kuaiplm.trialFlow.fields.unit'), dataIndex: 'unit', width: 60 },
                  ]}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaiplm.trialFlow.fields.steps')} titleAccent>
                <Table
                  size="small"
                  rowKey="step_key"
                  pagination={false}
                  dataSource={detail.steps || []}
                  columns={[
                    {
                      title: t('app.kuaiplm.trialFlow.fields.stepName'),
                      dataIndex: 'step_name',
                    },
                    { title: t('common.status'), dataIndex: 'status', width: 90 },
                    {
                      title: t('app.kuaiplm.trialFlow.fields.stepResult'),
                      dataIndex: 'result',
                      width: 90,
                      render: (v) => v || '—',
                    },
                    {
                      title: t('app.kuaiplm.trialFlow.fields.filledBy'),
                      dataIndex: 'filled_by_name',
                      width: 100,
                      render: (v) => v || '—',
                    },
                    {
                      title: t('common.action'),
                      key: 'op',
                      width: 88,
                      fixed: 'right',
                      render: (_, step) => {
                        if (
                          detail.status !== 'in_progress' ||
                          !perms.canAction?.('execute') ||
                          step.status !== 'pending' ||
                          (detail.current_step_key && step.step_key !== detail.current_step_key)
                        ) {
                          return null;
                        }
                        return (
                          <RowActionButton
                            kind="execute"
                            labelKeep
                            onClick={() => {
                              setFillStepKey(step.step_key);
                              setFillResult('pass');
                              setFillNotes('');
                              setFillDescription('');
                              setFillDefectRate('');
                              setFillOpen(true);
                            }}
                          >
                            {t('app.kuaiplm.trialFlow.actions.fillStep')}
                          </RowActionButton>
                        );
                      },
                    },
                  ]}
                />
              </DetailDrawerSection>
            </>
          ) : undefined
        }
      />

      <Modal
        title={t('app.kuaiplm.trialFlow.actions.fillStep')}
        open={fillOpen}
        destroyOnHidden
        onCancel={() => setFillOpen(false)}
        onOk={async () => {
          if (!detail?.id || !fillStepKey) return;
          try {
            await trialFlowApi.fillStep(detail.id, fillStepKey, {
              result: fillResult,
              result_notes: fillNotes || undefined,
              step_description: fillDescription.trim() || undefined,
              defect_rate:
                fillDefectRate.trim() === '' ? undefined : Number(fillDefectRate),
            });
            messageApi.success(t('app.kuaiplm.trialFlow.messages.fillSuccess'));
            setFillOpen(false);
            await refreshDetail(detail.id);
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.trialFlow.fields.stepResult')}</div>
          <Select
            style={{ width: '100%' }}
            value={fillResult}
            onChange={setFillResult}
            options={[
              { value: 'pass', label: t('app.kuaiplm.trialFlow.stepResult.pass') },
              { value: 'fail', label: t('app.kuaiplm.trialFlow.stepResult.fail') },
              { value: 'na', label: t('app.kuaiplm.trialFlow.stepResult.na') },
            ]}
          />
        </div>
        {detail?.business_type === 'complete' ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.trialFlow.fields.stepDescription')}</div>
              <Input.TextArea
                rows={2}
                value={fillDescription}
                onChange={(e) => setFillDescription(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.trialFlow.fields.defectRate')}</div>
              <Input
                value={fillDefectRate}
                onChange={(e) => setFillDefectRate(e.target.value)}
                placeholder="0-100"
              />
            </div>
          </>
        ) : null}
        <div>
          <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.trialFlow.fields.resultNotes')}</div>
          <Input.TextArea rows={3} value={fillNotes} onChange={(e) => setFillNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal
        title={t('app.kuaiplm.trialFlow.actions.conclude')}
        open={concludeOpen}
        destroyOnHidden
        onCancel={() => setConcludeOpen(false)}
        onOk={async () => {
          if (!detail?.id) return;
          try {
            await trialFlowApi.conclude(detail.id, {
              conclusion,
              conclusion_summary: conclusionSummary || undefined,
            });
            messageApi.success(t('app.kuaiplm.trialFlow.messages.concludeSuccess'));
            setConcludeOpen(false);
            await refreshDetail(detail.id);
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.trialFlow.fields.conclusion')}</div>
          <Select
            style={{ width: '100%' }}
            value={conclusion}
            onChange={setConclusion}
            options={[
              { value: 'pass', label: t('app.kuaiplm.trialFlow.conclusion.pass') },
              { value: 'fail', label: t('app.kuaiplm.trialFlow.conclusion.fail') },
              { value: 'conditional', label: t('app.kuaiplm.trialFlow.conclusion.conditional') },
            ]}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.trialFlow.fields.conclusionSummary')}</div>
          <Input.TextArea
            rows={3}
            value={conclusionSummary}
            onChange={(e) => setConclusionSummary(e.target.value)}
          />
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default TrialFlowsPage;
