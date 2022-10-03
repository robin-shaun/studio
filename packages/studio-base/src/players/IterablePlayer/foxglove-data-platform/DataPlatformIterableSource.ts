// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { captureException } from "@sentry/core";
import { isEqual, maxBy, minBy } from "lodash";

import Logger from "@foxglove/log";
import { parseChannel } from "@foxglove/mcap-support";
import {
  clampTime,
  fromRFC3339String,
  isGreaterThan,
  isLessThan,
  Time,
  toRFC3339String,
  add as addTime,
  compare,
} from "@foxglove/rostime";
import {
  PlayerProblem,
  Topic,
  MessageEvent,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import ConsoleApi, { CoverageResponse } from "@foxglove/studio-base/services/ConsoleApi";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import {
  IIterableSource,
  Initalization,
  MessageIteratorArgs,
  IteratorResult,
  GetBackfillMessagesArgs,
} from "../IIterableSource";
import { streamMessages, ParsedChannelAndEncodings } from "./streamMessages";

const log = Logger.getLogger(__filename);

/**
 * The console api methods used by DataPlatformIterableSource.
 *
 * This scopes the required interface to a small subset of ConsoleApi to make it easier to mock/stub
 * for tests.
 */
export type DataPlatformInterableSourceConsoleApi = Pick<
  ConsoleApi,
  "coverage" | "topics" | "getDevice" | "stream"
>;

type DataPlatformIterableSourceOptions = {
  api: DataPlatformInterableSourceConsoleApi;
  deviceId?: string;
  importId?: string;
  start?: Time;
  end?: Time;
};

export class DataPlatformIterableSource implements IIterableSource {
  private readonly _consoleApi: DataPlatformInterableSourceConsoleApi;

  private _start: Time | undefined;
  private _end: Time | undefined;
  private readonly _deviceId: string | undefined;
  private readonly _importId: string | undefined;
  private _knownTopicNames: string[] = [];

  /**
   * Cached readers for each schema so we don't have to re-parse definitions on each stream request.
   * Although each topic is usually homogeneous, technically it is possible to have different
   * encoding or schema for each topic, so we store all the ones we've seen.
   */
  private _parsedChannelsByTopic = new Map<string, ParsedChannelAndEncodings[]>();

  private _coverage: CoverageResponse[] = [];

  public constructor(options: DataPlatformIterableSourceOptions) {
    this._consoleApi = options.api;
    this._start = options.start;
    this._end = options.end;
    this._deviceId = options.deviceId;
    this._importId = options.importId;
  }

  public async initialize(): Promise<Initalization> {
    const [coverage, rawTopics] = await Promise.all([
      this._consoleApi.coverage({
        ...(this._importId && { importId: this._importId }),
        ...(this._deviceId && { deviceId: this._deviceId }),
        ...(this._start && { start: toRFC3339String(this._start) }),
        ...(this._end && { end: toRFC3339String(this._end) }),
      }),
      this._consoleApi.topics({
        ...(this._importId && { importId: this._importId }),
        ...(this._deviceId && { deviceId: this._deviceId }),
        ...(this._start && { start: toRFC3339String(this._start) }),
        ...(this._end && { end: toRFC3339String(this._end) }),
        includeSchemas: true,
      }),
    ]);
    if (rawTopics.length === 0 || coverage.length === 0) {
      throw new Error(
        this._deviceId && this._start && this._end
          ? `No data available for ${this._deviceId} between ${formatTimeRaw(
              this._start,
            )} and ${formatTimeRaw(this._end)}.`
          : `No data available for ${this._importId}`,
      );
    }

    this._coverage = coverage;

    // Truncate start/end time to coverage range
    const coverageStart = minBy(coverage, (c) => c.start);
    const coverageEnd = maxBy(coverage, (c) => c.end);
    const coverageStartTime = coverageStart ? fromRFC3339String(coverageStart.start) : undefined;
    const coverageEndTime = coverageEnd ? fromRFC3339String(coverageEnd.end) : undefined;
    if (!coverageStartTime || !coverageEndTime) {
      throw new Error(
        `Invalid coverage response, start: ${coverage[0]!.start}, end: ${
          coverage[coverage.length - 1]!.end
        }`,
      );
    }

    const device = await this._consoleApi.getDevice(
      this._deviceId ?? coverageStart?.deviceId ?? "",
    );

    if (!this._start || isLessThan(this._start, coverageStartTime)) {
      log.debug("Increased start time from", this._start, "to", coverageStartTime);
      this._start = coverageStartTime;
    }
    if (!this._end || isGreaterThan(this._end, coverageEndTime)) {
      log.debug("Reduced end time from", this._end, "to", coverageEndTime);
      this._end = coverageEndTime;
    }

    const topics: Topic[] = [];
    const topicStats = new Map<string, TopicStats>();
    const datatypes: RosDatatypes = new Map();
    const problems: PlayerProblem[] = [];
    rawTopics: for (const rawTopic of rawTopics) {
      const { topic, encoding: messageEncoding, schemaEncoding, schema, schemaName } = rawTopic;
      if (schema == undefined) {
        problems.push({ message: `Missing schema for ${topic}`, severity: "error" });
        continue;
      }

      let parsedChannels = this._parsedChannelsByTopic.get(topic);
      if (!parsedChannels) {
        parsedChannels = [];
        this._parsedChannelsByTopic.set(topic, parsedChannels);
      }
      for (const info of parsedChannels) {
        if (
          info.messageEncoding === messageEncoding &&
          info.schemaEncoding === schemaEncoding &&
          isEqual(info.schema, schema)
        ) {
          continue rawTopics;
        }
      }

      try {
        const parsedChannel = parseChannel({
          messageEncoding,
          schema: { name: schemaName, data: schema, encoding: schemaEncoding },
        });

        topics.push({ name: topic, datatype: parsedChannel.fullSchemaName });
        parsedChannels.push({ messageEncoding, schemaEncoding, schema, parsedChannel });

        // Final datatypes is an unholy union of schemas across all channels
        for (const [name, datatype] of parsedChannel.datatypes) {
          datatypes.set(name, datatype);
        }
      } catch (err) {
        captureException(err, { extra: { rawTopic } });
        problems.push({
          message: `Failed to parse schema for topic ${topic}`,
          severity: "error",
          error: err,
        });
      }
    }

    this._knownTopicNames = topics.map((topic) => topic.name);
    return {
      topics,
      topicStats,
      datatypes,
      start: this._start,
      end: this._end,
      profile: undefined,
      problems,
      publishersByTopic: new Map(),
      name: `${device.name} (${device.id})`,
    };
  }

  public async *messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    log.debug("message iterator", args);

    const api = this._consoleApi;
    const deviceId = this._deviceId;
    const importId = this._importId;
    const parsedChannelsByTopic = this._parsedChannelsByTopic;

    // Data platform treats topic array length 0 as "all topics". Until that is changed, we filter out
    // empty topic requests
    if (args.topics.length === 0) {
      return;
    }

    // If the topics available to us don't overlap with the topics we know about then we avoid
    // making any requests since there's no data to return
    const matchingTopics = args.topics.reduce((count, topicName) => {
      return this._knownTopicNames.includes(topicName) ? count + 1 : count;
    }, 0);
    if (matchingTopics === 0) {
      log.debug("no matching topics to stream");
      return;
    }

    if (!this._start || !this._end || (!deviceId && !importId)) {
      log.debug("source needs to be initialized");
      return;
    }

    const streamStart = args.start ?? this._start;
    const streamEnd = clampTime(args.end ?? this._end, this._start, this._end);

    if (args.consumptionType === "full") {
      const stream = streamMessages({
        api,
        parsedChannelsByTopic,
        params: {
          ...(deviceId ? { deviceId } : { importId: importId! }),
          start: streamStart,
          end: streamEnd,
          topics: args.topics,
        },
      });

      for await (const messages of stream) {
        for (const message of messages) {
          yield { connectionId: undefined, msgEvent: message, problem: undefined };
        }
      }

      return;
    }

    let localStart = streamStart;
    let localEnd = clampTime(addTime(localStart, { sec: 5, nsec: 0 }), streamStart, streamEnd);
    for (;;) {
      const stream = streamMessages({
        api,
        parsedChannelsByTopic,
        params: {
          ...(deviceId ? { deviceId } : { importId: importId! }),
          start: localStart,
          end: localEnd,
          topics: args.topics,
        },
      });

      for await (const messages of stream) {
        for (const message of messages) {
          yield { connectionId: undefined, msgEvent: message, problem: undefined };
        }
      }

      if (compare(localEnd, streamEnd) >= 0) {
        return;
      }

      localStart = addTime(localEnd, { sec: 0, nsec: 1 });

      // Assumes coverage regions are sorted by start time
      for (const coverage of this._coverage) {
        const end = fromRFC3339String(coverage.end);
        const start = fromRFC3339String(coverage.start);
        if (!start || !end) {
          continue;
        }

        // if localStart is in a coverage region, then allow this localStart to be used
        if (compare(localStart, start) >= 0 && compare(localStart, end) <= 0) {
          break;
        }

        // if localStart is completely before a coverage region then we reset the localStart to the
        // start of the coverage region. Since coverage regions are sorted by start time, if we get
        // here we know that localStart did not fall into a previous coverage region
        if (compare(localStart, end) <= 0 && compare(localStart, start) < 0) {
          localStart = start;
          log.debug("start is in a coverage gap, adjusting start to next coverage range", start);
          break;
        }
      }

      localStart = clampTime(localStart, streamStart, streamEnd);
      localEnd = clampTime(addTime(localStart, { sec: 5, nsec: 0 }), streamStart, streamEnd);
    }
  }

  public async getBackfillMessages({
    topics,
    time,
    abortSignal,
  }: GetBackfillMessagesArgs): Promise<MessageEvent<unknown>[]> {
    // Data platform treats topic array length 0 as "all topics". Until that is changed, we filter out
    // empty topic requests
    if (topics.length === 0) {
      return [];
    }

    if (!this._deviceId && !this._importId) {
      log.debug("source needs to be initialized");
      return [];
    }

    const messages: MessageEvent<unknown>[] = [];
    for await (const block of streamMessages({
      api: this._consoleApi,
      parsedChannelsByTopic: this._parsedChannelsByTopic,
      signal: abortSignal,
      params: {
        ...(this._deviceId ? { deviceId: this._deviceId } : { importId: this._importId! }),
        start: time,
        end: time,
        topics,
        replayPolicy: "lastPerChannel",
        replayLookbackSeconds: 30 * 60,
      },
    })) {
      messages.push(...block);
    }
    return messages;
  }
}
