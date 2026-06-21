import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormDigit, ProFormText } from '@ant-design/pro-components';
import { App, Button, Empty, Space, Tag, Typography, theme } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG, TwoColumnLayout } from '../../../../../components/layout-templates';
import { qualityImprovementApi, SPCSample } from '../../../services/quality-improvement';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';
import SpcImrChart from './SpcImrChart';

const SPC_RESOURCE = 'kuaizhizao:quality-management-spc-monitor';

const SPCMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [characteristicName, setCharacteristicName] = useState<string>('');
  const [chartData, setChartData] = useState<any>(null);
  const { canCreate } = useResourcePermissions(SPC_RESOURCE);

  const loadChart = useCallback(async (name: string) => {
    setCharacteristicName(name);
    const chart = await qualityImprovementApi.spc.getImrChart(name, 100);
    setChartData(chart);
  }, []);

  const handleRefreshChart = useCallback(async () => {
    if (!characteristicName) {
      messageApi.warning(t('app.kuaizhizao.quality.spc.selectRowFirst'));
      return;
    }
    const chart = await qualityImprovementApi.spc.getImrChart(characteristicName, 100);
    setChartData(chart);
  }, [characteristicName, messageApi, t]);

  const columns: ProColumns<SPCSample>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.quality.spc.characteristicName'), dataIndex: 'characteristic_name', width: 180 },
      { title: t('app.kuaizhizao.quality.spc.chartType'), dataIndex: 'chart_type', width: 120, valueEnum: { imr: 'I-MR' } },
      { title: t('app.kuaizhizao.quality.spc.sampleValue'), dataIndex: 'sample_value', width: 88, valueType: 'digit' },
      { title: t('app.kuaizhizao.quality.spc.sampleSize'), dataIndex: 'sample_size', width: 72, valueType: 'digit' },
      { title: t('app.kuaizhizao.quality.spc.sampleTime'), dataIndex: 'sample_time', width: 180, valueType: 'dateTime' },
    ],
    [t],
  );

  const chartPanel = chartData ? (
    <Space orientation="vertical" style={{ width: '100%', flex: 1, minHeight: 0 }}>
      <Typography.Text>
        {t('app.kuaizhizao.quality.spc.centerLine', { value: Number(chartData.mean || 0).toFixed(4) })}
      </Typography.Text>
      <Typography.Text>
        {t('app.kuaizhizao.quality.spc.ucl', { value: Number(chartData.ucl || 0).toFixed(4) })}
      </Typography.Text>
      <Typography.Text>
        {t('app.kuaizhizao.quality.spc.lcl', { value: Number(chartData.lcl || 0).toFixed(4) })}
      </Typography.Text>
      <div>
        {(chartData.triggered_summary || []).map((r: string) => (
          <Tag key={r} color="warning">
            {r}
          </Tag>
        ))}
      </div>
      <SpcImrChart
        points={chartData.points || []}
        mean={Number(chartData.mean || 0)}
        ucl={Number(chartData.ucl || 0)}
        lcl={Number(chartData.lcl || 0)}
        height={420}
      />
    </Space>
  ) : (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={t('app.kuaizhizao.quality.spc.chartHint')}
      style={{ marginTop: 80 }}
    />
  );

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-spc-monitor:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.spc.noPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate fillMain>
        <TwoColumnLayout
          style={{ flex: 1, minHeight: 0 }}
          leftPanel={{
            width: '40%',
            leftContent: (
              <div
                style={{
                  padding: 16,
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                }}
              >
                <UniTable<SPCSample>
                headerTitle={t('app.kuaizhizao.quality.spc.pageTitle')}
                actionRef={actionRef}
                rowKey="id"
                columns={columns}
                columnPersistenceId="apps.kuaizhizao.pages.quality-management.spc-monitor"
                toolBarRender={() => [
                  ...(canCreate
                    ? [
                        <Button key="addSample" type="primary" onClick={() => setCreateVisible(true)}>
                          {t('app.kuaizhizao.quality.spc.addSample')}
                        </Button>,
                      ]
                    : []),
                ]}
                request={async (params) => {
                  const pageSize = params.pageSize || 20;
                  const skip = ((params.current || 1) - 1) * pageSize;
                  const rows = await qualityImprovementApi.spc.listSamples({
                    skip,
                    limit: pageSize,
                    characteristic_name: params.characteristic_name,
                  });
                  if (!characteristicName && rows.length > 0) {
                    void loadChart(rows[0].characteristic_name);
                  }
                  return {
                    success: true,
                    data: rows || [],
                    total: rows.length < pageSize ? skip + rows.length : skip + rows.length + 1,
                  };
                }}
                onRow={(record) => ({
                  onClick: () => void loadChart(record.characteristic_name),
                  style: {
                    cursor: 'pointer',
                    ...(record.characteristic_name === characteristicName
                      ? { backgroundColor: token.colorPrimaryBg }
                      : {}),
                  },
                })}
                />
              </div>
            ),
          }}
          rightPanel={{
            header: {
              center: (
                <Typography.Text strong>
                  {t('app.kuaizhizao.quality.spc.chartTitle', { name: characteristicName || '-' })}
                </Typography.Text>
              ),
              right: (
                <Button icon={<ReloadOutlined />} onClick={() => void handleRefreshChart()}>
                  {t('app.kuaizhizao.quality.spc.refreshChart')}
                </Button>
              ),
            },
            content: (
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 480, height: '100%' }}>{chartPanel}</div>
            ),
            contentPadding: 16,
          }}
        />

        <FormModalTemplate
          title={t('app.kuaizhizao.quality.spc.createModalTitle')}
          open={createVisible}
          width={MODAL_CONFIG.SMALL_WIDTH}
          formRef={createFormRef}
          onClose={() => {
            setCreateVisible(false);
            createFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!canCreate) {
              messageApi.error(t('app.kuaizhizao.quality.spc.messages.noCreatePermission'));
              return false;
            }
            await qualityImprovementApi.spc.createSample({
              ...values,
              chart_type: 'imr',
            });
            messageApi.success(t('app.kuaizhizao.quality.spc.messages.saveSuccess'));
            setCreateVisible(false);
            actionRef.current?.reload();
          }}
        >
          <ProFormText name="characteristic_name" label={t('app.kuaizhizao.quality.spc.characteristicName')} rules={[{ required: true }]} />
          <ProFormDigit name="sample_value" label={t('app.kuaizhizao.quality.spc.sampleValue')} rules={[{ required: true }]} />
          <ProFormDigit name="sample_size" label={t('app.kuaizhizao.quality.spc.sampleSize')} initialValue={1} rules={[{ required: true }]} />
          <ProFormDateTimePicker name="sample_time" label={t('app.kuaizhizao.quality.spc.sampleTime')} rules={[{ required: true }]} />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default SPCMonitorPage;
