/**
 * QuickStart 渲染进程日志记录器
 *
 * 集成i18next系统，提供多语言日志记录功能
 */

import { LogCategory } from '../../shared/logger';
import i18n from '../i18n';

// 简化的渲染进程日志记录器 (避免Node.js依赖)
const logger = {
  setI18nFunction: (_fn: unknown) => {
    // 在渲染进程中，我们直接使用console输出
  },
  setLanguage: (_lang: unknown) => {
    // 在渲染进程中，语言由i18n系统管理
  },
  info: async (message: string, category: string, filename: string, data?: unknown) => {
    console.info(`[${category}:${filename}] ${message}`, data);
  },
  error: async (message: string, category: string, filename: string, data?: unknown, error?: Error) => {
    console.error(`[${category}:${filename}] ${message}`, data, error);
  },
  warn: async (message: string, category: string, filename: string, data?: unknown) => {
    console.warn(`[${category}:${filename}] ${message}`, data);
  },
  debug: async (message: string, category: string, filename: string, data?: unknown) => {
    console.debug(`[${category}:${filename}] ${message}`, data);
  },
  logComponentRendered: async (filename: string, component: string, duration: number) => {
    // 使用渲染进程的i18n实例翻译组件渲染日志消息
    const message = i18n.t('logs.ui.component.rendered', `Component {{component}} rendered in {{duration}}ms`, { component, duration });
    console.debug(`[UI:${filename}] ${message}`);
  },
  logThemeChanged: async (filename: string, theme: string) => {
    // 使用渲染进程的i18n实例翻译主题切换日志消息
    const message = i18n.t('logs.theme.changed', `Theme changed to: {{theme}}`, { theme });
    console.info(`[THEME:${filename}] ${message}`);
  },
  logLanguageChanged: async (filename: string, from: string, to: string) => {
    // 使用渲染进程的i18n实例翻译语言切换日志消息
    const message = i18n.t('logs.i18n.language.changed', `Language changed: {{from}} -> {{to}}`, { from, to });
    console.info(`[I18N:${filename}] ${message}`);
  },
  logPerformanceMetric: async (filename: string, operation: string, duration: number) => {
    const level = duration > 1000 ? 'warn' : 'debug';
    console[level](`[PERF:${filename}] ${operation}: ${duration}ms`);
  },
};

// 渲染进程使用简化的日志记录，避免循环依赖

/**
 * 渲染进程日志记录器实例
 */
export const rendererLogger = logger;

/**
 * 便捷的日志记录函数
 */
export const logUtils = {
  /**
   * 记录组件挂载
   */
  async logComponentMounted(componentName: string, filename: string): Promise<void> {
    // 使用渲染进程的i18n实例翻译组件挂载日志消息
    const message = i18n.t('logs.ui.component.mounted', { component: componentName });
    await logger.info(message, LogCategory.UI, filename);
  },

  /**
   * 记录组件卸载
   */
  async logComponentUnmounted(componentName: string, filename: string): Promise<void> {
    // 使用渲染进程的i18n实例翻译组件卸载日志消息
    const message = i18n.t('logs.ui.component.unmounted', { component: componentName });
    await logger.info(message, LogCategory.UI, filename);
  },

  /**
   * 记录组件渲染性能
   */
  async logComponentRenderTime(componentName: string, filename: string, duration: number): Promise<void> {
    await logger.logComponentRendered(filename, componentName, duration);
  },

  /**
   * 记录用户操作
   */
  async logUserAction(action: string, filename: string, data?: Record<string, unknown>): Promise<void> {
    // 使用渲染进程的i18n实例翻译用户操作日志消息
    const message = i18n.t('logs.ui.user.action', { action });
    await logger.info(message, LogCategory.UI, filename, data);
  },

  /**
   * 记录页面导航
   */
  async logNavigation(from: string, to: string, filename: string): Promise<void> {
    // 使用渲染进程的i18n实例翻译页面导航日志消息
    const message = i18n.t('logs.ui.navigation.changed', { from, to });
    await logger.info(message, LogCategory.UI, filename, { from, to });
  },

  /**
   * 记录主题切换
   */
  async logThemeChange(theme: string, filename: string): Promise<void> {
    await logger.logThemeChanged(filename, theme);
  },

  /**
   * 记录语言切换
   */
  async logLanguageChange(from: string, to: string, filename: string): Promise<void> {
    await logger.logLanguageChanged(filename, from, to);
  },

  /**
   * 记录文件操作
   */
  async logFileOperation(operation: string, filename: string, targetFile: string, success: boolean, error?: Error): Promise<void> {
    if (success) {
      // 使用渲染进程的i18n实例翻译文件操作成功日志消息
      const message = i18n.t('logs.file.operation.success', { operation, file: targetFile });
      await logger.info(message, LogCategory.FILE, filename);
    } else {
      // 使用渲染进程的i18n实例翻译文件操作失败日志消息
      const message = i18n.t('logs.file.operation.failed', { operation, file: targetFile });
      await logger.error(message, LogCategory.FILE, filename, undefined, error);
    }
  },

  /**
   * 记录配置变更
   */
  async logConfigChange(configType: string, filename: string, changes?: Record<string, unknown>): Promise<void> {
    // 使用渲染进程的i18n实例翻译配置变更日志消息
    const message = i18n.t('logs.config.changed', { configType });
    await logger.info(message, LogCategory.CONFIG, filename, changes);
  },

  /**
   * 记录API调用
   */
  async logApiCall(api: string, filename: string, duration: number, success: boolean, error?: Error): Promise<void> {
    if (success) {
      // 使用渲染进程的i18n实例翻译API调用成功日志消息
      const message = i18n.t('logs.ipc.api.success', { api, duration });
      await logger.debug(message, LogCategory.IPC, filename);
    } else {
      // 使用渲染进程的i18n实例翻译API调用失败日志消息
      const message = i18n.t('logs.ipc.api.failed', { api });
      await logger.error(message, LogCategory.IPC, filename, { duration }, error);
    }
  },

  /**
   * 记录错误
   */
  async logError(error: Error, filename: string, category: LogCategory = LogCategory.UI, context?: Record<string, unknown>): Promise<void> {
    await logger.error(error.message, category, filename, context, error);
  },

  /**
   * 记录警告
   */
  async logWarning(message: string, filename: string, category: LogCategory = LogCategory.UI, context?: Record<string, unknown>): Promise<void> {
    await logger.warn(message, category, filename, context);
  },

  /**
   * 记录调试信息
   */
  async logDebug(message: string, filename: string, category: LogCategory = LogCategory.UI, context?: Record<string, unknown>): Promise<void> {
    await logger.debug(message, category, filename, context);
  },

  /**
   * 记录信息
   */
  async logInfo(message: string, filename: string, category: LogCategory = LogCategory.UI, context?: Record<string, unknown>): Promise<void> {
    await logger.info(message, category, filename, context);
  },
};

