/**
 * QuickStart 配置管理器
 * 负责配置文件的读写、验证、备份和热重载
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import {
  CONFIG_PATHS,
  DEFAULT_CONFIGS,
  type AppSettingsSchema,
  type ThemeConfigSchema,
  type LayoutConfigSchema,
  type I18nConfigSchema,
  type UserPreferencesSchema,
  type BackgroundConfigSchema
} from '@shared/config-schemas';
import { configBackupManager, type BackupInfo } from './config-backup';

// 配置类型映射
type ConfigType = 'app-settings' | 'theme-config' | 'layout-config' | 'i18n-config' | 'user-preferences' | 'background-config';

type ConfigSchemaMap = {
  'app-settings': AppSettingsSchema;
  'theme-config': ThemeConfigSchema;
  'layout-config': LayoutConfigSchema;
  'i18n-config': I18nConfigSchema;
  'user-preferences': UserPreferencesSchema;
  'background-config': BackgroundConfigSchema;
};

// 配置变更事件
export interface ConfigChangeEvent<T = unknown> {
  type: ConfigType;
  oldValue: T;
  newValue: T;
  timestamp: number;
}

/**
 * 配置管理器类
 */
export class ConfigManager extends EventEmitter {
  private appDataPath: string = '';
  private configPath: string = '';
  private backupPath: string = '';
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private configCache: Map<ConfigType, unknown> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    // 设置最大监听器数量，避免内存泄漏警告
    this.setMaxListeners(20);
    // 延迟初始化路径，等待app ready
  }

  /**
   * 获取国际化错误消息的辅助函数
   */
  private getI18nErrorMessage(key: string, fallback: string, params?: Record<string, unknown>): string {
    try {
      // 检查mainI18n是否已初始化并可用
      const mainI18nInstance = (global as Record<string, unknown>).mainI18n as { isInitialized: boolean; t: (key: string, fallback: string, params?: Record<string, unknown>) => string } | undefined;
      if (mainI18nInstance?.isInitialized) {
        return mainI18nInstance.t(`errors.config.manager.${key}`, fallback, params);
      }
    } catch {
      // i18n失败时使用回退消息
    }
    return fallback;
  }

  /**
   * 初始化路径
   */
  private initializePaths(): void {
    this.appDataPath = path.join(app.getPath('appData'), CONFIG_PATHS.APP_DATA_DIR);
    this.configPath = path.join(this.appDataPath, CONFIG_PATHS.CONFIG_DIR);
    this.backupPath = path.join(this.appDataPath, CONFIG_PATHS.BACKUPS_DIR);
  }

  /**
   * 初始化配置管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 首先初始化路径
      this.initializePaths();

      // 创建必要的目录
      await this.ensureDirectories();

      // 初始化所有配置文件
      await this.initializeConfigs();

      // 初始化备份管理器
      configBackupManager.initialize();

      // 启动文件监听
      this.startWatching();

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize ConfigManager:', error);
      throw error;
    }
  }

  /**
   * 确保所有必要的目录存在
   */
  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.appDataPath,
      this.configPath,
      this.backupPath,
      path.join(this.appDataPath, CONFIG_PATHS.CACHE_DIR),
      path.join(this.appDataPath, CONFIG_PATHS.I18N_DIR),
      path.join(this.appDataPath, CONFIG_PATHS.LOGS_DIR),
      path.join(this.appDataPath, CONFIG_PATHS.CACHE_DIR, CONFIG_PATHS.BACKGROUND_IMAGES),
      path.join(this.appDataPath, CONFIG_PATHS.CACHE_DIR, CONFIG_PATHS.FILE_ICONS),
      path.join(this.appDataPath, CONFIG_PATHS.CACHE_DIR, CONFIG_PATHS.THUMBNAILS),
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
    }
  }

  /**
   * 初始化所有配置文件
   */
  private async initializeConfigs(): Promise<void> {
    const configs: Array<{ type: ConfigType; filename: string; defaultValue: unknown }> = [
      { type: 'app-settings', filename: CONFIG_PATHS.APP_SETTINGS, defaultValue: DEFAULT_CONFIGS.APP_SETTINGS },
      { type: 'theme-config', filename: CONFIG_PATHS.THEME_CONFIG, defaultValue: DEFAULT_CONFIGS.THEME_CONFIG },
      { type: 'layout-config', filename: CONFIG_PATHS.LAYOUT_CONFIG, defaultValue: DEFAULT_CONFIGS.LAYOUT_CONFIG },
      { type: 'i18n-config', filename: CONFIG_PATHS.I18N_CONFIG, defaultValue: DEFAULT_CONFIGS.I18N_CONFIG },
      { type: 'user-preferences', filename: CONFIG_PATHS.USER_PREFERENCES, defaultValue: DEFAULT_CONFIGS.USER_PREFERENCES },
      { type: 'background-config', filename: CONFIG_PATHS.BACKGROUND_CONFIG, defaultValue: DEFAULT_CONFIGS.BACKGROUND_CONFIG },
    ];

    for (const config of configs) {
      const filePath = path.join(this.configPath, config.filename);
      
      if (!fs.existsSync(filePath)) {
        // 如果配置文件不存在，创建默认配置
        await this.writeConfigFile(filePath, config.defaultValue);
      }

      // 加载配置到缓存
      const configData = await this.readConfigFile(filePath, config.defaultValue);
      this.configCache.set(config.type, configData);
    }
  }

  /**
   * 读取配置文件
   */
  private async readConfigFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // 合并默认值，确保所有必要的字段都存在
      return this.mergeWithDefaults(parsed, defaultValue);
    } catch (error) {
      console.warn(`Failed to read config file ${filePath}, using default:`, error);
      return defaultValue;
    }
  }

  /**
   * 写入配置文件
   */
  private async writeConfigFile(filePath: string, data: unknown): Promise<void> {
    try {
      // 创建备份
      if (fs.existsSync(filePath)) {
        await this.createBackup(filePath);
      }

      // 写入新配置
      const jsonData = JSON.stringify(data, null, 2);
      await fs.promises.writeFile(filePath, jsonData, 'utf-8');
    } catch (error) {
      console.error(`Failed to write config file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 合并默认值
   */
  private mergeWithDefaults<T>(data: unknown, defaultValue: T): T {
    if (typeof defaultValue !== 'object' || defaultValue === null) {
      return data !== undefined ? (data as T) : defaultValue;
    }

    const result = { ...defaultValue };
    
    if (data && typeof data === 'object') {
      for (const key in data as Record<string, unknown>) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const dataValue = (data as Record<string, unknown>)[key];
          const defaultValueKey = (defaultValue as Record<string, unknown>)[key];

          if (typeof dataValue === 'object' && dataValue !== null &&
              typeof defaultValueKey === 'object' && defaultValueKey !== null) {
            (result as Record<string, unknown>)[key] = this.mergeWithDefaults(dataValue, defaultValueKey);
          } else {
            (result as Record<string, unknown>)[key] = dataValue;
          }
        }
      }
    }

    return result;
  }

  /**
   * 创建配置文件备份
   */
  private async createBackup(filePath: string): Promise<void> {
    try {
      const filename = path.basename(filePath, '.json');
      await configBackupManager.createBackup(filePath, filename, 'Auto backup');
    } catch (error) {
      console.warn('Failed to create backup:', error);
    }
  }

  /**
   * 获取备份列表
   */
  async getBackupList(configType?: string): Promise<BackupInfo[]> {
    return await configBackupManager.getBackupList(configType);
  }

  /**
   * 恢复配置从备份
   */
  async restoreFromBackup(backupFilePath: string, configType: ConfigType): Promise<boolean> {
    const filename = this.getConfigFilename(configType);
    const targetPath = path.join(this.configPath, filename);

    const success = await configBackupManager.restoreFromBackup(backupFilePath, targetPath);

    if (success) {
      // 重新加载配置
      const defaultValue = this.getDefaultConfig(configType);
      const configData = await this.readConfigFile(targetPath, defaultValue);
      this.configCache.set(configType, configData);

      // 触发配置变更事件
      const changeEvent: ConfigChangeEvent = {
        type: configType,
        oldValue: this.configCache.get(configType),
        newValue: configData,
        timestamp: Date.now(),
      };

      this.emit('configChanged', changeEvent);
      this.emit(`${configType}Changed`, changeEvent);
    }

    return success;
  }

  /**
   * 启动文件监听
   */
  private startWatching(): void {
    const configFiles = [
      { type: 'app-settings' as ConfigType, filename: CONFIG_PATHS.APP_SETTINGS },
      { type: 'theme-config' as ConfigType, filename: CONFIG_PATHS.THEME_CONFIG },
      { type: 'layout-config' as ConfigType, filename: CONFIG_PATHS.LAYOUT_CONFIG },
      { type: 'i18n-config' as ConfigType, filename: CONFIG_PATHS.I18N_CONFIG },
      { type: 'user-preferences' as ConfigType, filename: CONFIG_PATHS.USER_PREFERENCES },
      { type: 'background-config' as ConfigType, filename: CONFIG_PATHS.BACKGROUND_CONFIG },
    ];

    for (const config of configFiles) {
      const filePath = path.join(this.configPath, config.filename);
      const watcher = chokidar.watch(filePath, {
        persistent: true,
        ignoreInitial: true,
      });

      watcher.on('change', async () => {
        await this.handleConfigChange(config.type, filePath);
      });

      this.watchers.set(config.type, watcher);
    }
  }

  /**
   * 处理配置文件变更
   */
  private async handleConfigChange(type: ConfigType, filePath: string): Promise<void> {
    try {
      const oldValue = this.configCache.get(type);
      const defaultValue = this.getDefaultConfig(type);
      const newValue = await this.readConfigFile(filePath, defaultValue);

      this.configCache.set(type, newValue);

      const changeEvent: ConfigChangeEvent = {
        type,
        oldValue,
        newValue,
        timestamp: Date.now(),
      };

      this.emit('configChanged', changeEvent);
      this.emit(`${type}Changed`, changeEvent);
    } catch (error) {
      console.error(`Failed to handle config change for ${type}:`, error);
    }
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig<T extends ConfigType>(type: T): ConfigSchemaMap[T] {
    switch (type) {
      case 'app-settings': return DEFAULT_CONFIGS.APP_SETTINGS as ConfigSchemaMap[T];
      case 'theme-config': return DEFAULT_CONFIGS.THEME_CONFIG as ConfigSchemaMap[T];
      case 'layout-config': return DEFAULT_CONFIGS.LAYOUT_CONFIG as ConfigSchemaMap[T];
      case 'i18n-config': return DEFAULT_CONFIGS.I18N_CONFIG as ConfigSchemaMap[T];
      case 'user-preferences': return DEFAULT_CONFIGS.USER_PREFERENCES as ConfigSchemaMap[T];
      case 'background-config': return DEFAULT_CONFIGS.BACKGROUND_CONFIG as ConfigSchemaMap[T];
      default: throw new Error(this.getI18nErrorMessage('unknownConfigType', `Unknown config type: ${type}`, { type }));
    }
  }

  /**
   * 获取配置
   */
  getConfig<T extends ConfigType>(type: T): ConfigSchemaMap[T] {
    if (!this.isInitialized) {
      throw new Error(this.getI18nErrorMessage('notInitialized', 'ConfigManager not initialized'));
    }

    const config = this.configCache.get(type);
    if (!config) {
      throw new Error(this.getI18nErrorMessage('configNotFound', `Config ${type} not found`, { type }));
    }

    return config as ConfigSchemaMap[T];
  }

  /**
   * 设置配置
   */
  async setConfig<T extends ConfigType>(type: T, config: Partial<ConfigSchemaMap[T]>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error(this.getI18nErrorMessage('notInitialized', 'ConfigManager not initialized'));
    }

    const currentConfig = this.configCache.get(type) as ConfigSchemaMap[T] | undefined;
    if (!currentConfig) {
      throw new Error(this.getI18nErrorMessage('configNotFound', `Config ${type} not found in cache`, { type }));
    }

    const newConfig = { ...currentConfig, ...config };

    const filename = this.getConfigFilename(type);
    const filePath = path.join(this.configPath, filename);

    // 在写入新配置前创建备份
    if (fs.existsSync(filePath)) {
      await this.createBackup(filePath);
    }

    await this.writeConfigFile(filePath, newConfig);
    this.configCache.set(type, newConfig);

    // 触发配置变更事件
    const changeEvent: ConfigChangeEvent = {
      type,
      oldValue: currentConfig,
      newValue: newConfig,
      timestamp: Date.now(),
    };

    this.emit('configChanged', changeEvent);
    this.emit(`${type}Changed`, changeEvent);
  }

  /**
   * 获取配置文件名
   */
  private getConfigFilename(type: ConfigType): string {
    switch (type) {
      case 'app-settings': return CONFIG_PATHS.APP_SETTINGS;
      case 'theme-config': return CONFIG_PATHS.THEME_CONFIG;
      case 'layout-config': return CONFIG_PATHS.LAYOUT_CONFIG;
      case 'i18n-config': return CONFIG_PATHS.I18N_CONFIG;
      case 'user-preferences': return CONFIG_PATHS.USER_PREFERENCES;
      case 'background-config': return CONFIG_PATHS.BACKGROUND_CONFIG;
      default: throw new Error(this.getI18nErrorMessage('unknownConfigType', `Unknown config type: ${type}`, { type }));
    }
  }

  /**
   * 重置配置到默认值
   */
  async resetConfig<T extends ConfigType>(type: T): Promise<void> {
    const defaultConfig = this.getDefaultConfig(type);
    await this.setConfig(type, defaultConfig);
  }

  /**
   * 获取应用数据目录路径
   */
  getAppDataPath(): string {
    return this.appDataPath;
  }

  /**
   * 获取配置目录路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * 销毁配置管理器
   */
  destroy(): void {
    // 停止所有文件监听
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    // 清空缓存
    this.configCache.clear();

    // 移除所有事件监听器
    this.removeAllListeners();

    this.isInitialized = false;
  }
}

// 单例实例
export const configManager = new ConfigManager();
