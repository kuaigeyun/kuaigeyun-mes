/**
 * 年度实验计划（R-07）
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import {
  ProFormDigit,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Input, Modal, Result, Row, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UniTable } from '../../../../components/uni-table';
import { UniTableStackedPrimaryCell } from '../../../../components/uni-table/stackedPrimaryColumn';
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
import { renderDocumentStatusTag } from '../../../../utils/documentLifecycleStatusTag';
import { MarkerTag } from '../../../../constants/statusBadges';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../utils/uniTableLayoutColumns';
import { buildDocumentAuditColumns } from '../../../kuaizhizao/pages/shared/documentAuditColumns';
import {
  alignDescriptionColumns,
  alignProColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
  GLOBAL_DOC_LIST_FIELD_RANK,
} from '../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import {
  annualLabPlanApi,
  type AnnualLabPlan,
  type AnnualLabPlanMonth,
  type AnnualLabPlanStatus,
} from '../../services/annual-lab-plan';

const RESOURCE = 'kuaiplm:annual-lab-plan';
const STATUS_KEYS: AnnualLabPlanStatus[] = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'closed',
];

const AnnualLabPlansPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const canSubmit = !!perms.canAction?.('submit');
  const canApprove = !!perms.canAction?.('approve');
  const canReject = !!perms.canAction?.('reject');
  const actionRef = useRef<ActionType>();
  const formRef = useRef<any>(null);
  const tableRowsRef = useRef<AnnualLabPlan[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnualLabPlan | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<AnnualLabPlan | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryIdRef = useRef<number | null>(null);
  const [monthEdit, setMonthEdit] = useState<AnnualLabPlanMonth | null>(null);
  const [monthDraft, setMonthDraft] = useState<Partial<AnnualLabPlanMonth>>({});

  const statusLabel = useCallback(
    (v?: string) => t(`app.kuaiplm.annualLabPlan.status.${v || 'draft'}`),
    [t],
  );
  const monthStatusLabel = useCallback(
    (v?: string) => t(`app.kuaiplm.annualLabPlan.monthStatus.${v || 'pending'}`),
    [t],
  );
  const issueStatusLabel = useCallback(
    (v?: string) => t(`app.kuaiplm.annualLabPlan.issueStatus.${v || 'none'}`),
    [t],
  );

  const loadDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const row = await annualLabPlanApi.get(id);
      setDetail(row);
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.kuaiplm.annualLabPlan.loadFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const openDetail = (record: AnnualLabPlan) => {
    if (record.id == null) return;
    detailRetryIdRef.current = record.id;
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(record.id);
  };

  const handleBatchDelete = async (keys: React.Key[]) => {
    const deletable = tableRowsRef.current.filter(
      (r) =>
        keys.includes(r.id as React.Key) &&
        (r.status === 'draft' || r.status === 'rejected') &&
        r.id != null,
    );
    if (!deletable.length) {
      messageApi.warning(t('app.kuaiplm.annualLabPlan.deleteOnlyDraft'));
      return;
    }
    for (const row of deletable) {
      await annualLabPlanApi.delete(row.id!);
    }
    messageApi.success(t('common.batchDeleteSuccess', { count: deletable.length }));
    actionRef.current?.reload();
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = async (record: AnnualLabPlan) => {
    try {
      const row = await annualLabPlanApi.get(record.id!);
      setEditing(row);
      setModalOpen(true);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error));
    }
  };

  const reloadDetail = async () => {
    if (detail?.id != null) await loadDetail(detail.id);
    actionRef.current?.reload();
  };

  const columns = useMemo<ProColumns<AnnualLabPlan>[]>(
    () =>
      alignProColumns(
        [
          {
            title: t('app.kuaiplm.annualLabPlan.colPlan'),
            dataIndex: 'title',
            key: 'title',
            minWidth: 160,
            uniTablePrimaryFlex: true,
            uniTableRemainderFlex: true,
            ellipsis: true,
            render: (_, record) => (
              <UniTableStackedPrimaryCell
                primary={record.title}
                secondary={record.plan_code}
              />
            ),
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colYear'),
            dataIndex: 'plan_year',
            key: 'plan_year',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colProgress'),
            dataIndex: 'completed_months',
            key: 'completed_months',
            width: 110,
            minWidth: 110,
            search: false,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, record) =>
              `${record.completed_months || 0}/${record.total_months || 12}`,
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colOwner'),
            dataIndex: 'owner_user_name',
            key: 'owner_user_name',
            width: 120,
            minWidth: 120,
            search: false,
            uniTableKeepWidth: true,
            resizable: false,
            ellipsis: true,
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colStatus'),
            dataIndex: 'status',
            key: 'lifecycle',
            valueType: 'select',
            valueEnum: Object.fromEntries(
              STATUS_KEYS.map((k) => [k, { text: statusLabel(k) }]),
            ),
            ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
            fixed: 'right',
            render: (_, record) =>
              renderDocumentStatusTag(statusLabel(record.status), record.status || 'draft'),
          },
          ...buildDocumentAuditColumns<AnnualLabPlan>(t),
          {
            title: t('common.action'),
            valueType: 'option',
            key: 'option',
            fixed: 'right',
            render: (_, record) =>
              [
                {
                  key: 'detail',
                  ...rowActionKind('read'),
                  onClick: () => openDetail(record),
                },
                perms.canUpdate &&
                (record.status === 'draft' || record.status === 'rejected')
                  ? {
                      key: 'edit',
                      ...rowActionKind('update'),
                      onClick: () => void openEdit(record),
                    }
                  : null,
                canSubmit &&
                (record.status === 'draft' || record.status === 'rejected')
                  ? {
                      key: 'submit',
                      ...rowActionKind('submit'),
                      confirm: {
                        title: t('app.kuaiplm.annualLabPlan.submitConfirm'),
                        onConfirm: async () => {
                          try {
                            await annualLabPlanApi.submit(record.id!);
                            messageApi.success(t('app.kuaiplm.annualLabPlan.submitSuccess'));
                            actionRef.current?.reload();
                          } catch (error) {
                            messageApi.error(getApiErrorMessage(error));
                          }
                        },
                      },
                    }
                  : null,
                canApprove && record.status === 'pending'
                  ? {
                      key: 'approve',
                      ...rowActionKind('approve'),
                      confirm: {
                        title: t('app.kuaiplm.annualLabPlan.approveConfirm'),
                        onConfirm: async () => {
                          try {
                            await annualLabPlanApi.approve(record.id!);
                            messageApi.success(t('app.kuaiplm.annualLabPlan.approveSuccess'));
                            actionRef.current?.reload();
                          } catch (error) {
                            messageApi.error(getApiErrorMessage(error));
                          }
                        },
                      },
                    }
                  : null,
                canReject && record.status === 'pending'
                  ? {
                      key: 'reject',
                      ...rowActionKind('reject'),
                      onClick: () => {
                        let reason = '';
                        modal.confirm({
                          title: t('app.kuaiplm.annualLabPlan.rejectConfirm'),
                          content: (
                            <Input.TextArea
                              rows={3}
                              placeholder={t('app.kuaiplm.annualLabPlan.rejectReason')}
                              onChange={(e) => {
                                reason = e.target.value;
                              }}
                            />
                          ),
                          onOk: async () => {
                            if (!reason.trim()) {
                              messageApi.error(t('app.kuaiplm.annualLabPlan.rejectReason'));
                              throw new Error('reason required');
                            }
                            try {
                              await annualLabPlanApi.reject(record.id!, reason.trim());
                              messageApi.success(t('app.kuaiplm.annualLabPlan.rejectSuccess'));
                              actionRef.current?.reload();
                            } catch (error) {
                              messageApi.error(getApiErrorMessage(error));
                              throw error;
                            }
                          },
                        });
                      },
                    }
                  : null,
                perms.canUpdate && record.status === 'approved'
                  ? {
                      key: 'close',
                      ...rowActionKind('complete'),
                      text: t('app.kuaiplm.annualLabPlan.actions.close'),
                      confirm: {
                        title: t('app.kuaiplm.annualLabPlan.closeConfirm'),
                        onConfirm: async () => {
                          try {
                            await annualLabPlanApi.close(record.id!);
                            messageApi.success(t('app.kuaiplm.annualLabPlan.closeSuccess'));
                            actionRef.current?.reload();
                          } catch (error) {
                            messageApi.error(getApiErrorMessage(error));
                          }
                        },
                      },
                    }
                  : null,
                perms.canDelete &&
                (record.status === 'draft' || record.status === 'rejected')
                  ? {
                      key: 'delete',
                      ...rowActionKind('delete'),
                      confirm: {
                        title: t('app.kuaiplm.annualLabPlan.deleteConfirm'),
                        onConfirm: async () => {
                          try {
                            await annualLabPlanApi.delete(record.id!);
                            messageApi.success(t('app.kuaiplm.annualLabPlan.deleteSuccess'));
                            actionRef.current?.reload();
                          } catch (error) {
                            messageApi.error(getApiErrorMessage(error));
                          }
                        },
                      },
                    }
                  : null,
              ].filter(Boolean),
          },
        ],
        GLOBAL_DOC_LIST_FIELD_RANK,
      ),
    [
      t,
      perms.canUpdate,
      perms.canDelete,
      canSubmit,
      canApprove,
      canReject,
      messageApi,
      modal,
      statusLabel,
    ],
  );

  const detailColumns = useMemo<ProDescriptionsItemProps<AnnualLabPlan>[]>(
    () =>
      alignDescriptionColumns(
        [
          {
            title: t('app.kuaiplm.annualLabPlan.colCode'),
            dataIndex: 'plan_code',
            key: 'code',
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colTitle'),
            dataIndex: 'title',
            key: 'title',
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colYear'),
            dataIndex: 'plan_year',
            key: 'plan_year',
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colOwner'),
            dataIndex: 'owner_user_name',
            key: 'owner_user_name',
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colStatus'),
            dataIndex: 'status',
            key: 'lifecycle',
            render: (_, record) =>
              renderDocumentStatusTag(statusLabel(record.status), record.status || 'draft'),
          },
          {
            title: t('app.kuaiplm.annualLabPlan.colProgress'),
            dataIndex: 'completed_months',
            key: 'completed_months',
            render: (_, record) =>
              `${record.completed_months || 0}/${record.total_months || 12}`,
          },
          {
            title: t('common.remarks'),
            dataIndex: 'remarks',
            key: 'remarks',
            span: 2,
          },
        ],
        GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
      ),
    [t, statusLabel],
  );

  const monthColumns: ColumnsType<AnnualLabPlanMonth> = [
    {
      title: t('app.kuaiplm.annualLabPlan.colMonth'),
      dataIndex: 'year_month',
      width: 90,
    },
    {
      title: t('app.kuaiplm.annualLabPlan.colMonthTitle'),
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: t('app.kuaiplm.annualLabPlan.colMonthStatus'),
      dataIndex: 'month_status',
      width: 100,
      render: (v) => (
        <MarkerTag color="processing" variant="filled">
          {monthStatusLabel(String(v))}
        </MarkerTag>
      ),
    },
    {
      title: t('app.kuaiplm.annualLabPlan.colIssueStatus'),
      dataIndex: 'issue_status',
      width: 120,
      render: (v) => issueStatusLabel(String(v)),
    },
    {
      title: t('app.kuaiplm.annualLabPlan.colDueAt'),
      dataIndex: 'due_at',
      width: 160,
      render: (v) => (v ? formatDateTimeBySiteSetting(String(v)) : '-'),
    },
    {
      title: t('common.action'),
      key: 'action',
      width: 220,
      render: (_, record) => {
        if (detail?.status !== 'approved' || !perms.canUpdate) return null;
        return (
          <>
            <Button
              type="link"
              size="small"
              onClick={() => {
                setMonthEdit(record);
                setMonthDraft({
                  title: record.title,
                  material_desc: record.material_desc,
                  defect_desc: record.defect_desc,
                  treatment_result: record.treatment_result,
                  report_url: record.report_url,
                  lab_request_code: record.lab_request_code,
                  month_status: record.month_status,
                });
              }}
            >
              {t('app.kuaiplm.annualLabPlan.actions.editMonth')}
            </Button>
            {(record.issue_status === 'none' || record.issue_status === 'rejected') &&
              canSubmit && (
                <Button
                  type="link"
                  size="small"
                  onClick={async () => {
                    try {
                      await annualLabPlanApi.submitIssue(detail.id!, record.id!);
                      messageApi.success(t('app.kuaiplm.annualLabPlan.issueSubmitSuccess'));
                      await reloadDetail();
                    } catch (error) {
                      messageApi.error(getApiErrorMessage(error));
                    }
                  }}
                >
                  {t('app.kuaiplm.annualLabPlan.actions.submitIssue')}
                </Button>
              )}
            {canApprove &&
              ['pending_dept', 'pending_sales', 'pending_plan'].includes(
                String(record.issue_status),
              ) && (
                <Button
                  type="link"
                  size="small"
                  onClick={async () => {
                    try {
                      await annualLabPlanApi.approveIssue(detail.id!, record.id!);
                      messageApi.success(t('app.kuaiplm.annualLabPlan.issueApproveSuccess'));
                      await reloadDetail();
                    } catch (error) {
                      messageApi.error(getApiErrorMessage(error));
                    }
                  }}
                >
                  {t('app.kuaiplm.annualLabPlan.actions.approveIssue')}
                </Button>
              )}
          </>
        );
      },
    },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <ListPageTemplate>
      <UniTable<AnnualLabPlan>
        actionRef={actionRef}
        columns={columns}
        rowKey="id"
        headerTitle={t('app.kuaiplm.menu.annual-lab-plans')}
        columnPersistenceId="apps.kuaiplm.pages.annual-lab-plans.width-v2"
        createButtonText={
          perms.canCreate ? t('app.kuaiplm.annualLabPlan.createButton') : undefined
        }
        onCreate={perms.canCreate ? openCreate : undefined}
        enableRowSelection={perms.canDelete}
        showDeleteButton={perms.canDelete}
        deleteConfirmTitle={t('common.batchDeleteTitle')}
        deleteConfirmDescription={(count) => t('common.batchDeleteContent', { count })}
        onDelete={handleBatchDelete}
        onTableDataChange={(rows) => {
          tableRowsRef.current = rows;
        }}
        request={async (params) => {
          const res = await annualLabPlanApi.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: params.pageSize || 20,
            keyword: params.keyword || params.title,
            status: params.status,
            plan_year: params.plan_year,
          });
          return { data: res.items, success: true, total: res.total };
        }}
      />

      <FormModalTemplate
        title={
          editing
            ? t('app.kuaiplm.annualLabPlan.editTitle')
            : t('app.kuaiplm.annualLabPlan.createTitle')
        }
        open={modalOpen}
        onOpenChange={setModalOpen}
        formRef={formRef}
        width={MODAL_CONFIG.MEDIUM_WIDTH}
        grid={false}
        initialValues={
          editing
            ? {
                plan_code: editing.plan_code,
                plan_year: editing.plan_year,
                title: editing.title,
                owner_user_name: editing.owner_user_name,
                remarks: editing.remarks,
              }
            : {
                plan_year: currentYear,
              }
        }
        onFinish={async (values) => {
          try {
            const payload = {
              plan_code: values.plan_code,
              plan_year: Number(values.plan_year),
              title: values.title,
              owner_user_name: values.owner_user_name,
              remarks: values.remarks,
            };
            if (editing?.id != null) {
              const { plan_code: _c, plan_year: _y, ...updatePayload } = payload;
              await annualLabPlanApi.update(editing.id, updatePayload);
            } else {
              await annualLabPlanApi.create(payload);
            }
            messageApi.success(t('common.saveSuccess'));
            setModalOpen(false);
            actionRef.current?.reload();
            return true;
          } catch (error) {
            messageApi.error(getApiErrorMessage(error));
            return false;
          }
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText
              name="plan_code"
              label={t('app.kuaiplm.annualLabPlan.colCode')}
              disabled={!!editing}
              placeholder={t('app.kuaizhizao.quality.plans.placeholder.autoGenerate')}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit
              name="plan_year"
              label={t('app.kuaiplm.annualLabPlan.colYear')}
              disabled={!!editing}
              min={2000}
              max={2100}
              fieldProps={{ precision: 0 }}
              rules={[{ required: true, message: t('common.required') }]}
            />
          </Col>
          <Col span={24}>
            <ProFormText
              name="title"
              label={t('app.kuaiplm.annualLabPlan.colTitle')}
              rules={[{ required: true, message: t('common.required') }]}
            />
          </Col>
          <Col span={12}>
            <ProFormText
              name="owner_user_name"
              label={t('app.kuaiplm.annualLabPlan.colOwner')}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remarks" label={t('common.remarks')} />
          </Col>
        </Row>
      </FormModalTemplate>

      <DetailDrawerTemplate
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
          setDetailError(null);
        }}
        title={detail?.plan_code || t('app.kuaiplm.menu.annual-lab-plans')}
        loading={detailLoading}
        basic={
          detailError ? (
            <Result
              status="error"
              title={detailError}
              extra={
                <Button
                  type="primary"
                  onClick={() => {
                    if (detailRetryIdRef.current != null) {
                      void loadDetail(detailRetryIdRef.current);
                    }
                  }}
                >
                  {t('common.retry')}
                </Button>
              }
            />
          ) : detail ? (
            <Descriptions
              column={detailDrawerBasicColumn(false)}
              items={detailDrawerDescriptionItems(detailColumns, detail)}
            />
          ) : null
        }
        lines={
          detail && !detailError ? (
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={detail.months || []}
              columns={monthColumns}
              scroll={{ x: 900 }}
            />
          ) : null
        }
      />

      <Modal
        title={t('app.kuaiplm.annualLabPlan.actions.editMonth')}
        open={!!monthEdit}
        destroyOnHidden
        onCancel={() => setMonthEdit(null)}
        onOk={async () => {
          if (!detail?.id || !monthEdit?.id) return;
          try {
            await annualLabPlanApi.updateMonth(detail.id, monthEdit.id, monthDraft);
            messageApi.success(t('common.saveSuccess'));
            setMonthEdit(null);
            await reloadDetail();
          } catch (error) {
            messageApi.error(getApiErrorMessage(error));
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div>{t('app.kuaiplm.annualLabPlan.colMonthTitle')}</div>
            <Input
              value={monthDraft.title || ''}
              onChange={(e) => setMonthDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div>
            <div>{t('app.kuaiplm.annualLabPlan.colMaterialDesc')}</div>
            <Input.TextArea
              rows={2}
              value={monthDraft.material_desc || ''}
              onChange={(e) =>
                setMonthDraft((d) => ({ ...d, material_desc: e.target.value }))
              }
            />
          </div>
          <div>
            <div>{t('app.kuaiplm.annualLabPlan.colDefect')}</div>
            <Input.TextArea
              rows={2}
              value={monthDraft.defect_desc || ''}
              onChange={(e) =>
                setMonthDraft((d) => ({ ...d, defect_desc: e.target.value }))
              }
            />
          </div>
          <div>
            <div>{t('app.kuaiplm.annualLabPlan.colTreatment')}</div>
            <Input.TextArea
              rows={2}
              value={monthDraft.treatment_result || ''}
              onChange={(e) =>
                setMonthDraft((d) => ({ ...d, treatment_result: e.target.value }))
              }
            />
          </div>
          <div>
            <div>{t('app.kuaiplm.annualLabPlan.colReportUrl')}</div>
            <Input
              value={monthDraft.report_url || ''}
              onChange={(e) =>
                setMonthDraft((d) => ({ ...d, report_url: e.target.value }))
              }
            />
          </div>
          <div>
            <div>{t('app.kuaiplm.annualLabPlan.colLabRequest')}</div>
            <Input
              value={monthDraft.lab_request_code || ''}
              onChange={(e) =>
                setMonthDraft((d) => ({ ...d, lab_request_code: e.target.value }))
              }
            />
          </div>
          <div>
            <div>{t('app.kuaiplm.annualLabPlan.colMonthStatus')}</div>
            <Select
              style={{ width: '100%' }}
              value={monthDraft.month_status || 'pending'}
              options={['pending', 'in_progress', 'completed'].map((k) => ({
                value: k,
                label: monthStatusLabel(k),
              }))}
              onChange={(v) => setMonthDraft((d) => ({ ...d, month_status: v }))}
            />
          </div>
        </div>
      </Modal>
    </ListPageTemplate>
  );
};

export default AnnualLabPlansPage;
