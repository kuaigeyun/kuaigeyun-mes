import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageContainer, ProForm, ProFormSelect, ProFormTextArea, ProFormSwitch } from '@ant-design/pro-components';
import { Card, message, Tag, Typography, Divider, Row, Col } from 'antd';
import { equipmentApi, equipmentInspectionApi } from '../../../services/equipment';

const { Text, Title } = Typography;

const P = 'app.kuaizhizao.equipmentInspection';

const EquipmentInspectionPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);

  const onFinish = async (values: any) => {
    try {
      await equipmentInspectionApi.create({
        ...values,
        equipment_id: selectedEquipment?.id,
      });
      message.success(t(`${P}.submitSuccess`));
      return true;
    } catch (error: any) {
      message.error(t(`${P}.submitFailed`, { message: error.message }));
      return false;
    }
  };

  return (
    <PageContainer title={t(`${P}.title`)} subTitle={t(`${P}.subTitle`)}>
      <Row gutter={24}>
        <Col span={8}>
          <Card title={t(`${P}.selectEquipmentCard`)}>
            <ProFormSelect
              name="equipment"
              label={t(`${P}.searchEquipment`)}
              showSearch
              request={async () => {
                const res = await equipmentApi.list({ limit: 100 });
                return res.items.map((item: any) => ({
                  label: `[${item.code}] ${item.name}`,
                  value: item.id,
                  record: item,
                }));
              }}
              fieldProps={{
                onChange: (_, option: any) => setSelectedEquipment(option?.record),
              }}
            />
            {selectedEquipment && (
              <div style={{ marginTop: 16 }}>
                <p>
                  {t(`${P}.currentStatus`)}
                  <Tag color="blue">{selectedEquipment.status}</Tag>
                </p>
                <p>
                  {t(`${P}.lastInspection`)}
                  <Text type="secondary">2026-03-25 (正常)</Text>
                </p>
              </div>
            )}
          </Card>
        </Col>
        <Col span={16}>
          <Card title={t(`${P}.entryCard`)}>
            <ProForm
              onFinish={onFinish}
              submitter={{
                searchConfig: { submitText: t(`${P}.submit`) },
              }}
              disabled={!selectedEquipment}
            >
              <Title level={5}>{t(`${P}.basicParams`)}</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <ProFormSwitch name="p1" label={t(`${P}.param.powerNormal`)} initialValue={true} />
                </Col>
                <Col span={12}>
                  <ProFormSwitch name="p2" label={t(`${P}.param.pressureNormal`)} initialValue={true} />
                </Col>
                <Col span={12}>
                  <ProFormSwitch name="p3" label={t(`${P}.param.lubricationGood`)} initialValue={true} />
                </Col>
                <Col span={12}>
                  <ProFormSwitch name="p4" label={t(`${P}.param.safetyDoorNormal`)} initialValue={true} />
                </Col>
              </Row>

              <Divider />

              <ProFormSwitch
                name="has_abnormality"
                label={<Text type="danger" strong>{t(`${P}.hasAbnormality`)}</Text>}
              />
              <ProFormTextArea
                name="abnormality_description"
                label={t(`${P}.abnormalityDescription`)}
                dependencies={['has_abnormality']}
                hidden={(values: { has_abnormality?: boolean }) => !values?.has_abnormality}
                rules={[{ required: true, message: t(`${P}.abnormalityRequired`) }]}
              />
              <ProFormTextArea name="remark" label={t(`${P}.remark`)} />
            </ProForm>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default EquipmentInspectionPage;
