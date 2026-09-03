import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { EquipmentPersonSelect, resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { App, Button, Modal, Row, Col } from 'antd';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { renderDocumentStatusTag } from '../../../../../utils/documentLifecycleStatusTag';
import { toolApi } from '../../../services/equipment';
import { borrowsApi } from '../../../services/toolOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps, formDateFormItemProps, coerceFormDate } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import {
  EQUIPMENT_OPS_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveAssetWorkflowListParams,
} from '../../../utils/equipmentListCore';
import {
  buildDetailDrawerEditExtra,
  EquipmentMasterDetailDrawer,
  useEquipmentDetailDrawer,
} from '../shared/equipmentMasterDataDetail';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { ActionConfirmPopconfirm } from '../../../../../components/action-confirm';


const P = 'app.kuaizhizao.toolOps.borrow';
const RESOURCE = 'kuaizhizao:tool-borrow';

function toApiBorrowDateTimeString(value: unknown): string | undefined {
  const d = coerceFormDate(value);
  return d ? d.format('YYYY-MM-DD HH:mm:ss') : undefined;
}

function buildToolBorrowSubmitPayload(values: Record<string, unknown>) {
  const remarkParts: string[] = [];
  if (values.planned_qty != null && values.planned_qty !== '') {
    remarkParts.push(`计划数量: ${values.planned_qty}`);
  }
  if (values.remark) remarkParts.push(String(values.remark));
  const workOrderNo =
    typeof values.work_order_no === 'string' ? values.work_order_no.trim() : undefined;
  return {
    tool_id: values.tool_id,
    borrow_date: toApiBorrowDateTimeString(values.borrow_date),
    borrower_id: values.borrower_id,
    borrower_name: values.borrower_name,
    department_name: values.department,
    source_type: workOrderNo ? 'work_order' : undefined,
    source_no: workOrderNo || undefined,
    remark: remarkParts.length ? remarkParts.join('\n') : undefined,
  };
}

interface ToolBorrow {
  id?: number;
  borrow_no?: string;
  document_no?: string;
  tool_id?: number;
  tool_code?: string;
  tool_name?: string;
  work_order_no?: string;
  source_no?: string;
  department?: string;
  department_name?: string;
  borrower_id?: number;
  borrower_name?: string;
  borrow_date?: string;
  planned_qty?: number;
  status?: string;
  remark?: string;
  updated_at?: string;
}

const ToolBorrowsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<ToolBorrow | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [submitting, setSubmitting] = useState(false);
  const [toolOptions, setToolOptions] = useState<{ label: string; value: number }[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<ToolBorrow>();

  const loadToolOptions = async () => {
    const res = await toolApi.list({ limit: 1000 });
    setToolOptions(
      (res.items ?? []).map((m: { id: number; code: string; name: string }) => ({
        label: `${m.code} - ${m.name}`,
        value: m.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setFormInitialValues({ borrow_date: dayjs() });
    setModalVisible(true);
    void loadToolOptions();
  };
  useNewShortcut(handleCreate);

  const handleDetail = (record: ToolBorrow) => {
    if (!record.id) return;
    void openDetail(() => borrowsApi.get(record.id!) as Promise<ToolBorrow>, t(`${P}.listFailed`));
  };

  const handleEdit = async (record: ToolBorrow) => {
    if (!record.id) return;
    try {
      const detail = await borrowsApi.get(record.id);
      const borrowerUuid = await resolveUserUuidById(detail.borrower_id);
      setIsEdit(true);
      setCurrent(detail);
      setFormInitialValues({
        tool_id: detail.tool_id,
        work_order_no: detail.source_no ?? detail.work_order_no,
        department: detail.department_name ?? detail.department,
        borrower_uuid: borrowerUuid,
        borrower_id: detail.borrower_id,
        borrower_name: detail.borrower_name,
        borrow_date: detail.borrow_date ? dayjs(detail.borrow_date) : dayjs(),
        planned_qty: detail.planned_qty,
        remark: detail.remark,
      });
      setModalVisible(true);
      void loadToolOptions();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.listFailed`)));
    }
  };

  const handleDelete = async (keys: React.Key[]) => {
    for (const id of keys) {
          await borrowsApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = buildToolBorrowSubmitPayload(values);
    setSubmitting(true);
    try {
      if (isEdit && current?.id) {
        await borrowsApi.update(current.id, payload);
        messageApi.success(t('common.updateSuccess'));
      } else {
        await borrowsApi.create(payload);
        messageApi.success(t('common.createSuccess'));
      }
      setModalVisible(false);
      setFormInitialValues(undefined);
      actionRef.current?.reload();
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t(`${P}.submitFailed`)));
    } finally {
      setSubmitting(false);
    }
  };

  const borrowStatusValueEnum = useMemo(
    () => ({
      领用中: { text: '领用中' },
      已归还: { text: '已归还' },
    }),
    [],
  );

  const detailColumns: ProDescriptionsItemProps<ToolBorrow>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.borrowNo`),
        dataIndex: 'document_no',
        render: (_, r) => r.document_no ?? r.borrow_no ?? '-',
      },
      { title: t(`${P}.col.tool`), dataIndex: 'tool_name' },
      {
        title: t(`${P}.col.workOrderNo`),
        dataIndex: 'source_no',
        render: (_, r) => r.source_no ?? r.work_order_no ?? '-',
      },
      {
        title: t(`${P}.col.department`),
        dataIndex: 'department_name',
        render: (_, r) => r.department_name ?? r.department ?? '-',
      },
      { title: t(`${P}.col.borrower`), dataIndex: 'borrower_name' },
      {
        title: t(`${P}.col.borrowDate`),
        dataIndex: 'borrow_date',
        render: (_, r) => (r.borrow_date ? formatDateTime(r.borrow_date) : '-'),
      },
      { title: t(`${P}.col.plannedQty`), dataIndex: 'planned_qty' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status),
      },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<ToolBorrow>[] = useMemo(() => alignProColumns<ToolBorrow>([
      {
        title: t(`${P}.col.borrowDate`),
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
        valueEnum: borrowStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.borrowNo`),
        dataIndex: 'document_no',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
        render: (_, r) => {
          const no = r.document_no ?? r.borrow_no;
          return no != null && no !== '' ? String(no) : '-';
        },
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
        title: t(`${P}.col.workOrderNo`),
        dataIndex: 'source_no',
        width: 130,
        minWidth: 130,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => {
          const no = r.source_no ?? r.work_order_no;
          return no != null && no !== '' ? String(no) : '-';
        },
      },
      {
        title: t(`${P}.col.borrower`),
        dataIndex: 'borrower_name',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
        render: (_, r) =>
          r.borrower_name != null && r.borrower_name !== '' ? String(r.borrower_name) : '-',
      },
      {
        title: t(`${P}.col.borrowDate`),
        dataIndex: 'borrow_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        valueType: 'date',
      },
      {
        title: t(`${P}.col.plannedQty`),
        dataIndex: 'planned_qty',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.planned_qty != null ? String(r.planned_qty) : '-'),
      },
      ...buildDocumentAuditColumns<ToolBorrow>(t),
      {
        title: t('common.status'),
        key: 'lifecycle',
        dataIndex: 'status',
        hideInSearch: true,
        fixed: 'right',
        render: (_, r) => renderDocumentStatusTag(r.status ?? '-', r.status),
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
            {perms.canUpdate && record.status === '领用中' && (
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
            {perms.canDelete && (
              <ActionConfirmPopconfirm title={t('common.deleteTitle')} onConfirm={() => record.id && void executeDelete([record.id])}>
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
    [t, perms, borrowStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<ToolBorrow>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.toolBorrows)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-borrows-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          pinnedTabsField={EQUIPMENT_OPS_PINNED_STATUS_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveAssetWorkflowListParams(searchFormValues, sort);
              const res = await borrowsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as ToolBorrow[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          showCreateButton={perms.canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
          showDeleteButton={perms.canDelete}
          deleteConfirmTitle={t('common.batchDeleteTitle')}
          deleteConfirmDescription={(count) => t('common.batchDeleteContent', { count: count })}
          
          onDelete={handleDelete}
          enableRowSelection={perms.canDelete}
        />
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t('common.detail')}${detail?.document_no ?? detail?.borrow_no ? ` - ${detail.document_no ?? detail.borrow_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(
          t,
          Boolean(detail && perms.canUpdate && detail.status === '领用中'),
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
        onClose={() => {
          setModalVisible(false);
          setFormInitialValues(undefined);
        }}
        onFinish={handleSubmit}
        isEdit={isEdit}
        loading={submitting}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        initialValues={formInitialValues}
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
          <Col span={12}>
            <ProFormText name="work_order_no" label={t(`${P}.col.workOrderNo`)} />
          </Col>
          <Col span={12}>
            <ProFormText name="department" label={t(`${P}.col.department`)} />
          </Col>
          <Col span={12}>
            <EquipmentPersonSelect
              uuidFieldName="borrower_uuid"
              idFieldName="borrower_id"
              nameFieldName="borrower_name"
              label={t(`${P}.col.borrower`)}
              formRef={formRef}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="borrow_date"
              label={t(`${P}.col.borrowDate`)}
              rules={[{ required: true }]}
              formItemProps={formDateFormItemProps}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="planned_qty" label={t(`${P}.col.plannedQty`)} min={0} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default ToolBorrowsPage;
