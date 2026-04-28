import { ForbiddenException, Injectable } from "@nestjs/common";
import { AttendanceStatus, Prisma } from "@prisma/client";
import * as ExcelJS from "exceljs";
import PDFDocument = require("pdfkit");
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { toJsonValue } from "../common/utils/json";
import { PrismaService } from "../prisma/prisma.service";
import { ReportsQueryDto } from "./dto/reports-query.dto";

type VolunteerReportRow = {
  volunteerId: string;
  volunteerName: string;
  ministryName: string;
  totalSchedules: number;
  confirmed: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  attendanceRate: number;
  operationalScore: number;
};

type MinistryReportRow = {
  ministryId: string;
  ministryName: string;
  totalSchedules: number;
  confirmed: number;
  present: number;
  late: number;
  absent: number;
  justified: number;
  attendanceRate: number;
  operationalScore: number;
};

type MonthlyRankingRow = {
  month: string;
  volunteerId: string;
  volunteerName: string;
  ministryName: string;
  totalSchedules: number;
  present: number;
  late: number;
  absent: number;
  operationalScore: number;
};

type AttendanceExceptionRow = {
  volunteerId: string;
  volunteerName: string;
  ministryName: string;
  absent: number;
  late: number;
  justified: number;
  latestEventDate: Date | null;
  riskLevel: "BAIXO" | "MEDIO" | "ALTO";
};

type EventScheduleRow = {
  eventId: string;
  eventName: string;
  eventDate: Date;
  totalSchedules: number;
  completedSchedules: number;
  confirmed: number;
  present: number;
  late: number;
  absent: number;
};

type InactiveVolunteerRow = {
  volunteerId: string;
  volunteerName: string;
  email: string;
  totalSchedules: number;
  lastEventDate: Date | null;
  status: "SEM_ESCALA" | "SEM_PRESENCA";
};

type CancelledScheduleRow = {
  scheduleId: string;
  volunteerName: string;
  ministryName: string;
  eventName: string;
  eventDate: Date;
  cancelledAt: Date;
};

