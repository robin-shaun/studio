// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton } from "@mui/material";
import { useLayoutEffect, useState } from "react";

import { PanelExtensionContext } from "@foxglove/studio";
import Stack from "@foxglove/studio-base/components/Stack";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";

type HoverValuePanelProps = {
  context: PanelExtensionContext;
};

export default function HoverValuePanel(props: HoverValuePanelProps): JSX.Element {
  const { context } = props;

  // setup context render handler and render done handling
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});
  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");

  useLayoutEffect(() => {
    context.watch("topics");
    context.watch("colorScheme");

    context.onRender = (renderState, done) => {
      setRenderDone(() => done);
      if (renderState.colorScheme) {
        setColorScheme(renderState.colorScheme);
      }
    };
  }, [context]);

  useLayoutEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack
        fullHeight
        alignItems="center"
        overflowY="auto"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto" }}
      >
        {Array(10)
          .fill({})
          .map((i, idx) => (
            <div key={idx} style={{ display: "contents" }}>
              <div>{idx}</div>
              <div>key</div>
              <div>value</div>
              <IconButton>•••</IconButton>
            </div>
          ))}
      </Stack>
    </ThemeProvider>
  );
}
