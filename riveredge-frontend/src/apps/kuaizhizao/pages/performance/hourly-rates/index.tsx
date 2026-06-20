/**
 * 工时单价配置页面
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi } from '../../../services/performance';
import type { HourlyRate } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';
import { getPerformanceYesNoValueEnum } from '../components/performanceMeta';
import { formatDateTime } from '../../../../../utils/format';

const HourlyRatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    Promise.all([employeePerformanceApi.listDepartments(), employeePerformanceApi.listPositions()])
      .then(([d, p]) => {
        setDepartments(d.items || []);
        setPositions(p.items || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true });
      return;
    }
    employeePerformanceApi.getHourlyRate(editId).then((r) => {
      formRef.current?.setFieldsValue({
        department_id: r.department_id,
        position_id: r.position_id,
        rate: r.rate,
        is_active: r.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed')));
  }, [modalVisible, editId, messageApi, t]);

  const handleCreate = () => {
    setEditId(null);
    setModalVisible(true);
  };
  const handleEdit = (r: HourlyRate) => {
    setEditId(r.id);
    setModalVisible(true);
  };
  const handleDelete = async (r: HourlyRate) => {
    try {
      await employeePerformanceApi.deleteHourlyRate(r.id);
      messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteSuccess'));
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
    }
  };

  const columns: ProColumns<HourlyRate>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.performance.common.columns.department'),
        dataIndex: 'department_name',
        width: 120,
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.department_name ?? '') }} ellipsis>
            {r.department_name ?? '-'}
          </Typography.Text>
        ),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.position'),
        dataIndex: 'position_name',
        width: 120,
        ellipsis: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.position_name ?? '') }} ellipsis>
            {r.position_name ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.performance.hourlyRates.columns.rate'), dataIndex: 'rate', width: 120, align: 'right' },
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
            <Popconfirm title={t('app.kuaizhizao.performance.hourlyRates.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
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
        <UniTable<HourlyRate>
          headerTitle={t('app.kuaizhizao.performance.hourlyRates.pageTitle')}
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.hourly-rates"
          showAdvancedSearch
          request={async (params) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const result = await employeePerformanceApi.listHourlyRates({
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
                await employeePerformanceApi.deleteHourlyRate(Number(id));
              }
              messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
            }
          }}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.hourlyRates.messages.deleteBatchConfirm', { count })}
          showCreateButton
          createButtonText={t('app.kuaizhizao.performance.hourlyRates.createButton')}
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? t('app.kuaizhizao.performance.hourlyRates.modal.editTitle') : t('app.kuaizhizao.performance.hourlyRates.modal.createTitle')}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          const payload = {
            department_id: values.department_id || undefined,
            position_id: values.position_id || undefined,
            rate: values.rate,
            is_active: values.is_active !== false,
          };
          if (editId) {
            await employeePerformanceApi.updateHourlyRate(editId, payload);
            messageApi.success(t('app.kuaizhizao.performance.common.messages.updateSuccess'));
          } else {
            await employeePerformanceApi.createHourlyRate(payload);
            messageApi.success(t('app.kuaizhizao.performance.common.messages.createSuccess'));
          }
          setModalVisible(false);
          setEditId(null);
          actionRef.current?.reload();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="department_id"
          label={t('app.kuaizhizao.performance.common.columns.department')}
          options={[{ label: t('app.kuaizhizao.performance.common.form.notSpecified'), value: null }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
          colProps={{ span: 12 }}
          disabled={!!editId}
        />
        <ProFormSelect
          name="position_id"
          label={t('app.kuaizhizao.performance.common.columns.position')}
          options={[{ label: t('app.kuaizhizao.performance.common.form.notSpecified'), value: null }, ...positions.map((p) => ({ label: p.name, value: p.id }))]}
          colProps={{ span: 12 }}
          disabled={!!editId}
        />
        <ProFormDigit name="rate" label={t('app.kuaizhizao.performance.hourlyRates.form.rate')} rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormSwitch name="is_active" label={t('app.kuaizhizao.performance.common.form.active')} colProps={{ span: 12 }} />
      </FormModalTemplate>
    </>
  );
};

export default HourlyRatesPage;
