import React from 'react';
import { Spin } from 'antd';
import SpinRingIndicator from './components/spin-ring-indicator/SpinRingIndicator';

/** 全局 Spin 圆环指示器（替代 antd 默认四点旋转） */
export const GLOBAL_SPIN_INDICATOR = <SpinRingIndicator />;

Spin.setDefaultIndicator(GLOBAL_SPIN_INDICATOR);
