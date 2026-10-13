import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { COOKIE_CONSENT_EVENT, hasCookieConsent, openCookieSettings } from "@/lib/cookieConsent";

const LANGUAGE_STORAGE_KEY = "revex-language";
const LANGUAGE_LABELS = { en: "English", pt: "Português" };
const TRANSLATIONS = {
  pt: {
    "Settings": "Definições", "Profile": "Perfil", "Personal details": "Dados pessoais",
    "Privacy": "Privacidade", "Blocked users": "Utilizadores bloqueados", "Security": "Segurança",
    "Payments": "Pagamentos", "Legal documents": "Documentos legais", "Display name, photo and bio": "Nome, fotografia e biografia",
    "Phone, address and account info": "Telefone, morada e dados da conta", "Visibility and who can message you": "Visibilidade e quem lhe pode enviar mensagens",
    "People you've blocked": "Pessoas que bloqueou", "Password and sign-in": "Palavra-passe e início de sessão",
    "Seller payouts": "Pagamentos ao vendedor", "Terms, Privacy & Cookies Policies": "Termos, privacidade e política de cookies",
    "Log out": "Terminar sessão", "Logging out...": "A terminar sessão...", "Back": "Voltar",
    "Language": "Idioma", "Use device language": "Usar idioma do dispositivo", "English": "Inglês", "Português": "Português",
    "Choose the language for Revex. By default, it follows your device language.": "Escolha o idioma do Revex. Por predefinição, segue o idioma do dispositivo.",
    "Profile settings": "Definições do perfil", "Username": "Nome de utilizador", "Your unique name across Revex, shown on your profile, posts, listings and chats.": "O seu nome único no Revex, apresentado no perfil, publicações, artigos e conversas.",
    "Bio": "Biografia", "Tell people what you're into…": "Conte às pessoas os seus interesses…", "Change photo": "Alterar fotografia",
    "Dark mode": "Modo escuro", "Use device theme": "Usar tema do dispositivo", "Save profile": "Guardar perfil", "Saved": "Guardado",
    "Search profiles, brands, tags": "Pesquisar perfis, marcas e etiquetas", "Watch": "Vídeos", "Upload": "Publicar",
    "Inbox": "Mensagens", "Create your account": "Criar conta", "Sign up to get started": "Registe-se para começar",
    "Welcome back": "Bem-vindo de volta", "Log in to your account": "Inicie sessão na sua conta", "Password": "Palavra-passe",
    "Confirm Password": "Confirmar palavra-passe", "Forgot password?": "Esqueceu-se da palavra-passe?", "Log in": "Iniciar sessão",
    "Create one": "Criar conta", "Already have an account?": "Já tem uma conta?", "Don't have an account?": "Ainda não tem conta?",
    "Continue with Google": "Continuar com Google", "or": "ou", "Email": "E-mail", "No posts yet": "Ainda não há publicações",
    "Be the first to upload!": "Seja a primeira pessoa a publicar!",
    "Terms and Conditions": "Termos e condições", "Privacy Policy": "Política de privacidade", "Cookies Policy": "Política de cookies",
    "Read and agree with the": "Li e aceito os", "App language and device preferences": "Idioma da aplicação e preferências do dispositivo",
    "You have logged out of your account.": "Terminou a sessão da sua conta.", "Couldn't log out": "Não foi possível terminar a sessão",
    "Please try again.": "Tente novamente.", "Please read and agree to the Terms and Conditions and Privacy Policy.": "Leia e aceite os Termos e Condições e a Política de Privacidade.",
    "Passwords do not match": "As palavras-passe não coincidem", "Registration failed": "O registo falhou",
    "Invalid email or password": "E-mail ou palavra-passe inválidos", "Create account": "Criar conta",
    "Creating account...": "A criar conta...", "Verify your email": "Verifique o seu e-mail", "Verify": "Verificar",
    "Verifying...": "A verificar...", "Didn't receive the code?": "Não recebeu o código?", "Resend": "Reenviar",
    "Code sent": "Código enviado", "Check your email for the new code.": "Consulte o seu e-mail para ver o novo código.",
    "That username is already taken. Choose another one.": "Esse nome de utilizador já está ocupado. Escolha outro.",
    "Username must be 3–20 characters, using letters, numbers, and underscores. It can't start or end with an underscore.": "O nome de utilizador deve ter 3 a 20 caracteres: letras, números e underscores. Não pode começar nem terminar com underscore.",
    "Logging in...": "A iniciar sessão...", "We sent a 6-digit code to {email}": "Enviámos um código de 6 dígitos para {email}",
    "Invalid verification code": "Código de verificação inválido", "Failed to resend code": "Não foi possível reenviar o código",
    "Google sign-in failed": "O início de sessão com Google falhou", "Change photo": "Alterar fotografia",
    "Logged out": "Sessão terminada", "Home": "Início", "Search": "Pesquisar", "Sell": "Vender",
    "Results for \"{query}\"": "Resultados para \"{query}\"", "Searching…": "A pesquisar…",
    "Searching people…": "A pesquisar pessoas…", "No matches": "Sem resultados",
    "Try a name, post title, tag or brand.": "Experimente um nome, título de publicação, etiqueta ou marca.",
    "People ({count})": "Pessoas ({count})", "Revex user": "Utilizador Revex", "Posts": "Publicações",
    "Items": "Artigos", "Hot searches": "Pesquisas populares", "Browse categories": "Explorar categorias",
    "Trending hauls": "Vídeos em destaque", "Boosted": "Promovido", "Shop by category": "Comprar por categoria",
    "Open Watch": "Abrir vídeos", "Fresh drops": "Novidades", "likes": "gostos", "Brand": "Marca",
    "Welcome to Revex": "Bem-vindo ao Revex", "Welcome to Revex!": "Bem-vindo ao Revex!", "Tell us your vibe": "Conte-nos os seus gostos",
    "Pick what you're into so we can fill your feed with posts you'll actually love.": "Escolha os seus interesses para personalizarmos o seu feed.",
    "Pick your styles": "Escolha os seus estilos", "selected": "selecionados", "Choose your username": "Escolha o seu nome de utilizador",
    "This unique username makes your profile searchable on Revex.": "Este nome de utilizador único permite encontrar o seu perfil no Revex.",
    "Favorite brands": "Marcas favoritas", "Add a brand...": "Adicionar uma marca...", "Add": "Adicionar",
    "Looking good!": "Está a ficar ótimo!", "Pick at least one style to continue": "Escolha pelo menos um estilo para continuar",
    "Enter Revex": "Entrar no Revex", "Be the first to upload!": "Seja a primeira pessoa a publicar!",
    "Sign in to view activity": "Inicie sessão para ver a atividade", "Sign in": "Iniciar sessão", "Nothing new": "Nada de novo",
    "Offers, sales, messages, order updates and likes land here.": "As ofertas, vendas, mensagens, atualizações de encomendas e gostos aparecem aqui.",
    "Couldn't load activity. Check your connection and try again.": "Não foi possível carregar a atividade. Verifique a ligação e tente novamente.",
    "Retry": "Tentar novamente", "new": "novas", "All caught up": "Tudo em dia", "Clear read": "Limpar lidas",
    "Sign in to view chats": "Inicie sessão para ver as conversas", "No chats yet": "Ainda não há conversas",
    "Couldn't load chats. Check your connection and try again.": "Não foi possível carregar as conversas. Verifique a ligação e tente novamente.",
    "App language and device preferences": "Idioma da aplicação e preferências do dispositivo",
    "Reset password": "Redefinir palavra-passe", "We'll send you a link to reset it": "Enviaremos uma ligação para a redefinir",
    "Email address": "Endereço de e-mail", "New password": "Nova palavra-passe", "Enter your new password below": "Introduza a nova palavra-passe abaixo",
    "Invalid reset link": "Ligação de redefinição inválida", "This password reset link is missing or invalid": "Esta ligação de redefinição não existe ou é inválida",
    "Your account is ready and your preferences have been saved.": "A sua conta está pronta e as preferências foram guardadas.",
    "Couldn't finish setting up your account. Please try again.": "Não foi possível concluir a configuração da conta. Tente novamente.",
    "Please sign in again to finish setting up your account.": "Inicie sessão novamente para concluir a configuração da conta.",
    "Your username wasn't saved. Please try again.": "O nome de utilizador não foi guardado. Tente novamente.",
    "Your preferences were not saved. Please select a style and try again.": "As preferências não foram guardadas. Escolha um estilo e tente novamente.",
    "like_new": "Como novo", "new_with_tags": "Novo com etiquetas", "good": "Bom", "fair": "Razoável",
  },
};

