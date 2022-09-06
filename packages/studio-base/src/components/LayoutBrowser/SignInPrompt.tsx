// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import { CardHeader, IconButton, Link } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";

type SignInPromptProps = {
  onDismiss?: () => void;
};

const useStyles = makeStyles()((theme) => ({
  cardHeader: {
    cursor: "pointer",
    backgroundColor: theme.palette.grey[200],
    position: "sticky",
    bottom: 0,

    "&:hover": {
      backgroundColor: theme.palette.grey[300],
    },
  },
  cardHeaderAction: {
    alignSelf: "center",
  },
}));

export default function SignInPrompt(props: SignInPromptProps): JSX.Element {
  const { onDismiss } = props;
  const { classes } = useStyles();
  const { openAccountSettings } = useWorkspace();

  return (
    <CardHeader
      classes={{
        root: classes.cardHeader,
        action: classes.cardHeaderAction,
      }}
      onClick={openAccountSettings}
      title={
        <>
          <Link color="inherit" onClick={openAccountSettings} underline="always">
            Sign in
          </Link>{" "}
          to sync layouts across multiple devices, and share them with team members.
        </>
      }
      titleTypographyProps={{
        variant: "body2",
      }}
      action={
        onDismiss != undefined && (
          <IconButton
            aria-label="Dismiss"
            role="button"
            onClick={(event) => {
              event.stopPropagation();
              onDismiss();
            }}
          >
            <CloseIcon />
          </IconButton>
        )
      }
    />
  );
}
