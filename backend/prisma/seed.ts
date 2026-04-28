import { Perfil, UserStatus } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedChurches() {
  const churches = [
    {
      nome: "Lagoinha Jardim Atlantico",
      slug: "lagoinha-jardim-atlantico",
      cidade: "Belo Horizonte",
      estado: "MG",
      responsavelPrincipal: "Pastor Principal",
    },
    {
      nome: "Lagoinha Centro",
      slug: "lagoinha-centro",
      cidade: "Belo Horizonte",
      estado: "MG",
      responsavelPrincipal: "Pastor Centro",
    },
    {
      nome: "Lagoinha Pampulha",
      slug: "lagoinha-pampulha",
      cidade: "Belo Horizonte",
      estado: "MG",
      responsavelPrincipal: "Pastor Pampulha",
    },
  ];

  const created = [];
  for (const church of churches) {
    const upserted = await prisma.church.upsert({
      where: { slug: church.slug },
      update: {
        nome: church.nome,
        cidade: church.cidade,
        estado: church.estado,
        responsavelPrincipal: church.responsavelPrincipal,
      },
      create: {
        ...church,
        settings: {
          create: {},
        },
        subscription: {
          create: {
            status: "TRIAL",
            planName: "STARTER",
          },
        },
      },
    });

    created.push(upserted);
  }

  return {
    primary: created[0],
    churches: created,
  };
}

async function seedUsers(churchId: string) {
  const passwordHash = await bcrypt.hash("admin123", 10);

  // ─── MASTER ADMIN ──────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "master@lagoinha.com" },
    update: {
      nome: "Master Admin",
      perfil: Perfil.MASTER_ADMIN,
      status: UserStatus.ATIVO,
      ativo: true,
      churchId,
    },
    create: {
      nome: "Master Admin",
      email: "master@lagoinha.com",
      senha: passwordHash,
      telefone: "(31) 99999-9999",
      perfil: Perfil.MASTER_ADMIN,
      status: UserStatus.ATIVO,
      ativo: true,
      churchId,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@schedulewell.com" },
    update: {
      nome: "Admin Principal",
      telefone: "(31) 99999-0000",
      perfil: Perfil.ADMIN,
      status: UserStatus.ATIVO,
      ativo: true,
      churchId,
    },
    create: {
      nome: "Admin Principal",
      email: "admin@schedulewell.com",
      senha: passwordHash,
      telefone: "(31) 99999-0000",
      perfil: Perfil.ADMIN,
      status: UserStatus.ATIVO,
      ativo: true,
      foto: null,
      churchId,
    },
  });

  const volunteersData = [
    {
      nome: "João Pedro",
      email: "joao.pedro@schedulewell.com",
      telefone: "(31) 98888-1001",
    },
    {
      nome: "Maria Clara",
      email: "maria.clara@schedulewell.com",
      telefone: "(31) 98888-1002",
    },
    {
      nome: "Lucas Gabriel",
      email: "lucas.gabriel@schedulewell.com",
      telefone: "(31) 98888-1003",
    },
    {
      nome: "Ana Beatriz",
      email: "ana.beatriz@schedulewell.com",
      telefone: "(31) 98888-1004",
    },
  ];

  const volunteers = [];
  for (const volunteer of volunteersData) {
    const upsertedVolunteer = await prisma.user.upsert({
      where: { email: volunteer.email },
      update: {
        nome: volunteer.nome,
        telefone: volunteer.telefone,
        perfil: Perfil.VOLUNTARIO,
        status: UserStatus.ATIVO,
        ativo: true,
        churchId,
      },
      create: {
        nome: volunteer.nome,
        email: volunteer.email,
        senha: passwordHash,
        telefone: volunteer.telefone,
        perfil: Perfil.VOLUNTARIO,
        status: UserStatus.ATIVO,
        ativo: true,
        foto: null,
        churchId,
      },
    });

    volunteers.push(upsertedVolunteer);
  }

  return { admin, volunteers };
}

async function seedMinistries(
  churchId: string,
  adminId: string,
  volunteerIds: string[],
) {
  const initialMinistries = [
    "Foto",
    "Vídeo",
    "Projeção",
    "Iluminação",
    "Transmissão",
  ];

  for (const ministryName of initialMinistries) {
    const existing = await prisma.ministry.findUnique({
      where: {
        churchId_nome: {
          churchId,
          nome: ministryName,
        },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.ministry.update({
        where: { id: existing.id },
        data: {
          descricao: `Ministério de ${ministryName}`,
          churchId,
          leaderId: adminId,
          members: {
            set: volunteerIds.map((id) => ({ id })),
          },
        },
      });

      continue;
    }

    await prisma.ministry.create({
      data: {
        nome: ministryName,
        descricao: `Ministério de ${ministryName}`,
        churchId,
        leaderId: adminId,
        members: {
          connect: volunteerIds.map((id) => ({ id })),
        },
      },
    });
  }
}

async function seedEvents(churchId: string) {
  const initialEvents = [
    {
      nome: "Culto Domingo Manhã",
      descricao: "Celebração dominical pela manhã",
      dataInicio: new Date("2026-05-03T09:00:00.000Z"),
      dataFim: new Date("2026-05-03T11:00:00.000Z"),
      recorrencia: "SEMANAL",
    },
    {
      nome: "Culto Domingo Noite",
      descricao: "Celebração dominical à noite",
      dataInicio: new Date("2026-05-03T19:00:00.000Z"),
      dataFim: new Date("2026-05-03T21:00:00.000Z"),
      recorrencia: "SEMANAL",
    },
    {
      nome: "Culto de Jovens",
      descricao: "Celebração da juventude",
      dataInicio: new Date("2026-05-02T19:30:00.000Z"),
      dataFim: new Date("2026-05-02T21:30:00.000Z"),
      recorrencia: "SEMANAL",
    },
    {
      nome: "Ensaio Worship",
      descricao: "Ensaio da equipe de louvor",
      dataInicio: new Date("2026-05-06T20:00:00.000Z"),
      dataFim: new Date("2026-05-06T22:00:00.000Z"),
      recorrencia: "SEMANAL",
    },
  ];

  for (const event of initialEvents) {
    const existing = await prisma.event.findFirst({
      where: { nome: event.nome, churchId },
      select: { id: true },
    });

    if (existing) {
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          descricao: event.descricao,
          dataInicio: event.dataInicio,
          dataFim: event.dataFim,
          recorrencia: event.recorrencia,
        },
      });

      continue;
    }

    await prisma.event.create({
      data: {
        ...event,
        churchId,
      },
    });
  }
}

async function main() {
  const { primary } = await seedChurches();
  const { admin, volunteers } = await seedUsers(primary.id);
  await seedMinistries(
    primary.id,
    admin.id,
    volunteers.map((volunteer) => volunteer.id),
  );
  await seedEvents(primary.id);

  console.log("Seed executada com sucesso.");
  console.log("Admin: admin@schedulewell.com / admin123");
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
