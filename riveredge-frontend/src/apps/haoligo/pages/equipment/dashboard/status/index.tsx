/**
 * 好力 GO — 设备状态看板（卡片展示 + 车间筛选）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Dropdown, Empty, Flex, Select, Spin, Typography, theme } from 'antd';
import type { MenuProps } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import EquipmentStatusTrafficLight, {
  StatusBulbDot,
} from '../../../../components/EquipmentStatusTrafficLight';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { SecureImage } from '../../../../../../components/secure-image';
import {
  createEquipmentStatusAdjustment,
  listEquipments,
  listWorkshops,
  type EquipmentRow,
  type WorkshopRow,
} from '../../../../services/haoligo';
import { useEquipmentOperationalStatusLabels } from '../../../../utils/equipmentOperationalStatus';
import {
  formatOperationalStatusDuration,
  isShutdownOperationalStatus,
} from '../../../../utils/formatOperationalStatusDuration';

const EQUIPMENT_FETCH_LIMIT = 200;
/** 封面区 21:9；内边距内图片 object-fit: contain 保持原始比例 */
const CARD_COVER_ASPECT = '21 / 9';
const CARD_COVER_PADDING = 8;
/** 与应用中心卡片网格一致 */
const CARD_GRID_MIN_WIDTH = 300;
const VIEW_ALL = 'all';
const VIEW_GROUP = 'group';

function workshopViewKey(id: number): string {
  return `w-${id}`;
}

function parseWorkshopViewKey(mode: string): number | undefined {
  if (!mode.startsWith('w-')) return undefined;
  const id = Number(mode.slice(2));
  return Number.isFinite(id) ? id : undefined;
}

async function fetchEquipmentsForBoard(workshopId?: number): Promise<{ items: EquipmentRow[]; total: number }> {
  const all: EquipmentRow[] = [];
  let skip = 0;
  let total = 0;
  for (;;) {
    const res = await listEquipments({
      workshop_id: workshopId,
      skip,
      limit: EQUIPMENT_FETCH_LIMIT,
    });
    total = res.total;
    all.push(...(res.items || []));
    if (all.length >= total || (res.items?.length ?? 0) < EQUIPMENT_FETCH_LIMIT) break;
    skip += EQUIPMENT_FETCH_LIMIT;
  }
  return { items: all, total };
}

const EquipmentStatusDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const { formatStatus, statusOptions } = useEquipmentOperationalStatusLabels();

  const cardCoverStyle = useMemo(
    (): React.CSSProperties => ({
      width: '100%',
      aspectRatio: CARD_COVER_ASPECT,
      padding: CARD_COVER_PADDING,
      boxSizing: 'border-box',
      overflow: 'hidden',
      background: token.colorFillAlter,
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      borderTopLeftRadius: token.borderRadiusLG,
      borderTopRightRadius: token.borderRadiusLG,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    [token.borderRadiusLG, token.colorBorderSecondary, token.colorFillAlter],
  );

  const [loading, setLoading] = useState(true);
  const [switchingEquipmentId, setSwitchingEquipmentId] = useState<number | null>(null);
  const [workshops, setWorkshops] = useState<WorkshopRow[]>([]);
  const [viewMode, setViewMode] = useState<string>(VIEW_ALL);
  const [equipments, setEquipments] = useState<EquipmentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statusMenuOpenId, setStatusMenuOpenId] = useState<number | null>(null);
  /** 每分钟刷新停机时长展示 */
  const [durationTick, setDurationTick] = useState(() => Date.now());

  const wsMap = useMemo(() => new Map(workshops.map((w) => [w.id, w])), [workshops]);

  useEffect(() => {
    const timer = window.setInterval(() => setDurationTick(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const viewModeSelectOptions = useMemo(() => {
    const groups: { label: string; options: { label: string; value: string }[] }[] = [
      {
        label: t('app.haoligo.equipment.statusBoard.viewModeGroup'),
        options: [
          { label: t('app.haoligo.equipment.statusBoard.segmentAll'), value: VIEW_ALL },
          { label: t('app.haoligo.equipment.statusBoard.segmentByWorkshop'), value: VIEW_GROUP },
        ],
      },
    ];
    if (workshops.length > 0) {
      groups.push({
        label: t('app.haoligo.equipment.statusBoard.workshopFilterGroup'),
        options: workshops.map((w) => ({
          label: w.code ? `${w.code} · ${w.name?.trim() || w.code}` : w.name?.trim() || w.code,
          value: workshopViewKey(w.id),
        })),
      });
    }
    return groups;
  }, [t, workshops]);

  const cardGridStyle = useMemo(
    (): React.CSSProperties => ({
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_GRID_MIN_WIDTH}px, 1fr))`,
      gap: 16,
    }),
    [],
  );

  const loadBoard = useCallback(
    async (workshopId?: number) => {
      setLoading(true);
      try {
        const { items, total } = await fetchEquipmentsForBoard(workshopId);
        setEquipments(items);
        setTotalCount(total);
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
        setEquipments([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [messageApi, t],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ws = await listWorkshops();
        if (!cancelled) setWorkshops(ws || []);
      } catch {
        if (!cancelled) setWorkshops([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadBoard(parseWorkshopViewKey(viewMode));
  }, [loadBoard, viewMode]);

  const equipmentByWorkshop = useMemo(() => {
    if (viewMode !== VIEW_GROUP) return [];
    const bucket = new Map<number, EquipmentRow[]>();
    for (const eq of equipments) {
      const wid = eq.workshop_id;
      if (!bucket.has(wid)) bucket.set(wid, []);
      bucket.get(wid)!.push(eq);
    }
    const ordered: { key: number; title: string; items: EquipmentRow[] }[] = [];
    for (const ws of workshops) {
      const items = bucket.get(ws.id);
      if (items?.length) {
        ordered.push({ key: ws.id, title: ws.name?.trim() || ws.code, items });
        bucket.delete(ws.id);
      }
    }
    for (const [wid, items] of bucket) {
      if (!items.length) continue;
      const ws = wsMap.get(wid);
      ordered.push({
        key: wid,
        title: ws?.name?.trim() || ws?.code || t('app.haoligo.equipment.statusBoard.workshopUnknown'),
        items,
      });
    }
    return ordered;
  }, [equipments, t, viewMode, workshops, wsMap]);

  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const eq of equipments) {
      const key = (eq.operational_status || '').trim().toLowerCase() || '_unset';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [equipments]);

  const handleQuickStatusChange = useCallback(
    async (eq: EquipmentRow, newStatus: string) => {
      const next = newStatus.trim().toLowerCase();
      const current = (eq.operational_status || '').trim().toLowerCase();
      if (current === next) return;

      setStatusMenuOpenId(null);
      setSwitchingEquipmentId(eq.id);
      try {
        const row = await createEquipmentStatusAdjustment({
          equipment_id: eq.id,
          new_operational_status: next,
          recorded_at: dayjs().toISOString(),
          remark: t('app.haoligo.equipment.statusBoard.quickSwitchRemark'),
        });
        setEquipments((prev) =>
          prev.map((item) =>
            item.id === eq.id
              ? {
                  ...item,
                  operational_status: next,
                  operational_status_since: row.recorded_at ?? dayjs().toISOString(),
                }
              : item,
          ),
        );
        messageApi.success(
          t('app.haoligo.equipment.statusBoard.switchSuccess', { sheetNo: row.sheet_no || row.id }),
        );
      } catch (e) {
        messageApi.error((e as Error).message || t('app.haoligo.equipment.saveFailed'));
      } finally {
        setSwitchingEquipmentId(null);
      }
    },
    [messageApi, t],
  );

  const statusMenuBaseItems = useMemo(
    () =>
      statusOptions.map((opt) => ({
        key: opt.value,
        label: (
          <Flex align="center" gap={8}>
            <StatusBulbDot status={opt.value} />
            <span>{opt.label}</span>
          </Flex>
        ),
      })),
    [statusOptions],
  );

  const statusMenuForEquipment = useCallback(
    (eq: EquipmentRow): MenuProps => {
      const current = (eq.operational_status || '').trim().toLowerCase();
      return {
        items: statusMenuBaseItems.map((item) => ({
          ...item,
          disabled: item.key === current,
        })),
      };
    },
    [statusMenuBaseItems],
  );

  const handleStatusMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      if (statusMenuOpenId == null || typeof key !== 'string') return;
      const eq = equipments.find((item) => item.id === statusMenuOpenId);
      if (!eq) return;
      setStatusMenuOpenId(null);
      void handleQuickStatusChange(eq, key);
    },
    [equipments, handleQuickStatusChange, statusMenuOpenId],
  );

  const renderEquipmentCard = useCallback(
    (eq: EquipmentRow) => {
      const ws = wsMap.get(eq.workshop_id);
      const workshopName = ws?.name?.trim() || '—';
      const coverUuid = eq.image_file_uuids?.[0];
      const statusKey = eq.operational_status;
      const statusLabel = formatStatus(statusKey, t('app.haoligo.equipment.statusBoard.statusUnset'));
      const shutdownDuration =
        isShutdownOperationalStatus(statusKey) && eq.operational_status_since
          ? formatOperationalStatusDuration(eq.operational_status_since, durationTick)
          : '';

      return (
        <div key={eq.id} style={{ position: 'relative', height: '100%' }}>
          <Card
            hoverable
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            overflow: 'hidden',
          }}
          styles={{
            body: { padding: '12px 16px', background: token.colorBgContainer },
          }}
          cover={
            coverUuid ? (
              <div style={cardCoverStyle}>
                <SecureImage fileUuid={coverUuid} alt={eq.name} fitCenter preview />
              </div>
            ) : (
              <div
                style={{
                  ...cardCoverStyle,
                  color: token.colorTextQuaternary,
                }}
              >
                <ToolOutlined style={{ fontSize: 40 }} />
              </div>
            )
          }
        >
          <Flex align="flex-start" gap={12}>
            <Flex vertical gap={6} style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 16,
                  color: token.colorTextHeading,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={eq.name}
              >
                {eq.name}
              </span>
              <span
                style={{
                  color: token.colorTextSecondary,
                  fontSize: 13,
                  lineHeight: '18px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={eq.asset_code}
              >
                {eq.asset_code}
              </span>
              <span
                style={{
                  color: token.colorTextSecondary,
                  fontSize: 13,
                  lineHeight: '18px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
                title={workshopName}
              >
                {t('app.haoligo.equipment.ledger.formWorkshop')}：{workshopName}
              </span>
            </Flex>
            <Dropdown
              menu={{ ...statusMenuForEquipment(eq), onClick: handleStatusMenuClick }}
              trigger={['click']}
              placement="bottomRight"
              getPopupContainer={() => document.body}
              disabled={switchingEquipmentId === eq.id || statusOptions.length === 0}
              open={statusMenuOpenId === eq.id}
              onOpenChange={(open) => {
                if (open && switchingEquipmentId === eq.id) return;
                setStatusMenuOpenId(open ? eq.id : null);
              }}
            >
              <span
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (switchingEquipmentId === eq.id) return;
                    setStatusMenuOpenId((prev) => (prev === eq.id ? null : eq.id));
                  }
                }}
                style={{
                  display: 'inline-flex',
                  flexShrink: 0,
                  cursor: switchingEquipmentId === eq.id ? 'wait' : 'pointer',
                  opacity: switchingEquipmentId === eq.id ? 0.65 : 1,
                  outline: 'none',
                }}
              >
                <EquipmentStatusTrafficLight
                  status={statusKey}
                  orientation="label-left"
                  statusLabel={statusLabel}
                />
              </span>
            </Dropdown>
          </Flex>
          </Card>
          {shutdownDuration ? (
            <Typography.Text
              type="danger"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 2,
                fontSize: 12,
                lineHeight: '20px',
                whiteSpace: 'nowrap',
                padding: '2px 8px',
                borderRadius: token.borderRadiusSM,
                background: token.colorBgContainer,
                boxShadow: token.boxShadowSecondary,
              }}
              title={shutdownDuration}
            >
              {t('app.haoligo.equipment.statusBoard.shutdownDuration', { duration: shutdownDuration })}
            </Typography.Text>
          ) : null}
        </div>
      );
    },
    [
      cardCoverStyle,
      durationTick,
      formatStatus,
      handleStatusMenuClick,
      statusMenuForEquipment,
      statusMenuOpenId,
      statusOptions.length,
      switchingEquipmentId,
      t,
      token.borderRadiusLG,
      token.borderRadiusSM,
      token.boxShadowSecondary,
      token.colorBgContainer,
      token.colorBorderSecondary,
      token.colorTextHeading,
      token.colorTextQuaternary,
      token.colorTextSecondary,
      wsMap,
    ],
  );

  return (
    <ListPageTemplate>
      <Flex vertical gap={16} style={{ width: '100%' }}>
        <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
          <div>
            <Flex align="center" wrap="wrap" gap={12}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                {t('app.haoligo.menu.equipment.dashboard.status')}
              </Typography.Title>
              <Select
                value={viewMode}
                options={viewModeSelectOptions}
                onChange={(val) => setViewMode(String(val))}
                showSearch
                optionFilterProp="label"
                style={{ minWidth: 220, maxWidth: 360 }}
                popupMatchSelectWidth={320}
                listHeight={400}
              />
            </Flex>
            <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
              {t('app.haoligo.equipment.statusBoard.lead', { count: totalCount })}
            </Typography.Text>
          </div>
          {!loading && equipments.length > 0 ? (
            <Flex wrap="wrap" gap={8} justify="flex-end">
              {Object.entries(statusSummary).map(([key, count]) => {
                const summaryStatus = key === '_unset' ? null : key;
                const summaryLabel =
                  key === '_unset'
                    ? t('app.haoligo.equipment.statusBoard.statusUnset')
                    : formatStatus(key);
                return (
                  <Flex key={key} align="center" gap={8} style={{ padding: '4px 10px', background: '#fafafa', borderRadius: 6 }}>
                    <EquipmentStatusTrafficLight
                      status={summaryStatus}
                      statusLabel={summaryLabel}
                      compact
                      showLabel={false}
                    />
                    <Typography.Text style={{ fontSize: 13 }}>
                      {summaryLabel}：{count}
                    </Typography.Text>
                  </Flex>
                );
              })}
            </Flex>
          ) : null}
        </Flex>

        <Spin spinning={loading}>
          {!loading && equipments.length === 0 ? (
            <Empty description={t('app.haoligo.equipment.statusBoard.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : viewMode === VIEW_GROUP ? (
            <Flex vertical gap={24}>
              {equipmentByWorkshop.map((section) => (
                <div key={section.key}>
                  <Flex align="baseline" gap={8} style={{ marginBottom: 12 }}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {section.title}
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      {t('app.haoligo.equipment.statusBoard.workshopGroupCount', { count: section.items.length })}
                    </Typography.Text>
                  </Flex>
                  <div style={cardGridStyle}>{section.items.map((eq) => renderEquipmentCard(eq))}</div>
                </div>
              ))}
            </Flex>
          ) : (
            <div style={cardGridStyle}>{equipments.map((eq) => renderEquipmentCard(eq))}</div>
          )}
        </Spin>
      </Flex>
    </ListPageTemplate>
  );
};

export default EquipmentStatusDashboardPage;
