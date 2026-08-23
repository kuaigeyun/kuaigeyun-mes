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
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { borrowsApi, returnsApi } from '../../../services/toolOps';
import { formatDateTime } from '../../../../../utils/format';
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

const P = 'app.kuaizhizao.toolOps.return';
const RESOURCE = 'kuaizhizao:tool-return';

interface ToolReturn {
  id?: number;
  return_no?: string;
  borrow_id?: number;
  borrow_no?: string;
  tool_id?: number;
  tool_code?: string;
  tool_name?: string;
  return_date?: string;
  manufacture_qty?: number;
  usage_count?: number;
  remark?: string;
  updated_at?: string;
}

const ToolReturnsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<ToolReturn | null>(null);
  const [borrowOptions, setBorrowOptions] = useState<{ label: string; value: number }[]>([]);
  const { open: detailVisible, loading: detailLoading, detail, openDetail, closeDetail } =
    useEquipmentDetailDrawer<ToolReturn>();

  const loadBorrowOptions = async () => {
    const res = await borrowsApi.listOutstanding({ limit: 500 });
    setBorrowOptions(
      (res.items ?? []).map((b: { id: number; borrow_no: string; tool_name?: string }) => ({
        label: `${b.borrow_no} - ${b.tool_name ?? ''}`,
        value: b.id,
      })),
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

  const handleDetail = (record: ToolReturn) => {
    if (!record.id) return;
    void openDetail(() => returnsApi.get(record.id!) as Promise<ToolReturn>, t(`${P}.listFailed`));
  };

  const handleEdit = async (record: ToolReturn) => {
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
    getAntdModal().confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await returnsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
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

  const detailColumns: ProDescriptionsItemProps<ToolReturn>[] = useMemo(
    () => [
      { title: t(`${P}.col.returnNo`), dataIndex: 'return_no' },
      { title: t(`${P}.col.borrowNo`), dataIndex: 'borrow_no' },
      { title: t(`${P}.col.tool`), dataIndex: 'tool_name' },
      {
        title: t(`${P}.col.returnDate`),
        dataIndex: 'return_date',
        render: (_, r) => (r.return_date ? formatDateTime(r.return_date) : '-'),
      },
      { title: t(`${P}.col.manufactureQty`), dataIndex: 'manufacture_qty' },
      { title: t(`${P}.col.usageCount`), dataIndex: 'usage_count' },
      { title: t('common.remark'), dataIndex: 'remark', span: 2 },
    ],
    [t],
  );

  const columns: ProColumns<ToolReturn>[] = useMemo(() => alignProColumns<ToolReturn>([
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
        dataIndex: 'return_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      { title: t(`${P}.col.borrowNo`), dataIndex: 'borrow_no', width: 130, sorter: true, hideInSearch: true },
      { title: t(`${P}.col.tool`), dataIndex: 'tool_name', width: 160, ellipsis: true, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.col.returnDate`),
        dataIndex: 'return_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      { title: t(`${P}.col.manufactureQty`), dataIndex: 'manufacture_qty', width: 100, sorter: true, hideInSearch: true },
      { title: t(`${P}.col.usageCount`), dataIndex: 'usage_count', width: 90, sorter: true, hideInSearch: true },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<ToolReturn>(t),
      {
        title: t('common.actions'),
        key: 'action',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
            <Button
              {...rowActionKind('read')}
              type="link"
              size="small"
              icon={<EyeOutlined />}
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
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleEdit(record);
                }}
              >
                {t('common.edit')}
              </Button>
            )}
            {perms.canDelete && (
              <Button
                {...rowActionKind('delete')}
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  getAntdModal().confirm({
                    title: t('common.deleteTitle'),
                    onOk: () => record.id && handleDelete([record.id]),
                  });
                }}
              >
                {t('common.delete')}
              </Button>
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
        <UniTable<ToolReturn>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.toolReturns)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-returns-equip-rank-v1"
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
              return { data: data as ToolReturn[], success: true, total };
            } catch {
              messageApi.error(t(`${P}.listFailed`));
              return { data: [], success: false, total: 0 };
            }
          }}
          showCreateButton={perms.canCreate}
          createButtonText={withSingleNewShortcutHint(t(`${P}.create`))}
          onCreate={handleCreate}
          showDeleteButton={perms.canDelete}
          onDelete={handleDelete}
          enableRowSelection={perms.canDelete}
        />
      </ListPageTemplate>

      <EquipmentMasterDetailDrawer
        open={detailVisible}
        loading={detailLoading}
        detail={detail}
        title={`${t('common.detail')}${detail?.return_no ? ` - ${detail.return_no}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (!detail) return;
          closeDetail();
          void handleEdit(detail);
        })}
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
    </>
  );
};

export default ToolReturnsPage;
