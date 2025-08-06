import { useTranslation as useReactI18next } from 'react-i18next';
import { useCallback } from 'react';
import type { TranslationNamespace, SupportedLanguage } from '../i18n';

/**
 * 增强的翻译Hook
 * 提供与原有useTranslation兼容的接口，同时支持新的语言代码
 */
export function useTranslation(namespace?: TranslationNamespace | TranslationNamespace[]) {
  const { t: originalT, i18n } = useReactI18next(namespace);

  // 增强的翻译函数
  const t = useCallback((key: string, defaultValue?: string, options?: Record<string, unknown>): string => {
    return originalT(key, defaultValue ?? key, options);
  }, [originalT]);

  // 语言切换函数
  const changeLanguage = useCallback(async (language: SupportedLanguage) => {
    try {
      await i18n.changeLanguage(language);
      return true;
    } catch (error) {
      console.error('Failed to change language:', error);
      return false;
    }
  }, [i18n]);

  // 获取当前语言
  const currentLanguage = i18n.language as SupportedLanguage;

  // 检查语言是否支持
  const isLanguageSupported = useCallback((language: string): language is SupportedLanguage => {
    const supportedLanguages: SupportedLanguage[] = ['zh-CN', 'en', 'ru', 'fr'];
    return supportedLanguages.includes(language as SupportedLanguage);
  }, []);

  return {
    t,
    i18n,
    changeLanguage,
    currentLanguage,
    isLanguageSupported,
    // 保持与原有接口的兼容性
    ready: i18n.isInitialized,
  };
}

// 导出类型
export type { TranslationNamespace, SupportedLanguage };
