// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { Grid, PackedElementField } from "@foxglove/schemas";
import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import { GRID_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/foxglove";
import type { RosValue } from "@foxglove/studio-base/players/types";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { PartialMessage, PartialMessageEvent, SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { rgbaToCssString, SRGBToLinear, stringToRgba } from "../color";
import { normalizePose, normalizeTime, normalizeByteArray } from "../normalizeMessages";
import { ColorRGBA } from "../ros";
import { BaseSettings } from "../settings";

export type LayerSettingsFoxgloveGrid = BaseSettings & {
  frameLocked: boolean;
  minColor: string;
  maxColor: string;
  colorField?: string;
};

const INVALID_FOXGLOVE_GRID = "INVALID_FOXGLOVE_GRID";

const DEFAULT_MIN_COLOR = { r: 1, g: 1, b: 1, a: 1 }; // white
const DEFAULT_MAX_COLOR = { r: 0, g: 0, b: 0, a: 1 }; // black

const DEFAULT_MIN_COLOR_STR = rgbaToCssString(DEFAULT_MIN_COLOR);
const DEFAULT_MAX_COLOR_STR = rgbaToCssString(DEFAULT_MAX_COLOR);

const DEFAULT_SETTINGS: LayerSettingsFoxgloveGrid = {
  visible: false,
  frameLocked: false,
  minColor: DEFAULT_MIN_COLOR_STR,
  maxColor: DEFAULT_MAX_COLOR_STR,
};

export type FoxgloveGridUserData = BaseUserData & {
  settings: LayerSettingsFoxgloveGrid;
  topic: string;
  foxgloveGrid: Grid;
  mesh: THREE.Mesh;
  texture: THREE.DataTexture;
  material: THREE.MeshBasicMaterial;
  pickingMaterial: THREE.ShaderMaterial;
};

export class FoxgloveGridRenderable extends Renderable<FoxgloveGridUserData> {
  public override dispose(): void {
    this.userData.texture.dispose();
    this.userData.material.dispose();
    this.userData.pickingMaterial.dispose();
  }

  public override details(): Record<string, RosValue> {
    return this.userData.foxgloveGrid;
  }
}

export class FoxgloveGrid extends SceneExtension<FoxgloveGridRenderable> {
  private static geometry: THREE.PlaneGeometry | undefined;
  private fieldsByTopic = new Map<string, string[]>();

  public constructor(renderer: Renderer) {
    super("foxglove.Grid", renderer);

    renderer.addDatatypeSubscriptions(GRID_DATATYPES, this.handleFoxgloveGrid);
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.topics;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const topic of this.renderer.topics ?? []) {
      if (GRID_DATATYPES.has(topic.datatype)) {
        const config = (configTopics[topic.name] ?? {}) as Partial<LayerSettingsFoxgloveGrid>;
        const topicFields =
          this.fieldsByTopic
            .get(topic.name)
            ?.map((fieldName) => ({ label: fieldName, value: fieldName })) ?? [];

        // prettier-ignore
        const fields: SettingsTreeFields = {
          minColor: { label: "Min Color", input: "rgba", value: config.minColor ?? DEFAULT_MIN_COLOR_STR },
          maxColor: { label: "Max Color", input: "rgba", value: config.maxColor ?? DEFAULT_MAX_COLOR_STR },
          frameLocked: { label: "Frame lock", input: "boolean", value: config.frameLocked ?? false },
          colorField: { input: "select", label: "Color by", options: topicFields, value: config.colorField ?? undefined},
        };

        entries.push({
          path: ["topics", topic.name],
          node: {
            label: topic.name,
            icon: "Cells",
            fields,
            visible: config.visible ?? DEFAULT_SETTINGS.visible,
            order: topic.name.toLocaleLowerCase(),
            handler,
          },
        });
      }
    }
    return entries;
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);

    // Update the renderable
    const topicName = path[1]!;
    const renderable = this.renderables.get(topicName);
    if (renderable) {
      const prevTransparent = foxgloveGridHasTransparency(renderable.userData.settings);
      const settings = this.renderer.config.topics[topicName] as
        | Partial<LayerSettingsFoxgloveGrid>
        | undefined;
      renderable.userData.settings = { ...DEFAULT_SETTINGS, ...settings };

      // Check if the transparency changed and we need to create a new material
      const newTransparent = foxgloveGridHasTransparency(renderable.userData.settings);
      if (prevTransparent !== newTransparent) {
        renderable.userData.material.transparent = newTransparent;
        renderable.userData.material.depthWrite = !newTransparent;
        renderable.userData.material.needsUpdate = true;
      }

      this._updateFoxgloveGridRenderable(
        renderable,
        renderable.userData.foxgloveGrid,
        renderable.userData.receiveTime,
      );
    }
  };

  private handleFoxgloveGrid = (messageEvent: PartialMessageEvent<Grid>): void => {
    const topic = messageEvent.topic;
    const foxgloveGrid = normalizeFoxgloveGrid(messageEvent.message);
    const receiveTime = toNanoSec(messageEvent.receiveTime);

    let renderable = this.renderables.get(topic);
    if (!renderable) {
      // Set the initial settings from default values merged with any user settings
      const userSettings = this.renderer.config.topics[topic] as
        | Partial<LayerSettingsFoxgloveGrid>
        | undefined;
      const settings = { ...DEFAULT_SETTINGS, ...userSettings };

      const texture = createTexture(foxgloveGrid);
      const mesh = createMesh(topic, texture, settings);
      const material = mesh.material as THREE.MeshBasicMaterial;
      const pickingMaterial = mesh.userData.pickingMaterial as THREE.ShaderMaterial;

      // Create the renderable
      renderable = new FoxgloveGridRenderable(topic, this.renderer, {
        receiveTime,
        messageTime: toNanoSec(foxgloveGrid.timestamp),
        frameId: this.renderer.normalizeFrameId(foxgloveGrid.frame_id),
        pose: foxgloveGrid.pose,
        settingsPath: ["topics", topic],
        settings,
        topic,
        foxgloveGrid,
        mesh,
        texture,
        material,
        pickingMaterial,
      });
      renderable.add(mesh);

      this.add(renderable);
      this.renderables.set(topic, renderable);
    }

    let fields = this.fieldsByTopic.get(topic);
    if (!fields || fields.length !== foxgloveGrid.fields.length) {
      fields = foxgloveGrid.fields.map((field) => field.name);
      this.fieldsByTopic.set(topic, fields);
      this.updateSettingsTree();
    }

    this._updateFoxgloveGridRenderable(renderable, foxgloveGrid, receiveTime);
  };

  private _updateFoxgloveGridRenderable(
    renderable: FoxgloveGridRenderable,
    foxgloveGrid: Grid,
    receiveTime: bigint,
  ): void {
    renderable.userData.foxgloveGrid = foxgloveGrid;
    renderable.userData.pose = foxgloveGrid.pose;
    renderable.userData.receiveTime = receiveTime;
    renderable.userData.messageTime = toNanoSec(foxgloveGrid.timestamp);
    renderable.userData.frameId = this.renderer.normalizeFrameId(foxgloveGrid.frame_id);

    const { cols, rows } = getFoxgloveGridDimensions(foxgloveGrid);
    const size = cols * rows * foxgloveGrid.cell_stride;
    if (foxgloveGrid.data.length !== size) {
      const message = `FoxgloveGrid data length (${foxgloveGrid.data.length}) is not equal to cols ${cols} * rows ${rows} * cell_stride ${foxgloveGrid.cell_stride}`;
      invalidFoxgloveGridError(this.renderer, renderable, message);
      return;
    }

    const { width, height } = getGridImageDimensions(foxgloveGrid);
    let texture = renderable.userData.texture;

    if (width !== texture.image.width || height !== texture.image.height) {
      // The image dimensions changed, regenerate the texture
      texture.dispose();
      texture = createTexture(foxgloveGrid);
      renderable.userData.texture = texture;
      renderable.userData.material.map = texture;
    }

    // Update the occupancy grid texture
    updateTexture(texture, foxgloveGrid, renderable.userData.settings);

    renderable.scale.set(foxgloveGrid.cell_size.x, foxgloveGrid.cell_size.y, 1);
  }

  public static Geometry(): THREE.PlaneGeometry {
    if (!FoxgloveGrid.geometry) {
      FoxgloveGrid.geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
      FoxgloveGrid.geometry.translate(0.5, 0.5, 0);
      FoxgloveGrid.geometry.computeBoundingSphere();
    }
    return FoxgloveGrid.geometry;
  }
}

