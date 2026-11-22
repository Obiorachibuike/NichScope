import "@testing-library/jest-dom/vitest";

// Keep unit tests deterministic and independent of local secrets.
process.env["DEMO_MODE"] ??= "true";
