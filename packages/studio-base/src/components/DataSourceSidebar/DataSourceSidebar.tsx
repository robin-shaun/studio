// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import { IconButton, Tab, Tabs, Divider, CircularProgress } from "@mui/material";
import { useState, PropsWithChildren, useEffect, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import { EventsList } from "@foxglove/studio-base/components/DataSourceSidebar/EventsList";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { SidebarContent } from "@foxglove/studio-base/components/SidebarContent";
import Stack from "@foxglove/studio-base/components/Stack";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { EventsStore, useEvents } from "@foxglove/studio-base/context/EventsContext";
import { PlayerPresence } from "@foxglove/studio-base/players/types";

import { DataSourceInfoView } from "../DataSourceInfoView";
import { ProblemsList } from "./ProblemsList";
import { TopicList } from "./TopicList";
import helpContent from "./help.md";

type Props = {
  onSelectDataSourceAction: () => void;
};

const useStyles = makeStyles()((theme) => ({
  tab: {
    minHeight: "auto",
    minWidth: theme.spacing(8),
    padding: theme.spacing(1.5, 2),
    color: theme.palette.text.secondary,

    "&.Mui-selected": {
      color: theme.palette.text.primary,
    },
  },
  tabs: {
    minHeight: "auto",

    ".MuiTabs-indicator": {
      transform: "scaleX(0.5)",
      height: 2,
    },
  },
  problemCount: {
    backgroundColor: theme.palette.error.main,
    fontSize: theme.typography.caption.fontSize,
    color: theme.palette.error.contrastText,
    padding: theme.spacing(0.125, 0.75),
    borderRadius: 8,
  },
}));

const TabPanel = (
  props: PropsWithChildren<{
    index: number;
    value: number;
  }>,
): JSX.Element => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      style={{ flex: "auto" }}
      {...other}
    >
      {value === index && <>{children}</>}
    </div>
  );
};

const selectPlayerPresence = ({ playerState }: MessagePipelineContext) => playerState.presence;
const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;
const selectPlayerSourceId = ({ playerState }: MessagePipelineContext) =>
  playerState.urlState?.sourceId;
const selectSelectedEventId = (store: EventsStore) => store.selectedEventId;

export default function DataSourceSidebar(props: Props): JSX.Element {
  const { classes } = useStyles();
  const { onSelectDataSourceAction } = props;
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? [];
  const { currentUser } = useCurrentUser();
  const playerSourceId = useMessagePipeline(selectPlayerSourceId);
  const selectedEventId = useEvents(selectSelectedEventId);
  const [activeTab, setActiveTab] = useState(0);

  const showEventsTab = currentUser != undefined && playerSourceId === "foxglove-data-platform";

  const isLoading = useMemo(
    () =>
      playerPresence === PlayerPresence.INITIALIZING ||
      playerPresence === PlayerPresence.RECONNECTING,
    [playerPresence],
  );

  useEffect(() => {
    if (playerPresence === PlayerPresence.ERROR || playerPresence === PlayerPresence.RECONNECTING) {
      setActiveTab(2);
    } else if (showEventsTab && selectedEventId != undefined) {
      setActiveTab(1);
    }
  }, [playerPresence, showEventsTab, selectedEventId]);

  return (
    <SidebarContent
      overflow="auto"
      title="Data source"
      helpContent={helpContent}
      disablePadding
      trailingItems={[
        isLoading && (
          <Stack key="loading" alignItems="center" justifyContent="center" padding={1}>
            <CircularProgress size={18} variant="indeterminate" />
          </Stack>
        ),
        <IconButton
          key="add-connection"
          color="primary"
          title="New connection"
          onClick={onSelectDataSourceAction}
        >
          <AddIcon />
        </IconButton>,
      ].filter(Boolean)}
    >
      <Stack fullHeight>
        <DataSourceInfoView />
        {playerPresence !== PlayerPresence.NOT_PRESENT && (
          <>
            <Divider />
            <Stack flex={1}>
              <Tabs
                className={classes.tabs}
                value={activeTab}
                onChange={(_ev, newValue: number) => setActiveTab(newValue)}
                textColor="inherit"
              >
                <Tab className={classes.tab} disableRipple label="Topics" value={0} />
                {showEventsTab && (
                  <Tab className={classes.tab} disableRipple label="Events" value={1} />
                )}
                <Tab
                  className={classes.tab}
                  disableRipple
                  label={
                    <Stack direction="row" alignItems="baseline" gap={1}>
                      Problems
                      {playerProblems.length > 0 && (
                        <div className={classes.problemCount}>{playerProblems.length}</div>
                      )}
                    </Stack>
                  }
                  value={2}
                />
              </Tabs>
              <Divider />
              <TabPanel value={activeTab} index={0}>
                <TopicList />
              </TabPanel>
              <TabPanel value={activeTab} index={1}>
                <EventsList />
              </TabPanel>
              <TabPanel value={activeTab} index={2}>
                <ProblemsList problems={playerProblems} />
              </TabPanel>
            </Stack>
          </>
        )}
      </Stack>
    </SidebarContent>
  );
}
