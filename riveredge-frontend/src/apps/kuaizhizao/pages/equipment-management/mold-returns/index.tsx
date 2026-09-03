import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col } from 'antd';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { borrowsApi, returnsApi } from '../../../services/moldOps';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
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


const P = 'app.kuaizhizao.moldOps.return';
const RESOURCE = 'kuaizhizao:mold-return';

interface MoldReturn {
  id?: number;
  document_no?: string;
  return_no?: string;
  borrow_id?: number;
  borrow_no?: string;
  borrow_document_no?: string;
  mold_id?: number;
  mold_code?: string;
  mold_name?: string;
  return_date?: string;
  manufacture_qty?: number;
  usage_count?: number;
  remark?: string;
  updated_at?: string;
}

const MoldReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<MoldReturn | null>(null);
  const [borrowOptions, setBorrowOptions] = useState<{ label: string; value: number }[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<MoldReturn>();

  const handleDetail = (record: MoldReturn) => {
    if (!record.id) return;
    void openDetail(() => returnsApi.get(record.id!), t(`${P}.listFailed`));
  };

  const loadBorrowOptions = async () => {
    const res = await borrowsApi.listOutstanding({ limit: 500 });
    setBorrowOptions(
      (res.items ?? []).map(
        (b: { id: number; document_no?: string; borrow_no?: string; mold_name?: string }) => ({
          label: `${b.document_no ?? b.borrow_no ?? b.id} - ${b.mold_name ?? ''}`,
          value: b.id,
        }),
      ),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setModalVisible(true);
    void loadBorrowOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ return_date: dayjs(), usage_count: 1 });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldReturn) => {
    if (!record.id) return;
    const detail = await returnsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    void loadBorrowOptions();
    formRef.current?.setFieldsValue({
      borrow_id: detail.borrow_id,
      return_date: detail.return_date ? dayjs(detail.return_date) : dayjs(),
      manufacture_qty: detail.manufacture_qty,
      usage_count: detail.usage_count,
      remark: detail.remark,
    });
  };

  const handleDelete = async (keys: React.Key[]) => {
    for (const id of keys) {
          await returnsApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      borrow_id: values.borrow_id,
      return_date: (values.return_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      manufacture_qty: values.manufacture_qty,
      usage_count: values.usage_count,
      remark: values.remark,
    };
    if (isEdit && current?.id) {
      await returnsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await returnsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const detailColumns: ProDescriptionsItemProps<MoldReturn>[] = useMemo(
    () => [
      {
        title: t(`${P}.col.returnNo`),
        dataIndex: 'document_no',
        render: (_, r) => r.document_no ?? r.return_no ?? '-',
      },
      {
        title: t(`${P}.col.borrowNo`),
        dataIndex: 'borrow_document_no',
        render: (_, r) => r.borrow_document_no ?? r.borrow_no ?? '-',
      },
      { title: t(`${P}.col.mold`), dataIndex: 'mold_name' },
      { title: t(`${P}.col.returnDate`), dataIndex: 'return_date', valueType: 'date' },
      { title: t(`${P}.col.manufactureQty`), dataIndex: 'manufacture_qty' },
      { title: t(`${P}.col.usageCount`), dataIndex: 'usage_count' },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<MoldReturn>[] = useMemo(() => alignProColumns<MoldReturn>([
      {
        title: t(`${P}.col.returnDate`),
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
        title: t(`${P}.col.returnNo`),
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
          const no = r.document_no ?? r.return_no;
          return no != null && no !== '' ? String(no) : '-';
        },
      },
      {
        title: t(`${P}.col.borrowNo`),
        dataIndex: 'borrow_document_no',
        width: 130,
        minWidth: 130,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => {
          const no = r.borrow_document_no ?? r.borrow_no;
          return no != null && no !== '' ? String(no) : '-';
        },
      },
      {
        title: t(`${P}.col.mold`),
        dataIndex: 'mold_name',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.mold_name != null && r.mold_name !== '' ? String(r.mold_name) : '-'),
      },
      {
        title: t(`${P}.col.returnDate`),
        dataIndex: 'return_date',
        width: 132,
        minWidth: 132,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        valueType: 'date',
      },
      {
        title: t(`${P}.col.manufactureQty`),
        dataIndex: 'manufacture_qty',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.manufacture_qty != null ? String(r.manufacture_qty) : '-'),
      },
      {
        title: t(`${P}.col.usageCount`),
        dataIndex: 'usage_count',
        width: 90,
        minWidth: 90,
        uniTableKeepWidth: true,
        resizable: false,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (r.usage_count != null ? String(r.usage_count) : '-'),
      },
      ...buildDocumentAuditColumns<Record<string, unknown>>(t),
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
            {perms.canUpdate && (
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
    [t, perms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldReturn>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.moldReturns)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-returns-width-v2"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveAssetWorkflowListParams(searchFormValues, sort);
              const res = await returnsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as MoldReturn[], success: true, total };
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
              name="borrow_id"
              label={t(`${P}.form.borrow`)}
              options={borrowOptions}
              rules={[{ required: true }]}
              showSearch
              disabled={isEdit}
            />
          </Col>
          <Col span={12}>
            <ProFormDatePicker
              name="return_date"
              label={t(`${P}.col.returnDate`)}
              rules={[{ required: true }]}
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="manufacture_qty" label={t(`${P}.col.manufactureQty`)} min={0} />
          </Col>
          <Col span={12}>
            <ProFormDigit name="usage_count" label={t(`${P}.col.usageCount`)} min={1} rules={[{ required: true }]} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t('common.remark')} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t('common.detail')}${detail?.document_no ?? detail?.return_no ? ` - ${detail.document_no ?? detail.return_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (!detail) return;
          closeDetail();
          void handleEdit(detail);
        })}
      />
    </>
  );
};

export default MoldReturnsPage;
