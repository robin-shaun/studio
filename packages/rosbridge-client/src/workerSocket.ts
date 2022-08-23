// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

try {
  var work = require("webworkify");
} catch (ReferenceError) {
  // webworkify raises ReferenceError when required inside webpack
  var work = require("webworkify-webpack");
}
const workerSocketImpl = require("./workerSocketImpl");

function WorkerSocket(uri) {
  this.socket_ = work(workerSocketImpl);

  this.socket_.addEventListener("message", this.handleWorkerMessage_.bind(this));

  this.socket_.postMessage({
    uri,
  });
}

WorkerSocket.prototype.handleWorkerMessage_ = function (ev) {
  const data = ev.data;
  if (data instanceof ArrayBuffer || typeof data === "string") {
    // binary or JSON message from rosbridge
    this.onmessage(ev);
  } else {
    // control message from the wrapped WebSocket
    const type = data.type;
    if (type === "close") {
      this.onclose(null);
    } else if (type === "open") {
      this.onopen(null);
    } else if (type === "error") {
      this.onerror(null);
    } else {
      throw "Unknown message from workersocket";
    }
  }
};

WorkerSocket.prototype.send = function (data) {
  this.socket_.postMessage(data);
};

WorkerSocket.prototype.close = function () {
  this.socket_.terminate();
};

module.exports = WorkerSocket;
