/**
 * 智能错误边界组件
 * 提供优雅的错误处理和用户体验
 */

import React, { Component, type ReactNode } from 'react';
import { Result, Button, Card, Collapse, Space, Typography, Alert } from 'antd';
import { 
  ReloadOutlined, 
  BugOutlined, 
  HomeOutlined,
  CopyOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

interface SmartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  isRecovering: boolean;
}

interface SmartErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  showDetails?: boolean;
  enableRecovery?: boolean;
  level?: 'page' | 'component' | 'critical';
}

export class SmartErrorBoundary extends Component<SmartErrorBoundaryProps, SmartErrorBoundaryState> {
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(props: SmartErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
      isRecovering: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<SmartErrorBoundaryState> {
    // 生成错误ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    this.setState({ errorInfo });

    // 调用外部错误处理器
    this.props.onError?.(error, errorInfo);

    // 发送错误报告到日志系统
    this.reportError(error, errorInfo);

    // 尝试自动恢复（对于非关键错误）
    if (this.props.enableRecovery && this.props.level !== 'critical') {
      this.attemptAutoRecovery();
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  /**
   * 报告错误到日志系统
   */
  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // 构建错误报告
      const errorReport = {
        id: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        level: this.props.level || 'component'
      };

      // 发送到主进程日志系统
      if (window.electronAPI && 'logError' in window.electronAPI) {
        try {
          await (window.electronAPI as any).logError({
            message: `React Error Boundary: ${error.message}`,
            data: errorReport
          });
        } catch (logError) {
          console.error('Failed to send error to main process:', logError);
        }
      }

      console.error('Error Boundary Report:', errorReport);
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  };

  /**
   * 尝试自动恢复
   */
  private attemptAutoRecovery = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount < maxRetries) {
      this.setState({ isRecovering: true });
      
      this.retryTimer = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prevState.retryCount + 1,
          isRecovering: false
        }));
      }, 2000 + this.state.retryCount * 1000); // 递增延迟
    }
  };

  /**
   * 手动重试
   */
  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false
    });
  };

  /**
   * 复制错误信息
   */
  private copyErrorInfo = async () => {
    const { error, errorInfo, errorId } = this.state;
    
    const errorText = `
错误ID: ${errorId}
错误消息: ${error?.message}
错误堆栈: ${error?.stack}
组件堆栈: ${errorInfo?.componentStack}
时间: ${new Date().toISOString()}
    `.trim();

    try {
      await navigator.clipboard.writeText(errorText);
      // 这里可以显示复制成功的提示
    } catch (err) {
      console.error('Failed to copy error info:', err);
    }
  };

  /**
   * 返回首页
   */
  private goHome = () => {
    // 这里可以集成到应用的路由系统
    window.location.reload();
  };

  /**
   * 渲染错误详情
   */
  private renderErrorDetails = () => {
    const { error, errorInfo, errorId } = this.state;
    
    return (
      <Collapse ghost>
        <Panel header="错误详情" key="details">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text strong>错误ID:</Text>
              <Text code copyable>{errorId}</Text>
            </div>
            
            <div>
              <Text strong>错误消息:</Text>
              <Paragraph code>{error?.message}</Paragraph>
            </div>
            
            {error?.stack && (
              <div>
                <Text strong>错误堆栈:</Text>
                <Paragraph code style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                  {error.stack}
                </Paragraph>
              </div>
            )}
            
            {errorInfo?.componentStack && (
              <div>
                <Text strong>组件堆栈:</Text>
                <Paragraph code style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                  {errorInfo.componentStack}
                </Paragraph>
              </div>
            )}
          </Space>
        </Panel>
      </Collapse>
    );
  };

  render() {
    const { children, fallback, showDetails = true, level = 'component' } = this.props;
    const { hasError, error, retryCount, isRecovering } = this.state;

    // 如果正在恢复，显示恢复状态
    if (isRecovering) {
      return (
        <Card style={{ margin: '20px', textAlign: 'center' }}>
          <Space direction="vertical">
            <ReloadOutlined spin style={{ fontSize: '24px', color: '#1890ff' }} />
            <Text>正在尝试恢复...</Text>
            <Text type="secondary">重试次数: {retryCount}</Text>
          </Space>
        </Card>
      );
    }

    // 如果没有错误，正常渲染子组件
    if (!hasError) {
      return children;
    }

    // 如果有自定义fallback，使用它
    if (fallback) {
      return fallback;
    }

    // 根据错误级别选择不同的展示方式
    const getResultStatus = () => {
      switch (level) {
        case 'critical': return '500';
        case 'page': return 'error';
        default: return 'warning';
      }
    };

    const getResultTitle = () => {
      switch (level) {
        case 'critical': return '应用遇到严重错误';
        case 'page': return '页面加载失败';
        default: return '组件渲染错误';
      }
    };

    const getResultSubTitle = () => {
      return error?.message || '发生了未知错误，请尝试刷新页面或联系技术支持';
    };

    return (
      <div style={{ padding: level === 'component' ? '20px' : '40px' }}>
        {retryCount > 0 && (
          <Alert
            message={`已自动重试 ${retryCount} 次`}
            type="warning"
            showIcon
            style={{ marginBottom: '20px' }}
          />
        )}
        
        <Result
          status={getResultStatus()}
          title={getResultTitle()}
          subTitle={getResultSubTitle()}
          icon={level === 'critical' ? <BugOutlined /> : <WarningOutlined />}
          extra={
            <Space>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />} 
                onClick={this.handleRetry}
              >
                重试
              </Button>
              
              {level !== 'component' && (
                <Button 
                  icon={<HomeOutlined />} 
                  onClick={this.goHome}
                >
                  返回首页
                </Button>
              )}
              
              {showDetails && (
                <Button 
                  icon={<CopyOutlined />} 
                  onClick={this.copyErrorInfo}
                >
                  复制错误信息
                </Button>
              )}
            </Space>
          }
        />
        
        {showDetails && this.renderErrorDetails()}
      </div>
    );
  }
}

// 高阶组件包装器
export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<SmartErrorBoundaryProps, 'children'>
) => {
  const WithErrorBoundaryComponent = (props: P) => (
    <SmartErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </SmartErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = 
    `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
};
