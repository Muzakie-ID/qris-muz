import { validateEnv } from './env';

const KEY_B64 = Buffer.alloc(32, 7).toString('base64');
const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  APP_ENCRYPTION_KEY: KEY_B64,
};

describe('validateEnv', () => {
  it('memakai nilai bawaan yang aman', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      PORT: 3001,
      PUBLIC_API_URL: 'http://localhost:3001',
      CHECKOUT_BASE_URL: 'http://localhost:3000',
      ADMIN_TOKEN: null,
      QRIS_STATIC_PAYLOAD: null,
      QRIS_MAX_AMOUNT: 10_000_000,
      QRIS_TOOLS_ENABLED: false,
      UNIQUE_CODE_GRACE_HOURS: 24,
      JOBS_ENABLED: true,
    });
    expect(env.APP_ENCRYPTION_KEY).toHaveLength(32);
  });

  it('membaca nilai dari env', () => {
    expect(
      validateEnv({
        ...base,
        PORT: '4000',
        QRIS_STATIC_PAYLOAD: ' 000201 \n',
        QRIS_MAX_AMOUNT: '5000000',
        QRIS_TOOLS_ENABLED: 'TRUE',
        PUBLIC_API_URL: 'https://api.contoh.id/',
        JOBS_ENABLED: 'false',
      }),
    ).toMatchObject({
      PORT: 4000,
      QRIS_STATIC_PAYLOAD: '000201',
      QRIS_MAX_AMOUNT: 5_000_000,
      QRIS_TOOLS_ENABLED: true,
      PUBLIC_API_URL: 'https://api.contoh.id',
      JOBS_ENABLED: false,
    });
  });

  it('menerima kunci enkripsi dalam hex', () => {
    const hex = Buffer.alloc(32, 1).toString('hex');
    expect(
      validateEnv({ ...base, APP_ENCRYPTION_KEY: hex }).APP_ENCRYPTION_KEY,
    ).toEqual(Buffer.alloc(32, 1));
  });

  it('menolak konfigurasi yang salah', () => {
    expect(() => validateEnv({ ...base, QRIS_MAX_AMOUNT: 'abc' })).toThrow(
      'QRIS_MAX_AMOUNT',
    );
    expect(() => validateEnv({ ...base, PORT: '-1' })).toThrow('PORT');
    expect(() => validateEnv({ APP_ENCRYPTION_KEY: KEY_B64 })).toThrow(
      'DATABASE_URL',
    );
    expect(() =>
      validateEnv({ ...base, APP_ENCRYPTION_KEY: 'pendek' }),
    ).toThrow('APP_ENCRYPTION_KEY');
    expect(() => validateEnv({ ...base, ADMIN_TOKEN: 'abc' })).toThrow(
      'ADMIN_TOKEN',
    );
    expect(() => validateEnv({ ...base, PUBLIC_API_URL: 'bukan url' })).toThrow(
      'PUBLIC_API_URL',
    );
  });
});
