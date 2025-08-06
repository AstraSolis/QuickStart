/**
 * 图片处理工具类
 * 提供图片压缩、格式转换、尺寸调整等功能
 * 支持国际化错误消息
 */

import i18n from '../i18n';

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  aspectRatio: number;
  originalPath?: string; // 可选字段：原始文件路径或名称
}

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  format?: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio?: boolean;
}

export interface ProcessedImage {
  blob: Blob;
  dataUrl: string;
  metadata: ImageMetadata;
}

/**
 * 图片处理器类 - 支持国际化
 */
export class ImageProcessor {
  /**
   * 获取翻译函数
   */
  private static t(key: string, defaultValue: string, options?: any): string {
    try {
      const result = i18n.t(key, defaultValue, options);
      return typeof result === 'string' ? result : defaultValue;
    } catch (error) {
      // 用户可见的翻译失败警告，需要国际化
      const warningMsg = i18n.t('errors:imageProcessor.translationFailed',
        '图片处理器翻译失败: {{key}}', { key });
      console.warn(warningMsg);
      return defaultValue;
    }
  }
  /**
   * 验证图片文件
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: this.t('theme:background.imageValidation.unsupportedFormat',
          '不支持的图片格式: {{format}}。支持的格式: JPEG, PNG, GIF, WebP',
          { format: file.type })
      };
    }

    // 检查文件大小 (最大50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        error: this.t('theme:background.imageValidation.fileTooLarge',
          '图片文件过大: {{size}}MB。最大支持: 50MB',
          { size: (file.size / 1024 / 1024).toFixed(2) })
      };
    }

    return { valid: true };
  }

  /**
   * 读取图片文件并获取元数据（Electron优化版本）
   */
  static async getImageMetadata(file: File): Promise<ImageMetadata> {
    // 开发调试信息：图片元数据获取的详细信息使用英文是合理的，这是开发者工具信息
    console.log('ImageProcessor: Getting metadata for file (Electron mode):', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    // 验证文件基本信息
    if (!file) {
      throw new Error(this.t('theme:background.imageValidation.fileInvalid', '文件对象无效'));
    }

    if (file.size === 0) {
      throw new Error(this.t('theme:background.imageValidation.emptyFile', '文件大小为0，可能是空文件'));
    }

    if (!file.type?.startsWith('image/')) {
      throw new Error(this.t('theme:background.imageValidation.invalidFileType',
        '文件类型无效: {{type}}，期望图片类型',
        { type: file.type || '未知' }));
    }

    // 使用FileReader读取文件内容，这在Electron中更可靠
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      let isResolved = false;

      // 设置10秒超时
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reader.abort();
          reject(new Error(this.t('theme:background.imageValidation.readTimeout',
            '文件读取超时（10秒），文件可能过大或损坏')));
        }
      }, 10000);

      reader.onload = (event) => {
        if (isResolved) return;
        
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            isResolved = true;
            clearTimeout(timeoutId);
            reject(new Error(this.t('theme:background.imageValidation.cannotReadFile', '无法读取文件内容')));
            return;
          }

          console.log('ImageProcessor: File read successfully, size:', arrayBuffer.byteLength);

          // 创建Blob用于图片加载
          const blob = new Blob([arrayBuffer], { type: file.type });
          const url = URL.createObjectURL(blob);
          const img = new Image();

          img.onload = () => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            
            console.log('ImageProcessor: Image loaded successfully:', {
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              complete: img.complete
            });

            // 验证图片尺寸
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
              reject(new Error(this.t('theme:background.imageValidation.invalidDimensions',
                '图片尺寸无效，文件可能损坏或不是有效的图片格式')));
              return;
            }

            // 获取文件格式
            let format = 'unknown';
            if (file.type) {
              const typeParts = file.type.split('/');
              if (typeParts.length > 1) {
                format = typeParts[1];
              }
            }

            // 从文件名获取扩展名作为备选
            if (format === 'unknown' && file.name) {
              const nameParts = file.name.toLowerCase().split('.');
              if (nameParts.length > 1) {
                const ext = nameParts[nameParts.length - 1];
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
                  format = ext === 'jpg' ? 'jpeg' : ext;
                }
              }
            }

            const metadata: ImageMetadata = {
              width: img.naturalWidth,
              height: img.naturalHeight,
              format,
              size: file.size,
              aspectRatio: img.naturalWidth / img.naturalHeight,
              originalPath: file.name
            };

            console.log('ImageProcessor: Metadata extracted:', metadata);
            resolve(metadata);
          };

          img.onerror = (event) => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            
            // 开发调试错误：图片加载失败的详细诊断信息使用英文是合理的
            console.error('ImageProcessor: Image load error:', {
              event,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size
            });

            // 尝试通过文件头部字节判断是否为有效图片
            const uint8Array = new Uint8Array(arrayBuffer.slice(0, 16));
            const hex = Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join('');
            console.log('ImageProcessor: File header bytes:', hex);

            let errorMessage = this.t('theme:background.imageValidation.cannotReadFile', '无法读取图片文件');

            // 检查文件头部字节来判断文件类型
            if (hex.startsWith('ffd8ff')) {
              errorMessage = this.t('theme:background.imageValidation.jpegCorrupted',
                'JPEG文件存在但可能已损坏，请尝试使用图片编辑软件重新保存');
            } else if (hex.startsWith('89504e47')) {
              errorMessage = this.t('theme:background.imageValidation.pngCorrupted',
                'PNG文件存在但可能已损坏，请尝试使用图片编辑软件重新保存');
            } else if (hex.startsWith('47494638')) {
              errorMessage = this.t('theme:background.imageValidation.gifCorrupted',
                'GIF文件存在但可能已损坏，请尝试使用图片编辑软件重新保存');
            } else if (hex.startsWith('52494646') && hex.includes('57454250')) {
              errorMessage = this.t('theme:background.imageValidation.webpCorrupted',
                'WebP文件存在但可能已损坏或不被当前环境支持');
            } else if (hex.startsWith('424d')) {
              errorMessage = this.t('theme:background.imageValidation.bmpCorrupted',
                'BMP文件存在但可能已损坏，建议转换为JPG或PNG格式');
            } else if (!file.type.startsWith('image/')) {
              errorMessage = this.t('theme:background.imageValidation.unsupportedFileType',
                '文件类型不支持: {{type}}。请选择有效的图片文件 (JPG, PNG, GIF, WebP)',
                { type: file.type });
            } else if (file.size > 50 * 1024 * 1024) {
              errorMessage = this.t('theme:background.imageValidation.fileTooLargeSimple',
                '图片文件过大，请选择小于50MB的图片');
            } else {
              errorMessage = this.t('theme:background.imageValidation.fileCorruptedGeneric',
                '文件不是有效的图片格式，或者已损坏。文件头: {{header}}...',
                { header: hex.substring(0, 16) });
            }

            reject(new Error(errorMessage));
          };

          // 安全设置图片源
          try {
            img.src = url;
          } catch (error) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              URL.revokeObjectURL(url);
              console.error('ImageProcessor: Failed to set image src:', error);
              reject(new Error(`设置图片源失败: ${error instanceof Error ? error.message : '未知错误'}`));
            }
          }
        } catch (error) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            console.error('ImageProcessor: File processing error:', error);
            reject(new Error(`文件处理失败: ${error instanceof Error ? error.message : '未知错误'}`));
          }
        }
      };

      reader.onerror = (event) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        console.error('ImageProcessor: FileReader error:', event);
        reject(new Error('文件读取失败，可能是文件权限问题或文件已损坏'));
      };

      reader.onabort = () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        console.log('ImageProcessor: FileReader aborted');
        reject(new Error('文件读取被中断'));
      };

      // 开始读取文件
      try {
        console.log('ImageProcessor: Starting to read file as ArrayBuffer');
        reader.readAsArrayBuffer(file);
      } catch (error) {
        isResolved = true;
        clearTimeout(timeoutId);
        console.error('ImageProcessor: Failed to start reading file:', error);
        reject(new Error(this.t('theme:background.imageValidation.cannotReadFile', '无法开始读取文件')));
      }
    });
  }

  /**
   * 处理图片（压缩、调整尺寸等）- Electron优化版本
   */
  static async processImage(file: File, options: ProcessImageOptions = {}): Promise<ProcessedImage> {
    const {
      maxWidth = 4096,
      maxHeight = 4096,
      quality = 0.85,
      format = 'jpeg',
      maintainAspectRatio = true,
    } = options;

    // 开发调试信息：图片处理选项的详细信息使用英文是合理的，这是开发者工具信息
    console.log('ImageProcessor: Processing image with options:', options);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      let isResolved = false;

      // 设置15秒超时（处理可能需要更长时间）
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reader.abort();
          reject(new Error(this.t('theme:background.imageProcessing.timeout',
            '图片处理超时（15秒），图片可能过大')));
        }
      }, 15000);

      reader.onload = (event) => {
        if (isResolved) return;

        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            isResolved = true;
            clearTimeout(timeoutId);
            reject(new Error('无法读取文件内容'));
            return;
          }

          // 创建Blob用于图片加载
          const blob = new Blob([arrayBuffer], { type: file.type });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            isResolved = true;
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            reject(new Error(this.t('theme:background.imageProcessing.cannotCreateCanvas',
              '无法创建Canvas上下文')));
            return;
          }

          img.onload = () => {
            if (isResolved) return;

            try {
              URL.revokeObjectURL(url);
              
              let { width, height } = img;
              const originalWidth = width;
              const originalHeight = height;

              console.log('ImageProcessor: Original dimensions:', { width: originalWidth, height: originalHeight });

              // 计算新尺寸
              if (maintainAspectRatio) {
                const aspectRatio = width / height;
                
                if (width > maxWidth) {
                  width = maxWidth;
                  height = width / aspectRatio;
                }
                
                if (height > maxHeight) {
                  height = maxHeight;
                  width = height * aspectRatio;
                }
              } else {
                width = Math.min(width, maxWidth);
                height = Math.min(height, maxHeight);
              }

              // 确保尺寸为整数
              width = Math.round(width);
              height = Math.round(height);

              console.log('ImageProcessor: New dimensions:', { width, height });

              // 设置Canvas尺寸
              canvas.width = width;
              canvas.height = height;

              // 设置高质量绘制
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';

              // 绘制图片
              ctx.drawImage(img, 0, 0, width, height);

              // 转换为Blob
              canvas.toBlob(
                (processedBlob) => {
                  if (isResolved) return;

                  if (!processedBlob) {
                    isResolved = true;
                    clearTimeout(timeoutId);
                    reject(new Error('图片处理失败，无法生成输出'));
                    return;
                  }

                  console.log('ImageProcessor: Image processed successfully, new size:', processedBlob.size);

                  // 创建DataURL用于预览
                  const dataUrlReader = new FileReader();
                  dataUrlReader.onload = () => {
                    if (isResolved) return;
                    isResolved = true;
                    clearTimeout(timeoutId);

                    const dataUrl = dataUrlReader.result as string;
                    
                    const metadata: ImageMetadata = {
                      width,
                      height,
                      format,
                      size: processedBlob.size,
                      aspectRatio: width / height,
                      originalPath: file.name
                    };

                    resolve({
                      blob: processedBlob,
                      dataUrl,
                      metadata,
                    });
                  };

                  dataUrlReader.onerror = () => {
                    if (isResolved) return;
                    isResolved = true;
                    clearTimeout(timeoutId);
                    reject(new Error(this.t('theme:background.imageProcessing.cannotGeneratePreview',
                      '无法生成图片预览')));
                  };

                  dataUrlReader.readAsDataURL(processedBlob);
                },
                `image/${format}`,
                quality
              );
            } catch (error) {
              if (!isResolved) {
                isResolved = true;
                clearTimeout(timeoutId);
                URL.revokeObjectURL(url);
                console.error('ImageProcessor: Canvas processing error:', error);
                reject(new Error(this.t('theme:background.imageProcessing.processingFailed',
                  '图片处理失败: {{message}}',
                  { message: error instanceof Error ? error.message : '未知错误' })));
              }
            }
          };

          img.onerror = (event) => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeoutId);
            URL.revokeObjectURL(url);
            
            console.error('ImageProcessor: Image load error during processing:', event);
            reject(new Error(this.t('theme:background.imageProcessing.cannotLoadForProcessing',
              '无法加载图片进行处理')));
          };

          // 安全设置图片源
          try {
            img.src = url;
          } catch (error) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              URL.revokeObjectURL(url);
              console.error('ImageProcessor: Failed to set image src during processing:', error);
              reject(new Error(this.t('theme:background.imageProcessing.setImageSourceFailed',
                '设置图片源失败: {{message}}',
                { message: error instanceof Error ? error.message : this.t('theme:background.imageProcessing.unknownError', '未知错误') })));
            }
          }
        } catch (error) {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            console.error('ImageProcessor: File reading error during processing:', error);
            reject(new Error(this.t('theme:background.imageProcessing.fileReadFailed',
              '文件读取失败: {{message}}',
              { message: error instanceof Error ? error.message : this.t('theme:background.imageProcessing.unknownError', '未知错误') })));
          }
        }
      };

      reader.onerror = (event) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        console.error('ImageProcessor: FileReader error during processing:', event);
        reject(new Error('文件读取失败，无法处理图片'));
      };

      reader.onabort = () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        console.log('ImageProcessor: FileReader aborted during processing');
        reject(new Error('图片处理被中断'));
      };

      // 开始读取文件
      try {
        console.log('ImageProcessor: Starting to read file for processing');
        reader.readAsArrayBuffer(file);
      } catch (error) {
        isResolved = true;
        clearTimeout(timeoutId);
        console.error('ImageProcessor: Failed to start reading file for processing:', error);
        reject(new Error(`无法开始读取文件: ${error instanceof Error ? error.message : '未知错误'}`));
      }
    });
  }

  /**
   * 创建图片缩略图
   */
  static async createThumbnail(file: File, size: number = 200): Promise<string> {
    const processed = await this.processImage(file, {
      maxWidth: size,
      maxHeight: size,
      quality: 0.7,
      format: 'jpeg',
      maintainAspectRatio: true,
    });

    return processed.dataUrl;
  }

  /**
   * 批量处理图片
   */
  static async processImages(
    files: File[], 
    options: ProcessImageOptions = {},
    onProgress?: (index: number, total: number) => void
  ): Promise<ProcessedImage[]> {
    const results: ProcessedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const processed = await this.processImage(files[i], options);
        results.push(processed);
        
        if (onProgress) {
          onProgress(i + 1, files.length);
        }
      } catch (error) {
        console.error(this.t('theme:background.imageProcessing.batchProcessingFailed',
          '处理图片 {{fileName}} 失败',
          { fileName: files[i].name }), error);
        // 继续处理其他图片
      }
    }

    return results;
  }

  /**
   * 检查图片是否需要压缩
   */
  static shouldCompress(metadata: ImageMetadata, maxSize: number = 2 * 1024 * 1024): boolean {
    return metadata.size > maxSize || metadata.width > 2048 || metadata.height > 2048;
  }

  /**
   * 获取推荐的压缩设置
   */
  static getRecommendedCompression(metadata: ImageMetadata): ProcessImageOptions {
    const { width, height, size } = metadata;
    
    // 根据图片大小和尺寸推荐压缩设置
    if (size > 10 * 1024 * 1024) { // 大于10MB
      return {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.7,
        format: 'jpeg',
      };
    } else if (size > 5 * 1024 * 1024) { // 大于5MB
      return {
        maxWidth: 2560,
        maxHeight: 1440,
        quality: 0.8,
        format: 'jpeg',
      };
    } else if (width > 4096 || height > 4096) { // 超高分辨率
      return {
        maxWidth: 3840,
        maxHeight: 2160,
        quality: 0.85,
        format: 'jpeg',
      };
    } else {
      return {
        quality: 0.9,
        format: metadata.format === 'png' ? 'png' : 'jpeg',
      };
    }
  }

  /**
   * 从URL加载图片
   */
  static async loadImageFromUrl(url: string, timeout: number = 30000): Promise<ImageMetadata> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let isResolved = false;
      
      // 设置超时
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`网络图片加载超时：${timeout / 1000}秒`));
        }
      }, timeout);
      
      img.onload = () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        const metadata: ImageMetadata = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: this.getFormatFromUrl(url),
          size: 0, // URL图片无法获取确切大小
          aspectRatio: img.naturalWidth / img.naturalHeight,
        };

        resolve(metadata);
      };

      img.onerror = () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        reject(new Error('无法加载网络图片：图片可能不存在、网络错误或CORS限制'));
      };

      // 设置跨域属性
      img.crossOrigin = 'anonymous';
      img.src = url;
    });
  }

  /**
   * 从URL下载图片并转换为File对象 - 改进版本，支持外部AbortSignal和进度回调
   */
  static async downloadImageFromUrl(
    url: string,
    timeout: number = 30000,
    externalSignal?: AbortSignal,
    onProgress?: (progress: number) => void
  ): Promise<File> {
    try {
      // 开发调试信息：图片下载开始的状态信息使用英文是合理的，这是开发者工具信息
      console.log('ImageProcessor: Starting image download from URL:', url);

      // 创建带超时的fetch请求，支持外部信号
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 如果提供了外部信号，监听它的取消事件
      if (externalSignal) {
        externalSignal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(url, {
        signal: controller.signal,
        mode: 'cors',
        headers: {
          'Accept': 'image/*',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(this.t('theme:background.imageNetwork.httpError',
          'HTTP {{status}}: {{statusText}}',
          { status: response.status, statusText: response.statusText }));
      }

      // 验证内容类型
      const contentType = response.headers.get('content-type');
      if (!contentType?.startsWith('image/')) {
        throw new Error(this.t('theme:background.imageNetwork.invalidContentType',
          '无效的内容类型: {{contentType}}。期望的是图片类型。',
          { contentType }));
      }

      // 检查文件大小（如果服务器提供）
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (size > maxSize) {
          throw new Error(this.t('theme:background.imageValidation.fileTooLarge',
            '图片文件过大: {{size}}MB。最大支持: 50MB',
            { size: Math.round(size / 1024 / 1024) }));
        }
      }

      let blob: Blob;
      const filename = this.getFilenameFromUrl(url) || `downloaded-image-${Date.now()}.${this.getFormatFromUrl(url)}`;

      // 如果提供了进度回调，使用ReadableStream处理进度
      if (onProgress && response.body) {
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          chunks.push(value);
          loaded += value.length;

          if (total > 0) {
            onProgress(Math.min(Math.round((loaded / total) * 100), 99));
          } else {
            // 如果没有content-length，使用模拟进度
            onProgress(Math.min(loaded / 1024 / 10, 99)); // 假设平均图片为10MB
          }
        }

        // 完成下载
        onProgress(100);

        // 合并所有块
        blob = new Blob(chunks);
      } else {
        // 如果没有进度回调，使用原来的方法
        blob = await response.blob();
      }

      // 转换为File对象
      const file = new File([blob], filename, { type: blob.type });
      
      // 开发调试信息：图片下载成功的状态信息使用英文是合理的，这是开发者工具信息
      console.log('ImageProcessor: Image downloaded successfully:', {
        url,
        filename,
        size: file.size,
        type: file.type
      });
      
      return file;
    } catch (error) {
      // 用户可见的错误消息，需要国际化
      const errorMsg = ImageProcessor.t('errors:imageProcessor.downloadFailed',
        '图片下载失败: {{error}}', {
          error: error instanceof Error ? error.message : String(error)
        });
      console.error(errorMsg);

      // 检查是否是CORS错误，如果是，尝试使用主进程下载
      if (error instanceof Error &&
          (error.message.includes('CORS') ||
           error.message.includes('NetworkError') ||
           error.message.includes('Failed to fetch'))) {

        console.log('ImageProcessor: Attempting fallback to main process download...');

        try {
          // 使用主进程下载作为备选方案
          const result = await window.electronAPI?.networkImage?.download(url, timeout);

          if (result?.success && result.data) {
            // 将Buffer转换为File对象
            const buffer = result.data;
            const blob = new Blob([buffer]);
            const fallbackFilename = this.getFilenameFromUrl(url) || `downloaded-image-${Date.now()}.${this.getFormatFromUrl(url)}`;
            const file = new File([blob], fallbackFilename, { type: 'image/jpeg' });

            console.log('ImageProcessor: Main process download successful:', {
              url,
              filename: fallbackFilename,
              size: file.size,
              type: file.type
            });

            return file;
          } else {
            throw new Error(result?.error || 'Main process download failed');
          }
        } catch (mainProcessError) {
          console.error('ImageProcessor: Main process download also failed:', mainProcessError);
          // 如果主进程下载也失败，抛出原始错误
        }
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(this.t('theme:background.imageNetwork.downloadTimeout',
            '网络图片下载超时：{{seconds}}秒',
            { seconds: timeout / 1000 }));
        } else if (error.message.includes('CORS')) {
          throw new Error(this.t('theme:background.imageNetwork.corsError',
            'CORS错误：无法访问此图片，服务器不允许跨域请求'));
        } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
          throw new Error(this.t('theme:background.imageNetwork.networkError',
            '网络错误：请检查网络连接和图片链接是否有效'));
        }
      }

      throw new Error(this.t('theme:background.imageNetwork.downloadFailed',
        '下载网络图片失败: {{message}}',
        { message: error instanceof Error ? error.message : '未知错误' }));
    }
  }

  /**
   * 从URL获取文件格式
   */
  private static getFormatFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'jpeg';
      if (pathname.endsWith('.png')) return 'png';
      if (pathname.endsWith('.gif')) return 'gif';
      if (pathname.endsWith('.webp')) return 'webp';
      
      return 'jpeg'; // 默认格式
    } catch {
      return 'jpeg';
    }
  }

  /**
   * 从URL获取文件名
   */
  private static getFilenameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      return filename?.includes('.') ? filename : null;
    } catch {
      return null;
    }
  }

  /**
   * 验证图片URL - 改进版本，支持现代图片服务
   */
  static validateImageUrl(url: string): { valid: boolean; error?: string } {
    try {
      const urlObj = new URL(url);

      // 检查协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return {
          valid: false,
          error: this.t('theme:background.imageNetwork.protocolNotSupported',
            '只支持HTTP和HTTPS协议的图片链接')
        };
      }

      // 改进的扩展名检查 - 支持现代图片服务
      const pathname = urlObj.pathname.toLowerCase();
      const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      const hasValidExtension = supportedExtensions.some(ext => pathname.endsWith(ext));

      // 检查是否是已知的图片服务域名（无需扩展名）
      const imageServiceDomains = [
        'unsplash.com', 'images.unsplash.com',
        'pixabay.com', 'cdn.pixabay.com',
        'pexels.com', 'images.pexels.com',
        'imgur.com', 'i.imgur.com',
        'flickr.com', 'live.staticflickr.com',
        'picsum.photos',
        'via.placeholder.com',
        'dummyimage.com',
        'placehold.it', 'placehold.co',
        'source.unsplash.com'
      ];

      const isImageService = imageServiceDomains.some(domain =>
        urlObj.hostname.includes(domain) || urlObj.hostname.endsWith(domain)
      );

      // 如果没有有效扩展名且不是已知图片服务，给出友好提示
      if (!hasValidExtension && !isImageService) {
        return {
          valid: false,
          error: this.t('theme:background.imageNetwork.extensionOrServiceRequired',
            '图片链接应该以支持的格式结尾 (.jpg, .jpeg, .png, .gif, .webp) 或来自已知的图片服务')
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: this.t('theme:background.imageNetwork.invalidUrl', '无效的图片链接格式')
      };
    }
  }
}
