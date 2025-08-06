import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入语言资源 - 统一使用主目录的翻译文件
import zhCN from '../../locales/zh-CN';
import en from '../../locales/en';
import ru from '../../locales/ru';
import fr from '../../locales/fr';

// 支持的语言列表 - 与主进程保持一致
export const supportedLanguages = [
  { code: 'zh-CN', name: '简体中文', nativeName: '简体中文' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Русский', nativeName: 'Русский' },
  { code: 'fr', name: 'Français', nativeName: 'Français' },
];

// 语言资源配置 - 统一语言代码格式
const resources = {
  'zh-CN': zhCN,
  en,
  ru,
  fr,
};

// 异步初始化i18n，从主进程获取语言设置
const initializeI18n = async () => {
  let initialLanguage = 'zh-CN'; // 默认语言

  try {
    // 等待ElectronAPI可用
    let attempts = 0;
    const maxAttempts = 50; // 最多等待5秒

    while (attempts < maxAttempts && !window.electronAPI?.i18n?.getLanguage) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    // 从主进程获取当前语言设置
    if (window.electronAPI?.i18n?.getLanguage) {
      const mainLanguage = await window.electronAPI.i18n.getLanguage();
      if (mainLanguage) {
        initialLanguage = mainLanguage;
        console.log(`Renderer: Loading language from main process: ${initialLanguage}`);
      }
    } else {
      // 渲染进程启动时ElectronAPI不可用，使用英文日志是合理的
      console.warn('Renderer: ElectronAPI not available, using default language');
    }
  } catch (error) {
    // 渲染进程启动时获取语言失败，使用英文日志是合理的
    console.warn('Renderer: Failed to get language from main process, using default:', error);
  }

  // i18next 配置
  return i18n
    .use(LanguageDetector) // 自动检测用户语言
    .use(initReactI18next) // 集成 React
    .init({
      resources,

      // 默认语言设置
      fallbackLng: 'zh-CN', // 回退语言
      lng: initialLanguage, // 使用从主进程获取的语言

      // 命名空间配置 - 与主进程保持一致
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
        convertDetectedLanguage: (lng: string) => lng,
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
};

// 先用默认配置初始化i18n，稍后会更新语言
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    lng: 'zh-CN', // 临时使用默认语言
    defaultNS: 'common',
    ns: ['common', 'menu', 'theme', 'settings', 'errors', 'file', 'about', 'config', 'startup'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
      lookupLocalStorage: 'quickstart-language',
      convertDetectedLanguage: (lng: string) => lng,
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em'],
    },
  });

// 异步更新语言设置
const updateLanguageFromMain = async () => {
  try {
    // 等待ElectronAPI可用
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts && !window.electronAPI?.i18n?.getLanguage) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.electronAPI?.i18n?.getLanguage) {
      const mainLanguage = await window.electronAPI.i18n.getLanguage();
      if (mainLanguage && mainLanguage !== i18n.language) {
        console.log(`Renderer: Updating language from main process: ${mainLanguage}`);
        await i18n.changeLanguage(mainLanguage);
      }
    }
  } catch (error) {
    console.warn('Renderer: Failed to update language from main process:', error);
  }
};

// 启动语言同步
updateLanguageFromMain();

// 导出 i18n 实例和初始化函数
export { initializeI18n, updateLanguageFromMain };
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

// 检查是否支持某种语言
export const isSupportedLanguage = (code: string) => {
  return supportedLanguages.some(l => l.code === code);
};

// 获取浏览器语言对应的支持语言
export const getBrowserLanguage = () => {
  const browserLang = navigator.language || navigator.languages?.[0];
  
  // 精确匹配
  if (isSupportedLanguage(browserLang)) {
    return browserLang;
  }
  
  // 语言代码匹配（忽略地区）
  const langCode = browserLang.split('-')[0];
  const matchedLang = supportedLanguages.find(l => l.code.startsWith(langCode));
  
  return matchedLang ? matchedLang.code : 'zh-CN';
};
