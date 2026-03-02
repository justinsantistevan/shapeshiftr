

## Add Horizontal Scrolling to Table View on Mobile

The table currently only shows a few columns on mobile because the `ScrollArea` wrapper doesn't enable horizontal scrolling. The table content overflows but is clipped.

### Changes (single file: `src/components/MetricsChart.tsx`)

1. **Wrap the table in an overflow-x-auto container** inside the existing `ScrollArea` so it scrolls both vertically (via ScrollArea) and horizontally (via native overflow). Add `<div className="min-w-[700px]">` around the `<Table>` to force a minimum width that triggers horizontal scroll, and add `overflow-x-auto` to the outer container.

### Technical Detail

- Lines 310-311: Change the inner wrapper from `<div className="absolute inset-0">` + `<ScrollArea>` to use `overflow-auto` for both axes instead of relying solely on Radix ScrollArea (which handles vertical only). The table will be wrapped in a `min-w-[700px]` div to ensure all 5 metric columns plus the date column are always rendered at full width, triggering horizontal scroll on narrow screens.
