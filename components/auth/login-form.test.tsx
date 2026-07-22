import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "@/components/auth/login-form";

// La Server Action trascina prisma/bcrypt/audit: va mockata nel component test.
vi.mock("@/lib/actions/auth", () => ({ login: vi.fn(async () => ({})) }));

describe("LoginForm", () => {
  it("mostra i campi username e password e il pulsante Accedi", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accedi" })).toBeInTheDocument();
  });
});
