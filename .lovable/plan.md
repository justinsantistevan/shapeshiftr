

## Fix: Side View Photo Cropping Cuts Off Raised Hand

### Problem
The side view cropper is cutting off the photo below the wrists (or even lower) instead of above the fingertips. This happens because:

1. **No confidence filtering on keypoints** -- PoseNet always returns all keypoints, but with low-confidence scores when detection is uncertain. The code uses these inaccurate positions without checking confidence.
2. **No fingertip compensation** -- PoseNet only detects wrists, not fingertips. When the arm is raised overhead, the fingers extend significantly above the wrist.

### Solution (minimal, no padding number changes)

**File: `src/utils/photoCropping/poseDetection.ts`**
- Add a confidence threshold parameter to `getKeypointByName` (default 0.3). If the keypoint's `score` is below this threshold, return `null` instead of the inaccurate position.

**File: `src/utils/photoCropping/cropCalculations.ts`**
- When a wrist keypoint is used as the `topY` (i.e., it's the highest detected point and is above the head), add a small fingertip extension factor. This accounts for the hand/fingers above the wrist -- estimated as a percentage of the distance from elbow to wrist (roughly 30-40% of forearm length), rather than changing the overall padding values.
- This extension only applies when the wrist is the topmost point and above the head, so it won't affect photos where the arms are down.

### Why this won't break prior weeks
- Adding confidence filtering only removes *bad* keypoints (low score), which were causing incorrect crops. Good detections from prior weeks will pass the threshold.
- The fingertip extension is proportional and only activates when a wrist is the highest point, matching the raised-arm pose. Prior weeks with the same pose would have benefited from this too (they may have just had luckier wrist detection).

### Technical Details

In `getKeypointByName`, change:
```typescript
export const getKeypointByName = (
  pose: Pose, name: string, minConfidence: number = 0.3
): PoseKeypoint | null => {
  const kp = pose.keypoints.find(kp => kp.part === name);
  if (!kp || kp.score < minConfidence) return null;
  return kp;
};
```

In both `calculateCropForFrontView` and `calculateCropForSideView`, after determining `topY` from wrists, add fingertip compensation:
```typescript
// If a wrist is the topmost point (arm raised), extend upward
// to account for hand/fingers (~30% of forearm length)
if (topWristUsed && topElbow) {
  const forearmLength = Math.abs(topWristUsed.position.y - topElbow.position.y);
  topY -= forearmLength * 0.35;
}
```

