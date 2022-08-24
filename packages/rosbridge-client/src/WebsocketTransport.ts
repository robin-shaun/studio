// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CBOR from "cbor-js";

import { cborTypedArrayTagger as typedArrayTagger } from "./cborTypedArrayTags";
import { ITransport } from "./types";

class WebsocketTransport implements ITransport {
  private socket: WebSocket;

  public constructor(url: string) {
    this.socket = new WebSocket(url);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = (event) => {
      this.emit("connection", event);
    };
    this.socket.onerror = (err) => {
      this.emit("error", err);
    };
    this.socket.onclose = () => {
      this.emit("close", event);
    };

    this.socket.onmessage = (msg) => {
      if (typeof msg === "string") {
        this.handleMessage(JSON.parse(msg));
      }
      if (msg.data instanceof ArrayBuffer) {
        const decoded = CBOR.decode(msg.data, typedArrayTagger);
        this.handleMessage(decoded);
      } else {
        this.handleMessage(JSON.parse(msg.data));
      }
    };
  }

  public close(): void {
    this.socket.close();
  }

  public send(data: string | Uint8Array): void {
    this.socket.send(data);
  }

  private handleMessage(data: unknown): void {
    if (message.op === "publish") {
      this.emit(message.topic, message.msg);
    } else if (message.op === "service_response") {
      this.emit(message.id, message);
    } else if (message.op === "call_service") {
      this.emit(message.service, message);
    } else if (message.op === "status") {
      if (message.id) {
        client.emit("status:" + message.id, message);
      } else {
        client.emit("status", message);
      }
    }
  }
}

export { WebsocketTransport };
