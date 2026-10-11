import React from 'react';
import { Result } from 'antd';

/** 行业/定制页未 compose 进工作区时的占位（OSS 构建不静态依赖 pro 包路径）。 */
const DocumentReplacementUnavailable: React.FC = () => (
  <Result status="info" title="页面未装配" subTitle="请在部署环境启用对应行业或定制应用后重试。" />
);

export default DocumentReplacementUnavailable;
