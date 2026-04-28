import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtPayload } from "../auth/strategies/jwt.strategy";
import { ResponseMessage } from "../common/decorators/response-message.decorator";
import { CreateSwapRequestDto } from "./dto/create-swap-request.dto";
import { SwapRequestsService } from "./swap-requests.service";

@ApiTags("Swap Requests")
@ApiBearerAuth("JWT-auth")
@Controller("swap-requests")
export class SwapRequestsController {
  constructor(private readonly swapRequestsService: SwapRequestsService) {}

  @Get("eligible/:requesterShiftId")
  @ApiOperation({ summary: "Listar candidatos elegíveis para troca" })
  @ApiOkResponse({ description: "Candidatos listados com sucesso." })
  @ResponseMessage("Candidatos listados com sucesso.")
  listEligible(
    @Param("requesterShiftId", new ParseUUIDPipe()) requesterShiftId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.swapRequestsService.listEligibleCandidates(
      requesterShiftId,
      user,
    );
  }

  @Post()
  @ApiOperation({ summary: "Criar solicitação de troca" })
  @ApiOkResponse({ description: "Solicitação criada com sucesso." })
  @ResponseMessage("Solicitação de troca criada com sucesso.")
  create(@Body() dto: CreateSwapRequestDto, @CurrentUser() user: JwtPayload) {
    return this.swapRequestsService.create(dto, user);
  }

  @Get("my-requests")
  @ApiOperation({ summary: "Listar solicitações enviadas pelo usuário" })
  @ApiOkResponse({ description: "Solicitações enviadas listadas com sucesso." })
  @ResponseMessage("Solicitações enviadas listadas com sucesso.")
  myRequests(@CurrentUser() user: JwtPayload) {
    return this.swapRequestsService.findMyRequests(user);
  }

  @Get("received")
  @ApiOperation({ summary: "Listar solicitações recebidas pelo usuário" })
  @ApiOkResponse({
    description: "Solicitações recebidas listadas com sucesso.",
  })
  @ResponseMessage("Solicitações recebidas listadas com sucesso.")
  received(@CurrentUser() user: JwtPayload) {
    return this.swapRequestsService.findReceivedRequests(user);
  }

  @Get("history")
  @ApiOperation({ summary: "Listar histórico de solicitações do usuário" })
  @ApiOkResponse({ description: "Histórico listado com sucesso." })
  @ResponseMessage("Histórico de trocas listado com sucesso.")
  history(@CurrentUser() user: JwtPayload) {
    return this.swapRequestsService.findHistory(user);
  }

  @Patch(":id/approve")
  @ApiOperation({ summary: "Aprovar solicitação recebida" })
  @ApiOkResponse({ description: "Solicitação aprovada com sucesso." })
  @ResponseMessage("Solicitação aprovada com sucesso.")
  approve(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.swapRequestsService.approve(id, user);
  }

  @Patch(":id/reject")
  @ApiOperation({ summary: "Recusar solicitação recebida" })
  @ApiOkResponse({ description: "Solicitação recusada com sucesso." })
  @ResponseMessage("Solicitação recusada com sucesso.")
  reject(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.swapRequestsService.reject(id, user);
  }

  @Patch(":id/cancel")
  @ApiOperation({ summary: "Cancelar solicitação enviada" })
  @ApiOkResponse({ description: "Solicitação cancelada com sucesso." })
  @ResponseMessage("Solicitação cancelada com sucesso.")
  cancel(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.swapRequestsService.cancel(id, user);
  }
}
