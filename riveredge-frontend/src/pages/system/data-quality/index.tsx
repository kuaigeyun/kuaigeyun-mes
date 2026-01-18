/**
 * 数据质量保障页面
 * 
 * 提供数据验证、数据清洗建议、数据质量报告等功能
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState } from 'react';
import { Card, Tabs, Table, Tag, Space, Typography, Button, Progress, Alert, List, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { validateData, detectDataIssues, generateQualityReport, ValidationReport, DataCleaningSuggestion, DataQualityReport } from '../../../services/dataQuality';
import { UniImport } from '../../../components';

const { Title, Paragraph, Text } = Typography;

/**
 * 数据质量保障页面组件
 */
const DataQualityPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [importVisible, setImportVisible] = useState(false);
  const [importData, setImportData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [cleaningSuggestions, setCleaningSuggestions] = useState<DataCleaningSuggestion[]>([]);
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null);
  const [activeTab, setActiveTab] = useState<string>('validate');

  /**
   * 处理数据导入
   */
  const handleImportConfirm = (data: any[][]) => {
    if (data.length === 0) {
      messageApi.error('请至少填写一行数据');
      return;
    }
    
    setImportData(data);
    setHeaders(data[0] || []);
    setImportVisible(false);
    messageApi.success('数据导入成功，请进行验证');
  };

  /**
   * 执行数据验证
   */
  const handleValidate = async () => {
    if (importData.length === 0) {
      messageApi.warning('请先导入数据');
      return;
    }

    try {
      setLoading(true);
      const report = await validateData({
        data: importData,
        headers: headers,
        field_rules: {},
        required_fields: [],
        reference_data: {},
      });
      setValidationReport(report);
      setActiveTab('validate');
      messageApi.success('数据验证完成');
    } catch (error: any) {
      messageApi.error(error.message || '数据验证失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 检测数据问题
   */
  const handleDetectIssues = async () => {
    if (importData.length === 0) {
      messageApi.warning('请先导入数据');
      return;
    }

    try {
      setLoading(true);
      const suggestions = await detectDataIssues({
        data: importData,
        headers: headers,
        key_fields: [],
      });
      setCleaningSuggestions(suggestions);
      setActiveTab('cleaning');
      messageApi.success('数据问题检测完成');
    } catch (error: any) {
      messageApi.error(error.message || '检测数据问题失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 生成数据质量报告
   */
  const handleGenerateReport = async () => {
    if (importData.length === 0) {
      messageApi.warning('请先导入数据');
      return;
    }

    try {
      setLoading(true);
      const report = await generateQualityReport(
        {
          data: importData,
          headers: headers,
          field_rules: {},
          required_fields: [],
          reference_data: {},
        },
        {
          data: importData,
          headers: headers,
          key_fields: [],
        }
      );
      setQualityReport(report);
      setActiveTab('report');
      messageApi.success('数据质量报告生成完成');
    } catch (error: any) {
      messageApi.error(error.message || '生成数据质量报告失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 验证问题表格列
   */
  const issueColumns = [
    {
      title: '行号',
      dataIndex: 'row_index',
      key: 'row_index',
      width: 80,
    },
    {
      title: '字段',
      dataIndex: 'field',
      key: 'field',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'issue_type',
      key: 'issue_type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'error' ? 'red' : 'orange'}>
          {type === 'error' ? '错误' : '警告'}
        </Tag>
      ),
    },
    {
      title: '问题描述',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: '建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
      render: (text: string) => text || '-',
    },
  ];

  /**
   * 清洗建议表格列
   */
  const suggestionColumns = [
    {
      title: '问题类型',
      dataIndex: 'issue_type',
      key: 'issue_type',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, { text: string; color: string }> = {
          duplicate: { text: '重复', color: 'orange' },
          anomaly: { text: '异常', color: 'red' },
          missing: { text: '缺失', color: 'blue' },
          format: { text: '格式', color: 'purple' },
        };
        const info = typeMap[type] || { text: type, color: 'default' };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '影响行数',
      dataIndex: 'affected_rows',
      key: 'affected_rows',
      width: 120,
      render: (rows: number[]) => `${rows.length}行`,
    },
    {
      title: '建议',
      dataIndex: 'suggestion',
      key: 'suggestion',
    },
    {
      title: '可自动修复',
      dataIndex: 'auto_fixable',
      key: 'auto_fixable',
      width: 100,
      render: (fixable: boolean) => (
        <Tag color={fixable ? 'green' : 'default'}>
          {fixable ? '是' : '否'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>数据质量保障</Title>
      <Paragraph>
        提供数据验证、数据清洗建议、数据质量报告等功能，确保导入数据的质量和准确性。
      </Paragraph>

      <Card
        title="数据导入"
        extra={
          <Space>
            <Button onClick={() => setImportVisible(true)}>导入数据</Button>
            <Button type="primary" onClick={handleValidate} loading={loading}>
              执行验证
            </Button>
            <Button onClick={handleDetectIssues} loading={loading}>
              检测问题
            </Button>
            <Button onClick={handleGenerateReport} loading={loading}>
              生成报告
            </Button>
          </Space>
        }
      >
        {importData.length > 0 ? (
          <Alert
            message={`已导入数据：${importData.length - 1}行（表头除外）`}
            type="info"
            showIcon
          />
        ) : (
          <Empty description="请先导入数据" />
        )}
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'validate',
            label: '数据验证',
            children: validationReport ? (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text strong>验证结果概览</Text>
                    <div style={{ marginTop: 16 }}>
                      <Space size="large">
                        <div>
                          <Text>总行数：</Text>
                          <Text strong>{validationReport.total_rows}</Text>
                        </div>
                        <div>
                          <Text>有效行数：</Text>
                          <Text strong style={{ color: '#52c41a' }}>
                            {validationReport.valid_rows}
                          </Text>
                        </div>
                        <div>
                          <Text>错误行数：</Text>
                          <Text strong style={{ color: '#ff4d4f' }}>
                            {validationReport.error_rows}
                          </Text>
                        </div>
                        <div>
                          <Text>警告行数：</Text>
                          <Text strong style={{ color: '#faad14' }}>
                            {validationReport.warning_rows}
                          </Text>
                        </div>
                      </Space>
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <Progress
                        percent={Math.round((validationReport.valid_rows / validationReport.total_rows) * 100)}
                        status={validationReport.is_valid ? 'success' : 'exception'}
                      />
                    </div>
                  </div>
                  {validationReport.issues.length > 0 && (
                    <div>
                      <Text strong>验证问题详情</Text>
                      <Table
                        dataSource={validationReport.issues}
                        columns={issueColumns}
                        rowKey={(record, index) => `${record.row_index}-${index}`}
                        pagination={{ pageSize: 10 }}
                        style={{ marginTop: 16 }}
                      />
                    </div>
                  )}
                </Space>
              </Card>
            ) : (
              <Card>
                <Empty description="请先执行数据验证" />
              </Card>
            ),
          },
          {
            key: 'cleaning',
            label: '数据清洗建议',
            children: cleaningSuggestions.length > 0 ? (
              <Card>
                <Table
                  dataSource={cleaningSuggestions}
                  columns={suggestionColumns}
                  rowKey={(record, index) => `${record.issue_type}-${index}`}
                  pagination={{ pageSize: 10 }}
                  expandable={{
                    expandedRowRender: (record) => (
                      <div>
                        <Text strong>影响行号：</Text>
                        <Text>{record.affected_rows.join(', ')}</Text>
                      </div>
                    ),
                  }}
                />
              </Card>
            ) : (
              <Card>
                <Empty description="请先检测数据问题" />
              </Card>
            ),
          },
          {
            key: 'report',
            label: '数据质量报告',
            children: qualityReport ? (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text strong>质量指标</Text>
                    <div style={{ marginTop: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text>完整性</Text>
                            <Text strong>{qualityReport.completeness}%</Text>
                          </div>
                          <Progress percent={qualityReport.completeness} status="active" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text>准确性</Text>
                            <Text strong>{qualityReport.accuracy}%</Text>
                          </div>
                          <Progress percent={qualityReport.accuracy} status="active" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text>一致性</Text>
                            <Text strong>{qualityReport.consistency}%</Text>
                          </div>
                          <Progress percent={qualityReport.consistency} status="active" />
                        </div>
                      </Space>
                    </div>
                  </div>
                  {qualityReport.issues.length > 0 && (
                    <div>
                      <Text strong>问题汇总</Text>
                      <Table
                        dataSource={qualityReport.issues}
                        columns={issueColumns}
                        rowKey={(record, index) => `${record.row_index}-${index}`}
                        pagination={{ pageSize: 10 }}
                        style={{ marginTop: 16 }}
                      />
                    </div>
                  )}
                  {qualityReport.suggestions.length > 0 && (
                    <div>
                      <Text strong>清洗建议</Text>
                      <List
                        dataSource={qualityReport.suggestions}
                        renderItem={(item) => (
                          <List.Item>
                            <List.Item.Meta
                              title={
                                <Space>
                                  <Tag color="blue">{item.issue_type}</Tag>
                                  <Text>{item.description}</Text>
                                </Space>
                              }
                              description={item.suggestion}
                            />
                          </List.Item>
                        )}
                        style={{ marginTop: 16 }}
                      />
                    </div>
                  )}
                </Space>
              </Card>
            ) : (
              <Card>
                <Empty description="请先生成数据质量报告" />
              </Card>
            ),
          },
        ]}
      />

      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImportConfirm}
        title="导入数据"
        headers={headers}
      />
    </div>
  );
};

export default DataQualityPage;
