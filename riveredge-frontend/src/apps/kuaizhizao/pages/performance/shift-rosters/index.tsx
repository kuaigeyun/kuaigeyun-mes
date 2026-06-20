/**
 * 排班管理页面（按工作小组 + 周视图）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, DatePicker, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { shiftApi, shiftRosterApi } from '../../../services/performance';
import type { Shift, ShiftAssignment, ShiftRoster } from '../../../types/performance';
import { factoryListItems, workGroupApi } from '../../../../master-data/services/factory';
import type { WorkGroup } from '../../../../master-data/types/factory';
import { formatDateTime } from '../../../../../utils/format';

dayjs.extend(isoWeek);

type MatrixRow = {
  key: number;
  employeeId: number;
  employeeName: string;
  cells: Record<string, number | null | undefined>;
};

const REST_VALUE = 0;

const WEEKDAY_KEYS = [
  'app.kuaizhizao.performance.common.weekday.mon',
  'app.kuaizhizao.performance.common.weekday.tue',
  'app.kuaizhizao.performance.common.weekday.wed',
  'app.kuaizhizao.performance.common.weekday.thu',
  'app.kuaizhizao.performance.common.weekday.fri',
  'app.kuaizhizao.performance.common.weekday.sat',
  'app.kuaizhizao.performance.common.weekday.sun',
] as const;

const ShiftRostersPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [workGroupId, setWorkGroupId] = useState<number | undefined>();
  const [weekAnchor, setWeekAnchor] = useState<Dayjs>(dayjs().startOf('isoWeek'));
  const [roster, setRoster] = useState<ShiftRoster | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const periodStart = useMemo(() => weekAnchor.startOf('isoWeek').format('YYYY-MM-DD'), [weekAnchor]);
  const weekDates = useMemo(() => {
    const start = weekAnchor.startOf('isoWeek');
    return Array.from({ length: 7 }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'));
  }, [weekAnchor]);

  const shiftOptions = useMemo(
    () => [
      { label: t('app.kuaizhizao.performance.common.form.rest'), value: REST_VALUE },
      ...shifts.filter((s) => s.isActive).map((s) => ({ label: `${s.name} (${s.code})`, value: s.id })),
    ],
    [shifts, t],
  );

  const loadBase = useCallback(async () => {
    try {
      const [wgRes, shiftList] = await Promise.all([
        workGroupApi.list({ limit: 500, is_active: true }),
        shiftApi.list({ limit: 200, is_active: true }),
      ]);
      const wgItems = factoryListItems(wgRes);
      setWorkGroups(wgItems);
      setShifts(shiftList);
      if (!workGroupId && wgItems.length > 0) {
        setWorkGroupId(wgItems[0].id);
      }
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.rosters.messages.loadBaseFailed'));
    }
  }, [messageApi, workGroupId, t]);

  const buildMatrix = useCallback(
    (wg: WorkGroup, rosterData: ShiftRoster) => {
      const members = wg.members ?? [];
      const assignmentMap = new Map<string, number | null>();
      (rosterData.assignments ?? []).forEach((a: ShiftAssignment) => {
        assignmentMap.set(`${a.employeeId}_${a.workDate}`, a.shiftId ?? null);
      });
      const rows: MatrixRow[] = members.map((m) => {
        const cells: Record<string, number | null | undefined> = {};
        weekDates.forEach((d) => {
          const sid = assignmentMap.get(`${m.employeeId}_${d}`);
          cells[d] = sid === undefined ? undefined : sid === null ? REST_VALUE : sid;
        });
        return {
          key: m.employeeId,
          employeeId: m.employeeId,
          employeeName: m.employeeName || t('app.kuaizhizao.performance.rosters.employeeFallback', { id: m.employeeId }),
          cells,
        };
      });
      setMatrix(rows);
    },
    [weekDates, t],
  );

  const loadRoster = useCallback(async () => {
    if (!workGroupId) return;
    setLoading(true);
    try {
      const wgMeta = workGroups.find((w) => w.id === workGroupId);
      if (!wgMeta?.uuid) {
        messageApi.warning(t('app.kuaizhizao.performance.rosters.messages.selectWorkGroup'));
        return;
      }
      const wg = await workGroupApi.get(wgMeta.uuid);
      const rosterData = await shiftRosterApi.getByWeek(workGroupId, periodStart);
      setRoster(rosterData);
      buildMatrix(wg, rosterData);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.rosters.messages.loadRosterFailed'));
      setRoster(null);
      setMatrix([]);
    } finally {
      setLoading(false);
    }
  }, [workGroupId, periodStart, workGroups, buildMatrix, messageApi, t]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    if (workGroupId) {
      loadRoster();
    }
  }, [workGroupId, periodStart, loadRoster]);

  const handleCellChange = (employeeId: number, workDate: string, value: number) => {
    setMatrix((prev) =>
      prev.map((row) =>
        row.employeeId === employeeId
          ? { ...row, cells: { ...row.cells, [workDate]: value === REST_VALUE ? null : value } }
          : row,
      ),
    );
  };

  const collectAssignments = () => {
    const list: Array<{ employeeId: number; workDate: string; shiftId: number | null }> = [];
    matrix.forEach((row) => {
      weekDates.forEach((d) => {
        const v = row.cells[d];
        if (v === undefined) return;
        list.push({
          employeeId: row.employeeId,
          workDate: d,
          shiftId: v === REST_VALUE || v === null ? null : (v as number),
        });
      });
    });
    return list;
  };

  const handleSave = async () => {
    if (!roster?.uuid) return;
    try {
      setSaving(true);
      const updated = await shiftRosterApi.saveAssignments(roster.uuid, collectAssignments());
      setRoster(updated);
      messageApi.success(t('app.kuaizhizao.performance.rosters.messages.saveSuccess'));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!roster?.uuid) return;
    try {
      setSaving(true);
      const updated = await shiftRosterApi.publish(roster.uuid);
      setRoster(updated);
      messageApi.success(t('app.kuaizhizao.performance.rosters.messages.publishSuccess'));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.publishFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrevious = async () => {
    if (!roster?.uuid) return;
    try {
      setSaving(true);
      const updated = await shiftRosterApi.copyFromPreviousWeek(roster.uuid);
      setRoster(updated);
      const wgUuid = workGroups.find((w) => w.id === workGroupId)?.uuid;
      if (wgUuid) {
        const wg = await workGroupApi.get(wgUuid);
        buildMatrix(wg, updated);
      }
      messageApi.success(t('app.kuaizhizao.performance.rosters.messages.copySuccess'));
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.copyFailed'));
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<MatrixRow> = useMemo(() => {
    const base: ColumnsType<MatrixRow> = [
      {
        title: t('app.kuaizhizao.performance.common.columns.employee'),
        dataIndex: 'employeeName',
        fixed: 'left',
        width: 120,
      },
    ];
    weekDates.forEach((d) => {
      base.push({
        title: (
          <span>
            {formatDateTime(d, 'MM-DD')}
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {t(WEEKDAY_KEYS[dayjs(d).isoWeekday() - 1])}
            </Typography.Text>
          </span>
        ),
        dataIndex: d,
        width: 130,
        render: (_, record) => {
          const val = record.cells[d];
          const selectVal = val === undefined ? undefined : val === null ? REST_VALUE : val;
          return (
            <Select
              size="small"
              style={{ width: '100%' }}
              allowClear
              placeholder="—"
              disabled={roster?.status === 'published'}
              options={shiftOptions}
              value={selectVal}
              onChange={(v) => handleCellChange(record.employeeId, d, v ?? REST_VALUE)}
            />
          );
        },
      });
    });
    return base;
  }, [weekDates, shiftOptions, roster?.status, t]);

  return (
    <ListPageTemplate>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <span>{t('app.kuaizhizao.performance.rosters.label.workGroup')}</span>
          <Select
            style={{ minWidth: 200 }}
            placeholder={t('app.kuaizhizao.performance.rosters.placeholder.workGroup')}
            value={workGroupId}
            options={workGroups.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            onChange={(v) => setWorkGroupId(v)}
          />
          <span>{t('app.kuaizhizao.performance.rosters.label.rosterWeek')}</span>
          <DatePicker
            picker="week"
            value={weekAnchor}
            onChange={(v) => v && setWeekAnchor(v.startOf('isoWeek'))}
          />
          {roster ? (
            <Tag color={roster.status === 'published' ? 'success' : 'processing'}>
              {roster.status === 'published'
                ? t('app.kuaizhizao.performance.common.rosterStatus.published')
                : t('app.kuaizhizao.performance.common.rosterStatus.draft')}
            </Tag>
          ) : null}
          <Button type="primary" loading={saving} disabled={roster?.status === 'published'} onClick={handleSave}>
            {t('app.kuaizhizao.performance.common.actions.saveDraft')}
          </Button>
          <Button loading={saving} disabled={roster?.status === 'published'} onClick={handlePublish}>
            {t('app.kuaizhizao.performance.common.actions.publish')}
          </Button>
          <Button loading={saving} disabled={roster?.status === 'published'} onClick={handleCopyPrevious}>
            {t('app.kuaizhizao.performance.common.actions.copyPreviousWeek')}
          </Button>
          <Button onClick={loadRoster}>{t('app.kuaizhizao.performance.common.actions.refresh')}</Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('app.kuaizhizao.performance.rosters.hint.period', {
            start: periodStart,
            end: weekAnchor.endOf('isoWeek').format('YYYY-MM-DD'),
          })}
        </Typography.Paragraph>
        <Table<MatrixRow>
          size="small"
          bordered
          loading={loading}
          pagination={false}
          scroll={{ x: 'max-content' }}
          rowKey="key"
          columns={columns}
          dataSource={matrix}
        />
      </Card>
    </ListPageTemplate>
  );
};

export default ShiftRostersPage;
