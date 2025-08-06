/**
 * 配置管理 React Hook
 * 提供配置的读取、更新和实时监听功能
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppSettingsSchema,
  ThemeConfigSchema,
  LayoutConfigSchema,
  I18nConfigSchema,
  UserPreferencesSchema,
} from '@shared/config-schemas';
import { waitForElectronAPI } from '../utils/electronAPI';

// 深度合并函数
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue) &&
          targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

// 配置类型映射
type ConfigType = 'app-settings' | 'theme-config' | 'layout-config' | 'i18n-config' | 'user-preferences';

type ConfigSchemaMap = {
  'app-settings': AppSettingsSchema;
  'theme-config': ThemeConfigSchema;
  'layout-config': LayoutConfigSchema;
  'i18n-config': I18nConfigSchema;
  'user-preferences': UserPreferencesSchema;
};

// 配置变更事件
interface ConfigChangeEvent<T = unknown> {
  type: ConfigType;
  oldValue: T;
  newValue: T;
  timestamp: number;
}

/**
 * 通用配置管理Hook
 */
export function useConfig<T extends ConfigType>(
  configType: T
): {
  config: ConfigSchemaMap[T] | null;
  loading: boolean;
  error: string | null;
  updateConfig: (updates: Partial<ConfigSchemaMap[T]>) => Promise<boolean>;
  resetConfig: () => Promise<boolean>;
  refreshConfig: () => Promise<void>;
} {
  const [config, setConfig] = useState<ConfigSchemaMap[T] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const configRef = useRef<ConfigSchemaMap[T] | null>(null);



  // 加载配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const result = await window.electronAPI.config.get(configType);
      if (result.success && result.data) {
        const configData = result.data as ConfigSchemaMap[T];
        setConfig(configData);
        configRef.current = configData;
      } else {
        throw new Error(result.error ?? 'Failed to get config');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load config';
      setError(errorMessage);
      console.error(`Failed to load config ${configType}:`, err);
    } finally {
      setLoading(false);
    }
  }, [configType]);

  // 更新配置
  const updateConfig = useCallback(async (updates: Partial<ConfigSchemaMap[T]>): Promise<boolean> => {
    try {
      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const result = await window.electronAPI.config.set(configType, updates);

      if (result.success && configRef.current) {
        // 深度合并配置对象
        const newConfig = deepMerge(configRef.current, updates);
        setConfig(newConfig);
        configRef.current = newConfig;
      }

      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update config';
      setError(errorMessage);
      console.error(`Failed to update config ${configType}:`, err);
      return false;
    }
  }, [configType]);

  // 重置配置
  const resetConfig = useCallback(async (): Promise<boolean> => {
    try {
      // 等待electronAPI准备就绪
      const apiReady = await waitForElectronAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const result = await window.electronAPI.config.reset(configType);

      if (result.success) {
        await loadConfig();
      }

      return result.success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset config';
      setError(errorMessage);
      console.error(`Failed to reset config ${configType}:`, err);
      return false;
    }
  }, [configType, loadConfig]);

  // 刷新配置
  const refreshConfig = useCallback(async (): Promise<void> => {
    await loadConfig();
  }, [loadConfig]);

  // 处理配置变更事件
  const handleConfigChange = useCallback((...args: unknown[]) => {
    const event = args[0] as ConfigChangeEvent;
    if (event && event.type === configType) {
      setConfig(event.newValue as ConfigSchemaMap[T]);
      configRef.current = event.newValue as ConfigSchemaMap[T];
    }
  }, [configType]);

  // 初始化和事件监听
  useEffect(() => {
    loadConfig();

    // 异步设置事件监听器
    const setupEventListeners = async () => {
      const apiReady = await waitForElectronAPI();
      if (apiReady) {
        window.electronAPI.on('config@changed', handleConfigChange);
      }
    };

    setupEventListeners();

    return () => {
      if (window.electronAPI) {
        window.electronAPI.off('config@changed', handleConfigChange);
      }
    };
  }, [loadConfig, handleConfigChange]);

  return {
    config,
    loading,
    error,
    updateConfig,
    resetConfig,
    refreshConfig,
  };
}