function detectDeviceLanguages() {
  const preferences = typeof navigator === "undefined" ? [] : (navigator.languages || [navigator.language]);
  const languages = [...new Set(preferences.map((locale) => {
    const normalized = locale?.toLowerCase() || "";
    if (normalized.startsWith("pt")) return "pt";
    if (normalized.startsWith("en")) return "en";
    return null;
  }).filter(Boolean))];
  return languages.length ? languages : ["en"];
}

const detectDeviceLanguage = () => detectDeviceLanguages()[0];

function readSavedLanguage() {
  if (!hasCookieConsent("preferences")) return "system";
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return saved === "pt" || saved === "en" ? saved : "system";
  } catch {
    return "system";
  }
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [selection, setSelection] = useState(readSavedLanguage);
  const [deviceLanguage, setDeviceLanguage] = useState(detectDeviceLanguage);
  const [availableLanguages, setAvailableLanguages] = useState(detectDeviceLanguages);
  const language = selection === "system" ? deviceLanguage : selection;

  useEffect(() => {
    const updateDeviceLanguage = () => {
      setDeviceLanguage(detectDeviceLanguage());
      setAvailableLanguages(detectDeviceLanguages());
    };
    const updateConsent = () => setSelection(readSavedLanguage());
    window.addEventListener("languagechange", updateDeviceLanguage);
    window.addEventListener(COOKIE_CONSENT_EVENT, updateConsent);
    return () => {
      window.removeEventListener("languagechange", updateDeviceLanguage);
      window.removeEventListener(COOKIE_CONSENT_EVENT, updateConsent);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-PT" : "en";
  }, [language]);

  const value = useMemo(() => ({
    language,
    selection,
    deviceLanguage,
    availableLanguages,
    languageLabels: LANGUAGE_LABELS,
    t: (text, values = {}) => Object.entries(values).reduce(
      (result, [key, replacement]) => result.replaceAll(`{${key}}`, replacement),
      TRANSLATIONS[language]?.[text] || text,
    ),
    setLanguage: (next) => {
      if (next !== "system" && !hasCookieConsent("preferences")) {
        openCookieSettings();
        return false;
      }
      setSelection(next);
      try {
        if (next === "system") window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
        else window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {}
      return true;
    },
  }), [language, selection, deviceLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
