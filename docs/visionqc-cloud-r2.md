# Vision QC Cloud R2 Setup

Vision QC can load cloud projects from a private Cloudflare R2 bucket through:

- `GET /api/visionqc-project?project=<project-id>`
- `GET /api/visionqc-object?key=<r2-object-key>`

## Required Binding

Bind an R2 bucket to the Pages/Worker environment with this binding name:

```txt
VISION_QC_DATA
```

Recommended bucket name:

```txt
fromlilo-vision-qc
```

## R2 Layout

Each project has a manifest:

```txt
projects/<project-id>/manifest.json
```

Example:

```json
{
  "name": "vehicle_defect_sample",
  "format": "coco",
  "classes": [
    "airvent",
    "bezel",
    "cap_black",
    "cap_ect",
    "cap_white",
    "clip",
    "front",
    "screw",
    "switch_dbc",
    "switch_epb",
    "switch_pas",
    "switch_svm",
    "table"
  ],
  "images": [
    {
      "key": "projects/vehicle-defect/images/CAM3/MAINBODY-STD_125939.png",
      "name": "MAINBODY-STD_125939.png",
      "path": "CAM3/MAINBODY-STD_125939.png"
    }
  ],
  "labels": [
    {
      "key": "projects/vehicle-defect/labels/defect_CAM3_20images_coco.json",
      "name": "defect_CAM3_20images_coco.json",
      "path": "labels/defect_CAM3_20images_coco.json"
    }
  ]
}
```

## Upload Rule

- Put images under `projects/<project-id>/images/...`
- Put YOLO/COCO/LabelMe labels under `projects/<project-id>/labels/...`
- Keep `manifest.json` small and explicit. Vision QC reads only files listed in the manifest.

Create a manifest from local folders:

```bash
npm run visionqc:manifest -- vehicle-defect ./images ./labels ./manifest.json
```

Then upload it to:

```txt
projects/vehicle-defect/manifest.json
```

## UI Usage

Open Vision QC and enter the project id, for example:

```txt
vehicle-defect
```

Then click `LOAD` under `CLOUD`.
