// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import { useValueChangedDebugLog } from "@foxglove/hooks";
import Logger from "@foxglove/log";
import { fromSec, toSec } from "@foxglove/rostime";
import {
  AppSettingValue,
  DataExtensionContext,
  DataSourceState,
  ExtensionDataHandlerRegistration,
  ParameterValue,
  Subscription,
  VariableValue,
} from "@foxglove/studio";
import { initDataSourceStateBuilder } from "@foxglove/studio-base/components/DataExtensionAdapter/dataSourceState";
import {
  MessagePipelineContext,
  useMessagePipeline,
  useMessagePipelineGetter,
} from "@foxglove/studio-base/components/MessagePipeline";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import { useAppConfiguration } from "@foxglove/studio-base/context/AppConfigurationContext";
import {
  useClearHoverValue,
  useHoverValue,
  useSetHoverValue,
} from "@foxglove/studio-base/context/TimelineInteractionStateContext";
import useGlobalVariables from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  PlayerCapabilities,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";
import { PanelConfig } from "@foxglove/studio-base/types/panels";
import { assertNever } from "@foxglove/studio-base/util/assertNever";

const log = Logger.getLogger(__filename);

type DataExtensionAdapterProps = {
  /** function that initializes the extension data handler */
  initDataHandler: ExtensionDataHandlerRegistration["initDataHandler"];
};

function selectContext(ctx: MessagePipelineContext) {
  return ctx;
}

type HandlerFn = NonNullable<DataExtensionContext["onData"]>;

/**
 * DataExtensionAdapter executes a data extension via initExtension.
 *
 * The adapter creates a DataExtensionContext and invokes initExtension using the context.
 */
