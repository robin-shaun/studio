/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook } from "@testing-library/react-hooks";
import fs from "fs";
import JSZip from "jszip";
import { PropsWithChildren } from "react";

import { useExtensionCatalog } from "@foxglove/studio-base/context/ExtensionCatalogContext";
import ExtensionCatalogProvider from "@foxglove/studio-base/providers/ExtensionCatalogProvider";
import { ExtensionLoader } from "@foxglove/studio-base/services/ExtensionLoader";

async function loadTestExtension() {
  const foxe = fs.readFileSync(
    `${__dirname}/../test/fixtures/foxglove.basic-script-extension-1.0.0.foxe`,
  );
  const zip = new JSZip();
  const content = await zip.loadAsync(foxe);
  return await content.file("dist/extension.js")?.async("string");
}

describe("Extension catalog", () => {
  const mockLoader = {
    namespace: "org",
    getExtensions: jest.fn().mockReturnValue([
      {
        namespace: "org",
        qualifiedName: "test",
      },
    ]),
    loadExtension: jest.fn().mockResolvedValue(loadTestExtension()),
    installExtension: jest.fn(),
    uninstallExtension: jest.fn(),
  };

  function Wrapper({ children }: PropsWithChildren<void>): JSX.Element {
    return (
      <ExtensionCatalogProvider loaders={[mockLoader as ExtensionLoader]}>
        {children}
      </ExtensionCatalogProvider>
    );
  }

  it("Registers extension panels", async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useExtensionCatalog((store) => store.installedPanels),
      { wrapper: Wrapper },
    );

    await waitForNextUpdate();

    expect(result.current).toStrictEqual({
      "test.example-panel": {
        extensionName: "test",
        extensionNamespace: "org",
        registration: expect.any(Object),
      },
    });
  });

  it("Registers extension scripts", async () => {
    const { result, waitForNextUpdate } = renderHook(
      () => useExtensionCatalog((store) => store.installedScripts),
      { wrapper: Wrapper },
    );

    await waitForNextUpdate();

    expect(result.current).toStrictEqual({
      "test.test-extension-script": {
        extensionName: "test",
        extensionNamespace: "org",
        registration: {
          id: "test-extension-script",
          displayName: "Test Extension Script",
          source: expect.any(String),
          description: "A test extension script",
        },
      },
    });
  });
});
