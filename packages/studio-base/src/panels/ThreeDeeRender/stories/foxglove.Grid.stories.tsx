// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { vec3 } from "gl-matrix";

import type { PointCloud } from "@foxglove/schemas";
import { MessageEvent, Topic } from "@foxglove/studio";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { TransformStamped } from "../ros";
import { QUAT_IDENTITY, rad2deg, VEC3_ZERO } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

function rgba(r: number, g: number, b: number, a: number) {
  return (
    (Math.trunc(r * 255) << 24) |
    (Math.trunc(g * 255) << 16) |
    (Math.trunc(b * 255) << 8) |
    Math.trunc(a * 255)
  );
}

function Foxglove_Grid({ rgbaFieldName }: { rgbaFieldName: string }): JSX.Element {
  const topics: Topic[] = [
    { name: "/pointcloud", datatype: "foxglove.Grid" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };

  const SCALE = 10 / 128;

  function f(x: number, y: number) {
    return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
  }

  function jet(x: number, a: number): number {
    const i = Math.trunc(x * 255);
    const r = Math.max(0, Math.min(255, 4 * (i - 96), 255 - 4 * (i - 224)));
    const g = Math.max(0, Math.min(255, 4 * (i - 32), 255 - 4 * (i - 160)));
    const b = Math.max(0, Math.min(255, 4 * i + 127, 255 - 4 * (i - 96)));
    return rgba(r / 255, g / 255, b / 255, a);
  }

  const data = new Uint8Array(128 * 128 * 16);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < 128; y += 3) {
    for (let x = 0; x < 128; x += 3) {
      const i = (y * 128 + x) * 16;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5, true);
      view.setUint32(i + 12, jet(f(x, y) * 2, x / 128), true);
    }
  }

  const pointCloud: MessageEvent<PointCloud> = {
    topic: "/grid",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      cell_size: {
        x: 1, y: 1,
      },
      column_count: 10,
      cell_stride: 16,
      row_stride: 10 * 16
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
        { name: "z", offset: 8, type: 7 },
        { name: rgbaFieldName, offset: 12, type: 6 },
      ],
      data,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/pointcloud": [pointCloud],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pointcloud": {
              visible: true,
              pointSize: 10,
              colorMode: rgbaFieldName,
              colorField: rgbaFieldName,
              rgbByteOrder: "rgba",
            },
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: rad2deg(1.22),
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: rad2deg(-0.33),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}

  const pointCloud: MessageEvent<PointCloud> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      point_stride: 13,
      pose: { position: VEC3_ZERO, orientation: QUAT_IDENTITY },
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
        { name: "z", offset: 8, type: 7 },
        { name: "intensity", offset: 12, type: 1 },
      ],
      data,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/pointcloud": [pointCloud],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/pointcloud": {
              visible: true,
              pointSize: 5,
            },
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: rad2deg(1.22),
            targetOffset: [0.25, -0.5, 3],
            thetaOffset: rad2deg(-0.33),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}

// Render a flat plane if we only have two dimensions
Foxglove_PointCloud_TwoDimensions.parameters = { colorScheme: "dark" };
export function Foxglove_PointCloud_TwoDimensions(): JSX.Element {
  const topics: Topic[] = [{ name: "/pointcloud", datatype: "foxglove.PointCloud" }];

  const SCALE = 10 / 128;

  function f(x: number, y: number) {
    return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
  }

  const data = new Uint8Array(128 * 128 * 12);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 12;
      view.setFloat32(i + 0, x * SCALE - 5, true);
      view.setFloat32(i + 4, y * SCALE - 5, true);
      view.setFloat32(i + 8, f(x, y) * 5, true);
    }
  }

  const pointCloud: MessageEvent<PointCloud> = {
    topic: "/pointcloud",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      point_stride: 12,
      pose: { position: VEC3_ZERO, orientation: { x: 0.707, y: 0, z: 0, w: 0.707 } },
      fields: [
        { name: "x", offset: 0, type: 7 },
        { name: "y", offset: 4, type: 7 },
      ],
      data,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/pointcloud": [pointCloud],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "sensor",
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: rad2deg(1.22),
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: rad2deg(-0.33),
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            "/pointcloud": { visible: true },
          },
        }}
      />
    </PanelSetup>
  );
}
