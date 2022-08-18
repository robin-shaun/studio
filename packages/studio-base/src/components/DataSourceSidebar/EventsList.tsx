// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import MoreVertIcon from "@mui/icons-material/MoreVert";
import SearchIcon from "@mui/icons-material/Search";
import { alpha, AppBar, IconButton, TextField, Typography } from "@mui/material";
import { compact } from "lodash";
import { Fragment } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

type MockEvent = {
  id: string;
  timestampNanos: string;
  durationNanos?: string;
  deviceId: string;
  metadata?: { [key: string]: string };
  createdAt: string;
  updatedAt: string;
};

// prettier-ignore
const MOCK_EVENT_DATA: MockEvent[] = [
  { id: "evt_PbkdOL8geyyXLIOr", timestampNanos: "1532402927000000000", durationNanos: "0", deviceId: "dev_JtSXCGiM0RC2YHDO", metadata: { position: "start" }, createdAt: "2022-02-24T15:22:25.154Z", updatedAt: "2022-02-24T15:22:25.154Z", },
  { id: "evt_U0TCTtRbDb631tmI", timestampNanos: "1532402927000000000", durationNanos: "2000000000", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { nuscene: "0061", startup: "yes", }, createdAt: "2022-02-09T21:11:52.637Z", updatedAt: "2022-02-09T21:11:52.637Z", },
  { id: "evt_9akLLRJRqp8jg1zq", timestampNanos: "1532402927000000000", durationNanos: "19000000000", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { nuscene: "0061", location: "singapore", "weather-laguna": "really-nice", }, createdAt: "2022-02-09T21:08:46.936Z", updatedAt: "2022-02-09T21:08:46.936Z", },
  { id: "evt_0A1LUzWBKkLeDoIa", timestampNanos: "1532402937000000000", durationNanos: "0", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { random: "yes", nuscene: "0061", }, createdAt: "2022-02-09T21:19:18.488Z", updatedAt: "2022-02-09T21:19:18.488Z", },
  { id: "evt_Nx6Nx9WoEMPhDeRb", timestampNanos: "1532402937000000000", durationNanos: "0", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { location: "🇸🇬", }, createdAt: "2022-02-09T22:08:51.249Z", updatedAt: "2022-02-09T22:08:51.249Z", },
  { id: "evt_zZ8s6al5F3CUYVtJ", timestampNanos: "1532402937000000000", durationNanos: "0", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { weather: "🌧", }, createdAt: "2022-02-09T22:09:49.412Z", updatedAt: "2022-02-09T22:09:49.412Z", },
  { id: "evt_zEVu8NABeHZdABML", timestampNanos: "1644443695000000000", durationNanos: "0", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: {}, createdAt: "2022-02-09T21:57:29.064Z", updatedAt: "2022-02-09T21:57:29.064Z", },
  { id: "evt_QJtL4x6701tFhKia", timestampNanos: "1645047149000000000", durationNanos: "0", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { happy: "valley", }, createdAt: "2022-02-16T21:35:07.352Z", updatedAt: "2022-02-16T21:35:07.352Z", },
  { id: "evt_kRIWfP2GgjCbLejp", timestampNanos: "1645483936331000000", durationNanos: "17000000000", deviceId: "dev_Wm1gvryKJmREqnVT", metadata: { calibration: "camera", }, createdAt: "2022-02-21T23:19:10.521Z", updatedAt: "2022-02-21T23:19:10.521Z", },
  { id: "evt_J69qtmDyKtWmYZTb", timestampNanos: "1645554501000000000", durationNanos: "0", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { user: "adrian", color: "green", }, createdAt: "2022-02-23T18:28:50.228Z", updatedAt: "2022-02-23T18:28:50.228Z", },
  { id: "evt_N6doUtPYh8i7iZxf", timestampNanos: "1646147056000000000", durationNanos: "23000000000", deviceId: "dev_jCuXYeFwCkZowpHs", metadata: { a: "13", }, createdAt: "2022-03-04T15:04:31.546Z", updatedAt: "2022-03-04T15:04:31.546Z", },
  { id: "evt_idMGJImlICYP4dcy", timestampNanos: "1646248453000000000", durationNanos: "60", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { "requires-labeling": "true", }, createdAt: "2022-03-02T19:14:39.117Z", updatedAt: "2022-03-02T19:14:39.117Z", },
  { id: "evt_4GDnX3SOt0os7EZ1", timestampNanos: "1650474791000000000", durationNanos: "0", deviceId: "dev_mHH1Cp4gPybCPR8y", metadata: { status: "failed", "custom-id": "1234", }, createdAt: "2022-04-21T17:13:51.272Z", updatedAt: "2022-04-21T17:13:51.272Z", },
  { id: "evt_YKMWY8qlYjLECaIv", timestampNanos: "1657004400000000000", durationNanos: "0", deviceId: "dev_JtSXCGiM0RC2YHDO", metadata: { "actor-cut-in": "0.82", }, createdAt: "2022-07-06T18:31:57.906Z", updatedAt: "2022-07-06T18:31:57.906Z", },
];

