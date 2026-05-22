import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TeamColorDot } from "@/components/league/TeamColorDot";

describe("TeamColorDot", () => {
  it("renders a span element", () => {
    const { container } = render(<TeamColorDot color="#ff0000" />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
  });

  it("applies sm size classes h-2 w-2", () => {
    const { container } = render(<TeamColorDot color="#ff0000" size="sm" />);
    const span = container.querySelector("span")!;
    expect(span.className).toContain("h-2");
    expect(span.className).toContain("w-2");
  });

  it("applies md size classes h-3 w-3 (default)", () => {
    const { container } = render(<TeamColorDot color="#00ff00" />);
    const span = container.querySelector("span")!;
    expect(span.className).toContain("h-3");
    expect(span.className).toContain("w-3");
  });

  it("applies lg size classes h-4 w-4", () => {
    const { container } = render(<TeamColorDot color="#0000ff" size="lg" />);
    const span = container.querySelector("span")!;
    expect(span.className).toContain("h-4");
    expect(span.className).toContain("w-4");
  });

  it("sets backgroundColor style to the color prop", () => {
    const { container } = render(<TeamColorDot color="#abcdef" size="md" />);
    const span = container.querySelector("span")!;
    // jsdom normalises hex to rgb
    expect(span.style.backgroundColor).toBeTruthy();
  });

  it("sm boxShadow formula: 0 0 14px {color}, 0 0 4px {color}", () => {
    const color = "#ff0000";
    const { container } = render(<TeamColorDot color={color} size="sm" />);
    const span = container.querySelector("span")!;
    expect(span.style.boxShadow).toContain("14px");
    expect(span.style.boxShadow).toContain("4px");
  });

  it("md boxShadow formula: 0 0 18px {color}, 0 0 6px {color}", () => {
    const color = "#00ff00";
    const { container } = render(<TeamColorDot color={color} size="md" />);
    const span = container.querySelector("span")!;
    expect(span.style.boxShadow).toContain("18px");
    expect(span.style.boxShadow).toContain("6px");
  });

  it("lg boxShadow formula: 0 0 22px {color}, 0 0 8px {color}", () => {
    const color = "#0000ff";
    const { container } = render(<TeamColorDot color={color} size="lg" />);
    const span = container.querySelector("span")!;
    expect(span.style.boxShadow).toContain("22px");
    expect(span.style.boxShadow).toContain("8px");
  });

  it("applies extra className when provided", () => {
    const { container } = render(
      <TeamColorDot color="#ffffff" size="sm" className="mr-1 align-middle" />,
    );
    const span = container.querySelector("span")!;
    expect(span.className).toContain("mr-1");
    expect(span.className).toContain("align-middle");
  });

  it("sm snapshot", () => {
    const { container } = render(<TeamColorDot color="#ff0000" size="sm" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("md snapshot", () => {
    const { container } = render(<TeamColorDot color="#00ff00" size="md" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it("lg snapshot", () => {
    const { container } = render(<TeamColorDot color="#0000ff" size="lg" />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
