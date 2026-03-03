import { Pose, CropDimensions, ImageDimensions } from './types';
import { getKeypointByName } from './poseDetection';

/**
 * Calculate crop dimensions for a front view photo
 * Uses shoulder midpoint for horizontal centering
 * Standard padding: 10% top, 8% bottom
 */
export const calculateCropForFrontView = (
  pose: Pose,
  imageDimensions: ImageDimensions
): CropDimensions => {
  console.log('Calculating crop for FRONT view...');

  const head = getKeypointByName(pose, 'nose');
  const leftAnkle = getKeypointByName(pose, 'leftAnkle');
  const rightAnkle = getKeypointByName(pose, 'rightAnkle');
  const leftShoulder = getKeypointByName(pose, 'leftShoulder');
  const rightShoulder = getKeypointByName(pose, 'rightShoulder');
  const leftWrist = getKeypointByName(pose, 'leftWrist');
  const rightWrist = getKeypointByName(pose, 'rightWrist');
  const leftElbow = getKeypointByName(pose, 'leftElbow');
  const rightElbow = getKeypointByName(pose, 'rightElbow');

  if (!head || !leftShoulder || !rightShoulder) {
    throw new Error('Required pose keypoints (head, shoulders) not found');
  }

  // Find the highest point (fingertips/wrists/elbows/head)
  let topY = head.position.y;
  let topWristUsed: typeof leftWrist = null;
  let topElbow: typeof leftElbow = null;

  if (leftWrist && leftWrist.position.y < topY) {
    topY = leftWrist.position.y;
    topWristUsed = leftWrist;
    topElbow = leftElbow;
  }
  if (rightWrist && rightWrist.position.y < topY) {
    topY = rightWrist.position.y;
    topWristUsed = rightWrist;
    topElbow = rightElbow;
  }
  if (leftElbow) topY = Math.min(topY, leftElbow.position.y);
  if (rightElbow) topY = Math.min(topY, rightElbow.position.y);

  // If a wrist is the topmost point (arm raised), extend upward
  // to account for hand/fingers (~35% of forearm length)
  if (topWristUsed && topElbow) {
    const forearmLength = Math.abs(topWristUsed.position.y - topElbow.position.y);
    topY -= forearmLength * 0.35;
  }

  // Find the lowest point (feet/ankles)
  let bottomY;
  if (leftAnkle && rightAnkle) {
    bottomY = Math.max(leftAnkle.position.y, rightAnkle.position.y);
  } else if (leftAnkle) {
    bottomY = leftAnkle.position.y;
  } else if (rightAnkle) {
    bottomY = rightAnkle.position.y;
  } else {
    // Fallback: estimate from shoulders
    const shoulderY = Math.min(leftShoulder.position.y, rightShoulder.position.y);
    bottomY = shoulderY + (shoulderY - head.position.y) * 3;
  }

  const bodyHeight = bottomY - topY;
  console.log('Body height calculated:', bodyHeight);

  // Front view padding
  const topPadding = bodyHeight * 0.10;
  const bottomPadding = bodyHeight * 0.08;
  const totalHeight = bodyHeight + topPadding + bottomPadding;

  // Calculate width for 9:16 aspect ratio
  const targetWidth = totalHeight * (9 / 16);

  // Center on shoulder midpoint (works great for T-pose)
  const bodyCenterX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
  console.log('Front view - shoulder center X:', bodyCenterX);

  // Calculate crop position
  const cropX = Math.max(0, bodyCenterX - targetWidth / 2);
  const cropY = Math.max(0, topY - topPadding);

  // Ensure crop doesn't exceed image boundaries
  const finalWidth = Math.min(targetWidth, imageDimensions.width - cropX);
  const finalHeight = Math.min(totalHeight, imageDimensions.height - cropY);

  // Ensure minimum dimensions
  const minWidth = 200;
  const minHeight = 300;
  const finalFinalWidth = Math.max(finalWidth, minWidth);
  const finalFinalHeight = Math.max(finalHeight, minHeight);

  const cropDimensions = {
    x: cropX,
    y: cropY,
    width: finalFinalWidth,
    height: finalFinalHeight
  };

  console.log('Front view crop dimensions:', cropDimensions);
  return cropDimensions;
};

/**
 * Calculate crop dimensions for a side view photo
 * Uses median of body keypoints for horizontal centering (more robust)
 * Standard padding: 10% top, 10% bottom
 */
