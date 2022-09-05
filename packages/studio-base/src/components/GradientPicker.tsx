// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { useCallback } from "react";
import { makeStyles } from "tss-react/mui";

import { Color } from "@foxglove/regl-worldview";
import AutoSizingCanvas from "@foxglove/studio-base/components/AutoSizingCanvas";
import ColorPicker from "@foxglove/studio-base/components/ColorPicker";
import { defaultedRGBStringFromColorObj } from "@foxglove/studio-base/util/colorUtils";

const GRADIENT_LINE_HEIGHT = 6;
const GRADIENT_LINE_WIDTH = 1;
const GRADIENT_COLOR_PICKER_SIZE = 25;
const GRADIENT_BAR_INSET = (GRADIENT_COLOR_PICKER_SIZE - GRADIENT_LINE_WIDTH) / 2;
const GRADIENT_BAR_HEIGHT = 10;

const useStyles = makeStyles()((theme) => ({
  pickerWrapper: {
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barWrapper: {
    flex: "1 1 auto",
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    marginLeft: GRADIENT_BAR_INSET,
    marginRight: GRADIENT_BAR_INSET,
  },
  line: {
    flex: "0 0 auto",
    width: GRADIENT_LINE_WIDTH,
    height: GRADIENT_BAR_HEIGHT + GRADIENT_LINE_HEIGHT,
    backgroundColor: theme.palette.text.primary,
  },
  bar: {
    flex: "1 1 auto",
    height: GRADIENT_BAR_HEIGHT,
  },
}));

export default function GradientPicker({
  minColor,
  maxColor,
  onChange,
}: {
  minColor: Color;
  maxColor: Color;
  onChange: (arg0: { minColor: Color; maxColor: Color }) => void;
}): JSX.Element {
  const { classes } = useStyles();
  const rgbMinColor = defaultedRGBStringFromColorObj(minColor);
  const rgbMaxColor = defaultedRGBStringFromColorObj(maxColor);

  const drawGradient = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, rgbMinColor);
      gradient.addColorStop(1, rgbMaxColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    },
    [rgbMaxColor, rgbMinColor],
  );

  return (
    <>
      <div className={classes.pickerWrapper}>
        <ColorPicker
          buttonShape="circle"
          circleSize={GRADIENT_COLOR_PICKER_SIZE}
          color={minColor}
          onChange={(newColor) => onChange({ minColor: newColor, maxColor })}
        />
        <ColorPicker
          buttonShape="circle"
          circleSize={GRADIENT_COLOR_PICKER_SIZE}
          color={maxColor}
          onChange={(newColor) => onChange({ minColor, maxColor: newColor })}
        />
      </div>
      <div className={classes.barWrapper}>
        <div className={classes.line} />
        <div className={classes.bar}>
          <AutoSizingCanvas draw={drawGradient} />
        </div>
        <div className={classes.line} />
      </div>
    </>
  );
}
