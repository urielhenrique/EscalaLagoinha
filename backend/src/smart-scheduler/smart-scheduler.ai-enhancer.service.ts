import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class SmartSchedulerAiEnhancerService {
  private readonly logger = new Logger(SmartSchedulerAiEnhancerService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateAdministrativeInsights(input: {
    eventName: string;
    ministryNames: string[];
    highRiskCount: number;
    overloadedCount: number;
    underutilizedCount: number;
  }): Promise<string | null> {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY")?.trim();
    const model =
      this.configService.get<string>("OPENAI_MODEL")?.trim() || "gpt-4o-mini";

    if (!apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.3,
            messages: [
              {
                role: "system",
                content:
                  "Você é um especialista em gestão de voluntários de igreja. Gere insights curtos, práticos e acionáveis em pt-BR.",
              },
              {
                role: "user",
                content: [
                  `Evento: ${input.eventName}`,
                  `Ministérios envolvidos: ${input.ministryNames.join(", ") || "não informado"}`,
                  `Voluntários com alto risco de ausência: ${input.highRiskCount}`,
                  `Voluntários potencialmente sobrecarregados: ${input.overloadedCount}`,
                  `Voluntários pouco escalados: ${input.underutilizedCount}`,
                  "Gere 3 recomendações diretas para o administrador.",
                ].join("\n"),
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `OpenAI retornou status ${response.status}. Seguindo com heurística local.`,
        );
        return null;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim();
      return content || null;
    } catch (error) {
      this.logger.warn(
        "Falha ao obter insights da OpenAI. Usando fallback local.",
      );
      return null;
    }
  }
}
