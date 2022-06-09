// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext } from "react";

import useGuaranteedContext from "@foxglove/studio-base/hooks/useGuaranteedContext";
import { ILayoutManager } from "@foxglove/studio-base/services/ILayoutManager";
import { Layout } from "@foxglove/studio-base/services/ILayoutStorage";

type LayoutsContext = {
  cachedLayouts: readonly Layout[];
  layoutManager: ILayoutManager;
  reloadLayouts: () => Promise<void>;
};

const LayoutManagerContext = createContext<LayoutsContext | undefined>(undefined);
LayoutManagerContext.displayName = "LayoutManagerContext";

export function useLayoutManager(): ILayoutManager {
  return useGuaranteedContext(LayoutManagerContext).layoutManager;
}

export function useCachedLayouts(): readonly Layout[] {
  return useGuaranteedContext(LayoutManagerContext).cachedLayouts;
}

export function useReloadLayouts(): () => Promise<void> {
  return useGuaranteedContext(LayoutManagerContext).reloadLayouts;
}

export default LayoutManagerContext;
