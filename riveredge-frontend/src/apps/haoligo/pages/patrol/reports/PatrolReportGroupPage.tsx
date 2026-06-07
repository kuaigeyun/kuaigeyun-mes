/**
 * 好力 GO — 现场巡查统计报表（分组单页 + 栅格多图）。
 * 台账 KPI 为全组织汇总，仅在「事项分布」分组展示，避免各子主题页重复相同数字。
 * 水平/顶边距由 UniTabs 内容区统一为 16px，此处不再套一层 padding，避免「双 16」过宽。
 */

import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Col,
  Empty,
  Row,
  Space,
  Spin,
  Statistic,
  Typography,
} from 'antd';
import {
  AreaChartOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  LineChartOutlined,
  PieChartOutlined,
  RadarChartOutlined,
  TagsOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useRequest } from 'ahooks';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import {
  getPatrolReport,
  getPatrolReportKpiSummary,
  type PatrolReportKpiSummary,
  type PatrolReportPayload,
} from '../../../services/haoligo';
import { PATROL_REPORT_GROUPS, type PatrolReportDef } from './reportRegistry';
import { renderPatrolReportChart } from './patrolReportChartRender';

const { Paragraph, Text, Title } = Typography;

const KPI_CARD: React.CSSProperties = {
  borderRadius: 10,
  height: '100%',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

function findGroup(groupKey: string | undefined) {
  if (!groupKey) return undefined;
  return PATROL_REPORT_GROUPS.find((g) => g.groupKey === groupKey);
}

function ChartBlock({
  def,
  payload,
  icon,
}: {
  def: PatrolReportDef;
  payload: PatrolReportPayload | undefined;
  icon: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Card
      variant="borderless"
      style={KPI_CARD}
      title={
        <Space size={8}>
          {icon}
          <span style={{ fontWeight: 600 }}>{t(def.titleKey)}</span>
        </Space>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        {t(def.descKey)}
      </Paragraph>
      {renderPatrolReportChart(def, payload, t)}
    </Card>
  );
}

function KpiStrip({ kpi, loading }: { kpi: PatrolReportKpiSummary | undefined; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card variant="borderless" style={{ ...KPI_CARD, background: 'linear-gradient(135deg,#e6f4ff 0%,#f5fbff 100%)' }}>
          <Statistic
            title={<Text style={{ color: '#0958d9' }}>{t('app.haoligo.patrol.reports.kpi.total')}</Text>}
            value={loading ? '—' : kpi?.total_tasks ?? 0}
            prefix={<UnorderedListOutlined style={{ color: '#1677ff' }} />}
            styles={{ content: {fontWeight: 700, color: '#0958d9' } }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card variant="borderless" style={{ ...KPI_CARD, background: 'linear-gradient(135deg,#fff7e6 0%,#fffbf0 100%)' }}>
          <Statistic
            title={<Text style={{ color: '#ad4e00' }}>{t('app.haoligo.patrol.reports.kpi.open')}</Text>}
            value={loading ? '—' : kpi?.open_tasks ?? 0}
            prefix={<BarChartOutlined style={{ color: '#fa8c16' }} />}
            styles={{ content: {fontWeight: 700, color: '#ad4e00' } }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card variant="borderless" style={{ ...KPI_CARD, background: 'linear-gradient(135deg,#f6ffed 0%,#fcfffa 100%)' }}>
          <Statistic
            title={<Text style={{ color: '#237804' }}>{t('app.haoligo.patrol.reports.kpi.completed')}</Text>}
            value={loading ? '—' : kpi?.completed_tasks ?? 0}
            prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            styles={{ content: {fontWeight: 700, color: '#237804' } }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card variant="borderless" style={{ ...KPI_CARD, background: 'linear-gradient(135deg,#f9f0ff 0%,#fcfaff 100%)' }}>
          <Statistic
            title={<Text style={{ color: '#531dab' }}>{t('app.haoligo.patrol.reports.kpi.contributors')}</Text>}
            value={loading ? '—' : kpi?.contributor_count ?? 0}
            prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
            styles={{ content: {fontWeight: 700, color: '#531dab' } }}
          />
        </Card>
      </Col>
    </Row>
  );
}

function patrolReportChartIcon(def: PatrolReportDef, color: string) {
  const style = { color };
  switch (def.chartType) {
    case 'pie':
      return <PieChartOutlined style={style} />;
    case 'area':
      return <AreaChartOutlined style={style} />;
    case 'radar':
      return <RadarChartOutlined style={style} />;
    case 'bar-h':
      return <BarChartOutlined style={style} />;
    case 'line':
      return <LineChartOutlined style={style} />;
    case 'wordcloud':
      return <TagsOutlined style={style} />;
    default:
      return <BarChartOutlined style={style} />;
  }
}

const PatrolReportGroupPage: React.FC = () => {
  const { groupKey = '' } = useParams<{ groupKey: string }>();
  const { t } = useTranslation();
  const group = useMemo(() => findGroup(groupKey), [groupKey]);

  const { data, loading } = useRequest(
    async () => {
      if (!group) return { kpi: undefined as PatrolReportKpiSummary | undefined, payloads: [] as PatrolReportPayload[] };
      const payloads = await Promise.all(group.reports.map((r) => getPatrolReport(r.key, { months: 12 })));
      if (group.groupKey === 'volume') {
        const kpi = await getPatrolReportKpiSummary();
        return { kpi, payloads };
      }
      return { kpi: undefined, payloads };
    },
    { refreshDeps: [groupKey], ready: Boolean(group?.reports.length) },
  );

  const kpi = data?.kpi;
  const payloads = data?.payloads ?? [];

  if (!group) {
    return (
      <ListPageTemplate>
        <Empty description={t('app.haoligo.patrol.reports.groupNotFound')} />
      </ListPageTemplate>
    );
  }

  const chartBlock = (def: PatrolReportDef, index: number, icon: React.ReactNode) => (
    <ChartBlock key={def.key} def={def} payload={payloads[index]} icon={icon} />
  );

  let body: React.ReactNode;
  if (group.groupKey === 'volume') {
    const [a, b, c] = group.reports;
    body = (
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>{chartBlock(a, 0, patrolReportChartIcon(a, '#1677ff'))}</Col>
        <Col xs={24} lg={12}>{chartBlock(c, 2, patrolReportChartIcon(c, '#52c41a'))}</Col>
        <Col span={24}>{chartBlock(b, 1, patrolReportChartIcon(b, '#1677ff'))}</Col>
      </Row>
    );
  } else if (group.groupKey === 'completion') {
    const r = group.reports;
    body = (
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>{chartBlock(r[0], 0, patrolReportChartIcon(r[0], '#1677ff'))}</Col>
        <Col xs={24} xl={12}>{chartBlock(r[1], 1, patrolReportChartIcon(r[1], '#52c41a'))}</Col>
        <Col xs={24} xl={12}>{chartBlock(r[2], 2, patrolReportChartIcon(r[2], '#fa8c16'))}</Col>
        <Col xs={24} xl={12}>{chartBlock(r[3], 3, patrolReportChartIcon(r[3], '#722ed1'))}</Col>
      </Row>
    );
  } else {
    body = (
      <Row gutter={[16, 16]}>
        {group.reports.map((def, index) => (
          <Col key={def.key} span={24}>
            {chartBlock(def, index, patrolReportChartIcon(def, '#1677ff'))}
          </Col>
        ))}
      </Row>
    );
  }

  return (
    <ListPageTemplate>
      <div style={{ width: '100%', minWidth: 0, padding: 0, paddingBottom: 16, boxSizing: 'border-box' }}>
        <Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          {t(group.titleKey)}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.65 }}>
          {t(group.leadKey)}
        </Paragraph>
        <Spin spinning={loading}>
          {group.groupKey === 'volume' ? <KpiStrip kpi={kpi} loading={loading} /> : null}
          {body}
        </Spin>
      </div>
    </ListPageTemplate>
  );
};

export default PatrolReportGroupPage;
