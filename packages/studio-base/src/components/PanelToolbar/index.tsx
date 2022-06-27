// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { CSSProperties } from "react";

export const PANEL_TOOLBAR_MIN_HEIGHT = 30;

type Props = {
  additionalIcons?: React.ReactNode;
  backgroundColor?: CSSProperties["backgroundColor"];
  children?: React.ReactNode;
  // Keeping this prop for now in case we decide to expose it via some other mechanism
  // like a context menu item.
  helpContent?: React.ReactNode;
  isUnknownPanel?: boolean;
};

// Panel toolbar should be added to any panel that's part of the
// react-mosaic layout.  It adds a drag handle, remove/replace controls
// and has a place to add custom controls via it's children property
export default React.memo<Props>(function PanelToolbar() {
  return <></>;
});
