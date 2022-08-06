// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { quat, vec3 } from "gl-matrix";

import { Worldview, DEFAULT_CAMERA_STATE } from "@foxglove/regl-worldview";
import GridBuilder from "@foxglove/studio-base/panels/ThreeDimensionalViz/GridBuilder";
import { OccupancyGridMessage } from "@foxglove/studio-base/types/Messages";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

import GlLineLists from "./GlLineLists";
import OccupancyGrids from "./OccupancyGrids";

export default {
  title: "panels/ThreeDimensionalViz/commands/OccupancyGrids",
  component: OccupancyGrids,
  parameters: { colorScheme: "dark" },
};

function makeGrid([px, py, pz]: vec3, [ox, oy, oz, ow]: quat): OccupancyGridMessage {
  return {
    header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "" },
    name: "",
    type: 101,
    pose: { position: { x: px!, y: py!, z: pz! }, orientation: { x: ox!, y: oy!, z: oz!, w: ow! } },
    alpha: 0.8,
    info: {
      map_load_time: { sec: 0, nsec: 0 },
      origin: emptyPose(),
      resolution: 0.2,
      width: 10,
      height: 10,
    },
    data: new Int8Array(
      `
__________
___***____
__*___*___
_*____*___
_*____*___
_*____*___
_*____*___
_*___*_*__
__***___*_
__________
`
        .trim()
        .split("\n")
        .reverse()
        .flatMap((line) => line.split("").map((char) => (char === "*" ? 100 : 0))),
    ),
  };
}

const identity = quat.create();
function rotateCorner(q: quat) {
  return quat.rotateX(quat.create(), quat.rotateY(quat.create(), q, -Math.PI / 4), Math.PI / 2);
}

export function Rotations(): JSX.Element {
  return (
    <Worldview
      defaultCameraState={{
        ...DEFAULT_CAMERA_STATE,
        distance: 20,
        thetaOffset: Math.PI / 2,
        phi: 1,
      }}
      cameraMode="perspective"
      hideDebug
    >
      <GlLineLists glLineLists={[GridBuilder.BuildGrid({ width: 20, subdivisions: 19 })]} />
      <OccupancyGrids>
        {[
          makeGrid([-5, 5, 0], quat.rotateX(quat.create(), identity, 0)),
          makeGrid([-3, 5, 0], quat.rotateX(quat.create(), identity, Math.PI / 8)),
          makeGrid([-1, 5, 0], quat.rotateX(quat.create(), identity, Math.PI / 4)),
          makeGrid([1, 5, 0], quat.rotateX(quat.create(), identity, (3 * Math.PI) / 8)),
          makeGrid([3, 5, 0], quat.rotateX(quat.create(), identity, Math.PI / 2)),

          makeGrid([-5, -5, 0], quat.rotateY(quat.create(), identity, 0)),
          makeGrid([-5, -3, 0], quat.rotateY(quat.create(), identity, -Math.PI / 8)),
          makeGrid([-5, -1, 0], quat.rotateY(quat.create(), identity, -Math.PI / 4)),
          makeGrid([-5, 1, 0], quat.rotateY(quat.create(), identity, -(3 * Math.PI) / 8)),
          makeGrid([-5, 3, 0], quat.rotateY(quat.create(), identity, -Math.PI / 2)),

          makeGrid([-2, 2, 0], rotateCorner(quat.rotateZ(quat.create(), identity, 0))),
          makeGrid([0, 0, 0], rotateCorner(quat.rotateZ(quat.create(), identity, -Math.PI / 8))),
          makeGrid([2, -2, 0], rotateCorner(quat.rotateZ(quat.create(), identity, -Math.PI / 4))),
          makeGrid(
            [4, -4, 0],
            rotateCorner(quat.rotateZ(quat.create(), identity, -(3 * Math.PI) / 8)),
          ),
          makeGrid([6, -6, 0], rotateCorner(quat.rotateZ(quat.create(), identity, -Math.PI / 2))),
        ]}
      </OccupancyGrids>
    </Worldview>
  );
}