function DataExtensionAdapter(props: DataExtensionAdapterProps): JSX.Element {
  const { initDataHandler } = props;

  const messagePipelineContext = useMessagePipeline(selectContext);

  const { playerState, pauseFrame, setSubscriptions, seekPlayback, sortedTopics } =
    messagePipelineContext;

  const { capabilities, profile: dataSourceProfile } = playerState;

  const { openSiblingPanel } = usePanelContext();

  const [instanceId] = useState(() => uuid());

  const latestInstanceId = useRef<string | undefined>(instanceId);
  useLayoutEffect(() => {
    latestInstanceId.current = instanceId;
    return () => {
      latestInstanceId.current = undefined;
    };
  }, [instanceId]);

  const [error, setError] = useState<Error | undefined>();
  const [watchedFields, setWatchedFields] = useState(new Set<keyof DataSourceState>());

  // When subscribing to preloaded topics we use this array to filter the raw blocks to include only
  // the topics we subscribed to in the allFrames state. Otherwise the handler would receive
  // messages in allFrames for topics it did not subscribe to
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);

  const [appSettings, setAppSettings] = useState(new Map<string, AppSettingValue>());
  const [subscribedAppSettings, setSubscribedAppSettings] = useState<string[]>([]);

  const [handlerFn, setHandlerFn] = useState<HandlerFn | undefined>();

  const { globalVariables, setGlobalVariables } = useGlobalVariables();

  const hoverValue = useHoverValue({
    componentId: `DataExtensionAdapter:${instanceId}`,
    isTimestampScale: true,
  });
  const setHoverValue = useSetHoverValue();
  const clearHoverValue = useClearHoverValue();

  // track the advertisements requested by the panel context
  // topic -> advertisement
  const advertisementsRef = useRef(new Map<string, AdvertiseOptions>());

  const appConfiguration = useAppConfiguration();

  // The panel extension context exposes methods on the message pipeline. We don't want
  // the extension context to be re-created when the message pipeline changes since it only
  // needs to act on the latest version of the message pipeline.
  //
  // This getter allows the extension context to remain stable through pipeline changes
  const getMessagePipelineContext = useMessagePipelineGetter();

  // initDataSourceStateBuilder produces a function which computes the latest state from a set of inputs
  // Spiritually its like a reducer
  const [buildDataSourceState, setBuildDataSourceState] = useState(() =>
    initDataSourceStateBuilder(),
  );

  // Register handlers to update the app settings we subscribe to
  useEffect(() => {
    const handlers = new Map<string, (newValue: AppSettingValue) => void>();

    for (const key of subscribedAppSettings) {
      const handler = (newValue: AppSettingValue) => {
        setAppSettings((old) => {
          old.set(key, newValue);
          return new Map(old);
        });
      };
      handlers.set(key, handler);
      appConfiguration.addChangeListener(key, handler);
    }

    const newAppSettings = new Map<string, AppSettingValue>();
    for (const key of subscribedAppSettings) {
      newAppSettings.set(key, appConfiguration.get(key));
    }

    setAppSettings(newAppSettings);

    return () => {
      for (const [key, handler] of handlers.entries()) {
        appConfiguration.removeChangeListener(key, handler);
      }
    };
  }, [appConfiguration, subscribedAppSettings]);

  const messageEvents = useMemo(
    () => messagePipelineContext.messageEventsBySubscriberId.get(instanceId),
    [messagePipelineContext.messageEventsBySubscriberId, instanceId],
  );

  // The handling ref is set when we call the onData handler
  const handlingRef = useRef<boolean>(false);
  useLayoutEffect(() => {
    if (!handlerFn) {
      return;
    }

    const dataSourceState = buildDataSourceState({
      watchedFields,
      globalVariables,
      hoverValue,
      playerState,
      appSettings,
      subscribedTopics,
      currentFrame: messageEvents,
      sortedTopics,
    });

    if (!dataSourceState) {
      return;
    }

    if (handlingRef.current) {
      return;
    }

    const resumeFrame = pauseFrame(instanceId);

    // run the handler and lockout future handler calls until done is called
    handlingRef.current = true;
    try {
      setError(undefined);
      let doneCalled = false;
      handlerFn(dataSourceState, () => {
        // ignore any additional done calls from the panel
        if (doneCalled) {
          log.warn(`${instanceId} called onData done function multiple times`);
          return;
        }
        doneCalled = true;
        resumeFrame();
        handlingRef.current = false;
      });
    } catch (err) {
      setError(err);
    }
  }, [
    instanceId,
    pauseFrame,
    subscribedTopics,
    watchedFields,
    appSettings,
    hoverValue,
    playerState,
    messageEvents,
    handlerFn,
    buildDataSourceState,
    globalVariables,
    sortedTopics,
  ]);

  const dataExtensionContext = useMemo<DataExtensionContext>(() => {
    const layout: DataExtensionContext["layout"] = {
      addPanel({ position, type, updateIfExists, getState }) {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (position === "sibling") {
          openSiblingPanel({
            panelType: type,
            updateIfExists,
            siblingConfigCreator: (existingConfig) => getState(existingConfig) as PanelConfig,
          });
          return;
        }
        assertNever(position, `Unsupported position for addPanel: ${position}`);
      },
    };

    return {
      layout,

      seekPlayback: seekPlayback
        ? (stamp: number) => {
            if (instanceId !== latestInstanceId.current) {
              return;
            }
            seekPlayback(fromSec(stamp));
          }
        : undefined,

      dataSourceProfile,

      setParameter: (name: string, value: ParameterValue) => {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        getMessagePipelineContext().setParameter(name, value);
      },

      setVariable: (name: string, value: VariableValue) => {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        setGlobalVariables({ [name]: value });
      },

      setPreviewTime: (stamp: number | undefined) => {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        if (stamp == undefined) {
          clearHoverValue("PanelExtensionAdatper");
        } else {
          const ctx = getMessagePipelineContext();
          const startTime = ctx.playerState.activeData?.startTime;
          // if we don't have a start time we cannot correctly set the playback seconds hover value
          // this hover value needs seconds from start
          if (!startTime) {
            return;
          }
          const secondsFromStart = stamp - toSec(startTime);
          setHoverValue({
            type: "PLAYBACK_SECONDS",
            componentId: "PanelExtensionAdatper",
            value: secondsFromStart,
          });
        }
      },

      watch: (field: keyof DataSourceState) => {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        setWatchedFields((old) => {
          old.add(field);
          return new Set(old);
        });
      },

      subscribe: (topics: ReadonlyArray<string | Subscription>) => {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        const newSubscribedTopics: string[] = [];
        const subscribePayloads = topics.map<SubscribePayload>((item) => {
          if (typeof item === "string") {
            newSubscribedTopics.push(item);
            // For backwards compatability with the topic-string-array api `subscribe(["/topic"])`
            // results in a topic subscription with full preloading
            return { topic: item, preloadType: "full" };
          }

          newSubscribedTopics.push(item.topic);
          return {
            topic: item.topic,
            preloadType: item.preload === true ? "full" : "partial",
          };
        });

        setSubscribedTopics(newSubscribedTopics);
        setSubscriptions(instanceId, subscribePayloads);
      },

      advertise: capabilities.includes(PlayerCapabilities.advertise)
        ? (topic: string, datatype: string, options) => {
            if (instanceId !== latestInstanceId.current) {
              return;
            }
            const payload: AdvertiseOptions = {
              topic,
              datatype,
              options,
            };
            advertisementsRef.current.set(topic, payload);

            getMessagePipelineContext().setPublishers(
              instanceId,
              Array.from(advertisementsRef.current.values()),
            );
          }
        : undefined,

      unadvertise: capabilities.includes(PlayerCapabilities.advertise)
        ? (topic: string) => {
            if (instanceId !== latestInstanceId.current) {
              return;
            }
            advertisementsRef.current.delete(topic);
            getMessagePipelineContext().setPublishers(
              instanceId,
              Array.from(advertisementsRef.current.values()),
            );
          }
        : undefined,

      publish: capabilities.includes(PlayerCapabilities.advertise)
        ? (topic, message) => {
            if (instanceId !== latestInstanceId.current) {
              return;
            }
            getMessagePipelineContext().publish({
              topic,
              msg: message as Record<string, unknown>,
            });
          }
        : undefined,

      callService: capabilities.includes(PlayerCapabilities.callServices)
        ? async (service, request): Promise<unknown> => {
            if (instanceId !== latestInstanceId.current) {
              throw new Error("Service call after panel was unmounted");
            }
            return await getMessagePipelineContext().callService(service, request);
          }
        : undefined,

      unsubscribeAll: () => {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        setSubscribedTopics([]);
        setSubscriptions(instanceId, []);
      },

      subscribeAppSettings: (settings: string[]) => {
        if (instanceId !== latestInstanceId.current) {
          return;
        }
        setSubscribedAppSettings(settings);
      },
    };
  }, [
    capabilities,
    clearHoverValue,
    dataSourceProfile,
    getMessagePipelineContext,
    latestInstanceId,
    openSiblingPanel,
    instanceId,
    seekPlayback,
    setGlobalVariables,
    setHoverValue,
    setSubscriptions,
  ]);

  useValueChangedDebugLog(initDataHandler, "initDataHandler");
  useValueChangedDebugLog(instanceId, "instanceId");
  useValueChangedDebugLog(dataExtensionContext, "dataExtensionContext");

  // Manage extension lifecycle by calling initDataHandler() when the data handler context changes.
  //
  // If we useEffect here instead of useLayoutEffect, the prevDataSourceState can get polluted with
  // data from a previous instance.
  useLayoutEffect(() => {
    // Reset local state when the panel element is mounted or changes
    setHandlerFn(undefined);
    setBuildDataSourceState(() => initDataSourceStateBuilder());

    log.info(`Init extension data handler ${instanceId}`);
    initDataHandler({
      ...dataExtensionContext,

      // eslint-disable-next-line no-restricted-syntax
      set onData(handlerFunction: HandlerFn | undefined) {
        setHandlerFn(() => handlerFunction);
      },
    });

    return () => {
      getMessagePipelineContext().setSubscriptions(instanceId, []);
      getMessagePipelineContext().setPublishers(instanceId, []);
    };
  }, [initDataHandler, instanceId, dataExtensionContext, getMessagePipelineContext]);

  if (error) {
    throw error;
  }

  return <></>;
}

export default DataExtensionAdapter;
