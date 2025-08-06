/**
 * 渲染进程性能优化器
 * 优化React组件渲染性能和用户体验
 */

interface RenderMetrics {
  componentRenderTime: number;
  virtualScrollItems: number;
  memoryUsage: number;
  frameRate: number;
}

interface OptimizationConfig {
  enableVirtualScrolling: boolean;
  enableMemoization: boolean;
  enableLazyLoading: boolean;
  maxConcurrentImages: number;
  debounceDelay: number;
}

export class RenderOptimizer {
  private config: OptimizationConfig;
  private metrics: Partial<RenderMetrics> = {};
  private frameRateMonitor: number | null = null;
  private imageLoadQueue: Array<() => Promise<void>> = [];
  private loadingImages = 0;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      enableVirtualScrolling: true,
      enableMemoization: true,
      enableLazyLoading: true,
      maxConcurrentImages: 3,
      debounceDelay: 300,
      ...config
    };
  }

  /**
   * 初始化性能监控
   */
  initializeMonitoring() {
    if (typeof window !== 'undefined' && window.performance) {
      this.startFrameRateMonitoring();
      this.monitorMemoryUsage();
    }
  }

  /**
   * 开始帧率监控
   */
  private startFrameRateMonitoring() {
    let lastTime = performance.now();
    let frameCount = 0;

    const measureFrameRate = () => {
      const currentTime = performance.now();
      frameCount++;

      if (currentTime - lastTime >= 1000) {
        this.metrics.frameRate = frameCount;
        frameCount = 0;
        lastTime = currentTime;
      }

      this.frameRateMonitor = requestAnimationFrame(measureFrameRate);
    };

    measureFrameRate();
  }

  /**
   * 监控内存使用
   */
  private monitorMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }
  }

  /**
   * 停止监控
   */
  stopMonitoring() {
    if (this.frameRateMonitor) {
      cancelAnimationFrame(this.frameRateMonitor);
      this.frameRateMonitor = null;
    }
  }

  /**
   * 创建防抖函数
   */
  createDebounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number = this.config.debounceDelay
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * 创建节流函数
   */
  createThrottle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }

  /**
   * 优化图片加载
   */
  async optimizeImageLoad(imageUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const loadImage = async () => {
        if (this.loadingImages >= this.config.maxConcurrentImages) {
          // 添加到队列
          this.imageLoadQueue.push(loadImage);
          return;
        }

        this.loadingImages++;
        
        const img = new Image();
        
        img.onload = () => {
          this.loadingImages--;
          this.processImageQueue();
          resolve(img);
        };
        
        img.onerror = () => {
          this.loadingImages--;
          this.processImageQueue();
          reject(new Error(`Failed to load image: ${imageUrl}`));
        };
        
        img.src = imageUrl;
      };

      loadImage();
    });
  }

  /**
   * 处理图片加载队列
   */
  private processImageQueue() {
    if (this.imageLoadQueue.length > 0 && this.loadingImages < this.config.maxConcurrentImages) {
      const nextLoad = this.imageLoadQueue.shift();
      if (nextLoad) {
        nextLoad();
      }
    }
  }

  /**
   * 虚拟滚动优化
   */
  calculateVirtualScrollItems(
    containerHeight: number,
    itemHeight: number,
    totalItems: number,
    scrollTop: number,
    overscan: number = 5
  ) {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);

    this.metrics.virtualScrollItems = endIndex - startIndex + 1;

    return {
      startIndex,
      endIndex,
      visibleItems: endIndex - startIndex + 1,
      offsetY: startIndex * itemHeight
    };
  }

  /**
   * 组件渲染时间测量
   */
  measureRenderTime<T>(componentName: string, renderFn: () => T): T {
    const startTime = performance.now();
    const result = renderFn();
    const endTime = performance.now();
    
    this.metrics.componentRenderTime = endTime - startTime;
    
    if (this.metrics.componentRenderTime > 16) {
      console.warn(`组件 ${componentName} 渲染时间过长: ${this.metrics.componentRenderTime.toFixed(2)}ms`);
    }
    
    return result;
  }

  /**
   * 创建优化的事件处理器
   */
  createOptimizedEventHandler<T extends Event>(
    handler: (event: T) => void,
    options: {
      debounce?: number;
      throttle?: number;
      passive?: boolean;
    } = {}
  ) {
    let optimizedHandler = handler;

    if (options.debounce) {
      optimizedHandler = this.createDebounce(handler, options.debounce) as any;
    } else if (options.throttle) {
      optimizedHandler = this.createThrottle(handler, options.throttle) as any;
    }

    return {
      handler: optimizedHandler,
      options: { passive: options.passive ?? true }
    };
  }

  /**
   * 预加载关键资源
   */
  async preloadCriticalResources(resources: string[]) {
    const preloadPromises = resources.map(async (resource) => {
      if (resource.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return this.optimizeImageLoad(resource);
      } else if (resource.match(/\.(css|js)$/i)) {
        return this.preloadScript(resource);
      }
      return Promise.resolve();
    });

    try {
      await Promise.all(preloadPromises);
      console.log('关键资源预加载完成');
    } catch (error) {
      console.warn('部分资源预加载失败:', error);
    }
  }

  /**
   * 预加载脚本
   */
  private preloadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = src;
      link.as = src.endsWith('.css') ? 'style' : 'script';
      
      link.onload = () => resolve();
      link.onerror = () => reject(new Error(`Failed to preload: ${src}`));
      
      document.head.appendChild(link);
    });
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): RenderMetrics & { recommendations: string[] } {
    const recommendations: string[] = [];

    if (this.metrics.frameRate && this.metrics.frameRate < 30) {
      recommendations.push('帧率较低，建议减少DOM操作或启用虚拟滚动');
    }

    if (this.metrics.memoryUsage && this.metrics.memoryUsage > 100) {
      recommendations.push('内存使用较高，建议检查内存泄漏或优化数据结构');
    }

    if (this.metrics.componentRenderTime && this.metrics.componentRenderTime > 16) {
      recommendations.push('组件渲染时间过长，建议使用React.memo或优化渲染逻辑');
    }

    return {
      componentRenderTime: this.metrics.componentRenderTime ?? 0,
      virtualScrollItems: this.metrics.virtualScrollItems ?? 0,
      memoryUsage: this.metrics.memoryUsage ?? 0,
      frameRate: this.metrics.frameRate ?? 0,
      recommendations
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopMonitoring();
    this.imageLoadQueue = [];
    this.loadingImages = 0;
  }
}

// 导出单例实例
export const renderOptimizer = new RenderOptimizer();
