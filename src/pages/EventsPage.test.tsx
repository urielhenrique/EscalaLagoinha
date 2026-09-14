import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventsPage } from "./EventsPage";

const mockListEvents = vi.fn().mockResolvedValue({ data: [] });
const mockCreateEvent = vi.fn();
const mockUpdateEvent = vi.fn();
const mockDeleteEvent = vi.fn();
const mockSeedDefaultEvents = vi.fn();
const mockListRecurrenceGroup = vi.fn();

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      sub: "user-1",
      email: "admin@test.com",
      perfil: "ADMIN",
      churchId: "church-1",
    },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("../services/eventsApi", () => ({
  listEvents: (...args: unknown[]) => mockListEvents(...args),
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  seedDefaultEvents: (...args: unknown[]) => mockSeedDefaultEvents(...args),
  listRecurrenceGroup: (...args: unknown[]) =>
    mockListRecurrenceGroup(...args),
}));

function openCreateModal() {
  fireEvent.click(screen.getByText("Novo evento"));
}

function fillBasicFields() {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Culto Domingo" },
  });
  fireEvent.change(screen.getByLabelText("Descrição"), {
    target: { value: "Celebração dominical" },
  });
  fireEvent.change(screen.getByLabelText("Data início"), {
    target: { value: "2026-10-04T19:00" },
  });
  fireEvent.change(screen.getByLabelText("Data fim"), {
    target: { value: "2026-10-04T21:00" },
  });
}

