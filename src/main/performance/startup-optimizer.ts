/**
 * 应用启动性能优化器
 * 优化应用启动速度和资源加载
 */

import { app } from 'electron';
import { createMainLogger, LogCategory } from '../../shared/logger';
import { join } from 'path';

// 初始化日志
const logger = createMainLogger({
  logDir: join(process.env.APPDATA ?? process.env.HOME ?? process.cwd(), 'QuickStartAPP', 'logs'),
  level: 2,
  enableFile: true,
  enableConsole: true,
});

interface StartupMetrics {
  appReadyTime: number;
  windowCreateTime: number;
  firstPaintTime: number;
  totalStartupTime: number;
}

interface LazyLoadTask {
  name: string;
  priority: 'high' | 'medium' | 'low';
  task: () => Promise<void>;
  dependencies?: string[];
}

export class StartupOptimizer {
  private startTime: number = 0;
  private metrics: Partial<StartupMetrics> = {};
  private lazyTasks: LazyLoadTask[] = [];
  private completedTasks: Set<string> = new Set();

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * 记录启动指标
   */
  recordMetric(metric: keyof StartupMetrics, value?: number) {
    const timestamp = value ?? performance.now();
    this.metrics[metric] = timestamp - this.startTime;
    
    logger.info(`启动指标 ${metric}: ${this.metrics[metric]?.toFixed(2)}ms`,
      LogCategory.APP, 'startup-optimizer.ts').catch(console.error);
  }

  /**
   * 添加延迟加载任务
   */
  addLazyTask(task: LazyLoadTask) {
    this.lazyTasks.push(task);
  }

  /**
   * 执行延迟加载任务
   */
  async executeLazyTasks() {
    // 按优先级排序
    const sortedTasks = this.lazyTasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    for (const task of sortedTasks) {
      // 检查依赖是否完成
      if (task.dependencies && !task.dependencies.every(dep => this.completedTasks.has(dep))) {
        continue;
      }

      try {
        const taskStart = performance.now();
        await task.task();
        const taskTime = performance.now() - taskStart;
        
        this.completedTasks.add(task.name);
        logger.info(`延迟任务 ${task.name} 完成: ${taskTime.toFixed(2)}ms`,
          LogCategory.APP, 'startup-optimizer.ts').catch(console.error);
      } catch (error) {
        logger.error(`延迟任务 ${task.name} 失败`,
          LogCategory.APP, 'startup-optimizer.ts', { error }).catch(console.error);
      }
    }
  }

  /**
   * 预加载关键资源
   */
  async preloadCriticalResources() {
    const preloadStart = performance.now();

    // 预加载配置文件
    this.addLazyTask({
      name: 'preload-config',
      priority: 'high',
      task: async () => {
        // 预加载配置管理器
        const { configManager } = await import('../config-manager');
        await configManager.initialize();
      }
    });

    // 预加载数据库
    this.addLazyTask({
      name: 'preload-database',
      priority: 'high',
      task: async () => {
        const { databaseManager } = await import('../database-manager');
        await databaseManager.initialize();
      }
    });

    // 预加载背景缓存
    this.addLazyTask({
      name: 'preload-background-cache',
      priority: 'medium',
      task: async () => {
        const { backgroundCacheManager } = await import('../background-cache-manager');
        await backgroundCacheManager.initialize();
      },
      dependencies: ['preload-config']
    });

    const preloadTime = performance.now() - preloadStart;
    logger.info(`关键资源预加载完成: ${preloadTime.toFixed(2)}ms`,
      LogCategory.APP, 'startup-optimizer.ts').catch(console.error);
  }

  /**
   * 优化窗口创建
   */
  getOptimizedWindowOptions(): any {
    return {
      // 延迟显示窗口，直到内容加载完成
      show: false,

      // 窗口性能优化
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,

      // 减少初始渲染负担
      backgroundColor: '#ffffff',

      // 使用硬件加速
      webPreferences: {
        webSecurity: true,
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,

        // 性能优化选项
        experimentalFeatures: false,
        v8CacheOptions: 'code',

        // 预加载脚本
        preload: join(__dirname, '../preload/preload.js'),

        // 启用GPU加速
        offscreen: false,
        paintWhenInitiallyHidden: false,
      }
    };
  }

  /**
   * 获取启动报告
   */
  getStartupReport(): StartupMetrics & { lazyTasksCompleted: number } {
    return {
      appReadyTime: this.metrics.appReadyTime ?? 0,
      windowCreateTime: this.metrics.windowCreateTime ?? 0,
      firstPaintTime: this.metrics.firstPaintTime ?? 0,
      totalStartupTime: this.metrics.totalStartupTime ?? performance.now() - this.startTime,
      lazyTasksCompleted: this.completedTasks.size
    };
  }

  /**
   * 优化应用退出
   */
  optimizeAppExit() {
    app.on('before-quit', async () => {
      // 快速保存关键数据
      const saveStart = performance.now();
      
      try {
        // 并行保存配置和数据
        await Promise.all([
          this.saveConfigQuickly(),
          this.saveDatabaseQuickly(),
          this.clearTempFiles()
        ]);
        
        const saveTime = performance.now() - saveStart;
        logger.info(`快速退出保存完成: ${saveTime.toFixed(2)}ms`,
          LogCategory.APP, 'startup-optimizer.ts').catch(console.error);
      } catch (error) {
        logger.error('退出保存失败', LogCategory.APP, 'startup-optimizer.ts', { error }).catch(console.error);
      }
    });
  }

  private async saveConfigQuickly() {
    // 快速保存配置的实现
    // TODO: 实现快速配置保存
  }

  private async saveDatabaseQuickly() {
    // 快速保存数据库的实现
    // TODO: 实现快速数据库保存
  }

  private async clearTempFiles() {
    // 清理临时文件
    // TODO: 实现临时文件清理
  }
}

// 导出单例实例
export const startupOptimizer = new StartupOptimizer();
