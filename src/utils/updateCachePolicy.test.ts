import {
  isDisposableVersionCacheKey,
  selectDisposableVersionCacheKeys,
} from './updateCachePolicy';

describe('app update cache policy', () => {
  it('clears disposable query and offline data from an older app version', () => {
    expect(
      selectDisposableVersionCacheKeys([
        '@app_13_user-1_q_students',
        '@app_13_user-1_attendance',
        'notification_channel_version',
      ])
    ).toEqual([
      '@app_13_user-1_q_students',
      '@app_13_user-1_attendance',
    ]);
  });

  it.each([
    'auth_session',
    'sb_secure_refresh_token',
    'supabase_session_enc_auth_session',
    'vault_login_credentials_v1',
    '@app_auth_session',
    '@app_user_refresh_token',
  ])('never treats %s as disposable update cache', (key) => {
    expect(isDisposableVersionCacheKey(key)).toBe(false);
  });
});
