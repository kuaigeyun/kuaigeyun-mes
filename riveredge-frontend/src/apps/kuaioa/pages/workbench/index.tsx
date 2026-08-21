import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Col, List, Result, Typography } from 'antd';
import {
  AuditOutlined,
  CalendarOutlined,
  FileTextOutlined,
  FormOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDateBySiteSetting, formatDateTimeBySiteSetting } from '../../../../utils/format';
import { getWorkbenchSummary, type WorkbenchSummary } from '../../services/workbench';
import {
  buildKuaioaDocListUrl,
  KUAIOA_WORKBENCH_QUICK_ENTRIES,
  resolveKuaioaDocListPath,
} from '../../utils/kuaioaDocRoutes';
import {
  ModuleActionMasonry,
  ModuleActionPanel,
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleShortcutGrid,
  showMasonryCard,
  masonryWeightFromRows,
  resolveMasonryEmptyFallback,
  type ModuleKpiDef,
  type ModuleShortcutDef,
} from '../../../kuaizhizao/components/module-center';

const { Text, Paragraph, Link } = Typography;

const SHORTCUT_ICONS: Record<string, React.ReactNode> = {
  'form-request': <FileTextOutlined />,
  leave: <CalendarOutlined />,
  seal: <FileProtectOutlined />,
  'special-price': <FormOutlined />,
  'personal-tasks': <AuditOutlined />,
};

function resolveTaskDocUrl(item: Record<string, unknown>): string | undefined {
  const data =
    item.data && typeof item.data === 'object' ? (item.data as Record<string, unknown>) : undefined;
  const entityType = data?.entity_type ?? item.entity_type;
  const entityId = data?.entity_id ?? item.id ?? item.entity_id;
  return buildKuaioaDocListUrl(String(entityType ?? ''), entityId as number | string | undefined);
}

const WorkbenchPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<WorkbenchSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setSummary(await getWorkbenchSummary());
    } catch {
      setSummary(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const expiringLicenses = summary?.expiring_licenses ?? [];
  const expiringWorkLicenses = summary?.expiring_work_licenses ?? [];
  const pinnedAnnouncements = summary?.pinned_announcements ?? [];
  const recentAnnouncements = summary?.recent_announcements ?? [];
  const pendingApprovals = summary?.pending_approvals ?? [];
  const mySubmitted = summary?.my_submitted_pending ?? [];

  const kpis: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'pending',
        title: t('app.kuaioa.workbench.pendingApprovals'),
        value: summary?.pending_approval_total ?? 0,
        icon: <AuditOutlined style={{ fontSize: 24 }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
        onClick: () => navigate('/personal/tasks'),
      },
      {
        key: 'submitted',
        title: t('app.kuaioa.workbench.mySubmittedPending'),
        value: mySubmitted.length,
        icon: <FormOutlined style={{ fontSize: 24 }} />,
        gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)',
      },
      {
        key: 'licenses',
        title: t('app.kuaioa.workbench.expiringLicenses'),
        value: summary?.expiring_license_total ?? expiringLicenses.length,
        icon: <IdcardOutlined style={{ fontSize: 24 }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaioa/compliance/licenses?scope=expiring'),
      },
      {
        key: 'work-licenses',
        title: t('app.kuaioa.workbench.expiringWorkLicenses'),
        value: summary?.expiring_work_license_total ?? expiringWorkLicenses.length,
        icon: <SafetyCertificateOutlined style={{ fontSize: 24 }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaioa/hr/work-licenses?scope=expiring'),
      },
    ],
    [expiringLicenses.length, expiringWorkLicenses.length, mySubmitted.length, navigate, summary, t],
  );

  const shortcuts: ModuleShortcutDef[] = useMemo(
    () =>
      KUAIOA_WORKBENCH_QUICK_ENTRIES.map((entry) => ({
        key: entry.key,
        title: t(entry.labelKey),
        icon: SHORTCUT_ICONS[entry.key] ?? <FileTextOutlined />,
        path: entry.path,
      })),
    [t],
  );

  const openAnnouncement = (item: Record<string, unknown>) => {
    const id = item.id;
    if (id != null) {
      navigate(`/apps/kuaioa/admin/announcements?id=${id}`);
      return;
    }
    navigate('/apps/kuaioa/admin/announcements');
  };

  const announcementItems = useMemo(
    () => [...pinnedAnnouncements, ...recentAnnouncements.filter((a) => !a.is_pinned)],
    [pinnedAnnouncements, recentAnnouncements],
  );

  const masonryEmptyFallback = resolveMasonryEmptyFallback(loading, [
    pendingApprovals.length > 0,
    mySubmitted.length > 0,
    expiringLicenses.length > 0,
    expiringWorkLicenses.length > 0,
    announcementItems.length > 0,
  ]);

  return (
    <ModuleCenterLayout
      loading={loading && !summary}
      kpiRow={<ModuleKpiRow items={kpis} colProps={{ xs: 24, sm: 12, lg: 6 }} />}
      shortcutRow={<ModuleShortcutGrid items={shortcuts} />}
      actionRow={
        loadFailed && !summary ? (
          <Col span={24}>
            <Result
              status="error"
              title={t('common.loadFailed')}
              extra={
                <Button type="primary" onClick={() => void load()}>
                  {t('common.retry', { defaultValue: '重试' })}
                </Button>
              }
            />
          </Col>
        ) : (
          <ModuleActionMasonry>
            {showMasonryCard(loading, pendingApprovals.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel
              layout="masonry"
              title={t('app.kuaioa.workbench.pendingApprovals')}
              masonryWeight={masonryWeightFromRows(pendingApprovals.length)}
              extra={
                <Link onClick={() => navigate('/personal/tasks')}>{t('app.kuaioa.workbench.goTasks')}</Link>
              }
            >
                <List
                  dataSource={pendingApprovals}
                  renderItem={(item) => {
                    const path = resolveTaskDocUrl(item);
                    return (
                      <List.Item
                        style={path ? { cursor: 'pointer' } : undefined}
                        onClick={path ? () => navigate(path) : undefined}
                      >
                        <List.Item.Meta
                          title={String(item.title ?? '')}
                          description={
                            item.submitted_at
                              ? formatDateTimeBySiteSetting(String(item.submitted_at))
                              : undefined
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
            </ModuleActionPanel>
            ) : null}

            {showMasonryCard(loading, mySubmitted.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel layout="masonry" title={t('app.kuaioa.workbench.mySubmittedPending')} masonryWeight={masonryWeightFromRows(mySubmitted.length)}>
                <List
                  dataSource={mySubmitted}
                  renderItem={(item) => {
                    const path = buildKuaioaDocListUrl(String(item.entity_type ?? ''), item.id as number);
                    return (
                      <List.Item
                        style={path ? { cursor: 'pointer' } : undefined}
                        onClick={path ? () => navigate(path) : undefined}
                      >
                        <List.Item.Meta
                          title={`${String(item.doc_code ?? '')} ${String(item.title ?? '')}`}
                          description={
                            item.submitted_at
                              ? formatDateTimeBySiteSetting(String(item.submitted_at))
                              : undefined
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
            </ModuleActionPanel>
            ) : null}

            {showMasonryCard(loading, expiringLicenses.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel
              layout="masonry"
              title={t('app.kuaioa.workbench.expiringLicenses')}
              masonryWeight={masonryWeightFromRows(expiringLicenses.length)}
              extra={
                <Link onClick={() => navigate('/apps/kuaioa/compliance/licenses?scope=expiring')}>
                  {t('app.kuaioa.workbench.viewList')}
                </Link>
              }
            >
                <List
                  dataSource={expiringLicenses}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`${String(item.license_name ?? '')} (${String(item.license_code ?? '')})`}
                        description={
                          item.expiry_date
                            ? `${t('app.kuaioa.license.expiry')} ${formatDateBySiteSetting(String(item.expiry_date))}`
                            : undefined
                        }
                      />
                    </List.Item>
                  )}
                />
            </ModuleActionPanel>
            ) : null}

            {showMasonryCard(loading, expiringWorkLicenses.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel
              layout="masonry"
              title={t('app.kuaioa.workbench.expiringWorkLicenses')}
              masonryWeight={masonryWeightFromRows(expiringWorkLicenses.length)}
              extra={
                <Link onClick={() => navigate('/apps/kuaioa/hr/work-licenses?scope=expiring')}>
                  {t('app.kuaioa.workbench.viewList')}
                </Link>
              }
            >
                <List
                  dataSource={expiringWorkLicenses}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        title={`${String(item.license_name ?? '')} (${String(item.license_code ?? '')})`}
                        description={
                          item.expiry_date
                            ? `${t('app.kuaioa.workLicense.expiry')} ${formatDateBySiteSetting(String(item.expiry_date))}`
                            : undefined
                        }
                      />
                    </List.Item>
                  )}
                />
            </ModuleActionPanel>
            ) : null}

            {showMasonryCard(loading, announcementItems.length > 0, masonryEmptyFallback) ? (
            <ModuleActionPanel
              layout="masonry"
              title={t('app.kuaioa.workbench.announcements')}
              masonryWeight={masonryWeightFromRows(announcementItems.length)}
              extra={
                <Link onClick={() => navigate('/apps/kuaioa/admin/announcements')}>
                  {t('app.kuaioa.workbench.viewList')}
                </Link>
              }
            >
                <List
                  dataSource={announcementItems}
                  renderItem={(item) => (
                    <List.Item style={{ cursor: 'pointer' }} onClick={() => openAnnouncement(item)}>
                      <List.Item.Meta
                        title={
                          <>
                            {item.is_pinned ? (
                              <Text type="warning" style={{ marginRight: 8 }}>
                                [{t('app.kuaioa.announcement.pinned')}]
                              </Text>
                            ) : null}
                            {String(item.title ?? '')}
                          </>
                        }
                        description={
                          <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                            {String(item.content ?? '')}
                          </Paragraph>
                        }
                      />
                    </List.Item>
                  )}
                />
            </ModuleActionPanel>
            ) : null}
          </ModuleActionMasonry>
        )
      }
    />
  );
};

export default WorkbenchPage;
