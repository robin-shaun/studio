// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

var WebSocket = WebSocket || require("ws");

module.exports = function (self) {
  let socket = null;

  function handleSocketMessage(ev) {
    const data = ev.data;

    if (data instanceof ArrayBuffer) {
      // binary message, transfer for speed
      self.postMessage(data, [data]);
    } else {
      // JSON message, copy string
      self.postMessage(data);
    }
  }

  function handleSocketControl(ev) {
    self.postMessage({ type: ev.type });
  }

  self.addEventListener("message", (ev) => {
    const data = ev.data;

    if (typeof data === "string") {
      // JSON message from ROSLIB
      socket.send(data);
    } else {
      // control message
      if (data.hasOwnProperty("uri")) {
        const uri = data.uri;

        socket = new WebSocket(uri);
        socket.binaryType = "arraybuffer";

        socket.onmessage = handleSocketMessage;
        socket.onclose = handleSocketControl;
        socket.onopen = handleSocketControl;
        socket.onerror = handleSocketControl;
      } else {
        throw "Unknown message to WorkerSocket";
      }
    }
  });
};
