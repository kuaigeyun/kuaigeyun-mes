/**
 * 工装详情页（独立标签：基本信息 / 维保 / 校验 / 运营单据）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ProDescriptions,
  type ProDescriptionsItemProps,
} from '@ant-design/pro-components';
import {
  App,
  Button,
  Card,
  Empty,
  Select,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { toolApi } from '../../../../services/equipment';
import {
  calibrationsApi,
  maintenanceSchemesApi,
  maintenancesApi,
  repairSchemesApi,
  schemeBindingsApi,
} from '../../../../services/toolOps';
import {
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  MultiTabListPageTemplate,
} from '../../../../../../components/layout-templates';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../../components/document-tracking-panel';
import { useResourcePermissions } from '../../../../../../hooks/useResourcePermissions';
import { MarkerTag } from '../../../../../../constants/statusBadges';
import { formatDateBySiteSetting } from '../../../../../../utils/format';
import { renderDocumentStatusTag } from '../../../../../../utils/documentLifecycleStatusTag';
import { useLeaveFormTab, navigateClosingTab, uniTabKey } from '../../../../../../components/uni-tabs/navigateClosingTab';
import {
  KUAIZHIZAO_TOOL_LEDGER_LIST_PATH,
  resolveToolLedgerDetailTabKey,
} from '../toolLedgerPaths';

interface ToolDetail {
  id?: number;
  uuid?: string;
  code?: string;
  name?: string;
  type?: string;
  spec?: string;
  manufacturer?: string;
  supplier?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  status?: string;
  is_active?: boolean;
  maintenance_period?: number;
  needs_calibration?: boolean;
  calibration_period?: number;
  total_usage_count?: number;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface ToolMaintenance {
  uuid?: string;
  document_no?: string;
  maintenance_date?: string;
  applicant_name?: string;
  status?: string;
}

interface ToolCalibration {
  uuid?: string;
  calibration_date?: string;
  calibration_org?: string;
  certificate_no?: string;
  result?: string;
  expiry_date?: string;
}

function toolStatusTag(
  status: string | undefined,
  t: (key: string) => string,
): { text: string; color: string } {
  const statusMap: Record<string, { text: string; color: string }> = {
    正常: { text: t('app.kuaizhizao.toolLedger.statusNormal'), color: 'success' },
    领用中: { text: t('app.kuaizhizao.toolLedger.statusCheckedOut'), color: 'processing' },
    维修中: { text: t('app.kuaizhizao.toolLedger.statusRepairing'), color: 'warning' },
    校验中: { text: t('app.kuaizhizao.toolLedger.statusCalibrating'), color: 'warning' },
    停用: { text: t('app.kuaizhizao.toolLedger.statusDisabled'), color: 'default' },
    报废: { text: t('app.kuaizhizao.toolLedger.statusScrapped'), color: 'error' },
  };
  return statusMap[status ?? ''] ?? { text: status ?? '-', color: 'default' };
}

const ToolLedgerDetailPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const perms = useResourcePermissions('kuaizhizao:equipment-management-tool-ledger');

  const activeTab = resolveToolLedgerDetailTabKey(searchParams.get('tab'));

  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<ToolDetail | null>(null);
  const [trackingRefreshKey, setTrackingRefreshKey] = useState(0);

  const [maintenances, setMaintenances] = useState<ToolMaintenance[]>([]);
  const [calibrations, setCalibrations] = useState<ToolCalibration[]>([]);
  const [maintLoading, setMaintLoading] = useState(false);
  const [calibLoading, setCalibLoading] = useState(false);

  const [maintenanceSchemeOptions, setMaintenanceSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [repairSchemeOptions, setRepairSchemeOptions] = useState<{ label: string; value: number }[]>([]);
  const [boundMaintenanceSchemeIds, setBoundMaintenanceSchemeIds] = useState<number[]>([]);
  const [boundRepairSchemeIds, setBoundRepairSchemeIds] = useState<number[]>([]);
  const [schemeBindingsSaving, setSchemeBindingsSaving] = useState(false);

  const toolTracking = useDocumentTracking(tool?.id ? 'tool' : undefined, tool?.id, trackingRefreshKey);

  const loadPageData = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const detail = await toolApi.get(uuid);
      setTool(detail);
      setTrackingRefreshKey((k) => k + 1);
      if (detail.id != null) {
        setMaintLoading(true);
        setCalibLoading(true);
        const [maintRes, repairRes, maintBindings, repairBindings, maintList, calibList] = await Promise.all([
          maintenanceSchemesApi.list({ limit: 1000, is_active: true }),
          repairSchemesApi.list({ limit: 1000, is_active: true }),
          schemeBindingsApi.list({ tool_id: detail.id, scheme_type: 'maintenance' }),
          schemeBindingsApi.list({ tool_id: detail.id, scheme_type: 'repair' }),
          maintenancesApi.list({ tool_id: detail.id, limit: 100 }),
          calibrationsApi.list({ tool_id: detail.id, limit: 100 }),
        ]);
        setMaintenanceSchemeOptions(
          (maintRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
            label: `${s.code} - ${s.name}`,
            value: s.id,
          })),
        );
        setRepairSchemeOptions(
          (repairRes.items ?? []).map((s: { id: number; code: string; name: string }) => ({
            label: `${s.code} - ${s.name}`,
            value: s.id,
          })),
        );
        setBoundMaintenanceSchemeIds(
          (Array.isArray(maintBindings) ? maintBindings : maintBindings.items ?? []).map(
            (b: { scheme_id: number }) => b.scheme_id,
          ),
        );
        setBoundRepairSchemeIds(
          (Array.isArray(repairBindings) ? repairBindings : repairBindings.items ?? []).map(
            (b: { scheme_id: number }) => b.scheme_id,
          ),
        );
        setMaintenances(maintList.items || []);
        setCalibrations(calibList.items || []);
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('app.kuaizhizao.toolLedger.getDetailFailed'));
    } finally {
      setMaintLoading(false);
      setCalibLoading(false);
      setLoading(false);
    }
  }, [uuid, messageApi, t]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const detailColumns: ProDescriptionsItemProps<ToolDetail>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolLedger.colCode'),
        dataIndex: 'code',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }}>{r.code ?? '-'}</Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.toolLedger.colName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.toolLedger.colType'), dataIndex: 'type' },
      { title: t('app.kuaizhizao.toolLedger.colSpec'), dataIndex: 'spec' },
      { title: t('app.kuaizhizao.toolLedger.colManufacturer'), dataIndex: 'manufacturer' },
      { title: t('app.kuaizhizao.toolLedger.colSupplier'), dataIndex: 'supplier' },
      { title: t('app.kuaizhizao.toolLedger.colPurchaseDate'), dataIndex: 'purchase_date', valueType: 'date' },
      { title: t('app.kuaizhizao.toolLedger.colWarrantyExpiry'), dataIndex: 'warranty_expiry', valueType: 'date' },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, record) => {
          const mapped = toolStatusTag(record.status, t);
          return <MarkerTag color={mapped.color}>{mapped.text}</MarkerTag>;
        },
      },
      { title: t('app.kuaizhizao.toolLedger.colTotalUsageCount'), dataIndex: 'total_usage_count' },
      { title: t('app.kuaizhizao.toolLedger.fieldDescription'), dataIndex: 'description', span: 2 },
      { title: t('common.createdAt'), dataIndex: 'created_at', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updated_at', valueType: 'dateTime' },
    ],
    [t],
  );

  const maintenanceTableColumns = useMemo(
    () => [
      { title: t('app.kuaizhizao.toolOps.maintenance.col.documentNo'), dataIndex: 'document_no', width: 140 },
      {
        title: t('app.kuaizhizao.toolOps.maintenance.col.maintenanceDate'),
        dataIndex: 'maintenance_date',
        width: 110,
        render: (v: string) => (v ? formatDateBySiteSetting(v) : '-'),
      },
      {
        title: t('app.kuaizhizao.toolOps.maintenance.col.status'),
        dataIndex: 'status',
        width: 90,
        render: (v: string) => (v ? renderDocumentStatusTag(v, v) : '-'),
      },
      { title: t('app.kuaizhizao.toolOps.maintenance.col.executor'), dataIndex: 'applicant_name', width: 90 },
    ],
    [t],
  );

  const calibrationTableColumns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.toolLedger.colCalibrationDate'),
        dataIndex: 'calibration_date',
        width: 110,
        render: (v: string) => (v ? formatDateBySiteSetting(v) : '-'),
      },
      { title: t('app.kuaizhizao.toolLedger.colCalibrationOrg'), dataIndex: 'calibration_org', width: 120 },
      { title: t('app.kuaizhizao.toolLedger.colCertificateNo'), dataIndex: 'certificate_no', width: 120 },
      { title: t('app.kuaizhizao.toolLedger.colResult'), dataIndex: 'result', width: 80 },
      {
        title: t('app.kuaizhizao.toolLedger.colExpiryDate'),
        dataIndex: 'expiry_date',
        width: 110,
        render: (v: string) => (v ? formatDateBySiteSetting(v) : '-'),
      },
    ],
    [t],
  );

  const tabItems = useMemo(() => {
    if (!tool) return [];
    return [
      {
        key: 'info',
        label: t('app.kuaizhizao.toolLedger.detailTabInfo'),
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card size="small" title={t('app.uniDetail.sectionBasic')}>
              <ProDescriptions<ToolDetail> dataSource={tool} column={3} columns={detailColumns} />
            </Card>
            <Card size="small" title={t('app.kuaizhizao.toolOps.schemeBindings.title')}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary">{t('app.kuaizhizao.toolOps.schemeBindings.maintenance')}</Typography.Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder={t('app.kuaizhizao.toolOps.schemeBindings.selectMaintenanceSchemes')}
                  options={maintenanceSchemeOptions}
                  value={boundMaintenanceSchemeIds}
                  onChange={setBoundMaintenanceSchemeIds}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text type="secondary">{t('app.kuaizhizao.toolOps.schemeBindings.repair')}</Typography.Text>
                <Select
                  mode="multiple"
                  style={{ width: '100%', marginTop: 4 }}
                  placeholder={t('app.kuaizhizao.toolOps.schemeBindings.selectRepairSchemes')}
                  options={repairSchemeOptions}
                  value={boundRepairSchemeIds}
                  onChange={setBoundRepairSchemeIds}
                />
              </div>
              {perms.canUpdate ? (
                <Button
                  type="primary"
                  loading={schemeBindingsSaving}
                  disabled={tool.id == null}
                  onClick={async () => {
                    if (tool.id == null) return;
                    setSchemeBindingsSaving(true);
                    try {
                      await schemeBindingsApi.bulkReplace({
                        tool_id: tool.id,
                        scheme_type: 'maintenance',
                        scheme_ids: boundMaintenanceSchemeIds,
                      });
                      await schemeBindingsApi.bulkReplace({
                        tool_id: tool.id,
                        scheme_type: 'repair',
                        scheme_ids: boundRepairSchemeIds,
                      });
                      messageApi.success(t('app.kuaizhizao.toolOps.schemeBindings.saveSuccess'));
                    } catch (error: unknown) {
                      const err = error as { message?: string };
                      messageApi.error(err?.message || t('common.operationFailed'));
                    } finally {
                      setSchemeBindingsSaving(false);
                    }
                  }}
                >
                  {t('common.save')}
                </Button>
              ) : null}
            </Card>
            <Card size="small" title={t('app.uniDetail.sectionTimeline')}>
              {toolTracking.loading ? <Spin /> : null}
              {toolTracking.error && !toolTracking.loading ? (
                <Typography.Text type="danger">{toolTracking.error}</Typography.Text>
              ) : null}
              {toolTracking.data && !toolTracking.loading ? (
                <DocumentTrackingTimelineBody data={toolTracking.data} />
              ) : null}
              {!toolTracking.loading && !toolTracking.data && !toolTracking.error ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.toolLedger.noTimeline')} />
              ) : null}
            </Card>
          </div>
        ),
      },
      {
        key: 'maintenances',
        label: t('app.kuaizhizao.toolLedger.sectionMaintenances'),
        children: (
          <>
            <div style={{ marginBottom: 12 }}>
              <Link to="/apps/kuaizhizao/equipment-management/tool-maintenances">
                <Button type="primary" icon={<PlusOutlined />}>
                  {t('app.kuaizhizao.toolMaintenanceReminder.createMaintenance')}
                </Button>
              </Link>
            </div>
            <Table<ToolMaintenance>
              size="small"
              loading={maintLoading}
              dataSource={maintenances}
              rowKey="uuid"
              pagination={false}
              columns={maintenanceTableColumns}
              scroll={{ x: true }}
            />
          </>
        ),
      },
      {
        key: 'calibrations',
        label: t('app.kuaizhizao.toolLedger.sectionCalibrations'),
        children: (
          <>
            <div style={{ marginBottom: 12 }}>
              <Link to="/apps/kuaizhizao/equipment-management/tool-calibrations">
                <Button type="primary" icon={<PlusOutlined />}>
                  {t('app.kuaizhizao.toolMaintenanceReminder.createCalibration')}
                </Button>
              </Link>
            </div>
            <Table<ToolCalibration>
              size="small"
              loading={calibLoading}
              dataSource={calibrations}
              rowKey="uuid"
              pagination={false}
              columns={calibrationTableColumns}
              scroll={{ x: true }}
            />
          </>
        ),
      },
      {
        key: 'ops',
        label: t('app.kuaizhizao.toolOps.opsLinks.title'),
        children: (
          <Space wrap>
            <Link to="/apps/kuaizhizao/equipment-management/tool-borrows">
              <Button>{t('app.kuaizhizao.menu.equipment-management.tool-borrows')}</Button>
            </Link>
            <Link to="/apps/kuaizhizao/equipment-management/tool-maintenances">
              <Button>{t('app.kuaizhizao.menu.equipment-management.tool-maintenances')}</Button>
            </Link>
            <Link to="/apps/kuaizhizao/equipment-management/tool-repairs">
              <Button>{t('app.kuaizhizao.menu.equipment-management.tool-repairs')}</Button>
            </Link>
            <Link to="/apps/kuaizhizao/equipment-management/tool-scrap-applications">
              <Button>{t('app.kuaizhizao.menu.equipment-management.tool-scrap-applications')}</Button>
            </Link>
          </Space>
        ),
      },
    ];
  }, [
    tool,
    t,
    detailColumns,
    maintenanceSchemeOptions,
    repairSchemeOptions,
    boundMaintenanceSchemeIds,
    boundRepairSchemeIds,
    schemeBindingsSaving,
    perms.canUpdate,
    toolTracking,
    maintLoading,
    maintenances,
    maintenanceTableColumns,
    calibLoading,
    calibrations,
    calibrationTableColumns,
    messageApi,
  ]);

  const handleTabChange = (key: string) => {
    setSearchParams(key === 'info' ? {} : { tab: key }, { replace: true });
  };

  const leavePage = useLeaveFormTab(KUAIZHIZAO_TOOL_LEDGER_LIST_PATH);

  const pageTitle = tool
    ? `${tool.code ?? ''} ${tool.name ?? ''}`.trim() || t('app.kuaizhizao.toolLedger.detail')
    : t('app.kuaizhizao.toolLedger.detail');
  const statusTag = tool?.status ? toolStatusTag(tool.status, t) : null;

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: {
          key: location.pathname + location.search,
          path: location.pathname,
          title: pageTitle,
        },
      }),
    );
  }, [pageTitle, location.pathname, location.search]);

  const fallbackTabs = useMemo(
    () => [
      {
        key: 'info',
        label: t('app.kuaizhizao.toolLedger.detailTabInfo'),
        children: (
          <div style={{ padding: 48, textAlign: 'center' }}>
            {loading ? <Spin size="large" /> : <Empty description={t('app.kuaizhizao.toolLedger.getDetailFailed')} />}
          </div>
        ),
      },
    ],
    [loading, t],
  );

  const tabs = tool && tabItems.length > 0 ? tabItems : fallbackTabs;

  if (!uuid) {
    return (
      <MultiTabListPageTemplate
        activeTabKey="info"
        onTabChange={() => undefined}
        tabs={[
          {
            key: 'info',
            label: t('app.kuaizhizao.toolLedger.detailTabInfo'),
            children: <Empty description={t('app.kuaizhizao.toolLedger.uuidNotFound')} />,
          },
        ]}
      />
    );
  }

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTab}
      onTabChange={handleTabChange}
      header={
        <div style={{ ...DOCUMENT_DETAIL_PAGE_HEADER_STYLE, marginBottom: 0 }}>
          <Space align="center" size={8}>
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label={t('common.back')} onClick={leavePage} />
            <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
              {pageTitle}
            </Typography.Title>
            {statusTag ? <MarkerTag color={statusTag.color}>{statusTag.text}</MarkerTag> : null}
          </Space>
          <Space wrap>
            <Button onClick={leavePage}>{t('common.back')}</Button>
            {tool?.uuid && perms.canUpdate ? (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() =>
                  navigateClosingTab(
                    navigate,
                    KUAIZHIZAO_TOOL_LEDGER_LIST_PATH,
                    uniTabKey(location.pathname, location.search),
                    { openEditUuid: tool.uuid },
                  )
                }
              >
                {t('common.edit')}
              </Button>
            ) : null}
          </Space>
        </div>
      }
      tabs={tabs}
    />
  );
};

export default ToolLedgerDetailPage;
