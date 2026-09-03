import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Input } from 'antd';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { toolApi } from '../../../services/equipment';
import { scrapApplicationsApi } from '../../../services/toolOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  APPROVAL_DOC_PINNED_STATUS_FIELD,
  buildApprovalDocStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveApprovalDocListParams,
} from '../../../utils/equipmentListCore';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';

const P = 'app.kuaizhizao.toolOps.scrap';
const RESOURCE = 'kuaizhizao:tool-scrap';

interface ToolScrapApplication {
  id?: number;
  application_no?: string;
  tool_id?: number;
  tool_code?: string;
  tool_name?: string;
  reason?: string;
  scrap_date?: string;
  applicant_name?: string;
  status?: string;
  reject_reason?: string;
  remark?: string;
  updated_at?: string;
}


const ToolScrapApplicationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const canAudit = perms.canAction?.('audit') ?? perms.canAction?.('approve') ?? false;
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<ToolScrapApplication | null>(null);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: number }[]>([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ToolScrapApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<ToolScrapApplication>();

  const loadToolOptions = async () => {
    const res = await toolApi.list({ limit: 1000 });
    setToolOptions(
      (res.items ?? []).map((eq: { id: number; code: string; name: string }) => ({
        label: `${eq.code} - ${eq.name}`,
        value: eq.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setModalVisible(true);
    void loadToolOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ scrap_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleDetail = (record: ToolScrapApplication) => {
    if (!record.id) return;
    void openDetail(
      () => scrapApplicationsApi.get(record.id!) as Promise<ToolScrapApplication>,
      t(`${P}.listFailed`),
    );
  };

  const handleEdit = async (record: ToolScrapApplication) => {
    if (!record.id) return;
    const detail = await scrapApplicationsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    void loadToolOptions();
    formRef.current?.setFieldsValue({
      tool_id: detail.tool_id,
      reason: detail.reason,
      scrap_date: detail.scrap_date ? dayjs(detail.scrap_date) : dayjs(),
      remark: detail.remark,
    });
  };

  const executeDelete = async (keys: React.Key[]) => {
    for (const id of keys) {
      await scrapApplicationsApi.delete(Number(id));
    }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      tool_id: values.tool_id,
      reason: values.reason,
      scrap_date: (values.scrap_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      remark: values.remark,
    };
    if (isEdit && current?.id) {
      await scrapApplicationsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await scrapApplicationsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const handleSubmitDoc = async (record: ToolScrapApplication) => {
    if (!record.id) return;
    await scrapApplicationsApi.submit(record.id);
    messageApi.success(t(`${P}.submitSuccess`));
    actionRef.current?.reload();
  };

  const handleApprove = async (record: ToolScrapApplication) => {
    if (!record.id) return;
    await scrapApplicationsApi.approve(record.id);
    messageApi.success(t(`${P}.approveSuccess`));
    actionRef.current?.reload();
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget?.id || !rejectReason.trim()) return;
    await scrapApplicationsApi.reject(rejectTarget.id, { reject_reason: rejectReason });
    messageApi.success(t(`${P}.rejectSuccess`));
    setRejectModalVisible(false);
    setRejectTarget(null);
    setRejectReason('');
    actionRef.current?.reload();
  };

  const approvalStatusValueEnum = useMemo(() => buildApprovalDocStatusValueEnum(), []);

  const detailColumns: ProDescriptionsItemProps<ToolScrapApplication>[] = useMemo(
    () => [
      { title: t(`${P}.col.applicationNo`), dataIndex: 'application_no' },
      { title: t(`${P}.col.tool`), dataIndex: 'tool_name' },
      { title: t(`${P}.col.reason`), dataIndex: 'reason', span: 2 },
      {
        title: t(`${P}.col.scrapDate`),
        dataIndex: 'scrap_date',
        render: (_, r) => (r.scrap_date ? formatDateTime(r.scrap_date) : '-'),
      },
      { title: t(`${P}.col.applicant`), dataIndex: 'applicant_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status ?? '-'),
      },
      { title: t(`${P}.form.rejectReason`), dataIndex: 'reject_reason', span: 2 },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<ToolScrapApplication>[] = useMemo(() => alignProColumns<ToolScrapApplication>([
      {
        title: t(`${P}.col.scrapDate`),
        dataIndex: 'scrap_date_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 11 } as ProColumns['search'],
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: approvalStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.applicationNo`),
        dataIndex: 'application_no',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) =>
          r.application_no != null && r.application_no !== '' ? String(r.application_no) : '-',
      },
      {
        title: t(`${P}.col.tool`),
        dataIndex: 'tool_name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.tool_name != null && r.tool_name !== '' ? String(r.tool_name) : '-'),
      },
      {
        title: t(`${P}.col.reason`),
        dataIndex: 'reason',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.reason != null && r.reason !== '' ? String(r.reason) : '-'),
      },
      {
        title: t(`${P}.col.scrapDate`),
        dataIndex: 'scrap_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        valueType: 'date',
      },
      {
        title: t(`${P}.col.applicant`),
        dataIndex: 'applicant_name',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.applicant_name != null && r.applicant_name !== '' ? String(r.applicant_name) : '-',
      },
      ...buildDocumentAuditColumns<Record<string, unknown>>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status ?? '-'),
      },
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
            <Button
              {...rowActionKind('read')}
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDetail(record);
              }}
            >
              {t('common.detail')}
            </Button>
            {perms.canUpdate && record.status === '草稿' && (
              <Button
                {...rowActionKind('update')}
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
            )}
            {perms.canAction?.('submit') && record.status === '草稿' && (
              <Button
                {...rowActionKind('submit')}
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleSubmitDoc(record);
                }}
              >
                {t('common.submit')}
              </Button>
            )}
            {canAudit && record.status === '已提交' && (
              <Button
                {...rowActionKind('approve')}
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleApprove(record);
                }}
              >
                {t(`${P}.action.approve`)}
              </Button>
            )}
            {canAudit && record.status === '已提交' && (
              <Button
                {...rowActionKind('reject')}
                type="link"
                size="small"
                danger
                onClick={(e) => {
                  e.stopPropagation();
                  setRejectTarget(record);
                  setRejectReason('');
                  setRejectModalVisible(true);
                }}
              >
                {t(`${P}.action.reject`)}
              </Button>
            )}
            {perms.canDelete && record.status === '草稿' && (
              <ActionConfirmPopconfirm
                title={t('common.deleteTitle')}
                onConfirm={() => record.id && void executeDelete([record.id])}
              >
                <Button
                  {...rowActionKind('delete')}
                  type="link"
                  size="small"
                  danger
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('common.delete')}
                </Button>
              </ActionConfirmPopconfirm>
            )}
          </>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, canAudit, approvalStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<ToolScrapApplication>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.toolScrapApplications)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-scrap-applications-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={APPROVAL_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveApprovalDocListParams(searchFormValues, sort, {
                docDateRangeKeys: ['scrap_date_range', 'scrapDateRange'],
                docDateParamPrefix: 'scrap',
              });
              const res = await scrapApplicationsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as ToolScrapApplication[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          showCreateButton={perms.canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
          showDeleteButton={false}
          enableRowSelection={false}
        />
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t('common.detail')}${detail?.application_no ? ` - ${detail.application_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(
          t,
          Boolean(detail && perms.canUpdate && detail.status === '草稿'),
          () => {
            if (!detail) return;
            closeDetail();
            void handleEdit(detail);
          },
        )}
      />

      <FormModalTemplate
        title={isEdit ? t(`${P}.editModal`) : t(`${P}.createModal`)}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        onFinish={handleSubmit}
        isEdit={isEdit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={24}>
            <ProFormSelect
              name="tool_id"
              label={t(`${P}.form.tool`)}
              options={toolOptions}
              rules={[{ required: true }]}
              showSearch
              disabled={isEdit}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="reason" label={t(`${P}.col.reason`)} rules={[{ required: true }]} fieldProps={{ rows: 3 }} />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="scrap_date"
              label={t(`${P}.col.scrapDate`)}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <Modal
        title={t(`${P}.rejectModal`)}
        open={rejectModalVisible}
        onOk={() => void handleRejectConfirm()}
        onCancel={() => setRejectModalVisible(false)}
      >
        <Input.TextArea
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder={t(`${P}.form.rejectReason`)}
        />
      </Modal>
    </>
  );
};

export default ToolScrapApplicationsPage;
