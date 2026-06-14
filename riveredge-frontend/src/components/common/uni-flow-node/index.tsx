/**
 * UniFlowNode - 统一标准化生产级流程节点
 * 
 * 设计规范：成熟级原生 UI (Enterprise Native Premium)
 * - 遵循 Ant Design 品牌色彩
 * - 结构化的 Header/Body 布局
 * - 精准的物理触感与阴影
 */

import React, { useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { theme, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircleOutlined, 
  PlayCircleOutlined, 
  FlagOutlined, 
  FileTextOutlined,
  ForkOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
const { useToken } = theme;

/** 节点数据接口 */
export interface UniFlowNodeData {
  label?: string;
  description?: string;
  [key: string]: any;
}

/** 节点属性接口 */
export interface UniFlowNodeProps {
  id: string;
  type: string;
  selected?: boolean;
  data: UniFlowNodeData;
}

const UniFlowNode: React.FC<UniFlowNodeProps> = ({ type, data, selected }) => {
  const { token } = useToken();

  const { t } = useTranslation();
  const { color, icon, label } = useMemo(() => {
    switch (type) {
      case 'start': 
        return { color: token.colorSuccess, icon: <PlayCircleOutlined />, label: t('common.start') };
      case 'end': 
        return { color: token.colorError, icon: <FlagOutlined />, label: t('common.end') };
      case 'approval': 
        return { color: token.colorPrimary, icon: <SafetyCertificateOutlined />, label: t('app.master-data.sop.approval') };
      case 'cc': 
        return { color: token.colorInfo, icon: <CheckCircleOutlined />, label: t('app.master-data.sop.cc') };
      case 'condition': 
        return { color: token.colorWarning, icon: <ForkOutlined />, label: t('app.master-data.sop.condition') };
      case 'step':
        return { color: token.colorPrimary, icon: <FileTextOutlined />, label: t('app.master-data.sop.productStep') };
      case 'check':
        return { color: token.colorWarning, icon: <SafetyCertificateOutlined />, label: t('app.master-data.sop.qualityCheck') };
      default: 
        return { color: token.colorTextSecondary, icon: <FileTextOutlined />, label: t('app.master-data.sop.step') };
    }
  }, [type, token, t]);

  const summary = useMemo(() => {
    if (type !== 'approval' && type !== 'cc' && type !== 'condition') return data.description || '';
    const parts: string[] = [];
    if (type === 'approval') {
      parts.push(data.approvalType === 'AND' ? '会签' : '或签');
      if (data.allowEditDuringApproval) parts.push('可改单');
      if (data.approverType === 'department') parts.push('部门负责人');
      else if (data.approverType === 'manager') parts.push('直属主管');
      else if (data.approverType === 'role') parts.push(`角色×${(data.approverIds as string[] | undefined)?.length || 0}`);
      else if (data.approverType === 'user') parts.push(`指定×${(data.approverIds as string[] | undefined)?.length || 0}`);
    }
    if (type === 'cc') parts.push(`抄送×${(data.approverIds as string[] | undefined)?.length || 0}`);
    if (type === 'condition') {
      const n = (data.conditions as unknown[] | undefined)?.length || 0;
      parts.push(n > 0 ? `${n}条分支` : '条件分支');
    }
    return parts.join(' · ') || data.description || '';
  }, [type, data]);

  const isWide = type !== 'start' && type !== 'end';

  return (
    <div style={{ 
      width: isWide ? 220 : 120, 
      position: 'relative',
      filter: selected ? `drop-shadow(0 0 8px ${color}33)` : 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <div style={{
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        border: `1px solid ${selected ? color : token.colorBorderSecondary}`,
        boxShadow: selected ? `0 0 0 2px ${color}22, ${token.boxShadowSecondary}` : token.boxShadowTertiary,
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}>
        {/* Header - 带有色块指示器 */}
        <div style={{
          padding: '8px 12px',
          background: `${color}0a`,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          position: 'relative'
        }}>
          {/* 左侧垂直状态条 */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: '20%',
            bottom: '20%',
            width: 3,
            borderRadius: '0 2px 2px 0',
            background: color,
          }} />
          
          <span style={{ color, fontSize: 16, display: 'flex' }}>{icon}</span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              fontSize: 9, 
              color, 
              fontWeight: 800, 
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
              letterSpacing: '0.1em',
              lineHeight: 1,
              marginBottom: 2
            }}>
              {label}
            </div>
            <Text strong style={{ 
              fontSize: 13, 
              whiteSpace: 'nowrap', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              lineHeight: 1.4
            }}>
              {data.label}
            </Text>
          </div>
        </div>
        
        {/* Body - 描述区域 */}
        {isWide && (
          <div style={{ padding: '8px 12px', minHeight: summary ? 40 : 0 }}>
            {summary ? (
              <div style={{ 
                fontSize: 12, 
                color: token.colorTextDescription,
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {summary}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: token.colorTextPlaceholder, fontStyle: 'italic' }}>
                {t('common.noDescription')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Handles - 连接点优化 */}
      {type !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: color,
            border: `2px solid ${token.colorBgContainer}`,
            width: 10,
            height: 10,
            bottom: -5,
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
      )}
      {type !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: color,
            border: `2px solid ${token.colorBgContainer}`,
            width: 10,
            height: 10,
            top: -5,
            zIndex: 10,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        />
      )}
    </div>
  );
};

export default UniFlowNode;
