import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthInput } from "./AuthInput";

describe("AuthInput", () => {
  it("renders with label", () => {
    render(<AuthInput label="Email" id="email" />);
    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("renders input with correct attributes", () => {
    render(<AuthInput label="Senha" id="senha" type="password" />);
    const input = screen.getByLabelText("Senha");
    expect(input.getAttribute("type")).toBe("password");
    expect(input.getAttribute("id")).toBe("senha");
  });

  it("passes additional props to input", () => {
    render(
      <AuthInput
        label="Nome"
        id="nome"
        placeholder="Digite seu nome"
        disabled
      />,
    );
    const input = screen.getByLabelText("Nome");
    expect(input.getAttribute("placeholder")).toBe("Digite seu nome");
    expect(input).toBeDisabled();
  });
});
