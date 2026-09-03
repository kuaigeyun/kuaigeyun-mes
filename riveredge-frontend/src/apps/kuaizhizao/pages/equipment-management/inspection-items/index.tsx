import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Modal, Row, Col } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { withSingleNewShortcutHint } from '../../../../../utils/globalNewShortcut';
import { inspectionItemsApi } from '../../../services/equipmentOps';
import { formDateRangeFormItemProps } from '../../../../../utils/formDate';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';
import {
  MASTER_DATA_PINNED_ACTIVE_FIELD,
  buildActiveStatusValueEnum,
  normalizeEquipmentListResponse,
  resolveMasterDataListParams,
} from '../../../utils/equipmentListCore';
import {
  buildDetailDrawerEditExtra,
  buildIsActiveDescriptionColumn,
  EquipmentMasterDetailDrawer,
  renderEquipmentMasterRowActions,
  renderIsActiveTag,
} from '../shared/equipmentMasterDataDetail';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';
import { UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS } from '../../../../../utils/uniTableLayoutColumns';

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
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(
    undefined,
  );
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<InspectionItem | null>(null);

  const handleCreate = () => {
    setIsEdit(false);
    setCurrent(null);
    setFormInitialValues({ value_type: 'boolean', is_active: true });
    setModalVisible(true);
  };
  useNewShortcut(handleCreate);

  const handleEdit = async (record: InspectionItem) => {
    if (!record.id) return;
    try {
      const loaded = await inspectionItemsApi.get(record.id);
      setIsEdit(true);
      setCurrent(loaded);
      setFormInitialValues({ ...loaded });
      setModalVisible(true);
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));
    }
  };

  const handleDetail = useCallback(async (record: InspectionItem) => {
    if (!record.id) return;
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const loaded = await inspectionItemsApi.get(record.id);
      setDetail(loaded);
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));
      setDetailVisible(false);
    } finally {
      setDetailLoading(false);
    }
  }, [messageApi, t]);

  const closeDetail = () => {
    setDetailVisible(false);
    setDetail(null);
  };

  const handleDelete = async (keys: React.Key[]) => {
    for (const id of keys) {
          await inspectionItemsApi.delete(Number(id));
        }
    messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));
    actionRef.current?.reload();
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
    if (detailVisible && detail?.id === current?.id) {
      void handleDetail({ id: current.id });
    }
  };

  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);

  const detailBasicColumns = useMemo<ProDescriptionsItemProps<InspectionItem>[]>(
    () => [
      { title: t('common.code'), dataIndex: 'code' },
      { title: t('common.name'), dataIndex: 'name' },
      {
        title: t(`${P}.col.valueType`),
        dataIndex: 'value_type',
        render: (_, record) => t(`${P}.valueType.${record.value_type || 'boolean'}`, record.value_type || '-'),
      },
      { title: t('common.unit'), dataIndex: 'unit' },
      { title: t(`${P}.col.numericMin`), dataIndex: 'numeric_min' },
      { title: t(`${P}.col.numericMax`), dataIndex: 'numeric_max' },
      { title: t(`${P}.col.requirement`), dataIndex: 'requirement', span: 2 },
      buildIsActiveDescriptionColumn<InspectionItem>(t),
    ],
    [t],
  );

  const columns: ProColumns<InspectionItem>[] = useMemo(() => alignProColumns<InspectionItem>([
      {
        title: t('common.updatedAt'),
        dataIndex: 'updated_at_range',
        valueType: 'dateRange',
        hideInTable: true,
        formItemProps: formDateRangeFormItemProps,
        search: { order: 10 } as ProColumns['search'],
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        valueType: 'select',
        valueEnum: activeStatusValueEnum,
        hideInTable: true,
        search: { order: 20 } as ProColumns['search'],
      },
      {
        title: t('common.code'),
        dataIndex: 'code',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        fixed: 'left',
        sorter: true,
        search: { order: 30 } as ProColumns['search'],
      },
      {
        title: t('common.name'),
        dataIndex: 'name',
        width: 160,
        minWidth: 160,
        uniTableKeepWidth: true,
        resizable: false,
        ellipsis: true,
        sorter: true,
        hideInSearch: true,
      },
      {
        title: t(`${P}.col.valueType`),
        dataIndex: 'value_type',
        width: 100,
        minWidth: 100,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => {
          const vt = String(r.value_type || 'boolean');
          return t(`${P}.valueType.${vt}`, vt);
        },
      },
      {
        title: t('common.unit'),
        dataIndex: 'unit',
        width: 80,
        minWidth: 80,
        uniTableKeepWidth: true,
        resizable: false,
        hideInSearch: true,
        render: (_, r) => {
          const unit = r.unit;
          if (unit == null || unit === '') return '-';
          return typeof unit === 'string' || typeof unit === 'number' ? String(unit) : '-';
        },
      },
      {
        title: t(`${P}.col.requirement`),
        dataIndex: 'requirement',
        minWidth: 160,
        uniTablePrimaryFlex: true,
        uniTableRemainderFlex: true,
        resizable: false,
        ellipsis: true,
        hideInSearch: true,
        render: (_, r) => (r.requirement != null && r.requirement !== '' ? String(r.requirement) : '-'),
      },
      {
        title: t('common.enabled'),
        dataIndex: 'is_active',
        ...UNI_TABLE_MARKER_BADGE_COLUMN_DEFAULTS,
        sorter: true,
        hideInSearch: true,
        render: (_, r) => renderIsActiveTag(t, r.is_active),
      },
      ...buildDocumentAuditColumns<InspectionItem>(t),
      {
        title: t('common.actions'),
        key: 'option',
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) =>
          renderEquipmentMasterRowActions({
            record,
            t,
            canRead: perms.canRead,
            canUpdate: perms.canUpdate,
            canDelete: perms.canDelete,
            onDetail: (row) => {
              void handleDetail(row);
            },
            onEdit: (row) => {
              void handleEdit(row);
            },
            onDelete: (row) => {
              if (row.id != null) {
                void handleDelete([row.id]);
              }
            },
          }),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, perms, activeStatusValueEnum, handleDetail],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<InspectionItem>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.inspectionItems)}
          headerTitle={t(`${P}.title`)}
          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.inspection-items-width-v2"
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
        title={`${t(`${P}.detailTitle`)}${detail?.code ? ` - ${detail.code}` : ''}`}
        onClose={closeDetail}
        basicColumns={detailBasicColumns}
        extra={buildDetailDrawerEditExtra(t, Boolean(detail && perms.canUpdate), () => {
          if (!detail) return;
          closeDetail();
          void handleEdit(detail);
        })}
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
        initialValues={formInitialValues}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        formRef={formRef}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <ProFormText name="code" label={t('common.code')} rules={[{ required: true }]} />
          </Col>
          <Col span={12}>
            <ProFormText name="name" label={t('common.name')} rules={[{ required: true }]} />
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
            <ProFormText name="unit" label={t('common.unit')} />
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
            <ProFormSwitch name="is_active" label={t('common.enabled')} />
          </Col>
        </Row>
      </FormModalTemplate>
    </>
  );
};

export default InspectionItemsPage;
