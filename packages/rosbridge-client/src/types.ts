// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { EventNames, EventListener } from "eventemitter3";

type MessageServiceResponse = {
  op: "service_response";
  id: string;
  result: boolean;
  values: unknown;
  service: string;
};

type MessagePublish = {
  op: "publish";
  topic: string;
  msg: unknown;
};

type RosbridgeMessage = MessageServiceResponse | MessagePublish;

type TransportEventTypes = {
  open: () => void;
  error: (error: Error) => void;
  close: () => void;
  message: (event: RosbridgeMessage) => void;
};

interface ITransport {
  on<E extends EventNames<TransportEventTypes>>(
    name: E,
    listener: EventListener<TransportEventTypes, E>,
  ): void;
  off<E extends EventNames<TransportEventTypes>>(
    name: E,
    listener: EventListener<TransportEventTypes, E>,
  ): void;

  close(): void;
  send(data: string | Uint8Array): void;
}

export type { ITransport, TransportEventTypes, RosbridgeMessage };
