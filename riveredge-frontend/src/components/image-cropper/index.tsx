/**
 * 图片剪裁组件
 * 
 * 支持圆形、方形、自由剪裁、不剪裁四种模式
 * - 方形/圆形：react-easy-crop（固定宽高比）
 * - 自由剪裁：react-image-crop（可拖拽调整裁剪框尺寸，真正自由）
 * 
 * Author: Luigi Lu
 * Date: 2025-12-28
 */

import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import ReactCrop, { centerCrop, type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Modal, Button, Space, Radio, Slider } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { Area } from 'react-easy-crop';

/**
 * 剪裁形状类型
 */
export type CropShape = 'rect' | 'round' | 'free' | 'none';

/**
 * 图片剪裁组件属性
 */
export interface ImageCropperProps {
  /**
   * 是否显示剪裁弹窗
   */
  open: boolean;
  
  /**
   * 关闭弹窗回调
   */
  onCancel: () => void;
  
  /**
   * 确认剪裁回调
   * @param croppedImageBlob - 剪裁后的图片Blob对象
   */
  onConfirm: (croppedImageBlob: Blob) => void;
  
  /**
   * 原始图片URL或File对象
   */
  image: string | File | null;
  
  /**
   * 弹窗标题（默认：'剪裁图片'）
   */
  title?: string;
  
  /**
   * 默认剪裁形状（默认：'rect'）
   */
  defaultShape?: CropShape;
}

/**
 * 图片剪裁组件
 */
