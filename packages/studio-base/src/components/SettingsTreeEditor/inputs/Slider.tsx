// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import SliderUnstyled, { sliderUnstyledClasses } from "@mui/base/SliderUnstyled";
import { alpha, SliderProps, styled as muiStyled } from "@mui/material";
import { useCallback } from "react";

const thumbSize = 18;
const height = 10;
const borderRadius = height / 2;

const StyledSlider = muiStyled(SliderUnstyled)(({ theme }) => ({
  color: theme.palette.primary.main,
  height,
  width: "100%",
  padding: theme.spacing(2, 0),
  display: "inline-flex",
  alignItems: "center",
  position: "relative",
  cursor: "pointer",
  touchAction: "none",
  WebkitTapHighlightColor: "transparent",
  opacity: 0.75,

  "&:hover": {
    opacity: 1,
  },
  [`&.${sliderUnstyledClasses.disabled}`]: {
    pointerEvents: "none",
    cursor: "default",
    color: theme.palette.action.disabled,
  },
  [`& .${sliderUnstyledClasses.rail}`]: {
    display: "block",
    position: "absolute",
    width: "100%",
    height,
    borderRadius,
    backgroundColor: theme.palette.text.disabled,
    opacity: 0.38,
  },
  [`& .${sliderUnstyledClasses.track}`]: {
    display: "block",
    position: "absolute",
    height,
    borderRadius,
    backgroundColor: theme.palette.text.primary,
  },
  [`& .${sliderUnstyledClasses.thumb}`]: {
    position: "absolute",
    width: thumbSize,
    height: thumbSize,
    transform: "translateX(-50%)",
    boxSizing: "border-box",
    borderRadius: "50%",
    outline: 0,
    border: `2px solid ${theme.palette.text.primary}`,
    backgroundColor: theme.palette.background.paper,

    [`&:hover, &.${sliderUnstyledClasses.focusVisible}`]: {
      boxShadow: `0 0 0 0.25rem ${alpha(theme.palette.text.primary, 0.15)}`,
    },
    [`&.${sliderUnstyledClasses.active}`]: {
      boxShadow: `0 0 0 0.25rem ${alpha(theme.palette.text.primary, 0.3)}`,
    },
  },
}));

export default function Slider(props: SliderProps & { readOnly?: boolean }): JSX.Element {
  const onChangeCallback = useCallback(
    (event: Event, value: number | number[], activeThumb: number) => {
      if (props.readOnly !== true) {
        props.onChange?.(event, value, activeThumb);
      }
    },
    [props],
  );

  return <StyledSlider {...props} onChange={onChangeCallback} />;
}
