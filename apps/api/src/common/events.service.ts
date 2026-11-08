import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { Observable } from 'rxjs';

const ANY = Symbol('any');

export interface TransactionChanged {
  transactionId: string;
  status: string;
}

/**
 * Kabar perubahan status transaksi di dalam proses, untuk halaman checkout (SSE).
 * Cukup untuk satu instance server; bila nanti lebih dari satu, ganti dengan pub/sub.
 */
@Injectable()
export class TransactionEvents {
  private readonly emitter = new EventEmitter().setMaxListeners(0);

  emit(change: TransactionChanged): void {
    this.emitter.emit(change.transactionId, change);
    this.emitter.emit(ANY, change);
  }

  /** Semua perubahan status, mis. untuk notifikasi Telegram. Mengembalikan fungsi berhenti. */
  onAny(handler: (c: TransactionChanged) => void): () => void {
    this.emitter.on(ANY, handler);
    return () => this.emitter.off(ANY, handler);
  }

  watch(transactionId: string): Observable<TransactionChanged> {
    return new Observable((subscriber) => {
      const handler = (c: TransactionChanged) => subscriber.next(c);
      this.emitter.on(transactionId, handler);
      return () => this.emitter.off(transactionId, handler);
    });
  }
}
