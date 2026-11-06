import { validateEnv } from './env';

describe('validateEnv', () => {
  it('memakai nilai bawaan yang aman', () => {
    expect(validateEnv({})).toEqual({
      PORT: 3001,
      QRIS_STATIC_PAYLOAD: null,
      QRIS_MAX_AMOUNT: 10_000_000,
      QRIS_TOOLS_ENABLED: false,
    });
  });

  it('membaca nilai dari env', () => {
    expect(
      validateEnv({
        PORT: '4000',
        QRIS_STATIC_PAYLOAD: ' 000201 \n',
        QRIS_MAX_AMOUNT: '5000000',
        QRIS_TOOLS_ENABLED: 'TRUE',
      }),
    ).toEqual({
      PORT: 4000,
      QRIS_STATIC_PAYLOAD: '000201',
      QRIS_MAX_AMOUNT: 5_000_000,
      QRIS_TOOLS_ENABLED: true,
    });
  });

  it('menolak angka yang tidak valid', () => {
    expect(() => validateEnv({ QRIS_MAX_AMOUNT: 'abc' })).toThrow(
      'QRIS_MAX_AMOUNT',
    );
    expect(() => validateEnv({ PORT: '-1' })).toThrow('PORT');
  });
});
