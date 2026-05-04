import React, { useState } from 'react';
import { PageContainer, ProForm, ProFormSelect, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { Card, message, Tag, Typography, Divider, Row, Col } from 'antd';
import { equipmentApi, equipmentInspectionApi } from '../../../services/equipment';

const { Text, Title } = Typography;

const EquipmentInspectionPage: React.FC = () => {
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);

  const onFinish = async (values: any) => {
    try {
      await equipmentInspectionApi.create({
        ...values,
        equipment_id: selectedEquipment?.id,
      });
      message.success('点检记录提交成功');
      return true;
    } catch (error: any) {
      message.error('提交失败: ' + error.message);
      return false;
    }
  };

  return (
    <PageContainer title="每日点检录入" subTitle="关键设备状态日常点检，发现异常自动报修">
      <Row gutter={24}>
        <Col span={8}>
          <Card title="选择待点检设备">
            <ProFormSelect
              name="equipment"
              label="搜索设备"
              showSearch
              request={async () => {
                const res = await equipmentApi.list({ limit: 100 });
                return res.items.map((item: any) => ({
                  label: `[${item.code}] ${item.name}`,
                  value: item.id,
                  record: item
                }));
              }}
              fieldProps={{
                onChange: (_, option: any) => setSelectedEquipment(option?.record)
              }}
            />
            {selectedEquipment && (
              <div style={{ marginTop: 16 }}>
                 <p>当前状态: <Tag color="blue">{selectedEquipment.status}</Tag></p>
                 <p>上次点检: <Text type="secondary">2026-03-25 (正常)</Text></p>
              </div>
            )}
          </Card>
        </Col>
        <Col span={16}>
          <Card title="点检项目录入">
            <ProForm
              onFinish={onFinish}
              submitter={{
                searchConfig: { submitText: '提交点检结果' }
              }}
              disabled={!selectedEquipment}
            >
              <Title level={5}>基本运行参数</Title>
              <Row gutter={16}>
                <Col span={12}><ProFormSwitch name="p1" label="电源显示正常" initialValue={true} /></Col>
                <Col span={12}><ProFormSwitch name="p2" label="气压/油压在范围" initialValue={true} /></Col>
                <Col span={12}><ProFormSwitch name="p3" label="导轨润滑良好" initialValue={true} /></Col>
                <Col span={12}><ProFormSwitch name="p4" label="安全防护门正常" initialValue={true} /></Col>
              </Row>
              
              <Divider />
              
              <ProFormSwitch 
                name="has_abnormality" 
                label={<Text type="danger" strong>发现异常？(开启将自动触发报修)</Text>} 
              />
              <ProFormTextArea 
                name="abnormality_description" 
                label="异常描述" 
                dependencies={['has_abnormality']}
                hidden={(values: { has_abnormality?: boolean }) => !values?.has_abnormality}
                rules={[{ required: true, message: '请简述异常情况' }]}
              />
              <ProFormTextArea name="remark" label="备注说明" />
            </ProForm>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default EquipmentInspectionPage;
