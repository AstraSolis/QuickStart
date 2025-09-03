/**
 * QuickStart 日志记录器
 *
 * 提供简化的日志记录功能
 */

import { LogManager } from './LogManager';
import { LogCategory, type LogSource } from './types';

/**
 * 日志记录器
 */
export class I18nLogger {
  private logManager: LogManager;

  constructor(source: LogSource, logManager?: LogManager) {
    this.logManager = logManager ?? LogManager.getInstance(source);
  }

  /**
   * 记录应用程序启动成功
   */
  async logAppStartupSuccess(filename: string, version: string): Promise<void> {
    await this.logManager.info(
      `应用程序启动成功，版本: ${version}`,
      LogCategory.APP,
      filename,
      { version }
    );
  }

  /**
   * 记录应用程序启动失败
   */
  async logAppStartupFailed(filename: string, error: Error): Promise<void> {
    await this.logManager.error(
      `应用程序启动失败: ${error.message}`,
      LogCategory.APP,
      filename,
      { error: error.message },
      error
    );
  }

  /**
   * 记录配置加载成功
   */
  async logConfigLoadSuccess(filename: string, configType: string): Promise<void> {
    await this.logManager.info(
      `配置加载成功: ${configType}`,
      LogCategory.CONFIG,
      filename,
      { configType }
    );
  }

  /**
   * 记录配置加载失败
   */
  async logConfigLoadFailed(filename: string, configType: string, error: Error): Promise<void> {
    await this.logManager.error(
      `配置加载失败: ${configType}, 错误: ${error.message}`,
      LogCategory.CONFIG,
      filename,
      { configType, error: error.message },
      error
    );
  }

  /**
   * 记录系统错误
   */
  async logSystemError(filename: string, error: Error): Promise<void> {
    await this.logManager.error(
      `未捕获的异常: ${error.message}`,
      LogCategory.APP,
      filename,
      { error: error.message },
      error
    );
  }

  /**
   * 直接访问底层LogManager的方法
   */
  async trace(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.logManager.trace(message, category, filename, data, error);
  }

  async debug(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.logManager.debug(message, category, filename, data, error);
  }

  async info(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.logManager.info(message, category, filename, data, error);
  }

  async warn(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.logManager.warn(message, category, filename, data, error);
  }

  async error(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.logManager.error(message, category, filename, data, error);
  }

  async fatal(message: string, category: LogCategory, filename: string, data?: Record<string, unknown>, error?: Error): Promise<void> {
    await this.logManager.fatal(message, category, filename, data, error);
  }
}


