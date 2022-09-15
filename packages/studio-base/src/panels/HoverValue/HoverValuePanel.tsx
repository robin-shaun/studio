// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RemoveIcon from "@mui/icons-material/Remove";
import { IconButton } from "@mui/material";
import { useLayoutEffect, useState } from "react";
import { makeStyles } from "tss-react/mui";

import { PanelExtensionContext } from "@foxglove/studio";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

type HoverValuePanelProps = {
  context: PanelExtensionContext;
};

const useStyles = makeStyles<void, "cell">()((theme, _params, classes) => ({
  grid: {
    height: "100%",
    overflowY: "auto",
    display: "grid",
    alignItems: "stretch",
    gridTemplateColumns:
      "auto minmax(max-content, 1fr) minmax(max-content, 1fr) minmax(max-content, 1fr)",
    gridAutoRows: 30,
    padding: theme.spacing(0.5),
    rowGap: theme.spacing(0.5),
  },
  row: {
    display: "contents",

    [`&:hover .${classes.cell}`]: {
      backgroundColor: theme.palette.action.hover,
    },
  },
  cell: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0.5),
  },
  iconButton: {
    padding: theme.spacing(0.125),
  },
}));

export default function HoverValuePanel(props: HoverValuePanelProps): JSX.Element {
  const { context } = props;
  const { classes } = useStyles();

  // setup context render handler and render done handling
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");

  useLayoutEffect(() => {
    context.watch("topics");
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };
  }, [context]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <div className={classes.grid}>
        {Array(10)
          .fill({})
          .map((i, idx) => (
            <div key={idx} className={classes.row}>
              <div className={classes.cell}>
                <IconButton
                  className={classes.iconButton}
                  centerRipple={false}
                  size="small"
                  title="Toggle visibility"
                >
                  <RemoveIcon color="inherit" />
                </IconButton>
              </div>
              <div className={classes.cell}>messagePath or plot label</div>
              <div className={classes.cell}>playhead value</div>
              <div className={classes.cell}>hovered value</div>
            </div>
          ))}
      </div>
    </ThemeProvider>
  );
}
