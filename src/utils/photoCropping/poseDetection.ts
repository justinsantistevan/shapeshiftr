// Import TensorFlow.js with backends
import * as tf from '@tensorflow/tfjs';
import * as posenet from '@tensorflow-models/posenet';
import { Pose, PoseKeypoint } from './types';

// Initialize PoseNet model
let poseNetModel: posenet.PoseNet | null = null;
let isInitializing = false;

export const initializePoseNet = async (): Promise<posenet.PoseNet> => {
  if (poseNetModel) {
    return poseNetModel;
  }

  if (isInitializing) {
    // Wait for initialization to complete
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return poseNetModel!;
  }

  isInitializing = true;
  try {
    console.log('Initializing TensorFlow.js backend...');

    // Try to set backend explicitly
    try {
      await tf.setBackend('webgl');
      console.log('WebGL backend set successfully');
    } catch (webglError) {
      console.warn('WebGL backend failed, trying CPU backend:', webglError);
      try {
        await tf.setBackend('cpu');
        console.log('CPU backend set successfully');
      } catch (cpuError) {
        console.error('Failed to set any backend:', cpuError);
        throw new Error('No TensorFlow backend available. WebGL and CPU backends both failed.');
      }
    }

    // Ensure TensorFlow.js backend is ready
    await tf.ready();
    console.log('TensorFlow.js backend ready:', tf.getBackend());

    console.log('Loading PoseNet model...');
    poseNetModel = await posenet.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      inputResolution: { width: 640, height: 480 },
      multiplier: 0.75
    });
    console.log('PoseNet model loaded successfully');
    return poseNetModel;
  } catch (error) {
    console.error('Failed to load PoseNet model:', error);
    throw error;
  } finally {
    isInitializing = false;
  }
};

// Detect pose in image
export const detectPose = async (imageElement: HTMLImageElement): Promise<Pose | null> => {
  try {
    console.log('Starting pose detection...');
    console.log('Image element:', {
      width: imageElement.width,
      height: imageElement.height,
      naturalWidth: imageElement.naturalWidth,
      naturalHeight: imageElement.naturalHeight,
      complete: imageElement.complete,
      src: imageElement.src?.substring(0, 50) + '...'
    });

    if (!imageElement.complete || imageElement.naturalWidth === 0) {
      throw new Error('Image not fully loaded');
    }

    const model = await initializePoseNet();
    console.log('Model loaded successfully');

    console.log('Running pose estimation...');
    const pose = await model.estimateSinglePose(imageElement, {
      flipHorizontal: false
    });

    console.log('Pose detection completed:', {
      score: pose.score,
      keypoints: pose.keypoints.length
    });

    if (!pose || pose.keypoints.length === 0) {
      console.error('No keypoints detected in pose');
      return null;
    }

    return pose;
  } catch (error) {
    console.error('Error detecting pose:', error);
    throw error;
  }
};

// Get keypoint by name
export const getKeypointByName = (
  pose: Pose, name: string, minConfidence: number = 0.3
): PoseKeypoint | null => {
  const kp = pose.keypoints.find(kp => kp.part === name);
  if (!kp || kp.score < minConfidence) return null;
  return kp;
};
