// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo, useState } from "react";
import { useToasts } from "react-toast-notifications";
import { useAsyncFn } from "react-use";

import Log from "@foxglove/log";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { useUserProfileStorage } from "@foxglove/studio-base/context/UserProfileStorageContext";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { defaultLayout } from "@foxglove/studio-base/providers/CurrentLayoutProvider/defaultLayout";
import { LayoutID } from "@foxglove/studio-base/services/ILayoutStorage";
import { parseAppURLState } from "@foxglove/studio-base/util/appURLState";

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;

const log = Log.getLogger(__filename);

/**
 * Restores our session state from any deep link we were passed on startup.
 */
export function useInitialDeepLinkState(deepLinks: readonly string[]): {
  currentUserRequired: boolean;
} {
  const { selectSource } = usePlayerSelection();
  const { setSelectedLayoutId } = useCurrentLayoutActions();
  const { addToast } = useToasts();

  const seekPlayback = useMessagePipeline(selectSeek);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const { currentUser } = useCurrentUser();
  const { getUserProfile } = useUserProfileStorage();
  const layoutManager = useLayoutManager();

  const targetUrlState = useMemo(
    () => (deepLinks[0] ? parseAppURLState(new URL(deepLinks[0])) : undefined),
    [deepLinks],
  );

  // Maybe this should be abstracted somewhere but that would require a
  // more intimate interface with this hook and the player selection logic.
  const currentUserRequired = targetUrlState?.ds === "foxglove-data-platform";

  // Tracks what portions of the URL state we have yet to apply to the current session.
  const [unappliedUrlState, setUnappliedUrlState] = useState(
    targetUrlState ? { ...targetUrlState } : undefined,
  );

  // Load data source from URL.
  useEffect(() => {
    if (!unappliedUrlState) {
      return;
    }

    // Wait for current user session if one is required for this source.
    if (currentUserRequired && !currentUser) {
      return;
    }

    // Apply any available datasource args
    if (unappliedUrlState.ds) {
      log.debug("Initialising source from url", unappliedUrlState);
      selectSource(unappliedUrlState.ds, {
        type: "connection",
        params: unappliedUrlState.dsParams,
      });
      setUnappliedUrlState((oldState) => ({ ...oldState, ds: undefined, dsParams: undefined }));
    }
  }, [currentUser, currentUserRequired, selectSource, unappliedUrlState]);

  const [trySetSelectedLayoutIdRequest, trySetSelectedLayoutId] = useAsyncFn(
    async (urlLayoutId: LayoutID) => {
      let layoutId = undefined;
      // check if layoutId from url has layout in layoutManager
      try {
        const urlLayout = await layoutManager.getLayout(urlLayoutId);
        if (urlLayout) {
          layoutId = urlLayout.id;
        }
      } catch (error) {
        console.error(error);
        addToast(`The layoutId in the url could not be loaded. ${error.toString()}`, {
          appearance: "error",
        });
      }
      // if it the layoutId from the url is invalid
      if (!layoutId) {
        try {
          // attempt to get one from the user profile that is valid
          const { currentLayoutId } = await getUserProfile();
          if (currentLayoutId) {
            const profileLayout = await layoutManager.getLayout(currentLayoutId);
            if (profileLayout) {
              layoutId = profileLayout.id;
            }
          } else {
            // if the user profile doesn't have a currentlayoutId, create a new default
            const newLayout = await layoutManager.saveNewLayout({
              name: "Default",
              data: defaultLayout,
              permission: "CREATOR_WRITE",
            });
            layoutId = newLayout.id;
          }
        } catch (error) {
          console.error(error);
          addToast(`Error loading fallback layout. ${error.toString()}`, {
            appearance: "error",
          });
        }
      }
      if (layoutId) {
        setSelectedLayoutId(layoutId);
      }
    },
    [addToast, getUserProfile, layoutManager, setSelectedLayoutId],
  );

  // Select layout from URL.
  useEffect(() => {
    if (!unappliedUrlState?.layoutId) {
      return;
    }

    // If our datasource requires a current user then wait until the player is
    // available to load the layout since we may need to sync layouts first and
    // that's only possible after the user has logged in.
    if (currentUserRequired && playerPresence !== PlayerPresence.PRESENT) {
      return;
    }
    if (!trySetSelectedLayoutIdRequest.loading && !trySetSelectedLayoutIdRequest.error) {
      log.debug(`Initializing layout from url: ${unappliedUrlState.layoutId}`);
      trySetSelectedLayoutId(unappliedUrlState.layoutId).catch((error) => {
        console.error(error);
      });
      setUnappliedUrlState((oldState) => ({ ...oldState, layoutId: undefined }));
    }
  }, [
    trySetSelectedLayoutIdRequest,
    trySetSelectedLayoutId,
    currentUserRequired,
    playerPresence,
    unappliedUrlState?.layoutId,
  ]);

  // Seek to time in URL.
  useEffect(() => {
    if (unappliedUrlState?.time == undefined || !seekPlayback) {
      return;
    }

    // Wait until player is ready before we try to seek.
    if (playerPresence !== PlayerPresence.PRESENT) {
      return;
    }

    log.debug(`Seeking to url time:`, unappliedUrlState.time);
    seekPlayback(unappliedUrlState.time);
    setUnappliedUrlState((oldState) => ({ ...oldState, time: undefined }));
  }, [playerPresence, seekPlayback, unappliedUrlState]);

  return useMemo(() => ({ currentUserRequired }), [currentUserRequired]);
}
