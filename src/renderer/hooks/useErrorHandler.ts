/**
 * 通用错误处理Hook
 * 提供统一的错误处理逻辑，减少重复代码
 */

import { useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from '../../hooks/useTranslation';

interface ErrorHandlerOptions {
  showMessage?: boolean;
  logToConsole?: boolean;
  customMessage?: string;
}

interface ErrorInfo {
  error: Error | unknown;
  context?: string;
  operation?: string;
}

export const useErrorHandler = () => {
  const { t } = useTranslation(['common', 'errors']);

  /**
   * 处理错误的通用方法
   */
  const handleError = useCallback((
    errorInfo: ErrorInfo,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showMessage = true,
      logToConsole = true,
      customMessage
    } = options;

    const { error, context = 'Unknown', operation = 'operation' } = errorInfo;

    // 提取错误消息
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // 控制台日志
    if (logToConsole) {
      console.error(`[${context}] ${operation} failed:`, error);
    }

    // 显示用户友好的错误消息
    if (showMessage) {
      const displayMessage = customMessage ||
        t('errors:generic.operationFailed') ||
        `${operation} 操作失败`;

      message.error(displayMessage);
    }

    return {
      success: false,
      error: errorMessage,
      context,
      operation
    };
  }, [t]);

  /**
   * 异步操作错误处理包装器
   */
  const withErrorHandling = useCallback(<T extends any[], R>(
    asyncFn: (...args: T) => Promise<R>,
    context: string,
    operation: string,
    options?: ErrorHandlerOptions
  ) => {
    return async (...args: T): Promise<{ success: boolean; data?: R; error?: string }> => {
      try {
        const result = await asyncFn(...args);
        return { success: true, data: result };
      } catch (error) {
        const errorResult = handleError({ error, context, operation }, options);
        return errorResult;
      }
    };
  }, [handleError]);

  /**
   * 同步操作错误处理包装器
   */
  const withSyncErrorHandling = useCallback(<T extends any[], R>(
    syncFn: (...args: T) => R,
    context: string,
    operation: string,
    options?: ErrorHandlerOptions
  ) => {
    return (...args: T): { success: boolean; data?: R; error?: string } => {
      try {
        const result = syncFn(...args);
        return { success: true, data: result };
      } catch (error) {
        return handleError({ error, context, operation }, options);
      }
    };
  }, [handleError]);

  /**
   * 网络请求错误处理
   */
  const handleNetworkError = useCallback((error: unknown, operation: string) => {
    let errorMessage = t('errors:network.generic');
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = t('errors:network.fetchFailed');
      } else if (error.message.includes('timeout')) {
        errorMessage = t('errors:network.timeout');
      } else if (error.message.includes('network')) {
        errorMessage = t('errors:network.connectionFailed');
      }
    }

    return handleError(
      { error, context: 'Network', operation },
      { customMessage: errorMessage }
    );
  }, [handleError, t]);

  /**
   * 文件操作错误处理
   */
  const handleFileError = useCallback((error: unknown, operation: string, filename?: string) => {
    let errorMessage = t('errors:file.generic');
    
    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        errorMessage = t('errors:file.permissionDenied');
      } else if (error.message.includes('not found')) {
        errorMessage = t('errors:file.notFound') || `文件未找到: ${filename}`;
      } else if (error.message.includes('size')) {
        errorMessage = t('errors:file.sizeTooLarge');
      }
    }

    return handleError(
      { error, context: 'File', operation },
      { customMessage: errorMessage }
    );
  }, [handleError, t]);

  return {
    handleError,
    withErrorHandling,
    withSyncErrorHandling,
    handleNetworkError,
    handleFileError,
  };
};
