/**
 * 会话清理（统一入口）。
 *
 * 背景（自检 P2-9/P2-14）：登出与 401 强制登出此前各自手写一份
 * removeStorageSync 清单，容易改一处漏一处；而且只清了 token/userInfo，
 * 上一账号的学习进度（scenarioProgress）会残留到下一账号的本地存储里。
 * 现在所有"清会话"都走这里，设备级偏好（主题/字号/语言）不在清理范围内。
 */

/** 按账号隔离、登出时必须清除的本地存储键 */
export const USER_SCOPED_STORAGE_KEYS = [
  'token',
  'refreshToken',
  'userInfo',
  'scenarioProgress',
] as const;

export function clearSession(): void {
  for (const key of USER_SCOPED_STORAGE_KEYS) {
    try {
      uni.removeStorageSync(key);
    } catch {
      // 存储不可用时忽略，不能影响登出主流程
    }
  }
}
