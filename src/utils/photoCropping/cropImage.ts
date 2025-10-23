import { CropDimensions } from './types';

/**
 * Crops an image using HTML Canvas API
 * Returns a new File object with the cropped image
 */
export const cropImageOnCanvas = async (
  originalFile: File,
  cropDimensions: CropDimensions
): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(originalFile);

    img.onload = () => {
      try {
        // Create canvas with color space preservation
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', {
          colorSpace: 'display-p3', // Preserve wider color gamut if available
          willReadFrequently: false
        });

        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Set canvas size to crop dimensions
        canvas.width = Math.round(cropDimensions.width);
        canvas.height = Math.round(cropDimensions.height);

        // Disable image smoothing to preserve original quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw the cropped portion of the image
        ctx.drawImage(
          img,
          Math.round(cropDimensions.x),
          Math.round(cropDimensions.y),
          Math.round(cropDimensions.width),
          Math.round(cropDimensions.height),
          0,
          0,
          Math.round(cropDimensions.width),
          Math.round(cropDimensions.height)
        );

        // Convert canvas to blob with high quality to minimize color shift
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }

            // Create a new File from the blob
            const croppedFile = new File(
              [blob],
              originalFile.name.replace(/\.\w+$/, '-cropped$&'),
              {
                type: 'image/jpeg',
                lastModified: Date.now()
              }
            );

            console.log('Image cropped successfully:', {
              originalSize: originalFile.size,
              croppedSize: croppedFile.size,
              dimensions: `${canvas.width}x${canvas.height}`
            });

            resolve(croppedFile);
          },
          'image/jpeg',
          0.98 // Quality: 98% to minimize color shift from compression
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
};

/**
 * Helper function to load an image from a File
 * Returns a promise that resolves with the HTMLImageElement
 */
export const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image from file'));
    };

    img.src = objectUrl;
  });
};
