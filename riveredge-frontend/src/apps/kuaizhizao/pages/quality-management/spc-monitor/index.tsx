import React, { useMemo, useRef, useState, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProFormDateTimePicker, ProFormDigit, ProFormText } from '@ant-design/pro-components';
import { App, Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, ListPageTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { qualityImprovementApi, SPCSample } from '../../../services/quality-improvement';
import { useGlobalStore } from '../../../../../stores/globalStore';
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
  const { message: messageApi } = App.useApp();
  const currentUser = useGlobalStore((s) => s.currentUser);
  const actionRef = useRef<ActionType>(null);
  const createFormRef = useRef<any>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [characteristicName, setCharacteristicName] = useState<string>('');
  const [chartData, setChartData] = useState<any>(null);
  const { canCreate } = useResourcePermissions(SPC_RESOURCE);

  const columns: ProColumns<SPCSample>[] = [
    { title: '质量特性', dataIndex: 'characteristic_name', width: 180 },
    { title: '控制图类型', dataIndex: 'chart_type', width: 120, valueEnum: { imr: 'I-MR' } },
    { title: '采样值', dataIndex: 'sample_value', width: 120, valueType: 'digit' },
    { title: '样本量', dataIndex: 'sample_size', width: 100, valueType: 'digit' },
    { title: '采样时间', dataIndex: 'sample_time', width: 180, valueType: 'dateTime' },
  ];

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
      fallback={<Empty description="暂无SPC查看权限" style={{ marginTop: 120 }} />}
    >
      <ListPageTemplate>
        <UniTable<SPCSample>
          headerTitle="SPC 监控（I-MR）"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.quality-management.spc-monitor"
          toolBarRender={() => [
            ...(canCreate
              ? [
                  <Button key="addSample" type="primary" onClick={() => setCreateVisible(true)}>
                    新增采样
                  </Button>,
                ]
              : []),
            <Button
              key="refreshChart"
              onClick={async () => {
                if (!characteristicName) {
                  messageApi.warning('请先选择一条数据后再查看控制线');
                  return;
                }
                const chart = await qualityImprovementApi.spc.getImrChart(characteristicName, 100);
                setChartData(chart);
              }}
            >
              刷新控制线
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

        <Card title={`控制图 - ${characteristicName || '-'}`} style={{ marginTop: 16 }}>
          {chartData ? (
            <Space orientation="vertical" style={{ width: '100%' }}>
              <Typography.Text>中心线(CL): {Number(chartData.mean || 0).toFixed(4)}</Typography.Text>
              <Typography.Text>上控制线(UCL): {Number(chartData.ucl || 0).toFixed(4)}</Typography.Text>
              <Typography.Text>下控制线(LCL): {Number(chartData.lcl || 0).toFixed(4)}</Typography.Text>
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
            <Typography.Text type="secondary">点击任一采样记录即可加载该质量特性的 I-MR 控制图。</Typography.Text>
          )}
        </Card>

        <FormModalTemplate
          title="新增 SPC 采样"
          open={createVisible}
          width={MODAL_CONFIG.SMALL_WIDTH}
          formRef={createFormRef}
          onClose={() => {
            setCreateVisible(false);
            createFormRef.current?.resetFields();
          }}
          onFinish={async (values) => {
            if (!canCreate) {
              messageApi.error('无采样新增权限');
              return false;
            }
            await qualityImprovementApi.spc.createSample({
              ...values,
              chart_type: 'imr',
            });
            messageApi.success('采样已保存');
            setCreateVisible(false);
            actionRef.current?.reload();
          }}
        >
          <ProFormText name="characteristic_name" label="质量特性" rules={[{ required: true }]} />
          <ProFormDigit name="sample_value" label="采样值" rules={[{ required: true }]} />
          <ProFormDigit name="sample_size" label="样本量" initialValue={1} rules={[{ required: true }]} />
          <ProFormDateTimePicker name="sample_time" label="采样时间" rules={[{ required: true }]} />
        </FormModalTemplate>
      </ListPageTemplate>
    </PermissionGuard>
  );
};

export default SPCMonitorPage;
