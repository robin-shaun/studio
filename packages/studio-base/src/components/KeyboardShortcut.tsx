// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles()((theme) => ({
  key: {
    padding: theme.spacing(0, 0.5),
    lineHeight: 1.5,
    fontFamily: fonts.SANS_SERIF,
    textAlign: "center",
    border: "1px solid currentColor",
    borderRadius: theme.shape.borderRadius,
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    minWidth: 20,

    "&:not(:last-child)": {
      borderRight: "1px solid currentColor",
    },
  },
  keys: {
    color: theme.palette.text.disabled,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "none",
    gap: theme.spacing(0.5),
    flexWrap: "wrap",
  },
  root: {
    margin: theme.spacing(1, 0),
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(1),
  },
}));

type Props = {
  keys: string[];
  description?: string;
};

export default function KeyboardShortcut({ keys, description }: Props): JSX.Element {
  const { classes } = useStyles();
  return (
    <div className={classes.root}>
      {description != undefined && description}
      <div className={classes.keys}>
        {keys.map((key) => (
          <kbd key={key} className={classes.key}>
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}
