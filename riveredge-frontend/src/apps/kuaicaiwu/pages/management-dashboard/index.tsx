import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Col,
  Empty,
  Row,
  Statistic,
  Typography,
} from 'antd';
import {
  AlertOutlined,
  DollarOutlined,
  FundOutlined,
  HistoryOutlined,
  LineChartOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import {
  ModuleCenterLayout,
  ModuleKpiRow,
  ModuleActionPanel,
  ModuleTodoList,
  ModuleChartPanel,
  ModuleChartRow,
} from '../../../kuaizhizao/components/module-center';
import type { ModuleKpiDef, ModuleTodoItem } from '../../../kuaizhizao/components/module-center';
import FinanceAgingPanel from '../../components/FinanceAgingPanel';
import { managementReportService } from '../../services/management-report';

const { Text } = Typography;

const PERIOD_DAYS = 30;

function formatMoney(value?: number) {
  return `¥${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const ManagementDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['financialKpis', PERIOD_DAYS],
    queryFn: () => managementReportService.getKPIs(PERIOD_DAYS),
  });

  const { data: qualityLoss, isLoading: loadingQuality } = useQuery({
    queryKey: ['qualityLoss', PERIOD_DAYS],
    queryFn: () => managementReportService.getQualityLoss(PERIOD_DAYS),
  });

  const { data: efficiency, isLoading: loadingEfficiency } = useQuery({
    queryKey: ['laborEfficiency', PERIOD_DAYS],
    queryFn: () => managementReportService.getLaborEfficiency(PERIOD_DAYS),
  });

  const { data: wip, isLoading: loadingWIP } = useQuery({
    queryKey: ['wipValuation'],
    queryFn: () => managementReportService.getWIPValuation(),
  });

  const loading = loadingKpis || loadingQuality || loadingEfficiency || loadingWIP;

  const kpiRow: ModuleKpiDef[] = useMemo(
    () => [
      {
        key: 'sales',
        title: t('app.kuaicaiwu.managementDashboard.kpi.sales30Title'),
        value: formatMoney(kpis?.total_sales),
        subtitle: t('app.kuaicaiwu.managementDashboard.kpi.sales30Subtitle'),
        icon: <DollarOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/management-analysis/margin-report'),
      },
      {
        key: 'dso',
        title: t('app.kuaicaiwu.managementDashboard.kpi.dsoTitle'),
        value: t('app.kuaicaiwu.managementDashboard.kpi.dsoValue', {
          days: Number(kpis?.dso ?? 0).toFixed(1),
        }),
        subtitle: t('app.kuaicaiwu.managementDashboard.kpi.dsoSubtitle'),
        icon: <LineChartOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/receivables'),
      },
      {
        key: 'margin',
        title: t('app.kuaicaiwu.managementDashboard.kpi.marginTitle'),
        value: `${((kpis?.gross_margin_rate ?? 0) * 100).toFixed(2)}%`,
        subtitle: t('app.kuaicaiwu.managementDashboard.kpi.marginSubtitle'),
        icon: <RocketOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/management-analysis/margin-report'),
      },
      {
        key: 'inventory',
        title: t('app.kuaicaiwu.managementDashboard.kpi.inventoryTitle'),
        value: formatMoney(kpis?.inventory_total),
        subtitle: t('app.kuaicaiwu.managementDashboard.kpi.inventorySubtitle', {
          turnover: Number(kpis?.inventory_turnover ?? 0).toFixed(1),
        }),
        icon: <FundOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
      },
      {
        key: 'labor',
        title: t('app.kuaicaiwu.managementDashboard.kpi.laborTitle'),
        value: `${Number(efficiency?.labor_efficiency_rate ?? 0).toFixed(1)}%`,
        subtitle: t('app.kuaicaiwu.managementDashboard.kpi.laborSubtitle'),
        icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
      },
      {
        key: 'wip',
        title: t('app.kuaicaiwu.managementDashboard.kpi.wipTitle'),
        value: formatMoney(wip?.estimated_wip_value),
        subtitle: t('app.kuaicaiwu.managementDashboard.kpi.wipSubtitle', {
          count: wip?.active_work_orders_count ?? 0,
        }),
        icon: <HistoryOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/kuaizhizao/production-execution/work-orders'),
      },
    ],
    [efficiency, kpis, navigate, t, wip],
  );

  const insightItems: ModuleTodoItem[] = useMemo(() => {
    const items: ModuleTodoItem[] = [];
    const scrapCost = qualityLoss?.scrap_cost ?? 0;
    const sales = kpis?.total_sales ?? 0;
    const lossRatio = sales > 0 ? scrapCost / sales : 0;

    if (scrapCost > 0 && lossRatio >= 0.03) {
      items.push({
        id: 'quality-loss',
        type: 'quality',
        title: t('app.kuaicaiwu.managementDashboard.insight.qualityLossTitle', {
          amount: formatMoney(scrapCost),
          ratio: (lossRatio * 100).toFixed(1),
        }),
        description: t('app.kuaicaiwu.managementDashboard.insight.qualityLossDesc'),
        priority: 'high',
        status: 'pending',
        link: '/apps/kuaizhizao/quality-management/inspection-center',
        created_at: new Date().toISOString(),
      });
    }

    if ((kpis?.dso ?? 0) > 45) {
      items.push({
        id: 'dso-high',
        type: 'finance',
        title: t('app.kuaicaiwu.managementDashboard.insight.dsoHighTitle', {
          days: Number(kpis?.dso ?? 0).toFixed(1),
        }),
        description: t('app.kuaicaiwu.managementDashboard.insight.dsoHighDesc'),
        priority: 'medium',
        status: 'pending',
        link: '/apps/kuaicaiwu/finance-management/receivables',
        created_at: new Date().toISOString(),
      });
    }

    if ((wip?.estimated_wip_value ?? 0) > 0) {
      items.push({
        id: 'wip',
        type: 'production',
        title: t('app.kuaicaiwu.managementDashboard.insight.wipTitle', {
          amount: formatMoney(wip?.estimated_wip_value),
        }),
        description: t('app.kuaicaiwu.managementDashboard.insight.wipDesc'),
        priority: 'medium',
        status: 'pending',
        link: '/apps/kuaizhizao/production-execution/work-orders',
        created_at: new Date().toISOString(),
      });
    }

    return items;
  }, [kpis, qualityLoss, t, wip]);

  const qualityLossRatio =
    (kpis?.total_sales ?? 0) > 0 ? (qualityLoss?.scrap_cost ?? 0) / (kpis?.total_sales ?? 1) : 0;
  const showQualityAlert = (qualityLoss?.scrap_cost ?? 0) > 0 && qualityLossRatio >= 0.03;

  return (
    <ModuleCenterLayout
      showSidebar={false}
      loading={loading && !kpis}
      kpiRow={
        <ModuleKpiRow
          items={kpiRow}
          colProps={{ xs: 24, sm: 12, md: 8, lg: 4, xl: 4 }}
        />
      }
      actionRow={
        <ModuleActionPanel title={t('app.kuaicaiwu.managementDashboard.actionPanelTitle', { days: PERIOD_DAYS })} lg={24}>
          <ModuleTodoList items={insightItems} emptyText={t('app.kuaicaiwu.managementDashboard.emptyInsights')} />
        </ModuleActionPanel>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel
            title={t('app.kuaicaiwu.managementDashboard.chart.receivableAgingTitle')}
            lg={12}
            loading={loadingKpis}
            height={360}
          >
            <FinanceAgingPanel
              data={kpis?.receivable_aging}
              detailPath="/apps/kuaicaiwu/finance-management/receivables"
              onOpenDetail={navigate}
            />
          </ModuleChartPanel>
          <ModuleChartPanel
            title={t('app.kuaicaiwu.managementDashboard.chart.qualityLossTitle')}
            lg={12}
            loading={loadingQuality}
            height={360}
            extra={
              showQualityAlert ? (
                <Text type="danger">
                  <AlertOutlined /> {t('app.kuaicaiwu.managementDashboard.chart.abnormalAlert')}
                </Text>
              ) : null
            }
          >
            {(qualityLoss?.scrap_cost ?? 0) > 0 || (qualityLoss?.unqualified_quantity ?? 0) > 0 ? (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Statistic
                      title={t('app.kuaicaiwu.managementDashboard.chart.scrapAmount')}
                      value={qualityLoss?.scrap_cost ?? 0}
                      prefix="¥"
                      precision={2}
                    />
                  </Col>
                  <Col xs={24} sm={12}>
                    <Statistic
                      title={t('app.kuaicaiwu.managementDashboard.chart.unqualifiedQty')}
                      value={qualityLoss?.unqualified_quantity ?? 0}
                      suffix={t('app.kuaicaiwu.managementDashboard.chart.piecesUnit')}
                      precision={0}
                    />
                  </Col>
                </Row>
                {showQualityAlert ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginTop: 16 }}
                    message={t('app.kuaicaiwu.managementDashboard.chart.qualityLossAlert', {
                      ratio: (qualityLossRatio * 100).toFixed(1),
                    })}
                  />
                ) : (
                  <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                    {t('app.kuaicaiwu.managementDashboard.chart.qualityUnderControl')}
                  </Text>
                )}
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('app.kuaicaiwu.managementDashboard.chart.noQualityLoss', { days: PERIOD_DAYS })}
                style={{ margin: '48px 0' }}
              />
            )}
          </ModuleChartPanel>
        </ModuleChartRow>
      }
    />
  );
};

export default ManagementDashboard;