describe("EventsPage — Recorrência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render event list page", async () => {
    render(<EventsPage />);
    expect(screen.getByText("Agenda de Eventos")).toBeTruthy();
  });

  it("should open create modal with basic fields", async () => {
    render(<EventsPage />);
    openCreateModal();
    expect(screen.getByLabelText("Nome")).toBeTruthy();
    expect(screen.getByLabelText("Descrição")).toBeTruthy();
    expect(screen.getByLabelText("Data início")).toBeTruthy();
    expect(screen.getByLabelText("Data fim")).toBeTruthy();
  });

  it("should have recurrence checkbox unchecked by default", async () => {
    render(<EventsPage />);
    openCreateModal();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
  });

  it("should show recurrence fields when checkbox is checked", async () => {
    render(<EventsPage />);
    openCreateModal();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(screen.getByText("Frequência")).toBeTruthy();
    expect(screen.getByText("Semanal")).toBeTruthy();
    expect(screen.getByText("Dias da semana")).toBeTruthy();
    expect(
      screen.getByText("Data inicial da recorrência"),
    ).toBeTruthy();
    expect(
      screen.getByText("Data final da recorrência"),
    ).toBeTruthy();
  });

  it("should hide recurrence fields when checkbox is unchecked", async () => {
    render(<EventsPage />);
    openCreateModal();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(screen.getByText("Frequência")).toBeTruthy();

    fireEvent.click(checkbox);
    expect(screen.queryByText("Frequência")).toBeNull();
  });

  it("should toggle day of week buttons", async () => {
    render(<EventsPage />);
    openCreateModal();

    fireEvent.click(screen.getByRole("checkbox"));

    const domBtn = screen.getByText("Dom");
    expect(domBtn).not.toHaveAttribute("aria-pressed", "true");

    fireEvent.click(domBtn);
    expect(domBtn).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(domBtn);
    expect(domBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("should show warning messages about recurrence", async () => {
    render(<EventsPage />);
    openCreateModal();
    fireEvent.click(screen.getByRole("checkbox"));

    expect(
      screen.getByText(
        /Serão criadas ocorrências individuais/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/Limite máximo: 52 ocorrências/),
    ).toBeTruthy();
  });

  it("should show preview when dates and days are selected", async () => {
    render(<EventsPage />);
    openCreateModal();

    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.click(screen.getByText("Dom"));

    await waitFor(() => {
      expect(screen.getByText(/Prévia das ocorrências/)).toBeTruthy();
    });
  });

  it("should validate recurrence requires at least one day", async () => {
    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-31" },
    });

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(
        screen.getByText(/Selecione pelo menos um dia da semana/),
      ).toBeTruthy();
    });
  });

  it("should validate recurrence end date after start date", async () => {
    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.click(screen.getByText("Dom"));

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(
        screen.getByText(
          /A data final da recorrência deve ser maior ou igual/,
        ),
      ).toBeTruthy();
    });
  });

  it("should validate single event requires all fields", async () => {
    render(<EventsPage />);
    openCreateModal();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(
        screen.getByText(/O nome do evento é obrigatório/),
      ).toBeTruthy();
      expect(
        screen.getByText(/A descrição do evento é obrigatória/),
      ).toBeTruthy();
      expect(
        screen.getByText(/A data de início é obrigatória/),
      ).toBeTruthy();
      expect(
        screen.getByText(/A data de término é obrigatória/),
      ).toBeTruthy();
    });
  });

  it("should send correct payload for single event", async () => {
    mockCreateEvent.mockResolvedValue({
      data: { id: "evt-1", nome: "Test" },
    } as never);

    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          nome: "Culto Domingo",
          descricao: "Celebração dominical",
        }),
      );
    });
  });

  it("should send correct payload for recurring event", async () => {
    mockCreateEvent.mockResolvedValue({
      data: { recurrenceGroupId: "group-1", totalEvents: 4, events: [] },
    } as never);

    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.click(screen.getByText("Dom"));

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrence: expect.objectContaining({
            type: "WEEKLY",
            daysOfWeek: ["DOMINGO"],
          }),
        }),
      );
    });
  });

  it("should show success message with total count for recurrence", async () => {
    mockCreateEvent.mockResolvedValue({
      data: { recurrenceGroupId: "group-1", totalEvents: 4, events: [] },
    } as never);

    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.click(screen.getByText("Dom"));

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(
        screen.getByText("4 eventos foram criados com sucesso."),
      ).toBeTruthy();
    });
  });

  it("should show recurrence badge on recurring events in list", async () => {
    mockListEvents.mockResolvedValue({
      data: [
        {
          id: "evt-1",
          nome: "Culto Domingo",
          descricao: "Teste",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recorrencia: null,
          recurrenceGroupId: "group-1",
          recurrenceType: "WEEKLY",
          recurrenceDays: ["DOMINGO"],
          recurrenceStart: "2026-10-01T00:00:00.000Z",
          recurrenceEnd: "2026-10-31T00:00:00.000Z",
          recurrenceIndex: 0,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Recorrente")).toBeTruthy();
    });
  });

  it("should not show recurrence section when editing", async () => {
    mockListEvents.mockResolvedValue({
      data: [
        {
          id: "evt-1",
          nome: "Culto Especial",
          descricao: "Teste",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recorrencia: null,
          recurrenceGroupId: null,
          recurrenceType: "NONE",
          recurrenceDays: [],
          recurrenceStart: null,
          recurrenceEnd: null,
          recurrenceIndex: null,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Especial")).toBeTruthy();
    });

    const editButton = screen.getByLabelText("Editar evento");
    fireEvent.click(editButton);

    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("should calculate preview correctly for multiple days", async () => {
    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.click(screen.getByText("Dom"));
    fireEvent.click(screen.getByText("Qua"));

    await waitFor(() => {
      const preview = screen.getByText(/Prévia das ocorrências/);
      expect(preview.textContent).toMatch(/\d+ total/);
    });
  });
});

describe("EventsPage — Série de Eventos", () => {
  const recurringEvent = {
    id: "evt-1",
    nome: "Culto Domingo",
    descricao: "Celebração dominical",
    dataInicio: "2026-10-04T19:00:00.000Z",
    dataFim: "2026-10-04T21:00:00.000Z",
    recorrencia: null,
    recurrenceGroupId: "group-1",
    recurrenceType: "WEEKLY" as const,
    recurrenceDays: ["DOMINGO"] as string[],
    recurrenceStart: "2026-09-06T00:00:00.000Z",
    recurrenceEnd: "2026-09-27T00:00:00.000Z",
    recurrenceIndex: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
  };

  const normalEvent = {
    id: "evt-2",
    nome: "Conferência Especial",
    descricao: "Evento único",
    dataInicio: "2026-10-10T18:00:00.000Z",
    dataFim: "2026-10-10T22:00:00.000Z",
    recorrencia: null,
    recurrenceGroupId: null,
    recurrenceType: "NONE" as const,
    recurrenceDays: [] as string[],
    recurrenceStart: null,
    recurrenceEnd: null,
    recurrenceIndex: null,
    createdAt: "2026-10-01T00:00:00.000Z",
  };

  const seriesOccurrences = [
    { ...recurringEvent, id: "evt-1", recurrenceIndex: 0 },
    { ...recurringEvent, id: "evt-3", recurrenceIndex: 1, dataInicio: "2026-10-11T19:00:00.000Z", dataFim: "2026-10-11T21:00:00.000Z" },
    { ...recurringEvent, id: "evt-4", recurrenceIndex: 2, dataInicio: "2026-10-18T19:00:00.000Z", dataFim: "2026-10-18T21:00:00.000Z" },
    { ...recurringEvent, id: "evt-5", recurrenceIndex: 3, dataInicio: "2026-10-25T19:00:00.000Z", dataFim: "2026-10-25T21:00:00.000Z" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show badge on recurring event and not on normal event", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent, normalEvent],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
      expect(screen.getByText("Conferência Especial")).toBeTruthy();
    });

    expect(screen.getByText("Recorrente")).toBeTruthy();

    const badges = screen.getAllByText("Recorrente");
    expect(badges).toHaveLength(1);
  });

  it("should open series detail modal when clicking recurring event title", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("Detalhes da série recorrente")).toBeTruthy();
      expect(screen.getByText("Semanal")).toBeTruthy();
      expect(screen.getByText("Domingo")).toBeTruthy();
      expect(screen.getByText("Ocorrências")).toBeTruthy();
    });
  });

  it("should display series information correctly", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("Frequência:")).toBeTruthy();
      expect(screen.getByText("Dias:")).toBeTruthy();
      expect(screen.getByText("Horário:")).toBeTruthy();
      expect(screen.getByText("Período:")).toBeTruthy();
    });
  });

  it("should list occurrences in series detail", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });
  });

  it("should highlight current occurrence in series list", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const currentIndicator = screen.queryByText(/Ocorrência atual/);
    expect(currentIndicator).toBeTruthy();
  });

  it("should close series modal when selecting another occurrence", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const occurrenceButtons = screen.getAllByRole("button").filter(
      (el) => el.classList.contains("flex-1"),
    );

    expect(occurrenceButtons.length).toBe(4);

    const otherOccurrence = occurrenceButtons.find(
      (btn) => !btn.textContent?.includes("Ocorrência atual"),
    );
    expect(otherOccurrence).toBeTruthy();

    fireEvent.click(otherOccurrence!);

    await waitFor(() => {
      expect(
        screen.queryByText("Detalhes da série recorrente"),
      ).toBeNull();
    });
  });

  it("should not show recurrence badge on normal event", async () => {
    mockListEvents.mockResolvedValue({
      data: [normalEvent],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Conferência Especial")).toBeTruthy();
    });

    expect(screen.queryByText("Recorrente")).toBeNull();
  });

  it("should handle error when loading series", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockRejectedValue(
      new Error("Network error"),
    );

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(
        screen.getByText(/Network error/),
      ).toBeTruthy();
    });
  });

  it("should handle empty series response", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: [],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("0 total")).toBeTruthy();
      expect(
        screen.getByText("Nenhuma ocorrência encontrada."),
      ).toBeTruthy();
    });
  });

  it("should show delete button on each occurrence in series", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const deleteButtons = screen.getAllByLabelText("Excluir esta ocorrência");
    expect(deleteButtons.length).toBe(4);
  });

  it("should confirm and delete occurrence from series", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup
      .mockResolvedValueOnce({ data: seriesOccurrences })
      .mockResolvedValueOnce({
        data: seriesOccurrences.filter((occ) => occ.id !== "evt-3"),
      });
    mockDeleteEvent.mockResolvedValue({ data: seriesOccurrences[1] });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const deleteButtons = screen.getAllByLabelText("Excluir esta ocorrência");
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith("evt-3");
      expect(
        screen.getByText("Ocorrência removida com sucesso."),
      ).toBeTruthy();
    });

    vi.mocked(window.confirm).mockRestore();
  });

  it("should cancel deletion when user declines confirmation", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const deleteButtons = screen.getAllByLabelText("Excluir esta ocorrência");
    fireEvent.click(deleteButtons[1]);

    expect(mockDeleteEvent).not.toHaveBeenCalled();

    vi.mocked(window.confirm).mockRestore();
  });

  it("should show recurring-specific delete confirmation message", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const deleteButtons = screen.getAllByLabelText("Excluir esta ocorrência");
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("somente esta ocorrência"),
    );

    confirmSpy.mockRestore();
  });

  it("should show updated success message for recurring event edit", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });
    mockUpdateEvent.mockResolvedValue({ data: recurringEvent });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const occurrenceButtons = screen.getAllByRole("button").filter(
      (el) => el.classList.contains("flex-1"),
    );
    fireEvent.click(occurrenceButtons[0]);

    await waitFor(() => {
      expect(screen.getByLabelText("Nome")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Esta alteração foi aplicada somente a esta ocorrência.",
        ),
      ).toBeTruthy();
    });
  });

  it("should show non-recurring delete confirmation for normal event", async () => {
    mockListEvents.mockResolvedValue({
      data: [normalEvent],
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Conferência Especial")).toBeTruthy();
    });

    const deleteButton = screen.getByLabelText("Excluir evento");
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("Deseja excluir o evento"),
    );
    expect(confirmSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("somente esta ocorrência"),
    );

    confirmSpy.mockRestore();
  });

  it("should handle delete error for occurrence", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });
    mockDeleteEvent.mockRejectedValue(new Error("Cannot delete: schedules exist"));

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const deleteButtons = screen.getAllByLabelText("Excluir esta ocorrência");
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot delete: schedules exist/),
      ).toBeTruthy();
    });

    vi.mocked(window.confirm).mockRestore();
  });

  it("should show Schedule-specific error message when deleting occurrence with linked schedules", async () => {
    mockListEvents.mockResolvedValue({
      data: [recurringEvent],
    });
    mockListRecurrenceGroup.mockResolvedValue({
      data: seriesOccurrences,
    });
    mockDeleteEvent.mockRejectedValue(
      new Error(
        "Não foi possível excluir esta ocorrência porque existem escalas vinculadas a ela.",
      ),
    );

    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Domingo")).toBeTruthy();
    });

    const titleButton = screen.getAllByText("Culto Domingo").find(
      (el) => el.tagName === "BUTTON",
    );
    fireEvent.click(titleButton!);

    await waitFor(() => {
      expect(screen.getByText("4 total")).toBeTruthy();
    });

    const deleteButtons = screen.getAllByLabelText("Excluir esta ocorrência");
    fireEvent.click(deleteButtons[1]);

    await waitFor(() => {
      expect(
        screen.getByText(/escalas vinculadas/),
      ).toBeTruthy();
    });

    vi.mocked(window.confirm).mockRestore();
  });
});

