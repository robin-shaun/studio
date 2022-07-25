// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import { IconButton, InputBase, styled as muiStyled, Typography } from "@mui/material";
import { useContext, useState, useMemo, CSSProperties, useCallback } from "react";

import PanelContext from "@foxglove/studio-base/components/PanelContext";
import ToolbarIconButton from "@foxglove/studio-base/components/PanelToolbar/ToolbarIconButton";
import Stack from "@foxglove/studio-base/components/Stack";

import { PanelToolbarControls } from "./PanelToolbarControls";

export const PANEL_TOOLBAR_MIN_HEIGHT = 30;

type Props = {
  additionalIcons?: React.ReactNode;
  backgroundColor?: CSSProperties["backgroundColor"];
  children?: React.ReactNode;
  // Keeping this prop for now in case we decide to expose it via some other mechanism
  // like a context menu item.
  // eslint-disable-next-line react/no-unused-prop-types
  helpContent?: React.ReactNode;
  isUnknownPanel?: boolean;
};

const PanelToolbarRoot = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "backgroundColor" && prop !== "enableDrag",
})<{ backgroundColor?: CSSProperties["backgroundColor"]; enableDrag: boolean }>(
  ({ theme, backgroundColor, enableDrag }) => ({
    transition: "transform 80ms ease-in-out, opacity 80ms ease-in-out",
    cursor: enableDrag ? "grab" : "auto",
    flex: "0 0 auto",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: theme.spacing(0.25, 0.75),
    display: "flex",
    minHeight: PANEL_TOOLBAR_MIN_HEIGHT,
    backgroundColor: backgroundColor ?? theme.palette.background.paper,
    width: "100%",
    left: 0,
    zIndex: theme.zIndex.appBar,
  }),
);

// Panel toolbar should be added to any panel that's part of the
// react-mosaic layout.  It adds a drag handle, remove/replace controls
// and has a place to add custom controls via it's children property
export default React.memo<Props>(function PanelToolbar({
  additionalIcons,
  backgroundColor,
  children,
  isUnknownPanel = false,
}: Props) {
  const { isFullscreen, exitFullscreen } = useContext(PanelContext) ?? {};
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const panelContext = useContext(PanelContext);

  // Help-shown state must be hoisted outside the controls container so the modal can remain visible
  // when the panel is no longer hovered.
  const additionalIconsWithHelp = useMemo(() => {
    return (
      <>
        <ToolbarIconButton
          title="Edit title"
          data-node-function="edit-label"
          // color="primary"
          onClick={(event) => {
            event.stopPropagation();
            setIsEditing((editing) => !editing);
          }}
        >
          {isEditing ? <CheckIcon fontSize="small" /> : <EditIcon fontSize="small" />}
        </ToolbarIconButton>
        {additionalIcons}
        {isFullscreen === true && (
          <ToolbarIconButton
            value="exit-fullscreen"
            title="Exit fullscreen"
            onClick={exitFullscreen}
          >
            <FullscreenExitIcon />
          </ToolbarIconButton>
        )}
      </>
    );
  }, [isEditing, additionalIcons, isFullscreen, exitFullscreen]);

  const updateTitle = useCallback(
    (value: string) => {
      panelContext?.saveConfig({ title: value });
    },
    [panelContext],
  );

  const onTitleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "Escape") {
      setIsEditing(false);
    }
  }, []);

  const title = String(panelContext?.config.title ?? panelContext?.title);

  return (
    <PanelToolbarRoot
      backgroundColor={backgroundColor}
      data-test="mosaic-drag-handle"
      enableDrag={panelContext?.connectToolbarDragHandle != undefined}
      ref={isUnknownPanel ? undefined : panelContext?.connectToolbarDragHandle}
    >
      {children ?? (
        <Stack alignItems="center" direction="row" flex="1">
          {panelContext != undefined && isEditing ? (
            <InputBase
              autoFocus
              fullWidth
              onChange={(event) => updateTitle(event.currentTarget.value)}
              value={title}
              onKeyDown={onTitleKeyDown}
              onFocus={(event) => event.target.select()}
              style={{ font: "inherit" }}
            />
          ) : (
            <Typography noWrap={true} flex="auto" variant="subtitle2" color="text.primary">
              {title}
            </Typography>
          )}
        </Stack>
      )}
      <PanelToolbarControls
        additionalIcons={additionalIconsWithHelp}
        isUnknownPanel={!!isUnknownPanel}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
    </PanelToolbarRoot>
  );
});
