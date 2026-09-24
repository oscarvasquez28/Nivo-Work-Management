"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

const storageKey = "nivo:language";

const en = {
  "app.title": "Nivo · Work, in focus",
  "app.loading": "Loading your workspace…",
  "nav.home": "Home",
  "nav.myIssues": "My issues",
  "nav.issues": "Issues",
  "nav.projects": "Projects",
  "nav.cycles": "Cycles",
  "nav.teams": "Teams",
  "nav.members": "Members",
  "shell.skipToContent": "Skip to content",
  "shell.search": "Search anything",
  "shell.searchTitle": "Search workspace",
  "shell.searchKbd": "⌘ K",
  "shell.createIssue": "Create issue",
  "shell.workspace": "Workspace",
  "shell.projects": "Projects",
  "shell.noActiveProjects": "No active projects yet",
  "shell.appearance": "Appearance & preferences",
  "shell.themeLight": "Switch to light theme",
  "shell.themeDark": "Switch to dark theme",
  "shell.expand": "Expand",
  "shell.collapse": "Collapse",
  "shell.sidebar": "sidebar",
  "shell.signOut": "Sign out",
  "shell.language": "Language",
  "shell.english": "English",
  "shell.spanish": "Español",
  "shell.serverWorkspace": "Server workspace",
  "shell.loading": "Loading workspace",
  "shell.loadingYourWorkspace": "Loading your workspace…",
  "shell.brandLabel": "Nivo Labs home",
  "shell.profileLabel": "Appearance and preferences",
  "shell.navigation": "Workspace navigation",
  "shell.mobileNavigation": "Mobile workspace navigation",
  "shell.closeNavigation": "Close navigation",
  "shell.openNavigation": "Open navigation",
  "shell.breadcrumbWorkspace": "Nivo Labs",
  "shell.loadingDetail": "Loading…",
  "shell.detail": "Detail",
  "shell.workspaceNav": "Workspace navigation",
  "shell.navigateAndProjects": "Navigate your Nivo Labs workspace and projects.",
  "shell.saving": "Saving",
  "shell.retryConnection": "Retry connection",
  "shell.continueSession": "Continue for this session",
  "shell.errorOpen": "Your workspace couldn’t be opened",
  "shell.errorOpenDetail": "Your saved data will not be overwritten. Session-only changes stay in this tab and will be lost when you reload.",
  "shell.tryAgain": "Try again",
  "shell.useSessionWorkspace": "Use session-only workspace",
  "command.title": "Search workspace and commands",
  "command.description": "Find issues, projects, cycles, members and labels, or run a command. Use the arrow keys to navigate and Enter to select.",
  "command.placeholder": "Search your workspace…",
  "command.empty": "No results for “{query}”",
  "command.emptyHint": "Try an issue identifier, project name, member or label.",
  "command.noData": "Workspace data is not available yet. You can still navigate or change your preferences.",
  "command.recentlyViewed": "Recently viewed",
  "command.aria": "Workspace search",
  "command.close": "Close search",
  "command.createIssue": "Create issue",
  "command.createProject": "Create project",
  "command.createCycle": "Create cycle",
  "command.goHome": "Go to Home",
  "command.goMyIssues": "Go to My issues",
  "command.goIssues": "Go to Issues",
  "command.goProjects": "Go to Projects",
  "command.goCycles": "Go to Cycles",
  "command.themeLight": "light",
  "command.themeDark": "dark",
  "command.switchTheme": "Switch to {theme} theme",
  "command.expandSidebar": "Expand sidebar",
  "command.collapseSidebar": "Collapse sidebar",
  "command.context.workspace": "Workspace",
  "command.context.project": "Project",
  "command.context.completedCycle": "Completed cycle",
  "command.context.viewAssignedIssues": "View assigned issues",
  "command.context.viewLabelIssues": "View issues with this label",
  "command.context.cycleDates": "{start} – {end}",
  "install.title": "Create your workspace",
  "install.description": "Set up the first administrator account and team.",
  "install.fullName": "Full name",
  "install.email": "Email",
  "install.password": "Password",
  "install.confirmPassword": "Confirm password",
  "install.workspaceName": "Workspace/company name",
  "install.timezone": "Time zone",
  "install.firstTeamName": "First team name",
  "install.teamKey": "Team key",
  "install.passwordMismatch": "Passwords do not match.",
  "install.creating": "Creating workspace…",
  "install.createButton": "Create workspace",
  "login.title": "Sign in",
  "login.description": "Access your Nivo Labs workspace.",
  "login.email": "Email",
  "login.password": "Password",
  "login.signingIn": "Signing in…",
  "login.signInButton": "Sign in",
  "notFound.title": "This page isn’t in your workspace",
  "notFound.description": "The link may have changed. Your work is one click away.",
  "notFound.cta": "Back to workspace",
  "home.eyebrow": "Nivo Labs",
  "home.greeting": "Good day, {name}",
  "home.issue": "issue",
  "home.issues": "issues",
  "home.descriptionActive": "You have {count} active {issues}",
  "home.overduePart": ", {count} overdue",
  "home.descriptionClear": "Your queue is clear. A good moment to plan what’s next.",
  "home.active": "Active",
  "home.overdue": "Overdue",
  "home.dueThisWeek": "Due this week",
  "home.completed": "Completed",
  "home.needsAttention": "Needs attention",
  "home.inMotion": "In motion",
  "home.myWork": "My work",
  "home.myIssuesLink": "My issues",
  "home.dueThisWeekTitle": "Due this week",
  "home.activeProjects": "Active projects",
  "home.allProjectsLink": "All projects",
  "home.noProjectsTitle": "No active projects",
  "home.noProjectsDescription": "Create a project to start organizing your team’s work.",
  "home.openProjects": "Open projects",
  "home.currentCycle": "Current cycle",
  "home.open": "Open",
  "home.recentlyCompleted": "Recently completed",
  "home.teamActivity": "Team activity",
  "home.nothingInProgressTitle": "Nothing in progress",
  "home.nothingInProgressDescription": "Pick up an issue from your queue or create something new.",
  "home.createIssue": "Create issue",
  "home.completedAppear": "Completed work will appear here.",
  "home.keepMomentum": "Keep the momentum",
  "home.searchHint": "Press {kbd} to search anything, or create an issue to capture what’s next.",
  "home.kbd": "⌘K",
  "home.newIssue": "New issue",
  "home.browseIssues": "Browse issues",
  "home.due": "Due {date}",
  "home.issuesDone": "{completed} of {total} done",
  "home.overdueLabel": "Overdue · {date}",
  "common.undo": "Undo",
  "common.dismiss": "Dismiss notification",
  "common.cancel": "Cancel",
  "nav.timeline": "Timeline",
  "command.goTimeline": "Go to Timeline",
  "issue.blocked": "Blocked",
  "deps.title": "Dependencies",
  "deps.none": "No dependencies",
  "deps.add": "Add dependency",
  "deps.remove": "Remove link",
  "deps.blockedBy": "Blocked by",
  "deps.blocking": "Blocking",
  "deps.related": "Related",
  "deps.relation": "Relationship",
  "deps.relation.blockedBy": "is blocked by",
  "deps.relation.blocks": "blocks",
  "deps.relation.relates": "relates to",
  "deps.selectIssue": "Select an issue",
  "schedule.title": "Schedule",
  "schedule.planned": "Planned",
  "schedule.actual": "Actual",
  "schedule.noPlan": "No planned dates",
  "schedule.plannedProgress": "{percent}% planned by today",
  "schedule.actualProgress": "{percent}% complete",
  "schedule.ongoing": "ongoing",
  "notif.title": "Notifications",
  "notif.markAll": "Mark all read",
  "notif.overdue": "Overdue",
  "notif.inbox": "Inbox",
  "notif.dueOn": "due {date}",
  "notif.empty": "You’re all caught up",
  "gantt.title": "Timeline",
  "gantt.description": "Planned versus actual schedule across your issues.",
  "gantt.empty": "Nothing scheduled yet",
  "gantt.emptyHint": "Add planned or actual dates to issues to see them here.",
  "gantt.planned": "Planned",
  "gantt.actual": "Actual",
  "gantt.blocked": "Blocked",
  "gantt.unscheduled": "{count} unscheduled",
  "gantt.issue": "Issue",
  "gantt.today": "Today",
  "gantt.ongoing": "ongoing",
  "gantt.noProject": "Project not found",
} as const;

