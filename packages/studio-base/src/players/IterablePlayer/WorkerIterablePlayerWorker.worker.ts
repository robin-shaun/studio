// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";
import { isEqual } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import { filterMap } from "@foxglove/den/collection";
import Log from "@foxglove/log";
import {
  Time,
  add,
  compare,
  clampTime,
  fromMillis,
  fromNanoSec,
  toString,
} from "@foxglove/rostime";
import { MessageEvent, ParameterValue } from "@foxglove/studio";
import type { DataSourceFactoryInitializeArgs } from "@foxglove/studio-base/context/PlayerSelectionContext";
import { BufferedIterableSource } from "@foxglove/studio-base/players/IterablePlayer/BufferedIterableSource";
import type {
  IIterableSource,
  IteratorResult,
} from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import {
  Progress,
  Topic,
  PlayerPresence,
  PlayerCapabilities,
  TopicStats,
  SubscribePayload,
  PlayerProblem,
  PlayerURLState,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import delay from "@foxglove/studio-base/util/delay";

const log = Log.getLogger(__filename);

log.debug("WorkerIterablePlayerWorker thread started");

// Amount to wait until panels have had the chance to subscribe to topics before
// we start playback
const START_DELAY_MS = 100;

// Amount to seek into the bag from the start when loading the player, to show
// something useful on the screen.
const SEEK_ON_START_NS = BigInt(99 * 1e6);

type SourceFn = () => Promise<{
  initialize: (args: DataSourceFactoryInitializeArgs) => IIterableSource;
}>;

const RegisteredSources: Record<string, SourceFn> = {
  mcap: async () => await import("./Mcap/McapIterableSource"),
  rosbag: async () => await import("./BagIterableSource"),
};

export type WorkerIterablePlayerWorkerArgs = {
  sourceId: string;
  sourceType: string;
  factoryArgs: DataSourceFactoryInitializeArgs;
};

// fixme - flat list from PlayerState
// comments
export type PlaybackState = {
  presence: PlayerPresence;
  progress: Progress;
  capabilities: typeof PlayerCapabilities[keyof typeof PlayerCapabilities][];
  profile: string | undefined;
  playerId: string;
  name?: string;
  problems?: PlayerProblem[];
  urlState?: PlayerURLState;

  // active data

  messages: readonly MessageEvent<unknown>[];
  totalBytesReceived: number; // always-increasing
  currentTime: Time;
  startTime: Time;
  endTime: Time;
  isPlaying: boolean;
  speed: number;
  lastSeekTime: number;
  topics: Topic[];
  topicStats: Map<string, TopicStats>;
  datatypes: RosDatatypes;
  publishedTopics?: Map<string, Set<string>>;
  subscribedTopics?: Map<string, Set<string>>;
  services?: Map<string, Set<string>>;
  parameters?: Map<string, ParameterValue>;
};

type State =
  | "preinit"
  | "start-play"
  | "idle"
  | "seek-backfill"
  | "play"
  | "reset-playback-iterator";

export class WorkerIterablePlayerWorker {
  private _nextState?: State;
  private _state: State = "preinit";
  private _runningState: boolean = false;
  // Some states register an abort controller to signal they should abort
  private _abort?: AbortController;
  private _subscriptions: SubscribePayload[] = [];

  private _args: WorkerIterablePlayerWorkerArgs;
  private _registeredSource?: SourceFn;
  private _listener?: (partialPlayerState: Partial<PlaybackState>) => Promise<void>;
  private _sourceId: string;
  private _urlParams?: Record<string, string> = {};
  private _name?: string;
  private _progress: Progress = {};
  private _id: string = uuidv4();
  private _messages: MessageEvent<unknown>[] = [];
  private _receivedBytes: number = 0;
  private _hasError = false;
  private _publishedTopics = new Map<string, Set<string>>();
  private _presence = PlayerPresence.INITIALIZING;
  private _isPlaying: boolean = false;
  private _speed: number = 1.0;
  private _start: Time = { sec: 0, nsec: 0 };
  private _end: Time = { sec: 0, nsec: 0 };
  private _profile: string | undefined;
  private _allTopics: Set<string> = new Set();
  private _partialTopics: Set<string> = new Set();

  private _lastRangeMillis?: number;
  // next read start time indicates where to start reading for the next tick
  // after a tick read, it is set to 1nsec past the end of the read operation (preparing for the next tick)
  private _lastTickMillis?: number;

  // To keep reference equality for downstream user memoization cache the currentTime provided in the last activeData update
  // See additional comments below where _currentTime is set
  private _currentTime?: Time;
  // This is the "lastSeekTime" emitted in the playerState. This indicates the emit is due to a seek.
  private _lastSeekEmitTime: number = Date.now();
  private _untilTime?: Time;
  private _lastMessage?: MessageEvent<unknown>;
  private _seekTarget?: Time;

  private _problemManager = new PlayerProblemManager();

  private _iterableSource?: IIterableSource;
  private _bufferedSource?: BufferedIterableSource;
  // The iterator for reading messages during playback
  private _playbackIterator?: AsyncIterator<Readonly<IteratorResult>>;

  private _capabilities: string[] = [
    PlayerCapabilities.setSpeed,
    PlayerCapabilities.playbackControl,
  ];

  private _providerTopics: Topic[] = [];
  private _providerTopicStats = new Map<string, TopicStats>();
  private _providerDatatypes: RosDatatypes = new Map();

  private _queueEmitState: ReturnType<typeof debouncePromise>;

  public constructor(args: WorkerIterablePlayerWorkerArgs) {
    log.debug("Init new worker:", args.sourceType);

    this._args = args;
    this._sourceId = args.sourceId;
    this._registeredSource = RegisteredSources[args.sourceType];

    // Wrap emitStateImpl in a debouncePromise for our states to call. Since we can emit from states
    // or from block loading updates we use debouncePromise to guard against concurrent emits.
    this._queueEmitState = debouncePromise(this._emitStateImpl.bind(this));
  }

  public registerListener(
    listener: (partialPlayerState: Partial<PlaybackState>) => Promise<void>,
  ): void {
    this._listener = listener;
  }

  public async initialize(): Promise<void> {
    if (!this._registeredSource) {
      throw new Error(`No such source type: ${this._args.sourceType}`);
    }

    this._queueEmitState();

    log.debug("Initializing worker registered source");
    const module = await this._registeredSource();
    this._iterableSource = module.initialize(this._args.factoryArgs);
    this._bufferedSource = new BufferedIterableSource(this._iterableSource);

    const initResult = await this._bufferedSource.initialize();

    try {
      const {
        start,
        end,
        topics,
        profile,
        topicStats,
        problems,
        publishersByTopic,
        datatypes,
        name,
      } = initResult;

      this._profile = profile;
      this._start = this._currentTime = start;
      this._end = end;
      this._publishedTopics = publishersByTopic;
      this._providerDatatypes = datatypes;
      this._name = name;

      // Studio does not like duplicate topics or topics with different datatypes
      // Check for duplicates or for mismatched datatypes
      const uniqueTopics = new Map<string, Topic>();
      for (const topic of topics) {
        const existingTopic = uniqueTopics.get(topic.name);
        if (existingTopic) {
          problems.push({
            severity: "warn",
            message: `Duplicate topic: ${topic.name}`,
          });
          continue;
        }

        uniqueTopics.set(topic.name, topic);
      }

      this._providerTopics = Array.from(uniqueTopics.values());
      this._providerTopicStats = topicStats;

      let idx = 0;
      for (const problem of problems) {
        this._problemManager.addProblem(`init-problem-${idx}`, problem);
        idx += 1;
      }

      this._presence = PlayerPresence.PRESENT;
    } catch (error) {
      this._setError(`Error initializing: ${error.message}`, error);
    }

    this._queueEmitState();

    if (!this._hasError) {
      // Wait a bit until panels have had the chance to subscribe to topics before we start
      // playback.
      await delay(START_DELAY_MS);

      this._setState("start-play");
    }
  }

  public pausePlayback(): void {
    if (!this._isPlaying) {
      return;
    }
    // clear out last tick millis so we don't read a huge chunk when we unpause
    this._lastTickMillis = undefined;
    this._isPlaying = false;
    this._untilTime = undefined;
    if (this._state === "play") {
      this._setState("idle");
    }
  }

  public setPlaybackSpeed(speed: number): void {
    delete this._lastRangeMillis;
    this._speed = speed;

    // Queue event state update to update speed in player state to UI
    this._queueEmitState();
  }

  public startPlay(opt?: { untilTime: Time }): void {
    if (this._isPlaying || this._untilTime) {
      return;
    }

    if (opt?.untilTime) {
      if (this._currentTime && compare(opt.untilTime, this._currentTime) <= 0) {
        throw new Error("Invariant: playUntil time must be after the current time");
      }
      this._untilTime = clampTime(opt.untilTime, this._start, this._end);
    }
    this._isPlaying = true;

    // If we are idling we can start playing, if we have a next state queued we let that state
    // finish and it will see that we should be playing
    if (this._state === "idle" && (!this._nextState || this._nextState === "idle")) {
      this._setState("play");
    }
  }

  public setSubscriptions(newSubscriptions: SubscribePayload[]): void {
    log.debug("set subscriptions", newSubscriptions);
    this._subscriptions = newSubscriptions;

    const allTopics = new Set(this._subscriptions.map((subscription) => subscription.topic));
    const partialTopics = new Set(
      filterMap(this._subscriptions, (sub) =>
        sub.preloadType !== "partial" ? sub.topic : undefined,
      ),
    );

    // If there are no changes to topics there's no reason to perform a "seek" to trigger loading
    if (isEqual(allTopics, this._allTopics) && isEqual(partialTopics, this._partialTopics)) {
      return;
    }

    this._allTopics = allTopics;
    this._partialTopics = partialTopics;

    // If the player is playing, the playing state will detect any subscription changes and adjust
    // iterators accordignly. However if we are idle or already seeking then we need to manually
    // trigger the backfill.
    if (this._state === "idle" || this._state === "seek-backfill" || this._state === "play") {
      if (!this._isPlaying && this._currentTime) {
        this._seekTarget = this._currentTime;
        this._untilTime = undefined;

        // Trigger a seek backfill to load any missing messages and reset the forward iterator
        this._setState("seek-backfill");
      }
    }
  }

  /** Request the state to switch to newState */
  private _setState(newState: State) {
    log.debug(`Set next state: ${newState}`);
    this._nextState = newState;
    this._abort?.abort();
    this._abort = undefined;

    // Support moving between idle (pause) and play and preserving the playback iterator
    if (newState !== "idle" && newState !== "play" && this._playbackIterator) {
      log.debug("Ending playback iterator because next state is not IDLE or PLAY");
      const oldIterator = this._playbackIterator;
      this._playbackIterator = undefined;
      void oldIterator.return?.().catch((err) => {
        log.error(err);
      });
    }

    void this._runState();
  }

  /**
   * Run the requested state while there is a state to run.
   *
   * Ensures that only one state is running at a time.
   * */
  private async _runState() {
    if (this._runningState) {
      return;
    }

    this._runningState = true;
    try {
      while (this._nextState) {
        const state = (this._state = this._nextState);
        this._nextState = undefined;

        log.debug(`Start state: ${state}`);

        switch (state) {
          case "preinit":
            // no-op
            break;
          case "start-play":
            await this._stateStartPlay();
            break;
          case "idle":
            await this._stateIdle();
            break;
          case "seek-backfill":
            // We allow aborting requests when moving on to the next state
            await this._stateSeekBackfill();
            break;
          case "play":
            await this._statePlay();
            break;
          case "reset-playback-iterator":
            await this._stateResetPlaybackIterator();
        }

        log.debug(`Done state ${state}`);
      }
    } catch (err) {
      log.error(err);
      this._setError((err as Error).message, err);
      this._queueEmitState();
    } finally {
      this._runningState = false;
    }
  }

  private _setError(message: string, error?: Error): void {
    this._hasError = true;
    this._problemManager.addProblem("global-error", {
      severity: "error",
      message,
      error,
    });
    this._isPlaying = false;
  }

  // fixme - cleanup
  private _hasEmittedError = false;

  private _prevState?: PlaybackState;

  /** Emit the player state to the registered listener */
  private async _emitStateImpl() {
    if (!this._listener) {
      return;
    }

    if (this._hasEmittedError) {
      return;
    }

    const name = this._name;

    if (this._hasError) {
      // once we emit this error state we don't need to emit these fields again
      this._hasEmittedError = true;
      return await this._listener({
        name,
        presence: PlayerPresence.ERROR,
        progress: {},
        capabilities: this._capabilities,
        profile: this._profile,
        playerId: this._id,
        problems: this._problemManager.problems(),
        urlState: {
          sourceId: this._sourceId,
          parameters: this._urlParams,
        },
      });
    }

    const messages = this._messages;
    this._messages = [];

    const currentTime = this._currentTime ?? this._start;

    const playerState: PlaybackState = {
      name,
      presence: this._presence,
      progress: this._progress,
      capabilities: this._capabilities,
      profile: this._profile,
      playerId: this._id,
      problems: this._problemManager.problems(),
      urlState: {
        sourceId: this._sourceId,
        parameters: this._urlParams,
      },
      // active data
      messages,
      totalBytesReceived: this._receivedBytes,
      currentTime,
      startTime: this._start,
      endTime: this._end,
      isPlaying: this._isPlaying,
      speed: this._speed,
      lastSeekTime: this._lastSeekEmitTime,
      topics: this._providerTopics,
      topicStats: this._providerTopicStats,
      datatypes: this._providerDatatypes,
      publishedTopics: this._publishedTopics,
    };

    const partialPlayerState: Partial<PlaybackState> = {};

    type Keys = keyof PlaybackState;
    const keys = Object.keys(playerState) as Keys[];

    // fixme - hack to get changed fields from prevState
    for (const key of keys) {
      if (this._prevState?.[key] !== playerState[key]) {
        // @ts-ignore-error
        partialPlayerState[key] = playerState[key];
      }
    }

    // fixme urlState should use subfields

    this._prevState = playerState;
    return await this._listener(partialPlayerState);
  }

  public seekPlayback(time: Time): void {
    // Limit seek to within the valid range
    const targetTime = clampTime(time, this._start, this._end);

    // We are already seeking to this time, no need to reset seeking
    if (this._seekTarget && compare(this._seekTarget, targetTime) === 0) {
      return;
    }

    // We are already at this time, no need to reset seeking
    if (this._currentTime && compare(this._currentTime, targetTime) === 0) {
      return;
    }

    this._seekTarget = targetTime;
    this._untilTime = undefined;

    this._setState("seek-backfill");
  }

  private async resetPlaybackIterator() {
    if (!this._bufferedSource) {
      throw new Error("uninitialized");
    }
    if (!this._currentTime) {
      throw new Error("Invariant: Tried to reset playback iterator with no current time.");
    }

    const next = add(this._currentTime, { sec: 0, nsec: 1 });

    await this._playbackIterator?.return?.();

    // set the playIterator to the seek time
    log.debug("Initializing forward iterator from", next);
    await this._bufferedSource.stopProducer();
    this._playbackIterator = this._bufferedSource.messageIterator({
      topics: Array.from(this._allTopics),
      start: next,
      consumptionType: "partial",
    });
  }

  /**
   * Run one tick loop by reading from the message iterator a "tick" worth of messages.
   * */
  private async _tick(): Promise<void> {
    if (!this._isPlaying) {
      return;
    }

    // compute how long of a time range we want to read by taking into account
    // the time since our last read and how fast we're currently playing back
    const tickTime = performance.now();
    const durationMillis =
      this._lastTickMillis != undefined && this._lastTickMillis !== 0
        ? tickTime - this._lastTickMillis
        : 20;
    this._lastTickMillis = tickTime;

    // Read at most 300ms worth of messages, otherwise things can get out of control if rendering
    // is very slow. Also, smooth over the range that we request, so that a single slow frame won't
    // cause the next frame to also be unnecessarily slow by increasing the frame size.
    let rangeMillis = Math.min(durationMillis * this._speed, 300);
    if (this._lastRangeMillis != undefined) {
      rangeMillis = this._lastRangeMillis * 0.9 + rangeMillis * 0.1;
    }
    this._lastRangeMillis = rangeMillis;

    if (!this._currentTime) {
      throw new Error("Invariant: Tried to play with no current time.");
    }

    // The end time when we want to stop reading messages and emit state for the tick
    // The end time is inclusive.
    const targetTime = add(this._currentTime, fromMillis(rangeMillis));
    const end: Time = clampTime(targetTime, this._start, this._untilTime ?? this._end);

    const msgEvents: MessageEvent<unknown>[] = [];

    // When ending the previous tick, we might have already read a message from the iterator which
    // belongs to our tick. This logic brings that message into our current batch of message events.
    if (this._lastMessage) {
      // If the last message we saw is still ahead of the tick end time, we don't emit anything
      if (compare(this._lastMessage.receiveTime, end) > 0) {
        // Wait for the previous render frame to finish
        await this._queueEmitState.currentPromise;

        this._currentTime = end;
        this._messages = msgEvents;
        this._queueEmitState();

        if (this._untilTime && compare(this._currentTime, this._untilTime) >= 0) {
          this.pausePlayback();
        }
        return;
      }

      msgEvents.push(this._lastMessage);
      this._lastMessage = undefined;
    }

    // If we take too long to read the tick data, we set the player into a BUFFERING presence. This
    // indicates that the player is waiting to load more data. When the tick finally finishes, we
    // clear this timeout.
    const tickTimeout = setTimeout(() => {
      this._presence = PlayerPresence.BUFFERING;
      this._queueEmitState();
    }, 500);

    try {
      // Read from the iterator through the end of the tick time
      for (;;) {
        if (!this._playbackIterator) {
          throw new Error("Invariant. this._playbackIterator is undefined.");
        }

        const result = await this._playbackIterator.next();
        if (result.done === true || this._nextState) {
          break;
        }
        const iterResult = result.value;
        if (iterResult.problem) {
          this._problemManager.addProblem(`connid-${iterResult.connectionId}`, iterResult.problem);
        }

        if (iterResult.problem) {
          continue;
        }

        // The message is past the tick end time, we need to save it for next tick
        if (compare(iterResult.msgEvent.receiveTime, end) > 0) {
          this._lastMessage = iterResult.msgEvent;
          break;
        }

        msgEvents.push(iterResult.msgEvent);
      }
    } finally {
      clearTimeout(tickTimeout);
    }

    // Set the presence back to PRESENT since we are no longer buffering
    this._presence = PlayerPresence.PRESENT;

    if (this._nextState) {
      return;
    }

    // Wait on any active emit state to finish as part of this tick
    // Without waiting on the emit state to finish we might drop messages since our emitState
    // might get debounced
    await this._queueEmitState.currentPromise;

    this._currentTime = end;
    this._messages = msgEvents;
    this._queueEmitState();

    // This tick has reached the end of the untilTime so we go back to pause
    if (this._untilTime && compare(this._currentTime, this._untilTime) >= 0) {
      this.pausePlayback();
    }
  }

  // Read a small amount of data from the datasource with the hope of producing a message or two.
  // Without an initial read, the user would be looking at a blank layout since no messages have yet
  // been delivered.
  private async _stateStartPlay() {
    if (!this._bufferedSource) {
      throw new Error("uninitialized");
    }

    const stopTime = clampTime(
      add(this._start, fromNanoSec(SEEK_ON_START_NS)),
      this._start,
      this._end,
    );

    log.debug(`Playing from ${toString(this._start)} to ${toString(stopTime)}`);

    if (this._playbackIterator) {
      throw new Error("Invariant. playbackIterator was already set");
    }

    log.debug("Initializing forward iterator from", this._start);
    this._playbackIterator = this._bufferedSource.messageIterator({
      topics: Array.from(this._allTopics),
      start: this._start,
      consumptionType: "partial",
    });

    this._lastMessage = undefined;
    this._messages = [];

    const messageEvents: MessageEvent<unknown>[] = [];

    // If we take too long to read the data, we set the player into a BUFFERING presence. This
    // indicates that the player is waiting to load more data.
    const tickTimeout = setTimeout(() => {
      this._presence = PlayerPresence.BUFFERING;
      this._queueEmitState();
    }, 100);

    try {
      for (;;) {
        const result = await this._playbackIterator.next();
        if (result.done === true) {
          break;
        }
        const iterResult = result.value;
        // Bail if a new state is requested while we are loading messages
        // This usually happens when seeking before the initial load is complete
        if (this._nextState) {
          return;
        }

        if (iterResult.problem) {
          this._problemManager.addProblem(`connid-${iterResult.connectionId}`, iterResult.problem);
          continue;
        }

        if (compare(iterResult.msgEvent.receiveTime, stopTime) > 0) {
          this._lastMessage = iterResult.msgEvent;
          break;
        }

        messageEvents.push(iterResult.msgEvent);
      }
    } finally {
      clearTimeout(tickTimeout);
    }

    this._currentTime = stopTime;
    this._messages = messageEvents;
    this._presence = PlayerPresence.PRESENT;
    this._queueEmitState();
    this._setState("idle");
  }

  // Process a seek request. The seek is performed by requesting a getBackfillMessages from the source.
  // This provides the last message on all subscribed topics.
  private async _stateSeekBackfill() {
    if (!this._bufferedSource) {
      throw new Error("uninitialized");
    }

    const targetTime = this._seekTarget;
    if (!targetTime) {
      return;
    }

    this._lastMessage = undefined;

    // If the backfill does not complete within 100 milliseconds, we emit a seek event with no messages.
    // This provides feedback to the user that we've acknowledged their seek request but haven't loaded the data.
    const seekAckTimeout = setTimeout(() => {
      this._presence = PlayerPresence.BUFFERING;
      this._messages = [];
      this._currentTime = targetTime;
      this._lastSeekEmitTime = Date.now();
      this._queueEmitState();
    }, 100);

    const topics = Array.from(this._allTopics);

    try {
      this._abort = new AbortController();
      const messages = await this._bufferedSource.getBackfillMessages({
        topics,
        time: targetTime,
        abortSignal: this._abort.signal,
      });

      // We've successfully loaded the messages and will emit those, no longer need the ackTimeout
      clearTimeout(seekAckTimeout);

      if (this._nextState) {
        return;
      }

      this._messages = messages;
      this._currentTime = targetTime;
      this._lastSeekEmitTime = Date.now();
      this._presence = PlayerPresence.PRESENT;
      this._queueEmitState();
      await this.resetPlaybackIterator();
      this._setState(this._isPlaying ? "play" : "idle");
    } catch (err) {
      if (this._nextState && err instanceof DOMException && err.name === "AbortError") {
        log.debug("Aborted backfill");
      } else {
        throw err;
      }
    } finally {
      // Unless the next state is a seek backfill, we clear the seek target since we have finished seeking
      if (this._nextState !== "seek-backfill") {
        this._seekTarget = undefined;
      }
      clearTimeout(seekAckTimeout);
      this._abort = undefined;
    }
  }

  private async _stateIdle() {
    if (!this._bufferedSource) {
      throw new Error("uninitialized");
    }

    this._isPlaying = false;
    this._presence = PlayerPresence.PRESENT;
    this._queueEmitState();

    if (this._abort) {
      throw new Error("Invariant: some other abort controller exists");
    }
    const abort = (this._abort = new AbortController());

    const aborted = new Promise<void>((resolve) => {
      abort.signal.addEventListener("abort", () => {
        resolve();
      });
    });

    for (;;) {
      this._progress = {
        fullyLoadedFractionRanges: this._bufferedSource.loadedRanges(),
        messageCache: this._progress.messageCache,
      };
      this._queueEmitState();

      // When idling nothing is querying the source, but our buffered source might be
      // buffering behind the scenes. Every second we emit state with an update to show that
      // buffering is happening.
      await Promise.race([delay(1000), aborted]);
      if (this._nextState) {
        break;
      }
    }
  }

  private async _stateResetPlaybackIterator() {
    if (!this._currentTime) {
      throw new Error("Invariant: Tried to reset playback iterator with no current time.");
    }

    await this.resetPlaybackIterator();
    this._setState(this._isPlaying ? "play" : "idle");
  }

  private async _statePlay() {
    if (!this._bufferedSource) {
      throw new Error("uninitialized");
    }

    this._presence = PlayerPresence.PRESENT;

    if (!this._currentTime) {
      throw new Error("Invariant: currentTime not set before statePlay");
    }

    // Track the identity of allTopics, if this changes we need to reset our iterator to
    // get new messages for new topics
    const allTopics = this._allTopics;

    try {
      while (this._isPlaying && !this._hasError && !this._nextState) {
        if (compare(this._currentTime, this._end) >= 0) {
          this._setState("idle");
          return;
        }

        const start = Date.now();

        await this._tick();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/strict-boolean-expressions
        if (this._nextState) {
          return;
        }

        // If subscriptions changed, update to the new subscriptions
        if (this._allTopics !== allTopics) {
          // Discard any last message event since the new iterator will repeat it
          this._lastMessage = undefined;

          // Bail playback and reset the playback iterator when topics have changed so we can load
          // the new topics
          this._setState("reset-playback-iterator");
          return;
        }

        this._progress = {
          fullyLoadedFractionRanges: this._bufferedSource.loadedRanges(),
          messageCache: this._progress.messageCache,
        };

        const time = Date.now() - start;
        // make sure we've slept at least 16 millis or so (aprox 1 frame)
        // to give the UI some time to breathe and not burn in a tight loop
        if (time < 16) {
          await delay(16 - time);
        }
      }
    } catch (err) {
      this._setError((err as Error).message, err);
      this._queueEmitState();
    }
  }
}

Comlink.expose(WorkerIterablePlayerWorker);
