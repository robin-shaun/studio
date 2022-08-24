// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { EventEmitter2 } from "eventemitter2";

import { ITransport } from "./types";

type ServiceCallArgs = {
  name: string;
  serviceType: string;
  payload?: unknown;
};

type ActionServersResponse = {
  action_servers: string[];
};

type TopicsForTypeResponse = {
  topics: string[];
};

type ServicesResponse = {
  services: string[];
};

type NodesResponse = {
  nodes: string[];
};

type GetParamNamesResponse = {
  names: string[];
};

type TopicTypeResponse = {
  type: string;
};

type ServiceTypeResponse = {
  type: string;
};

type MessageDetailsResponse = {
  typedefs: string;
};

/**
 * Manages connection to the server and all interactions with ROS.
 *
 * Emits the following events:
 *  * 'error' - there was an error with ROS
 *  * 'connection' - connected to the WebSocket server
 *  * 'close' - disconnected to the WebSocket server
 *  * <topicName> - a message came from rosbridge with the given topic name
 *  * <serviceID> - a service response came from rosbridge with the given ID
 *
 * @constructor
 * @param options - possible keys include: <br>
 *   * url (optional) - (can be specified later with `connect`) the WebSocket URL for rosbridge or the node server url to connect using socket.io (if socket.io exists in the page) <br>
 *   * transportLibrary (optional) - one of 'websocket', 'workersocket' (default), 'socket.io' or RTCPeerConnection instance controlling how the connection is created in `connect`.
 *   * transportOptions (optional) - the options to use use when creating a connection. Currently only used if `transportLibrary` is RTCPeerConnection.
 */
class Ros extends EventEmitter2 {
  private transport: ITransport;
  private idCounter = 0;
  private isConnected = false;

  public constructor(transport: ITransport) {
    super();

    this.transport = transport;

    // Sets unlimited event listeners.
    this.setMaxListeners(0);
  }

  /**
   * Close the client and transport
   */
  public close(): void {
    this.transport.close();
  }

  public sendEncodedMessage(msg: string | Uint8Array): void {
    // fixme - wait for onconnection?
    if (!this.isConnected) {
      throw new Error("not connected");
    }

    this.transport.send(msg);
  }

  /**
   * Retrieves Action Servers in ROS as an array of string
   */
  public async getActionServers(): Promise<ActionServersResponse["action_servers"]> {
    const result = await this.callService<ActionServersResponse>({
      name: "/rosapi/action_servers",
      serviceType: "rosapi/GetActionServers",
    });

    return result.action_servers;
  }

  /**
   * Retrieves list of topics in ROS as an array.
   */
  public async getTopics(): Promise<string[]> {
    return await this.callService<string[]>({
      name: "/rosapi/topics",
      serviceType: "rosapi/Topics",
    });
  }

  /**
   * Retrieves Topics in ROS as an array as specific type
   *
   * @param topicType topic type to find
   */
  public async getTopicsForType(topicType: string): Promise<string[]> {
    const result = await this.callService<TopicsForTypeResponse>({
      name: "/rosapi/topics_for_type",
      serviceType: "rosapi/TopicsForType",
      payload: {
        type: topicType,
      },
    });

    return result.topics;
  }

  /**
   * Retrieves list of active service names in ROS.
   */
  public async getServices(): Promise<unknown> {
    const result = await this.callService<ServicesResponse>({
      name: "/rosapi/services",
      serviceType: "rosapi/Services",
    });

    return result.services;
  }

  /**
   * Retrieves list of services in ROS as an array as specific type
   *
   * @param serviceType service type to find
   */
  public async getServicesForType(serviceType: string): Promise<unknown> {
    const result = await this.callService<ServicesResponse>({
      name: "/rosapi/services_for_type",
      serviceType: "rosapi/ServicesForType",
      payload: {
        type: serviceType,
      },
    });

    return result.services;
  }

  /**
   * Retrieves a detail of ROS service request.
   *
   * @param service name of service
   */
  public async getServiceRequestDetails(type: string): Promise<unknown> {
    return await this.callService({
      name: "/rosapi/service_request_details",
      serviceType: "rosapi/ServiceRequestDetails",
      payload: {
        type,
      },
    });
  }

  /**
   * Retrieves a detail of ROS service request.
   *
   * @param service name of service
   */
  public async getServiceResponseDetails(type: string): Promise<unknown> {
    return await this.callService({
      name: "/rosapi/service_response_details",
      serviceType: "rosapi/ServiceResponseDetails",
      payload: {
        type,
      },
    });
  }

  /**
   * Retrieves list of active node names in ROS.
   */
  public async getNodes(): Promise<unknown> {
    const result = await this.callService<NodesResponse>({
      name: "/rosapi/nodes",
      serviceType: "rosapi/Nodes",
    });

    return result.nodes;
  }

  /**
   * Retrieves list subscribed topics, publishing topics and services of a specific node
   *
   * @param node name of the node
   */
  public async getNodeDetails(node: string): Promise<unknown> {
    return await this.callService({
      name: "/rosapi/node_details",
      serviceType: "rosapi/NodeDetails",
      payload: {
        node,
      },
    });
  }

  /**
   * Retrieves list of param names from the ROS Parameter Server.
   */
  public async getParams(): Promise<GetParamNamesResponse["names"]> {
    const result = await this.callService<GetParamNamesResponse>({
      name: "/rosapi/get_param_names",
      serviceType: "rosapi/GetParamNames",
    });

    return result.names;
  }

  /**
   * Retrieves a type of ROS topic.
   *
   * @param topic name of the topic
   */
  public async getTopicType(topic: string): Promise<string> {
    const result = await this.callService<TopicTypeResponse>({
      name: "/rosapi/topic_type",
      serviceType: "rosapi/TopicType",
      payload: {
        topic,
      },
    });

    return result.type;
  }

  /**
   * Retrieves a type of ROS service.
   *
   * @param service name of service:
   */
  public async getServiceType(service: string): Promise<string> {
    const result = await this.callService<ServiceTypeResponse>({
      name: "/rosapi/service_type",
      serviceType: "rosapi/ServiceType",
      payload: {
        service,
      },
    });

    return result.type;
  }

  /**
   * Retrieves a detail of ROS message.
   *
   * @param message - String of a topic type
   */
  public async getMessageDetails(message: string): Promise<unknown> {
    const result = await this.callService<MessageDetailsResponse>({
      name: "/rosapi/message_details",
      serviceType: "rosapi/MessageDetails",
      payload: {
        type: message,
      },
    });

    return result.typedefs;
  }

  /**
   * Retrieves list of topics and their associated type definitions.
   */
  public async getTopicsAndRawTypes(): Promise<unknown> {
    return await this.callService({
      name: "/rosapi/topics_and_raw_types",
      serviceType: "rosapi/TopicsAndRawTypes",
    });
  }

  private async callService<T = unknown>(args: ServiceCallArgs): Promise<T> {
    const serviceCallId = `call_service:${args.name}:${++this.idCounter}`;

    const result = new Promise((resolve, reject) => {
      // fixme - transport?
      this.once(serviceCallId, (message) => {
        if (message.result != undefined && message.result === false) {
          reject(message.values);
        } else {
          resolve(message.values);
        }
      });
    });

    const call = {
      op: "call_service",
      id: serviceCallId,
      service: args.name,
      type: args.serviceType,
      args: args.payload,
    };

    this.sendEncodedMessage(JSON.stringify(call));

    return (await result) as T;
  }
}

export { Ros };
