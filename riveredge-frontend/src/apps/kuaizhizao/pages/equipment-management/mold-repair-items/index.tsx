import React, { useRef, useState, useMemo, useCallback } from 'react';

import { useTranslation } from 'react-i18next';

import {

  ActionType,

  ProColumns,

  ProDescriptionsItemProps,

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

import { repairItemsApi } from '../../../services/moldOps';

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

  useEquipmentDetailDrawer,

} from '../shared/equipmentMasterDataDetail';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { buildDocumentListHelpViewConfig, DOCUMENT_LIST_HELP_KEYS } from '../../../../../components/page-help-wiki';



const P = 'app.kuaizhizao.moldOps.repairItem';

const RESOURCE = 'kuaizhizao:mold-repair-item';



interface RepairItem {

  id?: number;

  code?: string;

  name?: string;

  fault_category?: string;

  requirement?: string;

  is_active?: boolean;

  updated_at?: string;

}



const MoldRepairItemsPage: React.FC = () => {

  const { t } = useTranslation();

  const { message: messageApi } = App.useApp();

  const perms = useResourcePermissions(RESOURCE);

  const actionRef = useRef<ActionType>(null);

  const formRef = useRef<any>(null);

  const [modalVisible, setModalVisible] = useState(false);

  const [isEdit, setIsEdit] = useState(false);

  const [current, setCurrent] = useState<RepairItem | null>(null);

  const {

    open: detailVisible,

    loading: detailLoading,

    detail,

    openDetail,

    closeDetail,

  } = useEquipmentDetailDrawer<RepairItem>();



  const handleCreate = () => {

    setIsEdit(false);

    setCurrent(null);

    setModalVisible(true);

    formRef.current?.resetFields();

    formRef.current?.setFieldsValue({ is_active: true });

  };

  useNewShortcut(handleCreate);



  const handleEdit = async (record: RepairItem) => {

    if (!record.id) return;

    try {

      const loaded = await repairItemsApi.get(record.id);

      setIsEdit(true);

      setCurrent(loaded);

      setModalVisible(true);

      formRef.current?.setFieldsValue(loaded);

    } catch (error: unknown) {

      messageApi.error(error instanceof Error ? error.message : t('common.loadFailed'));

    }

  };



  const handleDetail = useCallback(

    async (record: RepairItem) => {

      if (!record.id) return;

      await openDetail(() => repairItemsApi.get(record.id));

    },

    [openDetail],

  );



  const handleDelete = async (keys: React.Key[]) => {

    getAntdModal().confirm({

      title: t('common.batchDeleteTitle'),

      content: t('common.batchDeleteContent', { count: keys.length }),

      onOk: async () => {

        for (const id of keys) {

          await repairItemsApi.delete(Number(id));

        }

        messageApi.success(t('common.batchDeleteSuccess', { count: keys.length }));

        actionRef.current?.reload();

      },

    });

  };



  const handleSubmit = async (values: Record<string, unknown>) => {

    if (isEdit && current?.id) {

      await repairItemsApi.update(current.id, values);

      messageApi.success(t('common.updateSuccess'));

    } else {

      await repairItemsApi.create(values);

      messageApi.success(t('common.createSuccess'));

    }

    setModalVisible(false);

    actionRef.current?.reload();

    if (detailVisible && detail?.id === current?.id && current?.id) {

      void openDetail(() => repairItemsApi.get(current.id));

    }

  };



  const activeStatusValueEnum = useMemo(() => buildActiveStatusValueEnum(t), [t]);



  const detailBasicColumns = useMemo<ProDescriptionsItemProps<RepairItem>[]>(

    () => [

      { title: t('common.code'), dataIndex: 'code' },

      { title: t('common.name'), dataIndex: 'name' },

      { title: t(`${P}.col.faultCategory`), dataIndex: 'fault_category' },

      { title: t(`${P}.col.requirement`), dataIndex: 'requirement', span: 2 },

      buildIsActiveDescriptionColumn<RepairItem>(t),

    ],

    [t],

  );



  const columns: ProColumns<RepairItem>[] = useMemo(() => alignProColumns<RepairItem>([

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

        width: 120,

        fixed: 'left',

        sorter: true,

        search: { order: 30 } as ProColumns['search'],

      },

      {

        title: t('common.name'),

        dataIndex: 'name',

        width: 180,

        ellipsis: true,

        sorter: true,

        hideInSearch: true,

      },

      { title: t(`${P}.col.faultCategory`), dataIndex: 'fault_category', width: 120, hideInSearch: true },

      { title: t(`${P}.col.requirement`), dataIndex: 'requirement', ellipsis: true, hideInSearch: true },

      {

        title: t('common.enabled'),

        dataIndex: 'is_active',

        width: 80,

        sorter: true,

        hideInSearch: true,

        render: (_, r) => renderIsActiveTag(t, r.is_active),

      },

      {

        title: t('common.updatedAt'),

        dataIndex: 'updated_at',

        hideInTable: true,

        hideInSearch: true,

      },

      ...buildDocumentAuditColumns<RepairItem>(t),

      {

        title: t('common.actions'),

        key: 'action',
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

        <UniTable<RepairItem>
        viewTypes={['table', 'help']}
          helpViewConfig={buildDocumentListHelpViewConfig(DOCUMENT_LIST_HELP_KEYS.moldRepairItems)}

          headerTitle={t(`${P}.title`)}

          columnPersistenceId="apps.kuaizhizao.pages.equipment-management.mold-repair-items-equip-rank-v1"

          actionRef={actionRef}

          rowKey="id"

          columns={columns}

          showAdvancedSearch={true}

          pinnedTabsField={MASTER_DATA_PINNED_ACTIVE_FIELD}

          skipFuzzyPinyinClientFilter

          request={async (params, sort, _filter, searchFormValues) => {

            try {

              const listParams = resolveMasterDataListParams(searchFormValues, sort);

              const res = await repairItemsApi.list({

                skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),

                limit: params.pageSize,

                ...listParams,

              });

              const { data, total } = normalizeEquipmentListResponse(res);

              return { data: data as RepairItem[], success: true, total };

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

        onClose={() => setModalVisible(false)}

        onFinish={handleSubmit}

        isEdit={isEdit}

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

            <ProFormText name="fault_category" label={t(`${P}.col.faultCategory`)} />

          </Col>

          <Col span={24}>

            <ProFormTextArea name="requirement" label={t(`${P}.col.requirement`)} fieldProps={{ rows: 3 }} />

          </Col>

          <Col span={24}>

            <ProFormSwitch name="is_active" label={t('common.enabled')} />

          </Col>

        </Row>

      </FormModalTemplate>

    </>

  );

};



export default MoldRepairItemsPage;