const ImageCropper: React.FC<ImageCropperProps> = ({
  open,
  onCancel,
  onConfirm,
  image,
  title = '剪裁图片',
  defaultShape = 'rect',
}) => {
  const [cropShape, setCropShape] = useState<CropShape>(defaultShape);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // 自由剪裁：使用 react-image-crop，支持拖拽调整裁剪框尺寸
  const [freeCrop, setFreeCrop] = useState<Crop | undefined>(undefined);
  const imgRef = useRef<HTMLImageElement>(null);

  // 根据剪裁形状计算宽高比（仅用于 react-easy-crop，自由剪裁用 ReactCrop）
  const cropAspect = React.useMemo(() => {
    if (cropShape === 'none') return undefined;
    if (cropShape === 'round') return 1;
    if (cropShape === 'rect') return 1;
    return 1;
  }, [cropShape]);

  const isNoCrop = cropShape === 'none';
  const isFreeCrop = cropShape === 'free';

  // 加载图片
  React.useEffect(() => {
    if (!image) {
      setImageSrc(null);
      setFreeCrop(undefined);
      return;
    }

    const loadImage = async () => {
      try {
        let url: string;
        if (typeof image === 'string') {
          url = image;
        } else {
          url = URL.createObjectURL(image);
        }
        setImageSrc(url);
      } catch (error) {
        console.error('加载图片失败:', error);
      }
    };

    loadImage();

    // 清理函数：如果是File对象创建的URL，需要释放
    return () => {
      if (image instanceof File) {
        // 注意：这里不能立即释放，因为可能还在使用中
        // 实际释放会在组件卸载或图片变更时进行
      }
    };
  }, [image]);

  // 处理剪裁区域变化
  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // 将canvas转换为Blob
  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });
  };

  // 自由剪裁：从 ReactCrop 的 Crop 转为 Blob（支持 px 或 % 单位）
  const getCroppedImgFromFreeCrop = async (
    imageEl: HTMLImageElement,
    crop: Crop
  ): Promise<Blob> => {
    const scaleX = imageEl.naturalWidth / imageEl.width;
    const scaleY = imageEl.naturalHeight / imageEl.height;
    let px: number, py: number, pw: number, ph: number;
    if (crop.unit === '%') {
      px = (crop.x / 100) * imageEl.width;
      py = (crop.y / 100) * imageEl.height;
      pw = (crop.width / 100) * imageEl.width;
      ph = (crop.height / 100) * imageEl.height;
    } else {
      px = crop.x;
      py = crop.y;
      pw = crop.width;
      ph = crop.height;
    }
    const pixelCrop: Area = {
      x: px * scaleX,
      y: py * scaleY,
      width: pw * scaleX,
      height: ph * scaleY,
    };
    return getCroppedImg(imageSrc!, pixelCrop, 'free');
  };

  // 获取剪裁后的图片
  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    shape: CropShape
  ): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('无法创建Canvas上下文');
    }

    // 设置canvas尺寸
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // 如果是圆形，需要创建圆形遮罩
    if (shape === 'round') {
      ctx.beginPath();
      ctx.arc(
        pixelCrop.width / 2,
        pixelCrop.height / 2,
        Math.min(pixelCrop.width, pixelCrop.height) / 2,
        0,
        2 * Math.PI
      );
      ctx.clip();
    }

    // 绘制剪裁后的图片
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    // 转换为Blob
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas转换为Blob失败'));
        }
      }, 'image/png');
    });
  };

  // 处理确认剪裁
  const handleConfirm = async () => {
    if (!image) return;

    try {
      setLoading(true);
      if (isNoCrop) {
        // 不剪裁：直接使用原图
        let blob: Blob;
        if (image instanceof File) {
          blob = image;
        } else if (typeof image === 'string') {
          const res = await fetch(image);
          blob = await res.blob();
        } else {
          return;
        }
        onConfirm(blob);
      } else if (isFreeCrop && freeCrop && imgRef.current && imageSrc) {
        const croppedImageBlob = await getCroppedImgFromFreeCrop(imgRef.current, freeCrop);
        onConfirm(croppedImageBlob);
      } else if (imageSrc && croppedAreaPixels) {
        const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels, cropShape);
        onConfirm(croppedImageBlob);
      } else {
        return;
      }

      // 清理本地URL（如果是File对象创建的）
      if (image instanceof File && imageSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    } catch (error) {
      console.error('剪裁图片失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    // 清理本地URL（如果是File对象创建的）
    if (image instanceof File && imageSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(imageSrc);
    }
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setFreeCrop(undefined);
    onCancel();
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={handleCancel}
      width={800}
      footer={[
        <Button key="cancel" icon={<CloseOutlined />} onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<CheckOutlined />}
          loading={loading}
          onClick={handleConfirm}
          disabled={
            !image ||
            (!isNoCrop &&
              (isFreeCrop
                ? !freeCrop || !(freeCrop.width > 0 && freeCrop.height > 0)
                : !imageSrc || !croppedAreaPixels))
          }
        >
          确认
        </Button>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 剪裁形状选择 */}
        <div>
          <div style={{ marginBottom: 8 }}>剪裁形状：</div>
          <Radio.Group
            value={cropShape}
            onChange={(e) => {
              setCropShape(e.target.value);
              setCrop({ x: 0, y: 0 });
              setZoom(1);
              setCroppedAreaPixels(null);
              if (e.target.value !== 'free') setFreeCrop(undefined);
            }}
          >
            <Radio.Button value="rect">方形</Radio.Button>
            <Radio.Button value="round">圆形</Radio.Button>
            <Radio.Button value="free">自由剪裁</Radio.Button>
            <Radio.Button value="none">不剪裁</Radio.Button>
          </Radio.Group>
        </div>

        {/* 缩放控制（方形/圆形时显示，自由剪裁无缩放） */}
        {!isNoCrop && !isFreeCrop && (
          <div>
            <div style={{ marginBottom: 8 }}>缩放：</div>
            <Slider
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={setZoom}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* 图片展示：不剪裁时仅预览，剪裁时显示 Cropper */}
        {imageSrc && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '400px',
              background: '#f0f0f0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            {isNoCrop ? (
              <img
                src={imageSrc}
                alt="预览"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : isFreeCrop ? (
              <ReactCrop
                crop={freeCrop}
                onChange={(c) => setFreeCrop(c)}
                aspect={undefined}
                className="react-crop-free"
                style={{ maxHeight: 400 }}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="裁剪"
                  style={{ maxHeight: 400, width: '100%', objectFit: 'contain', display: 'block' }}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img && !freeCrop?.width) {
                      setFreeCrop(centerCrop({ unit: '%', width: 80, height: 80 }, img.width, img.height));
                    }
                  }}
                />
              </ReactCrop>
            ) : (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropAspect}
                cropShape={cropShape === 'round' ? 'round' : 'rect'}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: {
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                  },
                }}
              />
            )}
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default ImageCropper;

