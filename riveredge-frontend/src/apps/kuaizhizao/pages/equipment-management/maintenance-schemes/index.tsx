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
import { maintenanceItemsApi, maintenanceSchemesApi } from '../../../services/equipmentOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveMasterDataListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.equipmentOps.maintenanceScheme';
const RESOURCE = 'kuaizhizao:equipment-maintenance-scheme';

interface SchemeLine {
  item_id?: number;
  sort_order?: number;
}

interface MaintenanceScheme {
  id?: number;
  code?: string;
  name?: string;
  description?: string;
  is_active?: boolean;
  lines?: SchemeLine[];
  updated_at?: string;
}

const MaintenanceSchemesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<MaintenanceScheme | null>(null);
  const [itemOptions, setItemOptions] = useState<{ label: string; value: number }[]>([]);

  const loadItemOptions = async () => {
    const res = await maintenanceItemsApi.list({ limit: 1000, is_active: true });
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

  const handleEdit = async (record: MaintenanceScheme) => {
    if (!record.id) return;
    const detail = await maintenanceSchemesApi.get(record.id);
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
          await maintenanceSchemesApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    const payload = {
      ...values,
      lines: ((values.lines as SchemeLine[]) ?? []).map((l, i) => ({
        item_id: l.item_id,
        sort_order: l.sort_order ?? i,
      })),
    };
    if (isEdit && current?.id) {
      await maintenanceSchemesApi.update(current.id, payload);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await maintenanceSchemesApi.create(payload);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const columns: ProColumns<MaintenanceScheme>[] = useMemo(
    () => [
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.isActive`),
        dataIndex: 'is_active',
        valueType: 'select',
        valueEnum: activeStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.code`),
        dataIndex: 'code',
        width: 120,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t(`${P}.col.name`),
        dataIndex: 'name',
        width: 180,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.lineCount`),
        dataIndex: 'lines',
        width: 90,
        hideInSearch: true,
        render: (_, r) => r.lines?.length ?? 0,
      },
      { title: t(`${P}.col.description`), dataIndex: 'description', ellipsis: true, hideInSearch: true },
      {
        title: t(`${P}.col.isActive`),
        dataIndex: 'is_active',
        width: 80,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => (
          <Tag color={r.is_active ? 'success' : 'default'}>
            {r.is_active ? t('common.enabled') : t('common.disabled')}
          </Tag>
        ),
      },
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at',
        width: 132,
        uniTableKeepWidth: true,
        hideInSearch: true,
        defaultSortOrder: 'descend',
        sorter: true,
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
    [t, perms, activeStatusValueEnum],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<MaintenanceScheme>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.maintenance-schemes"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveMasterDataListParams(searchFormValues, sort);
              const res = await maintenanceSchemesApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as MaintenanceScheme[], success: true, total };
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

export default MaintenanceSchemesPage;