type OverviewReport = {
  filters: ReportsQueryDto;
  totals: {
    schedules: number;
    volunteers: number;
    ministries: number;
    confirmed: number;
    present: number;
    late: number;
    absent: number;
    justified: number;
    cancelledSchedules: number;
    attendanceRate: number;
  };
  frequencyByVolunteer: VolunteerReportRow[];
  frequencyByMinistry: MinistryReportRow[];
  monthlyRanking: MonthlyRankingRow[];
  attendanceExceptions: AttendanceExceptionRow[];
  completedSchedules: EventScheduleRow[];
  mostActiveVolunteers: VolunteerReportRow[];
  inactiveVolunteers: InactiveVolunteerRow[];
  cancelledSchedules: CancelledScheduleRow[];
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private getChurchIdOrThrow(actor: JwtPayload) {
    if (!actor.churchId) {
      throw new ForbiddenException(
        "Acesso negado: usuário sem igreja vinculada.",
      );
    }

    return actor.churchId;
  }

  async getOverview(query: ReportsQueryDto, actor: JwtPayload) {
    const churchId = this.getChurchIdOrThrow(actor);
    const where = this.buildScheduleWhere(query, churchId);

    const [schedules, volunteers] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        include: {
          event: {
            select: {
              id: true,
              nome: true,
              dataInicio: true,
            },
          },
          ministry: {
            select: {
              id: true,
              nome: true,
            },
          },
          volunteer: {
            select: {
              id: true,
              nome: true,
              email: true,
            },
          },
          attendance: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          churchId,
          ativo: true,
          perfil: "VOLUNTARIO",
          id: query.volunteerId,
          ministries: query.ministryId
            ? {
                some: {
                  id: query.ministryId,
                },
              }
            : undefined,
        },
        select: {
          id: true,
          nome: true,
          email: true,
        },
      }),
    ]);

    const activeSchedules = schedules.filter(
      (schedule) => schedule.status !== "CANCELADO",
    );
    const cancelledSchedules = schedules.filter(
      (schedule) => schedule.status === "CANCELADO",
    );

    const frequencyByVolunteer = this.buildVolunteerFrequency(activeSchedules);
    const frequencyByMinistry = this.buildMinistryFrequency(activeSchedules);
    const monthlyRanking = this.buildMonthlyRanking(activeSchedules);
    const attendanceExceptions =
      this.buildAttendanceExceptions(activeSchedules);
    const completedSchedules = this.buildCompletedSchedules(activeSchedules);
    const inactiveVolunteers = this.buildInactiveVolunteers(
      volunteers,
      frequencyByVolunteer,
    );

    const totalAttendanceMarks = activeSchedules.filter(
      (schedule) => schedule.attendance?.status,
    ).length;
    const attendedSchedules = activeSchedules.filter((schedule) => {
      const status = schedule.attendance?.status;

      return (
        status === AttendanceStatus.CONFIRMADO ||
        status === AttendanceStatus.PRESENTE ||
        status === AttendanceStatus.ATRASADO
      );
    }).length;

    const totals = {
      schedules: activeSchedules.length,
      volunteers: new Set(activeSchedules.map((s) => s.volunteerId)).size,
      ministries: new Set(activeSchedules.map((s) => s.ministryId)).size,
      confirmed: activeSchedules.filter(
        (schedule) =>
          schedule.attendance?.status === AttendanceStatus.CONFIRMADO,
      ).length,
      present: activeSchedules.filter(
        (schedule) => schedule.attendance?.status === AttendanceStatus.PRESENTE,
      ).length,
      late: activeSchedules.filter(
        (schedule) => schedule.attendance?.status === AttendanceStatus.ATRASADO,
      ).length,
      absent: activeSchedules.filter(
        (schedule) => schedule.attendance?.status === AttendanceStatus.AUSENTE,
      ).length,
      justified: activeSchedules.filter(
        (schedule) =>
          schedule.attendance?.status === AttendanceStatus.JUSTIFICADO,
      ).length,
      cancelledSchedules: cancelledSchedules.length,
      attendanceRate:
        totalAttendanceMarks > 0
          ? Number(
              ((attendedSchedules / totalAttendanceMarks) * 100).toFixed(2),
            )
          : 0,
    };

    return {
      filters: query,
      totals,
      frequencyByVolunteer,
      frequencyByMinistry,
      monthlyRanking,
      attendanceExceptions,
      completedSchedules,
      mostActiveVolunteers: frequencyByVolunteer.slice(0, 5),
      inactiveVolunteers,
      cancelledSchedules: cancelledSchedules
        .map((schedule) => ({
          scheduleId: schedule.id,
          volunteerName: schedule.volunteer.nome,
          ministryName: schedule.ministry.nome,
          eventName: schedule.event.nome,
          eventDate: schedule.event.dataInicio,
          cancelledAt: schedule.updatedAt,
        }))
        .sort((a, b) => b.cancelledAt.getTime() - a.cancelledAt.getTime()),
    } satisfies OverviewReport;
  }

  async exportOverview(
    query: ReportsQueryDto,
    format: "csv" | "xlsx" | "pdf",
    actor: JwtPayload,
  ) {
    const report = await this.getOverview(query, actor);

    if (format === "xlsx") {
      return this.toXlsx(report);
    }

    if (format === "pdf") {
      return this.toPdf(report);
    }

    return this.toCsv(report);
  }

  async logExport(actorId: string, format: string, filters: ReportsQueryDto) {
    await this.auditLogsService.log({
      userId: actorId,
      action: "REPORT_EXPORTED",
      module: "REPORTS",
      targetId: format,
      newValue: toJsonValue(filters),
    });
  }

  private buildScheduleWhere(
    query: ReportsQueryDto,
    churchId: string,
  ): Prisma.ScheduleWhereInput {
    return {
      churchId,
      ministryId: query.ministryId,
      volunteerId: query.volunteerId,
      event: {
        dataInicio:
          query.from || query.to
            ? {
                gte: query.from ? new Date(query.from) : undefined,
                lte: query.to ? new Date(query.to) : undefined,
              }
            : undefined,
      },
    };
  }

  private buildVolunteerFrequency(
    schedules: Awaited<ReturnType<ReportsService["getOverview"]>> extends never
      ? never
      : Array<
          Prisma.ScheduleGetPayload<{
            include: {
              event: { select: { id: true; nome: true; dataInicio: true } };
              ministry: { select: { id: true; nome: true } };
              volunteer: { select: { id: true; nome: true; email: true } };
              attendance: true;
            };
          }>
        >,
  ) {
    const byVolunteer = new Map<string, VolunteerReportRow>();

    for (const schedule of schedules) {
      const key = `${schedule.volunteerId}:${schedule.ministryId}`;
      if (!byVolunteer.has(key)) {
        byVolunteer.set(key, {
          volunteerId: schedule.volunteerId,
          volunteerName: schedule.volunteer.nome,
          ministryName: schedule.ministry.nome,
          totalSchedules: 0,
          confirmed: 0,
          present: 0,
          late: 0,
          absent: 0,
          justified: 0,
          attendanceRate: 0,
          operationalScore: 0,
        });
      }

      const row = byVolunteer.get(key)!;
      row.totalSchedules += 1;
      this.applyAttendanceCounters(row, schedule.attendance?.status ?? null);
    }

    return Array.from(byVolunteer.values())
      .map((row) => this.finalizeScoreRow(row))
      .sort((a, b) => b.operationalScore - a.operationalScore);
  }

  private buildMinistryFrequency(
    schedules: Array<
      Prisma.ScheduleGetPayload<{
        include: {
          event: { select: { id: true; nome: true; dataInicio: true } };
          ministry: { select: { id: true; nome: true } };
          volunteer: { select: { id: true; nome: true; email: true } };
          attendance: true;
        };
      }>
    >,
  ) {
    const byMinistry = new Map<string, MinistryReportRow>();

    for (const schedule of schedules) {
      if (!byMinistry.has(schedule.ministryId)) {
        byMinistry.set(schedule.ministryId, {
          ministryId: schedule.ministryId,
          ministryName: schedule.ministry.nome,
          totalSchedules: 0,
          confirmed: 0,
          present: 0,
          late: 0,
          absent: 0,
          justified: 0,
          attendanceRate: 0,
          operationalScore: 0,
        });
      }

      const row = byMinistry.get(schedule.ministryId)!;
      row.totalSchedules += 1;
      this.applyAttendanceCounters(row, schedule.attendance?.status ?? null);
    }

    return Array.from(byMinistry.values())
      .map((row) => this.finalizeScoreRow(row))
      .sort((a, b) => b.operationalScore - a.operationalScore);
  }

  private buildMonthlyRanking(
    schedules: Array<
      Prisma.ScheduleGetPayload<{
        include: {
          event: { select: { id: true; nome: true; dataInicio: true } };
          ministry: { select: { id: true; nome: true } };
          volunteer: { select: { id: true; nome: true; email: true } };
          attendance: true;
        };
      }>
    >,
  ) {
    const rows = new Map<string, MonthlyRankingRow>();

    for (const schedule of schedules) {
      const month = schedule.event.dataInicio.toISOString().slice(0, 7);
      const key = `${month}:${schedule.volunteerId}:${schedule.ministryId}`;

      if (!rows.has(key)) {
        rows.set(key, {
          month,
          volunteerId: schedule.volunteerId,
          volunteerName: schedule.volunteer.nome,
          ministryName: schedule.ministry.nome,
          totalSchedules: 0,
          present: 0,
          late: 0,
          absent: 0,
          operationalScore: 0,
        });
      }

      const row = rows.get(key)!;
      row.totalSchedules += 1;

      switch (schedule.attendance?.status) {
        case AttendanceStatus.PRESENTE:
          row.present += 1;
          row.operationalScore += 10;
          break;
        case AttendanceStatus.CONFIRMADO:
          row.operationalScore += 7;
          break;
        case AttendanceStatus.ATRASADO:
          row.late += 1;
          row.operationalScore += 2;
          break;
        case AttendanceStatus.JUSTIFICADO:
          row.operationalScore += 4;
          break;
        case AttendanceStatus.AUSENTE:
          row.absent += 1;
          row.operationalScore -= 12;
          break;
        default:
          break;
      }
    }

    return Array.from(rows.values())
      .sort((a, b) => {
        if (a.month === b.month) {
          return b.operationalScore - a.operationalScore;
        }

        return b.month.localeCompare(a.month);
      })
      .slice(0, 20);
  }

  private buildAttendanceExceptions(
    schedules: Array<
      Prisma.ScheduleGetPayload<{
        include: {
          event: { select: { id: true; nome: true; dataInicio: true } };
          ministry: { select: { id: true; nome: true } };
          volunteer: { select: { id: true; nome: true; email: true } };
          attendance: true;
        };
      }>
    >,
  ) {
    const byVolunteer = new Map<string, AttendanceExceptionRow>();

    for (const schedule of schedules) {
      const status = schedule.attendance?.status;
      if (
        status !== AttendanceStatus.AUSENTE &&
        status !== AttendanceStatus.ATRASADO &&
        status !== AttendanceStatus.JUSTIFICADO
      ) {
        continue;
      }

      const key = `${schedule.volunteerId}:${schedule.ministryId}`;
      if (!byVolunteer.has(key)) {
        byVolunteer.set(key, {
          volunteerId: schedule.volunteerId,
          volunteerName: schedule.volunteer.nome,
          ministryName: schedule.ministry.nome,
          absent: 0,
          late: 0,
          justified: 0,
          latestEventDate: null,
          riskLevel: "BAIXO",
        });
      }

      const row = byVolunteer.get(key)!;
      if (status === AttendanceStatus.AUSENTE) {
        row.absent += 1;
      }
      if (status === AttendanceStatus.ATRASADO) {
        row.late += 1;
      }
      if (status === AttendanceStatus.JUSTIFICADO) {
        row.justified += 1;
      }
      row.latestEventDate =
        !row.latestEventDate || row.latestEventDate < schedule.event.dataInicio
          ? schedule.event.dataInicio
          : row.latestEventDate;

      const riskScore = row.absent * 2 + row.late;
      row.riskLevel =
        riskScore >= 4 ? "ALTO" : riskScore >= 2 ? "MEDIO" : "BAIXO";
    }

    return Array.from(byVolunteer.values()).sort((a, b) => {
      const riskWeight = { ALTO: 3, MEDIO: 2, BAIXO: 1 };
      return (
        riskWeight[b.riskLevel] - riskWeight[a.riskLevel] || b.absent - a.absent
      );
    });
  }

  private buildCompletedSchedules(
    schedules: Array<
      Prisma.ScheduleGetPayload<{
        include: {
          event: { select: { id: true; nome: true; dataInicio: true } };
          ministry: { select: { id: true; nome: true } };
          volunteer: { select: { id: true; nome: true; email: true } };
          attendance: true;
        };
      }>
    >,
  ) {
    const byEvent = new Map<string, EventScheduleRow>();

    for (const schedule of schedules) {
      if (!byEvent.has(schedule.eventId)) {
        byEvent.set(schedule.eventId, {
          eventId: schedule.eventId,
          eventName: schedule.event.nome,
          eventDate: schedule.event.dataInicio,
          totalSchedules: 0,
          completedSchedules: 0,
          confirmed: 0,
          present: 0,
          late: 0,
          absent: 0,
        });
      }

      const row = byEvent.get(schedule.eventId)!;
      row.totalSchedules += 1;

      switch (schedule.attendance?.status) {
        case AttendanceStatus.CONFIRMADO:
          row.confirmed += 1;
          row.completedSchedules += 1;
          break;
        case AttendanceStatus.PRESENTE:
          row.present += 1;
          row.completedSchedules += 1;
          break;
        case AttendanceStatus.ATRASADO:
          row.late += 1;
          row.completedSchedules += 1;
          break;
        case AttendanceStatus.AUSENTE:
          row.absent += 1;
          row.completedSchedules += 1;
          break;
        case AttendanceStatus.JUSTIFICADO:
          row.completedSchedules += 1;
          break;
        default:
          break;
      }
    }

    return Array.from(byEvent.values()).sort(
      (a, b) => b.eventDate.getTime() - a.eventDate.getTime(),
    );
  }

  private buildInactiveVolunteers(
    volunteers: Array<{ id: string; nome: string; email: string }>,
    frequencyByVolunteer: VolunteerReportRow[],
  ) {
    const byVolunteer = new Map<
      string,
      {
        totalSchedules: number;
        lastEventDate: Date | null;
        volunteerName: string;
        email: string;
      }
    >();

    for (const volunteer of volunteers) {
      byVolunteer.set(volunteer.id, {
        totalSchedules: 0,
        lastEventDate: null,
        volunteerName: volunteer.nome,
        email: volunteer.email,
      });
    }

    for (const row of frequencyByVolunteer) {
      const current = byVolunteer.get(row.volunteerId);
      if (!current) {
        continue;
      }

      current.totalSchedules += row.totalSchedules;
    }

    return Array.from(byVolunteer.entries())
      .filter(([, row]) => row.totalSchedules === 0)
      .map(([volunteerId, row]) => ({
        volunteerId,
        volunteerName: row.volunteerName,
        email: row.email,
        totalSchedules: row.totalSchedules,
        lastEventDate: row.lastEventDate,
        status: "SEM_ESCALA" as const,
      }))
      .sort((a, b) => a.volunteerName.localeCompare(b.volunteerName));
  }

  private applyAttendanceCounters(
    row: {
      confirmed: number;
      present: number;
      late: number;
      absent: number;
      justified: number;
    },
    status: AttendanceStatus | null,
  ) {
    switch (status) {
      case AttendanceStatus.CONFIRMADO:
        row.confirmed += 1;
        break;
      case AttendanceStatus.PRESENTE:
        row.present += 1;
        break;
      case AttendanceStatus.ATRASADO:
        row.late += 1;
        break;
      case AttendanceStatus.AUSENTE:
        row.absent += 1;
        break;
      case AttendanceStatus.JUSTIFICADO:
        row.justified += 1;
        break;
      default:
        break;
    }
  }

  private finalizeScoreRow<
    T extends {
      totalSchedules: number;
      confirmed: number;
      present: number;
      late: number;
      absent: number;
      justified: number;
      attendanceRate: number;
      operationalScore: number;
    },
  >(row: T) {
    const attended = row.present + row.late + row.confirmed;
    const attendanceRate = row.totalSchedules
      ? (attended / row.totalSchedules) * 100
      : 0;

    const operationalScore =
      row.present * 10 +
      row.confirmed * 7 +
      row.justified * 4 +
      row.late * 2 -
      row.absent * 12;

    return {
      ...row,
      attendanceRate: Number(attendanceRate.toFixed(2)),
      operationalScore,
    };
  }

  private async toXlsx(report: OverviewReport) {
    const workbook = new ExcelJS.Workbook();
    const overviewSheet = workbook.addWorksheet("Frequencia Voluntarios");

    overviewSheet.columns = [
      { header: "Voluntario", key: "volunteerName", width: 28 },
      { header: "Ministerio", key: "ministryName", width: 24 },
      { header: "Escalas", key: "totalSchedules", width: 12 },
      { header: "Confirmado", key: "confirmed", width: 12 },
      { header: "Presente", key: "present", width: 12 },
      { header: "Atrasado", key: "late", width: 12 },
      { header: "Ausente", key: "absent", width: 12 },
      { header: "Justificado", key: "justified", width: 12 },
      { header: "Taxa (%)", key: "attendanceRate", width: 12 },
      { header: "Score", key: "operationalScore", width: 12 },
    ];

    for (const row of report.frequencyByVolunteer) {
      overviewSheet.addRow(row);
    }

    const ministrySheet = workbook.addWorksheet("Frequencia Ministerios");
    ministrySheet.columns = [
      { header: "Ministerio", key: "ministryName", width: 24 },
      { header: "Escalas", key: "totalSchedules", width: 12 },
      { header: "Confirmado", key: "confirmed", width: 12 },
      { header: "Presente", key: "present", width: 12 },
      { header: "Atrasado", key: "late", width: 12 },
      { header: "Ausente", key: "absent", width: 12 },
      { header: "Justificado", key: "justified", width: 12 },
      { header: "Taxa (%)", key: "attendanceRate", width: 12 },
      { header: "Score", key: "operationalScore", width: 12 },
    ];

    for (const row of report.frequencyByMinistry) {
      ministrySheet.addRow(row);
    }

    const rankingSheet = workbook.addWorksheet("Ranking Mensal");
    rankingSheet.columns = [
      { header: "Mes", key: "month", width: 12 },
      { header: "Voluntario", key: "volunteerName", width: 24 },
      { header: "Ministerio", key: "ministryName", width: 20 },
      { header: "Escalas", key: "totalSchedules", width: 12 },
      { header: "Presente", key: "present", width: 12 },
      { header: "Atrasado", key: "late", width: 12 },
      { header: "Ausente", key: "absent", width: 12 },
      { header: "Score", key: "operationalScore", width: 12 },
    ];

    for (const row of report.monthlyRanking) {
      rankingSheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private toCsv(report: OverviewReport) {
    const header = [
      "voluntario",
      "ministerio",
      "escalas",
      "confirmado",
      "presente",
      "atrasado",
      "ausente",
      "justificado",
      "taxa_percentual",
      "score_operacional",
    ];

    const lines = report.frequencyByVolunteer.map((row) => {
      const cells = [
        row.volunteerName,
        row.ministryName,
        row.totalSchedules,
        row.confirmed,
        row.present,
        row.late,
        row.absent,
        row.justified,
        row.attendanceRate,
        row.operationalScore,
      ];

      return cells
        .map((value) => {
          const text = String(value ?? "").replaceAll('"', '""');
          return `"${text}"`;
        })
        .join(",");
    });

    return Buffer.from([header.join(","), ...lines].join("\n"), "utf-8");
  }

  private toPdf(report: OverviewReport) {
    return new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(16).text("Relatorio de Presenca e Performance", {
        align: "left",
      });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .fillColor("#666")
        .text(`Filtros: ${JSON.stringify(report.filters)}`)
        .fillColor("#000");
      doc.moveDown();

      doc
        .fontSize(11)
        .text(
          `Resumo: Escalas ${report.totals.schedules} | Presente ${report.totals.present} | Atrasado ${report.totals.late} | Ausente ${report.totals.absent} | Taxa ${report.totals.attendanceRate}%`,
        );
      doc.moveDown();

      for (const row of report.frequencyByVolunteer.slice(0, 30)) {
        doc
          .fontSize(10)
          .text(
            `${row.volunteerName} | ${row.ministryName} | Escalas: ${row.totalSchedules} | Presente: ${row.present} | Atrasado: ${row.late} | Ausente: ${row.absent} | Score: ${row.operationalScore}`,
          );
      }

      if (report.attendanceExceptions.length > 0) {
        doc.moveDown();
        doc.fontSize(12).text("Faltas e atrasos");
        doc.moveDown(0.5);

        for (const row of report.attendanceExceptions.slice(0, 12)) {
          doc
            .fontSize(10)
            .text(
              `${row.volunteerName} | ${row.ministryName} | Faltas: ${row.absent} | Atrasos: ${row.late} | Risco: ${row.riskLevel}`,
            );
        }
      }

      doc.end();
    });
  }
}
