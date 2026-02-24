/**
 * 组织选择弹窗组件
 *
 * 当用户属于多个组织时，显示此弹窗供用户选择要进入的组织
 */

import { Modal, List, Typography, Tag } from 'antd';
import { ApartmentOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { LoginResponse } from '../../services/auth';

const { Text } = Typography;

/**
 * 组织信息接口
 */
export interface TenantInfo {
  id: number;
  name: string;
  domain: string;
  status: string;
}

/**
 * 组织选择弹窗组件属性
 */
interface TenantSelectionModalProps {
  /**
   * 是否显示弹窗
   */
  open: boolean;

  /**
   * 组织列表
   */
  tenants: TenantInfo[];

  /**
   * 默认选中的组织 ID
   */
  defaultTenantId?: number;

  /**
   * 选择组织的回调函数
   *
   * @param tenantId - 选中的组织 ID
   */
  onSelect: (tenantId: number) => void;

  /**
   * 关闭弹窗的回调函数
   */
  onCancel: () => void;
}

/**
 * 组织选择弹窗组件
 *
 * 显示用户可访问的组织列表，供用户选择要进入的组织
 */
export default function TenantSelectionModal({
  open,
  tenants,
  defaultTenantId,
  onSelect,
  onCancel,
}: TenantSelectionModalProps) {
  const { t } = useTranslation();

  /**
   * 获取组织状态标签
   *
   * @param status - 组织状态
   * @returns 状态标签
   */
  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; textKey: string }> = {
      active: { color: 'success', textKey: 'components.tenantSelection.statusActive' },
      inactive: { color: 'default', textKey: 'components.tenantSelection.statusInactive' },
      expired: { color: 'error', textKey: 'components.tenantSelection.statusExpired' },
      suspended: { color: 'warning', textKey: 'components.tenantSelection.statusSuspended' },
    };

    const statusInfo = statusMap[status] || { color: 'default', textKey: '' };
    return <Tag color={statusInfo.color}>{statusInfo.textKey ? t(statusInfo.textKey) : status}</Tag>;
  };

  return (
    <Modal
      title={t('components.tenantSelection.title')}
      open={open}
      onCancel={onCancel}
      footer={null}
      size={500}
      closable={false}
      maskClosable={false}
    >
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary">
          {t('components.tenantSelection.hint')}
        </Text>
      </div>

      <List
        dataSource={tenants || []}
        renderItem={(tenant) => (
          <List.Item
            style={{
              cursor: 'pointer',
              padding: '12px 16px',
              borderRadius: '6px',
              transition: 'all 0.3s',
            }}
            onClick={() => onSelect(tenant.id)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <List.Item.Meta
              avatar={<ApartmentOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{tenant.name}</span>
                  {getStatusTag(tenant.status)}
                  {defaultTenantId === tenant.id && (
                    <Tag color="blue" icon={<CheckOutlined />}>
                      {t('components.tenantSelection.default')}
                    </Tag>
                  )}
                </div>
              }
              description={
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('components.tenantSelection.domainLabel')}: {tenant.domain}
                </Text>
              }
            />
          </List.Item>
        )}
      />
    </Modal>
  );
}
