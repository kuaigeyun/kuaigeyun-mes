/**
 * 错误边界组件
 * 
 * 捕获 React 组件树中的错误，提供错误恢复机制
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Space } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';

/**
 * 错误边界属性
 */
interface ErrorBoundaryProps {
  /**
   * 子组件
   */
  children: ReactNode;
  /**
   * 错误回调
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * 自定义错误页面
   */
  fallback?: ReactNode;
}

/**
 * 错误边界状态
 */
interface ErrorBoundaryState {
  /**
   * 是否有错误
   */
  hasError: boolean;
  /**
   * 错误对象
   */
  error: Error | null;
  /**
   * 错误信息
   */
  errorInfo: ErrorInfo | null;
}

/**
 * 错误边界组件
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误日志
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // 调用错误回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 可以在这里发送错误报告到服务器
    // this.reportError(error, errorInfo);
  }

  handleReload = () => {
    // 重新加载页面
    window.location.reload();
  };

  handleGoHome = () => {
    // 返回首页
    window.location.href = '/';
  };

  handleReset = () => {
    // 重置错误状态
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // 如果有自定义错误页面，使用自定义页面
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误页面
      return (
        <Result
          status="error"
          title="页面出现错误"
          subTitle={this.state.error?.message || '发生了未知错误，请尝试刷新页面或返回首页'}
          extra={[
            <Button
              key="reload"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={this.handleReload}
            >
              刷新页面
            </Button>,
            <Button
              key="home"
              icon={<HomeOutlined />}
              onClick={this.handleGoHome}
            >
              返回首页
            </Button>,
            <Button
              key="retry"
              onClick={this.handleReset}
            >
              重试
            </Button>,
          ]}
        >
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <div style={{ marginTop: 24, textAlign: 'left' }}>
              <details style={{ whiteSpace: 'pre-wrap' }}>
                <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
                  <strong>错误详情（开发模式）</strong>
                </summary>
                <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>
                  {this.state.error?.stack}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            </div>
          )}
        </Result>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

