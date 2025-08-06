/**
 * QuickStart 日志系统主入口
 * 
 * 导出所有日志相关的类型、接口和实现
 */

// 类型定义
export * from './types';
import { LogCategory, LogSource, type LogConfig } from './types';

// 核心实现
export { LogManager } from './LogManager';
export { LogFormatter } from './LogFormatter';
export { LogFileManager } from './LogFileManager';
export { LogAnalyzer } from './LogAnalyzer';
export { I18nLogger } from './I18nLogger';

// 便捷工厂函数
import { LogManager } from './LogManager';
import { I18nLogger } from './I18nLogger';
import { join } from 'path';
import { homedir } from 'os';

/**
 * 创建主进程日志记录器
 */
export function createMainLogger(config?: Partial<LogConfig>): I18nLogger {
  const defaultConfig: Partial<LogConfig> = {
    logDir: join(homedir(), 'AppData', 'Roaming', 'QuickStartAPP', 'logs'),
    enableFile: true,
    enableConsole: true,
    ...config
  };

  const logManager = LogManager.getInstance(LogSource.MAIN, defaultConfig);
  return new I18nLogger(LogSource.MAIN, logManager);
}

/**
 * 创建渲染进程日志记录器
 */
export function createRendererLogger(config?: Partial<LogConfig>): I18nLogger {
  const defaultConfig: Partial<LogConfig> = {
    logDir: join(homedir(), 'AppData', 'Roaming', 'QuickStartAPP', 'logs'),
    enableFile: true,
    enableConsole: true,
    ...config
  };

  const logManager = LogManager.getInstance(LogSource.RENDERER, defaultConfig);
  return new I18nLogger(LogSource.RENDERER, logManager);
}

/**
 * 创建预加载脚本日志记录器
 */
export function createPreloadLogger(config?: Partial<LogConfig>): I18nLogger {
  const defaultConfig: Partial<LogConfig> = {
    logDir: join(homedir(), 'AppData', 'Roaming', 'QuickStartAPP', 'logs'),
    enableFile: true,
    enableConsole: true,
    ...config
  };

  const logManager = LogManager.getInstance(LogSource.PRELOAD, defaultConfig);
  return new I18nLogger(LogSource.PRELOAD, logManager);
}

/**
 * 获取现有的日志记录器实例
 */
export function getLogger(): I18nLogger | null {
  try {
    const logManager = LogManager.getInstance();
    return new I18nLogger(LogSource.MAIN, logManager);
  } catch {
    return null;
  }
}

/**
 * 日志级别常量
 */
export const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
} as const;

/**
 * 日志分类常量
 */
export const LOG_CATEGORIES = {
  APP: 'app',
  CONFIG: 'config',
  DB: 'db',
  FILE: 'file',
  UI: 'ui',
  I18N: 'i18n',
  IPC: 'ipc',
  PERF: 'perf',
  THEME: 'theme',
  BACKUP: 'backup',
} as const;

/**
 * 默认日志配置
 */
export const DEFAULT_LOG_CONFIG: LogConfig = {
  level: 2, // INFO
  enableFile: true,
  enableConsole: true,
  logDir: join(homedir(), 'AppData', 'Roaming', 'QuickStartAPP', 'logs'),
  maxFileSize: 10, // 10MB
  maxFiles: 10,
  retentionDays: 30,
  enableCompression: true,
  bufferSize: 50,
  flushInterval: 2000, // 2秒
};

/**
 * 日志格式示例
 */
export const LOG_FORMAT_EXAMPLES = {
  CHINESE: '[2025-07-05 14:30:25.123] [MAIN     ]  INFO [MAIN:1234] (app:main.ts) - 应用程序启动成功，版本: 1.0.0',
  ENGLISH: '[2025-07-05 14:30:25.123] [MAIN     ]  INFO [MAIN:1234] (app:main.ts) - Application started successfully, version: 1.0.0',
  RUSSIAN: '[2025-07-05 14:30:25.123] [MAIN     ]  INFO [MAIN:1234] (app:main.ts) - Приложение успешно запущено, версия: 1.0.0',
  FRENCH: '[2025-07-05 14:30:25.123] [MAIN     ]  INFO [MAIN:1234] (app:main.ts) - Application démarrée avec succès, version: 1.0.0',
};

/**
 * 性能监控辅助函数
 */
export class PerformanceLogger {
  private logger: I18nLogger;
  private startTimes: Map<string, number> = new Map();

  constructor(logger: I18nLogger) {
    this.logger = logger;
  }

  /**
   * 开始性能计时
   */
  start(operation: string): void {
    this.startTimes.set(operation, Date.now());
  }

  /**
   * 结束性能计时并记录日志
   */
  async end(operation: string, filename: string): Promise<number> {
    const startTime = this.startTimes.get(operation);
    if (!startTime) {
      await this.logger.warn(`性能计时未找到操作: ${operation}`, LogCategory.PERF, filename);
      return 0;
    }

    const duration = Date.now() - startTime;
    const level = duration > 1000 ? 'warn' : 'debug';
    const message = duration > 1000
      ? `操作运行缓慢: ${operation}, 耗时: ${duration}ms`
      : `操作完成: ${operation}, 耗时: ${duration}ms`;

    if (level === 'warn') {
      await this.logger.warn(message, LogCategory.PERF, filename, { operation, duration });
    } else {
      await this.logger.debug(message, LogCategory.PERF, filename, { operation, duration });
    }
    this.startTimes.delete(operation);
    
    return duration;
  }

  /**
   * 测量函数执行时间
   */
  async measure<T>(operation: string, filename: string, fn: () => Promise<T>): Promise<T> {
    this.start(operation);
    try {
      const result = await fn();
      await this.end(operation, filename);
      return result;
    } catch (error) {
      await this.end(operation, filename);
      throw error;
    }
  }
}

/**
 * 创建性能监控器
 */
export function createPerformanceLogger(logger: I18nLogger): PerformanceLogger {
  return new PerformanceLogger(logger);
}

/**
 * 错误日志辅助函数
 */
export class ErrorLogger {
  private logger: I18nLogger;

  constructor(logger: I18nLogger) {
    this.logger = logger;
  }

  /**
   * 记录并抛出错误
   */
  async logAndThrow(error: Error, filename: string, category: LogCategory = LogCategory.APP): Promise<never> {
    await this.logger.error(error.message, category, filename, undefined, error);
    throw error;
  }

  /**
   * 记录错误但不抛出
   */
  async logError(error: Error, filename: string, category: LogCategory = LogCategory.APP): Promise<void> {
    await this.logger.error(error.message, category, filename, undefined, error);
  }

  /**
   * 记录警告
   */
  async logWarning(message: string, filename: string, category: LogCategory = LogCategory.APP, data?: Record<string, unknown>): Promise<void> {
    await this.logger.warn(message, category, filename, data);
  }
}

/**
 * 创建错误日志记录器
 */
export function createErrorLogger(logger: I18nLogger): ErrorLogger {
  return new ErrorLogger(logger);
}
