// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CBOR from "cbor-js";
import { EventEmitter, EventNames, EventListener } from "eventemitter3";

import { cborTypedArrayTagger as typedArrayTagger } from "./cborTypedArrayTags";
import { ITransport, RosbridgeMessage, TransportEventTypes } from "./types";

class WebsocketTransport implements ITransport {
  private socket: WebSocket;
  private emitter = new EventEmitter<TransportEventTypes>();

  public constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = () => {
      this.emitter.emit("open");
    };
    this.socket.onerror = () => {
      this.emitter.emit("error", new Error("websocket error"));
    };
    this.socket.onclose = () => {
      this.emitter.emit("close");
    };

    this.socket.onmessage = (msg) => {
      if (typeof msg === "string") {
        this.handleMessage(JSON.parse(msg));
      } else if (msg.data instanceof ArrayBuffer) {
        const decoded = CBOR.decode(msg.data, typedArrayTagger);
        this.handleMessage(decoded);
      } else {
        this.handleMessage(JSON.parse(msg.data));
      }
    };
  }

  public on<E extends EventNames<TransportEventTypes>>(
    name: E,
    listener: EventListener<TransportEventTypes, E>,
  ): void {
    this.emitter.on(name, listener);
  }

  public off<E extends EventNames<TransportEventTypes>>(
    name: E,
    listener: EventListener<TransportEventTypes, E>,
  ): void {
    this.emitter.off(name, listener);
  }

  public close(): void {
    this.socket.close();
  }

  public send(data: string | Uint8Array): void {
    this.socket.send(data);
  }

  private handleMessage(data: unknown): void {
    this.emitter.emit("message", data as RosbridgeMessage);
  }
}

export { WebsocketTransport };
