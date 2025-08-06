/**
 * QuickStart 配置文件 Schema 定义
 * 用于验证和管理各类配置文件的数据结构
 */

// 应用程序基础设置 Schema
export interface AppSettingsSchema {
  version: string;
  window: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    maximized: boolean;
    alwaysOnTop: boolean;
    minWidth?: number;
    minHeight?: number;
  };
  startup: {
    autoLaunch: boolean;
    minimizeToTray: boolean;
    showSplashScreen: boolean;
    checkForUpdates: boolean;
  };
  performance: {
    enableHardwareAcceleration: boolean;
    maxCacheSize: number; // MB
    enableVirtualization: boolean;
    maxBackgroundProcesses: number;
  };

}

// 主题配置 Schema
export interface ThemeConfigSchema {
  version: string;
  activeTheme: string;
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  borderRadius: number;
  fontFamily: string;
  fontSize: number;
  compactMode: boolean;
  glassEffect: boolean;
  glassOpacity: number;
  customColors: {
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    shadow: string;
  };
  customThemes: {
    [themeName: string]: {
      name: string;
      description?: string;
      colors: {
        primary: string;
        secondary?: string;
        background: string;
        surface: string;
        text: string;
        textSecondary: string;
        border: string;
        shadow: string;
      };
      fonts: {
        family: string;
        size: number;
        weight: number;
      };
      effects: {
        blur: number;
        transparency: number;
        shadows: boolean;
        borderRadius: number;
      };
    };
  };
}

// 布局配置 Schema
export interface LayoutConfigSchema {
  version: string;
  sidebar: {
    width: number;
    collapsed: boolean;
    position: 'left' | 'right';
    autoHide: boolean;
  };
  fileList: {
    showSize: boolean;
    showModifiedTime: boolean;
    showAddedTime: boolean;
    showLaunchCount: boolean;
    itemsPerPage: number;
  };
  toolbar: {
    visible: boolean;
    position: 'top' | 'bottom';
    showLabels: boolean;
    customButtons: string[];
  };
  statusBar: {
    visible: boolean;
    showFileCount: boolean;
    showSelectedCount: boolean;
    showPath: boolean;
  };
}

// 国际化配置 Schema
export interface I18nConfigSchema {
  version: string;
  currentLanguage: string;
  fallbackLanguage: string;
  supportedLanguages: string[];
  autoDetect: boolean;
  dateFormat: string;
  timeFormat: string;
  numberFormat: {
    decimal: string;
    thousands: string;
    currency: string;
  };
  customTranslations: {
    [language: string]: {
      [namespace: string]: {
        [key: string]: string;
      };
    };
  };
  // 新增：i18n系统配置（仅用于文档记录，实际使用硬编码常量）
  system: {
    localStorageKey: string; // localStorage键名（系统常量）
    debugMode: boolean; // 调试模式
    namespaces: string[]; // 命名空间列表（系统常量）
    detectionOrder: string[]; // 语言检测顺序（系统常量）
    cacheEnabled: boolean; // 缓存启用
  };
}

// 背景配置 Schema
export interface BackgroundConfigSchema {
  version: string;
  enabled: boolean;
  type: 'none' | 'color' | 'gradient' | 'image' | 'url';

  // 纯色背景
  color: {
    value: string; // HEX颜色值
    opacity: number; // 透明度 0-1
  };

  // 渐变背景
  gradient: {
    type: 'linear' | 'radial' | 'conic';
    direction: number; // 角度 0-360
    colors: Array<{
      color: string; // HEX颜色值
      position: number; // 位置 0-100
    }>;
    opacity: number; // 透明度 0-1
  };

