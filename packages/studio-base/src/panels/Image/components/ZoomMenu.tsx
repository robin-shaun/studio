// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import CheckIcon from "@mui/icons-material/Check";
import { Button, Menu, MenuItem, TextField, styled as muiStyled } from "@mui/material";
import { useState } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

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

export function ZoomMenu(): JSX.Element {
  const [zoom, setZoom] = useState<number>(100);
  const [editing, setEditing] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);

  const zoomPercentage = `${zoom}%`;
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(undefined);
  };

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
                onChange={(event) => setZoom(event.target.value)}
                onBlur={(event) => {
                  setZoom(Math.round(event.target.value));
                  setEditing(false);
                }}
                value={zoom}
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
        <MenuItem onClick={handleClose}>Zoom in</MenuItem>
        <MenuItem divider onClick={handleClose}>
          Zoom out
        </MenuItem>
        <MenuItem onClick={handleClose}>Zoom to 100%</MenuItem>
        <MenuItem onClick={handleClose}>Zoom to fit</MenuItem>
        <MenuItem divider onClick={handleClose}>
          Zoom to fill
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <Stack flex="auto" direction="row" justifyContent="space-between" alignItems="center">
            Scroll to zoom
            <CheckIcon fontSize="small" />
          </Stack>
        </MenuItem>
      </Menu>
    </>
  );
}
