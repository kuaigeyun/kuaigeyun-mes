import { rowActionKind } from '../../../../../components/uni-action';
import React, { useMemo, useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  ProFormDatePicker,
  ProFormDigit,
  ProFormSelect,
  ProFormSwitch,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Popconfirm, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniTable } from '../../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../../components/uni-batch';
import { standardCostService, type StandardCost } from '../../../services/cost/standard-cost';
import { formatCostItemType, formatTargetType } from '../../../utils/financeUiLabels';

const StandardCostsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<StandardCost | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    for (const key of keys) {
      await standardCostService.delete(Number(key));
    }
    messageApi.success(t('app.kuaicaiwu.standardCost.batchDeleteSuccess', { count: keys.length }));
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const handleBatchSetActive = async (keys: React.Key[], isActive: boolean) => {
    for (const key of keys) {
      await standardCostService.update(Number(key), { is_active: isActive });
    }
    messageApi.success(
      isActive
        ? t('app.kuaicaiwu.standardCost.batchEnableSuccess', { count: keys.length })
        : t('app.kuaicaiwu.standardCost.batchDisableSuccess', { count: keys.length }),
    );
    setSelectedRowKeys([]);
    actionRef.current?.reload();
  };

  const columns: ProColumns<StandardCost>[] = useMemo(
    () => [
      {
        title: t('app.kuaicaiwu.standardCost.col.targetType'),
        dataIndex: 'target_type',
        width: 100,
        render: (_, r) => formatTargetType(r.target_type, t),
      },
      { title: t('app.kuaicaiwu.standardCost.col.targetCode'), dataIndex: 'target_code', width: 120, ellipsis: true },
      { title: t('app.kuaicaiwu.standardCost.col.targetName'), dataIndex: 'target_name', ellipsis: true },
      {
        title: t('app.kuaicaiwu.standardCost.col.costItemType'),
        dataIndex: 'cost_item_type',
        width: 100,
        render: (_, r) => formatCostItemType(r.cost_item_type, t),
      },
      { title: t('app.kuaicaiwu.standardCost.col.standardValue'), dataIndex: 'standard_value', valueType: 'money', align: 'right' },
      { title: t('app.kuaicaiwu.standardCost.col.unit'), dataIndex: 'unit', width: 80 },
      { title: t('app.kuaicaiwu.standardCost.col.version'), dataIndex: 'version', width: 80 },
      {
        title: t('app.kuaicaiwu.standardCost.col.status'),
        dataIndex: 'is_active',
        width: 80,
        render: (_, r) =>
          r.is_active ? (
            <Tag color="success">{t('app.kuaicaiwu.standardCost.status.active')}</Tag>
          ) : (
            <Tag>{t('app.kuaicaiwu.standardCost.status.inactive')}</Tag>
          ),
      },
      {
        title: t('app.kuaicaiwu.costCommon.action'),
        valueType: 'option',
        width: 120,
        render: (_, record) => [
          <a key="edit" onClick={() => { setEditing(record); setModalVisible(true); }}>{t('app.kuaicaiwu.costCommon.edit')}</a>,
          <Popconfirm
            {...rowActionKind('delete')}
            key="del"
            title={t('app.kuaicaiwu.standardCost.confirmDelete')}
            onConfirm={async () => {
              await standardCostService.delete(record.id);
              messageApi.success(t('app.kuaicaiwu.costCommon.deleteSuccess'));
              actionRef.current?.reload();
            }}
          >
            <a>{t('app.kuaicaiwu.costCommon.delete')}</a>
          </Popconfirm>,
        ],
      },
    ],
    [t, messageApi],
  );

  const targetTypeOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.financeUi.targetType.material'), value: 'material' },
      { label: t('app.kuaicaiwu.financeUi.targetType.workCenter'), value: 'work_center' },
      { label: t('app.kuaicaiwu.financeUi.targetType.workStation'), value: 'work_station' },
    ],
    [t],
  );

  const costItemOptions = useMemo(
    () => [
      { label: t('app.kuaicaiwu.financeUi.costItem.material'), value: 'material' },
      { label: t('app.kuaicaiwu.financeUi.costItem.labor'), value: 'labor' },
      { label: t('app.kuaicaiwu.financeUi.costItem.overhead'), value: 'overhead' },
    ],
    [t],
  );

  return (
    <ListPageTemplate>
      <UniTable<StandardCost>
        actionRef={actionRef}
        rowKey="id"
        columnPersistenceId="apps.kuaicaiwu.pages.cost-management.standard-costs"
        columns={columns}
        request={async (params) => {
          const res = await standardCostService.list({
            skip: ((params.current ?? 1) - 1) * (params.pageSize ?? 20),
            limit: params.pageSize ?? 20,
            search: params.keyword as string | undefined,
          });
          return { data: res.items, success: true, total: res.total };
        }}
        showCreateButton
        createButtonText={t('app.kuaicaiwu.standardCost.create')}
        onCreate={() => { setEditing(null); setModalVisible(true); }}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={t('app.kuaicaiwu.standardCost.batchDeleteTitle')}
        deleteConfirmDescription={(count) => t('app.kuaicaiwu.standardCost.batchDeleteDesc', { count })}
        toolBarActionsAfterDelete={[
          <UniBatchMenuButton
            key="standard-cost-batch-actions"
            selectedRowKeys={selectedRowKeys}
            buttonText={t('app.kuaicaiwu.costCommon.batchActions')}
            menuItems={[
              {
                key: 'batch-enable',
                label: t('app.kuaicaiwu.standardCost.batchEnable'),
                onClick: (keys) => handleBatchSetActive(keys, true),
              },
              {
                key: 'batch-disable',
                label: t('app.kuaicaiwu.standardCost.batchDisable'),
                onClick: (keys) => handleBatchSetActive(keys, false),
              },
            ]}
          />,
        ]}
      />

      <FormModalTemplate
        title={editing ? t('app.kuaicaiwu.standardCost.edit') : t('app.kuaicaiwu.standardCost.create')}
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        onFinish={async (values) => {
          if (editing) {
            await standardCostService.update(editing.id, values);
            messageApi.success(t('app.kuaicaiwu.costCommon.updateSuccess'));
          } else {
            await standardCostService.create(values);
            messageApi.success(t('app.kuaicaiwu.costCommon.createSuccess'));
          }
          setModalVisible(false);
          actionRef.current?.reload();
        }}
        initialValues={editing ?? { currency: 'CNY', version: '1.0', is_active: true }}
      >
        <ProFormSelect
          name="target_type"
          label={t('app.kuaicaiwu.standardCost.col.targetType')}
          rules={[{ required: true }]}
          options={targetTypeOptions}
          disabled={!!editing}
        />
        <ProFormDigit
          name="target_id"
          label={t('app.kuaicaiwu.standardCost.field.targetId')}
          rules={[{ required: true }]}
          min={1}
          disabled={!!editing}
          tooltip={t('app.kuaicaiwu.standardCost.field.targetIdTooltip')}
        />
        <ProFormText name="target_code" label={t('app.kuaicaiwu.standardCost.col.targetCode')} />
        <ProFormText name="target_name" label={t('app.kuaicaiwu.standardCost.col.targetName')} />
        <ProFormSelect
          name="cost_item_type"
          label={t('app.kuaicaiwu.standardCost.col.costItemType')}
          rules={[{ required: true }]}
          options={costItemOptions}
          disabled={!!editing}
        />
        <ProFormDigit name="standard_value" label={t('app.kuaicaiwu.standardCost.col.standardValue')} rules={[{ required: true }]} min={0} />
        <ProFormText name="unit" label={t('app.kuaicaiwu.standardCost.col.unit')} />
        <ProFormText name="version" label={t('app.kuaicaiwu.standardCost.col.version')} />
        <ProFormDatePicker name="effective_date" label={t('app.kuaicaiwu.standardCost.field.effectiveDate')} />
        <ProFormDatePicker name="expiry_date" label={t('app.kuaicaiwu.standardCost.field.expiryDate')} />
        <ProFormSwitch name="is_active" label={t('app.kuaicaiwu.standardCost.status.active')} />
        <ProFormTextArea name="description" label={t('app.kuaicaiwu.costCommon.description')} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default StandardCostsPage;
