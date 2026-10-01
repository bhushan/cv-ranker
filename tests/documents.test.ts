import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { extractDocument } from "../lib/documents/extraction";
import { arrangePdfLines } from "../lib/documents/extraction";
import { validateDocument } from "../lib/documents/validation";
describe("server-side extraction", () => {
  it("rejects ordinary ZIPs renamed DOCX and excessive declared expansion", async () => {
    const bytes = await readFile("tests/fixtures/cv.docx");
    const renamed = Buffer.from(bytes);
    for (let offset = 0; offset < renamed.length - 46; offset++)
      if (renamed.readUInt32LE(offset) === 0x02014b50) {
        const size = renamed.readUInt16LE(offset + 28);
        renamed.fill(0x78, offset + 46, offset + 46 + size);
      }
    expect(() => validateDocument("cv.docx", renamed)).toThrow();
    const oversized = Buffer.from(bytes);
    const central = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    oversized.writeUInt32LE(40 * 1024 * 1024, central + 24);
    expect(() => validateDocument("cv.docx", oversized)).toThrow();
  });
  it("rejects encrypted ZIP entries before parsing", async () => {
    const bytes = Buffer.from(await readFile("tests/fixtures/cv.docx"));
    const central = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt16LE(1, central + 8);
    expect(() => validateDocument("cv.docx", bytes)).toThrow();
  });
  it("rejects dishonest expansion sizes and ZIP64 metadata", async () => {
    const original = await readFile("tests/fixtures/cv.docx");
    const central = original.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    const dishonest = Buffer.from(original);
    dishonest.writeUInt32LE(1, central + 24);
    expect(() => validateDocument("cv.docx", dishonest)).toThrow();
    const zip64 = Buffer.from(original);
    zip64.writeUInt32LE(0xffffffff, central + 24);
    expect(() => validateDocument("cv.docx", zip64)).toThrow();
  });
  it("orders PDF header before body despite PDF stream draw order", () => {
    expect(
      arrangePdfLines([
        { str: "Experience", transform: [1, 0, 0, 1, 50, 500] },
        { str: "Priya Sharma", transform: [1, 0, 0, 1, 50, 750] },
        { str: "Built a product", transform: [1, 0, 0, 1, 50, 470] },
      ]),
    ).toBe("Priya Sharma\nExperience\nBuilt a product");
  });
  it("extracts readable PDF text with page markers", async () => {
    const text = await extractDocument(
      "cv.pdf",
      await readFile("tests/fixtures/cv.pdf"),
    );
    expect(text).toContain("[Page 1]");
    expect(text).toContain("Built a product");
  });
  it("extracts DOCX paragraphs and table content", async () => {
    const text = await extractDocument(
      "cv.docx",
      await readFile("tests/fixtures/cv.docx"),
    );
    expect(text).toContain("Built a product");
    expect(text).toContain("Revenue increased 35%");
  });
  it("returns structured parsing failure for broken archive", async () => {
    await expect(
      extractDocument("cv.docx", Buffer.from([0x50, 0x4b, 3, 4, 0])),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
  });
});
