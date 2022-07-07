// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, Tooltip, Typography } from "@mui/material";

import Stack from "@foxglove/studio-base/components/Stack";

export default function SettingsChangeCallout(props: {
  disabled?: boolean;
  children: JSX.Element;
  dismiss: () => void;
}): JSX.Element {
  const { children, disabled = false, dismiss } = props;

  if (disabled) {
    return children;
  }

  return (
    <Tooltip
      arrow
      open
      title={
        <div>
          <Stack padding={0.5} gap={0.5}>
            <Typography variant="body2" color="info.main" fontWeight={600}>
              We’re making some changes to Panel Settings
            </Typography>
            <Typography variant="body2">
              More panel settings are now available in the settings sidebar. Click the cog icon to
              open the settings sidebar.
            </Typography>
            <Stack direction="row" justifyContent="flex-end" paddingBottom={0.5}>
              <Button onClick={dismiss} size="small" color="info">
                Dismiss
              </Button>
            </Stack>
          </Stack>
        </div>
      }
    >
      <div>{children}</div>
    </Tooltip>
  );
}
