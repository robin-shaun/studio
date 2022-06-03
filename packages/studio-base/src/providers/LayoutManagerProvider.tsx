// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { clamp } from "lodash";
import { useCallback, useEffect, useMemo } from "react";
import { useToasts } from "react-toast-notifications";
import { useNetworkState } from "react-use";

import { useShallowMemo, useVisibilityState } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import LayoutManagerContext from "@foxglove/studio-base/context/LayoutManagerContext";
import { useLayoutStorage } from "@foxglove/studio-base/context/LayoutStorageContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useRemoteLayoutStorage } from "@foxglove/studio-base/context/RemoteLayoutStorageContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks/useAppConfigurationValue";
import useCallbackWithToast from "@foxglove/studio-base/hooks/useCallbackWithToast";
import { ISO8601Timestamp, LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import LayoutManager from "@foxglove/studio-base/services/LayoutManager/LayoutManager";
import delay from "@foxglove/studio-base/util/delay";

const log = Logger.getLogger(__filename);

const SYNC_INTERVAL_BASE_MS = 30_000;
const SYNC_INTERVAL_MAX_MS = 3 * 60_000;
const SYNC_INTERVAL_IDLE_RATIO = 10;

export default function LayoutManagerProvider({
  children,
}: React.PropsWithChildren<unknown>): JSX.Element {
  const { addToast } = useToasts();
  const layoutStorage = useLayoutStorage();
  const remoteLayoutStorage = useRemoteLayoutStorage();
  const [enableLayoutDebugging = false] = useAppConfigurationValue<boolean>(
    AppSetting.ENABLE_LAYOUT_DEBUGGING,
  );

  const layoutManager = useMemo(
    () => new LayoutManager({ local: layoutStorage, remote: remoteLayoutStorage }),
    [layoutStorage, remoteLayoutStorage],
  );

  const { online = false } = useNetworkState();
  const visibilityState = useVisibilityState();
  useEffect(() => {
    layoutManager.setOnline(online);
  }, [layoutManager, online]);

  // Sync periodically when logged in, online, and the app is not hidden
  const enableSyncing = remoteLayoutStorage != undefined && online && visibilityState === "visible";
  useEffect(() => {
    if (!enableSyncing) {
      return;
    }
    const controller = new AbortController();
    void (async () => {
      let failures = 0;
      let lastSyncDuration = 0;
      while (!controller.signal.aborted) {
        try {
          const startTime = performance.now();
          await layoutManager.syncWithRemote(controller.signal);
          lastSyncDuration = performance.now() - startTime;
          failures = 0;
        } catch (error) {
          log.error("Sync failed:", error);
          addToast((error as Error).toString(), { appearance: "error", autoDismiss: true });
          failures++;
        }
        // Exponential backoff with jitter:
        // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
        const backoffDuration = Math.random() * SYNC_INTERVAL_BASE_MS * 2 ** failures;

        // In high CPU load scenarios syncing can be slow to complete. We make sure that
        // we're not spending more than a certain fraction of run time doing syncs.
        const idleDuration = lastSyncDuration * SYNC_INTERVAL_IDLE_RATIO;

        const timeToDelay = clamp(
          Math.max(backoffDuration, idleDuration),
          SYNC_INTERVAL_BASE_MS,
          SYNC_INTERVAL_MAX_MS,
        );
        log.debug("Waiting", (timeToDelay / 1000).toFixed(2), "sec for next sync", {
          failures,
        });
        await delay(timeToDelay);
      }
    })();
    return () => {
      log.debug("Canceling layout sync due to effect cleanup callback");
      controller.abort();
    };
  }, [addToast, enableSyncing, layoutManager]);

  const syncNow = useCallbackWithToast(async () => {
    await layoutManager.syncWithRemote(new AbortController().signal);
  }, [layoutManager]);

  const injectEdit = useCallback(
    async (id: LayoutID) => {
      const layout = await remoteLayoutStorage?.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await remoteLayoutStorage?.updateLayout({
        id: layout.id,
        name: layout.name,
        data: {
          ...layout.data,
          layout: {
            direction: "row",
            first: `onboarding.welcome!${Math.round(Math.random() * 1e6).toString(36)}`,
            second: layout.data.layout ?? "unknown",
            splitPercentage: 33,
          },
        },
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      });
    },
    [remoteLayoutStorage],
  );

  const injectRename = useCallback(
    async (id: LayoutID) => {
      const layout = await remoteLayoutStorage?.getLayout(id);
      if (!layout) {
        throw new Error("This layout doesn't exist on the server");
      }
      await remoteLayoutStorage?.updateLayout({
        id,
        name: `${layout.name} renamed`,
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      });
    },
    [remoteLayoutStorage],
  );

  const injectDelete = useCallback(
    async (id: LayoutID) => {
      await remoteLayoutStorage?.deleteLayout(id);
    },
    [remoteLayoutStorage],
  );

  const setOnline = useCallback(
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    (newValue: boolean) => layoutManager.setOnline(newValue),
    [layoutManager],
  );

  const debugging = useShallowMemo({
    syncNow,
    setOnline,
    injectEdit,
    injectRename,
    injectDelete,
  });

  return (
    <LayoutStorageDebuggingContext.Provider
      value={process.env.NODE_ENV !== "production" && enableLayoutDebugging ? debugging : undefined}
    >
      <LayoutManagerContext.Provider value={layoutManager}>
        {children}
      </LayoutManagerContext.Provider>
    </LayoutStorageDebuggingContext.Provider>
  );
}
