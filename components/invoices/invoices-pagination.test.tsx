// components/invoices/invoices-pagination.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoicesPagination } from "./invoices-pagination";

describe("InvoicesPagination", () => {
  it("non renderizza nulla se c'è una sola pagina", () => {
    const { container } = render(
      <InvoicesPagination page={1} totalCount={10} pageSize={25} onPageChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra pagina corrente e totale pagine (arrotondato per eccesso)", () => {
    render(<InvoicesPagination page={2} totalCount={55} pageSize={25} onPageChange={vi.fn()} />);
    expect(screen.getByText(/Pagina 2 di 3/)).toBeInTheDocument();
  });

  it("disabilita 'Precedente' sulla prima pagina", () => {
    render(<InvoicesPagination page={1} totalCount={55} pageSize={25} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pagina precedente" })).toBeDisabled();
  });

  it("disabilita 'Successiva' sull'ultima pagina", () => {
    render(<InvoicesPagination page={3} totalCount={55} pageSize={25} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Pagina successiva" })).toBeDisabled();
  });

  it("chiama onPageChange con page+1/page-1", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<InvoicesPagination page={2} totalCount={55} pageSize={25} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: "Pagina successiva" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole("button", { name: "Pagina precedente" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
