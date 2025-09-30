import { createSignal, createContext, useContext, ParentComponent } from 'solid-js';

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko';

export interface Translation {
  // Common
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    save: string;
    edit: string;
    delete: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    retry: string;
    refresh: string;
    search: string;
    filter: string;
    sort: string;
    clear: string;
    export: string;
    import: string;
    settings: string;
    help: string;
    about: string;
  };
  
  // Authentication
  auth: {
    login: string;
    logout: string;
    signup: string;
    unlock: string;
    lock: string;
    pin: string;
    password: string;
    username: string;
    email: string;
    recovery: string;
    forgotPassword: string;
    createAccount: string;
    enterPin: string;
    invalidPin: string;
    tooManyAttempts: string;
    sessionExpired: string;
    vaultLocked: string;
    vaultUnlocked: string;
  };
  
  // Permissions
  permissions: {
    title: string;
    allow: string;
    deny: string;
    askEveryTime: string;
    alwaysAllow: string;
    alwaysDeny: string;
    notSet: string;
    granted: string;
    revoked: string;
    requested: string;
    denied: string;
    appPermissions: string;
    permissionDenied: string;
    insufficientPermissions: string;
    getPublicKey: string;
    signEvent: string;
    signData: string;
    encrypt: string;
    decrypt: string;
    social: string;
    messaging: string;
    financial: string;
  };
  
  // Settings
  settings: {
    title: string;
    identity: string;
    security: string;
    audit: string;
    relays: string;
    sessions: string;
    identityName: string;
    publicKey: string;
    connectedApps: string;
    identitySettings: string;
    theme: string;
    customRelays: string;
    sessionTimeout: string;
    dangerZone: string;
    startRecovery: string;
    lockVault: string;
    deleteAccount: string;
  };
  
  // Audit Log
  audit: {
    title: string;
    noEvents: string;
    noEventsFound: string;
    clearLog: string;
    exportLog: string;
    totalEvents: string;
    critical: string;
    high: string;
    medium: string;
    low: string;
    allTypes: string;
    allSeverities: string;
    sortByTime: string;
    sortByType: string;
    sortBySeverity: string;
    searchEvents: string;
    authentication: string;
    permissions: string;
    security: string;
    crypto: string;
    sync: string;
    errors: string;
  };
  
  // Errors
  errors: {
    invalidRequest: string;
    userNotAuthenticated: string;
    vaultLocked: string;
    invalidPin: string;
    tooManyAttempts: string;
    permissionDenied: string;
    sessionExpired: string;
    networkError: string;
    encryptionError: string;
    storageError: string;
    invalidSignature: string;
    unsupportedOperation: string;
    rateLimited: string;
    insufficientPermissions: string;
    invalidIdentity: string;
    syncError: string;
    unknownError: string;
  };
  
  // Accessibility
  a11y: {
    closeModal: string;
    openModal: string;
    expandMenu: string;
    collapseMenu: string;
    selectOption: string;
    clearSelection: string;
    loadingContent: string;
    errorOccurred: string;
    successMessage: string;
    warningMessage: string;
    infoMessage: string;
    requiredField: string;
    optionalField: string;
    formSubmitted: string;
    formError: string;
    navigationMenu: string;
    mainContent: string;
    sidebar: string;
    footer: string;
  };
}

