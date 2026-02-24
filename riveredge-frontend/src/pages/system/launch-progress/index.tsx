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
      title: '阶段名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: any) => {
        if (record.completed) {
          return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
        } else if (status === 'in_progress') {
          return <Tag color="processing" icon={<ClockCircleOutlined />}>进行中</Tag>;
        } else {
          return <Tag color="default" icon={<ClockCircleOutlined />}>待开始</Tag>;
        }
      },
    },
    {
      title: '更新时间',
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
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'completed') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
        } else if (status === 'in_progress') {
          return <Tag color="processing" icon={<ClockCircleOutlined />}>进行中</Tag>;
        } else {
          return <Tag color="default" icon={<ClockCircleOutlined />}>待开始</Tag>;
        }
      },
    },
    {
      title: '关键任务',
      dataIndex: 'is_critical',
      key: 'is_critical',
      render: (isCritical: boolean) => isCritical ? <Tag color="red">关键</Tag> : '-',
    },
    {
      title: '即将到期',
      dataIndex: 'is_due_soon',
      key: 'is_due_soon',
      render: (isDueSoon: boolean) => isDueSoon ? <Tag color="orange">即将到期</Tag> : '-',
    },
  ];

  /**
   * 检查清单表格列
   */
  const checklistColumns = [
    {
      title: '检查项',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '分类',
      dataIndex: 'category_name',
      key: 'category_name',
    },
    {
      title: '检查状态',
      dataIndex: 'check_status',
      key: 'check_status',
      render: (status: string, record: ChecklistItem) => {
        if (status === 'passed') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>通过</Tag>;
        } else if (status === 'failed') {
          return <Tag color="error" icon={<ExclamationCircleOutlined />}>未通过</Tag>;
        } else {
          return <Tag color="default">待检查</Tag>;
        }
      },
    },
    {
      title: '关键项',
      dataIndex: 'is_critical',
      key: 'is_critical',
      render: (isCritical: boolean) => isCritical ? <Tag color="red">关键</Tag> : '-',
    },
    {
      title: '检查时间',
      dataIndex: 'check_time',
      key: 'check_time',
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>上线进度跟踪和检查清单</Title>
      <Paragraph>
        跟踪上线进度，管理检查清单，确保系统顺利上线。
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'tracking',
            label: '进度跟踪',
            children: (
              <div>
                <Card
                  title="上线进度跟踪"
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={loadProgressTracking}>刷新</Button>
                      <Button type="primary" icon={<FileTextOutlined />} onClick={loadProgressReport}>
                        生成报告
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
                              title="距离上线还有"
                              value={progressTracking.days_remaining}
                              suffix="天"
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
                        <Card title="阶段进度">
                          <Table
                            dataSource={progressTracking.stages}
                            columns={stageColumns}
                            rowKey="key"
                            pagination={false}
                          />
                        </Card>

                        {/* 任务清单 */}
                        <Card title="任务清单">
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
                      message="未启动上线倒计时"
                      description="请先启动上线倒计时功能，才能查看进度跟踪信息。"
                      type="info"
                      showIcon
                    />
                  )}
                </Card>

                {/* 进度报告 */}
                {progressReport && (
                  <Card title="进度报告" style={{ marginTop: 16 }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <div>
                        <Title level={4}>统计信息</Title>
                        <Space size="large">
                          <Statistic title="总任务数" value={progressReport.summary.total_tasks} />
                          <Statistic title="已完成" value={progressReport.summary.completed_tasks} />
                          <Statistic title="进行中" value={progressReport.summary.in_progress_tasks} />
                          <Statistic title="待开始" value={progressReport.summary.pending_tasks} />
                          <Statistic
                            title="完成率"
                            value={progressReport.summary.completion_rate}
                            suffix="%"
                          />
                        </Space>
                      </div>

                      {progressReport.risks && progressReport.risks.length > 0 && (
                        <div>
                          <Title level={4}>风险提示</Title>
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
            label: '检查清单',
            children: (
              <div>
                <Card
                  title="上线检查清单"
                  extra={
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={loadChecklist}>刷新</Button>
                      <Button type="primary" onClick={handleCheckItems}>执行检查</Button>
                      <Button icon={<FileTextOutlined />} onClick={loadCheckReport}>
                        生成报告
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
                  <Card title="检查报告" style={{ marginTop: 16 }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      <div>
                        <Title level={4}>统计信息</Title>
                        <Space size="large">
                          <Statistic title="总检查项" value={checkReport.summary.total_items} />
                          <Statistic title="通过" value={checkReport.summary.passed_items} />
                          <Statistic title="未通过" value={checkReport.summary.failed_items} />
                          <Statistic title="待检查" value={checkReport.summary.pending_items} />
                          <Statistic
                            title="通过率"
                            value={checkReport.summary.pass_rate}
                            suffix="%"
                          />
                        </Space>
                      </div>

                      <Divider />

                      <div>
                        <Title level={4}>关键检查项</Title>
                        <Space size="large">
                          <Statistic title="关键项总数" value={checkReport.summary.critical_total} />
                          <Statistic title="已通过" value={checkReport.summary.critical_passed} />
                          <Statistic title="未通过" value={checkReport.summary.critical_failed} />
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
