type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

type LoginResponse = {
  user: {
    id: string;
    email: string;
    perfil: string;
  };
  token: string;
};

type UserItem = {
  id: string;
  email: string;
};

type EventItem = {
  id: string;
};

type MinistryItem = {
  id: string;
};

const baseUrl = process.env.ETAPA13_BASE_URL ?? "http://127.0.0.1:3000/api";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const bodyText = await response.text();
  const parsed = bodyText ? (JSON.parse(bodyText) as ApiEnvelope<T>) : null;

  if (!response.ok || !parsed) {
    const details = bodyText || `${response.status} ${response.statusText}`;
    throw new Error(`Request failed ${path}: ${details}`);
  }

  return parsed;
}

async function main() {
  const rand = Math.floor(10000 + Math.random() * 89999);
  const email = `etapa13.${rand}@teste.com`;
  const senha = "teste123";

  console.log(`[ETAPA13] Base URL: ${baseUrl}`);

  const adminLogin = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "admin@schedulewell.com",
      senha: "admin123",
    }),
  });
  const adminToken = adminLogin.data.token;

  await request<{ status: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      nome: `Etapa13 Voluntario ${rand}`,
      email,
      telefone: "(31) 98888-2222",
      senha,
    }),
  });

  const pending = await request<UserItem[]>("/users/pending", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const target = pending.data.find((item) => item.email === email);
  if (!target) {
    throw new Error(
      "Voluntário recém-cadastrado não encontrado na fila de pendentes.",
    );
  }

  await request<UserItem>(`/users/${target.id}/approve`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const volunteerLogin = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
  const volunteerToken = volunteerLogin.data.token;

  await request<unknown>("/availability/me/weekly", {
    method: "PUT",
    headers: { Authorization: `Bearer ${volunteerToken}` },
    body: JSON.stringify({
      slots: [
        { dayOfWeek: "DOMINGO", period: "NOITE", preference: "PREFERENCIAL" },
        { dayOfWeek: "QUARTA", period: "NOITE", preference: "DISPONIVEL" },
      ],
    }),
  });

  await request<unknown>("/availability/me/blocked-dates", {
    method: "POST",
    headers: { Authorization: `Bearer ${volunteerToken}` },
    body: JSON.stringify({ date: "2026-08-12", reason: "Viagem" }),
  });

  const ministries = await request<MinistryItem[]>("/ministries", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const ministryId = ministries.data[0]?.id;
  if (!ministryId) {
    throw new Error("Nenhum ministério encontrado para executar o teste.");
  }

  const createdEvent = await request<EventItem>("/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      nome: `ETAPA13 Blocked ${rand}`,
      descricao: "Teste automático ETAPA 13",
      dataInicio: "2026-08-12T19:00:00.000Z",
      dataFim: "2026-08-12T21:00:00.000Z",
      recorrencia: null,
    }),
  });

  let blockedRejected = false;
  try {
    await request("/schedules", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        eventId: createdEvent.data.id,
        ministryId,
        volunteerId: volunteerLogin.data.user.id,
        status: "PENDENTE",
      }),
    });
  } catch (error) {
    const message = String(error);
    if (message.includes("indisponível")) {
      blockedRejected = true;
    }
  }

  if (!blockedRejected) {
    throw new Error(
      "A escala em data bloqueada não foi rejeitada como esperado.",
    );
  }

  const availability = await request<{
    weekly: unknown[];
    blockedDates: unknown[];
  }>("/availability/me", {
    headers: { Authorization: `Bearer ${volunteerToken}` },
  });

  if (
    availability.data.weekly.length < 2 ||
    availability.data.blockedDates.length < 1
  ) {
    throw new Error(
      "Dados de disponibilidade não foram persistidos corretamente.",
    );
  }

  console.log("[ETAPA13] Smoke test concluído com sucesso.");
}

main().catch((error) => {
  console.error("[ETAPA13] Falha no smoke test:", error);
  process.exit(1);
});
