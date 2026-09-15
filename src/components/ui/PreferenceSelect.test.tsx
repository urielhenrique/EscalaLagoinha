import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreferenceSelect } from "./PreferenceSelect";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const options = [
  { value: "A", label: "Alpha" },
  { value: "B", label: "Beta" },
  { value: "C", label: "Gamma" },
];

describe("PreferenceSelect", () => {
  it("renders the currently selected label", () => {
    render(
      <PreferenceSelect value="B" options={options} onChange={() => {}} />,
    );
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("opens dropdown when trigger is clicked", () => {
    render(
      <PreferenceSelect value="A" options={options} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("shows all options with correct labels", () => {
    render(
      <PreferenceSelect value="A" options={options} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const opts = screen.getAllByRole("option");
    expect(opts[0].textContent).toBe("Alpha");
    expect(opts[1].textContent).toBe("Beta");
    expect(opts[2].textContent).toBe("Gamma");
  });

  it("marks the selected option with aria-selected", () => {
    render(
      <PreferenceSelect value="B" options={options} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    const opts = screen.getAllByRole("option");
    expect(opts[0].getAttribute("aria-selected")).toBe("false");
    expect(opts[1].getAttribute("aria-selected")).toBe("true");
    expect(opts[2].getAttribute("aria-selected")).toBe("false");
  });

  it("calls onChange and closes when an option is clicked", () => {
    const onChange = vi.fn();
    render(
      <PreferenceSelect value="A" options={options} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Gamma"));
    expect(onChange).toHaveBeenCalledWith("C");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes after selection", () => {
    render(
      <PreferenceSelect value="A" options={options} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("Beta"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes when clicking outside", () => {
    render(
      <div>
        <span data-testid="outside">Outside</span>
        <PreferenceSelect value="A" options={options} onChange={() => {}} />
      </div>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes with Escape key", () => {
    render(
      <PreferenceSelect value="A" options={options} onChange={() => {}} />,
    );
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("navigates options with ArrowDown and ArrowUp", () => {
    render(
      <PreferenceSelect value="A" options={options} onChange={() => {}} />,
    );
    const combobox = screen.getByRole("combobox");

    // Open with ArrowDown
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeTruthy();

    // Navigate down
    fireEvent.keyDown(combobox, { key: "ArrowDown" });

    // Select with Enter
    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("selects with Enter key", () => {
    const onChange = vi.fn();
    render(
      <PreferenceSelect value="A" options={options} onChange={onChange} />,
    );
    const combobox = screen.getByRole("combobox");

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("B");
  });

  it("selects with Space key", () => {
    const onChange = vi.fn();
    render(
      <PreferenceSelect value="A" options={options} onChange={onChange} />,
    );
    const combobox = screen.getByRole("combobox");

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: " " });
    expect(onChange).toHaveBeenCalledWith("B");
  });

  it("supports disabled state", () => {
    render(
      <PreferenceSelect
        value="A"
        options={options}
        onChange={() => {}}
        disabled
      />,
    );
    const combobox = screen.getByRole("combobox");
    expect(combobox).toHaveAttribute("disabled");
    fireEvent.click(combobox);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("has correct aria-expanded attribute", () => {
    render(
      <PreferenceSelect value="A" options={options} onChange={() => {}} />,
    );
    const combobox = screen.getByRole("combobox");
    expect(combobox.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(combobox);
    expect(combobox.getAttribute("aria-expanded")).toBe("true");
  });

  it("has aria-haspopup listbox", () => {
    render(
      <PreferenceSelect value="A" options={options} onChange={() => {}} />,
    );
    expect(
      screen.getByRole("combobox").getAttribute("aria-haspopup"),
    ).toBe("listbox");
  });

  it("renders with custom aria-label", () => {
    render(
      <PreferenceSelect
        value="A"
        options={options}
        onChange={() => {}}
        aria-label="Custom label"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Custom label" })).toBeTruthy();
  });

  it("renders default label when value is not in options", () => {
    render(
      <PreferenceSelect value="X" options={options} onChange={() => {}} />,
    );
    expect(screen.getByText("X")).toBeTruthy();
  });
});