describe("EventsPage — Validação no Modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should keep modal open when submitting empty form", async () => {
    render(<EventsPage />);
    openCreateModal();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("O nome do evento é obrigatório.")).toBeTruthy();
    });
  });

  it("should show per-field errors inside the modal", async () => {
    render(<EventsPage />);
    openCreateModal();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("O nome do evento é obrigatório.")).toBeTruthy();
      expect(screen.getByText("A descrição do evento é obrigatória.")).toBeTruthy();
      expect(screen.getByText("A data de início é obrigatória.")).toBeTruthy();
      expect(screen.getByText("A data de término é obrigatória.")).toBeTruthy();
    });
  });

  it("should set aria-invalid on empty required fields", async () => {
    const { container } = render(<EventsPage />);
    openCreateModal();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("O nome do evento é obrigatório.")).toBeTruthy();
    });

    const nomeInput = container.querySelector<HTMLInputElement>('input[name="nome"]');
    const descInput = container.querySelector<HTMLTextAreaElement>('textarea[name="descricao"]');
    expect(nomeInput).toHaveAttribute("aria-invalid", "true");
    expect(descInput).toHaveAttribute("aria-invalid", "true");
  });

  it("should focus the first invalid field on submit", async () => {
    const { container } = render(<EventsPage />);
    openCreateModal();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("O nome do evento é obrigatório.")).toBeTruthy();
    });

    const nomeInput = container.querySelector('input[name="nome"]');
    expect(document.activeElement).toBe(nomeInput);
  });

  it("should clear field error when user fills the field", async () => {
    const { container } = render(<EventsPage />);
    openCreateModal();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("O nome do evento é obrigatório.")).toBeTruthy();
    });

    const nomeInput = container.querySelector<HTMLInputElement>('input[name="nome"]');
    fireEvent.change(nomeInput!, {
      target: { value: "Culto" },
    });

    await waitFor(() => {
      expect(screen.queryByText("O nome do evento é obrigatório.")).toBeNull();
    });
  });

  it("should show API error inside the modal", async () => {
    mockCreateEvent.mockRejectedValue(new Error("Conflito de horário detectado."));

    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("Conflito de horário detectado.")).toBeTruthy();
      expect(screen.getByText("Cancelar")).toBeTruthy();
    });
  });

  it("should create valid event normally", async () => {
    mockCreateEvent.mockResolvedValue({
      data: { id: "evt-1", nome: "Test" },
    } as never);

    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled();
      expect(screen.queryByText("Cancelar")).toBeNull();
    });
  });

  it("should show recurrence validation errors inside the modal", async () => {
    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-31" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.click(screen.getByText("Dom"));

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(
        screen.getByText(/A data final da recorrência deve ser maior ou igual/),
      ).toBeTruthy();
      expect(screen.getByText("Cancelar")).toBeTruthy();
    });
  });

  it("should show per-field error for missing recurrence days", async () => {
    render(<EventsPage />);
    openCreateModal();
    fillBasicFields();
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.change(screen.getByLabelText("Data inicial da recorrência"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Data final da recorrência"), {
      target: { value: "2026-10-31" },
    });

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("Selecione pelo menos um dia da semana.")).toBeTruthy();
      expect(screen.getByText("Cancelar")).toBeTruthy();
    });
  });

  it("should keep modal open and show errors on edit with invalid data", async () => {
    mockListEvents.mockResolvedValue({
      data: [
        {
          id: "evt-1",
          nome: "Culto Especial",
          descricao: "Teste",
          dataInicio: "2026-10-04T19:00:00.000Z",
          dataFim: "2026-10-04T21:00:00.000Z",
          recorrencia: null,
          recurrenceGroupId: null,
          recurrenceType: "NONE",
          recurrenceDays: [],
          recurrenceStart: null,
          recurrenceEnd: null,
          recurrenceIndex: null,
          createdAt: "2026-10-01T00:00:00.000Z",
        },
      ],
    });

    render(<EventsPage />);

    await waitFor(() => {
      expect(screen.getByText("Culto Especial")).toBeTruthy();
    });

    const editButton = screen.getByLabelText("Editar evento");
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText("Cancelar")).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Nome"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByText("Salvar evento"));

    await waitFor(() => {
      expect(screen.getByText("O nome do evento é obrigatório.")).toBeTruthy();
      expect(screen.getByText("Cancelar")).toBeTruthy();
    });
  });
});
