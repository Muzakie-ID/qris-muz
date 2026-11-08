import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { randomToken, sha256Hex } from '../common/crypto';
import { newId } from '../common/ids';
import { SecretsService } from '../common/secrets.service';
import { DB, type Db } from '../db/db.module';
import { apiKeys, projects, qrisSources } from '../db/schema';

export type Project = typeof projects.$inferSelect;

export interface CreateProjectInput {
  name: string;
  webhookUrl?: string | null;
  defaultReturnUrl?: string | null;
  defaultQrisSourceId?: string | null;
  defaultExpiryMin?: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly secrets: SecretsService,
  ) {}

  /** Membuat proyek. webhookSecret hanya dikembalikan sekali di sini. */
  async create(input: CreateProjectInput) {
    if (input.defaultQrisSourceId)
      await this.assertQris(input.defaultQrisSourceId);
    const webhookSecret = `whsec_${randomToken(24)}`;
    const [project] = await this.db
      .insert(projects)
      .values({
        id: newId.project(),
        name: input.name,
        webhookUrl: input.webhookUrl ?? null,
        defaultReturnUrl: input.defaultReturnUrl ?? null,
        defaultQrisSourceId: input.defaultQrisSourceId ?? null,
        defaultExpiryMin: input.defaultExpiryMin ?? 15,
        webhookSecretEnc: this.secrets.seal(webhookSecret),
      })
      .returning();
    return { project, webhookSecret };
  }

  async update(id: string, input: Partial<CreateProjectInput>) {
    if (input.defaultQrisSourceId)
      await this.assertQris(input.defaultQrisSourceId);
    const [project] = await this.db
      .update(projects)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.webhookUrl !== undefined && { webhookUrl: input.webhookUrl }),
        ...(input.defaultReturnUrl !== undefined && {
          defaultReturnUrl: input.defaultReturnUrl,
        }),
        ...(input.defaultQrisSourceId !== undefined && {
          defaultQrisSourceId: input.defaultQrisSourceId,
        }),
        ...(input.defaultExpiryMin !== undefined && {
          defaultExpiryMin: input.defaultExpiryMin,
        }),
      })
      .where(eq(projects.id, id))
      .returning();
    if (!project) throw new NotFoundException('Proyek tidak ditemukan.');
    return project;
  }

  async get(id: string): Promise<Project> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
    if (!project) throw new NotFoundException('Proyek tidak ditemukan.');
    return project;
  }

  list() {
    return this.db.query.projects.findMany({
      orderBy: (p, { asc }) => [asc(p.createdAt)],
    });
  }

  webhookSecret(project: Project): string {
    return this.secrets.open(project.webhookSecretEnc);
  }

  /** Membuat API key. Key asli hanya dikembalikan sekali; yang disimpan hash-nya. */
  async createApiKey(projectId: string) {
    await this.get(projectId);
    const key = `qm_live_${randomToken(24)}`;
    const [row] = await this.db
      .insert(apiKeys)
      .values({
        id: newId.apiKey(),
        projectId,
        keyHash: sha256Hex(key),
        prefix: key.slice(0, 12),
      })
      .returning({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        createdAt: apiKeys.createdAt,
      });
    return { ...row, key };
  }

  /** Daftar API key proyek (tanpa key asli; hanya prefix). */
  async listApiKeys(projectId: string) {
    await this.get(projectId);
    return this.db
      .select({
        id: apiKeys.id,
        prefix: apiKeys.prefix,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.projectId, projectId))
      .orderBy(apiKeys.createdAt);
  }

  async revokeApiKey(keyId: string) {
    const [row] = await this.db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
      .returning({ id: apiKeys.id });
    if (!row)
      throw new NotFoundException(
        'API key tidak ditemukan atau sudah dicabut.',
      );
  }

  /** Mencari proyek dari API key yang dikirim klien. */
  async findByApiKey(key: string): Promise<Project | null> {
    const row = await this.db
      .select({ project: projects, keyId: apiKeys.id })
      .from(apiKeys)
      .innerJoin(projects, eq(apiKeys.projectId, projects.id))
      .where(
        and(eq(apiKeys.keyHash, sha256Hex(key)), isNull(apiKeys.revokedAt)),
      )
      .limit(1);
    if (!row[0]) return null;
    void this.db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row[0].keyId))
      .catch(() => undefined);
    return row[0].project;
  }

  private async assertQris(id: string) {
    const q = await this.db.query.qrisSources.findFirst({
      where: eq(qrisSources.id, id),
    });
    if (!q) throw new NotFoundException(`QRIS ${id} tidak ditemukan.`);
  }
}