function invalidFoxgloveGridError(
  renderer: Renderer,
  renderable: FoxgloveGridRenderable,
  message: string,
): void {
  renderer.settings.errors.addToTopic(renderable.userData.topic, INVALID_FOXGLOVE_GRID, message);
}
function getFoxgloveGridDimensions(grid: Grid) {
  return {
    cols: grid.column_count,
    rows: grid.data.byteLength / grid.row_stride,
  };
}
function getGridImageDimensions(grid: Grid) {
  return {
    width: grid.cell_size.x * grid.column_count,
    height: grid.cell_size.y * (grid.data.byteLength / grid.row_stride),
  };
}

function createTexture(foxgloveGrid: Grid): THREE.DataTexture {
  const { cols, rows } = getFoxgloveGridDimensions(foxgloveGrid);
  const size = cols * rows;
  const rgba = new Uint8ClampedArray(size * 4);
  const texture = new THREE.DataTexture(
    rgba,
    cols,
    rows,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.UVMapping,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping,
    THREE.NearestFilter,
    THREE.LinearFilter,
    1,
    THREE.LinearEncoding, // FoxgloveGrid carries linear grayscale values, not sRGB
  );
  texture.generateMipmaps = false;
  return texture;
}

function createMesh(
  topic: string,
  texture: THREE.DataTexture,
  settings: LayerSettingsFoxgloveGrid,
): THREE.Mesh {
  // Create the texture, material, and mesh
  const pickingMaterial = createPickingMaterial(texture);
  const material = createMaterial(texture, topic, settings);
  const mesh = new THREE.Mesh(FoxgloveGrid.Geometry(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // This overrides the picking material used for `mesh`. See Picker.ts
  mesh.userData.pickingMaterial = pickingMaterial;
  return mesh;
}

const tempMinColor = { r: 0, g: 0, b: 0, a: 0 };
const tempMaxColor = { r: 0, g: 0, b: 0, a: 0 };

function updateTexture(
  texture: THREE.DataTexture,
  foxgloveGrid: Grid,
  settings: LayerSettingsFoxgloveGrid,
): void {
  const { colorField: colorFieldName } = settings;
  const colorField = foxgloveGrid.fields.find(({ name }) => colorFieldName === name);
  const colorFieldOffset = colorField?.offset ?? 0;
  const rgba = texture.image.data;
  stringToRgba(tempMinColor, settings.minColor);
  stringToRgba(tempMaxColor, settings.maxColor);

  srgbToLinearUint8(tempMinColor);
  srgbToLinearUint8(tempMaxColor);

  const data = foxgloveGrid.data;
  let imageOffset = 0;
  for (let i = 0; i < data.length; i += foxgloveGrid.cell_stride) {
    const value = data[i + colorFieldOffset]! | 0;
    if (value >= 0 && value <= 100) {
      // Valid [0-100]
      const t = value / 100;

      const offset = imageOffset * 4;

      // rgba[offset + 0] = t;
      // rgba[offset + 1] = t;
      // rgba[offset + 2] = t;
      // rgba[offset + 3] = t;

      if (t === 1) {
        rgba[offset + 0] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
        rgba[offset + 3] = 0;
      } else {
        rgba[offset + 0] = tempMinColor.r + (tempMaxColor.r - tempMinColor.r) * t;
        rgba[offset + 1] = tempMinColor.g + (tempMaxColor.g - tempMinColor.g) * t;
        rgba[offset + 2] = tempMinColor.b + (tempMaxColor.b - tempMinColor.b) * t;
        rgba[offset + 3] = tempMinColor.a + (tempMaxColor.a - tempMinColor.a) * t;
      }
    }
    imageOffset++;
  }

  texture.needsUpdate = true;
}

function createMaterial(
  texture: THREE.DataTexture,
  topic: string,
  settings: LayerSettingsFoxgloveGrid,
): THREE.MeshBasicMaterial {
  const transparent = foxgloveGridHasTransparency(settings);
  return new THREE.MeshBasicMaterial({
    name: `${topic}:Material`,
    // Enable alpha clipping. Fully transparent (alpha=0) pixels are skipped
    // even when transparency is disabled
    alphaTest: 1e-4,
    depthWrite: !transparent,
    map: texture,
    side: THREE.DoubleSide,
    transparent,
  });
}

function createPickingMaterial(texture: THREE.DataTexture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec4 objectId;
      varying vec2 vUv;
      void main() {
        vec4 color = texture2D(map, vUv);
        if (color.a == 0.0) {
          discard;
        }
        gl_FragColor = objectId;
      }
    `,
    side: THREE.DoubleSide,
    uniforms: { map: { value: texture }, objectId: { value: [NaN, NaN, NaN, NaN] } },
  });
}

function foxgloveGridHasTransparency(settings: LayerSettingsFoxgloveGrid): boolean {
  stringToRgba(tempMinColor, settings.minColor);
  stringToRgba(tempMaxColor, settings.maxColor);
  return tempMinColor.a < 1 || tempMaxColor.a < 1;
}

function normalizePackedElementField(
  field: PartialMessage<PackedElementField> | undefined,
): PackedElementField {
  return {
    name: field?.name ?? "",
    offset: field?.offset ?? 0,
    type: field?.type ?? 0,
  };
}

function srgbToLinearUint8(color: ColorRGBA): void {
  color.r = Math.trunc(SRGBToLinear(color.r) * 255);
  color.g = Math.trunc(SRGBToLinear(color.g) * 255);
  color.b = Math.trunc(SRGBToLinear(color.b) * 255);
  color.a = Math.trunc(color.a * 255);
}

function normalizeFoxgloveGrid(message: PartialMessage<Grid>): Grid {
  return {
    timestamp: normalizeTime(message.timestamp),
    pose: normalizePose(message.pose),
    frame_id: message.frame_id ?? "",
    row_stride: message.row_stride ?? 0,
    cell_stride: message.cell_stride ?? 0,
    column_count: message.column_count ?? 0,
    cell_size: {
      x: message.cell_size?.x ?? 1,
      y: message.cell_size?.y ?? 1,
    },
    fields: message.fields?.map(normalizePackedElementField) ?? [],
    data: normalizeByteArray(message.data),
  };
}
