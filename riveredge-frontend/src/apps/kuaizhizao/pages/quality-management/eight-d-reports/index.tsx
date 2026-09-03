import { rowActionKind, rowActionLabelKeep, rowActionOpenWorkbench } from '../../../../../components/uni-action';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Empty, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { stackedPrimarySecondaryColumn } from '../components/qualityTableColumns';
import { UniTable } from '../../../../../components/uni-table';
import { UniUserSelect } from '../../../../../components/uni-user-select';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { qualityImprovementApi, Quality8DReport } from '../../../services/quality-improvement';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { eightDReportRowGates } from '../../../../../hooks/useDocumentCapabilities';
import { hasModulePermission } from '../../../../../utils/permissionContract';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments, mapAttachmentsToUploadList } from '../../../utils/documentAttachments';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { WorkOrderOperationStepsStrip } from '../../production-execution/work-orders/components/WorkOrderOperationStepsStrip';
import {
  buildEightDListStepNodes,
  EIGHT_D_LIST_STAGE_COLUMN_WIDTH,
  EIGHT_D_LIST_STEP_SLOT_PX,
  resolveEightDSeverityDisplay,
  resolveEightDSourceDisplay,
  stripEightDHtml,
} from './components/eightDMeta';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildFutureDateShortcutFieldProps } from '../../../../../utils/futureDatePickerShortcuts';
import { formDateRangeFormItemProps, toApiDateTimeString } from '../../../../../utils/formDate';
import { formatDateTime } from '../../../../../utils/format';
import { resolveUserDisplay } from '../../../../../services/user';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import {
  buildEightDSeverityValueEnum,
  buildEightDStatusValueEnum,
  EIGHT_D_PINNED_STATUS_FIELD,
  resolveEightDReportListParams,
} from '../../../utils/qualityImprovementListCore';
import { useKuaizhizaoPrintModal } from '../../../hooks/useKuaizhizaoPrintModal';

const EIGHT_D_RESOURCE = 'kuaizhizao:quality-management-eight-d-reports';
const WORKBENCH_PATH = '/apps/kuaizhizao/quality-management/eight-d-reports';

const EightDReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi, modal: modalApi } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUser = useCurrentUser();
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const editFormRef = useRef<any>(null);
  const editOwnerRef = useRef<{ id?: number; name?: string }>({});
  const [createVisible, setCreateVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editingReportId, setEditingReportId] = useState<number>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const { canCreate, canUpdate, canDelete, canPrint } = useResourcePermissions(EIGHT_D_RESOURCE);
  const canClose = hasModulePermission(currentUser ?? undefined, EIGHT_D_RESOURCE, 'close');
  const { openPrint, PrintModal } = useKuaizhizaoPrintModal();
  const eightDStatusValueEnum = useMemo(() => buildEightDStatusValueEnum(t), [t]);
  const eightDSeverityValueEnum = useMemo(() => buildEightDSeverityValueEnum(t), [t]);

  const openWorkbench = (row: Quality8DReport) => {
    if (!row.id) return;
    navigate(`${WORKBENCH_PATH}/${row.id}`);
  };

  const openEdit = useCallback(async (row: Quality8DReport) => {
    if (!row.id) return;
    try {
      const detail = await qualityImprovementApi.eightD.getById(row.id);
      setEditingReportId(row.id);
      editOwnerRef.current = {
        id: detail.owner_id ?? undefined,
        name: detail.owner_name ?? undefined,
      };
      setEditVisible(true);

      let ownerUuid: string | undefined;
      if (detail.owner_id) {
        try {
          const resolved = await resolveUserDisplay({ user_ids: [detail.owner_id] });
          ownerUuid = resolved[0]?.uuid;
          if (resolved[0]) {
            editOwnerRef.current = {
              id: resolved[0].id,
              name: resolved[0].full_name || resolved[0].username || detail.owner_name || '',
            };
          }
        } catch {
          ownerUuid = undefined;
        }
      }

      editFormRef.current?.setFieldsValue({
        title: detail.title,
        severity: detail.severity,
        owner_uuid: ownerUuid,
        owner_id: detail.owner_id ?? undefined,
        owner_name: detail.owner_name ?? undefined,
        due_date: detail.due_date ? dayjs(detail.due_date) : undefined,
        attachments: mapAttachmentsToUploadList(detail.attachments),
      });
    } catch (e: unknown) {
      messageApi.error((e as Error)?.message || t('common.loadFailed'));
    }
  }, [messageApi, t]);

  React.useEffect(() => {
    const reportId = Number(searchParams.get('report_id'));
    if (Number.isFinite(reportId) && reportId > 0) {
      navigate(`${WORKBENCH_PATH}/${reportId}`, { replace: true });
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('report_id');
        return next;
      });
    }
  }, [searchParams, navigate, setSearchParams]);

  const columns: ProColumns<Quality8DReport>[] = useMemo(
    () => alignProColumns<Quality8DReport>([
    {
      title: t('common.createdAt'),
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
      { dataIndex: 'title', fixed: 'left', widthMode: 'remainder' },
    ),
    {
      title: t('app.kuaizhizao.eightD.columns.severity'),
      dataIndex: 'severity',
      width: 90,
      minWidth: 90,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_, row) => {
        const { label, color } = resolveEightDSeverityDisplay(t, row.severity);
        if (label === '-') return '-';
        return <MarkerTag color={color}>{label}</MarkerTag>;
      },
    },
    {
      title: t('app.kuaizhizao.eightD.columns.stage'),
      key: 'eight_d_stages',
      dataIndex: 'lifecycle_stages',
      width: EIGHT_D_LIST_STAGE_COLUMN_WIDTH,
      minWidth: EIGHT_D_LIST_STAGE_COLUMN_WIDTH,
      uniTableKeepWidth: true,
      resizable: false,
      ellipsis: false,
      hideInSearch: true,
      className: 'uni-table-operation-steps-cell uni-table-operation-steps-cell-fit',
      onHeaderCell: () => ({
        className: 'uni-table-operation-steps-cell uni-table-operation-steps-cell-fit',
      }),
      onCell: () => ({
        className: 'uni-table-operation-steps-cell uni-table-operation-steps-cell-fit',
      }),
      render: (_, row) => (
        <WorkOrderOperationStepsStrip
          steps={buildEightDListStepNodes(t, row.status, row.lifecycle_stages)}
          slotWidth={EIGHT_D_LIST_STEP_SLOT_PX}
        />
      ),
    },
    {
      title: t('app.kuaizhizao.eightD.columns.source'),
      key: 'eight_d_source',
      dataIndex: 'quality_exception_id',
      width: 110,
      minWidth: 110,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
      render: (_, row) => resolveEightDSourceDisplay(t, row)?.label ?? '-',
    },
    {
      title: t('app.kuaizhizao.eightD.columns.owner'),
      key: 'eight_d_owner',
      dataIndex: 'owner_name',
      width: 100,
      minWidth: 100,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
    },
    {
      title: t('app.kuaizhizao.eightD.columns.verificationResult'),
      dataIndex: 'verification_result',
      width: 160,
      minWidth: 160,
      uniTableKeepWidth: true,
      resizable: false,
      hideInSearch: true,
      ellipsis: true,
      render: (_, row) => {
        const display = stripEightDHtml(
          typeof row.verification_result === 'string' ? row.verification_result : String(row.verification_result ?? ''),
        );
        if (display) {
          return <span title={display}>{display}</span>;
        }
        return '-';
      },
    },
    {
      title: t('app.kuaizhizao.eightD.columns.dueDate'),
      dataIndex: 'due_date',
      width: 168,
      minWidth: 168,
      uniTableKeepWidth: true,
      resizable: false,
      sorter: true,
      hideInSearch: true,
      render: (_, row) =>
        row.due_date ? formatDateTime(row.due_date, 'YYYY-MM-DD HH:mm:ss') : '-',
    },
    ...buildDocumentAuditColumns<Quality8DReport>(t),
    {
      title: t('common.actions'),
      key: 'option',
      fixed: 'right',
      hideInSearch: true,
      render: (_, row) => {
        const gates = eightDReportRowGates(row, canUpdate, canDelete, canClose, t, undefined, canPrint);
        return (
        <Space>
          <Button
            key="detail"
            {...rowActionOpenWorkbench()}
            onClick={() => openWorkbench(row)}
          />
          {gates.update.allowed && (
            <Button
              key="edit"
              {...rowActionKind('update')}
              disabled={gates.update.disabled}
              title={gates.update.title}
              onClick={() => void openEdit(row)}
            />
          )}
          {gates.print.allowed && (
            <Button
              key="print"
              {...rowActionKind('print')}
              disabled={gates.print.disabled}
              title={gates.print.title}
              onClick={() => openPrint({ documentType: 'eight_d_report', documentId: row.id! })}
            />
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
            />
          )}
          {gates.transition.allowed && (
            <Button
              key="execute"
              {...rowActionKind('execute')}
              {...rowActionLabelKeep()}
              disabled={gates.transition.disabled}
              title={gates.transition.title}
              onClick={() => openWorkbench(row)}
            >
              {t('app.kuaizhizao.eightD.actions.transition')}
            </Button>
          )}
        </Space>
        );
      },
    },
  ], SALES_DOC_LIST_FIELD_RANK),
    [t, canUpdate, canDelete, canClose, canPrint, eightDStatusValueEnum, eightDSeverityValueEnum, messageApi, modalApi, openPrint, openEdit],
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-eight-d-reports:read"
      fallback={<Empty description={t('app.kuaizhizao.eightD.noReadPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<Quality8DReport>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.eightDReport)}
          headerTitle={t('app.kuaizhizao.menu.quality-management.eight-d-reports')}
          actionRef={actionRef}
          rowKey="id"
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          permissionResource={EIGHT_D_RESOURCE}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.eight-d-reports-width-v2"
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
              status: 'd0_prepare',
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
              navigate(`${WORKBENCH_PATH}/${created.id}`);
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
          <ProFormText name="status" hidden initialValue="d0_prepare" />
          <ProFormTextArea
            name="d0_prepare"
            label={t('app.kuaizhizao.eightD.status.d0_prepare')}
            colProps={{ span: 24 }}
          />
          <DocumentAttachmentsField category="quality_8d_report_attachments" />
        </FormModalTemplate>

        <FormModalTemplate
          title={t('app.kuaizhizao.eightD.editTitle')}
          open={editVisible}
          width={MODAL_CONFIG.LARGE_WIDTH}
          grid
          onClose={() => {
            setEditVisible(false);
            setEditingReportId(undefined);
            editFormRef.current?.resetFields();
            editOwnerRef.current = {};
          }}
          formRef={editFormRef}
          onFinish={async (values) => {
            if (!editingReportId) return;
            await qualityImprovementApi.eightD.update(editingReportId, {
              title: values.title,
              severity: values.severity,
              owner_id: editOwnerRef.current.id ?? values.owner_id ?? null,
              owner_name: editOwnerRef.current.name ?? values.owner_name ?? null,
              due_date: values.due_date ? toApiDateTimeString(values.due_date) : null,
              attachments: normalizeDocumentAttachments(values.attachments),
            });
            messageApi.success(t('common.saveSuccess'));
            setEditVisible(false);
            setEditingReportId(undefined);
    actionRef.current?.reload();
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
            colProps={{ span: 8 }}
          />
          <UniUserSelect
            name="owner_uuid"
            label={t('app.kuaizhizao.eightD.columns.owner')}
            colProps={{ span: 8 }}
            onChange={(_value, user) => {
              const picked = Array.isArray(user) ? user[0] : user;
              editOwnerRef.current = {
                id: picked?.id,
                name: picked?.full_name || picked?.username || '',
              };
              editFormRef.current?.setFieldsValue?.({
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
              getForm: () => editFormRef.current,
              fieldName: 'due_date',
              t,
              fieldProps: { style: { width: '100%' } },
            })}
          />
          <ProFormText name="owner_name" hidden />
          <ProFormText name="owner_id" hidden />
          <DocumentAttachmentsField category="quality_8d_report_attachments" />
        </FormModalTemplate>
        {PrintModal}
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default EightDReportsPage;
