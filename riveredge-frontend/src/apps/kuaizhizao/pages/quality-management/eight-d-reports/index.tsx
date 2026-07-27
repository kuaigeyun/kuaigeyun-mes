import { rowActionKind } from '../../../../../components/uni-action';
import React, { useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Space, Tag } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { stackedPrimarySecondaryColumn } from '../components/qualityTableColumns';
import { UniTable } from '../../../../../components/uni-table';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { qualityImprovementApi, Quality8DReport } from '../../../services/quality-improvement';
import { useGlobalStore } from '../../../../../stores/globalStore';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { eightDReportRowGates } from '../../../../../hooks/useDocumentCapabilities';
import { hasModulePermission } from '../../../../../utils/permissionContract';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { EightDDetailDrawer } from './components/EightDDetailDrawer';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import {
  getEightDStatusText,
  resolveEightDSeverityDisplay,
} from './components/eightDMeta';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  buildEightDSeverityValueEnum,
  buildEightDStatusValueEnum,
  EIGHT_D_PINNED_STATUS_FIELD,
  resolveEightDReportListParams,
} from '../../../utils/qualityImprovementListCore';

const EIGHT_D_RESOURCE = 'kuaizhizao:quality-management-eight-d-reports';

const EightDReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [activeReportId, setActiveReportId] = useState<number | undefined>(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { canCreate, canUpdate, canDelete } = useResourcePermissions(EIGHT_D_RESOURCE);
  const canClose = hasModulePermission(currentUser ?? undefined, EIGHT_D_RESOURCE, 'close');
  const eightDStatusValueEnum = useMemo(() => buildEightDStatusValueEnum(t), [t]);
  const eightDSeverityValueEnum = useMemo(() => buildEightDSeverityValueEnum(t), [t]);
  const openDetail = (row: Quality8DReport) => {
    if (!row.id) return;
    setActiveReportId(row.id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('report_id', String(row.id));
      return next;
    });
    setDetailVisible(true);
  };
  const closeDetail = () => {
    setDetailVisible(false);
    setActiveReportId(undefined);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('report_id');
      return next;
    });
  };

  React.useEffect(() => {
    const reportId = Number(searchParams.get('report_id'));
    if (Number.isFinite(reportId) && reportId > 0) {
      setActiveReportId(reportId);
      setDetailVisible(true);
    }
  }, [searchParams]);

  const columns: ProColumns<Quality8DReport>[] = useMemo(
    () => alignProColumns<Quality8DReport>([
    {
      title: t('app.kuaizhizao.eightD.columns.createdAt'),
      dataIndex: 'created_at_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 10 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.eightD.columns.dueDate'),
      dataIndex: 'due_date_range',
      valueType: 'dateRange',
      hideInTable: true,
      formItemProps: formDateRangeFormItemProps,
      search: { order: 11 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.eightD.columns.stage'),
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: eightDStatusValueEnum,
      hideInTable: true,
      search: { order: 20 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.eightD.columns.severity'),
      dataIndex: 'severity',
      valueType: 'select',
      valueEnum: eightDSeverityValueEnum,
      hideInTable: true,
      search: { order: 21 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.eightD.columns.overdueFilter'),
      dataIndex: 'overdue_only',
      valueType: 'select',
      hideInTable: true,
      valueEnum: {
        true: { text: t('app.kuaizhizao.eightD.columns.overdueOnly') },
      },
      search: { order: 22 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.eightD.columns.reportCode'),
      dataIndex: 'report_code',
      hideInTable: true,
      search: { order: 30 } as ProColumns['search'],
    },
    {
      title: t('app.kuaizhizao.eightD.columns.title'),
      dataIndex: 'title',
      hideInTable: true,
      search: { order: 31 } as ProColumns['search'],
    },
    stackedPrimarySecondaryColumn<Quality8DReport>(
      t('app.kuaizhizao.eightD.columns.titleAndCode'),
      'eightDStacked',
      ['title'],
      ['report_code', 'reportCode'],
      { dataIndex: 'title', fixed: 'left' },
    ),
    {
      title: t('app.kuaizhizao.eightD.columns.severity'),
      dataIndex: 'severity',
      width: 90,
      sorter: true,
      hideInSearch: true,
      render: (_, row) => {
        const { label, color } = resolveEightDSeverityDisplay(t, row.severity);
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.eightD.columns.owner'),
      dataIndex: 'owner_name',
      width: 120,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.eightD.columns.source'),
      key: 'source',
      width: 160,
      hideInSearch: true,
      render: (_, row) => {
        if (row.quality_exception_id) {
          return t('app.kuaizhizao.eightD.source.qualityException', { id: row.quality_exception_id });
        }
        if (row.defect_record_id) {
          return t('app.kuaizhizao.eightD.source.nonconformingLedger', { id: row.defect_record_id });
        }
        return '-';
      },
    },
    {
      title: t('app.kuaizhizao.eightD.columns.verificationResult'),
      dataIndex: 'verification_result',
      width: 180,
      hideInSearch: true,
      ellipsis: true,
      render: (_, row) => {
        const raw = row.verification_result;
        const display =
          typeof raw === 'string'
            ? raw.trim()
            : raw && typeof raw === 'object'
              ? String(
                  (raw as { message?: unknown }).message ??
                    (raw as { detail?: unknown }).detail ??
                    '',
                ).trim()
              : '';
        if (display) {
          return <span title={display}>{display}</span>;
        }
        return row.status === 'closed' ? (
          <Tag color="warning">{t('app.kuaizhizao.eightD.notFilled')}</Tag>
        ) : (
          '-'
        );
      },
    },
    {
      title: t('app.kuaizhizao.eightD.columns.dueDate'),
      dataIndex: 'due_date',
      width: 132,
      uniTableKeepWidth: true,
      sorter: true,
      hideInSearch: true,
      render: (_, row) =>
        row.due_date ? formatDateTime(row.due_date, 'YYYY-MM-DD HH:mm:ss') : '-',
    },
    ...buildDocumentAuditColumns<Quality8DReport>(t),
    {
      title: t('app.kuaizhizao.eightD.columns.stage'),
      dataIndex: 'status',
      width: 220,
      fixed: 'right',
      hideInSearch: true,
      render: (_, row) => {
        const lifecycleStages = row.lifecycle_stages || [];
        const activeIndex = lifecycleStages.findIndex((stage) => stage.status === 'active');
        const doneCount = lifecycleStages.filter((stage) => stage.status === 'done').length;
        const percent =
          activeIndex >= 0
            ? Math.round((activeIndex / Math.max(1, lifecycleStages.length - 1)) * 100)
            : lifecycleStages.length
              ? Math.round((doneCount / lifecycleStages.length) * 100)
              : 0;
        const stageName = getEightDStatusText(t, row.status);
        return (
          <UniLifecycle
            percent={percent}
            stageName={stageName}
            status={row.status === 'closed' ? 'success' : 'active'}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: t('common.actions'),
      valueType: 'option',
      width: 260,
      fixed: 'right',
      hideInSearch: true,
      render: (_, row) => {
        const gates = eightDReportRowGates(row, canUpdate, canDelete, canClose, t);
        return (
        <Space>
          <Button
            key="detail"
            {...rowActionKind('read')}
            onClick={() => {
              openDetail(row);
            }}
          >
            {t('common.detail')}
          </Button>
          {gates.update.allowed && (
            <Button
              key="edit"
              {...rowActionKind('update')}
              icon={<EditOutlined />}
              disabled={gates.update.disabled}
              title={gates.update.title}
              onClick={() => {
                openDetail(row);
              }}
            >
              {t('common.edit')}
            </Button>
          )}
          {gates.delete.allowed && (
            <Button
              key="delete"
              {...rowActionKind('delete')}
              danger
              disabled={gates.delete.disabled}
              title={gates.delete.title}
              onClick={() => {
                if (!row.id) return;
                modalApi.confirm({
                  title: t('app.kuaizhizao.eightD.deleteOneTitle', { reportCode: row.report_code }),
                  content: t('app.kuaizhizao.eightD.deleteOneDescription'),
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    await qualityImprovementApi.eightD.delete(row.id!);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          {gates.transition.allowed && (
            <Button
              key="execute"
              {...rowActionKind('execute')}
              disabled={gates.transition.disabled}
              title={gates.transition.title}
              onClick={() => {
                openDetail(row);
              }}
            >
              {t('app.kuaizhizao.eightD.actions.transition')}
            </Button>
          )}
        </Space>
        );
      },
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [t, canUpdate, canDelete, canClose, eightDStatusValueEnum, eightDSeverityValueEnum, messageApi, modalApi],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-eight-d-reports:read"
      fallback={<Empty description={t('app.kuaizhizao.eightD.noReadPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<Quality8DReport>
          headerTitle={t('app.kuaizhizao.menu.quality-management.eight-d-reports')}
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          permissionResource={EIGHT_D_RESOURCE}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.eight-d-reports"
          showAdvancedSearch
          pinnedTabsField={EIGHT_D_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          showDeleteButton={canDelete}
          onDelete={async (keys) => {
            try {
              for (const key of keys) {
                await qualityImprovementApi.eightD.delete(Number(key));
              }
              messageApi.success(t('app.kuaizhizao.eightD.batchDeleteSuccess', { count: keys.length }));
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || t('common.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.eightD.deleteConfirmTitle', { count })}
          deleteConfirmDescription={t('app.kuaizhizao.eightD.deleteConfirmDescription')}
          toolBarRender={() =>
            canCreate
              ? [
                  <Button
                    {...rowActionKind('create')}
                    key="create"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setCreateVisible(true)}
                  >
                    {withSingleNewShortcutHint(t('app.kuaizhizao.eightD.createButton'))}
                  </Button>,
                ]
              : []
          }
          request={async (params, sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const listParams = resolveEightDReportListParams(searchFormValues, sort);
            const result = await qualityImprovementApi.eightD.list({
              skip,
              limit: pageSize,
              ...listParams,
            });
            return {
              success: true,
              data: result.items || [],
              total: result.total || 0,
            };
          }}
        />

        <FormModalTemplate
          title={t('app.kuaizhizao.eightD.createTitle')}
          open={createVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          grid
          onClose={() => {
            setCreateVisible(false);
            createFormRef.current?.resetFields();
          }}
          formRef={createFormRef}
          onFinish={async (values) => {
            const payload = {
              ...values,
              status: 'd1_team',
              owner_id: values.owner_id ?? null,
              owner_name: values.owner_name ?? null,
              attachments: normalizeDocumentAttachments(values.attachments),
            } as Record<string, unknown>;
            delete payload.owner_uuid;
            const created = await qualityImprovementApi.eightD.create(payload);
            messageApi.success(t('app.kuaizhizao.eightD.createSuccess'));
            setCreateVisible(false);
            actionRef.current?.reload();
            if (created.id) {
              setActiveReportId(created.id);
              setDetailVisible(true);
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set('report_id', String(created.id));
                return next;
              });
            }
          }}
        >
          <ProFormText
            name="title"
            label={t('app.kuaizhizao.eightD.columns.title')}
            rules={[{ required: true }]}
            colProps={{ span: 24 }}
          />
          <ProFormSelect
            name="severity"
            label={t('app.kuaizhizao.eightD.columns.severity')}
            valueEnum={{
              minor: t('app.kuaizhizao.eightD.severity.minor'),
              major: t('app.kuaizhizao.eightD.severity.major'),
              critical: t('app.kuaizhizao.eightD.severity.critical'),
            }}
            initialValue="major"
            colProps={{ span: 8 }}
          />
          <UniUserSelect
            name="owner_uuid"
            label={t('app.kuaizhizao.eightD.columns.owner')}
            colProps={{ span: 8 }}
            onChange={(_value, user) => {
              const picked = Array.isArray(user) ? user[0] : user;
              createFormRef.current?.setFieldsValue?.({
                owner_id: picked?.id ?? undefined,
                owner_name: picked?.full_name || picked?.username || undefined,
              });
            }}
          />
          <ProFormDateTimePicker
            name="due_date"
            label={t('app.kuaizhizao.eightD.columns.dueDate')}
            colProps={{ span: 8 }}
            fieldProps={buildFutureDateShortcutFieldProps({
              getForm: () => createFormRef.current,
              fieldName: 'due_date',
              t,
              fieldProps: { style: { width: '100%' } },
            })}
          />
          <ProFormText name="owner_name" hidden />
          <ProFormText name="owner_id" hidden />
          <ProFormText name="status" hidden initialValue="d1_team" />
          <ProFormTextArea
            name="d1_team"
            label={t('app.kuaizhizao.eightD.status.d1_team')}
            colProps={{ span: 24 }}
          />
          <DocumentAttachmentsField category="quality_8d_report_attachments" />
        </FormModalTemplate>
        <EightDDetailDrawer
          open={detailVisible}
          reportId={activeReportId}
          canUpdate={canUpdate}
          canClose={canClose}
          onClose={closeDetail}
          onReloadList={() => actionRef.current?.reload()}
        />
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default EightDReportsPage;
