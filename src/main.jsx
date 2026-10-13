import ReactDOM from 'react-dom/client'
import CookieAwareThemeProvider from '@/components/CookieAwareThemeProvider'
import { I18nProvider } from '@/lib/i18n'
import App from '@/App.jsx'
import '@/index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <CookieAwareThemeProvider>
    <I18nProvider>
      <App />
    </I18nProvider>
  </CookieAwareThemeProvider>
)