  // 图片背景
  image: {
    source: 'local' | 'url';
    path?: string; // 本地图片路径
    url?: string; // 网络图片URL
    displayMode: 'stretch' | 'tile' | 'center' | 'cover' | 'contain';
    opacity: number; // 透明度 0-1
    blur: number; // 模糊度 0-20
    brightness: number; // 亮度 0-200
    contrast: number; // 对比度 0-200
    saturation: number; // 饱和度 0-200
    position: {
      x: number; // 水平位置 0-100
      y: number; // 垂直位置 0-100
    };
    scale: number; // 缩放比例 0.1-5.0
    rotation: number; // 旋转角度 0-360
  };

  // 背景历史记录
  history: Array<{
    id: string;
    name: string;
    type: 'color' | 'gradient' | 'image' | 'url';
    config: BackgroundConfigSchema['color'] | BackgroundConfigSchema['gradient'] | BackgroundConfigSchema['image']; // 对应的配置数据
    createdAt: string;
    lastUsed: string;
    useCount: number;
    isFavorite: boolean;
    tags?: string[];
  }>;

  // 背景收藏夹
  favorites: Array<{
    id: string;
    name: string;
    type: 'color' | 'gradient' | 'image' | 'url';
    config: BackgroundConfigSchema['color'] | BackgroundConfigSchema['gradient'] | BackgroundConfigSchema['image'];
    addedAt: string;
    category?: string;
    tags?: string[];
  }>;

  // 缓存设置
  cache: {
    maxSize: number; // 最大缓存大小 MB
    maxFiles: number; // 最大缓存文件数
    autoCleanup: boolean; // 自动清理
    compressionQuality: number; // 压缩质量 0-100
  };

  // 性能设置
  performance: {
    enableGPUAcceleration: boolean; // GPU加速
    maxImageSize: number; // 最大图片尺寸 像素
    enableLazyLoading: boolean; // 懒加载
    preloadNext: boolean; // 预加载下一张
  };
}

// 用户偏好设置 Schema
export interface UserPreferencesSchema {
  version: string;
  general: {
    confirmBeforeDelete: boolean;
    confirmBeforeExit: boolean;
    rememberWindowState: boolean;
    enableNotifications: boolean;
  };
  fileOperations: {
    defaultAction: 'open' | 'edit' | 'run';
    enableDragDrop: boolean;
    showFileExtensions: boolean;
    enableQuickPreview: boolean;
  };
  shortcuts: {
    [action: string]: string;
  };
  recentFiles: {
    maxCount: number;
    items: Array<{
      path: string;
      name: string;
      lastAccessed: string;
      accessCount: number;
    }>;
  };
  favorites: {
    maxCount: number;
    items: Array<{
      path: string;
      name: string;
      category?: string;
      tags?: string[];
    }>;
  };
}

// 配置文件路径常量
export const CONFIG_PATHS = {
  APP_DATA_DIR: 'QuickStartAPP',
  CONFIG_DIR: 'config',
  CACHE_DIR: 'cache',
  I18N_DIR: 'i18n',
  LOGS_DIR: 'logs',
  BACKUPS_DIR: 'backups',

  // 配置文件名
  APP_SETTINGS: 'app-settings.json',
  THEME_CONFIG: 'theme-config.json',
  LAYOUT_CONFIG: 'layout-config.json',
  I18N_CONFIG: 'i18n-config.json',
  USER_PREFERENCES: 'user-preferences.json',
  BACKGROUND_CONFIG: 'background-config.json',

  // 缓存目录
  BACKGROUND_IMAGES: 'background-images',
  FILE_ICONS: 'file-icons',
  THUMBNAILS: 'thumbnails',

  // 日志文件
  APP_LOG: 'app.log',
  ERROR_LOG: 'error.log',
  DEBUG_LOG: 'debug.log',
} as const;

