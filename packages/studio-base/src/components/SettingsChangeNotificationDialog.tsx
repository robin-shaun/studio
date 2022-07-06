// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  styled as muiStyled,
  useTheme,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useLocalStorage } from "react-use";

import { AppSetting } from "@foxglove/studio-base/AppSetting";
import Stack from "@foxglove/studio-base/components/Stack";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

const STORAGE_KEY = "studio.app-configuration.settings-change-update-shown";

const Root = muiStyled("div")(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  maxWidth: "30rem",
  position: "absolute",
  top: "50%",
  right: "50%",
  transform: "translate(50%, -50%)",
  zIndex: 1_000,
}));

export function SettingsChangeNotificationDialog({
  panelType,
}: {
  panelType: string;
}): ReactNull | JSX.Element {
  // We can't use useAppConfigurationValue here because we're not in the context.
  const [dialogShown, setDialogShown, _removeDialogShown] = useLocalStorage(
    [STORAGE_KEY, panelType].join("."),
    false,
  );
  const [colorScheme] = useLocalStorage(`studio.app-configuration.${AppSetting.COLOR_SCHEME}`);

  const theme = useTheme();

  const [_, setOpen] = useState(dialogShown !== true);

  const handleClose = useCallback(() => {
    setDialogShown(true);
    setOpen(false);
  }, [setDialogShown]);

  if (dialogShown === true) {
    return ReactNull;
  }

  return (
    <ThemeProvider isDark={colorScheme === colorScheme}>
      <Root>
        <Stack
          alignItems="center"
          direction="row"
          fullWidth
          style={{ backgroundColor: theme.palette.background.default }}
        >
          <DialogTitle style={{ flex: 1, color: theme.palette.text.primary }}>
            Things have changed
          </DialogTitle>
          <IconButton onClick={handleClose} color="primary">
            <CloseIcon />
          </IconButton>
        </Stack>
        <DialogContent
          style={{ backgroundColor: theme.palette.background.paper, padding: theme.spacing(2) }}
        >
          <DialogContentText>
            <div>Many panel settings are now available in the settings sidebar.</div>
            <div>
              To open the sidebar click the settings cog icon{" "}
              <SettingsIcon fontSize="small" style={{ marginBottom: -3 }} /> in the toolbar on the
              upper right: ; of thw panel.
            </div>
          </DialogContentText>
        </DialogContent>
      </Root>
    </ThemeProvider>
  );
}