const translations: Record<Locale, Translation> = {
  en: {
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      cancel: 'Cancel',
      confirm: 'Confirm',
      save: 'Save',
      edit: 'Edit',
      delete: 'Delete',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      retry: 'Retry',
      refresh: 'Refresh',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      clear: 'Clear',
      export: 'Export',
      import: 'Import',
      settings: 'Settings',
      help: 'Help',
      about: 'About'
    },
    auth: {
      login: 'Login',
      logout: 'Logout',
      signup: 'Sign Up',
      unlock: 'Unlock',
      lock: 'Lock',
      pin: 'PIN',
      password: 'Password',
      username: 'Username',
      email: 'Email',
      recovery: 'Recovery',
      forgotPassword: 'Forgot Password?',
      createAccount: 'Create Account',
      enterPin: 'Enter your PIN',
      invalidPin: 'Invalid PIN',
      tooManyAttempts: 'Too many attempts',
      sessionExpired: 'Session expired',
      vaultLocked: 'Vault locked',
      vaultUnlocked: 'Vault unlocked'
    },
    permissions: {
      title: 'App Permissions',
      allow: 'Allow',
      deny: 'Deny',
      askEveryTime: 'Ask Every Time',
      alwaysAllow: 'Always Allow',
      alwaysDeny: 'Always Deny',
      notSet: 'Not Set',
      granted: 'Granted',
      revoked: 'Revoked',
      requested: 'Requested',
      denied: 'Denied',
      appPermissions: 'App Permissions',
      permissionDenied: 'Permission denied',
      insufficientPermissions: 'Insufficient permissions',
      getPublicKey: 'Read Public Key',
      signEvent: 'Sign Event',
      signData: 'Sign Data',
      encrypt: 'Encrypt',
      decrypt: 'Decrypt',
      social: 'Social',
      messaging: 'Messaging',
      financial: 'Financial'
    },
    settings: {
      title: 'Settings',
      identity: 'Identity',
      security: 'Security',
      audit: 'Audit Log',
      relays: 'Relays',
      sessions: 'Sessions',
      identityName: 'Identity Name',
      publicKey: 'Public Key',
      connectedApps: 'Connected Apps',
      identitySettings: 'Identity Settings',
      theme: 'Theme',
      customRelays: 'Custom Relays',
      sessionTimeout: 'Session Timeout',
      dangerZone: 'Danger Zone',
      startRecovery: 'Start Recovery',
      lockVault: 'Lock Vault',
      deleteAccount: 'Delete Account'
    },
    audit: {
      title: 'Audit Log',
      noEvents: 'No audit events found',
      noEventsFound: 'No events match your current filters',
      clearLog: 'Clear Log',
      exportLog: 'Export Log',
      totalEvents: 'Total Events',
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      allTypes: 'All Types',
      allSeverities: 'All Severities',
      sortByTime: 'Sort by Time',
      sortByType: 'Sort by Type',
      sortBySeverity: 'Sort by Severity',
      searchEvents: 'Search events...',
      authentication: 'Authentication',
      permissions: 'Permissions',
      security: 'Security',
      crypto: 'Crypto',
      sync: 'Sync',
      errors: 'Errors'
    },
    errors: {
      invalidRequest: 'Invalid request',
      userNotAuthenticated: 'User not authenticated',
      vaultLocked: 'Vault is locked',
      invalidPin: 'Invalid PIN',
      tooManyAttempts: 'Too many attempts',
      permissionDenied: 'Permission denied',
      sessionExpired: 'Session expired',
      networkError: 'Network error',
      encryptionError: 'Encryption error',
      storageError: 'Storage error',
      invalidSignature: 'Invalid signature',
      unsupportedOperation: 'Unsupported operation',
      rateLimited: 'Rate limited',
      insufficientPermissions: 'Insufficient permissions',
      invalidIdentity: 'Invalid identity',
      syncError: 'Sync error',
      unknownError: 'Unknown error'
    },
    a11y: {
      closeModal: 'Close modal',
      openModal: 'Open modal',
      expandMenu: 'Expand menu',
      collapseMenu: 'Collapse menu',
      selectOption: 'Select option',
      clearSelection: 'Clear selection',
      loadingContent: 'Loading content',
      errorOccurred: 'An error occurred',
      successMessage: 'Success message',
      warningMessage: 'Warning message',
      infoMessage: 'Information message',
      requiredField: 'Required field',
      optionalField: 'Optional field',
      formSubmitted: 'Form submitted',
      formError: 'Form error',
      navigationMenu: 'Navigation menu',
      mainContent: 'Main content',
      sidebar: 'Sidebar',
      footer: 'Footer'
    }
  },
  // Add other locales here as needed
  es: {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      save: 'Guardar',
      edit: 'Editar',
      delete: 'Eliminar',
      close: 'Cerrar',
      back: 'Atrás',
      next: 'Siguiente',
      previous: 'Anterior',
      retry: 'Reintentar',
      refresh: 'Actualizar',
      search: 'Buscar',
      filter: 'Filtrar',
      sort: 'Ordenar',
      clear: 'Limpiar',
      export: 'Exportar',
      import: 'Importar',
      settings: 'Configuración',
      help: 'Ayuda',
      about: 'Acerca de'
    },
    auth: {
      login: 'Iniciar sesión',
      logout: 'Cerrar sesión',
      signup: 'Registrarse',
      unlock: 'Desbloquear',
      lock: 'Bloquear',
      pin: 'PIN',
      password: 'Contraseña',
      username: 'Nombre de usuario',
      email: 'Correo electrónico',
      recovery: 'Recuperación',
      forgotPassword: '¿Olvidaste tu contraseña?',
      createAccount: 'Crear cuenta',
      enterPin: 'Ingresa tu PIN',
      invalidPin: 'PIN inválido',
      tooManyAttempts: 'Demasiados intentos',
      sessionExpired: 'Sesión expirada',
      vaultLocked: 'Bóveda bloqueada',
      vaultUnlocked: 'Bóveda desbloqueada'
    },
    permissions: {
      title: 'Permisos de Aplicación',
      allow: 'Permitir',
      deny: 'Denegar',
      askEveryTime: 'Preguntar cada vez',
      alwaysAllow: 'Siempre permitir',
      alwaysDeny: 'Siempre denegar',
      notSet: 'No establecido',
      granted: 'Concedido',
      revoked: 'Revocado',
      requested: 'Solicitado',
      denied: 'Denegado',
      appPermissions: 'Permisos de Aplicación',
      permissionDenied: 'Permiso denegado',
      insufficientPermissions: 'Permisos insuficientes',
      getPublicKey: 'Leer Clave Pública',
      signEvent: 'Firmar Evento',
      signData: 'Firmar Datos',
      encrypt: 'Cifrar',
      decrypt: 'Descifrar',
      social: 'Social',
      messaging: 'Mensajería',
      financial: 'Financiero'
    },
    settings: {
      title: 'Configuración',
      identity: 'Identidad',
      security: 'Seguridad',
      audit: 'Registro de Auditoría',
      relays: 'Relés',
      sessions: 'Sesiones',
      identityName: 'Nombre de Identidad',
      publicKey: 'Clave Pública',
      connectedApps: 'Aplicaciones Conectadas',
      identitySettings: 'Configuración de Identidad',
      theme: 'Tema',
      customRelays: 'Relés Personalizados',
      sessionTimeout: 'Tiempo de Espera de Sesión',
      dangerZone: 'Zona de Peligro',
      startRecovery: 'Iniciar Recuperación',
      lockVault: 'Bloquear Bóveda',
      deleteAccount: 'Eliminar Cuenta'
    },
    audit: {
      title: 'Registro de Auditoría',
      noEvents: 'No se encontraron eventos de auditoría',
      noEventsFound: 'Ningún evento coincide con tus filtros actuales',
      clearLog: 'Limpiar Registro',
      exportLog: 'Exportar Registro',
      totalEvents: 'Eventos Totales',
      critical: 'Crítico',
      high: 'Alto',
      medium: 'Medio',
      low: 'Bajo',
      allTypes: 'Todos los Tipos',
      allSeverities: 'Todas las Severidades',
      sortByTime: 'Ordenar por Tiempo',
      sortByType: 'Ordenar por Tipo',
      sortBySeverity: 'Ordenar por Severidad',
      searchEvents: 'Buscar eventos...',
      authentication: 'Autenticación',
      permissions: 'Permisos',
      security: 'Seguridad',
      crypto: 'Cripto',
      sync: 'Sincronización',
      errors: 'Errores'
    },
    errors: {
      invalidRequest: 'Solicitud inválida',
      userNotAuthenticated: 'Usuario no autenticado',
      vaultLocked: 'Bóveda bloqueada',
      invalidPin: 'PIN inválido',
      tooManyAttempts: 'Demasiados intentos',
      permissionDenied: 'Permiso denegado',
      sessionExpired: 'Sesión expirada',
      networkError: 'Error de red',
      encryptionError: 'Error de cifrado',
      storageError: 'Error de almacenamiento',
      invalidSignature: 'Firma inválida',
      unsupportedOperation: 'Operación no soportada',
      rateLimited: 'Límite de velocidad',
      insufficientPermissions: 'Permisos insuficientes',
      invalidIdentity: 'Identidad inválida',
      syncError: 'Error de sincronización',
      unknownError: 'Error desconocido'
    },
    a11y: {
      closeModal: 'Cerrar modal',
      openModal: 'Abrir modal',
      expandMenu: 'Expandir menú',
      collapseMenu: 'Contraer menú',
      selectOption: 'Seleccionar opción',
      clearSelection: 'Limpiar selección',
      loadingContent: 'Cargando contenido',
      errorOccurred: 'Ocurrió un error',
      successMessage: 'Mensaje de éxito',
      warningMessage: 'Mensaje de advertencia',
      infoMessage: 'Mensaje informativo',
      requiredField: 'Campo requerido',
      optionalField: 'Campo opcional',
      formSubmitted: 'Formulario enviado',
      formError: 'Error de formulario',
      navigationMenu: 'Menú de navegación',
      mainContent: 'Contenido principal',
      sidebar: 'Barra lateral',
      footer: 'Pie de página'
    }
  },
  // Add more locales as needed
  fr: {} as Translation,
  de: {} as Translation,
  ja: {} as Translation,
  zh: {} as Translation,
  ko: {} as Translation
};

interface I18nContextType {
  locale: () => Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
  availableLocales: Locale[];
}

const I18nContext = createContext<I18nContextType>();

export const I18nProvider: ParentComponent = (props) => {
  const [locale, setLocale] = createSignal<Locale>('en');
  
  const availableLocales: Locale[] = ['en', 'es', 'fr', 'de', 'ja', 'zh', 'ko'];
  
  const t = (key: string): string => {
    const currentLocale = locale();
    const translation = translations[currentLocale];
    
    if (!translation) {
      console.warn(`Translation not found for locale: ${currentLocale}`);
      return key;
    }
    
    const keys = key.split('.');
    let value: any = translation;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key} for locale: ${currentLocale}`);
        return key;
      }
    }
    
    return typeof value === 'string' ? value : key;
  };
  
  const contextValue: I18nContextType = {
    locale,
    setLocale,
    t,
    availableLocales
  };
  
  return (
    <I18nContext.Provider value={contextValue}>
      {props.children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
