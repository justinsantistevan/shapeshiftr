// Pose detection types
export interface PoseKeypoint {
  position: {
    x: number;
    y: number;
  };
  score: number;
  part: string;
}

export interface Pose {
  keypoints: PoseKeypoint[];
  score: number;
}

// Crop calculation types
export interface CropDimensions {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

// View type
export type ViewType = 'front' | 'side';
