import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { newId } from '../common/ids';
import { DB, type Db } from '../db/db.module';
import { parsers } from '../db/schema';
import { parseNotification, type ParserRule } from './parser';

export type ParserRow = typeof parsers.$inferSelect;

export interface ParserInput {
  packageName?: string | null;
  pattern?: string;
  priority?: number;
  autoMatch?: boolean;
  isActive?: boolean;
}

/**
 * Pola harus regex yang valid dan punya minimal satu grup tangkap untuk nominal.
 * Melempar 400 dengan pesan yang bisa ditampilkan ke owner.
 */
export function assertValidPattern(pattern: string): void {
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'i');
  } catch (e) {
    throw new BadRequestException(
      `Pola regex tidak valid: ${(e as Error).message}`,
    );
  }
  const groups = new RegExp(`${re.source}|`).exec('')!.length - 1;
  if (groups < 1) {
    throw new BadRequestException(
      'Pola harus punya satu grup tangkap untuk nominal, mis. Rp\\s?([\\d.,]+).',
    );
  }
}

function toRule(r: ParserRow): ParserRule {
  return {
    id: r.id,
    packageName: r.packageName,
    pattern: r.pattern,
    priority: r.priority,
    autoMatch: r.autoMatch,
  };
}

/** Pengelolaan pola pembaca nominal dari dashboard. */
@Injectable()
export class ParsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return this.db.query.parsers.findMany({
      orderBy: [asc(parsers.priority), asc(parsers.id)],
    });
  }

  async create(input: ParserInput & { pattern: string }) {
    assertValidPattern(input.pattern);
    const [row] = await this.db
      .insert(parsers)
      .values({
        id: newId.parser(),
        packageName: input.packageName || null,
        pattern: input.pattern,
        priority: input.priority ?? 100,
        autoMatch: input.autoMatch ?? true,
        isActive: input.isActive ?? true,
      })
      .returning();
    return row;
  }

  async update(id: string, input: ParserInput) {
    if (input.pattern !== undefined) assertValidPattern(input.pattern);
    const [row] = await this.db
      .update(parsers)
      .set({
        ...(input.packageName !== undefined && {
          packageName: input.packageName || null,
        }),
        ...(input.pattern !== undefined && { pattern: input.pattern }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.autoMatch !== undefined && { autoMatch: input.autoMatch }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(parsers.id, id))
      .returning();
    if (!row) throw new NotFoundException('Parser tidak ditemukan.');
    return row;
  }

  /**
   * Uji teks notifikasi. Bila `pattern` diisi, hanya pola itu yang diuji (untuk mencoba
   * pola baru sebelum disimpan); bila tidak, semua parser aktif dipakai seperti di produksi.
   */
  async test(input: {
    packageName?: string;
    title?: string;
    text: string;
    pattern?: string;
  }) {
    let rules: ParserRule[];
    if (input.pattern) {
      assertValidPattern(input.pattern);
      rules = [
        {
          id: 'uji',
          packageName: null,
          pattern: input.pattern,
          priority: 0,
          autoMatch: true,
        },
      ];
    } else {
      rules = (await this.list()).filter((r) => r.isActive).map(toRule);
    }
    const result = parseNotification(
      {
        packageName: input.packageName ?? '',
        title: input.title,
        text: input.text,
      },
      rules,
    );
    return result
      ? {
          matched: true,
          amount: result.amount,
          parser_id: result.parserId,
          auto_match: result.autoMatch,
        }
      : { matched: false, amount: null, parser_id: null, auto_match: null };
  }
}
