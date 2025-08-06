/**
 * Jest 测试环境设置文件
 * 配置全局测试环境和模拟对象
 *
 * 注意：这是一个设置文件，不包含测试用例
 */

// 导入测试库
import '@testing-library/jest-dom';

// 模拟 Electron API
const mockElectronAPI = {
  // 配置管理
  config: {
    get: jest.fn(),
    set: jest.fn(),
    getAll: jest.fn(),
    reset: jest.fn(),
    backup: jest.fn(),
    restore: jest.fn()
  },
  
  // 文件管理
  file: {
    add: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    launch: jest.fn(),
    selectFile: jest.fn(),
    select: jest.fn()
  },
  
  // 窗口管理
  window: {
    minimize: jest.fn(),
    maximize: jest.fn(),
    close: jest.fn(),
    setAlwaysOnTop: jest.fn()
  },
  
  // 系统信息
  system: {
    getVersion: jest.fn(() => '1.0.0'),
    getPlatform: jest.fn(() => 'win32'),
    getPath: jest.fn()
  }
};

// 全局模拟 window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

// 模拟 localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// 模拟 sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: localStorageMock,
  writable: true
});

// 模拟 matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// 模拟 ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// 模拟 IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// 抑制 console.error 在测试中的输出（除非是真正的错误）
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// 每个测试前重置所有模拟
beforeEach(() => {
  jest.clearAllMocks();
});
