

## Fix: Side View Fingertip Compensation

### Problem
PoseNet detects wrists but not fingertips. In raised-arm side-view poses, the crop top boundary is set at the wrist with only 10% body-height padding, which isn't enough to include fingertips.

### Scope
Only `calculateCropForSideView` in `src/utils/photoCropping/cropCalculations.ts` will be modified. Front view logic stays untouched.

### Change
After the existing `topY` calculation (lines 118-122) and `bodyHeight` calculation (line 138), add fingertip compensation logic:

1. Track which wrist is highest and its corresponding elbow
2. If a wrist is the topmost (or near-topmost) keypoint, estimate fingertip position:
   - **Primary**: Extend upward by 35% of the forearm length (elbow-to-wrist distance) -- anatomically accurate hand-to-forearm ratio
   - **Fallback** (no elbow detected): Extend upward by 8% of body height
3. Update `topY` to the estimated fingertip position

### Technical Detail

The compensation block will be inserted after `bodyHeight` is computed (after line 138), and before the padding calculation (line 142). It will look like:

```text
// Fingertip compensation for raised arms (PoseNet doesn't detect fingertips)
let highestWristY = Infinity;
let correspondingElbowY: number | null = null;

if (leftWrist && leftWrist.position.y < highestWristY) {
  highestWristY = leftWrist.position.y;
  correspondingElbowY = leftElbow ? leftElbow.position.y : null;
}
if (rightWrist && rightWrist.position.y < highestWristY) {
  highestWristY = rightWrist.position.y;
  correspondingElbowY = rightElbow ? rightElbow.position.y : null;
}

if (highestWristY <= topY + 5) {
  let handExtension: number;
  if (correspondingElbowY !== null) {
    const forearmLength = Math.abs(correspondingElbowY - highestWristY);
    handExtension = forearmLength * 0.35;
  } else {
    handExtension = bodyHeight * 0.08;
  }
  topY = highestWristY - handExtension;
  console.log('Fingertip compensation applied, new topY:', topY);
}
```

Then recalculate `bodyHeight` after the adjustment so padding scales correctly:

```text
const adjustedBodyHeight = bottomY - topY;
```

The rest of the function (padding, aspect ratio, centering) will use `adjustedBodyHeight` instead of `bodyHeight`.
