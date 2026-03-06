import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'
import App from './App.tsx'
import './index.css'

// AG Grid v31+ 모듈 등록 (에러 #272 방지)
ModuleRegistry.registerModules([AllCommunityModule])

// StrictMode 제거: 개발 시 이중 마운트로 Supabase GoTrue 락 경고(Lock was not released / AbortError) 발생 방지
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