const es = {
  "app.title": "Nivo · Work, in focus",
  "app.loading": "Cargando tu espacio de trabajo…",
  "nav.home": "Inicio",
  "nav.myIssues": "Mis tareas",
  "nav.issues": "Tareas",
  "nav.projects": "Proyectos",
  "nav.cycles": "Ciclos",
  "nav.teams": "Equipos",
  "nav.members": "Miembros",
  "shell.skipToContent": "Saltar al contenido",
  "shell.search": "Buscar cualquier cosa",
  "shell.searchTitle": "Buscar en el espacio de trabajo",
  "shell.searchKbd": "⌘ K",
  "shell.createIssue": "Crear tarea",
  "shell.workspace": "Espacio de trabajo",
  "shell.projects": "Proyectos",
  "shell.noActiveProjects": "Aún no hay proyectos activos",
  "shell.appearance": "Apariencia y preferencias",
  "shell.themeLight": "Cambiar a tema claro",
  "shell.themeDark": "Cambiar a tema oscuro",
  "shell.expand": "Expandir",
  "shell.collapse": "Colapsar",
  "shell.sidebar": "barra lateral",
  "shell.signOut": "Cerrar sesión",
  "shell.language": "Idioma",
  "shell.english": "English",
  "shell.spanish": "Español",
  "shell.serverWorkspace": "Espacio en servidor",
  "shell.loading": "Cargando espacio de trabajo",
  "shell.loadingYourWorkspace": "Cargando tu espacio de trabajo…",
  "shell.brandLabel": "Inicio de Nivo Labs",
  "shell.profileLabel": "Apariencia y preferencias",
  "shell.navigation": "Navegación del espacio de trabajo",
  "shell.mobileNavigation": "Navegación móvil del espacio de trabajo",
  "shell.closeNavigation": "Cerrar navegación",
  "shell.openNavigation": "Abrir navegación",
  "shell.breadcrumbWorkspace": "Nivo Labs",
  "shell.loadingDetail": "Cargando…",
  "shell.detail": "Detalle",
  "shell.workspaceNav": "Navegación del espacio de trabajo",
  "shell.navigateAndProjects": "Navega tu espacio de trabajo y proyectos de Nivo Labs.",
  "shell.saving": "Guardando",
  "shell.retryConnection": "Reintentar conexión",
  "shell.continueSession": "Continuar para esta sesión",
  "shell.errorOpen": "No se pudo abrir tu espacio de trabajo",
  "shell.errorOpenDetail": "Tus datos guardados no se sobrescribirán. Los cambios solo de sesión permanecen en esta pestaña y se perderán al recargar.",
  "shell.tryAgain": "Intentar de nuevo",
  "shell.useSessionWorkspace": "Usar espacio solo para esta sesión",
  "command.title": "Buscar en el espacio de trabajo y comandos",
  "command.description": "Busca tareas, proyectos, ciclos, miembros y etiquetas, o ejecuta un comando. Usa las flechas para navegar y Entrar para seleccionar.",
  "command.placeholder": "Buscar en tu espacio de trabajo…",
  "command.empty": "No hay resultados para “{query}”",
  "command.emptyHint": "Prueba un identificador de tarea, nombre de proyecto, miembro o etiqueta.",
  "command.noData": "Los datos del espacio de trabajo aún no están disponibles. Aún puedes navegar o cambiar tus preferencias.",
  "command.recentlyViewed": "Vistos recientemente",
  "command.aria": "Búsqueda del espacio de trabajo",
  "command.close": "Cerrar búsqueda",
  "command.createIssue": "Crear tarea",
  "command.createProject": "Crear proyecto",
  "command.createCycle": "Crear ciclo",
  "command.goHome": "Ir al inicio",
  "command.goMyIssues": "Ir a Mis tareas",
  "command.goIssues": "Ir a Tareas",
  "command.goProjects": "Ir a Proyectos",
  "command.goCycles": "Ir a Ciclos",
  "command.themeLight": "claro",
  "command.themeDark": "oscuro",
  "command.switchTheme": "Cambiar a tema {theme}",
  "command.expandSidebar": "Expandir barra lateral",
  "command.collapseSidebar": "Colapsar barra lateral",
  "command.context.workspace": "Espacio de trabajo",
  "command.context.project": "Proyecto",
  "command.context.completedCycle": "Ciclo completado",
  "command.context.viewAssignedIssues": "Ver tareas asignadas",
  "command.context.viewLabelIssues": "Ver tareas con esta etiqueta",
  "command.context.cycleDates": "{start} – {end}",
  "install.title": "Crea tu espacio de trabajo",
  "install.description": "Configura la primera cuenta de administrador y equipo.",
  "install.fullName": "Nombre completo",
  "install.email": "Correo electrónico",
  "install.password": "Contraseña",
  "install.confirmPassword": "Confirmar contraseña",
  "install.workspaceName": "Nombre del espacio de trabajo/empresa",
  "install.timezone": "Zona horaria",
  "install.firstTeamName": "Nombre del primer equipo",
  "install.teamKey": "Clave del equipo",
  "install.passwordMismatch": "Las contraseñas no coinciden.",
  "install.creating": "Creando espacio de trabajo…",
  "install.createButton": "Crear espacio de trabajo",
  "login.title": "Iniciar sesión",
  "login.description": "Accede a tu espacio de trabajo de Nivo Labs.",
  "login.email": "Correo electrónico",
  "login.password": "Contraseña",
  "login.signingIn": "Iniciando sesión…",
  "login.signInButton": "Iniciar sesión",
  "notFound.title": "Esta página no está en tu espacio de trabajo",
  "notFound.description": "El enlace puede haber cambiado. Tu trabajo está a un clic de distancia.",
  "notFound.cta": "Volver al espacio de trabajo",
  "home.eyebrow": "Nivo Labs",
  "home.greeting": "Buenos días, {name}",
  "home.issue": "tarea",
  "home.issues": "tareas",
  "home.descriptionActive": "Tienes {count} {issues} activas",
  "home.overduePart": ", {count} con vencimiento",
  "home.descriptionClear": "Tu cola está libre. Un buen momento para planificar lo próximo.",
  "home.active": "Activas",
  "home.overdue": "Vencidas",
  "home.dueThisWeek": "Esta semana",
  "home.completed": "Completadas",
  "home.needsAttention": "Necesitan atención",
  "home.inMotion": "En movimiento",
  "home.myWork": "Mi trabajo",
  "home.myIssuesLink": "Mis tareas",
  "home.dueThisWeekTitle": "Vencen esta semana",
  "home.activeProjects": "Proyectos activos",
  "home.allProjectsLink": "Todos los proyectos",
  "home.noProjectsTitle": "No hay proyectos activos",
  "home.noProjectsDescription": "Crea un proyecto para empezar a organizar el trabajo del equipo.",
  "home.openProjects": "Ver proyectos",
  "home.currentCycle": "Ciclo actual",
  "home.open": "Abrir",
  "home.recentlyCompleted": "Completadas recientemente",
  "home.teamActivity": "Actividad del equipo",
  "home.nothingInProgressTitle": "Nada en progreso",
  "home.nothingInProgressDescription": "Toma una tarea de tu cola o crea algo nuevo.",
  "home.createIssue": "Crear tarea",
  "home.completedAppear": "El trabajo completado aparecerá aquí.",
  "home.keepMomentum": "Mantén el impulso",
  "home.searchHint": "Presiona {kbd} para buscar cualquier cosa, o crea una tarea para capturar lo que sigue.",
  "home.kbd": "⌘K",
  "home.newIssue": "Nueva tarea",
  "home.browseIssues": "Explorar tareas",
  "home.due": "Vence {date}",
  "home.issuesDone": "{completed} de {total} hechas",
  "home.overdueLabel": "Vencida · {date}",
  "common.undo": "Deshacer",
  "common.dismiss": "Descartar notificación",
  "common.cancel": "Cancelar",
  "nav.timeline": "Cronograma",
  "command.goTimeline": "Ir al cronograma",
  "issue.blocked": "Bloqueada",
  "deps.title": "Dependencias",
  "deps.none": "Sin dependencias",
  "deps.add": "Agregar dependencia",
  "deps.remove": "Quitar vínculo",
  "deps.blockedBy": "Bloqueada por",
  "deps.blocking": "Bloquea a",
  "deps.related": "Relacionadas",
  "deps.relation": "Relación",
  "deps.relation.blockedBy": "está bloqueada por",
  "deps.relation.blocks": "bloquea a",
  "deps.relation.relates": "se relaciona con",
  "deps.selectIssue": "Selecciona una tarea",
  "schedule.title": "Plan vs. real",
  "schedule.planned": "Planeado",
  "schedule.actual": "Real",
  "schedule.noPlan": "Sin fechas planeadas",
  "schedule.plannedProgress": "{percent}% planeado a hoy",
  "schedule.actualProgress": "{percent}% completado",
  "schedule.ongoing": "en curso",
  "notif.title": "Notificaciones",
  "notif.markAll": "Marcar todo leído",
  "notif.overdue": "Vencidas",
  "notif.inbox": "Bandeja",
  "notif.dueOn": "venció {date}",
  "notif.empty": "Estás al día",
  "gantt.title": "Cronograma",
  "gantt.description": "Avance planeado versus real de tus tareas.",
  "gantt.empty": "Nada programado aún",
  "gantt.emptyHint": "Agrega fechas planeadas o reales a las tareas para verlas aquí.",
  "gantt.planned": "Planeado",
  "gantt.actual": "Real",
  "gantt.blocked": "Bloqueada",
  "gantt.unscheduled": "{count} sin programar",
  "gantt.issue": "Tarea",
  "gantt.today": "Hoy",
  "gantt.ongoing": "en curso",
  "gantt.noProject": "Proyecto no encontrado",
} as const;

type TranslationKey = keyof typeof en;
type Locale = "en" | "es";

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, es };

function resolveLocale(raw: string | null): Locale {
  if (raw === "en" || raw === "es") return raw;
  if (raw?.toLowerCase().startsWith("es")) return "es";
  return "en";
}

type I18nContextValue = {
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  language: Locale;
  setLanguage: (language: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

let storeLanguage: Locale = "en";
const listeners = new Set<() => void>();

function setStoreLanguage(value: Locale) {
  if (value === storeLanguage) return;
  storeLanguage = value;
  listeners.forEach((callback) => callback());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() { return storeLanguage; }
function getServerSnapshot(): Locale { return "en"; }

export function I18nProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useLayoutEffect(() => {
    try {
      setStoreLanguage(resolveLocale(window.localStorage.getItem(storageKey)));
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(storageKey, language);
    } catch {}
  }, [language]);

  const setLanguage = useCallback((value: Locale) => {
    setStoreLanguage(value);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    const dictionary = dictionaries[language];
    let value: string = dictionary[key];
    if (params) {
      for (const [param, replacement] of Object.entries(params)) {
        value = value.replaceAll(`{${param}}`, String(replacement));
      }
    }
    return value;
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({ t, language, setLanguage }), [t, language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
