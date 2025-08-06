/**
 * 性能监控系统
 * 提供主题切换耗时、内存使用、渲染性能分析等功能
 */

// 性能指标类型
export enum MetricType {
  THEME_SWITCH = 'theme_switch',
  RENDER_TIME = 'render_time',
  MEMORY_USAGE = 'memory_usage',
  FPS = 'fps',
  INTERACTION = 'interaction',
  RESOURCE_LOAD = 'resource_load',
  CUSTOM = 'custom',
}

// 性能指标接口
export interface PerformanceMetric {
  id: string;
  type: MetricType;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// 性能标记接口
export interface PerformanceMark {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

// 性能监控配置接口
export interface PerformanceMonitorConfig {
  enabled: boolean;
  sampleInterval: number; // 采样间隔（毫秒）
  maxSamples: number; // 最大样本数
  autoMemorySampling: boolean; // 自动内存采样
  autoFpsSampling: boolean; // 自动FPS采样
  logToConsole: boolean; // 是否输出到控制台
}

// 默认配置
const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  enabled: true,
  sampleInterval: 1000, // 1秒
  maxSamples: 100,
  autoMemorySampling: true,
  autoFpsSampling: true,
  logToConsole: false,
};

/**
 * 性能监控器类
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private config: PerformanceMonitorConfig;
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, PerformanceMark> = new Map();
  private listeners: Map<string, Array<(metric: PerformanceMetric) => void>> = new Map();
  private samplingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private fpsFrames = 0;
  private lastFpsTime = 0;

  private constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeAutoSampling();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(config?: Partial<PerformanceMonitorConfig>): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor(config);
    } else if (config) {
      PerformanceMonitor.instance.updateConfig(config);
    }
    return PerformanceMonitor.instance;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<PerformanceMonitorConfig>): void {
    const prevEnabled = this.config.enabled;
    const prevAutoMemory = this.config.autoMemorySampling;
    const prevAutoFps = this.config.autoFpsSampling;

    this.config = { ...this.config, ...config };

    // 处理启用/禁用状态变化
    if (!prevEnabled && this.config.enabled) {
      this.initializeAutoSampling();
    } else if (prevEnabled && !this.config.enabled) {
      this.stopAllSampling();
    }

    // 处理自动采样设置变化
    if (!prevAutoMemory && this.config.autoMemorySampling) {
      this.startMemorySampling();
    } else if (prevAutoMemory && !this.config.autoMemorySampling) {
      this.stopSampling('memory');
    }

    if (!prevAutoFps && this.config.autoFpsSampling) {
      this.startFpsSampling();
    } else if (prevAutoFps && !this.config.autoFpsSampling) {
      this.stopSampling('fps');
    }
  }

  /**
   * 初始化自动采样
   */
  private initializeAutoSampling(): void {
    if (!this.config.enabled) return;

    if (this.config.autoMemorySampling) {
      this.startMemorySampling();
    }

    if (this.config.autoFpsSampling) {
      this.startFpsSampling();
    }
  }

  /**
   * 开始内存采样
   */
  private startMemorySampling(): void {
    this.stopSampling('memory');
    
    const interval = setInterval(() => {
      if (!this.config.enabled) return;
      
      if (window.performance && (performance as any).memory) {
        const memory = (performance as any).memory;
        this.recordMetric({
          id: `memory_${Date.now()}`,
          type: MetricType.MEMORY_USAGE,
          name: '内存使用',
          value: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
          unit: 'MB',
          timestamp: Date.now(),
          metadata: {
            totalHeapSize: memory.totalJSHeapSize,
            heapLimit: memory.jsHeapSizeLimit,
          },
        });
      }
    }, this.config.sampleInterval);

    this.samplingIntervals.set('memory', interval);
  }

  /**
   * 开始FPS采样
   */
  private startFpsSampling(): void {
    this.stopSampling('fps');
    this.fpsFrames = 0;
    this.lastFpsTime = performance.now();

    const measureFps = () => {
      this.fpsFrames++;
      const now = performance.now();
      const elapsed = now - this.lastFpsTime;

      if (elapsed >= 1000) { // 每秒计算一次
        const fps = Math.round((this.fpsFrames * 1000) / elapsed);
        this.recordMetric({
          id: `fps_${Date.now()}`,
          type: MetricType.FPS,
          name: '帧率',
          value: fps,
          unit: 'FPS',
          timestamp: Date.now(),
        });

        this.fpsFrames = 0;
        this.lastFpsTime = now;
      }

      if (this.config.enabled && this.config.autoFpsSampling) {
        requestAnimationFrame(measureFps);
      }
    };

    requestAnimationFrame(measureFps);
  }

