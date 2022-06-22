// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DirectionalHint,
  IIconProps,
  IOverflowSetItemProps,
  OverflowSet,
  ResizeGroup,
  ResizeGroupDirection,
} from "@fluentui/react";
import { Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MosaicNode, MosaicWithoutDragDropContext } from "react-mosaic-component";
import { Transition } from "react-transition-group";

import { filterMap } from "@foxglove/den/collection";
import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import Stack from "@foxglove/studio-base/components/Stack";

import SidebarButton, { BUTTON_SIZE } from "./SidebarButton";
import { Badge } from "./types";

function Noop(): ReactNull {
  return ReactNull;
}

export type SidebarItem = {
  iconName: IIconProps["iconName"];
  title: string;
  badge?: Badge;
  component?: React.ComponentType;
  url?: string;
};

const SIDEBAR_TRANSITION_DURATION_MS = 300;

const useStyles = makeStyles((theme: Theme) => ({
  nav: {
    width: BUTTON_SIZE,
    boxSizing: "content-box",
    borderRight: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    zIndex: 2, // overlap mosaic border-left during transition
  },
  contentWrapper: {
    position: "relative",
    flex: "1 1 100%",
  },
  mosaicWrapper: {
    position: "absolute",
    inset: 0,
    borderLeft: `0px solid ${theme.palette.divider}`,

    // Root drop targets in this top level sidebar mosaic interfere with drag/mouse events from the
    // PanelList. We don't allow users to edit the mosaic since it's just used for the sidebar, so we
    // can hide the drop targets.
    "& > .mosaic > .drop-target-container": {
      display: "none !important",
    },
  },
  sidebarContentWrapper: {
    backgroundColor: theme.palette.background.paper,
    position: "absolute",
    inset: 0,
  },
  resizeGroup: {
    height: "100%",
    minHeight: 0,
  },
}));

// Determine initial sidebar width, with a cap for larger
// screens.
function defaultInitialSidebarPercentage() {
  const defaultFraction = 0.3;
  const width = Math.min(384, defaultFraction * window.innerWidth);
  return (100 * width) / window.innerWidth;
}

