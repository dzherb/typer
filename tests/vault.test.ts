import { describe, expect, test } from "bun:test";

import { NEW_NOTE, Vault } from "../src/storage/vault.ts";
import { FakeFolder } from "./fake-folder.ts";

function vaultWith(files: Record<string, string> = {}): { folder: FakeFolder; vault: Vault } {
  const folder = new FakeFolder(files);
  return { folder, vault: new Vault(folder.handle()) };
}

const day = new Date(2026, 8, 7);

describe("creating", () => {
  test("a new note is named after the day and opens on a heading marker", async () => {
    const { folder, vault } = vaultWith();
    const note = await vault.create(day);

    expect(note.name).toBe("2026-09-07.md");
    expect(note.text).toBe(NEW_NOTE);
    expect(folder.textOf("2026-09-07.md")).toBe(NEW_NOTE);
  });

  test("a second note the same day is -2, and a third -3", async () => {
    const { vault } = vaultWith();

    expect((await vault.create(day)).name).toBe("2026-09-07.md");
    expect((await vault.create(day)).name).toBe("2026-09-07-2.md");
    expect((await vault.create(day)).name).toBe("2026-09-07-3.md");
  });
});

describe("reading the folder", () => {
  test("lists the notes newest first", async () => {
    const { vault } = vaultWith();
    await vault.write("old.md", "# Old");
    await vault.write("new.md", "# New");

    expect((await vault.load()).map((note) => note.name)).toEqual(["new.md", "old.md"]);
  });

  test("takes each note's title from its text", async () => {
    const { vault } = vaultWith({ "2026-09-07-monday.md": "# Monday\n\nnotes" });
    const [note] = await vault.load();

    expect(note?.title).toBe("Monday");
  });

  test("ignores what is not a note", async () => {
    const { vault } = vaultWith({
      "note.md": "# Note",
      "photo.png": "",
      ".hidden.md": "# Hidden",
    });

    expect((await vault.load()).map((note) => note.name)).toEqual(["note.md"]);
  });
});

describe("writing", () => {
  test("says when the file was last touched, and when it is gone", async () => {
    const { vault } = vaultWith();
    const modified = await vault.write("a.md", "text");

    expect(await vault.modifiedAt("a.md")).toBe(modified);
    expect(await vault.modifiedAt("missing.md")).toBeNull();
  });

  test("exists answers for both", async () => {
    const { vault } = vaultWith({ "a.md": "" });

    expect(await vault.exists("a.md")).toBe(true);
    expect(await vault.exists("b.md")).toBe(false);
  });

  test("removing is permanent", async () => {
    const { folder, vault } = vaultWith({ "a.md": "" });
    await vault.remove("a.md");

    expect(folder.names()).toEqual([]);
  });
});

describe("renaming", () => {
  test("carries the text over and takes the old name off disk", async () => {
    const { folder, vault } = vaultWith({ "a.md": "# A" });

    expect(await vault.rename("a.md", "b.md")).toBe("b.md");
    expect(folder.names()).toEqual(["b.md"]);
    expect(folder.textOf("b.md")).toBe("# A");
  });

  test("a name already taken is uniquified rather than overwritten", async () => {
    const { folder, vault } = vaultWith({ "a.md": "# A", "b.md": "# B" });

    expect(await vault.rename("a.md", "b.md")).toBe("b-2.md");
    expect(folder.textOf("b.md")).toBe("# B");
    expect(folder.textOf("b-2.md")).toBe("# A");
  });

  test("renaming a note to its own name is nothing at all", async () => {
    const { folder, vault } = vaultWith({ "a.md": "# A" });

    expect(await vault.rename("a.md", "a.md")).toBe("a.md");
    expect(folder.names()).toEqual(["a.md"]);
  });
});

describe("settling a provisional name", () => {
  test("gives the note its title, under the date it was created", async () => {
    const { folder, vault } = vaultWith({ "2026-09-07.md": "# Первая заметка\n\nтекст" });

    expect(await vault.settleName("2026-09-07.md", "# Первая заметка\n\nтекст")).toBe(
      "2026-09-07-pervaya-zametka.md",
    );
    expect(folder.names()).toEqual(["2026-09-07-pervaya-zametka.md"]);
  });

  test("waits until the title line has been left behind", async () => {
    const { vault } = vaultWith({ "2026-09-07.md": "# Half a headin" });

    expect(await vault.settleName("2026-09-07.md", "# Half a headin")).toBe("2026-09-07.md");
  });

  test("a note that already carries a slug is never renamed again", async () => {
    const text = "# A different title\n\nnotes";
    const { vault } = vaultWith({ "2026-09-07-first.md": text });

    expect(await vault.settleName("2026-09-07-first.md", text)).toBe("2026-09-07-first.md");
  });

  test("a title that slugifies to nothing leaves the name alone", async () => {
    const { vault } = vaultWith({ "2026-09-07.md": "# ???\n\nnotes" });

    expect(await vault.settleName("2026-09-07.md", "# ???\n\nnotes")).toBe("2026-09-07.md");
  });

  test("two notes settling on the same title do not collide", async () => {
    const text = "# Monday\n\nnotes";
    const { vault } = vaultWith({ "2026-09-07.md": text, "2026-09-07-2.md": text });

    expect(await vault.settleName("2026-09-07.md", text)).toBe("2026-09-07-monday.md");
    expect(await vault.settleName("2026-09-07-2.md", text)).toBe("2026-09-07-monday-2.md");
  });
});
