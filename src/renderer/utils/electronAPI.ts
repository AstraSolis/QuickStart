/**
 * Electron API 工具函数
 * 提供等待 electronAPI 准备就绪的功能
 */

import i18n from '../i18n';

/**
 * 获取翻译函数
 */
const t = (key: string, defaultValue: string, options?: any): string => {
  try {
    const result = i18n.t(key, defaultValue, options);
    return typeof result === 'string' ? result : defaultValue;
  } catch {
    // 翻译失败时使用默认值
    return defaultValue;
  }
};

/**
 * 等待 electronAPI 准备就绪
 * @param maxWaitTime 最大等待时间（毫秒），默认5000ms
 * @returns Promise<boolean> 是否成功获取到API
 */
export const waitForElectronAPI = async (maxWaitTime: number = 5000): Promise<boolean> => {
  return new Promise((resolve) => {
    // 检查API是否基本可用（降低要求）
    const isAPIReady = () => {
      const hasAPI = !!window.electronAPI;
      if (!hasAPI) return false;

      // 给一些时间让contextBridge完全初始化
      try {
        return typeof window.electronAPI === 'object';
      } catch {
        return false;
      }
    };

    if (isAPIReady()) {
      // 额外等待一点时间确保API完全初始化
      setTimeout(() => resolve(true), 50);
      return;
    }

    let attempts = 0;
    const maxAttempts = maxWaitTime / 100; // 每100ms检查一次
    const checkInterval = setInterval(() => {
      attempts++;
      if (isAPIReady()) {
        clearInterval(checkInterval);
        // 额外等待一点时间确保API完全初始化
        setTimeout(() => resolve(true), 50);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        // 开发调试警告：ElectronAPI初始化诊断信息使用英文是合理的，这是开发者工具信息
        console.warn('ElectronAPI not ready after waiting:', {
          electronAPI: !!window.electronAPI,
          config: !!window.electronAPI?.config,
          get: !!window.electronAPI?.config?.get,
          set: !!window.electronAPI?.config?.set,
          typeof: typeof window.electronAPI
        });
        resolve(false);
      }
    }, 100);
  });
};

/**
 * 安全地调用 electronAPI 方法
 * @param apiCall API调用函数
 * @param fallbackValue 失败时的回退值
 * @param maxWaitTime 最大等待时间
 * @returns Promise<T> API调用结果或回退值
 */
export const safeElectronAPICall = async <T>(
  apiCall: () => Promise<T>,
  fallbackValue: T,
  maxWaitTime: number = 5000
): Promise<T> => {
  try {
    const apiReady = await waitForElectronAPI(maxWaitTime);
    if (!apiReady) {
      // 用户可见的错误消息，需要国际化
      const errorMsg = t('errors:electronAPI.notAvailableAfterWaiting', '系统API等待超时，请重启应用程序');
      console.warn(errorMsg);
      return fallbackValue;
    }

    // 检查API结构，但不要太严格
    if (!window.electronAPI) {
      // 用户可见的错误消息，需要国际化
      const errorMsg = t('errors:electronAPI.notFound', '系统API未找到，应用程序可能未正确初始化');
      console.warn(errorMsg);
      return fallbackValue;
    }

    return await apiCall();
  } catch (error) {
    // 用户可见的错误消息，需要国际化
    const errorMsg = t('errors:electronAPI.callFailed', '系统API调用失败: {{error}}', {
      error: error instanceof Error ? error.message : String(error)
    });
    console.error(errorMsg);
    return fallbackValue;
  }
};

/**
 * 检查 electronAPI 是否可用
 * @returns boolean
 */
export const isElectronAPIAvailable = (): boolean => {
  return typeof window !== 'undefined' &&
         !!window.electronAPI &&
         typeof window.electronAPI === 'object';
};
