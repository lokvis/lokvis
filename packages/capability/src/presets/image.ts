/**
 * 图像能力预设
 *
 * 8 个标准图像能力声明:resize / compress / convert / crop / rotate / flip /
 * watermark / background。Plugin 作者可直接引用,也可自定义覆盖。
 */
import type { Capability } from '@lokvis/schema';

export const IMAGE_RESIZE: Capability = {
  name: 'image.resize',
  description: 'Resize image to specified dimensions',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'width', type: 'number', required: false, min: 1, description: 'Target width in pixels' },
    { name: 'height', type: 'number', required: false, min: 1, description: 'Target height in pixels' },
    {
      name: 'fit',
      type: 'enum',
      values: ['cover', 'contain', 'fill', 'inside', 'outside'],
      default: 'cover',
      description: 'Fit strategy when aspect ratio differs',
    },
    { name: 'maintainAspectRatio', type: 'boolean', default: true },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_COMPRESS: Capability = {
  name: 'image.compress',
  description: 'Compress image with specified quality',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['webp', 'avif', 'jpeg', 'png'],
      default: 'webp',
    },
    { name: 'quality', type: 'number', min: 0, max: 100, default: 85 },
    { name: 'targetSize', type: 'number', required: false, description: 'Target size in bytes (optional)' },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_CONVERT: Capability = {
  name: 'image.convert',
  description: 'Convert image to another format',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'format',
      type: 'enum',
      values: ['png', 'jpeg', 'webp', 'avif', 'gif'],
      required: true,
    },
    { name: 'quality', type: 'number', min: 0, max: 100, default: 90 },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_CROP: Capability = {
  name: 'image.crop',
  description: 'Crop image to a region',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'x', type: 'number', required: true, min: 0 },
    { name: 'y', type: 'number', required: true, min: 0 },
    { name: 'width', type: 'number', required: true, min: 1 },
    { name: 'height', type: 'number', required: true, min: 1 },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_ROTATE: Capability = {
  name: 'image.rotate',
  description: 'Rotate image by degrees',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'angle', type: 'number', required: true, description: 'Rotation angle in degrees' },
    { name: 'background', type: 'color', default: '#ffffff' },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_FLIP: Capability = {
  name: 'image.flip',
  description: 'Flip image horizontally or vertically',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    {
      name: 'axis',
      type: 'enum',
      values: ['horizontal', 'vertical', 'both'],
      required: true,
    },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_WATERMARK: Capability = {
  name: 'image.watermark',
  description: 'Add text or image watermark',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [
    { name: 'text', type: 'string', required: false, description: 'Text watermark' },
    { name: 'image', type: 'file', required: false, description: 'Image watermark (data URL)' },
    {
      name: 'position',
      type: 'enum',
      values: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'tile'],
      default: 'bottom-right',
    },
    { name: 'opacity', type: 'number', min: 0, max: 1, default: 0.8 },
    { name: 'fontSize', type: 'number', default: 24 },
    { name: 'color', type: 'color', default: '#ffffff' },
  ],
  performance: 'fast',
  batchable: true,
};

export const IMAGE_BACKGROUND: Capability = {
  name: 'image.background',
  description: 'Set background color (for transparent images)',
  inputTypes: ['image'],
  outputTypes: ['image'],
  params: [{ name: 'color', type: 'color', default: '#ffffff' }],
  performance: 'fast',
  batchable: true,
};

/** 所有内置图像能力预设 */
export const IMAGE_CAPABILITIES: Capability[] = [
  IMAGE_RESIZE,
  IMAGE_COMPRESS,
  IMAGE_CONVERT,
  IMAGE_CROP,
  IMAGE_ROTATE,
  IMAGE_FLIP,
  IMAGE_WATERMARK,
  IMAGE_BACKGROUND,
];
