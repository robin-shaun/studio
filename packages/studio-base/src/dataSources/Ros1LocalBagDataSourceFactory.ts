// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IDataSourceFactory,
  DataSourceFactoryInitializeArgs,
} from "@foxglove/studio-base/context/PlayerSelectionContext";
import { IterablePlayer, WorkerIterablePlayer } from "@foxglove/studio-base/players/IterablePlayer";
import { BagIterableSource } from "@foxglove/studio-base/players/IterablePlayer/BagIterableSource";
import { Player } from "@foxglove/studio-base/players/types";

class Ros1LocalBagDataSourceFactory implements IDataSourceFactory {
  public id = "ros1-local-bagfile";
  public type: IDataSourceFactory["type"] = "file";
  public displayName = "ROS 1 Bag";
  public iconName: IDataSourceFactory["iconName"] = "OpenFile";
  public supportedFileTypes = [".bag"];

  // fixme - feature flag
  private _enableExperimentalWorker = true;

  public initialize(args: DataSourceFactoryInitializeArgs): Player | undefined {
    if (this._enableExperimentalWorker) {
      return new WorkerIterablePlayer({
        sourceType: "rosbag",
        sourceId: this.id,
        factoryArgs: args,
      });
    }

    const file = args.file;
    if (!file) {
      return;
    }

    const bagSource = new BagIterableSource({ type: "file", file });
    return new IterablePlayer({
      metricsCollector: args.metricsCollector,
      source: bagSource,
      name: file.name,
      sourceId: this.id,
    });
  }
}

export default Ros1LocalBagDataSourceFactory;
