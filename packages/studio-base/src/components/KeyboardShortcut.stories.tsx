// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import KeyboardShortcut from "./KeyboardShortcut";

export default {
  title: "components/KeyboardShortcut",
  component: KeyboardShortcut,
};

export function Basic(): JSX.Element {
  return (
    <div style={{ padding: 8 }}>
      <KeyboardShortcut description="Toggle visibility" keys={["Enter"]} />
      <KeyboardShortcut description="Copy all" keys={["Shift", "Option", "V"]} />
    </div>
  );
}
