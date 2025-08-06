/**
 * 性能监控Hook
 * 提供统一的性能监控和优化功能
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentCount: number;
  lastUpdate: number;
}

interface PerformanceOptions {
  enableMemoryMonitoring?: boolean;
  enableRenderTimeTracking?: boolean;
  sampleInterval?: number;
  maxSamples?: number;
}

export const usePerformanceMonitor = (
  componentName: string,
  options: PerformanceOptions = {}
) => {
  const {
    enableMemoryMonitoring = true,
    enableRenderTimeTracking = true,
    sampleInterval = 1000,
    maxSamples = 100
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    memoryUsage: 0,
    componentCount: 0,
    lastUpdate: Date.now()
  });

  const renderStartTime = useRef<number>(0);
  const samplesRef = useRef<PerformanceMetrics[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 开始渲染时间测量
   */
  const startRenderMeasurement = useCallback(() => {
    if (enableRenderTimeTracking && performance) {
      renderStartTime.current = performance.now();
    }
  }, [enableRenderTimeTracking]);

  /**
   * 结束渲染时间测量
   */
  const endRenderMeasurement = useCallback(() => {
    if (enableRenderTimeTracking && performance && renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      
      setMetrics(prev => ({
        ...prev,
        renderTime,
        lastUpdate: Date.now()
      }));

      // 记录到样本中
      const newSample: PerformanceMetrics = {
        renderTime,
        memoryUsage: 0, // 将在内存监控中更新
        componentCount: 0, // 将在组件计数中更新
        lastUpdate: Date.now()
      };

      samplesRef.current.push(newSample);
      
      // 限制样本数量
      if (samplesRef.current.length > maxSamples) {
        samplesRef.current = samplesRef.current.slice(-maxSamples);
      }

      renderStartTime.current = 0;
    }
  }, [enableRenderTimeTracking, maxSamples]);

  /**
   * 获取内存使用情况
   */
  const getMemoryUsage = useCallback(() => {
    if (enableMemoryMonitoring && performance && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }, [enableMemoryMonitoring]);

  /**
   * 更新内存使用指标
   */
  const updateMemoryMetrics = useCallback(() => {
    const memoryInfo = getMemoryUsage();
    if (memoryInfo) {
      setMetrics(prev => ({
        ...prev,
        memoryUsage: memoryInfo.used / 1024 / 1024, // 转换为MB
        lastUpdate: Date.now()
      }));
    }
  }, [getMemoryUsage]);

  /**
   * 获取性能统计信息
   */
  const getPerformanceStats = useCallback(() => {
    const samples = samplesRef.current;
    if (samples.length === 0) return null;

    const renderTimes = samples.map(s => s.renderTime);
    const memoryUsages = samples.map(s => s.memoryUsage);

    return {
      renderTime: {
        avg: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
        min: Math.min(...renderTimes),
        max: Math.max(...renderTimes),
        latest: renderTimes[renderTimes.length - 1]
      },
      memory: {
        avg: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        min: Math.min(...memoryUsages),
        max: Math.max(...memoryUsages),
        latest: memoryUsages[memoryUsages.length - 1]
      },
      sampleCount: samples.length,
      componentName
    };
  }, [componentName]);

  /**
   * 清除性能数据
   */
  const clearPerformanceData = useCallback(() => {
    samplesRef.current = [];
    setMetrics({
      renderTime: 0,
      memoryUsage: 0,
      componentCount: 0,
      lastUpdate: Date.now()
    });
  }, []);

  /**
   * 检查性能警告
   */
  const checkPerformanceWarnings = useCallback(() => {
    const stats = getPerformanceStats();
    if (!stats) return [];

    const warnings: string[] = [];

    // 渲染时间警告
    if (stats.renderTime.avg > 16) { // 超过一帧时间
      warnings.push(`Average render time (${stats.renderTime.avg.toFixed(2)}ms) exceeds 16ms`);
    }

    // 内存使用警告
    if (stats.memory.latest > 100) { // 超过100MB
      warnings.push(`Memory usage (${stats.memory.latest.toFixed(2)}MB) is high`);
    }

    return warnings;
  }, [getPerformanceStats]);

  // 设置定期监控
  useEffect(() => {
    if (enableMemoryMonitoring) {
      intervalRef.current = setInterval(updateMemoryMetrics, sampleInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enableMemoryMonitoring, updateMemoryMetrics, sampleInterval]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearPerformanceData();
    };
  }, [clearPerformanceData]);

  return {
    metrics,
    startRenderMeasurement,
    endRenderMeasurement,
    getPerformanceStats,
    clearPerformanceData,
    checkPerformanceWarnings,
    getMemoryUsage,
  };
};