const useStyles = makeStyles<void, "eventMetadata" | "eventHeader">()(
  (theme, _params, classes) => ({
    appBar: {
      top: -1,
      zIndex: theme.zIndex.appBar - 1,
      borderBottom: `1px solid ${theme.palette.divider}`,
      display: "flex",
      flexDirection: "row",
      padding: theme.spacing(1),
      gap: theme.spacing(1),
      alignItems: "center",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "auto 1fr",
    },
    spacer: {
      gridColumn: "span 2",
      borderTop: `1px solid ${theme.palette.divider}`,
    },
    event: {
      display: "contents",
      cursor: "pointer",
      border: "1px solid #ccc",

      "&:hover": {
        [`.${classes.eventMetadata}`]: {
          backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        },
      },
    },
    span2: {
      gridColumn: "span 2",
    },
    eventHeader: {
      fontWeight: 800,
      padding: theme.spacing(0.5),
      borderTopRightRadius: theme.shape.borderRadius,
      borderTopLeftRadius: theme.shape.borderRadius,

      "&:last-of-type": {
        borderBottomRightRadius: theme.shape.borderRadius,
        borderBottomLeftRadius: theme.shape.borderRadius,
      },
    },
    eventMetadata: {
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.default,
      borderTop: `1px solid ${theme.palette.divider}`,

      "&:nth-of-type(even)": {
        borderRight: `1px solid ${theme.palette.divider}`,
      },
      "&:nth-last-of-type(2), &:last-of-type": {
        borderBottomRightRadius: theme.shape.borderRadius,
        borderBottomLeftRadius: theme.shape.borderRadius,
      },
    },
  }),
);

export default function EventsList(): JSX.Element {
  const events = MOCK_EVENT_DATA;

  const { classes, cx } = useStyles();

  if (events.length === 0) {
    return (
      <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
        <Typography align="center" color="text.secondary">
          No Events
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack>
      <AppBar className={classes.appBar} position="sticky" color="inherit" elevation={0}>
        <TextField
          variant="filled"
          fullWidth
          placeholder="Filter event metadata"
          InputProps={{
            startAdornment: <SearchIcon fontSize="small" />,
          }}
        />
      </AppBar>
      <div className={classes.grid}>
        {events.map((event, idx) => {
          return (
            <Fragment key={event.id}>
              {idx !== 0 && <div className={classes.spacer} />}
              <div className={classes.event}>
                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  alignItems="center"
                  className={cx(classes.eventHeader, classes.span2)}
                >
                  <IconButton size="small">
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Stack>
                {event.metadata != undefined &&
                  compact([
                    ["timestamp", event.timestampNanos],
                    Number(event.durationNanos) > 0 && ["duration", `${event.durationNanos}ns`],
                    ...Object.entries(event.metadata),
                  ]).map(([key, value]) => (
                    <>
                      <div className={classes.eventMetadata}>{key}</div>
                      <div className={classes.eventMetadata}>{value}</div>
                    </>
                  ))}
              </div>
            </Fragment>
          );
        })}
      </div>
    </Stack>
  );
}
