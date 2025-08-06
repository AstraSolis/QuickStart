/**
 * 布局操作自定义Hook
 * 封装布局配置的读取和更新操作
 */

import { useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLayoutConfig } from './useConfig';
import type { LayoutConfigSchema } from '@shared/config-schemas';

// Hook返回类型
export interface UseLayoutOperationsReturn {
  // 状态
  layoutConfig: LayoutConfigSchema | null;
  layoutLoading: boolean;
  
  // 操作函数
  handleLayoutChange: (settingPath: string, value: unknown) => Promise<void>;
}

/**
 * 布局操作Hook
 */
export const useLayoutOperations = (): UseLayoutOperationsReturn => {
  const { t } = useTranslation(['theme', 'common']);
  const { config: layoutConfig, updateConfig: updateLayoutConfig, loading: layoutLoading } = useLayoutConfig();

  // 处理布局设置变更
  const handleLayoutChange = useCallback(async (settingPath: string, value: unknown) => {
    try {
      if (!layoutConfig) {
        console.error('Layout config not loaded');
        return;
      }

      const pathParts = settingPath.split('.');
      const updateObj: Record<string, unknown> = {};

      if (pathParts.length === 1) {
        updateObj[pathParts[0]] = value;
      } else if (pathParts.length === 2) {
        const [section, key] = pathParts;
        updateObj[section] = {
          ...((layoutConfig as any)[section] || {}),
          [key]: value,
        };
      } else {
        console.error('Unsupported setting path depth:', settingPath);
        return;
      }

      await updateLayoutConfig(updateObj);
      message.success(t('theme:messages.layoutUpdated', '布局设置已更新'));
    } catch (error) {
      console.error('Failed to update layout setting:', error);
      message.error(t('theme:messages.layoutUpdateFailed', '布局设置更新失败'));
    }
  }, [layoutConfig, updateLayoutConfig, t]);

  return {
    // 状态
    layoutConfig,
    layoutLoading,
    
    // 操作函数
    handleLayoutChange,
  };
};