  /**
   * 停止特定采样
   */
  private stopSampling(name: string): void {
    const interval = this.samplingIntervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.samplingIntervals.delete(name);
    }
  }

  /**
   * 停止所有采样
   */
  private stopAllSampling(): void {
    this.samplingIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.samplingIntervals.clear();
  }

  /**
   * 记录性能指标
   */
  public recordMetric(metric: PerformanceMetric): void {
    if (!this.config.enabled) return;

    this.metrics.push(metric);
    
    // 限制样本数量
    if (this.metrics.length > this.config.maxSamples) {
      this.metrics.shift();
    }

    // 通知监听器
    this.notifyListeners(metric);

    // 输出到控制台
    if (this.config.logToConsole) {
      console.log(`[Performance] ${metric.name}: ${metric.value}${metric.unit}`, metric);
    }
  }

  /**
   * 开始性能标记
   */
  public startMark(name: string, metadata?: Record<string, any>): string {
    if (!this.config.enabled) return '';

    const id = `${name}_${Date.now()}`;
    const mark: PerformanceMark = {
      id,
      name,
      startTime: performance.now(),
      metadata,
    };

    this.marks.set(id, mark);
    
    if (this.config.logToConsole) {
      console.log(`[Performance] Started mark: ${name}`, mark);
    }

    return id;
  }

  /**
   * 结束性能标记并记录指标
   */
  public endMark(id: string, type: MetricType = MetricType.CUSTOM): PerformanceMetric | null {
    if (!this.config.enabled) return null;

    const mark = this.marks.get(id);
    if (!mark) {
      console.warn(`[Performance] Mark not found: ${id}`);
      return null;
    }

    mark.endTime = performance.now();
    mark.duration = mark.endTime - mark.startTime;

    const metric: PerformanceMetric = {
      id: `${mark.name}_${Date.now()}`,
      type,
      name: mark.name,
      value: mark.duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata: mark.metadata,
    };

    this.recordMetric(metric);
    this.marks.delete(id);

    return metric;
  }

  /**
   * 测量主题切换性能
   */
  public measureThemeSwitch(callback: () => void, metadata?: Record<string, any>): PerformanceMetric {
    if (!this.config.enabled) {
      callback();
      return {
        id: '',
        type: MetricType.THEME_SWITCH,
        name: '主题切换',
        value: 0,
        unit: 'ms',
        timestamp: Date.now(),
      };
    }

    const startTime = performance.now();
    callback();
    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetric = {
      id: `theme_switch_${Date.now()}`,
      type: MetricType.THEME_SWITCH,
      name: '主题切换',
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      metadata,
    };

    this.recordMetric(metric);
    return metric;
  }

  /**
   * 测量组件渲染性能
   */
  public measureRender(componentName: string): { start: () => void; end: () => PerformanceMetric | null } {
    const markId = this.startMark(`${componentName}_render`);
    
    return {
      start: () => {
        // 已在startMark中开始
      },
      end: () => {
        return this.endMark(markId, MetricType.RENDER_TIME);
      },
    };
  }

  /**
   * 添加指标监听器
   */
  public addListener(type: MetricType, callback: (metric: PerformanceMetric) => void): void {
    const listeners = this.listeners.get(type) || [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  /**
   * 移除指标监听器
   */
  public removeListener(type: MetricType, callback: (metric: PerformanceMetric) => void): void {
    const listeners = this.listeners.get(type) || [];
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
      this.listeners.set(type, listeners);
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(metric: PerformanceMetric): void {
    const typeListeners = this.listeners.get(metric.type) || [];
    const allListeners = this.listeners.get('all') || [];
    
    [...typeListeners, ...allListeners].forEach(listener => {
      try {
        listener(metric);
      } catch (error) {
        console.error('[Performance] Error in listener:', error);
      }
    });
  }

  /**
   * 获取指标历史
   */
  public getMetrics(type?: MetricType, limit?: number): PerformanceMetric[] {
    let result = this.metrics;
    
    if (type) {
      result = result.filter(metric => metric.type === type);
    }
    
    if (limit && limit > 0) {
      result = result.slice(-limit);
    }
    
    return result;
  }

  /**
   * 清除指标历史
   */
  public clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * 获取当前配置
   */
  public getConfig(): PerformanceMonitorConfig {
    return { ...this.config };
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.stopAllSampling();
    this.listeners.clear();
    this.marks.clear();
    this.metrics = [];
  }
}

// 导出单例实例
export const performanceMonitor = PerformanceMonitor.getInstance();
