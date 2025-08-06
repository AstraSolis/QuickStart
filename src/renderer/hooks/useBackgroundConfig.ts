import { useState, useEffect, useCallback } from 'react';
import type { BackgroundConfigSchema } from '@shared/config-schemas';
import { DEFAULT_CONFIGS } from '@shared/config-schemas';
import type { CachedImage, CacheStats } from '@shared/ipc-types';

/**
 * 背景配置管理 Hook
 * 提供背景配置的读取、更新和实时监听功能
 */
export function useBackgroundConfig() {
  const [config, setConfig] = useState<BackgroundConfigSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载背景配置
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (window.electronAPI?.config?.get) {
        const result = await window.electronAPI.config.get('background-config');
        if (result.success && result.data) {
          const configData = result.data as BackgroundConfigSchema;

          // 修复渐变颜色数据结构问题：如果colors是对象，转换为数组
          if (configData.gradient && configData.gradient.colors && !Array.isArray(configData.gradient.colors)) {
            const colorsObj = configData.gradient.colors as any;
            const colorsArray = Object.keys(colorsObj)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map(key => colorsObj[key]);
            configData.gradient.colors = colorsArray;
          }

          // 确保渐变颜色数组至少有两个颜色
          if (configData.gradient && (!Array.isArray(configData.gradient.colors) || configData.gradient.colors.length === 0)) {
            configData.gradient.colors = [
              { color: '#1890ff', position: 0 },
              { color: '#52c41a', position: 100 },
            ];
          }

          setConfig(configData);
        } else {
          // 如果配置不存在，使用默认配置
          console.warn('Background config not found, using default config');
          const defaultConfig = DEFAULT_CONFIGS.BACKGROUND_CONFIG;
          setConfig(defaultConfig);
          // 同时保存默认配置到文件
          try {
            await window.electronAPI.config.set('background-config', defaultConfig);
          } catch (err) {
            console.warn('Failed to save default background config:', err);
          }
        }
      } else {
        console.warn('Electron API not available, using default config');
        setConfig(DEFAULT_CONFIGS.BACKGROUND_CONFIG);
      }
    } catch (err) {
      console.error('Failed to load background config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新背景配置 - 优化版本，避免不必要的重新加载
  const updateConfig = useCallback(async (updates: Partial<BackgroundConfigSchema>) => {
    try {
      setError(null);

      if (window.electronAPI?.config?.set) {
        const result = await window.electronAPI.config.set('background-config', updates);
        if (result.success) {
          // 直接更新本地状态，避免重新加载整个配置
          setConfig(prevConfig => {
            if (!prevConfig) return prevConfig;

            // 深度合并配置更新
            const newConfig = { ...prevConfig };

            // 处理嵌套对象的更新
            Object.keys(updates).forEach(key => {
              const updateValue = (updates as any)[key];
              if (updateValue && typeof updateValue === 'object' && !Array.isArray(updateValue)) {
                // 对于对象类型的属性，进行深度合并
                (newConfig as any)[key] = {
                  ...(prevConfig as any)[key],
                  ...updateValue
                };
              } else {
                // 对于基本类型和数组，直接赋值
                (newConfig as any)[key] = updateValue;
              }
            });

            // 确保渐变颜色数组格式正确
            if (newConfig.gradient && newConfig.gradient.colors) {
              if (!Array.isArray(newConfig.gradient.colors)) {
                const colorsObj = newConfig.gradient.colors as any;
                const colorsArray = Object.keys(colorsObj)
                  .sort((a, b) => parseInt(a) - parseInt(b))
                  .map(key => colorsObj[key]);
                newConfig.gradient.colors = colorsArray;
              }
            }

            return newConfig;
          });
        } else {
          throw new Error(result.error || 'Failed to update background config');
        }
      } else {
        throw new Error('Electron API not available');
      }
    } catch (err) {
      console.error('Failed to update background config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // 发生错误时才重新加载配置
      await loadConfig();
    }
  }, [loadConfig]);

  // 重置配置到默认值
  const resetConfig = useCallback(async () => {
    try {
      setError(null);
      
      if (window.electronAPI?.config?.reset) {
        const result = await window.electronAPI.config.reset('background-config');
        if (result.success) {
          await loadConfig();
        } else {
          throw new Error(result.error || 'Failed to reset background config');
        }
      } else {
        throw new Error('Electron API not available');
      }
    } catch (err) {
      console.error('Failed to reset background config:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [loadConfig]);

  // 添加背景到历史记录
  const addToHistory = useCallback(async (backgroundItem: {
    name: string;
    type: 'color' | 'gradient' | 'image' | 'url';
    config: any;
    tags?: string[];
  }) => {
    if (!config) return;

    const historyItem = {
      id: `bg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...backgroundItem,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      useCount: 1,
      isFavorite: false,
    };

    const updatedHistory = [historyItem, ...config.history].slice(0, 50); // 保留最近50个
    await updateConfig({ history: updatedHistory });
  }, [config, updateConfig]);

  // 添加背景到收藏夹
  const addToFavorites = useCallback(async (backgroundItem: {
    name: string;
    type: 'color' | 'gradient' | 'image' | 'url';
    config: any;
    category?: string;
    tags?: string[];
  }) => {
    if (!config) return;

    const favoriteItem = {
      id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...backgroundItem,
      addedAt: new Date().toISOString(),
    };

    const updatedFavorites = [...config.favorites, favoriteItem];
    await updateConfig({ favorites: updatedFavorites });
  }, [config, updateConfig]);

  // 从收藏夹移除背景
  const removeFromFavorites = useCallback(async (id: string) => {
    if (!config) return;

    const updatedFavorites = config.favorites.filter(item => item.id !== id);
    await updateConfig({ favorites: updatedFavorites });
  }, [config, updateConfig]);

  // 清理历史记录
  const clearHistory = useCallback(async () => {
    await updateConfig({ history: [] });
  }, [updateConfig]);

  // 设置背景
  const setBackground = useCallback(async (backgroundConfig: {
    type: 'none' | 'color' | 'gradient' | 'image' | 'url';
    color?: { value: string; opacity: number };
    gradient?: any;
    image?: any;
  }) => {
    const { type, ...otherConfig } = backgroundConfig;
    await updateConfig({
      enabled: type !== 'none',
      type,
      ...otherConfig,
    });
  }, [updateConfig]);

  // 初始化加载
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 监听配置变更 - 优化版本，避免不必要的重新加载
  useEffect(() => {
    const handleConfigChange = (event: any) => {
      // 只有当变更的配置类型是背景配置时才重新加载
      if (event && event.type === 'background-config') {
        // 如果事件包含新的配置数据，直接使用它
        if (event.newValue) {
          setConfig(event.newValue as BackgroundConfigSchema);
        } else {
          // 否则重新加载配置
          loadConfig();
        }
      }
    };

    // 使用通用的事件监听
    if (window.electronAPI?.on) {
      window.electronAPI.on('config@changed', handleConfigChange);
    }

    return () => {
      // 清理监听器
      if (window.electronAPI?.off) {
        window.electronAPI.off('config@changed', handleConfigChange);
      }
    };
  }, [loadConfig]);

  // 缓存图片
  const cacheImage = useCallback(async (originalPath: string, imageBuffer: Uint8Array, metadata: { width: number; height: number; format: string }) => {
    try {
      if (window.electronAPI?.backgroundCache?.cacheImage) {
        const result = await window.electronAPI.backgroundCache.cacheImage(originalPath, imageBuffer, metadata);
        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to cache image');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to cache image:', err);
      throw err;
    }
  }, []);

  // 检查文件名是否存在
  const checkFileNameExists = useCallback(async (fileName: string): Promise<boolean> => {
    try {
      if (window.electronAPI?.backgroundCache?.checkFileNameExists) {
        const result = await window.electronAPI.backgroundCache.checkFileNameExists(fileName);
        if (result.success) {
          return result.data || false;
        } else {
          throw new Error(result.error || 'Failed to check file name exists');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to check file name exists:', err);
      return false;
    }
  }, []);

  // 使用原文件名缓存图片
  const cacheImageWithOriginalName = useCallback(async (originalFileName: string, imageBuffer: Uint8Array, metadata: { width: number; height: number; format: string }) => {
    try {
      if (window.electronAPI?.backgroundCache?.cacheImageWithOriginalName) {
        const result = await window.electronAPI.backgroundCache.cacheImageWithOriginalName(originalFileName, imageBuffer, metadata);
        if (result.success) {
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to cache image with original name');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to cache image with original name:', err);
      throw err;
    }
  }, []);

  // 获取缓存图片
  const getCachedImage = useCallback(async (originalPath: string): Promise<CachedImage | null> => {
    try {
      if (window.electronAPI?.backgroundCache?.getCachedImage) {
        const result = await window.electronAPI.backgroundCache.getCachedImage(originalPath);
        if (result.success) {
          return result.data || null;
        } else {
          throw new Error(result.error || 'Failed to get cached image');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to get cached image:', err);
      return null;
    }
  }, []);

  // 获取所有缓存图片
  const getAllCachedImages = useCallback(async (): Promise<CachedImage[]> => {
    try {
      if (window.electronAPI?.backgroundCache?.getAllCachedImages) {
        const result = await window.electronAPI.backgroundCache.getAllCachedImages();
        if (result.success) {
          return result.data || [];
        } else {
          throw new Error(result.error || 'Failed to get all cached images');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to get all cached images:', err);
      return [];
    }
  }, []);

  // 重命名缓存图片
  const renameCachedImage = useCallback(async (oldFileName: string, newFileName: string): Promise<string> => {
    try {
      if (window.electronAPI?.backgroundCache?.renameCachedImage) {
        const result = await window.electronAPI.backgroundCache.renameCachedImage(oldFileName, newFileName);
        if (result.success) {
          return result.data || '';
        } else {
          throw new Error(result.error || 'Failed to rename cached image');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to rename cached image:', err);
      throw err;
    }
  }, []);

  // 删除缓存图片
  const removeCachedImage = useCallback(async (originalPath: string): Promise<boolean> => {
    try {
      if (window.electronAPI?.backgroundCache?.removeCachedImage) {
        const result = await window.electronAPI.backgroundCache.removeCachedImage(originalPath);
        if (result.success) {
          return result.data || false;
        } else {
          throw new Error(result.error || 'Failed to remove cached image');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to remove cached image:', err);
      return false;
    }
  }, []);

  // 获取缓存统计
  const getCacheStats = useCallback(async (): Promise<CacheStats | null> => {
    try {
      if (window.electronAPI?.backgroundCache?.getCacheStats) {
        const result = await window.electronAPI.backgroundCache.getCacheStats();
        if (result.success) {
          return result.data || null;
        } else {
          throw new Error(result.error || 'Failed to get cache stats');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to get cache stats:', err);
      return null;
    }
  }, []);

  // 清空所有缓存
  const clearAllCache = useCallback(async (): Promise<boolean> => {
    try {
      if (window.electronAPI?.backgroundCache?.clearAllCache) {
        const result = await window.electronAPI.backgroundCache.clearAllCache();
        if (result.success) {
          return result.data || false;
        } else {
          throw new Error(result.error || 'Failed to clear all cache');
        }
      } else {
        throw new Error('Background cache API not available');
      }
    } catch (err) {
      console.error('Failed to clear all cache:', err);
      return false;
    }
  }, []);

  return {
    config,
    loading,
    error,
    updateConfig,
    resetConfig,
    addToHistory,
    addToFavorites,
    removeFromFavorites,
    clearHistory,
    setBackground,
    reload: loadConfig,
    // 缓存相关功能
    cacheImage,
    cacheImageWithOriginalName,
    checkFileNameExists,
    getCachedImage,
    getAllCachedImages,
    renameCachedImage,
    removeCachedImage,
    getCacheStats,
    clearAllCache,
  };
}

/**
 * 背景配置的便捷 Hook
 * 提供常用的背景配置操作
 */
export function useBackgroundSettings() {
  const {
    config,
    loading,
    error,
    updateConfig,
    setBackground,
  } = useBackgroundConfig();

  // 启用/禁用背景
  const toggleBackground = useCallback(async (enabled: boolean) => {
    await updateConfig({ enabled });
  }, [updateConfig]);

  // 设置背景透明度
  const setOpacity = useCallback(async (opacity: number) => {
    if (!config) return;
    
    switch (config.type) {
      case 'color':
        await updateConfig({ color: { ...config.color, opacity } });
        break;
      case 'gradient':
        await updateConfig({ gradient: { ...config.gradient, opacity } });
        break;
      case 'image':
        await updateConfig({ image: { ...config.image, opacity } });
        break;
    }
  }, [config, updateConfig]);

  // 设置图片模糊度
  const setBlur = useCallback(async (blur: number) => {
    if (!config || config.type !== 'image') return;
    
    await updateConfig({
      image: { ...config.image, blur }
    });
  }, [config, updateConfig]);

  return {
    config,
    loading,
    error,
    toggleBackground,
    setOpacity,
    setBlur,
    setBackground,
  };
}
