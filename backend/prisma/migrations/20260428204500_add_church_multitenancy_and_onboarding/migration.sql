-- Ensure enum values and enums required by current Prisma schema exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'Perfil' AND e.enumlabel = 'MASTER_PLATFORM_ADMIN'
  ) THEN
    ALTER TYPE "Perfil" ADD VALUE 'MASTER_PLATFORM_ADMIN';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApprovalPolicy') THEN
    CREATE TYPE "ApprovalPolicy" AS ENUM ('MANUAL', 'AUTO');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArticleCategory') THEN
    CREATE TYPE "ArticleCategory" AS ENUM (
      'LOGIN_ACESSO',
      'ESCALAS',
      'TROCA_ESCALA',
      'APROVACAO_VOLUNTARIOS',
      'NOTIFICACOES',
      'ADMIN_MASTER',
      'CONFIGURACOES',
      'GERAL'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeedbackType') THEN
    CREATE TYPE "FeedbackType" AS ENUM (
      'BUG_REPORT',
      'FEATURE_REQUEST',
      'GENERAL_FEEDBACK',
      'IMPROVEMENT'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeedbackStatus') THEN
    CREATE TYPE "FeedbackStatus" AS ENUM ('ABERTO', 'EM_ANALISE', 'RESOLVIDO', 'FECHADO');
  END IF;
END
$$;

-- Core church table used by onboarding
CREATE TABLE IF NOT EXISTS "Church" (
  "id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "endereco" TEXT,
  "cidade" TEXT,
  "estado" TEXT,
  "logo" TEXT,
  "responsavelPrincipal" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Church_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Church_slug_key" ON "Church"("slug");
CREATE INDEX IF NOT EXISTS "Church_ativo_idx" ON "Church"("ativo");

-- Add church-scoped columns expected by current Prisma schema
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Ministry" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "churchId" TEXT;

CREATE INDEX IF NOT EXISTS "User_churchId_idx" ON "User"("churchId");
CREATE INDEX IF NOT EXISTS "Ministry_churchId_idx" ON "Ministry"("churchId");
CREATE INDEX IF NOT EXISTS "Event_churchId_idx" ON "Event"("churchId");
CREATE INDEX IF NOT EXISTS "Schedule_churchId_idx" ON "Schedule"("churchId");
CREATE INDEX IF NOT EXISTS "Notification_churchId_idx" ON "Notification"("churchId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_churchId_idx" ON "AttendanceRecord"("churchId");
CREATE INDEX IF NOT EXISTS "AuditLog_churchId_idx" ON "AuditLog"("churchId");

-- Multi-tenant uniqueness for ministries
CREATE UNIQUE INDEX IF NOT EXISTS "Ministry_churchId_nome_key" ON "Ministry"("churchId", "nome");

-- Branding/settings/subscription tables used during onboarding
CREATE TABLE IF NOT EXISTS "ChurchSettings" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "customChurchName" TEXT,
  "customPlatformName" TEXT,
  "logoUrl" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#0EA5E9',
  "secondaryColor" TEXT NOT NULL DEFAULT '#22D3EE',
  "accentColor" TEXT NOT NULL DEFAULT '#F59E0B',
  "defaultEmailFrom" TEXT,
  "approvalPolicy" "ApprovalPolicy" NOT NULL DEFAULT 'MANUAL',
  "swapRules" JSONB,
  "defaultServiceDays" JSONB,
  "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 1440,
  "scoreRules" JSONB,
  "customDomain" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChurchSettings_churchId_key" ON "ChurchSettings"("churchId");

CREATE TABLE IF NOT EXISTS "ChurchSubscription" (
  "id" TEXT NOT NULL,
  "churchId" TEXT NOT NULL,
  "planName" TEXT NOT NULL DEFAULT 'STARTER',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "trialEndsAt" TIMESTAMP(3),
  "maxUsers" INTEGER,
  "maxMinistries" INTEGER,
  "maxEventsPerMonth" INTEGER,
  "billingEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChurchSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChurchSubscription_churchId_key" ON "ChurchSubscription"("churchId");

-- Extra schema entities already referenced in codebase
CREATE TABLE IF NOT EXISTS "PlatformBranding" (
  "id" TEXT NOT NULL,
  "appName" TEXT NOT NULL DEFAULT 'Escala SaaS',
  "appLogoUrl" TEXT,
  "appPrimaryColor" TEXT NOT NULL DEFAULT '#0EA5E9',
  "appSecondaryColor" TEXT NOT NULL DEFAULT '#22D3EE',
  "appAccentColor" TEXT NOT NULL DEFAULT '#F59E0B',
  "supportEmail" TEXT,
  "websiteUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformBranding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HelpArticle" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "conteudo" TEXT NOT NULL,
  "categoria" "ArticleCategory" NOT NULL DEFAULT 'GERAL',
  "tags" TEXT[] NOT NULL,
  "publicado" BOOLEAN NOT NULL DEFAULT true,
  "visualizacoes" INTEGER NOT NULL DEFAULT 0,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HelpArticle_slug_key" ON "HelpArticle"("slug");
CREATE INDEX IF NOT EXISTS "HelpArticle_categoria_idx" ON "HelpArticle"("categoria");
CREATE INDEX IF NOT EXISTS "HelpArticle_publicado_idx" ON "HelpArticle"("publicado");

CREATE TABLE IF NOT EXISTS "UserFeedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "churchId" TEXT,
  "tipo" "FeedbackType" NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'ABERTO',
  "paginaOrigem" TEXT,
  "avaliacao" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserFeedback_userId_idx" ON "UserFeedback"("userId");
CREATE INDEX IF NOT EXISTS "UserFeedback_churchId_idx" ON "UserFeedback"("churchId");
CREATE INDEX IF NOT EXISTS "UserFeedback_tipo_idx" ON "UserFeedback"("tipo");

-- Foreign keys (created conditionally to keep migration re-runnable)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_churchId_fkey') THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ministry_churchId_fkey') THEN
    ALTER TABLE "Ministry"
      ADD CONSTRAINT "Ministry_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Event_churchId_fkey') THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Schedule_churchId_fkey') THEN
    ALTER TABLE "Schedule"
      ADD CONSTRAINT "Schedule_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_churchId_fkey') THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AttendanceRecord_churchId_fkey') THEN
    ALTER TABLE "AttendanceRecord"
      ADD CONSTRAINT "AttendanceRecord_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_churchId_fkey') THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChurchSettings_churchId_fkey') THEN
    ALTER TABLE "ChurchSettings"
      ADD CONSTRAINT "ChurchSettings_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ChurchSubscription_churchId_fkey') THEN
    ALTER TABLE "ChurchSubscription"
      ADD CONSTRAINT "ChurchSubscription_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserFeedback_userId_fkey') THEN
    ALTER TABLE "UserFeedback"
      ADD CONSTRAINT "UserFeedback_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserFeedback_churchId_fkey') THEN
    ALTER TABLE "UserFeedback"
      ADD CONSTRAINT "UserFeedback_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
