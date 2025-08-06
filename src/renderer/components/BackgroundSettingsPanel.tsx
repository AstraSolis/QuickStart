import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Switch,
  Slider,
  Select,
  Space,
  Divider,
  ColorPicker,
  Button,
  Tooltip,
  Alert,
  Collapse,
  message,
  Modal,
  List,
  Image,
  Popconfirm,
  Input,
} from 'antd';
import {
  BgColorsOutlined,
  PictureOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Color } from 'antd/es/color-picker';
import { useBackgroundConfig } from '../hooks/useBackgroundConfig';
import { BackgroundImageUpload } from './BackgroundImageUpload';
import type { ProcessedImage } from '../utils/imageProcessor';
import type { CachedImage } from '../../main/background-cache-manager';

const { Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

export const BackgroundSettingsPanel: React.FC = () => {
  const { t } = useTranslation(['theme', 'common']);
  const {
    config,
    loading,
    error,
    updateConfig,
    resetConfig,
    setBackground,
    cacheImage,
    cacheImageWithOriginalName,
    checkFileNameExists,
    getAllCachedImages,
    renameCachedImage,
    removeCachedImage,
  } = useBackgroundConfig();

  const [activeKey, setActiveKey] = useState<string[]>(['basic']);
  const [cachedImages, setCachedImages] = useState<CachedImage[]>([]);
  const [loadingCachedImages, setLoadingCachedImages] = useState(false);

  // 颜色选择器打开状态管理
  const [colorPickerOpen, setColorPickerOpen] = useState<{
    background: boolean;
    [key: string]: boolean; // 支持动态的渐变颜色选择器
  }>({
    background: false,
  });

  // 加载缓存图片列表
  const loadCachedImages = useCallback(async () => {
    try {
      setLoadingCachedImages(true);
      const images = await getAllCachedImages();
      setCachedImages(images);
    } catch (error) {
      console.error('Failed to load cached images:', error);
    } finally {
      setLoadingCachedImages(false);
    }
  }, [getAllCachedImages, setCachedImages, setLoadingCachedImages]);

  // 组件挂载时加载缓存图片
  useEffect(() => {
    loadCachedImages();
  }, [loadCachedImages]);

  // 处理背景类型变更
  const handleTypeChange = useCallback(async (type: 'none' | 'color' | 'gradient' | 'image' | 'url') => {
    if (type === 'gradient') {
      // 切换到渐变模式时，确保有默认的渐变配置
      await setBackground({
        type,
        gradient: {
          type: 'linear',
          direction: 45,
          colors: [
            { color: '#1890ff', position: 0 },
            { color: '#52c41a', position: 100 },
          ],
          opacity: 1.0,
        }
      });
    } else {
      await setBackground({ type });
    }
  }, [setBackground]);

  // 处理背景启用/禁用
  const handleEnabledChange = useCallback(async (enabled: boolean) => {
    await updateConfig({ enabled });
  }, [updateConfig]);

  // 处理颜色选择器打开/关闭状态
  const handleColorPickerOpenChange = useCallback((key: string, open: boolean) => {
    setColorPickerOpen(prev => ({
      ...prev,
      [key]: open,
    }));
  }, []);

  // 处理颜色变更
  const handleColorChange = useCallback(async (color: Color) => {
    if (!config) return;

    await updateConfig({
      color: {
        ...config.color,
        value: color.toHexString(),
      },
    });
  }, [config, updateConfig]);

  // 处理透明度变更
  const handleOpacityChange = useCallback(async (opacity: number) => {
    if (!config) return;
    
    const newOpacity = opacity / 100;
    
    switch (config.type) {
      case 'color':
        await updateConfig({
          color: { ...config.color, opacity: newOpacity },
        });
        break;
      case 'gradient':
        await updateConfig({
          gradient: { ...config.gradient, opacity: newOpacity },
        });
        break;
      case 'image':
        await updateConfig({
          image: { ...config.image, opacity: newOpacity },
        });
        break;
    }
  }, [config, updateConfig]);

  // 处理图片显示模式变更
  const handleDisplayModeChange = useCallback(async (displayMode: string) => {
    if (!config || config.type !== 'image') return;
    
    await updateConfig({
      image: {
        ...config.image,
        displayMode: displayMode as any,
      },
    });
  }, [config, updateConfig]);

  // 处理渐变类型变更
  const handleGradientTypeChange = useCallback(async (type: 'linear' | 'radial') => {
    if (!config || config.type !== 'gradient') return;

    await updateConfig({
      gradient: {
        ...config.gradient,
        type,
      },
    });
  }, [config, updateConfig]);

  // 处理渐变方向变更
  const handleGradientDirectionChange = useCallback(async (direction: number) => {
    if (!config || config.type !== 'gradient') return;

    await updateConfig({
      gradient: {
        ...config.gradient,
        direction,
      },
    });
  }, [config, updateConfig]);

  // 处理渐变颜色变更
  const handleGradientColorChange = useCallback(async (index: number, color: Color) => {
    if (!config || config.type !== 'gradient') return;

    // 确保渐变颜色数组存在且是数组
    const currentColors = Array.isArray(config.gradient.colors) ? config.gradient.colors : [];

    if (index >= currentColors.length) return;

    const newColors = [...currentColors];
    newColors[index] = {
      ...newColors[index],
      color: color.toHexString(),
    };

    await updateConfig({
      gradient: {
        ...config.gradient,
        colors: newColors,
      },
    });
  }, [config, updateConfig]);

  // 计算渐变颜色位置
  const calculateGradientPositions = useCallback((colorCount: number): number[] => {
    if (colorCount <= 1) return [0];
    if (colorCount === 2) return [0, 100];

    const positions: number[] = [];
    const step = 100 / (colorCount - 1);

    for (let i = 0; i < colorCount; i++) {
      positions.push(Math.round(i * step));
    }

    return positions;
  }, []);

  // 添加渐变颜色
  const handleAddGradientColor = useCallback(async () => {
    if (!config || config.type !== 'gradient') return;

    // 确保渐变颜色数组存在且是数组
    const currentColors = Array.isArray(config.gradient.colors) ? config.gradient.colors : [];

    if (currentColors.length >= 5) return;

    const newColorCount = currentColors.length + 1;
    const newPositions = calculateGradientPositions(newColorCount);

    // 创建新的颜色数组，保持现有颜色，添加新颜色
    const newColors = currentColors.map((color, index) => ({
      ...color,
      position: newPositions[index],
    }));

    // 添加新颜色（使用最后一个颜色作为默认值，如果没有则使用默认颜色）
    const lastColor = currentColors.length > 0 ? currentColors[currentColors.length - 1] : { color: '#1890ff' };
    newColors.push({
      color: lastColor.color,
      position: newPositions[newColorCount - 1],
    });

    await updateConfig({
      gradient: {
        ...config.gradient,
        colors: newColors,
      },
    });
  }, [config, updateConfig, calculateGradientPositions]);

  // 删除渐变颜色
  const handleRemoveGradientColor = useCallback(async (index: number) => {
    if (!config || config.type !== 'gradient') return;

    // 确保渐变颜色数组存在且是数组
    const currentColors = Array.isArray(config.gradient.colors) ? config.gradient.colors : [];

    if (currentColors.length <= 2) return;

    const newColors = currentColors.filter((_, i) => i !== index);
    const newPositions = calculateGradientPositions(newColors.length);

    // 重新计算位置
    const updatedColors = newColors.map((color, i) => ({
      ...color,
      position: newPositions[i],
    }));

    await updateConfig({
      gradient: {
        ...config.gradient,
        colors: updatedColors,
      },
    });
  }, [config, updateConfig, calculateGradientPositions]);

  // 处理图片效果变更
  const handleImageEffectChange = useCallback(async (effect: string, value: number) => {
    if (!config || config.type !== 'image') return;

    await updateConfig({
      image: {
        ...config.image,
        [effect]: value,
      },
    });
  }, [config, updateConfig]);

  // 处理图片选择
  const handleImageSelect = useCallback(async (image: ProcessedImage) => {
    console.log('BackgroundSettingsPanel: Handling image selection:', {
      blobSize: image.blob.size,
      dataUrlLength: image.dataUrl.length,
      metadata: image.metadata
    });

    try {
      // 显示处理进度
      message.loading(t('theme:background.savingImage'), 0);

      // 将Blob转换为ArrayBuffer用于缓存
      const arrayBuffer = await image.blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 获取原文件名
      let originalFileName = image.metadata.originalPath || `background_image_${new Date().getTime()}.${image.metadata.format || 'jpg'}`;

      // 如果是从本地文件选择的，直接使用原文件名
      if (image.metadata.originalPath && !image.metadata.originalPath.includes('_')) {
        originalFileName = image.metadata.originalPath;
      } else {
        // 为网络图片或其他情况生成默认文件名
        originalFileName = `background_image_${new Date().getTime()}.${image.metadata.format || 'jpg'}`;
      }

      console.log('BackgroundSettingsPanel: Using original filename:', originalFileName);

      // 检查文件名是否已存在
      const fileExists = await checkFileNameExists(originalFileName);
      let finalFileName = originalFileName;

      if (fileExists) {
        // 如果文件名已存在，让用户输入自定义文件名
        const lastDotIndex = originalFileName.lastIndexOf('.');
        const fileExtension = lastDotIndex > 0 ? originalFileName.substring(lastDotIndex) : '';
        const baseName = lastDotIndex > 0 ? originalFileName.substring(0, lastDotIndex) : originalFileName;

        const customFileName = await new Promise<string | null>((resolve) => {
          let inputValue = baseName;

          Modal.confirm({
            title: t('theme:background.duplicateFileName'),
            content: (
              <div>
                <p>{t('theme:background.duplicateFileContent', { fileName: originalFileName })}</p>
                <div style={{ marginTop: '16px' }}>
                  <Text>{t('theme:background.enterCustomFileName')}:</Text>
                  <Input
                    defaultValue={baseName}
                    onChange={(e) => { inputValue = e.target.value; }}
                    placeholder={t('theme:background.enterCustomFileName')}
                    style={{ marginTop: '8px' }}
                    addonAfter={fileExtension}
                  />
                </div>
              </div>
            ),
            okText: t('theme:background.renameAndSave'),
            cancelText: t('common:cancel'),
            onOk() {
              if (!inputValue || inputValue.trim() === '') {
                message.error(t('theme:background.fileNameInvalid'));
                resolve(null);
                return;
              }
              resolve(inputValue.trim() + fileExtension);
            },
            onCancel() {
              resolve(null);
            },
          });
        });

        if (!customFileName) {
          message.destroy();
          message.info(t('theme:background.cancelSave'));
          return;
        }

        // 检查自定义文件名是否也重复
        const customFileExists = await checkFileNameExists(customFileName);
        if (customFileExists) {
          message.destroy();
          message.error(t('theme:background.duplicateFileContent', { fileName: customFileName }));
          return;
        }

        finalFileName = customFileName;
      }

      console.log('BackgroundSettingsPanel: Caching image with path:', finalFileName);

      // 使用原文件名缓存图片
      const cachedPath = await cacheImageWithOriginalName(finalFileName, uint8Array, {
        width: image.metadata.width,
        height: image.metadata.height,
        format: image.metadata.format || 'jpeg'
      });

      console.log('BackgroundSettingsPanel: Image cached successfully:', cachedPath);

      // 设置背景配置
      await setBackground({
        type: 'image',
        image: {
          source: 'local',
          path: cachedPath,
          displayMode: 'cover',
          opacity: 1.0,
          blur: 0,
          brightness: 100,
          contrast: 100,
          saturation: 100,
          position: { x: 50, y: 50 },
          scale: 1.0,
          rotation: 0,
        },
      });

      message.destroy(); // 清除加载消息
      message.success(t('theme:background.imageSetSuccess'));
      console.log('BackgroundSettingsPanel: Background image set successfully');

      // 刷新缓存图片列表
      await loadCachedImages();

    } catch (error) {
      console.error('BackgroundSettingsPanel: Failed to cache and set background image:', error);
      message.destroy(); // 清除加载消息
      
      // 提供详细的错误信息
      let errorMessage = t('theme:background.imageSetFailed', '背景图片设置失败');
      let shouldFallback = true;

      if (error instanceof Error) {
        if (error.message.includes('Permission denied') || error.message.includes('权限')) {
          errorMessage = t('theme:background.permissionDeniedError', '缓存目录权限不足，请检查应用权限设置');
          message.warning(errorMessage);
          shouldFallback = true;
        } else if (error.message.includes('Insufficient disk space') || error.message.includes('磁盘空间')) {
          errorMessage = t('theme:background.diskSpaceError', '磁盘空间不足，无法保存背景图片');
          message.error(errorMessage);
          shouldFallback = false; // 磁盘空间不足时不应该使用内存方案
        } else if (error.message.includes('not initialized') || error.message.includes('初始化')) {
          errorMessage = t('theme:background.cacheNotInitializedError', '缓存系统未初始化，正在重试...');
          message.warning(errorMessage);
          shouldFallback = true;
        } else {
          errorMessage = t('theme:background.imageCacheFailedError', '图片缓存失败: {{message}}', { message: error.message });
          message.warning(errorMessage);
          shouldFallback = true;
        }
      } else {
        message.warning(errorMessage);
      }

      // 如果缓存失败但磁盘空间充足，使用dataUrl作为备选方案
      if (shouldFallback) {
        try {
          console.log('BackgroundSettingsPanel: Falling back to dataUrl method');
          message.info(t('theme:background.usingMemoryMode', '使用内存模式设置背景（重启后需重新设置）'));
          
          await setBackground({
            type: 'image',
            image: {
              source: 'local',
              path: image.dataUrl,
              displayMode: 'cover',
              opacity: 1.0,
              blur: 0,
              brightness: 100,
              contrast: 100,
              saturation: 100,
              position: { x: 50, y: 50 },
              scale: 1.0,
              rotation: 0,
            },
          });

          message.success(t('theme:background.imageSetSuccessMemory', '背景图片设置成功（临时模式）'));
        } catch (fallbackError) {
          console.error('BackgroundSettingsPanel: Fallback method also failed:', fallbackError);
          message.error(t('theme:background.imageSetFailedComplete', '背景图片设置完全失败'));
        }
      }
    }
  }, [setBackground, cacheImage, t]);

  // 处理图片移除
  const handleImageRemove = useCallback(async () => {
    await setBackground({ type: 'none' });
  }, [setBackground]);

  // 处理缓存图片切换
  const handleCachedImageSwitch = useCallback(async (cachedImage: CachedImage) => {
    try {
      await setBackground({
        type: 'image',
        image: {
          source: 'local',
          path: cachedImage.cachedPath,
          displayMode: 'cover',
          opacity: 1.0,
          blur: 0,
          brightness: 100,
          contrast: 100,
          saturation: 100,
          position: { x: 50, y: 50 },
          scale: 1.0,
          rotation: 0,
        },
      });
      message.success(t('theme:background.switchToImage', '切换到此背景'));
    } catch (error) {
      console.error('Failed to switch to cached image:', error);
      message.error(t('theme:background.imageSetFailed', '背景图片设置失败'));
    }
  }, [setBackground, t]);

  // 处理缓存图片删除
  const handleCachedImageRemove = useCallback(async (cachedImage: CachedImage) => {
    try {
      const success = await removeCachedImage(cachedImage.originalPath);
      if (success) {
        message.success(t('theme:background.removeCacheSuccess', '已从缓存中删除图片'));
        await loadCachedImages(); // 刷新列表
      } else {
        message.error(t('theme:background.removeCacheFailed', '删除缓存图片失败'));
      }
    } catch (error) {
      console.error('Failed to remove cached image:', error);
      message.error(t('theme:background.removeCacheFailed', '删除缓存图片失败'));
    }
  }, [removeCachedImage, loadCachedImages, t]);

  // 处理缓存图片重命名
  const handleCachedImageRename = useCallback(async (cachedImage: CachedImage) => {
    const oldFileName = cachedImage.originalPath;
    const lastDotIndex = oldFileName.lastIndexOf('.');
    const fileExtension = lastDotIndex > 0 ? oldFileName.substring(lastDotIndex) : '';
    const baseName = lastDotIndex > 0 ? oldFileName.substring(0, lastDotIndex) : oldFileName;

    const newFileName = await new Promise<string | null>((resolve) => {
      let inputValue = baseName;

      Modal.confirm({
        title: t('theme:background.renameImage', '重命名图片'),
        content: (
          <div>
            <Text>{t('theme:background.enterNewFileName', '请输入新的文件名')}:</Text>
            <Input
              defaultValue={baseName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { inputValue = e.target.value; }}
              placeholder={t('theme:background.enterNewFileName', '请输入新的文件名')}
              style={{ marginTop: '8px' }}
              addonAfter={fileExtension}
            />
          </div>
        ),
        okText: t('common:confirm', '确认'),
        cancelText: t('common:cancel', '取消'),
        onOk() {
          if (!inputValue || inputValue.trim() === '' || inputValue.trim() === baseName) {
            resolve(null);
            return;
          }
          resolve(inputValue.trim() + fileExtension);
        },
        onCancel() {
          resolve(null);
        },
      });
    });

    if (!newFileName) {
      return;
    }

    try {
      const newPath = await renameCachedImage(oldFileName, newFileName);
      message.success(t('theme:background.renameSuccess', '重命名成功'));

      // 如果当前正在使用这个背景，需要更新配置
      if (config && config.type === 'image' && config.image.path === cachedImage.cachedPath) {
        await setBackground({
          type: 'image',
          image: {
            ...config.image,
            path: newPath,
          },
        });
      }

      await loadCachedImages(); // 刷新列表
    } catch (error) {
      console.error('Failed to rename cached image:', error);
      message.error(t('theme:background.renameFailed', '重命名失败'));
    }
  }, [renameCachedImage, loadCachedImages, config, setBackground, t]);

  // 重置配置
  const handleReset = useCallback(async () => {
    await resetConfig();
  }, [resetConfig]);

  if (loading) {
    return (
      <Card loading={true}>
        <div style={{ height: '200px' }} />
      </Card>
    );
  }

  if (error) {
    console.warn('Background config error:', error);
    return (
      <Card>
        <Alert
          message={t('theme:background.loadError', '加载背景配置失败')}
          description={error}
          type="warning"
          showIcon
          action={
            <Button size="small" onClick={() => window.location.reload()}>
              {t('common:retry', '重试')}
            </Button>
          }
        />
      </Card>
    );
  }

  if (!config) {
    console.warn('Background config not available');
    return (
      <Card>
        <Alert
          message={t('theme:background.noConfig', '背景配置不可用')}
          description={t('theme:background.configWillBeCreated', '配置将在首次使用时创建')}
          type="info"
          showIcon
        />
      </Card>
    );
  }

  // 调试信息
  console.log('Current background config:', {
    enabled: config.enabled,
    type: config.type,
    gradientColors: config.gradient?.colors?.length || 0,
    gradientColorsData: config.gradient?.colors
  });

  return (
    <div className="background-settings-panel">
      <Card
        title={
          <Space>
            <PictureOutlined />
            {t('theme:background.title', '背景设置')}
          </Space>
        }
        extra={
          <Tooltip title={t('theme:background.reset', '重置设置')}>
            <Button 
              type="text" 
              icon={<ReloadOutlined />} 
              onClick={handleReset}
            />
          </Tooltip>
        }
      >
        <Collapse 
          activeKey={activeKey} 
          onChange={setActiveKey}
          ghost
        >
          {/* 基础设置 */}
          <Panel 
            header={t('theme:background.basicSettings', '基础设置')} 
            key="basic"
            extra={<SettingOutlined />}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 启用背景 */}
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('theme:background.enabled', '启用背景')}:</Text>
                </Col>
                <Col span={16}>
                  <Switch
                    checked={config.enabled}
                    onChange={handleEnabledChange}
                  />
                </Col>
              </Row>

              {config.enabled && (
                <>
                  {/* 背景类型 */}
                  <Row gutter={16} align="middle">
                    <Col span={8}>
                      <Text>{t('theme:background.type', '背景类型')}:</Text>
                    </Col>
                    <Col span={16}>
                      <Select
                        value={config.type}
                        onChange={handleTypeChange}
                        style={{ width: '100%' }}
                      >
                        <Option value="none">{t('theme:background.types.none', '无背景')}</Option>
                        <Option value="color">{t('theme:background.types.color', '纯色')}</Option>
                        <Option value="gradient">{t('theme:background.types.gradient', '渐变')}</Option>
                        <Option value="image">{t('theme:background.types.image', '图片')}</Option>
                      </Select>
                    </Col>
                  </Row>

                  {/* 透明度 */}
                  {config.type !== 'none' && (
                    <Row gutter={16} align="middle">
                      <Col span={8}>
                        <Text>{t('theme:background.opacity', '透明度')}:</Text>
                      </Col>
                      <Col span={16}>
                        <Slider
                          min={0}
                          max={100}
                          value={
                            config.type === 'color' ? config.color.opacity * 100 :
                            config.type === 'gradient' ? config.gradient.opacity * 100 :
                            config.type === 'image' ? config.image.opacity * 100 : 100
                          }
                          onChange={handleOpacityChange}
                          tooltip={{ formatter: (value) => `${value}%` }}
                        />
                      </Col>
                    </Row>
                  )}
                </>
              )}
            </Space>
          </Panel>

          {/* 颜色设置 */}
          {config.enabled && config.type === 'color' && (
            <Panel
              header={t('theme:background.colorSettings', '颜色设置')}
              key="color"
              extra={<BgColorsOutlined />}
            >
              <Row gutter={16} align="middle">
                <Col span={8}>
                  <Text>{t('theme:background.color', '背景颜色')}:</Text>
                </Col>
                <Col span={16}>
                  <ColorPicker
                    value={config.color.value}
                    onChange={handleColorChange}
                    onOpenChange={(open) => handleColorPickerOpenChange('background', open)}
                    open={colorPickerOpen.background}
                    showText
                    trigger="click"
                  />
                </Col>
              </Row>
            </Panel>
          )}

          {/* 渐变设置 */}
          {config.enabled && config.type === 'gradient' && (
            <Panel
              header={t('theme:background.gradientSettings', '渐变设置')}
              key="gradient"
              extra={<BgColorsOutlined />}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* 渐变类型 */}
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t('theme:background.gradientType', '渐变类型')}:</Text>
                  </Col>
                  <Col span={16}>
                    <Select
                      value={config.gradient.type}
                      onChange={(value) => handleGradientTypeChange(value as 'linear' | 'radial')}
                      style={{ width: '100%' }}
                    >
                      <Option value="linear">{t('theme:background.gradientTypes.linear', '线性渐变')}</Option>
                      <Option value="radial">{t('theme:background.gradientTypes.radial', '径向渐变')}</Option>
                    </Select>
                  </Col>
                </Row>

                {/* 渐变方向 (仅线性渐变) */}
                {config.gradient.type === 'linear' && (
                  <Row gutter={16} align="middle">
                    <Col span={8}>
                      <Text>{t('theme:background.gradientDirection', '渐变方向')}:</Text>
                    </Col>
                    <Col span={16}>
                      <Slider
                        min={0}
                        max={360}
                        value={config.gradient.direction}
                        onChange={handleGradientDirectionChange}
                        tooltip={{ formatter: (value) => `${value}°` }}
                      />
                    </Col>
                  </Row>
                )}

                {/* 渐变颜色 */}
                <div>
                  <Row justify="space-between" align="middle" style={{ marginBottom: '12px' }}>
                    <Col>
                      <Text>
                        {t('theme:background.gradientColors', '渐变颜色')}:
                      </Text>
                    </Col>
                    <Col>
                      <Button
                        type="text"
                        icon={<PlusOutlined />}
                        size="small"
                        onClick={handleAddGradientColor}
                        disabled={Array.isArray(config.gradient.colors) && config.gradient.colors.length >= 5}
                        title={t('theme:background.addColor', '添加颜色')}
                      >
                        {t('theme:background.addColor', '添加颜色')}
                      </Button>
                    </Col>
                  </Row>
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {Array.isArray(config.gradient.colors) && config.gradient.colors.length > 0 ? config.gradient.colors.map((colorStop, index) => (
                      <Row key={index} gutter={16} align="middle">
                        <Col span={6}>
                          <Text>
                            {index === 0
                              ? t('theme:background.startColor', '起始')
                              : (Array.isArray(config.gradient.colors) && index === config.gradient.colors.length - 1)
                                ? t('theme:background.endColor', '结束')
                                : `${t('theme:background.colorStop', '颜色')} ${index + 1}`
                            }:
                          </Text>
                        </Col>
                        <Col span={10}>
                          <ColorPicker
                            value={colorStop.color}
                            onChange={(color) => handleGradientColorChange(index, color)}
                            onOpenChange={(open) => handleColorPickerOpenChange(`gradient${index}`, open)}
                            open={colorPickerOpen[`gradient${index}`]}
                            showText
                            trigger="click"
                          />
                        </Col>
                        <Col span={4}>
                          <Text type="secondary">{colorStop.position}%</Text>
                        </Col>
                        <Col span={4}>
                          {Array.isArray(config.gradient.colors) && config.gradient.colors.length > 2 && (
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              size="small"
                              onClick={() => handleRemoveGradientColor(index)}
                              title={t('theme:background.removeColor', '删除颜色')}
                            />
                          )}
                        </Col>
                      </Row>
                    )) : (
                      <Alert
                        message={t('theme:background.noGradientColors', '没有渐变颜色')}
                        description={t('theme:background.clickAddColor', '点击"添加颜色"按钮添加渐变颜色')}
                        type="info"
                        showIcon
                      />
                    )}
                  </Space>
                </div>
              </Space>
            </Panel>
          )}

          {/* 图片设置 */}
          {config.enabled && config.type === 'image' && (
            <Panel 
              header={t('theme:background.imageSettings', '图片设置')} 
              key="image"
              extra={<PictureOutlined />}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* 图片上传 */}
                <BackgroundImageUpload
                  onImageSelect={handleImageSelect}
                  onImageRemove={handleImageRemove}
                  currentImage={config.image.path}
                  loading={loading}
                />

                <Divider />

                {/* 显示模式 */}
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t('theme:background.displayMode', '显示模式')}:</Text>
                  </Col>
                  <Col span={16}>
                    <Select
                      value={config.image.displayMode}
                      onChange={handleDisplayModeChange}
                      style={{ width: '100%' }}
                    >
                      <Option value="stretch">{t('theme:background.modes.stretch', '拉伸')}</Option>
                      <Option value="tile">{t('theme:background.modes.tile', '平铺')}</Option>
                      <Option value="center">{t('theme:background.modes.center', '居中')}</Option>
                      <Option value="cover">{t('theme:background.modes.cover', '覆盖')}</Option>
                      <Option value="contain">{t('theme:background.modes.contain', '包含')}</Option>
                    </Select>
                  </Col>
                </Row>

                {/* 图片效果 */}
                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t('theme:background.blur', '模糊度')}:</Text>
                  </Col>
                  <Col span={16}>
                    <Slider
                      min={0}
                      max={20}
                      value={config.image.blur}
                      onChange={(value) => handleImageEffectChange('blur', value)}
                      tooltip={{ formatter: (value) => `${value}px` }}
                    />
                  </Col>
                </Row>

                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t('theme:background.brightness', '亮度')}:</Text>
                  </Col>
                  <Col span={16}>
                    <Slider
                      min={0}
                      max={200}
                      value={config.image.brightness}
                      onChange={(value) => handleImageEffectChange('brightness', value)}
                      tooltip={{ formatter: (value) => `${value}%` }}
                    />
                  </Col>
                </Row>

                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t('theme:background.contrast', '对比度')}:</Text>
                  </Col>
                  <Col span={16}>
                    <Slider
                      min={0}
                      max={200}
                      value={config.image.contrast}
                      onChange={(value) => handleImageEffectChange('contrast', value)}
                      tooltip={{ formatter: (value) => `${value}%` }}
                    />
                  </Col>
                </Row>

                <Row gutter={16} align="middle">
                  <Col span={8}>
                    <Text>{t('theme:background.saturation', '饱和度')}:</Text>
                  </Col>
                  <Col span={16}>
                    <Slider
                      min={0}
                      max={200}
                      value={config.image.saturation}
                      onChange={(value) => handleImageEffectChange('saturation', value)}
                      tooltip={{ formatter: (value) => `${value}%` }}
                    />
                  </Col>
                </Row>
              </Space>
            </Panel>
          )}

          {/* 缓存管理 */}
          <Panel
            header={t('theme:background.cacheManagement', '缓存管理')}
            key="cache"
            extra={<PictureOutlined />}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Alert
                message={t('theme:background.imageCache', '图片缓存')}
                description={t('theme:background.cachedImagesDesc', '点击图片可快速切换背景，点击删除按钮可移除缓存')}
                type="info"
                showIcon
              />

              {loadingCachedImages ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <Text>{t('common:loading', '加载中...')}</Text>
                </div>
              ) : cachedImages.length > 0 ? (
                <List
                  grid={{ gutter: 16, column: 3 }}
                  dataSource={cachedImages}
                  renderItem={(item) => (
                    <List.Item>
                      <Card
                        hoverable
                        size="small"
                        cover={
                          <div style={{ height: '80px', overflow: 'hidden', cursor: 'pointer' }}>
                            <Image
                              src={`file://${item.cachedPath}`}
                              alt={item.originalPath}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              preview={false}
                              onClick={() => handleCachedImageSwitch(item)}
                            />
                          </div>
                        }
                        actions={[
                          <Tooltip title={t('theme:background.switchToImage', '切换到此背景')} key="switch">
                            <Button
                              type="text"
                              icon={<EyeOutlined />}
                              onClick={() => handleCachedImageSwitch(item)}
                            />
                          </Tooltip>,
                          <Tooltip title={t('theme:background.renameImage', '重命名图片')} key="rename">
                            <Button
                              type="text"
                              icon={<EditOutlined />}
                              onClick={() => handleCachedImageRename(item)}
                            />
                          </Tooltip>,
                          <Popconfirm
                            title={t('theme:background.confirmRemoveCache', '确认删除缓存')}
                            description={t('theme:background.confirmRemoveCacheContent', '确定要从缓存中删除图片 "{{fileName}}" 吗？此操作不可撤销。', { fileName: item.originalPath })}
                            onConfirm={() => handleCachedImageRemove(item)}
                            okText={t('common:confirm', '确认')}
                            cancelText={t('common:cancel', '取消')}
                            key="delete"
                          >
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                            />
                          </Popconfirm>
                        ]}
                      >
                        <Card.Meta
                          title={
                            <Text ellipsis style={{ fontSize: '12px' }}>
                              {item.originalPath}
                            </Text>
                          }
                          description={
                            <Text type="secondary" style={{ fontSize: '10px' }}>
                              {`${item.width}×${item.height} • ${Math.round(item.size / 1024)}KB`}
                            </Text>
                          }
                        />
                      </Card>
                    </List.Item>
                  )}
                />
              ) : (
                <Alert
                  message={t('theme:background.noCachedImages', '暂无缓存图片')}
                  description={t('theme:background.cachedImagesDesc', '点击图片可快速切换背景，点击删除按钮可移除缓存')}
                  type="info"
                  showIcon
                />
              )}
            </Space>
          </Panel>

          {/* 性能设置 */}
          <Panel
            header={t('theme:background.performanceSettings', '性能设置')}
            key="performance"
            extra={<InfoCircleOutlined />}
          >
            <Alert
              message={t('theme:background.performanceTip', '性能提示')}
              description={t('theme:background.performanceDesc', '高分辨率背景图片可能影响应用性能，建议使用适当的压缩设置。')}
              type="info"
              showIcon
            />
          </Panel>
        </Collapse>
      </Card>
    </div>
  );
};
