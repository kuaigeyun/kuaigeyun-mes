/**
 * 排班管理页面（按工作小组 + 周视图）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { shiftApi, shiftRosterApi } from '../../../services/performance';
import type { Shift, ShiftAssignment, ShiftRoster } from '../../../types/performance';
import { factoryListItems, workGroupApi } from '../../../../master-data/services/factory';
import type { WorkGroup } from '../../../../master-data/types/factory';

dayjs.extend(isoWeek);

type MatrixRow = {
  key: number;
  employeeId: number;
  employeeName: string;
  cells: Record<string, number | null | undefined>;
};

const REST_VALUE = 0;

const ShiftRostersPage: React.FC = () => {
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
      { label: '休息', value: REST_VALUE },
      ...shifts.filter((s) => s.isActive).map((s) => ({ label: `${s.name} (${s.code})`, value: s.id })),
    ],
    [shifts],
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
      messageApi.error(e?.message || '加载基础数据失败');
    }
  }, [messageApi, workGroupId]);

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
          employeeName: m.employeeName || `员工#${m.employeeId}`,
          cells,
        };
      });
      setMatrix(rows);
    },
    [weekDates],
  );

  const loadRoster = useCallback(async () => {
    if (!workGroupId) return;
    setLoading(true);
    try {
      const wgMeta = workGroups.find((w) => w.id === workGroupId);
      if (!wgMeta?.uuid) {
        messageApi.warning('请先选择工作小组');
        return;
      }
      const wg = await workGroupApi.get(wgMeta.uuid);
      const rosterData = await shiftRosterApi.getByWeek(workGroupId, periodStart);
      setRoster(rosterData);
      buildMatrix(wg, rosterData);
    } catch (e: any) {
      messageApi.error(e?.message || '加载排班表失败');
      setRoster(null);
      setMatrix([]);
    } finally {
      setLoading(false);
    }
  }, [workGroupId, periodStart, workGroups, buildMatrix, messageApi]);

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
      messageApi.success('排班已保存');
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败');
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
      messageApi.success('排班已发布');
    } catch (e: any) {
      messageApi.error(e?.message || '发布失败');
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
      messageApi.success('已复制上周排班');
    } catch (e: any) {
      messageApi.error(e?.message || '复制失败');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<MatrixRow> = useMemo(() => {
    const base: ColumnsType<MatrixRow> = [
      {
        title: '员工',
        dataIndex: 'employeeName',
        fixed: 'left',
        width: 120,
      },
    ];
    weekDates.forEach((d) => {
      base.push({
        title: (
          <span>
            {dayjs(d).format('MM-DD')}
            <br />
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {['一', '二', '三', '四', '五', '六', '日'][dayjs(d).isoWeekday() - 1]}
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
  }, [weekDates, shiftOptions, roster?.status]);

  return (
    <ListPageTemplate>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <span>工作小组</span>
          <Select
            style={{ minWidth: 200 }}
            placeholder="选择工作小组"
            value={workGroupId}
            options={workGroups.map((w) => ({ label: `${w.code} - ${w.name}`, value: w.id }))}
            onChange={(v) => setWorkGroupId(v)}
          />
          <span>排班周</span>
          <DatePicker
            picker="week"
            value={weekAnchor}
            onChange={(v) => v && setWeekAnchor(v.startOf('isoWeek'))}
          />
          {roster ? (
            <Tag color={roster.status === 'published' ? 'success' : 'processing'}>
              {roster.status === 'published' ? '已发布' : '草稿'}
            </Tag>
          ) : null}
          <Button type="primary" loading={saving} disabled={roster?.status === 'published'} onClick={handleSave}>
            保存草稿
          </Button>
          <Button loading={saving} disabled={roster?.status === 'published'} onClick={handlePublish}>
            发布
          </Button>
          <Button loading={saving} disabled={roster?.status === 'published'} onClick={handleCopyPrevious}>
            复制上周
          </Button>
          <Button onClick={loadRoster}>刷新</Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          周期：{periodStart} ~ {weekAnchor.endOf('isoWeek').format('YYYY-MM-DD')}。未排班单元格留空；选择「休息」表示当日不上班。
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
