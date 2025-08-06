/**
 * 自定义图标上传组件
 * 支持SVG、PNG、ICO格式的图标上传，包含文件格式验证和图标预览功能
 */

import React, { useState, useCallback } from 'react';
import {
  Upload,
  Button,
  Modal,
  message,
  Card,
  Row,
  Col,
  Input,
  Select,
  Space,
  Typography,
  Divider,
  Tooltip,
  Progress,
} from 'antd';
import {
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  EditOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { FileIconConfig} from '../utils/FileIconMapper';
import { fileIconMapper, FileCategory } from '../utils/FileIconMapper';
import { iconCacheManager } from '../utils/IconCacheManager';
import { CustomIcon, IconPreview } from './CustomIcon';
import type { UploadFile, UploadProps } from 'antd/es/upload';
import type { RcFile } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;

// 支持的文件格式
const SUPPORTED_FORMATS = ['svg', 'png', 'ico', 'jpg', 'jpeg'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// 自定义图标数据接口
interface CustomIconData {
  id: string;
  name: string;
  extension: string;
  category: FileCategory;
  color: string;
  description: string;
  dataUrl: string;
  size: number;
  uploadTime: number;
}

// 组件属性接口
export interface IconUploaderProps {
  /** 是否显示上传器 */
  visible: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 上传成功回调 */
  onUploadSuccess?: (iconData: CustomIconData) => void;
}

/**
 * 图标上传器组件
 */
export const IconUploader: React.FC<IconUploaderProps> = ({
  visible,
  onClose,
  onUploadSuccess,
}) => {
  const { t } = useTranslation(['theme', 'common']);
  
  // 状态管理
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // 表单数据
  const [iconName, setIconName] = useState('');
  const [iconExtension, setIconExtension] = useState('');
  const [iconCategory, setIconCategory] = useState<FileCategory>(FileCategory.OTHER);
  const [iconColor, setIconColor] = useState('#1890ff');
  const [iconDescription, setIconDescription] = useState('');

  // 文件上传前的验证
  const beforeUpload = useCallback((file: RcFile): boolean => {
    // 检查文件格式
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !SUPPORTED_FORMATS.includes(fileExtension)) {
      message.error(t('theme:iconUpload.formatError', '不支持的文件格式，请上传 SVG、PNG 或 ICO 文件'));
      return false;
    }

    // 检查文件大小
    if (file.size > MAX_FILE_SIZE) {
      message.error(t('theme:iconUpload.sizeError', '文件大小不能超过 2MB'));
      return false;
    }

    // 自动填充表单
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setIconName(baseName);
    setIconExtension(fileExtension);
    setIconDescription(`${baseName} 图标`);

    return false; // 阻止自动上传，手动处理
  }, [t]);

  // 处理文件变更
  const handleFileChange: UploadProps['onChange'] = useCallback((info: any) => {
    setFileList(info.fileList);
  }, []);

  // 预览图片
  const handlePreview = useCallback(async (file: UploadFile) => {
    if (!file.url && !file.preview) {
      file.preview = await getBase64(file.originFileObj as RcFile);
    }

    setPreviewImage(file.url || (file.preview as string));
    setPreviewVisible(true);
    setPreviewTitle(file.name || file.url!.substring(file.url!.lastIndexOf('/') + 1));
  }, []);

  // 移除文件
  const handleRemove = useCallback((file: UploadFile) => {
    const index = fileList.indexOf(file);
    const newFileList = fileList.slice();
    newFileList.splice(index, 1);
    setFileList(newFileList);
  }, [fileList]);

  // 上传图标
  const handleUpload = useCallback(async () => {
    if (fileList.length === 0) {
      message.error(t('theme:iconUpload.noFileError', '请先选择要上传的图标文件'));
      return;
    }

    if (!iconName.trim()) {
      message.error(t('theme:iconUpload.nameRequired', '请输入图标名称'));
      return;
    }

    if (!iconExtension.trim()) {
      message.error(t('theme:iconUpload.extensionRequired', '请输入文件扩展名'));
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const file = fileList[0].originFileObj as RcFile;
      
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // 转换为 base64
      const dataUrl = await getBase64(file);
      
      // 创建自定义图标数据
      const iconData: CustomIconData = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: iconName.trim(),
        extension: iconExtension.toLowerCase().trim(),
        category: iconCategory,
        color: iconColor,
        description: iconDescription.trim() || `${iconName} 图标`,
        dataUrl,
        size: file.size,
        uploadTime: Date.now(),
      };

      // 创建图标配置
      const iconConfig: FileIconConfig = {
        icon: () => React.createElement('img', {
          src: dataUrl,
          alt: iconData.name,
          style: { width: '100%', height: '100%', objectFit: 'contain' }
        }),
        color: iconColor,
        category: iconCategory,
        description: iconData.description,
      };

      // 添加到图标映射器
      fileIconMapper.addCustomMapping(iconData.extension, iconConfig);

      // 添加到缓存
      iconCacheManager.set(`custom_${iconData.extension}`, iconConfig);

      // 保存到本地存储
      const customIcons = getCustomIcons();
      customIcons.push(iconData);
      localStorage.setItem('quickstart_custom_icons', JSON.stringify(customIcons));

      clearInterval(progressInterval);
      setUploadProgress(100);

      message.success(t('theme:iconUpload.success', '图标上传成功'));
      
      // 调用成功回调
      onUploadSuccess?.(iconData);

      // 重置表单
      resetForm();
      
      // 延迟关闭
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Icon upload failed:', error);
      message.error(t('theme:iconUpload.failed', '图标上传失败'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [fileList, iconName, iconExtension, iconCategory, iconColor, iconDescription, t, onUploadSuccess, onClose]);

  // 重置表单
  const resetForm = useCallback(() => {
    setFileList([]);
    setIconName('');
    setIconExtension('');
    setIconCategory(FileCategory.OTHER);
    setIconColor('#1890ff');
    setIconDescription('');
    setUploadProgress(0);
  }, []);

  // 获取自定义图标列表
  const getCustomIcons = (): CustomIconData[] => {
    try {
      const stored = localStorage.getItem('quickstart_custom_icons');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // 删除自定义图标
  const deleteCustomIcon = useCallback((iconId: string) => {
    const customIcons = getCustomIcons();
    const updatedIcons = customIcons.filter(icon => icon.id !== iconId);
    localStorage.setItem('quickstart_custom_icons', JSON.stringify(updatedIcons));
    
    // 从映射器中移除
    const iconToDelete = customIcons.find(icon => icon.id === iconId);
    if (iconToDelete) {
      fileIconMapper.removeMapping(iconToDelete.extension);
    }
    
    message.success(t('theme:iconUpload.deleteSuccess', '图标删除成功'));
  }, [t]);

  // 上传按钮
  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>
        {t('theme:iconUpload.selectFile', '选择文件')}
      </div>
    </div>
  );

  return (
    <>
      <Modal
        title={t('theme:iconUpload.title', '自定义图标上传')}
        open={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button key="cancel" onClick={onClose}>
            {t('common:cancel', '取消')}
          </Button>,
          <Button key="reset" onClick={resetForm}>
            {t('common:reset', '重置')}
          </Button>,
          <Button
            key="upload"
            type="primary"
            loading={uploading}
            onClick={handleUpload}
            icon={<SaveOutlined />}
          >
            {t('theme:iconUpload.upload', '上传图标')}
          </Button>,
        ]}
      >
        <Row gutter={24}>
          {/* 左侧：文件上传 */}
          <Col span={12}>
            <Card size="small" title={t('theme:iconUpload.fileSelection', '文件选择')}>
              <Upload
                listType="picture-card"
                fileList={fileList}
                beforeUpload={beforeUpload}
                onChange={handleFileChange}
                onPreview={handlePreview}
                onRemove={handleRemove}
                accept=".svg,.png,.ico,.jpg,.jpeg"
                maxCount={1}
              >
                {fileList.length >= 1 ? null : uploadButton}
              </Upload>
              
              {uploading && (
                <Progress
                  percent={uploadProgress}
                  status={uploadProgress === 100 ? 'success' : 'active'}
                  style={{ marginTop: 16 }}
                />
              )}
              
              <div style={{ marginTop: 16, fontSize: '12px', color: '#666' }}>
                <div>{t('theme:iconUpload.supportedFormats', '支持格式')}: SVG, PNG, ICO, JPG</div>
                <div>{t('theme:iconUpload.maxSize', '最大大小')}: 2MB</div>
              </div>
            </Card>
          </Col>

          {/* 右侧：图标配置 */}
          <Col span={12}>
            <Card size="small" title={t('theme:iconUpload.iconConfig', '图标配置')}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text>{t('theme:iconUpload.iconName', '图标名称')}:</Text>
                  <Input
                    value={iconName}
                    onChange={(e) => setIconName(e.target.value)}
                    placeholder={t('theme:iconUpload.iconNamePlaceholder', '请输入图标名称')}
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div>
                  <Text>{t('theme:iconUpload.fileExtension', '文件扩展名')}:</Text>
                  <Input
                    value={iconExtension}
                    onChange={(e) => setIconExtension(e.target.value)}
                    placeholder={t('theme:iconUpload.extensionPlaceholder', '如：myfile')}
                    style={{ marginTop: 4 }}
                  />
                </div>

                <div>
                  <Text>{t('theme:iconUpload.category', '分类')}:</Text>
                  <Select
                    value={iconCategory}
                    onChange={setIconCategory}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    <Option value={FileCategory.CODE}>{t('theme:iconUpload.categoryCode', '代码文件')}</Option>
                    <Option value={FileCategory.DOCUMENT}>{t('theme:iconUpload.categoryDocument', '文档文件')}</Option>
                    <Option value={FileCategory.MEDIA}>{t('theme:iconUpload.categoryMedia', '媒体文件')}</Option>
                    <Option value={FileCategory.ARCHIVE}>{t('theme:iconUpload.categoryArchive', '压缩文件')}</Option>
                    <Option value={FileCategory.CONFIG}>{t('theme:iconUpload.categoryConfig', '配置文件')}</Option>
                    <Option value={FileCategory.EXECUTABLE}>{t('theme:iconUpload.categoryExecutable', '可执行文件')}</Option>
                    <Option value={FileCategory.OTHER}>{t('theme:iconUpload.categoryOther', '其他')}</Option>
                  </Select>
                </div>

                <div>
                  <Text>{t('theme:iconUpload.color', '主题色')}:</Text>
                  <Input
                    type="color"
                    value={iconColor}
                    onChange={(e) => setIconColor(e.target.value)}
                    style={{ width: '100%', marginTop: 4, height: 32 }}
                  />
                </div>

                <div>
                  <Text>{t('theme:iconUpload.description', '描述')}:</Text>
                  <Input.TextArea
                    value={iconDescription}
                    onChange={(e) => setIconDescription(e.target.value)}
                    placeholder={t('theme:iconUpload.descriptionPlaceholder', '请输入图标描述')}
                    rows={3}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* 已上传的自定义图标 */}
        <Divider>{t('theme:iconUpload.customIcons', '自定义图标')}</Divider>
        <CustomIconList onDelete={deleteCustomIcon} />
      </Modal>

      {/* 图片预览 */}
      <Modal
        open={previewVisible}
        title={previewTitle}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
      >
        <img alt="preview" style={{ width: '100%' }} src={previewImage} />
      </Modal>
    </>
  );
};

// 自定义图标列表组件
const CustomIconList: React.FC<{ onDelete: (id: string) => void }> = ({ onDelete }) => {
  const { t } = useTranslation(['theme']);
  const [customIcons, setCustomIcons] = useState<CustomIconData[]>([]);

  // 加载自定义图标
  React.useEffect(() => {
    const loadCustomIcons = () => {
      try {
        const stored = localStorage.getItem('quickstart_custom_icons');
        setCustomIcons(stored ? JSON.parse(stored) : []);
      } catch {
        setCustomIcons([]);
      }
    };

    loadCustomIcons();
    
    // 监听存储变化
    const handleStorageChange = () => loadCustomIcons();
    window.addEventListener('storage', handleStorageChange);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (customIcons.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
        {t('theme:iconUpload.noCustomIcons', '暂无自定义图标')}
      </div>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      {customIcons.map((icon) => (
        <Col key={icon.id} span={6}>
          <Card
            size="small"
            hoverable
            cover={
              <div style={{ padding: '16px', textAlign: 'center', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={icon.dataUrl}
                  alt={icon.name}
                  style={{ maxWidth: '48px', maxHeight: '48px', objectFit: 'contain' }}
                />
              </div>
            }
            actions={[
              <Tooltip title={t('theme:iconUpload.preview', '预览')}>
                <EyeOutlined key="preview" />
              </Tooltip>,
              <Tooltip title={t('theme:iconUpload.delete', '删除')}>
                <DeleteOutlined key="delete" onClick={() => onDelete(icon.id)} />
              </Tooltip>,
            ]}
          >
            <Card.Meta
              title={icon.name}
              description={
                <div>
                  <div>.{icon.extension}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {(icon.size / 1024).toFixed(1)}KB
                  </div>
                </div>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};

// 工具函数：将文件转换为 base64
const getBase64 = (file: RcFile): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

export default IconUploader;
