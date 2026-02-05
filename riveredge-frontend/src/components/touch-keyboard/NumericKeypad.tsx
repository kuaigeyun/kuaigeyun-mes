/**
 * 触屏数字小键盘组件
 *
 * 专门为触摸屏设计的数字输入键盘，支持整数和小数输入。
 * 包含清除、退格和确认功能。
 *
 * Author: RiverEdge AI
 * Date: 2026-02-05
 */

import React from 'react';
import { Button, Space, Card } from 'antd';
import { DeleteOutlined, CheckOutlined } from '@ant-design/icons';

interface NumericKeypadProps {
  onInput: (value: string) => void;
  onDelete: () => void;
  onClear: () => void;
  onConfirm: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onInput,
  onDelete,
  onClear,
  onConfirm,
  className,
  style,
}) => {
  const keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', 'BS'
  ];

  const renderKey = (key: string) => {
    if (key === 'BS') {
      return (
        <Button
          key={key}
          onClick={onDelete}
          style={keyButtonStyle}
          icon={<DeleteOutlined />}
        />
      );
    }
    
    return (
      <Button
        key={key}
        onClick={() => onInput(key)}
        style={{...keyButtonStyle, fontWeight: 600, fontSize: '24px'}}
      >
        {key}
      </Button>
    );
  };

  const keyButtonStyle: React.CSSProperties = {
    width: '100%',
    height: '60px',
    fontSize: '20px',
  };

  return (
    <div className={className} style={{ width: '100%', maxWidth: '400px', ...style }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr 1fr 1fr', 
        gap: '12px' 
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', gridColumn: '1 / 4' }}>
            {keys.map(key => renderKey(key))}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', gridColumn: '4 / 5' }}>
            <Button 
                onClick={onClear} 
                style={{ ...keyButtonStyle, height: '60px', fontSize: '18px', color: '#ff4d4f', borderColor: '#ff4d4f' }}
            >
                清空
            </Button>
            <Button 
                type="primary" 
                onClick={onConfirm} 
                style={{ ...keyButtonStyle, height: '132px', fontSize: '18px' }}
                icon={<CheckOutlined />}
            >
                确认
            </Button>
        </div>
      </div>
    </div>
  );
};

export default NumericKeypad;
