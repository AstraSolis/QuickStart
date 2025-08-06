import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ConfigProvider, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Locale } from 'antd/es/locale';
import type { SupportedLanguage } from '../i18n';

// 动态导入Ant Design语言包
const antdLocales: Record<SupportedLanguage, () => Promise<{ default: Locale }>> = {
  'zh-CN': () => import('antd/locale/zh_CN'),
  'en': () => import('antd/locale/en_US'),
  'ru': () => import('antd/locale/ru_RU'),
  'fr': () => import('antd/locale/fr_FR'),
};

// 上下文类型
interface I18nContextType {
  currentLanguage: SupportedLanguage;
  antdLocale: Locale | null;
  changeLanguage: (language: SupportedLanguage) => Promise<boolean>;
  isLoading: boolean;
}

// 创建上下文
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 上下文Provider组件
interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const { i18n } = useTranslation();
  const [antdLocale, setAntdLocale] = useState<Locale | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const currentLanguage = i18n.language as SupportedLanguage;

  // 加载Ant Design语言包
  const loadAntdLocale = async (language: SupportedLanguage) => {
    try {
      setIsLoading(true);
      const localeModule = await antdLocales[language]();
      setAntdLocale(localeModule.default);
    } catch (error) {
      console.error(`Failed to load Ant Design locale for ${language}:`, error);
      // 回退到英语
      try {
        const fallbackModule = await antdLocales['en']();
        setAntdLocale(fallbackModule.default);
      } catch (fallbackError) {
        console.error('Failed to load fallback Ant Design locale:', fallbackError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 语言切换函数
  const changeLanguage = async (language: SupportedLanguage): Promise<boolean> => {
    try {
      setIsLoading(true);
      console.log(`Attempting to change language to: ${language}`);

      // 首先通过IPC通知主进程更新语言并保存到配置文件
      if (window.electronAPI?.i18n?.setLanguage) {
        const result = await window.electronAPI.i18n.setLanguage(language) as { success: boolean; error?: string };
        if (!result.success) {
          console.error('Failed to set language in main process:', result.error);
          return false;
        }
        console.log('Main process language updated and saved to config file');
      } else {
        console.warn('ElectronAPI i18n not available, language may not persist');
      }

      // 然后切换渲染进程的i18next语言
      await i18n.changeLanguage(language);

      // 加载对应的Ant Design语言包
      await loadAntdLocale(language);

      console.log(`Language changed successfully to: ${language}`);
      return true;
    } catch (error) {
      console.error('Failed to change language:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 监听语言变化
  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const language = lng as SupportedLanguage;
      if (antdLocales[language]) {
        loadAntdLocale(language);
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    
    // 初始加载
    if (currentLanguage && antdLocales[currentLanguage]) {
      loadAntdLocale(currentLanguage);
    }

    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
  }, [i18n, currentLanguage]);

  const contextValue: I18nContextType = {
    currentLanguage,
    antdLocale,
    changeLanguage,
    isLoading,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      <ConfigProvider
        locale={antdLocale ?? undefined}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 8,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          },
        }}
      >
        {children}
      </ConfigProvider>
    </I18nContext.Provider>
  );
};

// Hook for using I18n context
export const useI18nContext = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18nContext must be used within an I18nProvider');
  }
  return context;
};

// 导出类型
export type { I18nContextType, SupportedLanguage };
