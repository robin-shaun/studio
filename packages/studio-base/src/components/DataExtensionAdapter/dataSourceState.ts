// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { toSec } from "@foxglove/rostime";
import {
  AppSettingValue,
  DataSourceState,
  MessageEvent,
  ParameterValue,
  Topic,
} from "@foxglove/studio";
import {
  EMPTY_GLOBAL_VARIABLES,
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PlayerState } from "@foxglove/studio-base/players/types";
import { HoverValue } from "@foxglove/studio-base/types/hoverValue";

const EmptyParameters = new Map<string, ParameterValue>();

type BuilderDataSourceStateInput = {
  watchedFields: Set<string>;
  playerState: PlayerState | undefined;
  appSettings: Map<string, AppSettingValue> | undefined;
  currentFrame: MessageEvent<unknown>[] | undefined;
  globalVariables: GlobalVariables;
  hoverValue: HoverValue | undefined;
  sortedTopics: readonly Topic[];
  subscribedTopics: string[];
};

type BuildDataSourceStateFn = (
  input: BuilderDataSourceStateInput,
) => Readonly<DataSourceState> | undefined;

/**
 * Creates a function that transforms data source state input into a new DataSourceState
 *
 * This function tracks previous input to determine what parts of the existing state to update or
 * whether there are any updates.
 *
 * @returns a function that accepts data source state input and returns a new DataSourceState or
 * undefined if there's no update.
 */
function initDataSourceStateBuilder(): BuildDataSourceStateFn {
  let prevVariables: GlobalVariables = EMPTY_GLOBAL_VARIABLES;
  let prevBlocks: unknown;
  let prevSeekTime: number | undefined;
  let prevSubscribedTopics: string[];

  const prevDataSourceState: DataSourceState = {};

  return function buildDataSourceState(input: BuilderDataSourceStateInput) {
    const {
      playerState,
      watchedFields,
      appSettings,
      currentFrame,
      globalVariables,
      hoverValue,
      subscribedTopics,
      sortedTopics,
    } = input;

    // If the player has loaded all the blocks, the blocks reference won't change so our message
    // pipeline handler for allFrames won't create a new set of all frames for the newly
    // subscribed topic. To ensure a new set of allFrames with the newly subscribed topic is
    // created, we unset the blocks ref which will force re-creating allFrames.
    if (subscribedTopics !== prevSubscribedTopics) {
      prevBlocks = undefined;
    }
    prevSubscribedTopics = subscribedTopics;

    // Indicates whether any fields of DataSourceState are updated
    let hasUpdated = false;

    const activeData = playerState?.activeData;

    // Starts with the previous state and changes are applied as detected
    const dataSourceState: DataSourceState = prevDataSourceState;

    if (watchedFields.has("didSeek")) {
      const didSeek = prevSeekTime !== activeData?.lastSeekTime;
      if (didSeek !== dataSourceState.didSeek) {
        dataSourceState.didSeek = didSeek;
        hasUpdated = true;
      }
      prevSeekTime = activeData?.lastSeekTime;
    }

    if (watchedFields.has("currentFrame")) {
      // If there are new frames we update
      // If there are old frames we update (new frames either replace old or no new frames)
      // Note: dataSourceState.currentFrame.length !== currentFrame.length is wrong because it
      // won't update when the number of messages is the same from old to new
      if (dataSourceState.currentFrame?.length !== 0 || currentFrame?.length !== 0) {
        hasUpdated = true;
        dataSourceState.currentFrame = currentFrame;
      }
    }

    if (watchedFields.has("parameters")) {
      const parameters = activeData?.parameters ?? EmptyParameters;
      if (parameters !== dataSourceState.parameters) {
        hasUpdated = true;
        dataSourceState.parameters = parameters;
      }
    }

    if (watchedFields.has("variables")) {
      if (globalVariables !== prevVariables) {
        hasUpdated = true;
        prevVariables = globalVariables;
        dataSourceState.variables = new Map(Object.entries(globalVariables));
      }
    }

    if (watchedFields.has("topics")) {
      if (sortedTopics !== prevDataSourceState.topics) {
        hasUpdated = true;
        dataSourceState.topics = sortedTopics;
      }
    }

    if (watchedFields.has("allFrames")) {
      // see comment for prevBlocksRef on why extended message store updates are gated this way
      const newBlocks = playerState?.progress.messageCache?.blocks;
      if (newBlocks && prevBlocks !== newBlocks) {
        hasUpdated = true;
        const frames: MessageEvent<unknown>[] = (dataSourceState.allFrames = []);
        for (const block of newBlocks) {
          if (!block) {
            continue;
          }

          for (const messageEvents of Object.values(block.messagesByTopic)) {
            for (const messageEvent of messageEvents) {
              if (!subscribedTopics.includes(messageEvent.topic)) {
                continue;
              }
              frames.push(messageEvent);
            }
          }
        }
      }
      prevBlocks = newBlocks;
    }

    if (watchedFields.has("currentTime")) {
      const currentTime = activeData?.currentTime;

      if (currentTime != undefined && currentTime !== dataSourceState.currentTime) {
        hasUpdated = true;
        dataSourceState.currentTime = currentTime;
      } else {
        if (dataSourceState.currentTime != undefined) {
          hasUpdated = true;
        }
        dataSourceState.currentTime = undefined;
      }
    }

    if (watchedFields.has("previewTime")) {
      const startTime = activeData?.startTime;

      if (startTime != undefined && hoverValue != undefined) {
        const stamp = toSec(startTime) + hoverValue.value;
        if (stamp !== dataSourceState.previewTime) {
          hasUpdated = true;
        }
        dataSourceState.previewTime = stamp;
      } else {
        if (dataSourceState.previewTime != undefined) {
          hasUpdated = true;
        }
        dataSourceState.previewTime = undefined;
      }
    }

    if (watchedFields.has("appSettings")) {
      if (dataSourceState.appSettings !== appSettings) {
        hasUpdated = true;
        dataSourceState.appSettings = appSettings;
      }
    }

    if (!hasUpdated) {
      return undefined;
    }

    return dataSourceState;
  };
}

export { initDataSourceStateBuilder };
