import React, { useState, useCallback } from 'react';
import {
  Upload,
  Button,
  Card,
  Row,
  Col,
  Typography,
  Progress,
  message,
  Space,
  Image,
  Tooltip,
  Alert,
  Input,
  Tabs,
  Spin,
  Modal,
  type UploadFile,
  type UploadProps,
  type InputRef,
} from 'antd';
import {
  UploadOutlined,
  LinkOutlined,
  DeleteOutlined,
  EyeOutlined,
  CompressOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

import { ImageProcessor, type ProcessedImage, type ImageMetadata } from '../utils/imageProcessor';
import { useBackgroundConfig } from '../hooks/useBackgroundConfig';

const { Text } = Typography;
const { Dragger } = Upload;
const { TabPane } = Tabs;

export interface BackgroundImageUploadProps {
  onImageSelect: (image: ProcessedImage) => void;
  onImageRemove: () => void;
  currentImage?: string;
  loading?: boolean;
}

export const BackgroundImageUpload: React.FC<BackgroundImageUploadProps> = ({
  onImageSelect,
  onImageRemove,
  currentImage,
  loading = false,
}) => {
  const { t } = useTranslation(['theme', 'common']);
  const { checkFileNameExists } = useBackgroundConfig();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [imageMetadata, setImageMetadata] = useState<ImageMetadata | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 网络图片下载状态管理
  const [downloadController, setDownloadController] = useState<AbortController | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFailedUrl, setLastFailedUrl] = useState<string>('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [lastError, setLastError] = useState<string>('');
  const [isAutoRetrying, setIsAutoRetrying] = useState(false);
  const [nextRetryTime, setNextRetryTime] = useState<number | null>(null);

  // 重试配置
  const MAX_RETRY_COUNT = 3;
  const RETRY_DELAYS = [1000, 3000, 8000]; // 指数退避：1秒、3秒、8秒

  // 显示文件名输入对话框 - 修复版本，确保重复文件名检查时不关闭对话框
  const showFileNameDialog = useCallback(async (defaultFileName: string): Promise<string | null> => {
    const lastDotIndex = defaultFileName.lastIndexOf('.');
    const fileExtension = lastDotIndex > 0 ? defaultFileName.substring(lastDotIndex) : '';
    const baseName = lastDotIndex > 0 ? defaultFileName.substring(0, lastDotIndex) : defaultFileName;

    return new Promise<string | null>((resolve) => {
      let inputValue = baseName;
      let inputRef: InputRef | null = null;
      let modalInstance: ReturnType<typeof Modal.confirm> | null = null;

      const handleOk = async () => {
        console.log('BackgroundImageUpload: handleOk called with inputValue:', inputValue);

        if (!inputValue || inputValue.trim() === '') {
          console.log('BackgroundImageUpload: Invalid file name, showing error');
          message.error(t('theme:background.fileNameInvalid', '文件名无效'));
          inputRef?.focus();
          return Promise.reject(new Error('Invalid file name')); // 返回rejected Promise阻止对话框关闭
        }

        const finalFileName = inputValue.trim() + fileExtension;
        console.log('BackgroundImageUpload: Checking file name exists:', finalFileName);

        // 检查文件名是否重复
        const fileExists = await checkFileNameExists(finalFileName);
        console.log('BackgroundImageUpload: File exists check result:', fileExists);

        if (fileExists) {
          console.log('BackgroundImageUpload: Duplicate file name detected, showing error');
          message.error(t('theme:background.duplicateFileExists', '已有重复的文件'));
          inputRef?.focus();
          return Promise.reject(new Error('Duplicate file name')); // 返回rejected Promise阻止对话框关闭
        }

        // 验证通过，关闭对话框并返回结果
        console.log('BackgroundImageUpload: File name validation passed, closing dialog');
        modalInstance?.destroy();
        resolve(finalFileName);
        return Promise.resolve(); // 明确返回resolved Promise
      };

      const handleCancel = () => {
        console.log('BackgroundImageUpload: File name dialog cancelled');
        modalInstance?.destroy();
        resolve(null);
      };

      modalInstance = Modal.confirm({
        title: t('theme:background.setFileName', '设置文件名'),
        content: (
          <div>
            <Text>{t('theme:background.enterFileName', '请输入文件名')}:</Text>
            <Input
              ref={(ref) => { inputRef = ref; }}
              defaultValue={baseName}
              onChange={(e) => { inputValue = e.target.value; }}
              placeholder={t('theme:background.enterFileName', '请输入文件名')}
              style={{ marginTop: '8px' }}
              addonAfter={fileExtension}
              autoFocus
              onPressEnter={handleOk}
            />
          </div>
        ),
        okText: t('common:confirm', '确认'),
        cancelText: t('common:cancel', '取消'),
        onOk: handleOk,
        onCancel: handleCancel,
        maskClosable: false, // 防止点击遮罩关闭
        keyboard: false, // 防止ESC键关闭
      });
    });
  }, [t, checkFileNameExists]);

  // 处理文件上传
  const handleFileUpload: UploadProps['customRequest'] = useCallback(async (options: Parameters<NonNullable<UploadProps['customRequest']>>[0]) => {
    const { file, onSuccess, onError } = options;
    
    if (!(file instanceof File)) {
      onError?.(new Error('Invalid file'));
      return;
    }

    try {
      setProcessing(true);
      setProcessProgress(0);

      console.log('BackgroundImageUpload: Processing local file:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });

      // 验证文件
      const validation = ImageProcessor.validateImageFile(file);
      if (!validation.valid) {
        message.error(validation.error);
        onError?.(new Error(validation.error));
        return;
      }

      setProcessProgress(10);
      message.info(t('theme:background.processingLocalImage', '正在处理本地图片...'));

      // 获取图片元数据
      setProcessProgress(20);
      const metadata = await ImageProcessor.getImageMetadata(file);
      setImageMetadata(metadata);

      console.log('BackgroundImageUpload: Image metadata:', metadata);

      // 检查是否需要压缩
      setProcessProgress(40);
      const shouldCompress = ImageProcessor.shouldCompress(metadata);
      let processedImage: ProcessedImage;

      if (shouldCompress) {
        message.info(t('theme:background.compressingImage', '正在压缩图片以优化性能...'));
        const compressionOptions = ImageProcessor.getRecommendedCompression(metadata);
        setProcessProgress(60);
        processedImage = await ImageProcessor.processImage(file, compressionOptions);
        
        const originalSizeMB = (metadata.size / 1024 / 1024).toFixed(2);
        const compressedSizeMB = (processedImage.metadata.size / 1024 / 1024).toFixed(2);
        
        message.success(
          `图片已优化：${originalSizeMB}MB → ${compressedSizeMB}MB`
        );
      } else {
        setProcessProgress(60);
        processedImage = await ImageProcessor.processImage(file, { quality: 0.95 });
      }

      setProcessProgress(80);
      setPreviewImage(processedImage.dataUrl);

      // 图片处理完成，暂停进度显示
      setProcessProgress(90);
      message.info(t('theme:background.imageProcessed', '图片处理完成，请设置文件名'));

      // 显示文件名输入对话框（包含重复检查）
      const finalFileName = await showFileNameDialog(file.name);
      if (!finalFileName) {
        message.info(t('theme:background.importCancelled', '导入已取消'));
        setProcessProgress(0); // 重置进度
        onError?.(new Error('Import cancelled'));
        return;
      }

      // 为本地文件添加最终文件名信息
      processedImage.metadata.originalPath = finalFileName;

      setProcessProgress(100);
      onImageSelect(processedImage);
      onSuccess?.(processedImage);

      console.log('BackgroundImageUpload: Local file processed successfully');
      message.success(t('theme:background.uploadSuccess', '背景图片上传成功'));
    } catch (error) {
      console.error('BackgroundImageUpload: Local file processing failed:', error);
      
      // 直接显示详细的错误信息，ImageProcessor已经提供了用户友好的错误消息
      let errorMessage = t('theme:background.uploadFailed', '背景图片上传失败');
      if (error instanceof Error) {
        // 使用ImageProcessor提供的详细错误消息
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
      onError?.(error as Error);
    } finally {
      setProcessing(false);
      setProcessProgress(0);
    }
  }, [onImageSelect, t]);

  // 取消下载
  const cancelDownload = useCallback(() => {
    if (downloadController) {
      downloadController.abort();
      setDownloadController(null);
      setUrlLoading(false);
      setDownloadProgress(0);
      message.info(t('theme:background.downloadCancelled', '下载已取消'));
    }
  }, [downloadController, t]);

  // 智能重试机制 - 支持自动重试和手动重试
  const performSmartRetry = useCallback(async (url: string, isManualRetry: boolean = false) => {
    if (retryCount >= MAX_RETRY_COUNT) {
      message.error(t('theme:background.maxRetriesReached', '已达到最大重试次数（{{count}}次），请检查网络连接或更换图片链接', { count: MAX_RETRY_COUNT }));
      return;
    }

    const currentRetryCount = retryCount + 1;
    setRetryCount(currentRetryCount);

    if (!isManualRetry && currentRetryCount <= MAX_RETRY_COUNT) {
      // 自动重试：使用指数退避算法
      const delay = RETRY_DELAYS[currentRetryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      setIsAutoRetrying(true);
      setNextRetryTime(Date.now() + delay);

      message.info(t('theme:background.autoRetryScheduled', '将在{{seconds}}秒后自动重试（第{{current}}/{{max}}次）', {
        seconds: Math.ceil(delay / 1000),
        current: currentRetryCount,
        max: MAX_RETRY_COUNT
      }));

      // 等待指定时间后重试
      setTimeout(async () => {
        setIsAutoRetrying(false);
        setNextRetryTime(null);
        await handleUrlSubmit(url, true); // 标记为重试调用
      }, delay);
    } else {
      // 手动重试：立即执行
      message.info(t('theme:background.manualRetryStarted', '开始手动重试（第{{current}}/{{max}}次）', {
        current: currentRetryCount,
        max: MAX_RETRY_COUNT
      }));
      await handleUrlSubmit(url, true); // 标记为重试调用
    }
  }, [retryCount, MAX_RETRY_COUNT, RETRY_DELAYS, t]);

  // 手动重试下载
  const retryDownload = useCallback(async () => {
    if (lastFailedUrl) {
      await performSmartRetry(lastFailedUrl, true);
    }
  }, [lastFailedUrl, performSmartRetry]);

  // 处理URL图片 - 改进版本，支持并发控制和智能重试
  const handleUrlSubmit = useCallback(async (urlToDownload?: string, isRetryCall: boolean = false) => {
    const targetUrl = urlToDownload || urlInput.trim();

    if (!targetUrl) {
      message.warning(t('theme:background.enterUrl', '请输入图片链接'));
      return;
    }

    // 防止并发下载
    if (urlLoading) {
      message.warning(t('theme:background.downloadInProgress', '正在下载中，请等待完成或取消当前下载'));
      return;
    }

    const validation = ImageProcessor.validateImageUrl(targetUrl);
    if (!validation.valid) {
      message.error(validation.error);
      return;
    }

    // 创建新的下载控制器
    const controller = new AbortController();
    setDownloadController(controller);

    try {
      setUrlLoading(true);
      setDownloadProgress(0);
      setLastError('');

      message.info(t('theme:background.downloadingImage', '正在下载网络图片...'));

      // 使用新的下载方法下载图片，支持进度回调
      const file = await ImageProcessor.downloadImageFromUrl(
        targetUrl,
        30000,
        controller.signal,
        (progress) => setDownloadProgress(progress)
      ); // 30秒超时
      
      // 验证下载的文件
      const validation = ImageProcessor.validateImageFile(file);
      if (!validation.valid) {
        message.error(validation.error);
        return;
      }

      // 获取图片元数据
      const metadata = await ImageProcessor.getImageMetadata(file);
      setImageMetadata(metadata);

      // 检查是否需要压缩
      const shouldCompress = ImageProcessor.shouldCompress(metadata);
      let processedImage: ProcessedImage;

      if (shouldCompress) {
        const compressionOptions = ImageProcessor.getRecommendedCompression(metadata);
        processedImage = await ImageProcessor.processImage(file, compressionOptions);
        
        message.info(
          `网络图片已压缩：${(metadata.size / 1024 / 1024).toFixed(2)}MB → ${(processedImage.metadata.size / 1024 / 1024).toFixed(2)}MB`
        );
      } else {
        processedImage = await ImageProcessor.processImage(file, { quality: 0.95 });
      }

      setPreviewImage(processedImage.dataUrl);

      // 网络图片处理完成，提示用户设置文件名
      message.info(t('theme:background.imageProcessed', '图片处理完成，请设置文件名'));

      // 生成默认文件名
      const defaultFileName = file.name || `network-image-${Date.now()}.${processedImage.metadata.format || 'jpg'}`;

      // 显示文件名输入对话框（包含重复检查）
      const finalFileName = await showFileNameDialog(defaultFileName);
      if (!finalFileName) {
        message.info(t('theme:background.importCancelled', '导入已取消'));
        setDownloadProgress(0); // 重置下载进度
        return;
      }

      // 为网络图片添加最终文件名信息
      processedImage.metadata.originalPath = finalFileName;

      // 完成进度更新到100%
      console.log('BackgroundImageUpload: Network image processing completed, updating progress to 100%');
      setDownloadProgress(100);

      onImageSelect(processedImage);

      message.success(t('theme:background.urlLoadSuccess', '网络图片加载成功'));
      if (!urlToDownload) {
        setUrlInput(''); // 只有在不是重试时才清空输入
      }
      // 成功后重置所有重试相关状态
      setRetryCount(0);
      setLastFailedUrl('');
      setIsAutoRetrying(false);
      setNextRetryTime(null);
    } catch (error) {
      console.error('URL image load failed:', error);

      // 记录失败的URL和错误信息，用于重试
      setLastFailedUrl(targetUrl);

      // 检查是否是用户取消
      if (error instanceof Error && error.name === 'AbortError') {
        message.info(t('theme:background.downloadCancelled', '下载已取消'));
        return;
      }

      // 提供更详细的错误信息
      let errorMessage = t('theme:background.urlLoadFailed', '网络图片加载失败');
      if (error instanceof Error) {
        if (error.message.includes('超时')) {
          errorMessage = t('theme:background.imageNetwork.downloadTimeoutRetry', '网络图片下载超时，请检查网络连接或稍后重试');
        } else if (error.message.includes('CORS')) {
          errorMessage = t('theme:background.imageNetwork.corsAccessDenied', '无法访问此图片，服务器不允许跨域请求');
        } else if (error.message.includes('网络错误')) {
          errorMessage = t('theme:background.imageNetwork.networkConnectionError', '网络连接错误，请检查网络设置');
        } else if (error.message.includes('HTTP')) {
          errorMessage = t('theme:background.imageNetwork.serverError', '服务器错误: {{message}}', { message: error.message });
        } else if (error.message.includes('文件过大')) {
          errorMessage = error.message;
        } else if (error.message.includes('内容类型')) {
          errorMessage = t('theme:background.imageNetwork.invalidImageLink', '链接不是有效的图片文件');
        } else {
          errorMessage = t('theme:background.imageNetwork.genericError', '{{baseMessage}}: {{details}}', {
            baseMessage: errorMessage,
            details: error.message
          });
        }
      }

      setLastError(errorMessage);
      message.error(errorMessage);

      // 如果不是重试调用且还有重试机会，启动智能重试
      if (!isRetryCall && retryCount < MAX_RETRY_COUNT) {
        // 检查错误类型，决定是否适合自动重试
        const shouldAutoRetry = error instanceof Error && (
          error.message.includes('超时') ||
          error.message.includes('网络错误') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Failed to fetch')
        );

        if (shouldAutoRetry) {
          console.log('BackgroundImageUpload: Scheduling smart retry for network error');
          await performSmartRetry(targetUrl, false); // 自动重试
        }
      }
    } finally {
      setUrlLoading(false);
      setDownloadController(null);
      setDownloadProgress(0);
    }
  }, [urlInput, onImageSelect, t, retryCount, MAX_RETRY_COUNT, performSmartRetry]);

  // 移除图片
  const handleRemoveImage = useCallback(() => {
    setFileList([]);
    setPreviewImage(null);
    setImageMetadata(null);
    onImageRemove();
    message.success(t('theme:background.removeSuccess', '背景图片已移除'));
  }, [onImageRemove, t]);

  // 文件变更处理
  const handleFileChange: UploadProps['onChange'] = useCallback((info: Parameters<NonNullable<UploadProps['onChange']>>[0]) => {
    setFileList(info.fileList);
  }, []);

  // 渲染图片信息
  const renderImageInfo = () => {
    if (!imageMetadata) return null;

    return (
      <Card size="small" title={t('theme:background.imageInfo', '图片信息')}>
        <Row gutter={[16, 8]}>
          <Col span={12}>
            <Text type="secondary">{t('theme:background.dimensions', '尺寸')}:</Text>
            <br />
            <Text>{imageMetadata.width} × {imageMetadata.height}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">{t('theme:background.size', '大小')}:</Text>
            <br />
            <Text>{(imageMetadata.size / 1024 / 1024).toFixed(2)} MB</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">{t('theme:background.format', '格式')}:</Text>
            <br />
            <Text>{imageMetadata.format.toUpperCase()}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">{t('theme:background.aspectRatio', '宽高比')}:</Text>
            <br />
            <Text>{imageMetadata.aspectRatio.toFixed(2)}</Text>
          </Col>
        </Row>
      </Card>
    );
  };

  // 渲染预览
  const renderPreview = () => {
    const imageToShow = previewImage || currentImage;
    
    if (!imageToShow) return null;

    return (
      <Card 
        size="small" 
        title={t('theme:background.preview', '预览')}
        extra={
          <Space>
            <Tooltip title={t('theme:background.viewFullSize', '查看原图')}>
              <Button 
                type="text" 
                icon={<EyeOutlined />} 
                onClick={() => {
                  // 在新窗口中打开图片
                  window.open(imageToShow, '_blank');
                }}
              />
            </Tooltip>
            <Tooltip title={t('theme:background.removeImage', '移除图片')}>
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={handleRemoveImage}
              />
            </Tooltip>
          </Space>
        }
      >
        <div style={{ textAlign: 'center' }}>
          <Image
            src={imageToShow}
            alt="Background Preview"
            style={{ 
              maxWidth: '100%', 
              maxHeight: '200px',
              borderRadius: '8px',
            }}
            preview={{
              mask: <EyeOutlined />,
            }}
          />
        </div>
      </Card>
    );
  };

  return (
    <div className="background-image-upload">
      <Tabs defaultActiveKey="local" size="small">
        <TabPane 
          tab={
            <span>
              <UploadOutlined />
              {t('theme:background.localImage', '本地图片')}
            </span>
          } 
          key="local"
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Dragger
              name="backgroundImage"
              multiple={false}
              fileList={fileList}
              customRequest={handleFileUpload}
              onChange={handleFileChange}
              accept="image/*"
              disabled={processing || loading}
              showUploadList={false}
            >
              <p className="ant-upload-drag-icon">
                {processing ? <Spin size="large" /> : <UploadOutlined />}
              </p>
              <p className="ant-upload-text">
                {processing 
                  ? t('theme:background.processing', '正在处理图片...')
                  : t('theme:background.dragOrClick', '点击或拖拽图片到此区域上传')
                }
              </p>
              <p className="ant-upload-hint">
                {t('theme:background.supportFormats', '支持 JPG、PNG、GIF、WebP 格式，最大 50MB')}
              </p>
            </Dragger>

            {processing && (
              <Progress 
                percent={processProgress} 
                status="active"
                format={(percent) => `${percent}% ${t('theme:background.processing', '处理中')}`}
              />
            )}

            <Alert
              message={t('theme:background.compressionTip', '压缩提示')}
              description={t('theme:background.compressionDesc', '大尺寸图片将自动压缩以优化性能，同时保持良好的视觉效果。')}
              type="info"
              icon={<CompressOutlined />}
              showIcon
            />
          </Space>
        </TabPane>

        <TabPane 
          tab={
            <span>
              <LinkOutlined />
              {t('theme:background.urlImage', '网络图片')}
            </span>
          } 
          key="url"
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Input.Search
              placeholder={t('theme:background.enterImageUrl', '请输入图片链接 (https://...)')}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              loading={urlLoading}
              disabled={loading}
              enterButton={urlLoading ? t('common:cancel', '取消') : t('common:load', '加载')}
              onSearch={urlLoading ? cancelDownload : () => handleUrlSubmit()}
            />

            {/* 下载进度显示 */}
            {urlLoading && downloadProgress > 0 && (
              <Progress
                percent={downloadProgress}
                status="active"
                format={(percent) => `${percent}% ${t('theme:background.downloadingImage', '下载中')}`}
              />
            )}

            {/* 自动重试进度指示器 */}
            {isAutoRetrying && nextRetryTime && (
              <Alert
                message={t('theme:background.autoRetryInProgress', '自动重试中')}
                description={
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text>
                      {t('theme:background.retryCountdown', '将在{{seconds}}秒后重试（第{{current}}/{{max}}次）', {
                        seconds: Math.ceil((nextRetryTime - Date.now()) / 1000),
                        current: retryCount,
                        max: MAX_RETRY_COUNT
                      })}
                    </Text>
                    <Progress
                      percent={Math.max(0, Math.min(100, 100 - ((nextRetryTime - Date.now()) / (RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1])) * 100))}
                      size="small"
                      status="active"
                    />
                  </Space>
                }
                type="info"
                showIcon
              />
            )}

            {/* 重试按钮和错误信息 */}
            {lastFailedUrl && !urlLoading && !isAutoRetrying && (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    onClick={retryDownload}
                    size="small"
                    disabled={retryCount >= MAX_RETRY_COUNT}
                  >
                    {t('common:retry', '重试')}
                    {retryCount > 0 && ` (${retryCount}/${MAX_RETRY_COUNT})`}
                  </Button>
                  {retryCount >= MAX_RETRY_COUNT && (
                    <Text type="danger" style={{ fontSize: '12px' }}>
                      {t('theme:background.maxRetriesReached', '已达到最大重试次数')}
                    </Text>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {t('theme:background.lastError', '上次错误')}: {lastError}
                </Text>
              </Space>
            )}

            <Alert
              message={t('theme:background.urlTip', '网络图片提示')}
              description={t('theme:background.urlDesc', '支持主流图片服务（Unsplash、Pixabay等）和直接图片链接。')}
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
            />
          </Space>
        </TabPane>
      </Tabs>

      {/* 图片预览 */}
      {renderPreview()}

      {/* 图片信息 */}
      {renderImageInfo()}
    </div>
  );
};