export const calculateCropForSideView = (
  pose: Pose,
  imageDimensions: ImageDimensions
): CropDimensions => {
  console.log('Calculating crop for SIDE view...');

  const head = getKeypointByName(pose, 'nose');
  const leftAnkle = getKeypointByName(pose, 'leftAnkle');
  const rightAnkle = getKeypointByName(pose, 'rightAnkle');
  const leftShoulder = getKeypointByName(pose, 'leftShoulder');
  const rightShoulder = getKeypointByName(pose, 'rightShoulder');
  const leftWrist = getKeypointByName(pose, 'leftWrist');
  const rightWrist = getKeypointByName(pose, 'rightWrist');
  const leftElbow = getKeypointByName(pose, 'leftElbow');
  const rightElbow = getKeypointByName(pose, 'rightElbow');
  const leftHip = getKeypointByName(pose, 'leftHip');
  const rightHip = getKeypointByName(pose, 'rightHip');

  if (!head || !leftShoulder || !rightShoulder) {
    throw new Error('Required pose keypoints (head, shoulders) not found');
  }

  // Find the highest point (fingertips/wrists/elbows/head)
  let topY = head.position.y;
  let topWristUsed: typeof leftWrist = null;
  let topElbow: typeof leftElbow = null;

  if (leftWrist && leftWrist.position.y < topY) {
    topY = leftWrist.position.y;
    topWristUsed = leftWrist;
    topElbow = leftElbow;
  }
  if (rightWrist && rightWrist.position.y < topY) {
    topY = rightWrist.position.y;
    topWristUsed = rightWrist;
    topElbow = rightElbow;
  }
  if (leftElbow) topY = Math.min(topY, leftElbow.position.y);
  if (rightElbow) topY = Math.min(topY, rightElbow.position.y);

  // If a wrist is the topmost point (arm raised), extend upward
  // to account for hand/fingers (~35% of forearm length)
  if (topWristUsed && topElbow) {
    const forearmLength = Math.abs(topWristUsed.position.y - topElbow.position.y);
    topY -= forearmLength * 0.35;
  }

  // Find the lowest point (feet/ankles)
  let bottomY;
  if (leftAnkle && rightAnkle) {
    bottomY = Math.max(leftAnkle.position.y, rightAnkle.position.y);
  } else if (leftAnkle) {
    bottomY = leftAnkle.position.y;
  } else if (rightAnkle) {
    bottomY = rightAnkle.position.y;
  } else {
    // Fallback: estimate from shoulders
    const shoulderY = Math.min(leftShoulder.position.y, rightShoulder.position.y);
    bottomY = shoulderY + (shoulderY - head.position.y) * 3;
  }

  const bodyHeight = bottomY - topY;
  console.log('Body height calculated:', bodyHeight);

  // Side view padding
  const topPadding = bodyHeight * 0.10;  // 10% for raised arm with hand/fingertips
  const bottomPadding = bodyHeight * 0.10; // 10% for feet
  const totalHeight = bodyHeight + topPadding + bottomPadding;

  // Calculate width for 9:16 aspect ratio
  const targetWidth = totalHeight * (9 / 16);

  // Side view: use clustering approach to find body center
  // Collect all body keypoints and use median to avoid outliers
  const allXPositions: number[] = [];

  if (head) allXPositions.push(head.position.x);
  if (leftHip) allXPositions.push(leftHip.position.x);
  if (rightHip) allXPositions.push(rightHip.position.x);
  if (leftAnkle) allXPositions.push(leftAnkle.position.x);
  if (rightAnkle) allXPositions.push(rightAnkle.position.x);
  if (leftShoulder) allXPositions.push(leftShoulder.position.x);
  if (rightShoulder) allXPositions.push(rightShoulder.position.x);

  // Sort and find median (more robust than mean for outliers)
  allXPositions.sort((a, b) => a - b);
  const medianIndex = Math.floor(allXPositions.length / 2);

  let bodyCenterX;
  if (allXPositions.length % 2 === 0) {
    bodyCenterX = (allXPositions[medianIndex - 1] + allXPositions[medianIndex]) / 2;
  } else {
    bodyCenterX = allXPositions[medianIndex];
  }

  console.log('Side view - body center X (median):', bodyCenterX, 'from points:', allXPositions);

  // Calculate crop position
  const cropX = Math.max(0, bodyCenterX - targetWidth / 2);
  const cropY = Math.max(0, topY - topPadding);

  // Ensure crop doesn't exceed image boundaries
  const finalWidth = Math.min(targetWidth, imageDimensions.width - cropX);
  const finalHeight = Math.min(totalHeight, imageDimensions.height - cropY);

  // Ensure minimum dimensions
  const minWidth = 200;
  const minHeight = 300;
  const finalFinalWidth = Math.max(finalWidth, minWidth);
  const finalFinalHeight = Math.max(finalHeight, minHeight);

  const cropDimensions = {
    x: cropX,
    y: cropY,
    width: finalFinalWidth,
    height: finalFinalHeight
  };

  console.log('Side view crop dimensions:', cropDimensions);
  return cropDimensions;
};
