/**
 * 业务蓝图自定义节点 - 使用 CheckCard 显示，无手柄
 *
 * 节点以 CheckCard 形式展示，无连接手柄，单层背景。
 * 右上角角标使用 CheckCard 原生角标：启用时系统色，开启审核时橙色（由父组件 CSS 覆盖）。
 */
import React from 'react';
import { CheckCard } from '@ant-design/pro-components';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

const BusinessBlueprintNode: React.FC<NodeProps> = ({ data }) => {
    const label = data?.label ?? data?.title ?? '';
    const icon = data?.icon;
    const enabled = data?.enabled ?? true;
    const auditRequired = data?.auditRequired ?? false;

    return (
        <div style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
            {/* 隐藏句柄：用于贝塞尔连线锚点，不影响卡片视觉 */}
            <Handle id="target-left" type="target" position={Position.Left} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <Handle id="target-right" type="target" position={Position.Right} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <Handle id="target-top" type="target" position={Position.Top} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <Handle id="target-bottom" type="target" position={Position.Bottom} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <Handle id="source-left" type="source" position={Position.Left} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <Handle id="source-right" type="source" position={Position.Right} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <Handle id="source-top" type="source" position={Position.Top} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ width: 6, height: 6, opacity: 0, pointerEvents: 'none' }} />
            <CheckCard
                className={auditRequired ? 'business-blueprint-node-audit' : undefined}
                title={
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {icon}
                        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                            {label}
                        </span>
                    </span>
                }
                size="small"
                checked={enabled}
                style={{
                    width: 108,
                    minWidth: 108,
                    margin: 0,
                    opacity: enabled ? 1 : 0.6,
                }}
            />
        </div>
    );
};

export default BusinessBlueprintNode;
