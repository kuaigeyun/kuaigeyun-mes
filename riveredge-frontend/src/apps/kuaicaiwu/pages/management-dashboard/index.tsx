import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
        title: '近30天销售额',
        value: formatMoney(kpis?.total_sales),
        subtitle: '含税出库汇总',
        icon: <DollarOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/management-analysis/margin-report'),
      },
      {
        key: 'dso',
        title: '应收账款周转天数',
        value: `${Number(kpis?.dso ?? 0).toFixed(1)} 天`,
        subtitle: '资金回笼效率',
        icon: <LineChartOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/finance-management/receivables'),
      },
      {
        key: 'margin',
        title: '毛利率',
        value: `${((kpis?.gross_margin_rate ?? 0) * 100).toFixed(2)}%`,
        subtitle: '本期销售盈利水平',
        icon: <RocketOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)',
        onClick: () => navigate('/apps/kuaicaiwu/management-analysis/margin-report'),
      },
      {
        key: 'inventory',
        title: '库存占用',
        value: formatMoney(kpis?.inventory_total),
        subtitle: `周转 ${Number(kpis?.inventory_turnover ?? 0).toFixed(1)} 次/年`,
        icon: <FundOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)',
      },
      {
        key: 'labor',
        title: '人效产出比',
        value: `${Number(efficiency?.labor_efficiency_rate ?? 0).toFixed(1)}%`,
        subtitle: '标准工时 / 实际工时',
        icon: <SafetyCertificateOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)',
      },
      {
        key: 'wip',
        title: '在制品估值',
        value: formatMoney(wip?.estimated_wip_value),
        subtitle: `在产工单 ${wip?.active_work_orders_count ?? 0} 单`,
        icon: <HistoryOutlined style={{ fontSize: 24, color: '#fff' }} />,
        gradient: 'linear-gradient(135deg, #faad14 0%, #ffbb33 100%)',
        onClick: () => navigate('/apps/kuaizhizao/production-execution/work-orders'),
      },
    ],
    [efficiency, kpis, navigate, wip],
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
        title: `质量损失 ${formatMoney(scrapCost)}，占销售额 ${(lossRatio * 100).toFixed(1)}%`,
        description: '建议排查制程缺陷与报废原因',
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
        title: `回款周期 ${Number(kpis?.dso ?? 0).toFixed(1)} 天，偏长`,
        description: '可优先跟进逾期应收与催收计划',
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
        title: `在制品资金 ${formatMoney(wip?.estimated_wip_value)}`,
        description: '关注在产工单进度，避免资金长期沉淀',
        priority: 'medium',
        status: 'pending',
        link: '/apps/kuaizhizao/production-execution/work-orders',
        created_at: new Date().toISOString(),
      });
    }

    return items;
  }, [kpis, qualityLoss, wip]);

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
        <ModuleActionPanel title={`近 ${PERIOD_DAYS} 天经营关注点`} lg={24}>
          <ModuleTodoList items={insightItems} emptyText="本期暂无需要特别关注的经营事项" />
        </ModuleActionPanel>
      }
      chartRow={
        <ModuleChartRow>
          <ModuleChartPanel
            title="应收账款账龄分布"
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
            title="质量损失分析"
            lg={12}
            loading={loadingQuality}
            height={360}
            extra={
              showQualityAlert ? (
                <Text type="danger">
                  <AlertOutlined /> 异常预警
                </Text>
              ) : null
            }
          >
            {(qualityLoss?.scrap_cost ?? 0) > 0 || (qualityLoss?.unqualified_quantity ?? 0) > 0 ? (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <Statistic
                      title="报废直接金额"
                      value={qualityLoss?.scrap_cost ?? 0}
                      prefix="¥"
                      precision={2}
                    />
                  </Col>
                  <Col xs={24} sm={12}>
                    <Statistic
                      title="不合格品数"
                      value={qualityLoss?.unqualified_quantity ?? 0}
                      suffix="件"
                      precision={0}
                    />
                  </Col>
                </Row>
                {showQualityAlert ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginTop: 16 }}
                    message={`质量损失占销售额 ${(qualityLossRatio * 100).toFixed(1)}%，建议排查制程缺陷`}
                  />
                ) : (
                  <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                    本期质量损失在可控范围内
                  </Text>
                )}
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="近 30 天暂无质量损失记录"
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
