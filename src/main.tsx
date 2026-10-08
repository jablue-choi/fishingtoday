import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'
import { initTheme } from './lib/theme'

initTheme()

// 새 버전이 배포되면 서비스 워커가 바뀌는 즉시 새로고침 (PWA가 예전 화면을 붙잡고 있지 않게)
// 앱을 켜 둔 채로도 30분마다 새 버전이 있는지 확인
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => { reg.update().catch(() => {}) }, 30 * 60e3)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
