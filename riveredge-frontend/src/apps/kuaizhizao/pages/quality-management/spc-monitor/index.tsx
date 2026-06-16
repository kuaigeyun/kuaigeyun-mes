import React, { useMemo, useRef, useState, Suspense, lazy } from 'react';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormDigit, ProFormText } from '@ant-design/pro-components';
import { App, Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { qualityImprovementApi, SPCSample } from '../../../services/quality-improvement';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

const SPC_RESOURCE = 'kuaizhizao:quality-management-spc-monitor';
import PermissionGuard from '../../../../../components/permission/PermissionGuard';

const SpcLineChart = lazy(async () => {
  const { Line } = await import('@ant-design/charts');
  return {
    default: (props: React.ComponentProps<typeof Line>) => <Line {...props} />,
  };
});

const SPCMonitorPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [characteristicName, setCharacteristicName] = useState<string>('');
  const [chartData, setChartData] = useState<any>(null);
  const { canCreate } = useResourcePermissions(SPC_RESOURCE);

  const columns: ProColumns<SPCSample>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.quality.spc.characteristicName'), dataIndex: 'characteristic_name', width: 180 },
      { title: t('app.kuaizhizao.quality.spc.chartType'), dataIndex: 'chart_type', width: 120, valueEnum: { imr: 'I-MR' } },
      { title: t('app.kuaizhizao.quality.spc.sampleValue'), dataIndex: 'sample_value', width: 120, valueType: 'digit' },
      { title: t('app.kuaizhizao.quality.spc.sampleSize'), dataIndex: 'sample_size', width: 100, valueType: 'digit' },
      { title: t('app.kuaizhizao.quality.spc.sampleTime'), dataIndex: 'sample_time', width: 180, valueType: 'dateTime' },
    ],
    [t],
  );

  const lineChartConfig = useMemo(() => {
    const points = chartData?.points || [];
    const data = points.map((p: any, idx: number) => ({
      index: idx + 1,
      value: Number(p.sample_value),
      out_of_control: p.out_of_control,
    }));
    return {
      data: data.length ? data : [{ index: 0, value: 0 }],
      xField: 'index',
      yField: 'value',
      smooth: true,
      animation: false,
      point: { size: 4 },
      annotations: chartData
        ? [
            { type: 'line', start: ['min', chartData.mean], end: ['max', chartData.mean], style: { stroke: '#52c41a' } },
            { type: 'line', start: ['min', chartData.ucl], end: ['max', chartData.ucl], style: { stroke: '#f5222d', lineDash: [4, 4] } },
            { type: 'line', start: ['min', chartData.lcl], end: ['max', chartData.lcl], style: { stroke: '#f5222d', lineDash: [4, 4] } },
          ]
        : [],
    };
  }, [chartData]);

  return (
    <PermissionGuard
      permission="kuaizhizao:quality-management-spc-monitor:read"
      fallback={<Empty description={t('app.kuaizhizao.quality.spc.noPermission')} style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
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
            <Button
              key="refreshChart"
              onClick={async () => {
                if (!characteristicName) {
                  messageApi.warning(t('app.kuaizhizao.quality.spc.selectRowFirst'));
                  return;
                }
                const chart = await qualityImprovementApi.spc.getImrChart(characteristicName, 100);
                setChartData(chart);
              }}
            >
              {t('app.kuaizhizao.quality.spc.refreshChart')}
            </Button>,
          ]}
          request={async (params) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const rows = await qualityImprovementApi.spc.listSamples({
              skip,
              limit: pageSize,
              characteristic_name: params.characteristic_name,
            });
            if (!characteristicName && rows.length > 0) setCharacteristicName(rows[0].characteristic_name);
            return {
              success: true,
              data: rows || [],
              total: rows.length < pageSize ? skip + rows.length : skip + rows.length + 1,
            };
          }}
          onRow={(record) => ({
            onClick: async () => {
              setCharacteristicName(record.characteristic_name);
              const chart = await qualityImprovementApi.spc.getImrChart(record.characteristic_name, 100);
              setChartData(chart);
            },
          })}
        />

        <Card title={t('app.kuaizhizao.quality.spc.chartTitle', { name: characteristicName || '-' })} style={{ marginTop: 16 }}>
          {chartData ? (
            <Space orientation="vertical" style={{ width: '100%' }}>
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
              <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
                <SpcLineChart {...lineChartConfig} height={280} />
              </Suspense>
            </Space>
          ) : (
            <Typography.Text type="secondary">{t('app.kuaizhizao.quality.spc.chartHint')}</Typography.Text>
          )}
        </Card>

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
