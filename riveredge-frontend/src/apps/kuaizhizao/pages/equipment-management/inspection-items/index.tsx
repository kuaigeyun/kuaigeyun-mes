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
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { rowActionKind } from '../../../../../components/uni-action';
import { inspectionItemsApi } from '../../../services/equipmentOps';
import { formatDateTime } from '../../../../../utils/format';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveMasterDataListParams,
} from '../../../utils/equipmentListCore';

const P = 'app.kuaizhizao.equipmentOps.inspectionItem';
const RESOURCE = 'kuaizhizao:equipment-inspection-item';

interface InspectionItem {
  id?: number;
  code?: string;
  name?: string;
  requirement?: string;
  value_type?: string;
  unit?: string;
  numeric_min?: number;
  numeric_max?: number;
  is_active?: boolean;
  updated_at?: string;
}

const InspectionItemsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions(RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [current, setCurrent] = useState<InspectionItem | null>(null);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({ value_type: 'boolean', is_active: true });
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: InspectionItem) => {
    if (!record.id) return;
    const detail = await inspectionItemsApi.get(record.id);
    setIsEdit(true);
    setCurrent(detail);
    setModalVisible(true);
    formRef.current?.setFieldsValue(detail);
  };

  const handleDelete = async (keys: React.Key[]) => {
    Modal.confirm({
      title: t('common.batchDeleteTitle'),
      content: t('common.batchDeleteContent', { count: keys.length }),
      onOk: async () => {
        for (const id of keys) {
          await inspectionItemsApi.delete(Number(id));
        }
        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
        actionRef.current?.reload();
      },
    });
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    if (isEdit && current?.id) {
      await inspectionItemsApi.update(current.id, values);
      messageApi.success(t('common.updateSuccess'));
    } else {
      await inspectionItemsApi.create(values);
      messageApi.success(t('common.createSuccess'));
    }
    setModalVisible(false);
    actionRef.current?.reload();
  };

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const columns: ProColumns<InspectionItem>[] = useMemo(
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
        title: t(`${P}.col.valueType`),
        dataIndex: 'value_type',
        width: 100,
        hideInSearch: true,
        render: (_, r) => t(`${P}.valueType.${r.value_type || 'boolean'}`, r.value_type || '-'),
      },
      { title: t(`${P}.col.unit`), dataIndex: 'unit', width: 80, hideInSearch: true },
      { title: t(`${P}.col.requirement`), dataIndex: 'requirement', ellipsis: true, hideInSearch: true },
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
        <UniTable<InspectionItem>
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.inspection-items"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch={true}
          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}
          skipFuzzyPinyinClientFilter
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const listParams = resolveMasterDataListParams(searchFormValues, sort);
              const res = await inspectionItemsApi.list({
                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
                limit: params.pageSize,
                ...listParams,
              });
              const { data, total } = normalizeEquipmentListResponse(res);
              return { data: data as InspectionItem[], success: true, total };
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
          <Col span={12}>
            <ProFormText name="code" label={t(`${P}.col.code`)} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormText name="name" label={t(`${P}.col.name`)} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormSelect
              name="value_type"
              label={t(`${P}.col.valueType`)}
              options={[
                { label: t(`${P}.valueType.boolean`), value: 'boolean' },
                { label: t(`${P}.valueType.numeric`), value: 'numeric' },
                { label: t(`${P}.valueType.text`), value: 'text' },
              ]}
            />
          </Col>
          <Col span={12}>
            <ProFormText name="unit" label={t(`${P}.col.unit`)} />
          </Col>
          <Col span={12}>
            <ProFormDigit name="numeric_min" label={t(`${P}.col.numericMin`)} />
          </Col>
          <Col span={12}>
            <ProFormDigit name="numeric_max" label={t(`${P}.col.numericMax`)} />
          </Col>
          <Col span={24}>
            <ProFormTextArea name="requirement" label={t(`${P}.col.requirement`)} />
          </Col>
          <Col span={12}>
            <ProFormSwitch name="is_active" label={t(`${P}.col.isActive`)} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default InspectionItemsPage;
