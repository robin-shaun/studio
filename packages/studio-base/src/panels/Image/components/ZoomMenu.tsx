// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Button, Menu, MenuItem, TextField, styled as muiStyled, Divider } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import { Config } from "../types";

const StyledButton = muiStyled(Button)(({ theme }) => ({
  backgroundColor: "transparent",
  padding: theme.spacing(0, 0.25, 0, 0.5),
  minWidth: "auto",

  ".MuiButton-endIcon": {
    marginLeft: 0,
  },
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
  "&:focus, &[aria-expanded='true']": {
    backgroundColor: theme.palette.action.focus,
  },
}));

const StyledMenuItem = muiStyled(MenuItem)(({ theme }) => ({
  padding: theme.spacing(1),
  margin: theme.spacing(-1, 0),

  "&:hover, &:focus-within": {
    backgroundColor: "transparent",
  },
}));

export function ZoomMenu({
  zoom,
  setPanZoom,
}: {
  zoom: number;
  setPanZoom: (panZoom: Pick<Config, "zoom" | "pan" | "mode">) => void;
}): JSX.Element {
  const zoomPercentage = `${Math.round(100 * zoom)}%`;

  const [localZoom, setLocalZoom] = useState(zoomPercentage);
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);

  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  useEffect(() => {
    setLocalZoom(zoomPercentage);
  }, [zoomPercentage]);

  const onLocalZoomKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        setPanZoom({ zoom: parseFloat(localZoom) / 100 });
      }
    },
    [localZoom, setPanZoom],
  );

  return (
    <>
      <StyledButton
        disableRipple
        size="small"
        color="inherit"
        id="zoom-button"
        variant="text"
        aria-controls={open ? "basic-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        endIcon={<ArrowDropDownIcon />}
      >
        {zoomPercentage}
      </StyledButton>
      <Menu
        id="zoom-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "zoom-button",
        }}
      >
        <StyledMenuItem>
          <TextField
            autoFocus={open}
            onKeyDown={onLocalZoomKeyDown}
            onChange={(event) => setLocalZoom(event.target.value)}
            value={localZoom}
            size="small"
          />
        </StyledMenuItem>
        <Divider />
        <MenuItem onClick={() => setPanZoom({ zoom: zoom * 1.1 })}>Zoom in</MenuItem>
        <MenuItem onClick={() => setPanZoom({ zoom: zoom * 0.9 })}>Zoom out</MenuItem>
        <Divider />
        <MenuItem onClick={() => setPanZoom({ zoom: 1, pan: { x: 0, y: 0 } })}>
          Zoom to 100%
        </MenuItem>
        <MenuItem onClick={() => setPanZoom({ zoom: 1, mode: "fit", pan: { x: 0, y: 0 } })}>
          Zoom to fit
        </MenuItem>
        <MenuItem onClick={() => setPanZoom({ zoom: 1, mode: "fill", pan: { x: 0, y: 0 } })}>
          Zoom to fill
        </MenuItem>
      </Menu>
    </>
  );
}
