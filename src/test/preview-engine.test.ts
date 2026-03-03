import { describe, it, expect } from "vitest";
import { buildPreviewFromFiles } from "@/lib/cirius/preview-engine";

describe("Preview Engine", () => {
  it("returns null for empty files", () => {
    expect(buildPreviewFromFiles({})).toBeNull();
  });

  it("builds static HTML without Vite entry", () => {
    const files = {
      "index.html": "<!DOCTYPE html><html><head></head><body><h1>Hello</h1></body></html>",
    };
    const result = buildPreviewFromFiles(files);
    expect(result).toContain("<h1>Hello</h1>");
  });

  it("injects CSS into static HTML", () => {
    const files = {
      "index.html": "<!DOCTYPE html><html><head></head><body><h1>Hi</h1></body></html>",
      "src/index.css": "body { color: red; }",
    };
    const result = buildPreviewFromFiles(files);
    expect(result).toContain("color: red");
  });

  it("builds React preview with Babel for Vite projects", () => {
    const files = {
      "index.html": '<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      "src/main.tsx": 'import React from "react"; import App from "./App"; ReactDOM.createRoot(document.getElementById("root")!).render(<App />);',
      "src/App.tsx": 'export default function App() { return <div>Hello World</div>; }',
    };
    const result = buildPreviewFromFiles(files);
    expect(result).not.toBeNull();
    expect(result).toContain("babel");
    expect(result).toContain("react@18");
    expect(result).toContain("__ciriusModules");
    expect(result).toContain("Hello World");
  });

  it("handles typed exports without breaking (the critical fix)", () => {
    const files = {
      "index.html": '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      "src/main.tsx": 'import App from "./App"; ReactDOM.createRoot(document.getElementById("root")!).render(<App />);',
      "src/App.tsx": 'export default function App() { return <div>Root</div>; }',
      "src/components/Hero.tsx": `
import React from "react";

interface HeroProps {
  title: string;
}

export const Hero: React.FC<HeroProps> = ({ title }) => {
  return <div className="text-xl">{title}</div>;
};

export default Hero;
`,
    };
    const result = buildPreviewFromFiles(files);
    expect(result).not.toBeNull();
    // The critical check: should NOT contain ": React.FC" in the output
    // because the engine strips type annotations
    // But it SHOULD contain the component registration
    expect(result).toContain("__ciriusExports");
    expect(result).toContain("__ciriusModules");
    // Should NOT produce invalid JS like `window.X = : React.FC`
    expect(result).not.toContain('= : React.FC');
  });

  it("includes error bridge script", () => {
    const files = {
      "index.html": '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      "src/main.tsx": 'import App from "./App";',
      "src/App.tsx": 'export default function App() { return <div>Test</div>; }',
    };
    const result = buildPreviewFromFiles(files);
    expect(result).toContain("cirius-preview-error");
    expect(result).toContain("window.onerror");
    expect(result).toContain("postMessage");
  });

  it("includes component stubs for shadcn/ui", () => {
    const files = {
      "index.html": '<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      "src/main.tsx": 'import App from "./App";',
      "src/App.tsx": 'import { Button } from "@/components/ui/button"; export default function App() { return <Button>Click</Button>; }',
    };
    const result = buildPreviewFromFiles(files);
    expect(result).toContain("window.Button");
    expect(result).toContain("window.Card");
    expect(result).toContain("window.Input");
  });

  it("injects Tailwind CDN for static HTML with Tailwind classes", () => {
    const files = {
      "index.html": '<!DOCTYPE html><html><head></head><body><div class="flex bg-blue-500 p-4">Test</div></body></html>',
    };
    const result = buildPreviewFromFiles(files);
    expect(result).toContain("cdn.tailwindcss.com");
  });
});
