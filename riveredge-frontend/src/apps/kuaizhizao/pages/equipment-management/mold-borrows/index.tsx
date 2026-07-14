import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { EquipmentPersonSelect, resolveUserUuidById } from '../../../components/EquipmentPersonSelect';
import { EQUIPMENT_DATE_FIELD_PROPS } from '../../../utils/equipmentFormFieldProps';
import { App, Button, Modal, Row, Col, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { moldApi } from '../../../services/equipment';
import { borrowsApi } from '../../../services/moldOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  EQUIPMENT_OPS_PINNED_STATUS_FIELD,
  normalizeEquipmentListResponse,
  resolveAssetWorkflowListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.moldOps.borrow';
const RESOURCE = 'kuaizhizao:mold-borrow';

interface MoldBorrow {
  id?: number;
  borrow_no?: string;
  mold_id?: number;
  mold_code?: string;
  mold_name?: string;
  work_order_no?: string;
  department?: string;
  borrower_id?: number;
  borrower_name?: string;
  borrow_date?: string;
  planned_qty?: number;
  status?: string;
  updated_at?: string;
}

const MoldBorrowsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<MoldBorrow | null>(null);
  const [moldOptions, setMoldOptions] = useState<{ label: string; value: number }[]>([]);

  const loadMoldOptions = async () => {
    const res = await moldApi.list({ limit: 1000 });
    setMoldOptions(
      (res.items ?? []).map((m: { id: number; code: string; name: string }) => ({
        label: `${m.code} - ${m.name}`,
        value: m.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setModalVisible(true);
    void loadMoldOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ borrow_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: MoldBorrow) => {
    if (!record.id) return;
    const detail = await borrowsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    void loadMoldOptions();
    const borrowerUuid = await resolveUserUuidById(detail.borrower_id);
    formRef.current?.setFieldsValue({
      mold_id: detail.mold_id,
      work_order_no: detail.work_order_no,
      department: detail.department,
      borrower_uuid: borrowerUuid,
      borrower_id: detail.borrower_id,
      borrower_name: detail.borrower_name,
      borrow_date: detail.borrow_date ? dayjs(detail.borrow_date) : dayjs(),
      planned_qty: detail.planned_qty,
      remark: detail.remark,
    });
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await borrowsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      mold_id: values.mold_id,
      work_order_no: values.work_order_no,
      department: values.department,
      borrower_id: values.borrower_id,
      borrower_name: values.borrower_name,
      borrow_date: (values.borrow_date as dayjs.Dayjs)?.format('YYYY-MM-DD'),
      planned_qty: values.planned_qty,
      remark: values.remark,
    };
    if (isEdit && current?.id) {
      await borrowsApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await borrowsApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const borrowStatusValueEnum = useMemo(
    () => ({
      领用中: { text: '领用中' },
      已归还: { text: '已归还' },
    }),
    [],
  );

  const columns: ProColumns<MoldBorrow>[] = useMemo(() => alignProColumns<MoldBorrow>([
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
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        valueType: 'select',
        valueEnum: borrowStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.borrowNo`),
        dataIndex: 'borrow_no',
        width: 140,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      { title: t(`${P}.col.mold`), dataIndex: 'mold_name', width: 160, ellipsis: true, sorter: true, hideInSearch: true },
      { title: t(`${P}.col.workOrderNo`), dataIndex: 'work_order_no', width: 130, sorter: true, hideInSearch: true },
      { title: t(`${P}.col.borrower`), dataIndex: 'borrower_name', width: 100, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.col.borrowDate`),
        dataIndex: 'borrow_date',
        width: 132,
        uniTableKeepWidth: true,
        valueType: 'date',
        sorter: true,
        hideInSearch: true,
      },
      { title: t(`${P}.col.plannedQty`), dataIndex: 'planned_qty', width: 90, sorter: true, hideInSearch: true },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => <Tag>{r.status ?? '-'}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        hideInTable: true,
        hideInSearch: true,
      },
      ...buildDocumentAuditColumns<Record<string, unknown>>(t),
      {
        title: t('common.actions'),
        key: 'action',
        width: 180,
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
                void handleEdit(record);
              }}
            >
              {t('common.detail')}
            </Button>
            {perms.canUpdate && record.status === '生效' && (
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
                  Modal.confirm({
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
    [t, perms, borrowStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MoldBorrow>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-borrows"
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
              return { data: data as MoldBorrow[], success: true, total };
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
              name="mold_id"
              label={t(`${P}.form.mold`)}
              options={moldOptions}
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
              fieldProps={EQUIPMENT_DATE_FIELD_PROPS}
            />
          </Col>
          <Col span={12}>
            <ProFormDigit name="planned_qty" label={t(`${P}.col.plannedQty`)} min={0} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="remark" label={t(`${P}.form.remark`)} fieldProps={{ rows: 2 }} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default MoldBorrowsPage;
