// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import Log from "@foxglove/log";
import { Time } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import type { DataSourceFactoryInitializeArgs } from "@foxglove/studio-base/context/PlayerSelectionContext";
import {
  AdvertiseOptions,
  Player,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";

import type {
  PlaybackState,
  WorkerIterablePlayerWorker,
  WorkerIterablePlayerWorkerArgs,
} from "./WorkerIterablePlayerWorker.worker";

const log = Log.getLogger(__filename);

type WorkerIterablePlayerOptions = {
  metricsCollector?: PlayerMetricsCollectorInterface;

  sourceType: string;

  // Source identifier used in constructing state urls.
  sourceId: string;

  factoryArgs: DataSourceFactoryInitializeArgs;
};

/**
 * IterablePlayer implements the Player interface for IIterableSource instances.
 *
 * The iterable player reads messages from an IIterableSource. The player is implemented as a state
 * machine. Each state runs until it finishes. A request to change state is handled by each state
 * detecting that there is another state waiting and cooperatively ending itself.
 */
export class WorkerIterablePlayer implements Player {
  private _listener?: (playerState: PlayerState) => Promise<void>;

  private _thread: Worker;
  private _worker?: Comlink.Remote<WorkerIterablePlayerWorker>;
  private _playerState: PlayerState;

  private readonly _sourceId: string;
  private readonly _sourceType: string;
  private readonly _factoryArgs: DataSourceFactoryInitializeArgs;

  public constructor(options: WorkerIterablePlayerOptions) {
    const { sourceType, sourceId } = options;

    this._sourceType = sourceType;
    this._sourceId = sourceId;
    this._factoryArgs = options.factoryArgs;
    this._playerState = {
      presence: PlayerPresence.NOT_PRESENT,
      progress: {},
      capabilities: [],
      profile: undefined,
      playerId: "",
    };

    // Note: this launches the worker.
    this._thread = new Worker(new URL("./WorkerIterablePlayerWorker.worker", import.meta.url));
  }

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    if (this._listener) {
      throw new Error("Cannot setListener again");
    }
    this._listener = listener;
    void this._stateInitialize();
  }

  public startPlayback(): void {
    // fixme - catch/log
    void this._worker?.startPlay();
  }

  public playUntil(time: Time): void {
    // fixme - catch/log
    void this._worker?.startPlay({ untilTime: time });
  }

  public pausePlayback(): void {
    // fixme - catch/log
    void this._worker?.pausePlayback();
  }

  public setPlaybackSpeed(speed: number): void {
    // fixme
  }

  public seekPlayback(time: Time): void {
    // fixme - catch/log
    void this._worker?.seekPlayback(time);
  }

  public setSubscriptions(newSubscriptions: SubscribePayload[]): void {
    // fixme - catch/log
    void this._worker?.setSubscriptions(newSubscriptions);
  }

  public setPublishers(_publishers: AdvertiseOptions[]): void {
    // no-op
  }

  public setParameter(_key: string, _value: ParameterValue): void {
    throw new Error("Parameter editing is not supported by this data source");
  }

  public publish(_payload: PublishPayload): void {
    throw new Error("Publishing is not supported by this data source");
  }

  public async callService(): Promise<unknown> {
    throw new Error("Service calls are not supported by this data source");
  }

  public close(): void {
    this._thread.terminate();
  }

  public setGlobalVariables(): void {
    // no-op
  }

  // Initialize the source and player members
  private async _stateInitialize(): Promise<void> {
    try {
      const Wrapped = Comlink.wrap<
        new (args: WorkerIterablePlayerWorkerArgs) => WorkerIterablePlayerWorker
      >(this._thread);

      // fixme
      // emit player state indicating we are loading

      this._worker = await new Wrapped({
        sourceId: this._sourceId,
        sourceType: this._sourceType,
        factoryArgs: this._factoryArgs,
      });

      const boundEmitState = this._emitStateImpl.bind(this);
      await this._worker.registerListener(Comlink.proxy(boundEmitState));

      await this._worker.initialize();
    } catch (err) {
      log.error(err);
    }
  }

  private async _emitStateImpl(partialPlayerState: Partial<PlaybackState>): Promise<void> {
    if (!this._listener) {
      return;
    }

    this._playerState.name = partialPlayerState.name ?? this._playerState.name;
    this._playerState.presence = partialPlayerState.presence ?? this._playerState.presence;
    this._playerState.progress = partialPlayerState.progress ?? this._playerState.progress;
    this._playerState.capabilities =
      partialPlayerState.capabilities ?? this._playerState.capabilities;
    this._playerState.profile = partialPlayerState.profile ?? this._playerState.profile;
    this._playerState.playerId = partialPlayerState.playerId ?? this._playerState.playerId;
    this._playerState.problems = partialPlayerState.problems ?? this._playerState.problems;
    this._playerState.urlState = partialPlayerState.urlState ?? this._playerState.urlState;

    const activeData: NonNullable<PlayerState["activeData"]> = this._playerState.activeData ?? {
      messages: [],
      totalBytesReceived: 0,
      currentTime: { sec: 0, nsec: 0 },
      startTime: { sec: 0, nsec: 0 },
      endTime: { sec: 0, nsec: 0 },
      isPlaying: false,
      speed: 1,
      lastSeekTime: 0,
      topics: [],
      topicStats: new Map(),
      datatypes: new Map(),
    };

    // active data
    activeData.messages = partialPlayerState.messages ?? activeData.messages;
    activeData.totalBytesReceived =
      partialPlayerState.totalBytesReceived ?? activeData.totalBytesReceived;
    activeData.currentTime = partialPlayerState.currentTime ?? activeData.currentTime;
    activeData.startTime = partialPlayerState.startTime ?? activeData.startTime;
    activeData.endTime = partialPlayerState.endTime ?? activeData.endTime;
    activeData.isPlaying = partialPlayerState.isPlaying ?? activeData.isPlaying;
    activeData.speed = partialPlayerState.speed ?? activeData.speed;
    activeData.lastSeekTime = partialPlayerState.lastSeekTime ?? activeData.lastSeekTime;
    activeData.topics = partialPlayerState.topics ?? activeData.topics;
    activeData.topicStats = partialPlayerState.topicStats ?? activeData.topicStats;
    activeData.datatypes = partialPlayerState.datatypes ?? activeData.datatypes;
    activeData.publishedTopics = partialPlayerState.publishedTopics ?? activeData.publishedTopics;
    activeData.subscribedTopics =
      partialPlayerState.subscribedTopics ?? activeData.subscribedTopics;
    activeData.services = partialPlayerState.services ?? activeData.services;
    activeData.parameters = partialPlayerState.parameters ?? activeData.parameters;

    this._playerState.activeData = activeData;
    return await this._listener(this._playerState);
  }
}
