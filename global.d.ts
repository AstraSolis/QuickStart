/**
 * QuickStart 全局类型声明文件
 * 解决 TypeScript 编译警告和类型问题
 */

// 配置相关类型定义 - 声明为全局类型
declare global {
  // 浏览器全局变量类型声明
  interface Performance {
    now(): number;
    mark(name: string): void;
    measure(name: string, startMark?: string, endMark?: string): void;
    getEntriesByType(type: string): PerformanceEntry[];
    getEntriesByName(name: string, type?: string): PerformanceEntry[];
    clearMarks(name?: string): void;
    clearMeasures(name?: string): void;
  }

  interface PerformanceEntry {
    name: string;
    entryType: string;
    startTime: number;
    duration: number;
  }

  const performance: Performance;

  function requestAnimationFrame(callback: (time: number) => void): number;
  function cancelAnimationFrame(id: number): void;

  function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;

  class Image {
    constructor();
    src: string;
    width: number;
    height: number;
    onload: ((this: GlobalEventHandlers, ev: Event) => any) | null;
    onerror: ((this: GlobalEventHandlers, ev: Event) => any) | null;
  }

  // Node.js全局变量（用于主进程）
  namespace NodeJS {
    interface Global {
      performance: Performance;
    }
  }
  interface ConfigValue {
    [key: string]: unknown;
  }

  interface BackupInfo {
    filename: string;
    timestamp: number;
    configType: string;
    size: number;
    description?: string;
  }

  interface FileInfo {
    name: string;
    path: string;
    size: number;
    lastModified: string;
    isDirectory: boolean;
    extension?: string;
  }

  interface ThemeConfig {
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
    borderColor: string;
    mode: 'light' | 'dark';
    [key: string]: unknown;
  }

  interface SystemInfo {
    platform: string;
    arch: string;
    version: string;
    totalMemory: number;
    freeMemory: number;
    cpuCount: number;
    [key: string]: unknown;
  }

  interface TranslationData {
    [key: string]: string | TranslationData;
  }
}

// 引用共享的类型定义
// ElectronAPI接口定义在 src/shared/ipc-types.ts 中

// Window接口扩展在 src/shared/ipc-types.ts 中定义

// 模块声明
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.less' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

// Node.js 环境变量类型
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    ELECTRON_IS_DEV?: string;
    ELECTRON_RENDERER_URL?: string;
  }
}

// Ant Design 颜色选择器类型补充
declare module 'antd/es/color-picker' {
  export interface Color {
    toHex: () => string;
    toHexString: () => string;
    toRgb: () => { r: number; g: number; b: number; a?: number };
    toRgbString: () => string;
    toHsl: () => { h: number; s: number; l: number; a?: number };
    toHslString: () => string;
  }
}

export {};
