/**
 * 数据质量保障页面
 * 
 * 提供数据验证、数据清洗建议、数据质量报告等功能
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      messageApi.error(t('pages.system.dataQuality.importAtLeastOneRow'));
      return;
    }
    
    setImportData(data);
    setHeaders(data[0] || []);
    setImportVisible(false);
    messageApi.success(t('pages.system.dataQuality.importSuccess'));
  };

  /**
   * 执行数据验证
   */
  const handleValidate = async () => {
    if (importData.length === 0) {
      messageApi.warning(t('pages.system.dataQuality.importDataFirst'));
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
      messageApi.success(t('pages.system.dataQuality.validateSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataQuality.validateFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 检测数据问题
   */
  const handleDetectIssues = async () => {
    if (importData.length === 0) {
      messageApi.warning(t('pages.system.dataQuality.importDataFirst'));
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
      messageApi.success(t('pages.system.dataQuality.detectSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataQuality.detectFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 生成数据质量报告
   */
  const handleGenerateReport = async () => {
    if (importData.length === 0) {
      messageApi.warning(t('pages.system.dataQuality.importDataFirst'));
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
      messageApi.success(t('pages.system.dataQuality.reportSuccess'));
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.dataQuality.reportFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 验证问题表格列
   */
  const issueColumns = [
    {
      title: t('pages.system.dataQuality.columnRowNo'),
      dataIndex: 'row_index',
      key: 'row_index',
      width: 80,
    },
    {
      title: t('pages.system.dataQuality.columnField'),
      dataIndex: 'field',
      key: 'field',
      width: 120,
    },
    {
      title: t('pages.system.dataQuality.columnType'),
      dataIndex: 'issue_type',
      key: 'issue_type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'error' ? 'red' : 'orange'}>
          {type === 'error' ? t('pages.system.dataQuality.typeError') : t('pages.system.dataQuality.typeWarning')}
        </Tag>
      ),
    },
    {
      title: t('pages.system.dataQuality.columnIssueDesc'),
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: t('pages.system.dataQuality.columnSuggestion'),
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
      title: t('pages.system.dataQuality.columnIssueType'),
      dataIndex: 'issue_type',
      key: 'issue_type',
      width: 120,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          duplicate: 'pages.system.dataQuality.issueDuplicate',
          anomaly: 'pages.system.dataQuality.issueAnomaly',
          missing: 'pages.system.dataQuality.issueMissing',
          format: 'pages.system.dataQuality.issueFormat',
        };
        const key = typeMap[type];
        const colorMap: Record<string, string> = { duplicate: 'orange', anomaly: 'red', missing: 'blue', format: 'purple' };
        return <Tag color={colorMap[type] || 'default'}>{key ? t(key) : type}</Tag>;
      },
    },
    {
      title: t('pages.system.dataQuality.columnDesc'),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: t('pages.system.dataQuality.columnAffectedRows'),
      dataIndex: 'affected_rows',
      key: 'affected_rows',
      width: 120,
      render: (rows: number[]) => t('pages.system.dataQuality.rowsUnit', { count: rows.length }),
    },
    {
      title: t('pages.system.dataQuality.columnSuggestion'),
      dataIndex: 'suggestion',
      key: 'suggestion',
    },
    {
      title: t('pages.system.dataQuality.columnAutoFix'),
      dataIndex: 'auto_fixable',
      key: 'auto_fixable',
      width: 100,
      render: (fixable: boolean) => (
        <Tag color={fixable ? 'green' : 'default'}>
          {fixable ? t('pages.system.dataQuality.yes') : t('pages.system.dataQuality.no')}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{t('pages.system.dataQuality.pageTitle')}</Title>
      <Paragraph>
        {t('pages.system.dataQuality.pageDesc')}
      </Paragraph>

      <Card
        title={t('pages.system.dataQuality.importTitle')}
        extra={
          <Space>
            <Button onClick={() => setImportVisible(true)}>{t('pages.system.dataQuality.importData')}</Button>
            <Button type="primary" onClick={handleValidate} loading={loading}>
              {t('pages.system.dataQuality.runValidate')}
            </Button>
            <Button onClick={handleDetectIssues} loading={loading}>
              {t('pages.system.dataQuality.detectIssues')}
            </Button>
            <Button onClick={handleGenerateReport} loading={loading}>
              {t('pages.system.dataQuality.generateReport')}
            </Button>
          </Space>
        }
      >
        {importData.length > 0 ? (
          <Alert
            message={t('pages.system.dataQuality.importedInfo', { count: importData.length - 1 })}
            type="info"
            showIcon
          />
        ) : (
          <Empty description={t('pages.system.dataQuality.emptyImport')} />
        )}
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'validate',
            label: t('pages.system.dataQuality.tabValidate'),
            children: validationReport ? (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text strong>{t('pages.system.dataQuality.validateOverview')}</Text>
                    <div style={{ marginTop: 16 }}>
                      <Space size="large">
                        <div>
                          <Text>{t('pages.system.dataQuality.totalRows')}：</Text>
                          <Text strong>{validationReport.total_rows}</Text>
                        </div>
                        <div>
                          <Text>{t('pages.system.dataQuality.validRows')}：</Text>
                          <Text strong style={{ color: '#52c41a' }}>
                            {validationReport.valid_rows}
                          </Text>
                        </div>
                        <div>
                          <Text>{t('pages.system.dataQuality.errorRows')}：</Text>
                          <Text strong style={{ color: '#ff4d4f' }}>
                            {validationReport.error_rows}
                          </Text>
                        </div>
                        <div>
                          <Text>{t('pages.system.dataQuality.warningRows')}：</Text>
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
                      <Text strong>{t('pages.system.dataQuality.issueDetail')}</Text>
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
                <Empty description={t('pages.system.dataQuality.emptyValidate')} />
              </Card>
            ),
          },
          {
            key: 'cleaning',
            label: t('pages.system.dataQuality.tabCleaning'),
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
                        <Text strong>{t('pages.system.dataQuality.affectedRows')}：</Text>
                        <Text>{record.affected_rows.join(', ')}</Text>
                      </div>
                    ),
                  }}
                />
              </Card>
            ) : (
              <Card>
                <Empty description={t('pages.system.dataQuality.emptyCleaning')} />
              </Card>
            ),
          },
          {
            key: 'report',
            label: t('pages.system.dataQuality.tabReport'),
            children: qualityReport ? (
              <Card>
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Text strong>{t('pages.system.dataQuality.qualityMetrics')}</Text>
                    <div style={{ marginTop: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text>{t('pages.system.dataQuality.completeness')}</Text>
                            <Text strong>{qualityReport.completeness}%</Text>
                          </div>
                          <Progress percent={qualityReport.completeness} status="active" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text>{t('pages.system.dataQuality.accuracy')}</Text>
                            <Text strong>{qualityReport.accuracy}%</Text>
                          </div>
                          <Progress percent={qualityReport.accuracy} status="active" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text>{t('pages.system.dataQuality.consistency')}</Text>
                            <Text strong>{qualityReport.consistency}%</Text>
                          </div>
                          <Progress percent={qualityReport.consistency} status="active" />
                        </div>
                      </Space>
                    </div>
                  </div>
                  {qualityReport.issues.length > 0 && (
                    <div>
                      <Text strong>{t('pages.system.dataQuality.issueSummary')}</Text>
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
                      <Text strong>{t('pages.system.dataQuality.cleaningSuggestions')}</Text>
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
                <Empty description={t('pages.system.dataQuality.emptyReport')} />
              </Card>
            ),
          },
        ]}
      />

      <UniImport
        visible={importVisible}
        onCancel={() => setImportVisible(false)}
        onConfirm={handleImportConfirm}
        title={t('pages.system.dataQuality.importModalTitle')}
        headers={headers}
      />
    </div>
  );
};

export default DataQualityPage;
