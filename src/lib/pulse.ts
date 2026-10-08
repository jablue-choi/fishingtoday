import type { PointerEvent } from 'react'

/** 버튼을 누를 때마다 물결 애니메이션을 처음부터 다시 재생 (.btn.pulse) */
export function pulse(e: PointerEvent<HTMLElement>) {
  const el = e.currentTarget
  el.classList.remove('pulse')
  void el.offsetWidth   // 리플로우로 애니메이션 리셋
  el.classList.add('pulse')
}
