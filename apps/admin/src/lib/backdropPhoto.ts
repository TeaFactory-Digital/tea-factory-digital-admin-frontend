/**
 * The reader's own photo behind the glass (22 November 2026), made small enough to keep.
 *
 * A phone photo is 3 to 8 MB; browser storage holds about 5 MB for everything. So the photo
 * is drawn onto a canvas no larger than the screen needs (it is blurred behind glass, so
 * detail is wasted) and saved as a JPEG, stepping the size and quality down until it fits.
 * Nothing is uploaded anywhere: the photo stays in this browser.
 */

export class BackdropPhotoError extends Error {
  constructor(readonly code: 'not-image' | 'unreadable' | 'too-large') {
    super(code);
  }
}

/** About 1.5 MB of text, leaving the rest of the quota to the console. */
const MAX_DATA_URL = 1_500_000;
const STEPS: ReadonlyArray<{ width: number; quality: number }> = [
  { width: 1920, quality: 0.78 },
  { width: 1600, quality: 0.7 },
  { width: 1280, quality: 0.62 },
  { width: 1024, quality: 0.55 },
];

export async function prepareBackdropPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new BackdropPhotoError('not-image');
  if (file.size > 30 * 1024 * 1024) throw new BackdropPhotoError('too-large');

  const image = await load(file);
  for (const step of STEPS) {
    const scale = Math.min(1, step.width / image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new BackdropPhotoError('unreadable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', step.quality);
    if (dataUrl.length <= MAX_DATA_URL) return dataUrl;
  }
  throw new BackdropPhotoError('too-large');
}

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new BackdropPhotoError('unreadable'));
    };
    image.src = url;
  });
}
