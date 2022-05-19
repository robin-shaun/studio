// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CursorIcon from "@mdi/svg/svg/cursor-default.svg";
import { Typography, styled as muiStyled } from "@mui/material";
import { ReactElement, useEffect, useRef, useState } from "react";
import Tree from "react-json-tree";

import ExpandingToolbar, {
  ToolGroup,
  ToolGroupFixedSizePane,
} from "@foxglove/studio-base/components/ExpandingToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import { usePanelMousePresence } from "@foxglove/studio-base/hooks/usePanelMousePresence";
import { useJsonTreeTheme } from "@foxglove/studio-base/util/globalConstants";

import { PixelData } from "../types";

const Root = muiStyled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  position: "absolute",
  top: 0,
  right: 0,
  marginRight: theme.spacing(1),
  marginTop: theme.spacing(1),
  zIndex: theme.zIndex.drawer,
}));

enum TabName {
  SELECTED_POINT = "Selected Point",
}

function ObjectPane({ pixelData }: { pixelData: PixelData | undefined }): ReactElement {
  const jsonTreeTheme = useJsonTreeTheme();

  return (
    <Stack gap={1}>
      <div>
        <Typography variant="caption">Position:</Typography>
        <Typography color="info.main">
          <Stack direction="row" gap={1}>
            <div>X:{pixelData?.position.x}</div>
            <div>Y:{pixelData?.position.y}</div>
          </Stack>
        </Typography>
      </div>
      <div>
        <Typography variant="caption">Color:</Typography>
        <Typography color="info.main">
          <Stack direction="row" gap={1}>
            <div>R:{pixelData?.color.r}</div>
            <div>G:{pixelData?.color.g}</div>
            <div>B:{pixelData?.color.b}</div>
            <div>A:{pixelData?.color.a}</div>
          </Stack>
        </Typography>
      </div>
      {pixelData?.marker && (
        <div>
          <Typography variant="caption">Marker:</Typography>
          <Tree
            data={pixelData.marker}
            hideRoot
            invertTheme={false}
            theme={{ ...jsonTreeTheme, tree: { margin: 0 } }}
          />
        </div>
      )}
    </Stack>
  );
}

export function Toolbar({ pixelData }: { pixelData: PixelData | undefined }): JSX.Element {
  const ref = useRef<HTMLDivElement>(ReactNull);
  const [selectedTab, setSelectedTab] = useState<TabName | undefined>();

  useEffect(() => {
    if (pixelData) {
      setSelectedTab(TabName.SELECTED_POINT);
    }
  }, [pixelData]);

  const mousePresent = usePanelMousePresence(ref);

  return (
    <Root ref={ref} style={{ visibility: mousePresent ? "visible" : "hidden" }}>
      <ExpandingToolbar
        tooltip="Inspect objects"
        icon={<CursorIcon />}
        selectedTab={selectedTab}
        onSelectTab={setSelectedTab}
      >
        <ToolGroup name={TabName.SELECTED_POINT}>
          <ToolGroupFixedSizePane>
            {pixelData ? (
              <ObjectPane pixelData={pixelData} />
            ) : (
              <Typography color="secondary.main">Click an object to select it.</Typography>
            )}
          </ToolGroupFixedSizePane>
        </ToolGroup>
      </ExpandingToolbar>
    </Root>
  );
}
