import React, { useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Row, Col, Tag } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { FormListDetailTable } from '../../../../../components/form-list-detail-table';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { repairItemsApi, repairSchemesApi } from '../../../services/moldOps';
import { formatDateTime } from '../../../../../utils/format';

const P = 'app.kuaizhizao.moldOps.repairScheme';
const RESOURCE = 'kuaizhizao:mold-repair-scheme';

interface SchemeLine {
  item_id?: number;
  sort_order?: number;
}

interface RepairScheme {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  lines?: SchemeLine[];
  line_count?: number;
  updated_at?: string;
}

const MoldRepairSchemesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<RepairScheme | null>(null);
  const [itemOptions, setItemOptions] = useState<{ label: string; value: number }[]>([]);

  const loadItemOptions = async () => {
    const res = await repairItemsApi.list({ limit: 1000, is_active: true });
    setItemOptions(
      (res.items ?? []).map((it: { id: number; code: string; name: string }) => ({
        label: `${it.code} - ${it.name}`,
        value: it.id,
      })),
    );
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setModalVisible(true);
    void loadItemOptions();
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ is_active: true, lines: [{ sort_order: 0 }] });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: RepairScheme) => {
    if (!record.id) return;
    const detail = await repairSchemesApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    void loadItemOptions();
    formRef.current?.setFieldsValue({
      ...detail,
      lines: (detail.lines ?? []).map((l: SchemeLine, i: number) => ({
        item_id: l.item_id,
        sort_order: l.sort_order ?? i,
      })),
    });
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await repairSchemesApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      code: values.code,
      name: values.name,
      description: values.description,
      is_active: values.is_active,
      lines: (values.lines as SchemeLine[] | undefined)?.map((l, i) => ({
        item_id: l.item_id,
        sort_order: l.sort_order ?? i,
      })),
    };
    if (isEdit && current?.id) {
      await repairSchemesApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await repairSchemesApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const columns: ProColumns<RepairScheme>[] = useMemo(
    () => [
      { title: t(`${P}.col.code`), dataIndex: 'code', width: 120, fixed: 'left' },
      { title: t(`${P}.col.name`), dataIndex: 'name', width: 180, ellipsis: true },
      { title: t(`${P}.col.lineCount`), dataIndex: 'line_count', width: 80, hideInSearch: true },
      { title: t(`${P}.col.description`), dataIndex: 'description', ellipsis: true, hideInSearch: true },
      {
        title: t(`${P}.col.isActive`),
        dataIndex: 'is_active',
        width: 80,
        render: (_, r) => (
          <Tag color={r.is_active ? 'success' : 'default'}>
            {r.is_active ? t('common.enabled') : t('common.disabled')}
          </Tag>
        ),
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
        width: 140,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <>
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
        <UniTable<RepairScheme>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-repair-schemes"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          request={async (params) => {
            try {
              const res = await repairSchemesApi.list({
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
        width={MODAL_CONFIG.LARGE_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText name="code" label={t(`${P}.col.code`)} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormText name="name" label={t(`${P}.col.name`)} rules={[{ required: true }]} />
          </Col>
        </Row>
        <FormListDetailTable
          name="lines"
          label={t(`${P}.form.lines`)}
          addButtonText={t(`${P}.form.addLine`)}
          defaultRow={{ sort_order: 0 }}
          bulkAdd={{
            title: t('common.bulkAddPickTitle', { item: t(`${P}.form.item`) }),
            options: itemOptions,
            valueField: 'item_id',
          }}
          columns={[
            {
              title: t(`${P}.form.item`),
              key: 'item_id',
              render: (field) => (
                <ProFormSelect
                  name={[field.name, 'item_id']}
                  options={itemOptions}
                  rules={[{ required: true }]}
                  showSearch
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' }, placeholder: t('common.select') }}
                />
              ),
            },
            {
              title: t(`${P}.form.sortOrder`),
              key: 'sort_order',
              width: 100,
              align: 'right',
              render: (field) => (
                <ProFormDigit
                  name={[field.name, 'sort_order']}
                  min={0}
                  formItemProps={{ noStyle: true }}
                  fieldProps={{ style: { width: '100%' } }}
                />
              ),
            },
          ]}
        />
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <ProFormTextArea name="description" label={t(`${P}.col.description`)} fieldProps={{ rows: 2 }} />
          </Col>
          <Col span={24}>
            <ProFormSwitch name="is_active" label={t(`${P}.col.isActive`)} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default MoldRepairSchemesPage;
