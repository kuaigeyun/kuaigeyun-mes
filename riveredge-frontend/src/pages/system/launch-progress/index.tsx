/**
 * 上线进度跟踪和检查清单页面
 * 
 * 提供上线进度跟踪和检查清单功能
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Tabs, Progress, Statistic, Table, Tag, Space, Button, Typography, Alert, List, Divider } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, FileTextOutlined, ReloadOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { getProgressTracking, generateProgressReport, ProgressTracking, ProgressReport } from '../../../services/launchProgress';
import { getChecklist, checkItems, generateCheckReport, ChecklistItem, CheckReport } from '../../../services/launchChecklist';

const { Title, Paragraph, Text } = Typography;

/**
 * 上线进度跟踪和检查清单页面组件
 */
const LaunchProgressPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [progressTracking, setProgressTracking] = useState<ProgressTracking | null>(null);
  const [progressReport, setProgressReport] = useState<ProgressReport | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checkReport, setCheckReport] = useState<CheckReport | null>(null);
  const [activeTab, setActiveTab] = useState<string>('tracking');

  /**
   * 加载进度跟踪
   */
  const loadProgressTracking = async () => {
    try {
      setLoading(true);
      const data = await getProgressTracking();
      setProgressTracking(data);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.launchProgress.loadTrackingFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载进度报告
   */
  const loadProgressReport = async () => {
    try {
      setLoading(true);
      const data = await generateProgressReport();
      setProgressReport(data);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.launchProgress.generateReportFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载检查清单
   */
  const loadChecklist = async () => {
    try {
      setLoading(true);
      const data = await getChecklist();
      setChecklist(data);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.launchProgress.loadChecklistFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 执行检查
   */
  const handleCheckItems = async () => {
    try {
      setLoading(true);
      const data = await checkItems();
      setChecklist(data);
      messageApi.success(t('pages.system.launchProgress.checkSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.launchProgress.checkFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 生成检查报告
   */
  const loadCheckReport = async () => {
    try {
      setLoading(true);
      const data = await generateCheckReport();
      setCheckReport(data);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.launchProgress.generateCheckReportFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (activeTab === 'tracking') {
      loadProgressTracking();
    } else if (activeTab === 'checklist') {
      loadChecklist();
    }
  }, [activeTab]);

  /**
   * 进度跟踪表格列
   */
  const stageColumns = [
    {
      title: t('pages.system.launchProgress.columnStageName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('pages.system.launchProgress.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => {
        if (record.completed) {
          return <Tag color="success" icon={<CheckCircleOutlined />}>{t('pages.system.launchProgress.completed')}</Tag>;
        } else if (status === 'in_progress') {
          return <Tag color="processing" icon={<ClockCircleOutlined />}>{t('pages.system.launchProgress.inProgress')}</Tag>;
        } else {
          return <Tag color="default" icon={<ClockCircleOutlined />}>{t('pages.system.launchProgress.pending')}</Tag>;
        }
      },
    },
    {
      title: t('pages.system.launchProgress.columnUpdatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (text: string) => text || '-',
    },
  ];

  /**
   * 任务表格列
   */
  const taskColumns = [
    {
      title: t('pages.system.launchProgress.columnTaskName'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('pages.system.launchProgress.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'completed') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>{t('pages.system.launchProgress.completed')}</Tag>;
        } else if (status === 'in_progress') {
          return <Tag color="processing" icon={<ClockCircleOutlined />}>{t('pages.system.launchProgress.inProgress')}</Tag>;
        } else {
          return <Tag color="default" icon={<ClockCircleOutlined />}>{t('pages.system.launchProgress.pending')}</Tag>;
        }
      },
    },
    {
      title: t('pages.system.launchProgress.columnCritical'),
      dataIndex: 'is_critical',
      key: 'is_critical',
      render: (isCritical: boolean) => isCritical ? <Tag color="red">{t('pages.system.launchProgress.tagCritical')}</Tag> : '-',
    },
    {
      title: t('pages.system.launchProgress.columnDueSoon'),
      dataIndex: 'is_due_soon',
      key: 'is_due_soon',
      render: (isDueSoon: boolean) => isDueSoon ? <Tag color="orange">{t('pages.system.launchProgress.tagDueSoon')}</Tag> : '-',
    },
  ];

  /**
   * 检查清单表格列
   */
  const checklistColumns = [
    {
      title: t('pages.system.launchProgress.columnCheckItem'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('pages.system.launchProgress.columnCategory'),
      dataIndex: 'category_name',
      key: 'category_name',
    },
    {
      title: t('pages.system.launchProgress.columnCheckStatus'),
      dataIndex: 'check_status',
      key: 'check_status',
      render: (status: string, record: ChecklistItem) => {
        if (status === 'passed') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>{t('pages.system.launchProgress.passed')}</Tag>;
        } else if (status === 'failed') {
          return <Tag color="error" icon={<ExclamationCircleOutlined />}>{t('pages.system.launchProgress.failed')}</Tag>;
        } else {
          return <Tag color="default">{t('pages.system.launchProgress.toCheck')}</Tag>;
        }
      },
    },
    {
      title: t('pages.system.launchProgress.columnCriticalItem'),
      dataIndex: 'is_critical',
      key: 'is_critical',
      render: (isCritical: boolean) => isCritical ? <Tag color="red">{t('pages.system.launchProgress.tagCritical')}</Tag> : '-',
    },
    {
      title: t('pages.system.launchProgress.columnCheckTime'),
      dataIndex: 'check_time',
      key: 'check_time',
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{t('pages.system.launchProgress.pageTitle')}</Title>
      <Paragraph>
        {t('pages.system.launchProgress.pageDesc')}
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'tracking',
            label: t('pages.system.launchProgress.tabTracking'),
            children: (
              <div>
                <Card
                  title={t('pages.system.launchProgress.trackingTitle')}
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={loadProgressTracking}>{t('pages.system.launchProgress.refresh')}</Button>
                      <Button type="primary" icon={<FileTextOutlined />} onClick={loadProgressReport}>
                        {t('pages.system.launchProgress.generateReport')}
                      </Button>
                    </Space>
                  }
                  loading={loading}
                >
                  {progressTracking && progressTracking.has_countdown ? (
                    <div>
                      <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        {/* 倒计时和进度条 */}
                        <Card>
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Statistic
                              title={t('pages.system.launchProgress.daysRemaining')}
                              value={progressTracking.days_remaining}
                              suffix={t('pages.system.launchProgress.days')}
                              valueStyle={{ color: progressTracking.days_remaining <= 3 ? '#cf1322' : '#1890ff' }}
                            />
                            <Progress
                              percent={progressTracking.progress_percentage}
                              status={progressTracking.progress_percentage === 100 ? 'success' : 'active'}
                              strokeColor={{
                                '0%': '#108ee9',
                                '100%': '#87d068',
                              }}
                            />
                          </Space>
                        </Card>

                        {/* 阶段列表 */}
                        <Card title={t('pages.system.launchProgress.stageProgress')}>
                          <Table
                            dataSource={progressTracking.stages}
                            columns={stageColumns}
                            rowKey="key"
                            pagination={false}
                          />
                        </Card>

                        {/* 任务清单 */}
                        <Card title={t('pages.system.launchProgress.taskList')}>
                          <Table
                            dataSource={progressTracking.tasks}
                            columns={taskColumns}
                            rowKey="id"
                            pagination={false}
                          />
                        </Card>
                      </Space>
                    </div>
                  ) : (
                    <Alert
                      message={t('pages.system.launchProgress.noCountdown')}
                      description={t('pages.system.launchProgress.noCountdownDesc')}
                      type="info"
                      showIcon
                    />
                  )}
                </Card>

                {/* 进度报告 */}
                {progressReport && (
                  <Card title={t('pages.system.launchProgress.progressReport')} style={{ marginTop: 16 }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <div>
                        <Title level={4}>{t('pages.system.launchProgress.statsTitle')}</Title>
                        <Space size="large">
                          <Statistic title={t('pages.system.launchProgress.totalTasks')} value={progressReport.summary.total_tasks} />
                          <Statistic title={t('pages.system.launchProgress.completed')} value={progressReport.summary.completed_tasks} />
                          <Statistic title={t('pages.system.launchProgress.inProgress')} value={progressReport.summary.in_progress_tasks} />
                          <Statistic title={t('pages.system.launchProgress.pending')} value={progressReport.summary.pending_tasks} />
                          <Statistic
                            title={t('pages.system.launchProgress.completionRate')}
                            value={progressReport.summary.completion_rate}
                            suffix="%"
                          />
                        </Space>
                      </div>

                      {progressReport.risks && progressReport.risks.length > 0 && (
                        <div>
                          <Title level={4}>{t('pages.system.launchProgress.riskTitle')}</Title>
                          <List
                            dataSource={progressReport.risks}
                            renderItem={(risk) => (
                              <List.Item>
                                <Alert
                                  message={risk.message}
                                  type={risk.level === 'high' ? 'error' : 'warning'}
                                  showIcon
                                />
                              </List.Item>
                            )}
                          />
                        </div>
                      )}
                    </Space>
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'checklist',
            label: t('pages.system.launchProgress.tabChecklist'),
            children: (
              <div>
                <Card
                  title={t('pages.system.launchProgress.checklistTitle')}
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={loadChecklist}>{t('pages.system.launchProgress.refresh')}</Button>
                      <Button type="primary" onClick={handleCheckItems}>{t('pages.system.launchProgress.runCheck')}</Button>
                      <Button icon={<FileTextOutlined />} onClick={loadCheckReport}>
                        {t('pages.system.launchProgress.generateReport')}
                      </Button>
                    </Space>
                  }
                  loading={loading}
                >
                  <Table
                    dataSource={checklist}
                    columns={checklistColumns}
                    rowKey="key"
                    pagination={{ pageSize: 10 }}
                  />
                </Card>

                {/* 检查报告 */}
                {checkReport && (
                  <Card title={t('pages.system.launchProgress.checkReport')} style={{ marginTop: 16 }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <div>
                        <Title level={4}>{t('pages.system.launchProgress.statsTitle')}</Title>
                        <Space size="large">
                          <Statistic title={t('pages.system.launchProgress.totalItems')} value={checkReport.summary.total_items} />
                          <Statistic title={t('pages.system.launchProgress.passed')} value={checkReport.summary.passed_items} />
                          <Statistic title={t('pages.system.launchProgress.failed')} value={checkReport.summary.failed_items} />
                          <Statistic title={t('pages.system.launchProgress.toCheck')} value={checkReport.summary.pending_items} />
                          <Statistic
                            title={t('pages.system.launchProgress.passRate')}
                            value={checkReport.summary.pass_rate}
                            suffix="%"
                          />
                        </Space>
                      </div>

                      <Divider />

                      <div>
                        <Title level={4}>{t('pages.system.launchProgress.criticalTitle')}</Title>
                        <Space size="large">
                          <Statistic title={t('pages.system.launchProgress.criticalTotal')} value={checkReport.summary.critical_total} />
                          <Statistic title={t('pages.system.launchProgress.criticalPassed')} value={checkReport.summary.critical_passed} />
                          <Statistic title={t('pages.system.launchProgress.criticalFailed')} value={checkReport.summary.critical_failed} />
                        </Space>
                      </div>
                    </Space>
                  </Card>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default LaunchProgressPage;
