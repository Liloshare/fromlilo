# Vision QC Annotation Coverage Notes

## 2026-10-07: Do not silently drop annotation values

Regression seen: some COCO deliveries include both `bbox` and `segmentation` for the same annotation. A previous parser path rendered only the bbox, so polygon values existed in the output file but were not visible in Vision QC.

Rules for future edits:

- If an annotation value exists, Vision QC should either render it or explicitly flag it.
- COCO annotations may contain `bbox`, polygon `segmentation`, flat-array `segmentation`, RLE/object `segmentation`, and `keypoints` in the same record. Do not make bbox and polygon mutually exclusive.
- LabelMe shapes may contain rectangle, polygon, point, line, circle, or other shape types. Supported types should render; unsupported non-empty shapes must not be silently ignored.
- If a value cannot be represented on canvas, set a parse error for that image so it appears in the UNMATCH filter/count. Silent fallback to MATCH is not acceptable.
- When changing parsers or renderers, test mixed-value records: bbox + polygon, polygon-only, bbox-only, keypoint, and unsupported segmentation.

Current behavior:

- COCO polygon is preferred for display when both `bbox` and polygon `segmentation` exist. Bbox is used as a fallback only when no polygon can be rendered.
- COCO flat-array segmentation is treated as one polygon.
- Unsupported COCO segmentation/keypoints and unsupported LabelMe shapes set `record.parseError`.
- `record.parseError` is included in the UNMATCH stat/filter.
