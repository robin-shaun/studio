// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import SearchIcon from "@mui/icons-material/Search";
import {
  Card,
  IconButton,
  Menu,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Divider,
} from "@mui/material";
import { MouseEvent, useCallback, useRef, useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { usePanelMousePresence } from "@foxglove/studio-base/hooks/usePanelMousePresence";

const useStyles = makeStyles()((theme) => ({
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    zIndex: theme.zIndex.tooltip,
    margin: theme.spacing(0.75),

    ".hoverScreenshot &": { visibility: "visible" },
  },
  toggleButton: {
    flex: "auto",
    lineHeight: 1,
  },
  toggleButtonGroup: {
    width: "100%",
  },
}));

export default function ZoomMenu({
  zoom,
  setZoom,
  setZoomMode,
  resetPanZoom,
  open = false,
  ...props
}: {
  zoom: number;
  setZoom: (zoom: number) => void;
  setZoomMode: (zoomMode: "fit" | "fill" | "other") => void;
  resetPanZoom: () => void;
  open?: boolean;
}): JSX.Element {
  const { classes } = useStyles();
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const ref = useRef<HTMLDivElement>(ReactNull);
  const mousePresent = usePanelMousePresence(ref);
  const menuOpen = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  const zoomIn = useCallback(() => {
    setZoom(zoom + 1 * 0.5);
  }, [setZoom, zoom]);

  const zoomOut = useCallback(() => {
    setZoom(zoom - 1 * 0.5);
  }, [setZoom, zoom]);

  const onZoomFit = useCallback(() => {
    setZoomMode("fit");
    resetPanZoom();
    handleClose();
  }, [resetPanZoom, setZoomMode]);

  const onZoomFill = useCallback(() => {
    setZoomMode("fill");
    resetPanZoom();
    handleClose();
  }, [resetPanZoom, setZoomMode]);

  const onZoom100 = useCallback(() => {
    setZoomMode("other");
    resetPanZoom();
    handleClose();
  }, [resetPanZoom, setZoomMode]);

  return (
    <>
      <Card
        className={classes.card}
        variant="elevation"
        ref={ref}
        style={{
          visibility: mousePresent || menuOpen || open ? "visible" : "hidden",
        }}
        {...props}
      >
        <IconButton
          id="zoom-button"
          aria-controls={menuOpen ? "zoom-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={menuOpen ? "true" : undefined}
          onClick={handleClick}
        >
          <SearchIcon fontSize="small" />
        </IconButton>
      </Card>
      <Menu
        id="zoom-menu"
        anchorEl={anchorEl}
        open={menuOpen || open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "zoom-button",
          dense: true,
          disablePadding: true,
        }}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
      >
        <Stack padding={2} gap={1}>
          <Typography variant="body2" color="text.secondary">
            Scroll or use the <br />
            buttons below to zoom
          </Typography>
          <ToggleButtonGroup
            className={classes.toggleButtonGroup}
            size="small"
            style={{ width: "100%" }}
          >
            <ToggleButton value="zoom-out" onClick={zoomOut}>
              <RemoveIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton className={classes.toggleButton} disabled value="zoom-value">
              {`${Math.round(zoom * 100)}%`}
            </ToggleButton>
            <ToggleButton value="zoom-in" onClick={zoomIn}>
              <AddIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Divider />
        <MenuItem divider onClick={onZoom100} data-testid="hundred-zoom">
          Zoom to 100%
        </MenuItem>
        <MenuItem divider onClick={onZoomFit} data-testid="fit-zoom">
          Zoom to fit
        </MenuItem>
        <MenuItem onClick={onZoomFill} data-testid="fill-zoom">
          Zoom to fill
        </MenuItem>
      </Menu>
    </>
  );
}
