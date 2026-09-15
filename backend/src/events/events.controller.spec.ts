import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { Perfil } from "@prisma/client";
import { JwtPayload } from "../auth/strategies/jwt.strategy";

describe("EventsController — Google Calendar Sync", () => {
  let controller: EventsController;
  let eventsService: {
    syncEventToGoogle: jest.Mock;
    unlinkEventFromGoogle: jest.Mock;
  };

  const adminUser: JwtPayload = {
    sub: "user-1",
    email: "admin@test.com",
    perfil: Perfil.ADMIN,
    churchId: "church-1",
    churchSlug: "church-1",
  };

  beforeEach(async () => {
    eventsService = {
      syncEventToGoogle: jest.fn(),
      unlinkEventFromGoogle: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    controller = module.get<EventsController>(EventsController);
  });

  describe("POST /events/:id/sync-google", () => {
    it("should sync event to Google Calendar", async () => {
      eventsService.syncEventToGoogle.mockResolvedValue({
        eventId: "evt-1",
        schedules: [
          { scheduleId: "s1", userId: "user-1", synced: true, googleEventId: "escala-s1", status: "SYNCED" },
        ],
      });

      const result = await controller.syncGoogle("evt-1", adminUser);

      expect(result.schedules[0].status).toBe("SYNCED");
      expect(result.schedules[0].googleEventId).toBe("escala-s1");
      expect(eventsService.syncEventToGoogle).toHaveBeenCalledWith(
        "evt-1",
        adminUser,
      );
    });

    it("should propagate NotFoundException", async () => {
      eventsService.syncEventToGoogle.mockRejectedValue(
        new NotFoundException("Evento não encontrado."),
      );

      await expect(
        controller.syncGoogle("evt-999", adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should propagate BadRequestException for no connection", async () => {
      eventsService.syncEventToGoogle.mockRejectedValue(
        new BadRequestException("Google Calendar não conectado."),
      );

      await expect(
        controller.syncGoogle("evt-1", adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("should propagate ForbiddenException for cross-tenant", async () => {
      eventsService.syncEventToGoogle.mockRejectedValue(
        new NotFoundException("Evento não encontrado."),
      );

      await expect(
        controller.syncGoogle("evt-1", {
          ...adminUser,
          churchId: "church-2",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("DELETE /events/:id/sync-google", () => {
    it("should unlink event from Google Calendar", async () => {
      eventsService.unlinkEventFromGoogle.mockResolvedValue({
        eventId: "evt-1",
        success: true,
        errors: [],
      });

      const result = await controller.unlinkGoogle("evt-1", adminUser);

      expect(result.success).toBe(true);
      expect(eventsService.unlinkEventFromGoogle).toHaveBeenCalledWith(
        "evt-1",
        adminUser,
      );
    });

    it("should propagate NotFoundException", async () => {
      eventsService.unlinkEventFromGoogle.mockRejectedValue(
        new NotFoundException("Evento não encontrado."),
      );

      await expect(
        controller.unlinkGoogle("evt-999", adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return success even when no googleEventId", async () => {
      eventsService.unlinkEventFromGoogle.mockResolvedValue({
        eventId: "evt-1",
        success: true,
        errors: [],
      });

      const result = await controller.unlinkGoogle("evt-1", adminUser);

      expect(result.success).toBe(true);
    });

    it("should return error result when Google deletion fails", async () => {
      eventsService.unlinkEventFromGoogle.mockResolvedValue({
        eventId: "evt-1",
        success: false,
        errors: ["API error"],
      });

      const result = await controller.unlinkGoogle("evt-1", adminUser);

      expect(result.success).toBe(false);
      expect(result.errors).toContain("API error");
    });
  });
});
