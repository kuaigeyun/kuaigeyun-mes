/**
 * 工作台：平台更新日志弹窗
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Empty, Modal, Tabs, Typography } from 'antd';
import type { TFunction } from 'i18next';
import { MarkerTag } from '../../../constants/statusBadges';
import {
  PLATFORM_UPDATE_LOG,
  type PlatformUpdateDateGroup,
  type PlatformUpdateLogEntry,
  type PlatformUpdateTabKey,
  filterPlatformUpdates,
  getAvailableUpdateLogTabs,
  getUpdateTypeMarkerColor,
  groupPlatformUpdatesByDate,
  resolveUpdateLogText,
} from './platformUpdateLog';

const { Text } = Typography;

export interface DashboardUpdateLogModalProps {
  open: boolean;
  onClose: () => void;
  t: TFunction;
}

function UpdateLogTimelineRow({ entry, t }: { entry: PlatformUpdateLogEntry; t: TFunction }) {
  const title = resolveUpdateLogText(t, entry.titleKey);
  const description = resolveUpdateLogText(t, entry.descriptionKey);
  if (!title) return null;

  return (
    <div className="dashboard-update-log-item dashboard-update-log-item--compact">
      <div className="dashboard-update-log-item__main">
        <MarkerTag color={getUpdateTypeMarkerColor(entry.type)} className="dashboard-update-log-item__type">
          {t(`pages.dashboard.updateLogType.${entry.type}`)}
        </MarkerTag>
        <span className="dashboard-update-log-item__title">{title}</span>
      </div>
      {description ? (
        <div className="dashboard-update-log-item__description">{description}</div>
      ) : null}
    </div>
  );
}

function UpdateLogTimelineGroup({
  group,
  isLast,
  t,
}: {
  group: PlatformUpdateDateGroup;
  isLast: boolean;
  t: TFunction;
}) {
  return (
    <div className={`dashboard-update-log-timeline__group${isLast ? ' dashboard-update-log-timeline__group--last' : ''}`}>
      <div className="dashboard-update-log-timeline__axis">
        <Text type="secondary" className="dashboard-update-log-timeline__date">
          {group.date}
        </Text>
        <span className="dashboard-update-log-timeline__dot" aria-hidden />
        <span className="dashboard-update-log-timeline__line" aria-hidden />
      </div>
      <div className="dashboard-update-log-timeline__entries">
        {group.entries.map((entry) => (
          <UpdateLogTimelineRow key={entry.id} entry={entry} t={t} />
        ))}
      </div>
    </div>
  );
}

function UpdateLogTimeline({
  entries,
  t,
}: {
  entries: PlatformUpdateLogEntry[];
  t: TFunction;
}) {
  const dateGroups = useMemo(() => groupPlatformUpdatesByDate(entries), [entries]);

  if (dateGroups.length === 0) {
    return <Empty description={t('pages.dashboard.updateLogEmpty')} />;
  }

  return (
    <div className="dashboard-update-log-timeline">
      {dateGroups.map((group, index) => (
        <UpdateLogTimelineGroup
          key={group.date}
          group={group}
          isLast={index === dateGroups.length - 1}
          t={t}
        />
      ))}
    </div>
  );
}

export function DashboardUpdateLogModal({ open, onClose, t }: DashboardUpdateLogModalProps) {
  const [activeTab, setActiveTab] = useState<PlatformUpdateTabKey>('all');

  useEffect(() => {
    if (open) setActiveTab('all');
  }, [open]);

  const availableTabs = useMemo(() => getAvailableUpdateLogTabs(), []);

  const tabItems = useMemo(
    () =>
      availableTabs.map((tabKey) => ({
        key: tabKey,
        label:
          tabKey === 'all'
            ? t('pages.dashboard.updateLogTab.all')
            : t(`pages.dashboard.updateLogType.${tabKey}`),
        children: (
          <div className="dashboard-update-log-modal__body">
            <UpdateLogTimeline entries={filterPlatformUpdates(tabKey)} t={t} />
          </div>
        ),
      })),
    [availableTabs, t],
  );

  return (
    <Modal
      title={t('pages.dashboard.updateLogModalTitle')}
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
      className="dashboard-update-log-modal"
      styles={{
        body: {
          paddingTop: 8,
          minHeight: 420,
        },
      }}
    >
      {PLATFORM_UPDATE_LOG.length === 0 ? (
        <Empty description={t('pages.dashboard.updateLogEmpty')} />
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as PlatformUpdateTabKey)}
          items={tabItems}
          className="dashboard-update-log-modal__tabs"
        />
      )}
    </Modal>
  );
}

export default DashboardUpdateLogModal;
