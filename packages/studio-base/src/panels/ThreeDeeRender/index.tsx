// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StrictMode } from "react";
import ReactDOM from "react-dom";

import { PanelExtensionContext } from "@foxglove/studio";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelExtensionAdapter from "@foxglove/studio-base/components/PanelExtensionAdapter";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { ThreeDeeRender } from "./ThreeDeeRender";
import helpContent from "./index.help.md";

function initPanel(context: PanelExtensionContext) {
  ReactDOM.render(
    <StrictMode>
      <ThemeProvider isDark>
        <ThreeDeeRender context={context} />
      </ThemeProvider>
    </StrictMode>,
    context.panelElement,
  );
}

type Props = {
  config: unknown;
  saveConfig: SaveConfig<unknown>;
};

function ThreeDeeRenderAdapter(props: Props) {
  return (
    <PanelExtensionAdapter
      config={props.config}
      saveConfig={props.saveConfig}
      help={helpContent}
      initPanel={initPanel}
    />
  );
}

ThreeDeeRenderAdapter.panelType = "3D";
ThreeDeeRenderAdapter.defaultConfig = {
  followTf: "",
  scene: {},
  cameraState: {
    distance: 35.496424999999995,
    frustum: 30,
    perspective: true,
    phi: 1,
    targetOffset: [4.841595286528824, 3.382084839013197, 0],
    thetaOffset: 0.986275733000624,
    fovy: 0.75,
    near: 0.01,
    far: 5000,
    target: [0, 0, 0],
    targetOrientation: [0, 0, 0, 1],
  },
  topics: {},
};

export default Panel(ThreeDeeRenderAdapter);
