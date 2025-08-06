import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useRef } from 'react';
import type { TranslationNamespace } from '../i18n';

// 文本元素类型
export type ElementType = 'text' | 'button' | 'heading' | 'tooltip' | 'placeholder' | 'aria-label';

// 标记选项
export interface MarkerOptions {
  elementType?: ElementType;
  isDynamic?: boolean;
  context?: string;
}

// Hook配置选项
export interface UseTranslationWithMarkerOptions {
  componentName: string;
  enableMarker?: boolean;
  debug?: boolean;
}

// 文本元素注册表
interface TextElement {
  id: string;
  key: string;
  defaultValue: string;
  elementType: ElementType;
  isDynamic: boolean;
  context?: string;
  componentName: string;
  timestamp: number;
}

// 全局文本元素管理器
class TextElementManager {
  private elements = new Map<string, TextElement>();
  private listeners = new Set<() => void>();

  register(element: TextElement) {
    this.elements.set(element.id, element);
    this.notifyListeners();
  }

  unregister(id: string) {
    this.elements.delete(id);
    this.notifyListeners();
  }

  getElements(): TextElement[] {
    return Array.from(this.elements.values());
  }

  addListener(listener: () => void) {
    this.listeners.add(listener);
  }

  removeListener(listener: () => void) {
    this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  // 清理过期元素
  cleanup(maxAge: number = 60000) {
    const now = Date.now();
    const toDelete: string[] = [];
    
    this.elements.forEach((element, id) => {
      if (now - element.timestamp > maxAge) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.unregister(id));
  }
}

// 全局实例
const textElementManager = new TextElementManager();

// 定期清理过期元素
if (typeof window !== 'undefined') {
  setInterval(() => {
    textElementManager.cleanup();
  }, 30000);
}

/**
 * 带文本标记功能的翻译Hook
 * 
 * @param namespace - 翻译命名空间
 * @param options - Hook配置选项
 * @returns 翻译函数和相关工具
 */
export function useTranslationWithMarker(
  namespace: TranslationNamespace,
  options: UseTranslationWithMarkerOptions
) {
  const { t: originalT, i18n } = useTranslation(namespace);
  const { componentName, enableMarker = true, debug = false } = options;
  const elementIdCounter = useRef(0);

  // 生成唯一ID
  const generateElementId = useCallback(() => {
    return `${componentName}-${++elementIdCounter.current}-${Date.now()}`;
  }, [componentName]);

  // 增强的翻译函数
  const t = useCallback((
    key: string,
    defaultValue: string,
    interpolationOptions?: Record<string, unknown>,
    markerOptions?: MarkerOptions
  ): string => {
    const translatedText = originalT(key, defaultValue, interpolationOptions);

    // 如果启用标记功能，注册文本元素
    if (enableMarker) {
      const elementId = generateElementId();
      const element: TextElement = {
        id: elementId,
        key,
        defaultValue,
        elementType: markerOptions?.elementType ?? 'text',
        isDynamic: markerOptions?.isDynamic ?? false,
        context: markerOptions?.context,
        componentName,
        timestamp: Date.now(),
      };

      textElementManager.register(element);

      // 调试模式下输出信息
      if (debug) {
        console.log(`[i18n-marker] Registered text element:`, {
          id: elementId,
          key,
          text: translatedText,
          component: componentName,
        });
      }
    }

    return translatedText;
  }, [originalT, enableMarker, generateElementId, componentName, debug]);

  // 语言切换函数
  const changeLanguage = useCallback(async (language: string) => {
    try {
      await i18n.changeLanguage(language);
      
      if (debug) {
        console.log(`[i18n-marker] Language changed to: ${language} in component: ${componentName}`);
      }
      
      return true;
    } catch (error) {
      console.error(`[i18n-marker] Failed to change language:`, error);
      return false;
    }
  }, [i18n, debug, componentName]);

  // 获取当前语言
  const currentLanguage = i18n.language;

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 清理该组件注册的所有元素
      const elements = textElementManager.getElements();
      elements
        .filter(el => el.componentName === componentName)
        .forEach(el => textElementManager.unregister(el.id));
    };
  }, [componentName]);

  return {
    t,
    changeLanguage,
    currentLanguage,
    // 工具函数
    getRegisteredElements: () => textElementManager.getElements().filter(el => el.componentName === componentName),
    clearElements: () => {
      const elements = textElementManager.getElements();
      elements
        .filter(el => el.componentName === componentName)
        .forEach(el => textElementManager.unregister(el.id));
    },
  };
}

// 导出文本元素管理器（用于调试和监控）
export { textElementManager };
