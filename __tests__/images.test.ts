import { describe, expect, it } from "vitest";
import { sniffImage } from "@/lib/images";

describe("détection du type d'image", () => {
  it("reconnaît JPEG, PNG, WebP par leurs octets", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("png");
    expect(sniffImage(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("webp");
  });
  it("refuse le reste (un HTML renommé en .jpg)", () => {
    expect(sniffImage(new TextEncoder().encode("<html><script>"))).toBeNull();
  });
});
