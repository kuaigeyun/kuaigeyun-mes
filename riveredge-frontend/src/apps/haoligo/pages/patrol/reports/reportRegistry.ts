/** 现场巡查统计报表注册表（图表类型与参考移动端看板对齐，避免单一 Column） */

export type PatrolReportChartType =
  | 'pie'
  | 'area'
  | 'radar'
  | 'bar-h'
  | 'line'
  | 'wordcloud';

export interface PatrolReportDef {
  key: string;
  titleKey: string;
  descKey: string;
  chartType: PatrolReportChartType;
  /** 纵轴为百分比 */
  percentY?: boolean;
  multiSeries?: boolean;
}

export const PATROL_REPORT_GROUPS: {
  groupKey: string;
  titleKey: string;
  leadKey: string;
  reports: PatrolReportDef[];
}[] = [
  {
    groupKey: 'volume',
    titleKey: 'app.haoligo.menu.patrol.group.reports.volume',
    leadKey: 'app.haoligo.patrol.reports.groupLead.volume',
    reports: [
      {
        key: 'issue-type-share',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.issueTypeShare',
        descKey: 'app.haoligo.patrol.reports.chartDesc.issueTypeShare',
        chartType: 'pie',
      },
      {
        key: 'monthly-volume',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.monthlyVolume',
        descKey: 'app.haoligo.patrol.reports.chartDesc.monthlyVolume',
        chartType: 'area',
      },
      {
        key: 'status-distribution',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.statusDistribution',
        descKey: 'app.haoligo.patrol.reports.chartDesc.statusDistribution',
        chartType: 'pie',
      },
    ],
  },
  {
    groupKey: 'completion',
    titleKey: 'app.haoligo.menu.patrol.group.reports.completion',
    leadKey: 'app.haoligo.patrol.reports.groupLead.completion',
    reports: [
      {
        key: 'node-completion-trend',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.nodeCompletion',
        descKey: 'app.haoligo.patrol.reports.chartDesc.nodeCompletion',
        chartType: 'radar',
        percentY: true,
      },
      {
        key: 'monthly-completion-rate',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.monthlyCompletionRate',
        descKey: 'app.haoligo.patrol.reports.chartDesc.monthlyCompletionRate',
        chartType: 'area',
        percentY: true,
      },
      {
        key: 'monthly-overdue-rate',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.monthlyOverdueRate',
        descKey: 'app.haoligo.patrol.reports.chartDesc.monthlyOverdueRate',
        chartType: 'bar-h',
        percentY: true,
      },
      {
        key: 'overdue-ranking',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.overdueRanking',
        descKey: 'app.haoligo.patrol.reports.chartDesc.overdueRanking',
        chartType: 'bar-h',
      },
    ],
  },
  {
    groupKey: 'area',
    titleKey: 'app.haoligo.menu.patrol.group.reports.area',
    leadKey: 'app.haoligo.patrol.reports.groupLead.area',
    reports: [
      {
        key: 'area-volume-trend',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.areaVolumeTrend',
        descKey: 'app.haoligo.patrol.reports.chartDesc.areaVolumeTrend',
        chartType: 'area',
        multiSeries: true,
      },
      {
        key: 'dept-headcount-trend',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.deptHeadcountTrend',
        descKey: 'app.haoligo.patrol.reports.chartDesc.deptHeadcountTrend',
        chartType: 'line',
        multiSeries: true,
      },
    ],
  },
  {
    groupKey: 'insights',
    titleKey: 'app.haoligo.menu.patrol.group.reports.insights',
    leadKey: 'app.haoligo.patrol.reports.groupLead.insights',
    reports: [
      {
        key: 'keyword-cloud',
        titleKey: 'app.haoligo.patrol.reports.chartTitle.keywordCloud',
        descKey: 'app.haoligo.patrol.reports.chartDesc.keywordCloud',
        chartType: 'wordcloud',
      },
    ],
  },
];

const ALL_REPORTS = PATROL_REPORT_GROUPS.flatMap((g) => g.reports);

export const PATROL_REPORT_BY_KEY = Object.fromEntries(ALL_REPORTS.map((r) => [r.key, r])) as Record<
  string,
  PatrolReportDef
>;

export const LEGACY_CHART_PATH_REDIRECTS: Record<string, string> = {
  'management/overview': 'group/volume',
  'charts/fault-by-workshop': 'issue-type-share',
  'charts/time-trend': 'monthly-volume',
  'charts/keyword-cloud': 'keyword-cloud',
  'charts/area-feedback': 'area-volume-trend',
  'charts/status-distribution': 'status-distribution',
  'charts/feedback-time-trend': 'monthly-overdue-rate',
  'charts/top-reporters': 'overdue-ranking',
  'charts/area-counts': 'area-volume-trend',
  'charts/time-vs-headcount': 'dept-headcount-trend',
};