/**
 * 应用设置Hook
 */
export function useAppSettings() {
  return useConfig('app-settings');
}

/**
 * 主题配置Hook
 */
export function useThemeConfig() {
  return useConfig('theme-config');
}

/**
 * 布局配置Hook
 */
export function useLayoutConfig() {
  return useConfig('layout-config');
}

/**
 * 国际化配置Hook
 */
export function useI18nConfig() {
  return useConfig('i18n-config');
}

/**
 * 用户偏好Hook
 */
export function useUserPreferences() {
  return useConfig('user-preferences');
}

/**
 * 配置路径Hook
 */
export function useConfigPaths() {
  const [paths, setPaths] = useState<{
    appDataPath: string | null;
    configPath: string | null;
  }>({
    appDataPath: null,
    configPath: null,
  });

  useEffect(() => {
    const loadPaths = async () => {
      try {
        // 等待electronAPI准备就绪
        const waitForAPI = async (): Promise<boolean> => {
          return new Promise((resolve) => {
            if (window.electronAPI) {
              resolve(true);
              return;
            }

            let attempts = 0;
            const maxAttempts = 50;
            const checkInterval = setInterval(() => {
              attempts++;
              if (window.electronAPI) {
                clearInterval(checkInterval);
                resolve(true);
              } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                resolve(false);
              }
            }, 100);
          });
        };

        const apiReady = await waitForAPI();
        if (apiReady) {
          const [appDataPath, configPath] = await Promise.all([
            window.electronAPI.config.getAppDataPath(),
            window.electronAPI.config.getConfigPath(),
          ]);

          setPaths({ appDataPath, configPath });
        }
      } catch (error) {
        console.error('Failed to load config paths:', error);
      }
    };

    loadPaths();
  }, []);

  return paths;
}

/**
 * 配置同步Hook - 用于多个配置的批量操作
 */
export function useConfigSync() {
  const [syncing, setSyncing] = useState(false);

  const syncConfigs = useCallback(async (configs: Array<{
    type: ConfigType;
    data: unknown;
  }>): Promise<boolean> => {
    try {
      setSyncing(true);

      // 等待electronAPI准备就绪
      const waitForAPI = async (): Promise<boolean> => {
        return new Promise((resolve) => {
          if (window.electronAPI) {
            resolve(true);
            return;
          }

          let attempts = 0;
          const maxAttempts = 50;
          const checkInterval = setInterval(() => {
            attempts++;
            if (window.electronAPI) {
              clearInterval(checkInterval);
              resolve(true);
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              resolve(false);
            }
          }, 100);
        });
      };

      const apiReady = await waitForAPI();
      if (!apiReady) {
        throw new Error('Electron API not available after waiting');
      }

      const results = await Promise.all(
        configs.map(({ type, data }) =>
          window.electronAPI.config.set(type, data)
        )
      );

      return results.every(result => result.success === true);
    } catch (error) {
      console.error('Failed to sync configs:', error);
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  const resetAllConfigs = useCallback(async (): Promise<boolean> => {
    try {
      setSyncing(true);
      
      if (!window.electronAPI) {
        throw new Error('Electron API not available');
      }

      const configTypes: ConfigType[] = [
        'app-settings',
        'theme-config',
        'layout-config',
        'i18n-config',
        'user-preferences',
      ];

      const results = await Promise.all(
        configTypes.map(type => window.electronAPI.config.reset(type))
      );

      return results.every(result => result.success === true);
    } catch (error) {
      console.error('Failed to reset all configs:', error);
      return false;
    } finally {
      setSyncing(false);
    }
  }, []);

  return {
    syncing,
    syncConfigs,
    resetAllConfigs,
  };
}
