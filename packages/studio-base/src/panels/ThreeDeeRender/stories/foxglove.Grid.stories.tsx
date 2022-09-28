// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Grid } from "@foxglove/schemas";
import { MessageEvent, Topic } from "@foxglove/studio";
import { LayerSettingsFoxgloveGrid } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/FoxgloveGrid";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { TransformStamped } from "../ros";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
};

// function rgba(r: number, g: number, b: number, a: number) {
//   return (
//     (Math.trunc(r * 255) << 24) |
//     (Math.trunc(g * 255) << 16) |
//     (Math.trunc(b * 255) << 8) |
//     Math.trunc(a * 255)
//   );
// }
function makeGridData({ rows, cols, pattern }: { rows: number; cols: number; pattern: string }) {
  const grid = new Uint8Array(rows * cols);
  const view = new DataView(grid.buffer, grid.byteOffset, grid.byteLength);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const offset = i * rows + j;
      if (pattern === "row-stripes") {
        view.setUint8(offset, i % 2 === 0 ? 100 : 0);
      } else if (pattern === "col-stripes") {
        view.setUint8(offset, j % 2 === 0 ? 100 : 0);
      } else if (pattern === "checkerboard") {
        view.setUint8(offset, (i + j) % 2 === 0 ? 100 : 0);
      }
    }
  }
  return grid;
}
function Foxglove_Grid({ rgbaFieldName }: { rgbaFieldName: string }): JSX.Element {
  const topics: Topic[] = [
    { name: "/grid", datatype: "foxglove.Grid" },
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

  const column_count = 16;
  const rowCount = 16;
  const cell_stride = 4;
  const row_stride = column_count * cell_stride;
  const rowStripes = makeGridData({ rows: rowCount, cols: column_count, pattern: "row-stripes" });
  const colStripes = makeGridData({ rows: rowCount, cols: column_count, pattern: "col-stripes" });
  const checkerboard = makeGridData({
    rows: rowCount,
    cols: column_count,
    pattern: "checkerboard",
  });
  const data = new Uint8Array(column_count * rowCount * cell_stride);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < rowCount * column_count; i++) {
    const offset = i * cell_stride;
    view.setUint8(offset, rowStripes[i]!);
    view.setUint8(offset + 1, colStripes[i]!);
    view.setUint8(offset + 2, checkerboard[i]!);
  }

  const cell_size = {
    x: 10,
    y: 10,
  };
  const grid: MessageEvent<Grid> = {
    topic: "/grid",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: {
        position: { x: -0.5 * cell_size.x, y: -0.5 * cell_size.y, z: 0 },
        orientation: QUAT_IDENTITY,
      },
      cell_size,
      column_count,
      cell_stride,
      row_stride,
      fields: [
        { name: "rowStripes", offset: 0, type: 1 },
        { name: "colStripes", offset: 1, type: 1 },
        { name: "checkerboard", offset: 2, type: 1 },
      ],
      data,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/grid": [grid],
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
            "/grid": {
              visible: true,
              colorField: rgbaFieldName,
              minColor: "rgba(0, 0, 0, 255)",
              maxColor: "rgba(255, 0, 0, 255)",
            } as LayerSettingsFoxgloveGrid,
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

export const Foxglove_Grid_Column_Stripes = (): JSX.Element => (
  <Foxglove_Grid rgbaFieldName="colStripes" />
);
Foxglove_Grid_Column_Stripes.parameters = { colorScheme: "dark" };

export const Foxglove_Grid_Row_Stripes = (): JSX.Element => (
  <Foxglove_Grid rgbaFieldName="rowstrips" />
);
export const Foxglove_Grid_Checkerboard = (): JSX.Element => (
  <Foxglove_Grid rgbaFieldName="checkerboard" />
);
