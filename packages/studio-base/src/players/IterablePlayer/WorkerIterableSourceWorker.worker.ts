// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as Comlink from "comlink";

import { iterableTransferHandler } from "@foxglove/comlink-transfer-handlers";
import { MessageEvent } from "@foxglove/studio";

import type {
  GetBackfillMessagesArgs,
  IIterableSource,
  Initalization,
  IterableSourceInitializeArgs,
  IteratorResult,
  MessageIteratorArgs,
} from "./IIterableSource";

type SourceFn = () => Promise<{
  initialize: (args: IterableSourceInitializeArgs) => IIterableSource;
}>;

const RegisteredSourceModuleLoaders: Record<string, SourceFn> = {
  mcap: async () => await import("./Mcap/McapIterableSource"),
  rosbag: async () => await import("./BagIterableSource"),
};

export type WorkerIterableSourceWorkerArgs = {
  sourceType: string;
  initArgs: IterableSourceInitializeArgs;
};

export class WorkerIterableSourceWorker implements IIterableSource {
  private _source?: IIterableSource;
  private _args: WorkerIterableSourceWorkerArgs;

  public constructor(args: WorkerIterableSourceWorkerArgs) {
    this._args = args;
  }

  public async initialize(): Promise<Initalization> {
    const loadRegisteredSourceModule = RegisteredSourceModuleLoaders[this._args.sourceType];
    if (!loadRegisteredSourceModule) {
      throw new Error(`No source for type: ${this._args.sourceType}`);
    }
    const module = await loadRegisteredSourceModule();
    this._source = module.initialize(this._args.initArgs);
    return await this._source.initialize();
  }

  public messageIterator(
    args: MessageIteratorArgs,
  ): AsyncIterableIterator<Readonly<IteratorResult>> {
    if (!this._source) {
      throw new Error("uninitialized");
    }
    return this._source.messageIterator(args);
  }

  public async getBackfillMessages(
    args: GetBackfillMessagesArgs,
  ): Promise<MessageEvent<unknown>[]> {
    if (!this._source) {
      throw new Error("uninitialized");
    }
    return await this._source.getBackfillMessages(args);
  }
}

Comlink.transferHandlers.set("iterable", iterableTransferHandler);
Comlink.expose(WorkerIterableSourceWorker);
