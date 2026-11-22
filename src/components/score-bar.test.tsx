// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreBar, ScoreDial } from "./score-bar";

describe("ScoreBar", () => {
  it("renders an accessible progressbar with the score", () => {
    render(<ScoreBar score={72} />);
    const bar = screen.getByRole("progressbar", { name: /opportunity score/i });
    expect(bar).toHaveAttribute("aria-valuenow", "72");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("72")).toBeInTheDocument();
  });

  it("clamps scores above 100 and below 0", () => {
    const { rerender } = render(<ScoreBar score={250} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<ScoreBar score={-20} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("shows a dash instead of inventing a score when data is missing", () => {
    render(<ScoreBar score={null} />);
    expect(
      screen.queryByRole("progressbar", { name: /opportunity score/i }),
    ).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("can hide the numeric label", () => {
    render(<ScoreBar score={55} showLabel={false} />);
    expect(screen.queryByText("55")).not.toBeInTheDocument();
  });
});

describe("ScoreDial", () => {
  it("shows the rounded score inside the dial", () => {
    render(<ScoreDial score={63.4} />);
    expect(screen.getByText("63")).toBeInTheDocument();
  });

  it("shows an em dash when unscored", () => {
    render(<ScoreDial score={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