/**
 * React Hook for logging
 */
export function useLogger() {
  return {
    logger: rendererLogger,
    ...logUtils,
  };
}

/**
 * 性能监控装饰器
 */
export function withPerformanceLogging<T extends (...args: unknown[]) => unknown>(
  fn: T,
  operationName: string,
  filename: string,
  category: LogCategory = LogCategory.PERF
): T {
  return ((...args: unknown[]) => {
    const startTime = Date.now();
    
    try {
      const result = fn(...args);
      
      // 如果是Promise，等待完成后记录
      if (result && typeof (result as Record<string, unknown>).then === 'function') {
        return (result as Promise<unknown>)
          .then((value: unknown) => {
            const duration = Date.now() - startTime;
            logUtils.logInfo(`${operationName} completed in ${duration}ms`, filename, category).catch(console.error);
            return value;
          })
          .catch((error: unknown) => {
            const duration = Date.now() - startTime;
            const errorObj = error instanceof Error ? error : new Error(String(error));
            logUtils.logError(errorObj, filename, category, { operation: operationName, duration }).catch(console.error);
            throw error;
          });
      } else {
        // 同步函数
        const duration = Date.now() - startTime;
        logUtils.logInfo(`${operationName} completed in ${duration}ms`, filename, category).catch(console.error);
        return result;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logUtils.logError(error as Error, filename, category, { operation: operationName, duration }).catch(console.error);
      throw error;
    }
  }) as T;
}

/**
 * 组件性能监控Hook
 */
export function useComponentPerformance(componentName: string, filename: string) {
  const startTime = React.useRef<number>(Date.now());
  
  React.useEffect(() => {
    // 组件挂载
    logUtils.logComponentMounted(componentName, filename).catch(console.error);
    
    return () => {
      // 组件卸载
      logUtils.logComponentUnmounted(componentName, filename).catch(console.error);
    };
  }, [componentName, filename]);
  
  React.useEffect(() => {
    // 记录渲染时间
    const renderTime = Date.now() - startTime.current;
    if (renderTime > 100) { // 只记录超过100ms的渲染
      logUtils.logComponentRenderTime(componentName, filename, renderTime).catch(console.error);
    }
  });
  
  return {
    markRenderStart: () => {
      startTime.current = Date.now();
    },
    markRenderEnd: () => {
      const renderTime = Date.now() - startTime.current;
      logUtils.logComponentRenderTime(componentName, filename, renderTime).catch(console.error);
      return renderTime;
    },
  };
}

// 导出React引用（如果需要）
import React from 'react';

export default rendererLogger;
