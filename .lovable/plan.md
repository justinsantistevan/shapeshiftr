

## Fix: Expand Chart Size on Mobile

The chart area in the Progress Metrics card is too small on mobile because:
1. The card has `min-h-[400px]` but the header (title, selectors, navigation buttons) takes up significant space, leaving little room for the actual chart
2. The chart container uses `flex-1` which only fills remaining space after the header
3. There's extra padding (`p-4`) inside the chart container consuming space

### Changes (single file: `src/components/MetricsChart.tsx`)

1. **Increase mobile min-height** on the card from `min-h-[400px]` to `min-h-[520px]` so the chart has more room after the header content
2. **Reduce chart container padding** on mobile from `p-4` to `p-1 md:p-4` to maximize the chart drawing area
3. **Set a min-height on the chart container** specifically for mobile: add `min-h-[250px]` so the chart never gets squished below a usable size
4. **Reduce CardHeader vertical spacing** on mobile to reclaim space for the chart

### Technical Details

- Line 190: Change `min-h-[400px]` to `min-h-[520px]`
- Line 361: Change `p-4` to `p-1 md:p-4 min-h-[250px]`
- Line 285: Reduce CardContent padding on mobile

These are small CSS-only changes that won't affect desktop/tablet layout.

