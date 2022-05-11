// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import { Button, Menu, MenuItem, TextField, styled as muiStyled } from "@mui/material";
import { useCallback, useState } from "react";

import { Config } from "../types";

const StyledButton = muiStyled(Button)(({ theme }) => ({
  backgroundColor: "transparent",
  padding: theme.spacing(0.125, 0.25, 0.125, 0.75),
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

export function ZoomMenu({
  zoom,
  setPanZoom,
}: {
  zoom: number;
  setPanZoom: (panZoom: Pick<Config, "zoom" | "pan" | "mode">) => void;
}): JSX.Element {
  const [editing, setEditing] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);

  const zoomPercentage = `${Math.round(100 * zoom)}%`;
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(undefined);
  };

  const setTextPercentage = useCallback(
    (textPercentage: string) => {
      const newPercent = Number(textPercentage) / 100;
      setPanZoom({ zoom: newPercent });
    },
    [setPanZoom],
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
          disablePadding: true,
        }}
      >
        <MenuItem divider>
          <div style={{ marginLeft: -8, marginRight: -8 }}>
            {editing ? (
              <TextField
                // onChange={(event) => setTextPercentage(event.target.value)}
                onBlur={(event) => {
                  setTextPercentage(event.target.value);
                  setEditing(false);
                }}
                value={zoom * 100}
                type="number"
                size="small"
              />
            ) : (
              <TextField
                onFocus={() => setEditing(true)}
                value={zoomPercentage}
                type="text"
                size="small"
              />
            )}
          </div>
        </MenuItem>
        <MenuItem onClick={() => setPanZoom({ zoom: zoom * 1.1 })}>Zoom in</MenuItem>
        <MenuItem divider onClick={() => setPanZoom({ zoom: zoom * 0.9 })}>
          Zoom out
        </MenuItem>
        <MenuItem onClick={() => setPanZoom({ zoom: 1, pan: { x: 0, y: 0 } })}>
          Zoom to 100%
        </MenuItem>
        <MenuItem onClick={() => setPanZoom({ zoom: 1, mode: "fit", pan: { x: 0, y: 0 } })}>
          Zoom to fit
        </MenuItem>
        <MenuItem
          divider
          onClick={() => setPanZoom({ zoom: 1, mode: "fill", pan: { x: 0, y: 0 } })}
        >
          Zoom to fill
        </MenuItem>
      </Menu>
    </>
  );
}
