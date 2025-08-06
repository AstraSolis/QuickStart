import { useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from './useConfig';
import { changeLanguage, getCurrentLanguage, isSupportedLanguage, getBrowserLanguage } from '../i18n';
import type { I18nConfigSchema } from '@shared/config-schemas';

/**
 * i18n配置管理Hook
 * 将i18next与配置系统集成，实现语言设置的持久化
 */
export const useI18nConfig = () => {
  const { i18n } = useTranslation();
  const {
    config: i18nConfig,
    updateConfig: updateI18nConfig,
    loading: isLoading
  } = useConfig('i18n-config');

  // 初始化语言设置 - 添加初始化标记避免重复执行
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!i18nConfig || isLoading || isInitialized) return;

    const initializeLanguage = async () => {
      let targetLanguage = i18nConfig.currentLanguage;

      // 如果启用自动检测且当前语言是默认值，尝试检测浏览器语言
      if (i18nConfig.autoDetect && targetLanguage === 'zh-CN') {
        const browserLanguage = getBrowserLanguage();
        if (browserLanguage && isSupportedLanguage(browserLanguage)) {
          targetLanguage = browserLanguage;
          // 更新配置
          await updateI18nConfig({ currentLanguage: targetLanguage });
        }
      }

      // 如果当前i18next语言与配置不同，切换语言
      if (getCurrentLanguage() !== targetLanguage) {
        await changeLanguage(targetLanguage);
      }

      setIsInitialized(true);
    };

    initializeLanguage().catch(console.error);
  }, [i18nConfig, isLoading, isInitialized, updateI18nConfig]);

  // 监听i18next语言变化，同步到配置 - 添加防抖机制
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleLanguageChange = (lng: string) => {
      // 清除之前的定时器
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 防抖：延迟500ms执行，避免频繁更新
      timeoutId = setTimeout(async () => {
        if (i18nConfig && lng !== (i18nConfig).currentLanguage && isInitialized) {
          console.log(`Language changed to: ${lng}, updating config...`);
          await updateI18nConfig({ currentLanguage: lng });
        }
      }, 500);
    };

    i18n.on('languageChanged', handleLanguageChange);
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [i18n, i18nConfig, updateI18nConfig, isInitialized]);

  // 切换语言
  const switchLanguage = useCallback(async (languageCode: string) => {
    if (!isSupportedLanguage(languageCode)) {
      console.warn(`Unsupported language: ${languageCode}`);
      return false;
    }

    try {
      console.log(`Switching language to: ${languageCode}`);

      // 先更新i18next
      await changeLanguage(languageCode);

      // 立即更新配置，确保同步
      await updateI18nConfig({ currentLanguage: languageCode });

      console.log(`Language switched successfully to: ${languageCode}`);
      return true;
    } catch (error) {
      console.error('Failed to switch language:', error);
      return false;
    }
  }, [updateI18nConfig]);

  // 切换自动检测设置
  const toggleAutoDetect = useCallback(async (enabled: boolean) => {
    await updateI18nConfig({ autoDetect: enabled });
    
    // 如果启用自动检测，立即检测并应用浏览器语言
    if (enabled) {
      const browserLanguage = getBrowserLanguage();
      if (browserLanguage && isSupportedLanguage(browserLanguage)) {
        await switchLanguage(browserLanguage);
      }
    }
  }, [updateI18nConfig, switchLanguage]);

  // 更新支持的语言列表
  const updateSupportedLanguages = useCallback(async (languages: string[]) => {
    const validLanguages = languages.filter(isSupportedLanguage);
    await updateI18nConfig({ supportedLanguages: validLanguages });
  }, [updateI18nConfig]);

  // 更新回退语言
  const updateFallbackLanguage = useCallback(async (languageCode: string) => {
    if (!isSupportedLanguage(languageCode)) {
      console.warn(`Unsupported fallback language: ${languageCode}`);
      return;
    }
    await updateI18nConfig({ fallbackLanguage: languageCode });
  }, [updateI18nConfig]);

  // 更新日期时间格式
  const updateDateTimeFormat = useCallback(async (
    dateFormat?: string,
    timeFormat?: string
  ) => {
    const updates: Partial<I18nConfigSchema> = {};
    if (dateFormat) updates.dateFormat = dateFormat;
    if (timeFormat) updates.timeFormat = timeFormat;
    
    if (Object.keys(updates).length > 0) {
      await updateI18nConfig(updates);
    }
  }, [updateI18nConfig]);

  // 更新数字格式
  const updateNumberFormat = useCallback(async (
    numberFormat: Partial<I18nConfigSchema['numberFormat']>
  ) => {
    if (!i18nConfig) return;
    
    await updateI18nConfig({
      numberFormat: {
        ...(i18nConfig).numberFormat,
        ...numberFormat,
      },
    });
  }, [i18nConfig, updateI18nConfig]);

  // 添加自定义翻译
  const addCustomTranslation = useCallback(async (
    language: string,
    namespace: string,
    key: string,
    value: string
  ) => {
    if (!i18nConfig) return;
    
    const customTranslations = { ...(i18nConfig).customTranslations };
    if (!customTranslations[language]) {
      customTranslations[language] = {};
    }
    if (!customTranslations[language][namespace]) {
      customTranslations[language][namespace] = {};
    }
    customTranslations[language][namespace][key] = value;
    
    await updateI18nConfig({ customTranslations });
  }, [i18nConfig, updateI18nConfig]);

  // 移除自定义翻译
  const removeCustomTranslation = useCallback(async (
    language: string,
    namespace: string,
    key: string
  ) => {
    if (!i18nConfig) return;
    
    const customTranslations = { ...(i18nConfig).customTranslations };
    if (customTranslations[language]?.[namespace]?.[key]) {
      delete customTranslations[language][namespace][key];
      
      // 清理空的对象
      if (Object.keys(customTranslations[language][namespace]).length === 0) {
        delete customTranslations[language][namespace];
      }
      if (Object.keys(customTranslations[language]).length === 0) {
        delete customTranslations[language];
      }
      
      await updateI18nConfig({ customTranslations });
    }
  }, [i18nConfig, updateI18nConfig]);

  return {
    // 配置数据
    config: i18nConfig,
    isLoading,
    
    // 当前状态
    currentLanguage: getCurrentLanguage(),
    
    // 操作方法
    switchLanguage,
    toggleAutoDetect,
    updateSupportedLanguages,
    updateFallbackLanguage,
    updateDateTimeFormat,
    updateNumberFormat,
    addCustomTranslation,
    removeCustomTranslation,
  };
};
