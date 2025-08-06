/**
 * QuickStart 日志配置管理器
 * 
 * 管理日志系统的配置，支持动态配置更新和持久化
 */

import * as fs from 'fs';
import * as path from 'path';
import { LogLevel, type LogConfig } from './types';

/**
 * 日志配置管理器
 */
export class LogConfigManager {
  private config: LogConfig;
  private configPath: string;
  private watchers: ((config: LogConfig) => void)[] = [];

  constructor(configPath: string, defaultConfig: LogConfig) {
    this.configPath = configPath;
    this.config = { ...defaultConfig };
    this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // 合并配置，确保所有必需字段都存在
        this.config = {
          ...this.config,
          ...loadedConfig
        };
        
        console.log(`Log config loaded from: ${this.configPath}`);
      } else {
        // 配置文件不存在，创建默认配置
        this.saveConfig();
        console.log(`Created default log config at: ${this.configPath}`);
      }
    } catch (error) {
      console.error('Failed to load log config:', error);
      // 使用默认配置
    }
  }

  /**
   * 保存配置文件
   */
  private saveConfig(): void {
    try {
      // 确保目录存在
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // 保存配置
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf8');
      
      console.log(`Log config saved to: ${this.configPath}`);
    } catch (error) {
      console.error('Failed to save log config:', error);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig(): LogConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<LogConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...updates };
    
    // 验证配置
    this.validateConfig();
    
    // 保存配置
    this.saveConfig();
    
    // 通知监听器
    this.notifyWatchers();
    
    // 使用英文日志消息，因为这是系统级配置更新
    console.log('Log config updated:', {
      old: oldConfig,
      new: this.config,
      changes: updates
    });
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    // 验证日志级别
    if (this.config.level < LogLevel.TRACE || this.config.level > LogLevel.FATAL) {
      console.warn(`Invalid log level: ${this.config.level}, using INFO`);
      this.config.level = LogLevel.INFO;
    }

    // 验证文件大小
    if (this.config.maxFileSize <= 0) {
      console.warn(`Invalid max file size: ${this.config.maxFileSize}, using 10MB`);
      this.config.maxFileSize = 10;
    }

    // 验证文件数量
    if (this.config.maxFiles <= 0) {
      console.warn(`Invalid max files: ${this.config.maxFiles}, using 10`);
      this.config.maxFiles = 10;
    }

    // 验证保留天数
    if (this.config.retentionDays <= 0) {
      console.warn(`Invalid retention days: ${this.config.retentionDays}, using 30`);
      this.config.retentionDays = 30;
    }

    // 验证缓冲区大小
    if (this.config.bufferSize <= 0) {
      console.warn(`Invalid buffer size: ${this.config.bufferSize}, using 50`);
      this.config.bufferSize = 50;
    }

    // 验证刷新间隔
    if (this.config.flushInterval <= 0) {
      console.warn(`Invalid flush interval: ${this.config.flushInterval}, using 2000ms`);
      this.config.flushInterval = 2000;
    }

    // 验证日志目录
    if (!this.config.logDir) {
      console.warn('Log directory not specified, using default');
      this.config.logDir = path.join(process.cwd(), 'logs');
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefault(defaultConfig: LogConfig): void {
    this.config = { ...defaultConfig };
    this.saveConfig();
    this.notifyWatchers();
    console.log('Log config reset to default');
  }

  /**
   * 添加配置变更监听器
   */
  addWatcher(callback: (config: LogConfig) => void): void {
    this.watchers.push(callback);
  }

  /**
   * 移除配置变更监听器
   */
  removeWatcher(callback: (config: LogConfig) => void): void {
    const index = this.watchers.indexOf(callback);
    if (index > -1) {
      this.watchers.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher(this.getConfig());
      } catch (error) {
        console.error('Error in config watcher:', error);
      }
    }
  }

  /**
   * 获取配置摘要
   */
  getConfigSummary(): string {
    return `LogConfig: level=${LogLevel[this.config.level]}, file=${this.config.enableFile}, console=${this.config.enableConsole}, dir=${this.config.logDir}`;
  }

  /**
   * 导出配置
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(configJson: string): boolean {
    try {
      const importedConfig = JSON.parse(configJson);
      this.updateConfig(importedConfig);
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 检查配置文件是否存在
   */
  configExists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * 获取配置文件修改时间
   */
  getConfigModifiedTime(): Date | null {
    try {
      if (this.configExists()) {
        const stats = fs.statSync(this.configPath);
        return stats.mtime;
      }
    } catch (error) {
      console.error('Failed to get config modified time:', error);
    }
    return null;
  }

  /**
   * 创建配置备份
   */
  createBackup(): string | null {
    try {
      if (!this.configExists()) {
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = this.configPath.replace('.json', `-backup-${timestamp}.json`);
      
      fs.copyFileSync(this.configPath, backupPath);
      console.log(`Config backup created: ${backupPath}`);
      
      return backupPath;
    } catch (error) {
      console.error('Failed to create config backup:', error);
      return null;
    }
  }

  /**
   * 从备份恢复配置
   */
  restoreFromBackup(backupPath: string): boolean {
    try {
      if (!fs.existsSync(backupPath)) {
        console.error(`Backup file not found: ${backupPath}`);
        return false;
      }

      fs.copyFileSync(backupPath, this.configPath);
      this.loadConfig();
      this.notifyWatchers();
      
      console.log(`Config restored from backup: ${backupPath}`);
      return true;
    } catch (error) {
      console.error('Failed to restore config from backup:', error);
      return false;
    }
  }

  /**
   * 销毁配置管理器
   */
  destroy(): void {
    this.watchers.length = 0;
  }
}
