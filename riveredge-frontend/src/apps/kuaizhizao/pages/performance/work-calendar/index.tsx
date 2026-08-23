/**
 * 绩效工作日历：厂级工作时段 + 加班管理 + 工位停机窗（APS 引用真源）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  App,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Spin,
  Switch,
  TimePicker,
  Typography,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import {
  UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
  UniTableStackedPrimaryCell,
} from '../../../../../components/uni-table/stackedPrimaryColumn';
import { rowActionKind } from '../../../../../components/uni-action';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { workCalendarApi, overtimeApi, stationUnavailableApi } from '../../../services/performance';
import type { OvertimePlan, StationUnavailableWindow, WorkCalendarConfig } from '../../../types/performance';
import { renderActiveTag } from '../components/performanceMeta';
import { normalizePerformanceListResponse } from '../../../utils/performanceListCore';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';

const CALENDAR_RESOURCE = 'kuaizhizao:performance-work-calendar';
const OVERTIME_RESOURCE = 'kuaizhizao:performance-overtimes';

type ConfigForm = {
  workDayRange: [Dayjs, Dayjs];
  breakRange?: [Dayjs, Dayjs] | null;
  windowSource: 'fixed' | 'shift';
};

type OvertimeForm = {
  overtimeDate: Dayjs;
  timeRange: [Dayjs, Dayjs];
  name?: string;
  isActive: boolean;
};

type WorkCalendarTabKey = 'config' | 'overtime' | 'downtime';

const WorkCalendarPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const calendarPerms = useResourcePermissions(CALENDAR_RESOURCE);
  const overtimePerms = useResourcePermissions(OVERTIME_RESOURCE);
  const actionRef = useRef<ActionType>(null);
  const [activeTabKey, setActiveTabKey] = useState<WorkCalendarTabKey>('config');

  const [config, setConfig] = useState<WorkCalendarConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configForm] = Form.useForm<ConfigForm>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OvertimePlan | null>(null);
  const [savingOt, setSavingOt] = useState(false);
  const [otForm] = Form.useForm<OvertimeForm>();
  const downtimeActionRef = useRef<ActionType>(null);
  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [editingDowntime, setEditingDowntime] = useState<StationUnavailableWindow | null>(null);
  const [savingDowntime, setSavingDowntime] = useState(false);
  const [downtimeForm] = Form.useForm<{
    stationId: number;
    range: [Dayjs, Dayjs];
    reason?: string;
    isActive: boolean;
  }>();

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const data = await workCalendarApi.get();
      setConfig(data);
      configForm.setFieldsValue({
        workDayRange: [
          dayjs(data.workDayStart.slice(0, 5), 'HH:mm'),
          dayjs(data.workDayEnd.slice(0, 5), 'HH:mm'),
        ],
        breakRange:
          data.breakStart && data.breakEnd
            ? [
                dayjs(data.breakStart.slice(0, 5), 'HH:mm'),
                dayjs(data.breakEnd.slice(0, 5), 'HH:mm'),
              ]
            : null,
        windowSource: data.windowSource === 'shift' ? 'shift' : 'fixed',
      });
    } catch (e: any) {
      messageApi.error(
        e?.message || t('app.kuaizhizao.performance.workCalendar.messages.loadFailed'),
      );
    } finally {
      setConfigLoading(false);
    }
  }, [configForm, messageApi, t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = async () => {
    if (!calendarPerms.canUpdate) return;
    try {
      const values = await configForm.validateFields();
      setConfigSaving(true);
      const [ws, we] = values.workDayRange;
      const breakRange = values.breakRange;
      const updated = await workCalendarApi.update({
        workDayStart: ws.format('HH:mm'),
        workDayEnd: we.format('HH:mm'),
        breakStart: breakRange?.[0] ? breakRange[0].format('HH:mm') : null,
        breakEnd: breakRange?.[1] ? breakRange[1].format('HH:mm') : null,
        windowSource: values.windowSource === 'shift' ? 'shift' : 'fixed',
      });
      setConfig(updated);
      messageApi.success(t('app.kuaizhizao.performance.workCalendar.messages.configSaved'));
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(
        e?.message || t('common.saveFailed'),
      );
    } finally {
      setConfigSaving(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    otForm.setFieldsValue({
      overtimeDate: dayjs(),
      timeRange: [dayjs('18:00', 'HH:mm'), dayjs('20:00', 'HH:mm')],
      name: undefined,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEdit = (row: OvertimePlan) => {
    setEditing(row);
    otForm.setFieldsValue({
      overtimeDate: dayjs(row.overtimeDate),
      timeRange: [
        dayjs(row.startTime.slice(0, 5), 'HH:mm'),
        dayjs(row.endTime.slice(0, 5), 'HH:mm'),
      ],
      name: row.name,
      isActive: row.isActive,
    });
    setModalOpen(true);
  };

  const openCreateDowntime = () => {
    setEditingDowntime(null);
    downtimeForm.setFieldsValue({
      stationId: undefined as unknown as number,
      range: [dayjs().startOf('hour'), dayjs().startOf('hour').add(2, 'hour')],
      reason: undefined,
      isActive: true,
    });
    setDowntimeOpen(true);
  };

  const handleSaveOvertime = async () => {
    try {
      const values = await otForm.validateFields();
      setSavingOt(true);
      const payload = {
        overtimeDate: values.overtimeDate.format('YYYY-MM-DD'),
        startTime: values.timeRange[0].format('HH:mm'),
        endTime: values.timeRange[1].format('HH:mm'),
        name: values.name?.trim() || undefined,
        isActive: values.isActive,
      };
      if (editing) {
        await overtimeApi.update(editing.uuid, payload);
      } else {
        await overtimeApi.create(payload);
      }
      messageApi.success(t('app.kuaizhizao.performance.workCalendar.messages.overtimeSaved'));
      setModalOpen(false);
      actionRef.current?.reload();
    } catch (e: any) {
      if (e?.errorFields) return;
      messageApi.error(
        e?.message || t('common.saveFailed'),
      );
    } finally {
      setSavingOt(false);
    }
  };

  const columns: ProColumns<OvertimePlan>[] = useMemo(
    () =>
      alignProColumns<OvertimePlan>(
        [
          {
            title: t('common.name'),
            key: 'performance_holiday_stacked',
            dataIndex: 'name',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            hideInSearch: true,
            render: (_, r) => (
              <UniTableStackedPrimaryCell
                primary={String(r.name ?? '').trim() || '-'}
                secondary={r.overtimeDate ? String(r.overtimeDate) : '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.performance.workCalendar.columns.overtimeDate'),
            dataIndex: 'overtimeDate',
            valueType: 'date',
            width: 132,
            minWidth: 132,
            uniTableKeepWidth: true,
            resizable: false,
            hideInSearch: true,
            hideInTable: true,
          },
          {
            title: t('app.kuaizhizao.performance.workCalendar.columns.timeRange'),
            key: 'timeRange',
            dataIndex: 'startTime',
            hideInSearch: true,
            width: 140,
            minWidth: 140,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, r) =>
              `${(r.startTime || '').slice(0, 5)} ~ ${(r.endTime || '').slice(0, 5)}`,
          },
          {
            title: t('common.status'),
            dataIndex: 'isActive',
            hideInSearch: true,
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, r) => renderActiveTag(t, r.isActive, 'inactive'),
          },
          {
            title: t('common.actions'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => (
              <Space>
                {overtimePerms.canUpdate ? (
                  <Button key="edit" {...rowActionKind('update')} onClick={() => openEdit(row)}>
                    {t('common.edit')}
                  </Button>
                ) : null}
                {overtimePerms.canDelete ? (
                  <Popconfirm
                    key="delete"
                    {...rowActionKind('delete')}
                    title={t('app.kuaizhizao.performance.workCalendar.messages.deleteConfirm')}
                    onConfirm={async () => {
                      try {
                        await overtimeApi.delete(row.uuid);
                        messageApi.success(
                          t('app.kuaizhizao.performance.workCalendar.messages.overtimeDeleted'),
                        );
                        actionRef.current?.reload();
                      } catch (e: any) {
                        messageApi.error(
                          e?.message ||
                            t('common.saveFailed'),
                        );
                      }
                    }}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                      {t('common.delete')}
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            ),
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [messageApi, overtimePerms.canDelete, overtimePerms.canUpdate, t],
  );

  const downtimeColumns: ProColumns<StationUnavailableWindow>[] = useMemo(
    () =>
      alignProColumns<StationUnavailableWindow>(
        [
          {
            title: t('app.kuaizhizao.performance.workCalendar.columns.stationId'),
            dataIndex: 'stationId',
            ...UNI_TABLE_STACKED_PRIMARY_COLUMN_DEFAULTS,
            fixed: 'left',
            render: (_, r) => (
              <UniTableStackedPrimaryCell
                primary={String(r.stationId ?? '-')}
                secondary={String(r.reason ?? '').trim() || '-'}
                secondaryCopyable={false}
              />
            ),
          },
          {
            title: t('app.kuaizhizao.performance.workCalendar.columns.startAt'),
            dataIndex: 'startAt',
            width: 156,
            minWidth: 156,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, r) => dayjs(r.startAt).format('YYYY-MM-DD HH:mm'),
          },
          {
            title: t('app.kuaizhizao.performance.workCalendar.columns.endAt'),
            dataIndex: 'endAt',
            width: 156,
            minWidth: 156,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, r) => dayjs(r.endAt).format('YYYY-MM-DD HH:mm'),
          },
          {
            title: t('app.kuaizhizao.performance.workCalendar.columns.reason'),
            dataIndex: 'reason',
            hideInTable: true,
            ellipsis: true,
          },
          {
            title: t('common.status'),
            dataIndex: 'isActive',
            width: 88,
            minWidth: 88,
            uniTableKeepWidth: true,
            resizable: false,
            render: (_, r) => renderActiveTag(t, r.isActive, 'inactive'),
          },
          {
            title: t('common.actions'),
            key: 'action',
            valueType: 'option',
            fixed: 'right',
            hideInSearch: true,
            render: (_, row) => (
              <Space>
                {calendarPerms.canUpdate ? (
                  <Button
                    key="edit"
                    {...rowActionKind('update')}
                    onClick={() => {
                      setEditingDowntime(row);
                      downtimeForm.setFieldsValue({
                        stationId: row.stationId,
                        range: [dayjs(row.startAt), dayjs(row.endAt)],
                        reason: row.reason || undefined,
                        isActive: row.isActive,
                      });
                      setDowntimeOpen(true);
                    }}
                  >
                    {t('common.edit')}
                  </Button>
                ) : null}
                {calendarPerms.canDelete ? (
                  <Popconfirm
                    key="delete"
                    {...rowActionKind('delete')}
                    title={t('app.kuaizhizao.performance.workCalendar.messages.deleteConfirm')}
                    onConfirm={async () => {
                      try {
                        await stationUnavailableApi.delete(row.uuid);
                        messageApi.success(
                          t('app.kuaizhizao.performance.workCalendar.messages.downtimeDeleted'),
                        );
                        downtimeActionRef.current?.reload();
                      } catch (e: any) {
                        messageApi.error(
                          e?.message ||
                            t('common.saveFailed'),
                        );
                      }
                    }}
                  >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                      {t('common.delete')}
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            ),
          },
        ],
        SALES_DOC_LIST_FIELD_RANK,
      ),
    [calendarPerms.canDelete, calendarPerms.canUpdate, downtimeForm, messageApi, t],
  );

  let tabBarExtraContent: React.ReactNode = undefined;
  if (activeTabKey === 'config' && calendarPerms.canUpdate) {
    tabBarExtraContent = (
      <Button type="primary" loading={configSaving} onClick={() => void handleSaveConfig()}>
        {t('common.save')}
      </Button>
    );
  } else if (activeTabKey === 'overtime' && overtimePerms.canCreate) {
    tabBarExtraContent = (
      <Button type="primary" onClick={openCreate}>
        {t('app.kuaizhizao.performance.workCalendar.createOvertime')}
      </Button>
    );
  } else if (activeTabKey === 'downtime' && calendarPerms.canUpdate) {
    tabBarExtraContent = (
      <Button type="primary" onClick={openCreateDowntime}>
        {t('app.kuaizhizao.performance.workCalendar.createDowntime')}
      </Button>
    );
  }

  return (
    <>
      <MultiTabListPageTemplate
        activeTabKey={activeTabKey}
        onTabChange={(key) => setActiveTabKey(key as WorkCalendarTabKey)}
        preserveMounted
        tabBarExtraContent={tabBarExtraContent}
        tabs={[
          {
            key: 'config',
            label: t('app.kuaizhizao.performance.workCalendar.configTitle'),
            children: (
              <Spin spinning={configLoading}>
                <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                  {t('app.kuaizhizao.performance.workCalendar.configHint')}
                </Typography.Paragraph>
                <Form form={configForm} layout="vertical" disabled={!calendarPerms.canUpdate}>
                  <Form.Item
                    name="workDayRange"
                    label={t('app.kuaizhizao.performance.workCalendar.workDayRange')}
                    rules={[{ required: true }]}
                  >
                    <TimePicker.RangePicker format="HH:mm" needConfirm={false} />
                  </Form.Item>
                  <Form.Item
                    name="breakRange"
                    label={t('app.kuaizhizao.performance.workCalendar.breakRange')}
                  >
                    <TimePicker.RangePicker
                      format="HH:mm"
                      needConfirm={false}
                      allowEmpty={[true, true]}
                    />
                  </Form.Item>
                  <Form.Item
                    name="windowSource"
                    label={t('app.kuaizhizao.performance.workCalendar.windowSource')}
                    rules={[{ required: true }]}
                    extra={t('app.kuaizhizao.performance.workCalendar.windowSourceHint')}
                  >
                    <Radio.Group>
                      <Radio value="fixed">
                        {t('app.kuaizhizao.performance.workCalendar.windowSourceFixed')}
                      </Radio>
                      <Radio value="shift">
                        {t('app.kuaizhizao.performance.workCalendar.windowSourceShift')}
                      </Radio>
                    </Radio.Group>
                  </Form.Item>
                </Form>
                {config ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('app.kuaizhizao.performance.workCalendar.updatedAt', {
                      time: config.updatedAt
                        ? dayjs(config.updatedAt).format('YYYY-MM-DD HH:mm')
                        : '-',
                    })}
                  </Typography.Text>
                ) : null}
              </Spin>
            ),
          },
          {
            key: 'overtime',
            label: t('app.kuaizhizao.performance.workCalendar.overtimeTitle'),
            children: (
              <>
                <Typography.Paragraph type="secondary" style={{ marginTop: 0, flexShrink: 0 }}>
                  {t('app.kuaizhizao.performance.workCalendar.overtimeHint')}
                </Typography.Paragraph>
                <UniTable<OvertimePlan>
                  headerTitle={t('app.kuaizhizao.performance.workCalendar.overtimeTableTitle')}
                  columnPersistenceId="apps.kuaizhizao.pages.performance.work-calendar.v1"
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('kuaizhizao.workCalendar')}
                  actionRef={actionRef}
                  columns={columns}
                  rowKey="uuid"
                  search={false}
                  request={async (params) => {
                    try {
                      const pageSize = params.pageSize || 20;
                      const skip = ((params.current || 1) - 1) * pageSize;
                      const res = await overtimeApi.list({ skip, limit: pageSize });
                      const { data, total } = normalizePerformanceListResponse(res);
                      return { data: data as OvertimePlan[], success: true, total };
                    } catch (e: any) {
                      messageApi.error(
                        e?.message ||
                          t('app.kuaizhizao.performance.workCalendar.messages.loadFailed'),
                      );
                      return { data: [], success: false, total: 0 };
                    }
                  }}
                  pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                />
              </>
            ),
          },
          {
            key: 'downtime',
            label: t('app.kuaizhizao.performance.workCalendar.downtimeTitle'),
            children: (
              <>
                <Typography.Paragraph type="secondary" style={{ marginTop: 0, flexShrink: 0 }}>
                  {t('app.kuaizhizao.performance.workCalendar.downtimeHint')}
                </Typography.Paragraph>
                <UniTable<StationUnavailableWindow>
                  headerTitle={t('app.kuaizhizao.performance.workCalendar.downtimeTableTitle')}
                  columnPersistenceId="apps.kuaizhizao.pages.performance.work-calendar.downtime.v1"
                  actionRef={downtimeActionRef}
                  rowKey="uuid"
                  search={false}
                  columns={downtimeColumns}
                  request={async (params) => {
                    try {
                      const pageSize = params.pageSize || 20;
                      const skip = ((params.current || 1) - 1) * pageSize;
                      const res = await stationUnavailableApi.list({ skip, limit: pageSize });
                      const { data, total } = normalizePerformanceListResponse(res);
                      return { data: data as StationUnavailableWindow[], success: true, total };
                    } catch (e: any) {
                      messageApi.error(
                        e?.message ||
                          t('app.kuaizhizao.performance.workCalendar.messages.loadFailed'),
                      );
                      return { data: [], success: false, total: 0 };
                    }
                  }}
                  pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                />
              </>
            ),
          },
        ]}
      />

      <Modal
        title={
          editing
            ? t('app.kuaizhizao.performance.workCalendar.editOvertime')
            : t('app.kuaizhizao.performance.workCalendar.createOvertime')
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSaveOvertime()}
        confirmLoading={savingOt}
        destroyOnClose
      >
        <Form form={otForm} layout="vertical">
          <Form.Item
            name="overtimeDate"
            label={t('app.kuaizhizao.performance.workCalendar.columns.overtimeDate')}
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="timeRange"
            label={t('app.kuaizhizao.performance.workCalendar.columns.timeRange')}
            rules={[{ required: true }]}
          >
            <TimePicker.RangePicker format="HH:mm" needConfirm={false} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="name" label={t('common.name')}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="isActive"
            label={t('common.status')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          editingDowntime
            ? t('app.kuaizhizao.performance.workCalendar.editDowntime')
            : t('app.kuaizhizao.performance.workCalendar.createDowntime')
        }
        open={downtimeOpen}
        onCancel={() => setDowntimeOpen(false)}
        confirmLoading={savingDowntime}
        destroyOnClose
        onOk={async () => {
          try {
            const values = await downtimeForm.validateFields();
            setSavingDowntime(true);
            const payload = {
              stationId: Number(values.stationId),
              startAt: values.range[0].toISOString(),
              endAt: values.range[1].toISOString(),
              reason: values.reason?.trim() || undefined,
              isActive: values.isActive,
            };
            if (editingDowntime) {
              await stationUnavailableApi.update(editingDowntime.uuid, payload);
            } else {
              await stationUnavailableApi.create(payload);
            }
            messageApi.success(
              t('app.kuaizhizao.performance.workCalendar.messages.downtimeSaved'),
            );
            setDowntimeOpen(false);
            downtimeActionRef.current?.reload();
          } catch (e: any) {
            if (e?.errorFields) return;
            messageApi.error(
              e?.message || t('common.saveFailed'),
            );
          } finally {
            setSavingDowntime(false);
          }
        }}
      >
        <Form form={downtimeForm} layout="vertical">
          <Form.Item
            name="stationId"
            label={t('app.kuaizhizao.performance.workCalendar.columns.stationId')}
            rules={[{ required: true }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="range"
            label={t('app.kuaizhizao.performance.workCalendar.columns.timeRange')}
            rules={[{ required: true }]}
          >
            <DatePicker.RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="reason"
            label={t('app.kuaizhizao.performance.workCalendar.columns.reason')}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item
            name="isActive"
            label={t('common.status')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default WorkCalendarPage;
