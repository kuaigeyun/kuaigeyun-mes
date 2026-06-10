/**
 * 好力 GO — 设备保养项
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProDescriptionsItemProps,
  ProFormDependency,
  ProFormInstance,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Modal, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  ListPageTemplate,
  FormModalTemplate,
  FORM_LAYOUT,
  MODAL_CONFIG,
} from '../../../../../components/layout-templates';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  createEquipmentUpkeepParam,
  deleteEquipmentUpkeepParam,
  listEquipmentUpkeepParams,
  updateEquipmentUpkeepParam,
  type EquipmentUpkeepParamRow,
} from '../../../services/haoligo';
import {
  normalizeMoldUpkeepParamOptions,
  normalizeMoldUpkeepValueType,
  parseMultiselectMeasuredValue,
} from '../../../utils/moldUpkeepParamValueType';

const EquipmentUpkeepParamsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formInitialValues, setFormInitialValues] = useState<Record<string, unknown> | undefined>(undefined);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<EquipmentUpkeepParamRow | null>(null);

  const valueTypes = useMemo(
    () => [
      { label: t('app.haoligo.equipment.upkeepParams.valueTypeText'), value: 'text' },
      { label: t('app.haoligo.equipment.upkeepParams.valueTypeMultiselect'), value: 'multiselect' },
    ],
    [t],
  );

  const valueTypeLabel = useMemo(
    () => ({
      text: t('app.haoligo.equipment.upkeepParams.valueTypeText'),
      multiselect: t('app.haoligo.equipment.upkeepParams.valueTypeMultiselect'),
    }),
    [t],
  );

  const handleCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setFormInitialValues({ value_type: 'text' });
    setModalVisible(true);
  };

  useNewShortcut(handleCreate);

  const handleEdit = (record: EquipmentUpkeepParamRow) => {
    setIsEdit(true);
    setEditId(record.id);
    const vt = normalizeMoldUpkeepValueType(record.value_type);
    setFormInitialValues({
      code: record.code,
      name: record.name,
      requirement: record.requirement ?? '',
      value_type: vt,
      default_value:
        vt === 'multiselect'
          ? parseMultiselectMeasuredValue(record.default_value)
          : (record.default_value ?? undefined),
    });
    setModalVisible(true);
  };

  const handleDeleteOne = (record: EquipmentUpkeepParamRow) => {
    Modal.confirm({
      title: t('app.haoligo.equipment.upkeepParams.deleteTitle'),
      content: t('app.haoligo.equipment.upkeepParams.deleteContent', { name: record.name, code: record.code }),
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteEquipmentUpkeepParam(record.id);
          messageApi.success(t('app.haoligo.equipment.deleteSuccess'));
          actionRef.current?.reload();
        } catch (e) {
          messageApi.error((e as Error).message || t('app.haoligo.equipment.deleteFailed'));
        }
      },
    });
  };

  const buildPayload = (values: Record<string, unknown>) => {
    const value_type = normalizeMoldUpkeepValueType(String(values.value_type ?? 'text'));
    const default_value = normalizeMoldUpkeepParamOptions(value_type, values.default_value);
    if (value_type === 'multiselect' && !default_value) {
      throw new Error(t('app.haoligo.equipment.upkeepParams.optionsRequired'));
    }
    return {
      code: String(values.code ?? '').trim(),
      name: String(values.name ?? '').trim(),
      requirement: String(values.requirement ?? '').trim() || null,
      value_type,
      default_value,
    };
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    setFormLoading(true);
    try {
      const payload = buildPayload(values);
      if (isEdit && editId != null) {
        await updateEquipmentUpkeepParam(editId, {
          name: payload.name,
          requirement: payload.requirement,
          value_type: payload.value_type,
          default_value: payload.default_value,
        });
        messageApi.success(t('app.haoligo.equipment.updateSuccess'));
      } else {
        await createEquipmentUpkeepParam(payload);
        messageApi.success(t('app.haoligo.equipment.createSuccess'));
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
      throw e;
    } finally {
      setFormLoading(false);
    }
  };

  const columns: ProColumns<EquipmentUpkeepParamRow>[] = useMemo(
    () => [
      { title: t('app.haoligo.equipment.upkeepParams.colCode'), dataIndex: 'code', width: 120, copyable: true },
      { title: t('app.haoligo.equipment.upkeepParams.colName'), dataIndex: 'name', ellipsis: true },
      {
        title: t('app.haoligo.equipment.upkeepParams.colValueType'),
        dataIndex: 'value_type',
        width: 100,
        search: false,
        render: (_, r) => valueTypeLabel[normalizeMoldUpkeepValueType(r.value_type)] || r.value_type,
      },
      {
        title: t('app.haoligo.equipment.upkeepParams.colRequirement'),
        dataIndex: 'requirement',
        ellipsis: true,
        search: false,
        render: (_, r) => r.requirement || '—',
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right',
        render: (_, record) => [
          <Button
            key="view"
            {...rowActionKind('read')}
            onClick={() => {
              setDetailRecord(record);
              setDetailOpen(true);
            }}
          />,
          <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)} />,
          <Button key="delete" {...rowActionKind('delete')} onClick={() => handleDeleteOne(record)} />,
        ],
      },
    ],
    [t, valueTypeLabel],
  );

  const detailColumns: ProDescriptionsItemProps<EquipmentUpkeepParamRow>[] = useMemo(
    () => [
      { title: t('app.haoligo.equipment.upkeepParams.colCode'), dataIndex: 'code' },
      { title: t('app.haoligo.equipment.upkeepParams.colName'), dataIndex: 'name' },
      {
        title: t('app.haoligo.equipment.upkeepParams.colValueType'),
        dataIndex: 'value_type',
        render: (_, r) => (
          <Tag>{valueTypeLabel[normalizeMoldUpkeepValueType(r.value_type)] || r.value_type}</Tag>
        ),
      },
      { title: t('app.haoligo.equipment.upkeepParams.colRequirement'), dataIndex: 'requirement', render: (_, r) => r.requirement || '—' },
      {
        title: t('app.haoligo.equipment.upkeepParams.colOptions'),
        dataIndex: 'default_value',
        render: (_, r) => {
          if (normalizeMoldUpkeepValueType(r.value_type) !== 'multiselect') return '—';
          const parts = parseMultiselectMeasuredValue(r.default_value);
          return parts.length ? parts.join('、') : '—';
        },
      },
    ],
    [t, valueTypeLabel],
  );

  return (
    <ListPageTemplate>
      <UniTable<EquipmentUpkeepParamRow>
        headerTitle={t('app.haoligo.menu.equipment.upkeep-params')}
        actionRef={actionRef}
        columns={columns}
        columnPersistenceId="apps.haoligo.pages.equipment.upkeep-params"
        showCreateButton
        onCreate={handleCreate}
        request={async () => {
          const data = await listEquipmentUpkeepParams();
          return { data, success: true, total: data.length };
        }}
        rowKey="id"
        search={false}
        pagination={{ pageSize: 50 }}
      />

      <FormModalTemplate
        title={isEdit ? t('app.haoligo.equipment.upkeepParams.editTitle') : t('app.haoligo.equipment.upkeepParams.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef}
        initialValues={formInitialValues}
        loading={formLoading}
        isEdit={isEdit}
        onFinish={handleSubmit}
        width={MODAL_CONFIG.STANDARD_WIDTH}
        layout={FORM_LAYOUT.VERTICAL}
      >
        <ProFormText
          name="code"
          label={t('app.haoligo.equipment.upkeepParams.colCode')}
          rules={[{ required: true, message: t('app.haoligo.equipment.upkeepParams.codeRequired') }]}
          disabled={isEdit}
        />
        <ProFormText
          name="name"
          label={t('app.haoligo.equipment.upkeepParams.colName')}
          rules={[{ required: true, message: t('app.haoligo.equipment.upkeepParams.nameRequired') }]}
        />
        <ProFormTextArea
          name="requirement"
          label={t('app.haoligo.equipment.upkeepParams.colRequirement')}
          fieldProps={{ rows: 4 }}
        />
        <ProFormSelect
          name="value_type"
          label={t('app.haoligo.equipment.upkeepParams.colValueType')}
          options={valueTypes}
          rules={[{ required: true, message: t('app.haoligo.equipment.upkeepParams.valueTypeRequired') }]}
          fieldProps={{ optionFilterProp: 'label', style: { width: '100%' } }}
        />
        <ProFormDependency name={['value_type']}>
          {({ value_type }) => {
            const vt = normalizeMoldUpkeepValueType(String(value_type ?? 'text'));
            if (vt === 'multiselect') {
              return (
                <ProFormSelect
                  name="default_value"
                  label={t('app.haoligo.equipment.upkeepParams.colOptions')}
                  placeholder={t('app.haoligo.equipment.upkeepParams.optionsPh')}
                  rules={[{ required: true, message: t('app.haoligo.equipment.upkeepParams.optionsRequired') }]}
                  fieldProps={{
                    mode: 'tags',
                    tokenSeparators: [',', '，'],
                    style: { width: '100%' },
                  }}
                />
              );
            }
            return (
              <ProFormText
                name="default_value"
                label={t('app.haoligo.equipment.upkeepParams.defaultTextHint')}
                placeholder={t('app.haoligo.equipment.upkeepParams.defaultTextPh')}
                allowClear
              />
            );
          }}
        </ProFormDependency>
      </FormModalTemplate>

      <DetailDrawerTemplate
        title={t('app.haoligo.equipment.upkeepParams.detailTitle')}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        record={detailRecord}
        columns={detailColumns}
        drawerProps={DRAWER_CONFIG}
      />
    </ListPageTemplate>
  );
};

export default EquipmentUpkeepParamsPage;
