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
import { toolApi } from '../../../services/equipment';
import { borrowsApi } from '../../../services/toolOps';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaizhizao.toolOps.borrow';
const RESOURCE = 'kuaizhizao:tool-borrow';

interface ToolBorrow {
  id?: number;
  borrow_no?: string;
  tool_id?: number;
  tool_code?: string;
  tool_name?: string;
  work_order_no?: string;
  department?: string;
  borrower_id?: number;
  borrower_name?: string;
  borrow_date?: string;
  planned_qty?: number;
  status?: string;
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
  const [toolOptions, setToolOptions] = useState<{ label: string; value: number }[]>([]);

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
    setModalVisible(true);
    void loadToolOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ borrow_date: dayjs() });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: ToolBorrow) => {
    if (!record.id) return;
    const detail = await borrowsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    void loadToolOptions();
    const borrowerUuid = await resolveUserUuidById(detail.borrower_id);
    formRef.current?.setFieldsValue({
      tool_id: detail.tool_id,
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
      tool_id: values.tool_id,
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

  const columns: ProColumns<ToolBorrow>[] = useMemo(
    () => [
      { title: t(`${P}.col.borrowNo`), dataIndex: 'borrow_no', width: 140, fixed: 'left' },
      { title: t(`${P}.col.tool`), dataIndex: 'tool_name', width: 160, ellipsis: true },
      { title: t(`${P}.col.workOrderNo`), dataIndex: 'work_order_no', width: 130 },
      { title: t(`${P}.col.borrower`), dataIndex: 'borrower_name', width: 100 },
      { title: t(`${P}.col.borrowDate`), dataIndex: 'borrow_date', width: 110, valueType: 'date' },
      { title: t(`${P}.col.plannedQty`), dataIndex: 'planned_qty', width: 90 },
      {
        title: t(`${P}.col.status`),
        dataIndex: 'status',
        width: 90,
        render: (_, r) => <Tag>{r.status ?? '-'}</Tag>,
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at) : '-'),
      },
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
    ],
    [t, perms],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<ToolBorrow>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.tool-borrows"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          request={async (params) => {
            try {
              const res = await borrowsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                search: (params as { keyword?: string }).keyword,
              });
              return { data: res.items ?? [], success: true, total: res.total ?? 0 };
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

export default ToolBorrowsPage;
