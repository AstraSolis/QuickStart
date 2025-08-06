import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { theme, type ThemeConfig as AntdThemeConfig } from 'antd';
import type { ThemeConfigSchema } from '@shared/config-schemas';

// 使用统一的主题配置类型（从config-schemas导入）
export type ThemeConfig = ThemeConfigSchema;

// 默认主题配置（使用统一的配置Schema）
const defaultThemeConfig: ThemeConfig = {
  version: '1.0.0',
  activeTheme: 'default',
  mode: 'light',
  primaryColor: '#1890ff',
  borderRadius: 8,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
};

// 暗黑模式配置
const darkThemeConfig: ThemeConfig = {
  ...defaultThemeConfig,
  mode: 'dark',
  customColors: {
    surface: '#1f1f1f',
    text: '#ffffff',
    textSecondary: '#a6a6a6',
    border: '#434343',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
};

// 主题上下文类型
interface ThemeContextType {
  themeConfig: ThemeConfig;
  updateTheme: (updates: Partial<ThemeConfig>) => void;
  toggleMode: () => void;
  resetTheme: () => void;
  antdTheme: AntdThemeConfig;
}

// 创建主题上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 主题提供者组件
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(defaultThemeConfig);

  // 检测系统主题偏好
  const detectSystemTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // 安全合并主题配置，只合并预期的属性
  const safelyMergeThemeConfig = (base: ThemeConfig, saved: any): ThemeConfig => {
    // 定义允许的customColors属性
    const allowedColorKeys = ['surface', 'text', 'textSecondary', 'border', 'shadow'];

    // 安全合并customColors，只保留预期的属性
    const safeCustomColors = { ...base.customColors };
    if (saved.customColors && typeof saved.customColors === 'object') {
      allowedColorKeys.forEach(key => {
        if (typeof saved.customColors[key] === 'string') {
          (safeCustomColors as any)[key] = saved.customColors[key];
        }
      });
    }

    // 安全合并其他属性
    return {
      version: base.version, // 保持版本信息
      activeTheme: typeof saved.activeTheme === 'string' ? saved.activeTheme : base.activeTheme,
      mode: ['light', 'dark', 'auto'].includes(saved.mode) ? saved.mode : base.mode,
      primaryColor: typeof saved.primaryColor === 'string' ? saved.primaryColor : base.primaryColor,
      borderRadius: typeof saved.borderRadius === 'number' ? saved.borderRadius : base.borderRadius,
      fontFamily: typeof saved.fontFamily === 'string' ? saved.fontFamily : base.fontFamily,
      fontSize: typeof saved.fontSize === 'number' ? saved.fontSize : base.fontSize,
      compactMode: typeof saved.compactMode === 'boolean' ? saved.compactMode : base.compactMode,
      glassEffect: typeof saved.glassEffect === 'boolean' ? saved.glassEffect : base.glassEffect,
      glassOpacity: typeof saved.glassOpacity === 'number' ? saved.glassOpacity : base.glassOpacity,
      customColors: safeCustomColors,
      customThemes: saved.customThemes && typeof saved.customThemes === 'object' ? saved.customThemes : base.customThemes,
    };
  };

  // 从localStorage加载主题配置
  useEffect(() => {
    // 首先清理可能存在的错误配置
    const wasCleanedUp = cleanupThemeConfig();

    const savedTheme = localStorage.getItem('quickstart-theme');
    if (savedTheme && !wasCleanedUp) {
      try {
        const parsed = JSON.parse(savedTheme);
        const safeConfig = safelyMergeThemeConfig(defaultThemeConfig, parsed);
        setThemeConfig(safeConfig);
      } catch (error) {
        console.error('Failed to parse saved theme:', error);
        // 如果解析失败，清理localStorage并使用系统主题
        localStorage.removeItem('quickstart-theme');
        const systemTheme = detectSystemTheme();
        setThemeConfig({
          ...defaultThemeConfig,
          mode: systemTheme,
          ...(systemTheme === 'dark' ? { customColors: darkThemeConfig.customColors } : {})
        });
      }
    } else {
      // 如果没有保存的主题或已清理，使用系统主题
      const systemTheme = detectSystemTheme();
      setThemeConfig({
        ...defaultThemeConfig,
        mode: systemTheme,
        ...(systemTheme === 'dark' ? { customColors: darkThemeConfig.customColors } : {})
      });
    }
  }, []);

  // 监听系统主题变化
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleThemeChange = (e: MediaQueryListEvent) => {
        const systemTheme = e.matches ? 'dark' : 'light';
        // 只有在用户没有手动设置主题时才自动切换
        const savedTheme = localStorage.getItem('quickstart-theme');
        if (!savedTheme) {
          setThemeConfig(prev => ({
            ...prev,
            mode: systemTheme,
            ...(systemTheme === 'dark' ? darkThemeConfig.customColors : defaultThemeConfig.customColors)
          }));
        }
      };

      mediaQuery.addEventListener('change', handleThemeChange);
      return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }
  }, []);

  // 保存主题配置到localStorage并应用主题
  useEffect(() => {
    localStorage.setItem('quickstart-theme', JSON.stringify(themeConfig));

    // 更新CSS变量和data-theme属性
    const root = document.documentElement;

    // 设置主题模式
    root.setAttribute('data-theme', themeConfig.mode);

    // 更新基础CSS变量
    root.style.setProperty('--primary-color', themeConfig.primaryColor);
    root.style.setProperty('--border-radius', `${themeConfig.borderRadius}px`);
    root.style.setProperty('--font-family', themeConfig.fontFamily);
    root.style.setProperty('--font-size', `${themeConfig.fontSize}px`);
    root.style.setProperty('--glass-opacity', themeConfig.glassOpacity.toString());

    // 设置自定义颜色变量
    Object.entries(themeConfig.customColors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // 设置毛玻璃效果
    if (themeConfig.glassEffect) {
      const glassOpacity = themeConfig.mode === 'dark' ? 0.7 : themeConfig.glassOpacity;
      const glassColor = themeConfig.mode === 'dark'
        ? `rgba(28, 28, 30, ${glassOpacity})`
        : `rgba(255, 255, 255, ${glassOpacity})`;

      root.style.setProperty('--glass-backdrop-filter', `blur(20px) saturate(180%)`);
      root.style.setProperty('--glass-background', glassColor);

      if (themeConfig.mode === 'dark') {
        root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
      } else {
        root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.2)');
      }
    } else {
      root.style.setProperty('--glass-backdrop-filter', 'none');
      root.style.setProperty('--glass-background', themeConfig.customColors.surface);
      root.style.setProperty('--glass-border', themeConfig.customColors.border);
    }

    // 移除全局transition，避免影响Drawer模糊效果
    // root.style.setProperty('transition', 'background-color 0.3s ease, color 0.3s ease');
  }, [themeConfig]);

  // 更新主题配置 - 使用安全合并
  const updateTheme = (updates: Partial<ThemeConfig>) => {
    setThemeConfig(prev => {
      const newConfig = { ...prev };

      // 安全更新基础属性
      if (updates.mode && ['light', 'dark', 'auto'].includes(updates.mode)) {
        newConfig.mode = updates.mode;
      }
      if (typeof updates.primaryColor === 'string') {
        newConfig.primaryColor = updates.primaryColor;
      }
      if (typeof updates.borderRadius === 'number') {
        newConfig.borderRadius = updates.borderRadius;
      }
      if (typeof updates.fontFamily === 'string') {
        newConfig.fontFamily = updates.fontFamily;
      }
      if (typeof updates.fontSize === 'number') {
        newConfig.fontSize = updates.fontSize;
      }
      if (typeof updates.compactMode === 'boolean') {
        newConfig.compactMode = updates.compactMode;
      }
      if (typeof updates.activeTheme === 'string') {
        newConfig.activeTheme = updates.activeTheme;
      }
      if (typeof updates.glassEffect === 'boolean') {
        newConfig.glassEffect = updates.glassEffect;
      }
      if (typeof updates.glassOpacity === 'number') {
        newConfig.glassOpacity = updates.glassOpacity;
      }

      // 安全更新customColors，只允许预定义的属性
      if (updates.customColors && typeof updates.customColors === 'object') {
        const allowedColorKeys = ['surface', 'text', 'textSecondary', 'border', 'shadow'];
        const safeCustomColors = { ...prev.customColors };

        allowedColorKeys.forEach(key => {
          if (typeof (updates.customColors as any)![key] === 'string') {
            (safeCustomColors as any)[key] = (updates.customColors as any)![key];
          }
        });

        newConfig.customColors = safeCustomColors;
      }

      // 安全更新自定义主题
      if (updates.customThemes && typeof updates.customThemes === 'object') {
        newConfig.customThemes = { ...newConfig.customThemes, ...updates.customThemes };
      }

      return newConfig;
    });
  };

  // 切换明暗模式
  const toggleMode = () => {
    let newMode: 'light' | 'dark' | 'auto';
    switch (themeConfig.mode) {
      case 'light':
        newMode = 'dark';
        break;
      case 'dark':
        newMode = 'auto';
        break;
      case 'auto':
      default:
        newMode = 'light';
        break;
    }

    const newConfig = newMode === 'dark' ? darkThemeConfig : defaultThemeConfig;
    setThemeConfig(prev => ({ ...newConfig, ...prev, mode: newMode }));
  };

  // 重置主题
  const resetTheme = () => {
    // 清理localStorage中的主题配置
    localStorage.removeItem('quickstart-theme');
    setThemeConfig(defaultThemeConfig);
  };

  // 清理localStorage中的错误配置（开发环境专用）
  const cleanupThemeConfig = () => {
    if (process.env.NODE_ENV === 'development') {
      const savedTheme = localStorage.getItem('quickstart-theme');
      if (savedTheme) {
        try {
          const parsed = JSON.parse(savedTheme);
          // 检查是否包含不应该存在的属性
          if (parsed.customColors?.background) {
            console.warn('Found invalid background property in theme config, cleaning up...');
            localStorage.removeItem('quickstart-theme');
            return true;
          }
        } catch (error) {
          console.warn('Invalid theme config found, cleaning up...');
          localStorage.removeItem('quickstart-theme');
          return true;
        }
      }
    }
    return false;
  };

  // 生成Ant Design主题配置
  const getEffectiveMode = () => {
    if (themeConfig.mode === 'auto') {
      return detectSystemTheme();
    }
    return themeConfig.mode;
  };

  const antdTheme = {
    algorithm: getEffectiveMode() === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: themeConfig.primaryColor,
      borderRadius: themeConfig.borderRadius,
      fontFamily: themeConfig.fontFamily,
      fontSize: themeConfig.fontSize,
      colorBgContainer: themeConfig.customColors.surface,
      colorBgElevated: themeConfig.customColors.surface,
      colorText: themeConfig.customColors.text,
      colorTextSecondary: themeConfig.customColors.textSecondary,
      colorBorder: themeConfig.customColors.border,
      boxShadow: `0 2px 8px ${themeConfig.customColors.shadow}`,
    },
    components: {
      Layout: {
        bodyBg: 'transparent', // 让背景系统控制背景
        siderBg: themeConfig.customColors.surface,
        headerBg: themeConfig.customColors.surface,
      },
      Menu: {
        itemBg: 'transparent',
        itemSelectedBg: `${themeConfig.primaryColor}15`,
        itemHoverBg: `${themeConfig.primaryColor}08`,
      },
      Button: {
        borderRadius: themeConfig.borderRadius,
      },
      Card: {
        borderRadius: themeConfig.borderRadius,
      },
    },
  };

  const contextValue: ThemeContextType = {
    themeConfig,
    updateTheme,
    toggleMode,
    resetTheme,
    antdTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// 自定义Hook使用主题
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
