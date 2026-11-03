export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 4096;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
export const IMAGE_LIMITS_LABEL = 'JPEG, PNG, WebP or AVIF · Max 5 MB · Max 4096 × 4096 px per image';

export async function validateImageUpload(file) {
  if (!IMAGE_ACCEPT.split(',').includes(file.type)) {
    throw new Error('Please choose a JPEG, PNG, WebP or AVIF image.');
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new Error('Each image must be non-empty and no larger than 5 MB.');
  }
  let width, height;
  if (typeof createImageBitmap === 'function') {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      ({ width, height } = bitmap);
    } catch {
      throw new Error('This image could not be opened. Please choose another image.');
    } finally {
      bitmap?.close();
    }
  } else {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise(/** @param {(image: HTMLImageElement) => void} resolve */ (resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('This image could not be opened. Please choose another image.'));
        img.src = url;
      });
      width = image.naturalWidth;
      height = image.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!width || !height || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new Error('Each image must be no larger than 4096 × 4096 pixels. Resize it and try again.');
  }
}