// 默认配置值
export const DEFAULT_CONFIGS = {
  APP_SETTINGS: {
    version: '1.0.0',
    window: {
      width: 1200,
      height: 800,
      maximized: false,
      alwaysOnTop: false,
      minWidth: 800,
      minHeight: 600,
    },
    startup: {
      autoLaunch: false,
      minimizeToTray: true,
      showSplashScreen: true,
      checkForUpdates: true,
    },
    performance: {
      enableHardwareAcceleration: true,
      maxCacheSize: 100,
      enableVirtualization: true,
      maxBackgroundProcesses: 5,
    },

  } as AppSettingsSchema,

  THEME_CONFIG: {
    version: '1.0.0',
    activeTheme: 'default',
    mode: 'auto' as const,
    primaryColor: '#1890ff',
    borderRadius: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    compactMode: false,
    glassEffect: true,
    glassOpacity: 0.8,
    customColors: {
      surface: '#fafafa',
      text: '#000000',
      textSecondary: '#666666',
      border: '#d9d9d9',
      shadow: 'rgba(0, 0, 0, 0.1)',
    },
    customThemes: {},
  } as ThemeConfigSchema,

  LAYOUT_CONFIG: {
    version: '1.0.0',
    sidebar: {
      width: 240,
      collapsed: false,
      position: 'left' as const,
      autoHide: false,
    },
    fileList: {
      showSize: true,
      showModifiedTime: true,
      showAddedTime: true,
      showLaunchCount: true,
      itemsPerPage: 50,
    },
    toolbar: {
      visible: true,
      position: 'top' as const,
      showLabels: true,
      customButtons: [],
    },
    statusBar: {
      visible: true,
      showFileCount: true,
      showSelectedCount: true,
      showPath: true,
    },
  } as LayoutConfigSchema,

  I18N_CONFIG: {
    version: '1.0.0',
    currentLanguage: 'zh-CN',
    fallbackLanguage: 'en',
    supportedLanguages: ['zh-CN', 'en', 'ru', 'fr'],
    autoDetect: true,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    numberFormat: {
      decimal: '.',
      thousands: ',',
      currency: '¥',
    },
    customTranslations: {},
    system: {
      localStorageKey: 'quickstart-language',
      debugMode: false,
      namespaces: ['common', 'menu', 'theme', 'settings', 'errors', 'file', 'about', 'config', 'logs'],
      detectionOrder: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      cacheEnabled: true,
    },
  } as I18nConfigSchema,

  USER_PREFERENCES: {
    version: '1.0.0',
    general: {
      confirmBeforeDelete: true,
      confirmBeforeExit: false,
      rememberWindowState: true,
      enableNotifications: true,
    },
    fileOperations: {
      defaultAction: 'open' as const,
      enableDragDrop: true,
      showFileExtensions: true,
      enableQuickPreview: true,
    },
    shortcuts: {
      'file.open': 'Ctrl+O',
      'file.refresh': 'F5',
      'app.quit': 'Ctrl+Q',
      'theme.toggle': 'Ctrl+T',
    },
    recentFiles: {
      maxCount: 20,
      items: [],
    },
    favorites: {
      maxCount: 50,
      items: [],
    },
  } as UserPreferencesSchema,

  BACKGROUND_CONFIG: {
    version: '1.0.0',
    enabled: true,
    type: 'color' as const,

    color: {
      value: '#ffffff',
      opacity: 1.0,
    },

    gradient: {
      type: 'linear' as const,
      direction: 45,
      colors: [
        { color: '#1890ff', position: 0 },
        { color: '#52c41a', position: 100 },
      ],
      opacity: 1.0,
    },

    image: {
      source: 'local' as const,
      path: '',
      url: '',
      displayMode: 'cover' as const,
      opacity: 1.0,
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      position: {
        x: 50,
        y: 50,
      },
      scale: 1.0,
      rotation: 0,
    },

    history: [],
    favorites: [],

    cache: {
      maxSize: 500, // 500MB
      maxFiles: 100,
      autoCleanup: true,
      compressionQuality: 85,
    },

    performance: {
      enableGPUAcceleration: true,
      maxImageSize: 4096, // 4K
      enableLazyLoading: true,
      preloadNext: false,
    },
  } as BackgroundConfigSchema,
} as const;
