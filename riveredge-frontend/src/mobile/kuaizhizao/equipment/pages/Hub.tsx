import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { App, Button, Card, Descriptions, Empty, Space, Spin, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  EditOutlined,
  ToolOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { MobileEquipmentLayout } from '../MobileEquipmentLayout';
import {
  buildMobileEquipmentFaultPath,
  buildMobileEquipmentSpotCheckPath,
  buildMobileEquipmentStatusPath,
} from '../paths';
import { equipmentApi } from '../../../../apps/kuaizhizao/services/equipment';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { touchButtonProps } from '../../../../components/touch-terminal';

interface EquipmentHubDetail {
  uuid?: string;
  code?: string;
  name?: string;
  type?: string;
  equipment_nature?: string;
  workshop_name?: string;
  production_line_name?: string;
  workstation_name?: string;
  status?: string;
  is_active?: boolean;
}

const EQUIPMENT_RESOURCE = 'kuaizhizao:equipment-management-equipment';
const SPOT_CHECK_RESOURCE = 'kuaizhizao:equipment-spot-check';
const FAULT_RESOURCE = 'kuaizhizao:equipment-fault';

const MobileEquipmentHubPage: React.FC = () => {
  const { uuid } = useParams<{ uuid: string }>();
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const equipmentPerms = useResourcePermissions(EQUIPMENT_RESOURCE);
  const spotCheckPerms = useResourcePermissions(SPOT_CHECK_RESOURCE);
  const faultPerms = useResourcePermissions(FAULT_RESOURCE);

  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState<EquipmentHubDetail | null>(null);
  const [traceCounts, setTraceCounts] = useState({ spotChecks: 0, faults: 0, maintenance: 0 });

  const loadData = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const [detail, trace] = await Promise.all([equipmentApi.get(uuid), equipmentApi.getTrace(uuid)]);
      setEquipment(detail);
      setTraceCounts({
        spotChecks: trace?.spot_checks?.length ?? 0,
        faults: (trace?.equipment_faults?.length ?? 0) + (trace?.equipment_repairs?.length ?? 0),
        maintenance:
          (trace?.maintenance_plans?.length ?? 0) + (trace?.maintenance_executions?.length ?? 0),
      });
    } catch (error: unknown) {
      messageApi.error((error as Error)?.message || t('app.kuaizhizao.equipment.getDetailFailed'));
      setEquipment(null);
    } finally {
      setLoading(false);
    }
  }, [uuid, messageApi, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const statusTag = useMemo(() => {
    const statusMap: Record<string, { text: string; color: string }> = {
      正常: { text: t('app.kuaizhizao.equipment.statusNormal'), color: 'success' },
      维修中: { text: t('app.kuaizhizao.equipment.statusRepairing'), color: 'warning' },
      停用: { text: t('app.kuaizhizao.equipment.statusDisabled'), color: 'default' },
      报废: { text: t('app.kuaizhizao.equipment.statusScrapped'), color: 'error' },
    };
    const mapped = statusMap[equipment?.status ?? ''] ?? {
      text: equipment?.status ?? '-',
      color: 'default',
    };
    return <Tag color={mapped.color}>{mapped.text}</Tag>;
  }, [equipment?.status, t]);

  if (!uuid) {
    return (
      <MobileEquipmentLayout title={t('app.kuaizhizao.mobileEquipment.hubTitle')}>
        <Empty description={t('app.kuaizhizao.equipment.uuidNotFound')} />
      </MobileEquipmentLayout>
    );
  }

  return (
    <MobileEquipmentLayout title={equipment?.name || t('app.kuaizhizao.mobileEquipment.hubTitle')}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : !equipment ? (
        <Empty description={t('app.kuaizhizao.equipment.getDetailFailed')} />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {equipment.code} · {equipment.name}
            </Typography.Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('app.kuaizhizao.equipment.colType')}>
                {equipment.type ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.equipment.colEquipmentNature')}>
                {equipment.equipment_nature ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.equipment.colWorkshop')}>
                {equipment.workshop_name ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.equipment.colProductionLine')}>
                {equipment.production_line_name ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.equipment.colWorkstation')}>
                {equipment.workstation_name ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('common.status')}>{statusTag}</Descriptions.Item>
              <Descriptions.Item label={t('app.kuaizhizao.equipment.colIsActive')}>
                {equipment.is_active ? t('common.enabled') : t('common.disabled')}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title={t('app.kuaizhizao.mobileEquipment.recentRecords')} size="small">
            <Space wrap>
              <Tag icon={<HistoryOutlined />}>
                {t('app.kuaizhizao.mobileEquipment.spotCheckCount', { count: traceCounts.spotChecks })}
              </Tag>
              <Tag icon={<ToolOutlined />}>
                {t('app.kuaizhizao.mobileEquipment.faultCount', { count: traceCounts.faults })}
              </Tag>
              <Tag icon={<CheckCircleOutlined />}>
                {t('app.kuaizhizao.mobileEquipment.maintenanceCount', { count: traceCounts.maintenance })}
              </Tag>
            </Space>
          </Card>

          <Card title={t('app.kuaizhizao.mobileEquipment.actions')} size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              {spotCheckPerms.canCreate ? (
                <Button
                  {...touchButtonProps}
                  type="primary"
                  block
                  size="large"
                  icon={<CheckCircleOutlined />}
                  onClick={() => navigate(buildMobileEquipmentSpotCheckPath(uuid))}
                >
                  {t('app.kuaizhizao.mobileEquipment.actionSpotCheck')}
                </Button>
              ) : null}
              {faultPerms.canCreate ? (
                <Button
                  {...touchButtonProps}
                  block
                  size="large"
                  icon={<ToolOutlined />}
                  onClick={() => navigate(buildMobileEquipmentFaultPath(uuid))}
                >
                  {t('app.kuaizhizao.mobileEquipment.actionReportFault')}
                </Button>
              ) : null}
              {equipmentPerms.canUpdate ? (
                <Button
                  {...touchButtonProps}
                  block
                  size="large"
                  icon={<EditOutlined />}
                  onClick={() => navigate(buildMobileEquipmentStatusPath(uuid))}
                >
                  {t('app.kuaizhizao.mobileEquipment.actionChangeStatus')}
                </Button>
              ) : null}
              {!spotCheckPerms.canCreate && !faultPerms.canCreate && !equipmentPerms.canUpdate ? (
                <Typography.Text type="secondary">
                  {t('app.kuaizhizao.mobileEquipment.noActionsPermitted')}
                </Typography.Text>
              ) : null}
            </Space>
          </Card>
        </Space>
      )}
    </MobileEquipmentLayout>
  );
};

export default MobileEquipmentHubPage;
