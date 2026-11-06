export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 4096;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif';
export const IMAGE_LIMITS_LABEL = 'JPEG, PNG, WebP or AVIF · Max 5 MB · Max 4096 × 4096 px per image';
export const PHOTO_POLICY_VERSION = 'revex-fashion-2026-11-05-1';
export const PHOTO_SAFETY_NOTICE = 'Photos are checked by OpenAI before upload. Ordinary underwear and swimwear photos are welcome; explicit nudity, sexual content, graphic violence and hateful imagery are blocked.';

export async function prepareImageUpload(file) {
  await validateImageUpload(file);
  // The reviewer accepts JPEG/PNG/WebP. Convert AVIF locally, and review/store
  // those same JPEG bytes rather than publishing an unreviewed original.
  if (file.type !== 'image/avif') return file;
  let image;
  const canvas = document.createElement('canvas');
  try {
    image = await createImageBitmap(file);
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare this photo.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    for (const quality of [0.9, 0.75, 0.6]) {
      const blob = await new Promise(/** @param {(blob: Blob | null) => void} resolve */ resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      }
    }
    throw new Error('This photo is too large after conversion. Please choose a smaller photo.');
  } catch {
    throw new Error('This AVIF photo could not be prepared. Please choose a JPEG, PNG or WebP version.');
  } finally {
    image?.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

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
