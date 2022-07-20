// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";
import { StoreApi, useStore } from "zustand";

import { ExtensionPanelRegistration, ExtensionScriptRegistration } from "@foxglove/studio";
import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { ExtensionInfo, ExtensionNamespace } from "@foxglove/studio-base/types/Extensions";

type ExtensionResource = {
  extensionName: string;
  extensionNamespace?: ExtensionNamespace;
};

export type RegisteredPanel = ExtensionResource & {
  registration: ExtensionPanelRegistration;
};

export type RegisteredScript = ExtensionResource & {
  registration: ExtensionScriptRegistration;
};

export type ExtensionCatalog = {
  downloadExtension: (url: string) => Promise<Uint8Array>;
  installExtension: (
    namespace: ExtensionNamespace,
    foxeFileData: Uint8Array,
  ) => Promise<ExtensionInfo>;
  loadExtension(id: string): Promise<string>;
  refreshExtensions: () => Promise<void>;
  uninstallExtension: (namespace: ExtensionNamespace, id: string) => Promise<void>;

  installedExtensions: undefined | ExtensionInfo[];
  installedPanels: undefined | Record<string, RegisteredPanel>;
  installedScripts: undefined | Record<string, RegisteredScript>;
};

export const ExtensionCatalogContext = createContext<undefined | StoreApi<ExtensionCatalog>>(
  undefined,
);

export function useExtensionCatalog<T>(
  selector: (registry: ExtensionCatalog) => T,
  equalityFn?: (a: T, b: T) => boolean,
): T {
  const context = useGuaranteedContext(ExtensionCatalogContext);
  return useStore(context, selector, equalityFn);
}
