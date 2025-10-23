import { useState, useCallback } from 'react';
import { ViewType, ImageDimensions } from '../utils/photoCropping/types';
import { detectPose } from '../utils/photoCropping/poseDetection';
import { calculateCropForFrontView, calculateCropForSideView } from '../utils/photoCropping/cropCalculations';
import { cropImageOnCanvas, loadImageFromFile } from '../utils/photoCropping/cropImage';

export interface PhotoCroppingResult {
  croppedFile: File;
  originalFile: File;
}

export const usePhotoCropping = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const cropPhoto = useCallback(async (
    file: File,
    viewType: ViewType
  ): Promise<PhotoCroppingResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(`Processing ${viewType} photo...`);

    try {
      // Step 1: Load the image
      setProgress('Loading image...');
      const imageElement = await loadImageFromFile(file);

      // Step 2: Detect pose to get keypoints
      setProgress('Detecting body pose...');
      const pose = await detectPose(imageElement);

      if (!pose) {
        throw new Error('Could not detect a person in the photo. Please ensure the person is clearly visible.');
      }

      // Step 3: Calculate crop dimensions based on view type
      setProgress('Calculating crop...');
      const imageDimensions: ImageDimensions = {
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight
      };

      const cropDimensions = viewType === 'front'
        ? calculateCropForFrontView(pose, imageDimensions)
        : calculateCropForSideView(pose, imageDimensions);

      // Step 4: Crop the image
      setProgress('Cropping image...');
      const croppedFile = await cropImageOnCanvas(file, cropDimensions);

      setProgress('Photo processed successfully!');
      setIsProcessing(false);

      return {
        croppedFile,
        originalFile: file
      };
    } catch (err) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'An unexpected error occurred while processing the photo';

      console.error('Photo cropping error:', err);
      setError(errorMessage);
      setProgress('');
      setIsProcessing(false);
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setProgress('');
  }, []);

  return {
    cropPhoto,
    isProcessing,
    error,
    progress,
    clearError
  };
};
