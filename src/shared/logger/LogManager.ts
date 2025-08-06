/**
 * QuickStart 核心日志管理器
 * 
 * 统一的日志记录接口，支持多进程、国际化、文件管理等功能
 */

import { EventEmitter } from 'events';
import {
  LogLevel,
  LogSource,
  type LogEntry,
  type LogCategory,
  type ProcessInfo,
  type LogConfig,
  type ILogger,
  type SupportedLanguage
} from './types';
import { LogFormatter } from './LogFormatter';
import { LogFileManager } from './LogFileManager';

/**
 * 默认日志配置
 */
const DEFAULT_CONFIG: LogConfig = {
  level: LogLevel.INFO,
  enableFile: true,
  enableConsole: true,
  logDir: '',
  maxFileSize: 10, // 10MB
  maxFiles: 10,
  retentionDays: 30,
  enableCompression: true,
  bufferSize: 50,
  flushInterval: 2000, // 2秒
};

/**
 * 核心日志管理器
 */
export class LogManager extends EventEmitter implements ILogger {
  private static instance: LogManager;
  
  private readonly config: LogConfig;
  private readonly formatter: LogFormatter;
  private readonly fileManager: LogFileManager;
  private readonly source: LogSource;
  private readonly processInfo: ProcessInfo;
  
  private sessionId: string;
  private transactionCounter: number = 0;

  constructor(source: LogSource, config: Partial<LogConfig> = {}) {
    super();
    
    this.source = source;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.formatter = new LogFormatter();
    this.fileManager = new LogFileManager(this.config);
    this.processInfo = this.getProcessInfo();
    this.sessionId = this.generateSessionId();
    
    // 设置事件监听器的最大数量
    this.setMaxListeners(50);
  }

  /**
   * 获取单例实例
   */
  static getInstance(source?: LogSource, config?: Partial<LogConfig>): LogManager {
    if (!LogManager.instance) {
      if (!source) {
        throw new Error('首次初始化LogManager时需要提供source参数');
      }
      LogManager.instance = new LogManager(source, config);
    }
    return LogManager.instance;
  }



  /**
   * 记录TRACE级别日志
   */
  async trace(
    message: string, 
    category: LogCategory, 
    filename: string, 
    data?: Record<string, unknown>, 
    error?: Error
  ): Promise<void> {
    await this.log(LogLevel.TRACE, message, category, filename, data, error);
  }

  /**
   * 记录DEBUG级别日志
   */
  async debug(
    message: string, 
    category: LogCategory, 
    filename: string, 
    data?: Record<string, unknown>, 
    error?: Error
  ): Promise<void> {
    await this.log(LogLevel.DEBUG, message, category, filename, data, error);
  }

  /**
   * 记录INFO级别日志
   */
  async info(
    message: string, 
    category: LogCategory, 
    filename: string, 
    data?: Record<string, unknown>, 
    error?: Error
  ): Promise<void> {
    await this.log(LogLevel.INFO, message, category, filename, data, error);
  }

  /**
   * 记录WARN级别日志
   */
  async warn(
    message: string, 
    category: LogCategory, 
    filename: string, 
    data?: Record<string, unknown>, 
    error?: Error
  ): Promise<void> {
    await this.log(LogLevel.WARN, message, category, filename, data, error);
  }

  /**
   * 记录ERROR级别日志
   */
  async error(
    message: string, 
    category: LogCategory, 
    filename: string, 
    data?: Record<string, unknown>, 
    error?: Error
  ): Promise<void> {
    await this.log(LogLevel.ERROR, message, category, filename, data, error);
  }

  /**
   * 记录FATAL级别日志
   */
  async fatal(
    message: string, 
    category: LogCategory, 
    filename: string, 
    data?: Record<string, unknown>, 
    error?: Error
  ): Promise<void> {
    await this.log(LogLevel.FATAL, message, category, filename, data, error);
  }



  /**
   * 核心日志记录方法
   */
  private async log(
    level: LogLevel,
    message: string,
    category: LogCategory,
    filename: string,
    data?: Record<string, unknown>,
    error?: Error
  ): Promise<void> {
    // 检查日志级别
    if (level < this.config.level) {
      return;
    }

    try {
      // 创建日志条目
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        source: this.source,
        level,
        process: this.processInfo,
        module: { category, filename },
        message,
        transactionId: this.generateTransactionId(),
        data,
        error,
        sessionId: this.sessionId,
      };

      // 格式化日志
      const formatted = this.formatter.format(entry, {
        colors: this.config.enableConsole && process.stdout.isTTY,
        includeStack: level >= LogLevel.ERROR,
      });

      // 输出到控制台
      if (this.config.enableConsole) {
        this.outputToConsole(level, formatted);
      }

      // 写入文件
      if (this.config.enableFile) {
        await this.fileManager.writeLog(entry, formatted);
      }

      // 发出事件
      this.emit('log', entry);
    } catch (err) {
      // 日志系统本身的错误不应影响应用运行
      console.error('LogManager内部错误:', err);
      this.emit('error', err as Error);
    }
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(level: LogLevel, formatted: string): void {
    // 在Windows平台上，尝试使用process.stdout.write来确保UTF-8编码
    if (process.platform === 'win32') {
      const output = `${formatted}\n`;
      try {
        switch (level) {
          case LogLevel.TRACE:
          case LogLevel.DEBUG:
          case LogLevel.INFO:
            process.stdout.write(output, 'utf8');
            break;
          case LogLevel.WARN:
          case LogLevel.ERROR:
          case LogLevel.FATAL:
            process.stderr.write(output, 'utf8');
            break;
        }
      } catch {
        // 如果直接写入失败，回退到console方法
        this.fallbackConsoleOutput(level, formatted);
      }
    } else {
      // 非Windows平台使用标准console方法
      this.fallbackConsoleOutput(level, formatted);
    }
  }

  /**
   * 回退的控制台输出方法
   */
  private fallbackConsoleOutput(level: LogLevel, formatted: string): void {
    switch (level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  /**
   * 获取进程信息
   */
  private getProcessInfo(): ProcessInfo {
    return {
      type: this.source === LogSource.MAIN ? 'MAIN' : 
            this.source === LogSource.RENDERER ? 'RENDERER' : 'WORKER',
      pid: process.pid,
    };
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成事务ID
   */
  private generateTransactionId(): string {
    return `${this.sessionId}-${++this.transactionCounter}`;
  }

  /**
   * 获取日志统计信息
   */
  async getStats(): Promise<{ files: { totalSize: number; fileCount: number } }> {
    const fileStats = await this.fileManager.getLogStats();
    return { files: fileStats };
  }

  /**
   * 清理过期日志
   */
  async cleanup(): Promise<void> {
    await this.fileManager.cleanupOldLogs();
  }

  /**
   * 销毁日志管理器
   */
  async destroy(): Promise<void> {
    await this.fileManager.destroy();
    this.removeAllListeners();
  }
}
