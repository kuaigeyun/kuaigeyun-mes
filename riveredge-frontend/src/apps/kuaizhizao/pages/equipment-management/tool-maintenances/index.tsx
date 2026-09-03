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
import { EquipmentPersonSelect, resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { App, Button, Modal, Row, Col, Table, Input, Switch } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { toolApi } from '../../../services/equipment';
import { maintenanceSchemesApi, maintenancesApi } from '../../../services/toolOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  APPROVAL_DOC_PINNED_STATUS_FIELD,
  buildApprovalDocStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveAssetWorkflowListParams,
} from '../../../utils/equipmentListCore';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  MasterDataLinesTable,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';

const P = 'app.kuaizhizao.toolOps.maintenance';
const RESOURCE = 'kuaizhizao:tool-maintenance';

interface MaintenanceLine {
  line_no?: number;
  item_id?: number;
  item_code?: string;
  item_name?: string;
  requirement?: string;
  executed?: boolean;
  remark?: string;
}

interface ToolMaintenance {
  id?: number;
  document_no?: string;
  tool_id?: number;
  tool_code?: string;
  tool_name?: string;
  scheme_id?: number;
  maintenance_date?: string;
  applicant_id?: number;
  applicant_name?: string;
  status?: string;
  remark?: string;
  updated_at?: string;
  lines?: MaintenanceLine[];
}


const ToolMaintenancesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const canAudit = perms.canAction?.('audit') ?? perms.canAction?.('approve') ?? false;
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<ToolMaintenance | null>(null);
  const [previewLines, setPreviewLines] = useState<MaintenanceLine[]>([]);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: number }[]>([]);
  const [schemeOptions, setSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ToolMaintenance | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<ToolMaintenance>();

  const loadOptions = async () => {
    const [toolRes, schRes] = await Promise.all([
      toolApi.list({ limit: 1000 }),
      maintenanceSchemesApi.list({ limit: 1000, is_active: true }),
    ]);
    setToolOptions(
      (toolRes.items ?? []).map((m: { id: number; code: string; name: string }) => ({
        label: `${m.code} - ${m.name}`,
        value: m.id,
      })),
    );
    setSchemeOptions(
      (schRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
        label: `${s.code} - ${s.name}`,
        value: s.id,
      })),
    );
  };

  const handlePreview = async (toolId?: number, schemeId?: number) => {
    if (!toolId) {
      setPreviewLines([]);
      return;
    }
    try {
      const res = await maintenancesApi.previewLines({ tool_id: toolId, scheme_id: schemeId });
      setPreviewLines(res.lines ?? []);
    } catch {
      messageApi.error(t(`${P}.previewFailed`));
      setPreviewLines([]);
    }
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setPreviewLines([]);
    setModalVisible(true);
    void loadOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ maintenance_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleDetail = (record: ToolMaintenance) => {
    if (!record.id) return;
    void openDetail(
      () => maintenancesApi.get(record.id!) as Promise<ToolMaintenance>,
      t(`${P}.listFailed`),
    );
  };

  const handleEdit = async (record: ToolMaintenance) => {
    if (!record.id) return;
    const detail = await maintenancesApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setPreviewLines(detail.lines ?? []);
    setModalVisible(true);
    void loadOptions();
    const applicantUuid = await resolveUserUuidById(detail.applicant_id);
    formRef.current?.setFieldsValue({
      tool_id: detail.tool_id,
      scheme_id: detail.scheme_id,
      maintenance_date: detail.maintenance_date ? dayjs(detail.maintenance_date) : dayjs(),
      applicant_uuid: applicantUuid,
      applicant_id: detail.applicant_id,
      applicant_name: detail.applicant_name,
      remark: detail.remark,
    });
  };

  const executeDelete = async (keys: React.Key[]) => {
    
        for (const id of keys) {
          await maintenancesApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
      
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      tool_id: values.tool_id,
      scheme_id: values.scheme_id,
      maintenance_date: (values.maintenance_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      applicant_id: values.applicant_id,
      applicant_name: values.applicant_name,
      remark: values.remark,
      lines: previewLines.map((l) => ({
        line_no: l.line_no,
        item_id: l.item_id,
        item_code: l.item_code,
        item_name: l.item_name,
        requirement: l.requirement,
        executed: l.executed ?? false,
        remark: l.remark,
      })),
    };
    if (isEdit && current?.id) {
      await maintenancesApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await maintenancesApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const handleSubmitDoc = async (record: ToolMaintenance) => {
    if (!record.id) return;
    await maintenancesApi.submit(record.id);
    messageApi.success(t(`${P}.submitSuccess`));
    actionRef.current?.reload();
  };

  const handleApprove = async (record: ToolMaintenance) => {
    if (!record.id) return;
    await maintenancesApi.approve(record.id);
    messageApi.success(t(`${P}.approveSuccess`));
    actionRef.current?.reload();
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget?.id || !rejectReason.trim()) return;
    await maintenancesApi.reject(rejectTarget.id, { reject_reason: rejectReason });
    messageApi.success(t(`${P}.rejectSuccess`));
    setRejectModalVisible(false);
    setRejectTarget(null);
    setRejectReason('');
    actionRef.current?.reload();
  };

  const handleComplete = async (record: ToolMaintenance) => {
    if (!record.id) return;
    await maintenancesApi.complete(record.id);
    messageApi.success(t(`${P}.completeSuccess`));
    actionRef.current?.reload();
  };

  const lineColumns = [
    { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 140 },
    { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
    {
      title: t(`${P}.line.executed`),
      dataIndex: 'executed',
      width: 80,
      render: (_: unknown, row: MaintenanceLine, index: number) => (
        <Switch
          size="small"
          checked={row.executed ?? false}
          onChange={(checked) => {
            const next = [...previewLines];
            next[index] = { ...next[index], executed: checked };
            setPreviewLines(next);
          }}
        />
      ),
    },
    {
      title: t('common.remark'),
      dataIndex: 'remark',
      width: 140,
      render: (_: unknown, row: MaintenanceLine, index: number) => (
        <Input
          size="small"
          value={row.remark}
          onChange={(e) => {
            const next = [...previewLines];
            next[index] = { ...next[index], remark: e.target.value };
            setPreviewLines(next);
          }}
        />
      ),
    },
  ];

  const workflowStatusValueEnum = useMemo(
    () => ({
      ...buildApprovalDocStatusValueEnum(),
      已完成: { text: '已完成' },
    }),
    [],
  );

  const detailColumns: ProDescriptionsItemProps<ToolMaintenance>[] = useMemo(
    () => [
      { title: t(`${P}.col.documentNo`), dataIndex: 'document_no' },
      { title: t(`${P}.col.tool`), dataIndex: 'tool_name' },
      {
        title: t(`${P}.col.maintenanceDate`),
        dataIndex: 'maintenance_date',
        render: (_, r) => (r.maintenance_date ? formatDateTime(r.maintenance_date) : '-'),
      },
      { title: t(`${P}.col.executor`), dataIndex: 'applicant_name' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status ?? '-'),
      },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const detailLineColumns = useMemo<ColumnsType<MaintenanceLine>>(
    () => [
      { title: t(`${P}.line.item`), dataIndex: 'item_name', width: 140 },
      { title: t(`${P}.line.requirement`), dataIndex: 'requirement', ellipsis: true },
      {
        title: t(`${P}.line.executed`),
        dataIndex: 'executed',
        width: 80,
        render: (_, row) => (row.executed ? t('common.yes') : t('common.no')),
      },
      { title: t('common.remark'), dataIndex: 'remark', width: 140 },
    ],
    [t],
  );

  const columns: ProColumns<ToolMaintenance>[] = useMemo(() => alignProColumns<ToolMaintenance>([
      {
        title: t(`${P}.col.maintenanceDate`),
        dataIndex: 'doc_date_range',
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
        valueEnum: workflowStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.documentNo`),
        dataIndex: 'document_no',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) =>
          r.document_no != null && r.document_no !== '' ? String(r.document_no) : '-',
      },
      {
        title: t(`${P}.col.tool`),
        dataIndex: 'tool_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.tool_name != null && r.tool_name !== '' ? String(r.tool_name) : '-'),
      },
      {
        title: t(`${P}.col.maintenanceDate`),
        dataIndex: 'maintenance_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        valueType: 'date',
      },
      {
        title: t(`${P}.col.executor`),
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
      ...buildDocumentAuditColumns<ToolMaintenance>(t),
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
            {perms.canUpdate && (record.status === '草稿' || record.status === '已驳回') && (
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
            {perms.canAction?.('complete') && record.status === '已审核' && (
              <Button
                {...rowActionKind('complete')}
                type="link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleComplete(record);
                }}
              >
                {t(`${P}.action.complete`)}
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
    [t, perms, canAudit, workflowStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<ToolMaintenance>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.toolMaintenances)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-maintenances-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={APPROVAL_DOC_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveAssetWorkflowListParams(searchFormValues, sort);
              const res = await maintenancesApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as ToolMaintenance[], success: true, total };
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
        title={`${t('common.detail')}${detail?.document_no ? ` - ${detail.document_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
        lines={
          <MasterDataLinesTable
            rows={detail?.lines ?? []}
            columns={detailLineColumns}
            rowKey={(row) => String(row.item_id ?? row.line_no ?? '')}
            emptyDescription={t('common.noData')}
          />
        }
        extra={buildDetailDrawerEditExtra(
          t,
          Boolean(
            detail &&
              perms.canUpdate &&
              (detail.status === '草稿' || detail.status === '已驳回'),
          ),
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
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormSelect
              name="tool_id"
              label={t(`${P}.form.tool`)}
              options={toolOptions}
              rules={[{ required: true }]}
              showSearch
              disabled={isEdit}
              fieldProps={{
                onChange: (val: number) => {
                  const schemeId = formRef.current?.getFieldValue('scheme_id');
                  void handlePreview(val, schemeId);
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="scheme_id"
              label={t(`${P}.form.scheme`)}
              options={schemeOptions}
              showSearch
              fieldProps={{
                onChange: (val: number) => {
                  const toolId = formRef.current?.getFieldValue('tool_id');
                  void handlePreview(toolId, val);
                },
              }}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="maintenance_date"
              label={t(`${P}.col.maintenanceDate`)}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <EquipmentPersonSelect
              uuidFieldName="applicant_uuid"
              idFieldName="applicant_id"
              nameFieldName="applicant_name"
              label={t(`${P}.col.executor`)}
              formRef={formRef}
            />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
        {previewLines.length > 0 && (
          <Table
            size="small"
            style={{ marginTop: 16 }}
            dataSource={previewLines}
            rowKey={(r, i) => String(r.item_id ?? i)}
            pagination={false}
            columns={lineColumns}
          />
        )}
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

export default ToolMaintenancesPage;