export default function Sidebar<K extends string>({
  children,
  items,
  bottomItems,
  selectedKey,
  onSelectKey,
}: React.PropsWithChildren<{
  items: Map<K, SidebarItem>;
  bottomItems: readonly K[];
  selectedKey: K | undefined;
  onSelectKey: (key: K | undefined) => void;
}>): JSX.Element {
  const classes = useStyles();

  const [splitPercentage, setSplitPercentage] = useState(() => defaultInitialSidebarPercentage());
  const lastSelectedKey = useRef(selectedKey);
  useEffect(() => {
    if (lastSelectedKey.current == undefined && selectedKey != undefined) {
      setSplitPercentage(defaultInitialSidebarPercentage());
    }
    lastSelectedKey.current = selectedKey;
  }, [selectedKey]);

  const mosaicValue: MosaicNode<"sidebar" | "children"> = useMemo(() => {
    if (selectedKey == undefined) {
      return "children";
    } else {
      return {
        direction: "row",
        first: "sidebar",
        second: "children",
        splitPercentage,
      };
    }
  }, [selectedKey, splitPercentage]);

  const onItemClick = useCallback(
    (key: K) => {
      if (selectedKey === key) {
        onSelectKey(undefined);
      } else {
        onSelectKey(key);
      }
    },
    [onSelectKey, selectedKey],
  );

  // Keep track of the last selected key so we can continue displaying the component during the exit transition
  const lastNonnullSelectedKey = useRef(selectedKey);
  useLayoutEffect(() => {
    if (selectedKey != undefined) {
      lastNonnullSelectedKey.current = selectedKey;
    }
  }, [selectedKey]);

  const keyToRender = selectedKey ?? lastNonnullSelectedKey.current;
  const SelectedComponent = (keyToRender != undefined && items.get(keyToRender)?.component) || Noop;

  type OverflowSetItem = IOverflowSetItemProps & { key: K };

  // Callbacks for OverflowSet
  const onRenderItem = useCallback(
    ({ key }: OverflowSetItem) => {
      const item = items.get(key);
      if (!item) {
        throw new Error(`Missing sidebar item ${key}`);
      }
      const { title, iconName } = item;
      return (
        <SidebarButton
          dataSidebarKey={key}
          key={key}
          selected={selectedKey === key}
          title={title}
          iconProps={{ iconName }}
          onClick={() => onItemClick(key)}
          badge={item.badge}
        />
      );
    },
    [items, onItemClick, selectedKey],
  );
  const onRenderOverflowButton = useCallback(
    (overflowItems?: OverflowSetItem[]) => {
      if (!overflowItems) {
        return ReactNull;
      }
      const overflowItemSelected = overflowItems.some(({ key }) => selectedKey === key);
      return (
        <SidebarButton
          dataSidebarKey="_overflow"
          selected={overflowItemSelected}
          title="More"
          iconProps={{ iconName: "MoreVertical" }}
          menuProps={{
            directionalHint: DirectionalHint.rightCenter,
            items: overflowItems.map(({ key }) => {
              const item = items.get(key as K);
              if (!item) {
                throw new Error(`Missing sidebar item ${key}`);
              }
              return {
                key,
                checked: selectedKey === key,
                canCheck: overflowItemSelected,
                text: item.title,
                iconProps: { iconName: item.iconName },
                onClick: () => onItemClick(key),
              };
            }),
          }}
        />
      );
    },
    [items, selectedKey, onItemClick],
  );

  // Data and callbacks for ResizeGroup
  type Data = { itemsToShow: number };
  const onRenderData = useCallback(
    ({ itemsToShow }: Data) => {
      const shownItems = filterMap(items.keys(), (key) =>
        bottomItems.includes(key) ? undefined : { key },
      );
      const overflowItems = shownItems.splice(itemsToShow);

      return (
        <OverflowSet
          vertical
          items={shownItems}
          overflowItems={overflowItems}
          onRenderItem={onRenderItem as (_: IOverflowSetItemProps) => unknown}
          onRenderOverflowButton={onRenderOverflowButton}
        />
      );
    },
    [items, bottomItems, onRenderItem, onRenderOverflowButton],
  );
  const numNonBottomItems = items.size - bottomItems.length;
  const onReduceData = useCallback(
    ({ itemsToShow }: Data) => (itemsToShow === 0 ? undefined : { itemsToShow: itemsToShow - 1 }),
    [],
  );
  const onGrowData = useCallback(
    ({ itemsToShow }: Data) =>
      itemsToShow >= numNonBottomItems ? undefined : { itemsToShow: itemsToShow + 1 },
    [numNonBottomItems],
  );

  const transitionNodeRef = useRef<HTMLDivElement>(ReactNull);

  // This state is set to true just *after* the Transition state turns to "exiting". This allows us
  // to make an exit transition before fully switching to the "exited" state (at which time we need
  // to remove the sidebar content from the DOM).
  const [afterExiting, setAfterExiting] = useState(false);
  const onExiting = useCallback(() => {
    // Force a repaint to allow transition to start immediately
    // See: https://github.com/reactjs/react-transition-group/blob/5007303e729a74be66a21c3e2205e4916821524b/src/CSSTransition.js#L208-L215
    void transitionNodeRef.current?.scrollTop;
    setAfterExiting(true);
  }, []);

  return (
    <Stack direction="row" fullHeight overflow="hidden">
      <Stack className={classes.nav} flexShrink={0} justifyContent="space-between">
        <ResizeGroup
          className={classes.resizeGroup}
          direction={ResizeGroupDirection.vertical}
          data={{ itemsToShow: numNonBottomItems }}
          onRenderData={onRenderData}
          onReduceData={onReduceData}
          onGrowData={onGrowData}
        />
        {bottomItems.map((key) => onRenderItem({ key }))}
      </Stack>
      {
        // By always rendering the mosaic, even if we are only showing children, we can prevent the
        // children from having to re-mount each time the sidebar is opened/closed.
      }
      <Transition
        nodeRef={transitionNodeRef}
        in={selectedKey != undefined}
        timeout={SIDEBAR_TRANSITION_DURATION_MS}
        onExiting={onExiting}
        onExited={() => setAfterExiting(false)}
      >
        {(state) => (
          <div className={classes.contentWrapper} ref={transitionNodeRef}>
            {state !== "exited" && (
              <div
                className={classes.sidebarContentWrapper}
                style={{
                  right: `${100 - splitPercentage}%`,
                  // Mosaic should be on top during transition (since it has a border that slightly
                  // overlaps the sidebar) but the sidebar needs to be clickable after the
                  // transition.
                  zIndex: state === "entered" ? 1 : undefined,
                  // Set a transform to create a stacking context so elements inside the sidebar
                  // with z-index don't escape outside the sidebar
                  transform: "scale(1)",
                }}
              >
                <ErrorBoundary>
                  <SelectedComponent />
                </ErrorBoundary>
              </div>
            )}
            <div
              className={classes.mosaicWrapper}
              style={{
                transition:
                  state === "entering" || afterExiting
                    ? `left ${SIDEBAR_TRANSITION_DURATION_MS}ms`
                    : undefined,
                left:
                  state === "entering" || (state === "exiting" && !afterExiting)
                    ? `calc(${splitPercentage}% - 2px)`
                    : state === "exiting"
                    ? -2
                    : 0,
                borderLeftWidth: state === "entering" || state === "exiting" ? 2 : 0,
              }}
            >
              <MosaicWithoutDragDropContext<"sidebar" | "children">
                className=""
                value={state === "entering" ? "children" : mosaicValue}
                onChange={(value) =>
                  typeof value === "object" &&
                  value != undefined &&
                  setSplitPercentage(value.splitPercentage ?? defaultInitialSidebarPercentage())
                }
                renderTile={(id) => (
                  <ErrorBoundary>
                    {id === "children"
                      ? (children as JSX.Element)
                      : // Don't actually render sidebar inside the mosaic -- it's always rendered outside
                        // to support the animated transition
                        ReactNull}
                  </ErrorBoundary>
                )}
                resize={{ minimumPaneSizePercentage: 10 }}
              />
            </div>
          </div>
        )}
      </Transition>
    </Stack>
  );
}
