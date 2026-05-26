import React from 'react';
import { Result, Button, Card, Typography, Space } from 'antd';
import { ThunderboltOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

/**
 * kuaiiot (快数采) 占位页面
 */
const KuaiIotApp: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Card style={{ borderRadius: 12, overflow: 'hidden' }}>
        <Result
          icon={<ThunderboltOutlined style={{ color: '#13c2c2', fontSize: 64 }} />}
          title={
            <Space orientation="vertical" size={0}>
              <Title level={2}>kuaiiot | 快数采</Title>
              <Text type="secondary">工业物联网数据采集与集成平台</Text>
            </Space>
          }
          subTitle={
            <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'left' }}>
              <Paragraph>
                快数采是一个专业的工业物联网（IIoT）平台，旨在连接生产现场的各类设备、传感器和系统，实现数据的实时采集、处理和分发。
              </Paragraph>
              <Paragraph strong>核心特性：</Paragraph>
              <ul>
                <li>支持主流工业协议（Modbus, OPC UA, MQTT, S7 等）</li>
                <li>高并发边缘计算引擎</li>
                <li>可视化数采链路管理</li>
                <li>无缝对接 ERP/MES/BI 系统</li>
              </ul>
              <Text type="warning">
                <RocketOutlined /> 该应用正在加紧研发中，敬请期待！
              </Text>
            </div>
          }
          extra={[
            <Button type="primary" key="back" onClick={() => window.history.back()}>
              返回
            </Button>,
            <Button key="docs">查看产品规划</Button>
          ]}
        />
      </Card>
    </div>
  );
};

export default KuaiIotApp;
