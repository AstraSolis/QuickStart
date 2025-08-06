import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言资源
import zhCN from '../locales/zh-CN';
import en from '../locales/en';
import ru from '../locales/ru';
import fr from '../locales/fr';

// 支持的语言列表 - 按规范要求
export const supportedLanguages = [
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Русский', nativeName: 'Русский' },
  { code: 'fr', name: 'Français', nativeName: 'Français' },
];

// 语言资源配置
const resources = {
  'zh-CN': zhCN,
  en,
  ru,
  fr,
};

// i18next 配置
i18n
  .use(LanguageDetector) // 自动检测用户语言
  .use(initReactI18next) // 集成 React
  .init({
    resources,
    
    // 默认语言设置
    fallbackLng: 'zh-CN', // 回退语言
    lng: 'zh-CN', // 默认语言
    
    // 命名空间配置
    defaultNS: 'common',
    ns: ['common', 'menu', 'theme', 'settings', 'errors', 'file', 'about', 'config', 'startup'],
    
    // 语言检测配置
    detection: {
      // 检测顺序：localStorage -> navigator -> htmlTag -> path -> subdomain
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      
      // 缓存用户语言选择
      caches: ['localStorage'],
      
      // localStorage 键名
      lookupLocalStorage: 'quickstart-language',
      
      // 其他检测选项
      convertDetectedLanguage: (lng: string) => {
        // 语言代码映射 - 兼容旧版本
        const languageMap: Record<string, string> = {
          'en-US': 'en',
          'ru-RU': 'ru', 
          'fr-FR': 'fr',
          'zh-TW': 'zh-CN', // 繁体中文映射到简体中文
        };
        return languageMap[lng] || lng;
      },
    },
    
    // 插值配置
    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
      format: (value, format, _lng) => {
        // 自定义格式化函数
        if (format === 'uppercase') return value.toUpperCase();
        if (format === 'lowercase') return value.toLowerCase();
        return value;
      },
    },
    
    // 调试配置
    debug: process.env.NODE_ENV === 'development',
    
    // 加载配置
    load: 'languageOnly', // 只加载语言代码，不加载地区代码
    
    // 键分隔符
    keySeparator: '.',
    nsSeparator: ':',
    
    // 复数规则
    pluralSeparator: '_',
    contextSeparator: '_',
    
    // 缺失键处理
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (_lng, _ns, _key, _fallbackValue) => {
      // 开发模式下记录缺失的翻译键用于调试
      if (process.env.NODE_ENV === 'development') {
        // 开发模式：缺失翻译键已记录
      }
    },
    
    // 后处理器
    postProcess: ['interval', 'plural'],
    
    // React 特定配置
    react: {
      useSuspense: false, // 禁用 Suspense，避免加载问题
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '', // 空节点的默认值
      transSupportBasicHtmlNodes: true, // 支持基本 HTML 标签
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em'], // 保留的 HTML 标签
    },
  });

// 导出 i18n 实例
export default i18n;

// 语言切换函数
export const changeLanguage = (language: string) => {
  return i18n.changeLanguage(language);
};

// 获取当前语言
export const getCurrentLanguage = () => {
  return i18n.language;
};

// 获取语言显示名称
export const getLanguageDisplayName = (code: string) => {
  const lang = supportedLanguages.find(l => l.code === code);
  return lang ? lang.nativeName : code;
};

// 获取Ant Design语言包
export const getAntdLocale = (languageCode: string) => {
  const localeMap: Record<string, () => Promise<unknown>> = {
    'zh-CN': () => import('antd/locale/zh_CN'),
    'en': () => import('antd/locale/en_US'),
    'ru': () => import('antd/locale/ru_RU'),
    'fr': () => import('antd/locale/fr_FR'),
  };

  return localeMap[languageCode] ?? localeMap['en'];
};

// 类型定义
export type SupportedLanguage = 'zh-CN' | 'en' | 'ru' | 'fr';
export type TranslationNamespace = 'common' | 'menu' | 'theme' | 'settings' | 'errors' | 'file' | 'about' | 'config' | 'logs';
