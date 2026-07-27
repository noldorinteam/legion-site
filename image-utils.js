/* Lightweight client-side image preparation for smoother uploads */
(function () {
  'use strict';

  function nextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
  }

  async function optimize(file, options = {}) {
    const { maxDimension = 1600, quality = 0.8 } = options;
    if (!file || !file.type.startsWith('image/') || file.type === 'image/gif' || file.size < 700 * 1024) {
      return file;
    }

    await nextFrame();
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;

      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'medium';
      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      await nextFrame();

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
      canvas.width = 1;
      canvas.height = 1;
      if (!blob || blob.size >= file.size) return file;
      const baseName = file.name.replace(/\.[^.]+$/, '');
      return new File([blob], `${baseName}.webp`, { type: 'image/webp', lastModified: Date.now() });
    } catch (_) {
      bitmap?.close?.();
      return file;
    }
  }

  window.ImageUtils = { optimize, nextFrame };
})();
