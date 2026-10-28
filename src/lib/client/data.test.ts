import { describe, expect, it } from "vitest";
import { formatPrice } from "./data";

describe("formatPrice", () => {
  it("만원 단위를 억·만으로 읽기 쉽게 바꾼다", () => {
    expect(formatPrice(123500)).toBe("12억 3,500");
    expect(formatPrice(90000)).toBe("9억");
    expect(formatPrice(8500)).toBe("8,500만");
    expect(formatPrice(null)).toBe("—");
    expect(formatPrice(-25000)).toBe("-2억 5,000");
  });
});
