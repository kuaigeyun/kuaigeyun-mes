/**
 * KPI 指标定义页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProFormText, ProFormDigit, ProFormSelect, ProFormSwitch, ProFormTextArea } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi } from '../../../services/performance';
import type { KPIDefinition } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';
import {
  getKpiCalcTypeOptions,
  getKpiCalcTypeText,
  getPerformanceYesNoValueEnum,
} from '../components/performanceMeta';
import { formatDateTime } from '../../../../../utils/format';

const KpiDefinitionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const calcTypeOptions = useMemo(() => getKpiCalcTypeOptions(t), [t]);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true, weight: 1 });
      return;
    }
    employeePerformanceApi.getKpiDefinition(editId).then((r) => {
      formRef.current?.setFieldsValue({
        code: r.code,
        name: r.name,
        weight: r.weight,
        calc_type: r.calc_type,
        is_active: r.is_active !== false,
        formula_json: r.formula_json ? JSON.stringify(r.formula_json, null, 2) : '',
      });
    }).catch((e: any) => messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed')));
  }, [modalVisible, editId, messageApi, t]);

  const handleCreate = () => {
    setEditId(null);
    setModalVisible(true);
  };
  const handleEdit = (r: KPIDefinition) => {
    setEditId(r.id);
    setModalVisible(true);
  };
  const handleDelete = async (r: KPIDefinition) => {
    try {
      await employeePerformanceApi.deleteKpiDefinition(r.id);
      messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
    }
  };

  const columns: ProColumns<KPIDefinition>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.performance.common.columns.code'),
        dataIndex: 'code',
        width: 120,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
            {r.code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.performance.common.columns.name'), dataIndex: 'name', width: 150, ellipsis: true },
      { title: t('app.kuaizhizao.performance.common.columns.weight'), dataIndex: 'weight', width: 80, align: 'right' },
      {
        title: t('app.kuaizhizao.performance.common.columns.calcType'),
        dataIndex: 'calc_type',
        width: 100,
        render: (_, r) => getKpiCalcTypeText(t, r.calc_type),
      },
      {
        title: t('app.kuaizhizao.performance.common.form.active'),
        dataIndex: 'is_active',
        hideInTable: true,
        valueEnum: getPerformanceYesNoValueEnum(t),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.updatedAt'),
        dataIndex: 'updated_at',
        width: 168,
        hideInSearch: true,
        render: (_, r) => (r.updated_at ? formatDateTime(r.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.lifecycle'),
        dataIndex: 'lifecycle_stage',
        fixed: 'right',
        align: 'left',
        hideInSearch: true,
        render: (_, record) => {
          const lifecycle = getPerformanceConfigActiveLifecycle(record as unknown as Record<string, unknown>);
          return (
            <UniLifecycle
              percent={lifecycle.percent}
              stageName={lifecycle.stageName}
              status={lifecycle.status}
              subStages={lifecycle.subStages}
              showLabel
              size="small"
              showCircleTooltip={false}
            />
          );
        },
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.actions'),
        width: 150,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              {t('app.kuaizhizao.performance.common.actions.edit')}
            </Button>
            <Popconfirm title={t('app.kuaizhizao.performance.kpi.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('app.kuaizhizao.performance.common.actions.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<KPIDefinition>
          headerTitle={t('app.kuaizhizao.performance.kpi.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.kpi-definitions"
          showAdvancedSearch
          request={async (params) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const result = await employeePerformanceApi.listKpiDefinitions({
                skip,
                limit: pageSize,
              });
              const rows = Array.isArray(result) ? result : [];
              const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
              return { data: rows, success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1280 }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            try {
              for (const id of keys) {
                await employeePerformanceApi.deleteKpiDefinition(Number(id));
              }
              messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.kpi.messages.deleteBatchConfirm', { count })}
          showCreateButton
          createButtonText={t('app.kuaizhizao.performance.kpi.createButton')}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? t('app.kuaizhizao.performance.kpi.modal.editTitle') : t('app.kuaizhizao.performance.kpi.modal.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          let formula_json: Record<string, unknown> | undefined;
          if (values.formula_json) {
            try {
              formula_json = JSON.parse(values.formula_json);
            } catch {
              messageApi.error(t('app.kuaizhizao.performance.common.messages.invalidJson'));
              return;
            }
          }
          const payload = {
            code: values.code,
            name: values.name,
            weight: values.weight || 1,
            calc_type: values.calc_type,
            is_active: values.is_active !== false,
            formula_json,
          };
          if (editId) {
            await employeePerformanceApi.updateKpiDefinition(editId, payload);
            messageApi.success(t('app.kuaizhizao.performance.common.messages.updateSuccess'));
          } else {
            await employeePerformanceApi.createKpiDefinition(payload);
            messageApi.success(t('app.kuaizhizao.performance.common.messages.createSuccess'));
          }
          setModalVisible(false);
          setEditId(null);
          actionRef.current?.reload();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormText name="code" label={t('app.kuaizhizao.performance.common.columns.code')} rules={[{ required: true }]} colProps={{ span: 12 }} disabled={!!editId} />
        <ProFormText name="name" label={t('app.kuaizhizao.performance.common.columns.name')} rules={[{ required: true }]} colProps={{ span: 12 }} />
        <ProFormDigit name="weight" label={t('app.kuaizhizao.performance.common.columns.weight')} min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormSelect name="calc_type" label={t('app.kuaizhizao.performance.common.columns.calcType')} rules={[{ required: true }]} options={calcTypeOptions} colProps={{ span: 12 }} />
        <ProFormTextArea
          name="formula_json"
          label={t('app.kuaizhizao.performance.kpi.form.formulaJson')}
          colProps={{ span: 24 }}
          fieldProps={{ rows: 4 }}
          placeholder={t('app.kuaizhizao.performance.kpi.form.formulaPlaceholder')}
        />
        <ProFormSwitch name="is_active" label={t('app.kuaizhizao.performance.common.form.active')} colProps={{ span: 12 }} />
      </FormModalTemplate>
    </>
  );
};

export default KpiDefinitionsPage;
