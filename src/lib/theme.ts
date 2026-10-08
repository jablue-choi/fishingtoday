/* 화면 테마: 시스템 맞춤 / 라이트 / 다크. 선택은 이 기기에만 저장 */
export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch { return 'system' }
}

function apply(pref: ThemePref) {
  const dark = pref === 'dark' || (pref === 'system' && media().matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#111214' : '#FFFFFF')
}

export function setThemePref(pref: ThemePref) {
  try { if (pref === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref) } catch { /* 저장 실패해도 이번 화면엔 적용 */ }
  apply(pref)
}

/** 앱 시작 시 한 번: 저장된 설정 적용 + 시스템 설정이 바뀌면 따라가기 */
export function initTheme() {
  apply(getThemePref())
  media().addEventListener('change', () => { if (getThemePref() === 'system') apply('system') })
}
