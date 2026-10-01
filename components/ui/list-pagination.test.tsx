// components/ui/list-pagination.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListPagination } from "./list-pagination";

describe("ListPagination", () => {
  it("non renderizza nulla se c'è una sola pagina e non c'è onPageSizeChange", () => {
    const { container } = render(
      <ListPagination
        page={1}
        totalCount={10}
        pageSize={25}
        itemLabel="fatture"
        onPageChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderizza il selettore elementi per pagina se fornito onPageSizeChange anche con una sola pagina", () => {
    render(
      <ListPagination
        page={1}
        totalCount={10}
        pageSize={25}
        itemLabel="fatture"
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Pagina 1 di 1 \(10 fatture\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Elementi per pagina")).toBeInTheDocument();
    expect(screen.getByLabelText("Elementi per pagina")).toHaveValue("25");
  });

  it("chiama onPageSizeChange con il nuovo valore numerico", async () => {
    const user = userEvent.setup();
    const onPageSizeChange = vi.fn();
    render(
      <ListPagination
        page={1}
        totalCount={50}
        pageSize={25}
        itemLabel="fatture"
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />
    );
    await user.selectOptions(screen.getByLabelText("Elementi per pagina"), "10");
    expect(onPageSizeChange).toHaveBeenCalledWith(10);
  });


  it("mostra pagina corrente, totale pagine (arrotondato per eccesso) ed etichetta", () => {
    render(
      <ListPagination
        page={2}
        totalCount={55}
        pageSize={25}
        itemLabel="pazienti"
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Pagina 2 di 3 \(55 pazienti\)/)).toBeInTheDocument();
  });

  it("disabilita 'Precedente' sulla prima pagina", () => {
    render(
      <ListPagination
        page={1}
        totalCount={55}
        pageSize={25}
        itemLabel="fatture"
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Pagina precedente" })).toBeDisabled();
  });

  it("disabilita 'Successiva' sull'ultima pagina", () => {
    render(
      <ListPagination
        page={3}
        totalCount={55}
        pageSize={25}
        itemLabel="fatture"
        onPageChange={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Pagina successiva" })).toBeDisabled();
  });

  it("chiama onPageChange con page+1/page-1", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <ListPagination
        page={2}
        totalCount={55}
        pageSize={25}
        itemLabel="fatture"
        onPageChange={onPageChange}
      />
    );
    await user.click(screen.getByRole("button", { name: "Pagina successiva" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole("button", { name: "Pagina precedente" }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
