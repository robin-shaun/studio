// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IconButtonProps } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    padding: theme.spacing(0.375),
    fontSize: "0.875rem",

    ".MuiSvgIcon-root, svg:not(.MuiSvgIcon-root)": {
      height: "1em",
      width: "1em",
      fontSize: "inherit",
    },
  },
}));

type Props = {
  subMenuActive?: boolean;
  title: string; // require title for accessibility
} & Partial<IconButtonProps>;

export default function ToolbarIconButton(props: Props): JSX.Element {
  const { classes } = useStyles();
  return (
    <IconButton
      className={classes.root}
      subMenuActive={props.subMenuActive === true}
      aria-label={props.title}
      style={{
        visibility: props.subMenuActive === true ? "visible" : undefined,
      }}
      {...props}
    />
  );
}
