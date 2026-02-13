// =============================================================================
// AI CONFIG INTERNATIONALIZATION STRINGS
// =============================================================================

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh'

export interface AIConfigStrings {
  button: {
    configure: string
    apply: string
    cancel: string
    tryAgain: string
    editManually: string
    useTemplate: string
  }
  status: {
    analyzing: string
    detectingTrigger: string
    checkingConditions: string
    buildingSteps: string
    generatingConfig: string
    complete: string
    askingQuestions: string
  }
  preview: {
    title: string
    trigger: string
    conditions: string
    conditionsNone: string
    steps: string
    warnings: string
    suggestedTitle: string
    useThisName: string
    keepCurrent: string
  }
  questions: {
    title: string
    submitAnswers: string
    useDefault: string
    skip: string
    round: string
    followUp: string
  }
  templates: {
    title: string
    search: string
    noMatches: string
    categories: {
      recent: string
      triggers: string
      actions: string
      complete: string
    }
  }
  feedback: {
    prompt: string
    placeholder: string
    submit: string
    thankYou: string
  }
  errors: {
    noConnector: string
    noConnectorAction: string
    timeout: string
    timeoutSuggestion: string
    parseError: string
    parseErrorSuggestion: string
    validationError: string
    tooManyRounds: string
  }
  tooltips: {
    button: string
    emptyDescription: string
    configureFirst: string
  }
  validation: {
    invalidTrigger: string
    missingField: string
    undefinedVariable: string
    potentialLoop: string
    httpWarning: string
  }
  // Plurals
  plurals: {
    steps: { one: string; other: string }
    questions: { one: string; other: string }
    warnings: { one: string; other: string }
  }
}

export const aiConfigStrings: Record<SupportedLanguage, AIConfigStrings> = {
  en: {
    button: {
      configure: 'Configure with AI',
      apply: 'Apply',
      cancel: 'Cancel',
      tryAgain: 'Try Again',
      editManually: 'Edit Manually',
      useTemplate: 'Use a template'
    },
    status: {
      analyzing: 'Analyzing your description...',
      detectingTrigger: 'Detecting trigger...',
      checkingConditions: 'Checking conditions...',
      buildingSteps: 'Building action steps...',
      generatingConfig: 'Generating configuration...',
      complete: 'Configuration ready!',
      askingQuestions: 'Need some clarification...'
    },
    preview: {
      title: 'AI Configuration Preview',
      trigger: 'Trigger',
      conditions: 'Conditions',
      conditionsNone: 'No conditions (always runs)',
      steps: 'Steps',
      warnings: 'Warnings',
      suggestedTitle: 'Suggested name',
      useThisName: 'Use this',
      keepCurrent: 'Keep current'
    },
    questions: {
      title: 'Clarification needed',
      submitAnswers: 'Continue',
      useDefault: 'Use default',
      skip: 'Skip',
      round: 'Round {{current}} of {{max}}',
      followUp: 'Follow-up questions'
    },
    templates: {
      title: 'Templates',
      search: 'Search templates...',
      noMatches: 'No matching templates',
      categories: {
        recent: 'Your patterns',
        triggers: 'Trigger patterns',
        actions: 'Action patterns',
        complete: 'Complete examples'
      }
    },
    feedback: {
      prompt: 'How was this configuration?',
      placeholder: 'What would have been better?',
      submit: 'Submit Feedback',
      thankYou: 'Thanks for the feedback!'
    },
    errors: {
      noConnector: 'No AI connector configured',
      noConnectorAction: 'Set up in Settings',
      timeout: 'AI took too long to respond',
      timeoutSuggestion: 'Try simplifying your description',
      parseError: 'Could not understand AI response',
      parseErrorSuggestion: 'Please try again or configure manually',
      validationError: 'Configuration has errors',
      tooManyRounds: 'Too many clarifications needed. Try being more specific.'
    },
    tooltips: {
      button: 'Describe what you want this action to do, then click to auto-configure',
      emptyDescription: 'Enter a description above to use AI configuration',
      configureFirst: 'Add a description first'
    },
    validation: {
      invalidTrigger: 'Invalid trigger type: {{type}}',
      missingField: 'Step {{step}}: missing {{field}}',
      undefinedVariable: 'Variable {{name}} used before defined',
      potentialLoop: 'This action may cause an infinite loop',
      httpWarning: 'Will make {{method}} requests to {{domain}}'
    },
    plurals: {
      steps: { one: '{{count}} step', other: '{{count}} steps' },
      questions: { one: '{{count}} question', other: '{{count}} questions' },
      warnings: { one: '{{count}} warning', other: '{{count}} warnings' }
    }
  },

  // Spanish
  es: {
    button: {
      configure: 'Configurar con IA',
      apply: 'Aplicar',
      cancel: 'Cancelar',
      tryAgain: 'Reintentar',
      editManually: 'Editar manualmente',
      useTemplate: 'Usar una plantilla'
    },
    status: {
      analyzing: 'Analizando tu descripción...',
      detectingTrigger: 'Detectando disparador...',
      checkingConditions: 'Verificando condiciones...',
      buildingSteps: 'Construyendo pasos de acción...',
      generatingConfig: 'Generando configuración...',
      complete: '¡Configuración lista!',
      askingQuestions: 'Necesito aclaración...'
    },
    preview: {
      title: 'Vista previa de configuración IA',
      trigger: 'Disparador',
      conditions: 'Condiciones',
      conditionsNone: 'Sin condiciones (siempre ejecuta)',
      steps: 'Pasos',
      warnings: 'Advertencias',
      suggestedTitle: 'Nombre sugerido',
      useThisName: 'Usar este',
      keepCurrent: 'Mantener actual'
    },
    questions: {
      title: 'Se necesita aclaración',
      submitAnswers: 'Continuar',
      useDefault: 'Usar predeterminado',
      skip: 'Omitir',
      round: 'Ronda {{current}} de {{max}}',
      followUp: 'Preguntas de seguimiento'
    },
    templates: {
      title: 'Plantillas',
      search: 'Buscar plantillas...',
      noMatches: 'No hay plantillas coincidentes',
      categories: {
        recent: 'Tus patrones',
        triggers: 'Patrones de disparador',
        actions: 'Patrones de acción',
        complete: 'Ejemplos completos'
      }
    },
    feedback: {
      prompt: '¿Cómo estuvo esta configuración?',
      placeholder: '¿Qué hubiera sido mejor?',
      submit: 'Enviar comentarios',
      thankYou: '¡Gracias por los comentarios!'
    },
    errors: {
      noConnector: 'No hay conector de IA configurado',
      noConnectorAction: 'Configurar en Ajustes',
      timeout: 'La IA tardó demasiado en responder',
      timeoutSuggestion: 'Intenta simplificar tu descripción',
      parseError: 'No se pudo entender la respuesta de la IA',
      parseErrorSuggestion: 'Por favor intenta de nuevo o configura manualmente',
      validationError: 'La configuración tiene errores',
      tooManyRounds: 'Se necesitan demasiadas aclaraciones. Intenta ser más específico.'
    },
    tooltips: {
      button: 'Describe lo que quieres que haga esta acción, luego haz clic para auto-configurar',
      emptyDescription: 'Ingresa una descripción arriba para usar la configuración de IA',
      configureFirst: 'Primero agrega una descripción'
    },
    validation: {
      invalidTrigger: 'Tipo de disparador inválido: {{type}}',
      missingField: 'Paso {{step}}: falta {{field}}',
      undefinedVariable: 'Variable {{name}} usada antes de definir',
      potentialLoop: 'Esta acción puede causar un bucle infinito',
      httpWarning: 'Hará solicitudes {{method}} a {{domain}}'
    },
    plurals: {
      steps: { one: '{{count}} paso', other: '{{count}} pasos' },
      questions: { one: '{{count}} pregunta', other: '{{count}} preguntas' },
      warnings: { one: '{{count}} advertencia', other: '{{count}} advertencias' }
    }
  },

  // French
  fr: {
    button: {
      configure: 'Configurer avec IA',
      apply: 'Appliquer',
      cancel: 'Annuler',
      tryAgain: 'Réessayer',
      editManually: 'Modifier manuellement',
      useTemplate: 'Utiliser un modèle'
    },
    status: {
      analyzing: 'Analyse de votre description...',
      detectingTrigger: 'Détection du déclencheur...',
      checkingConditions: 'Vérification des conditions...',
      buildingSteps: 'Construction des étapes...',
      generatingConfig: 'Génération de la configuration...',
      complete: 'Configuration prête!',
      askingQuestions: 'Besoin de clarification...'
    },
    preview: {
      title: 'Aperçu de configuration IA',
      trigger: 'Déclencheur',
      conditions: 'Conditions',
      conditionsNone: 'Aucune condition (toujours exécuté)',
      steps: 'Étapes',
      warnings: 'Avertissements',
      suggestedTitle: 'Nom suggéré',
      useThisName: 'Utiliser ce nom',
      keepCurrent: 'Garder actuel'
    },
    questions: {
      title: 'Clarification nécessaire',
      submitAnswers: 'Continuer',
      useDefault: 'Utiliser défaut',
      skip: 'Ignorer',
      round: 'Tour {{current}} sur {{max}}',
      followUp: 'Questions de suivi'
    },
    templates: {
      title: 'Modèles',
      search: 'Rechercher des modèles...',
      noMatches: 'Aucun modèle correspondant',
      categories: {
        recent: 'Vos patterns',
        triggers: 'Patterns de déclencheur',
        actions: 'Patterns d\'action',
        complete: 'Exemples complets'
      }
    },
    feedback: {
      prompt: 'Comment était cette configuration?',
      placeholder: 'Qu\'est-ce qui aurait été mieux?',
      submit: 'Envoyer commentaires',
      thankYou: 'Merci pour vos commentaires!'
    },
    errors: {
      noConnector: 'Aucun connecteur IA configuré',
      noConnectorAction: 'Configurer dans Paramètres',
      timeout: 'L\'IA a mis trop de temps à répondre',
      timeoutSuggestion: 'Essayez de simplifier votre description',
      parseError: 'Impossible de comprendre la réponse de l\'IA',
      parseErrorSuggestion: 'Veuillez réessayer ou configurer manuellement',
      validationError: 'La configuration a des erreurs',
      tooManyRounds: 'Trop de clarifications nécessaires. Essayez d\'être plus précis.'
    },
    tooltips: {
      button: 'Décrivez ce que vous voulez que cette action fasse, puis cliquez pour auto-configurer',
      emptyDescription: 'Entrez une description ci-dessus pour utiliser la configuration IA',
      configureFirst: 'Ajoutez d\'abord une description'
    },
    validation: {
      invalidTrigger: 'Type de déclencheur invalide: {{type}}',
      missingField: 'Étape {{step}}: {{field}} manquant',
      undefinedVariable: 'Variable {{name}} utilisée avant définition',
      potentialLoop: 'Cette action peut causer une boucle infinie',
      httpWarning: 'Effectuera des requêtes {{method}} vers {{domain}}'
    },
    plurals: {
      steps: { one: '{{count}} étape', other: '{{count}} étapes' },
      questions: { one: '{{count}} question', other: '{{count}} questions' },
      warnings: { one: '{{count}} avertissement', other: '{{count}} avertissements' }
    }
  },

  // German
  de: {
    button: {
      configure: 'Mit KI konfigurieren',
      apply: 'Anwenden',
      cancel: 'Abbrechen',
      tryAgain: 'Erneut versuchen',
      editManually: 'Manuell bearbeiten',
      useTemplate: 'Vorlage verwenden'
    },
    status: {
      analyzing: 'Beschreibung wird analysiert...',
      detectingTrigger: 'Auslöser wird erkannt...',
      checkingConditions: 'Bedingungen werden geprüft...',
      buildingSteps: 'Aktionsschritte werden erstellt...',
      generatingConfig: 'Konfiguration wird generiert...',
      complete: 'Konfiguration bereit!',
      askingQuestions: 'Klärung erforderlich...'
    },
    preview: {
      title: 'KI-Konfigurationsvorschau',
      trigger: 'Auslöser',
      conditions: 'Bedingungen',
      conditionsNone: 'Keine Bedingungen (läuft immer)',
      steps: 'Schritte',
      warnings: 'Warnungen',
      suggestedTitle: 'Vorgeschlagener Name',
      useThisName: 'Diesen verwenden',
      keepCurrent: 'Aktuellen behalten'
    },
    questions: {
      title: 'Klärung erforderlich',
      submitAnswers: 'Weiter',
      useDefault: 'Standard verwenden',
      skip: 'Überspringen',
      round: 'Runde {{current}} von {{max}}',
      followUp: 'Folgefragen'
    },
    templates: {
      title: 'Vorlagen',
      search: 'Vorlagen suchen...',
      noMatches: 'Keine passenden Vorlagen',
      categories: {
        recent: 'Ihre Muster',
        triggers: 'Auslösermuster',
        actions: 'Aktionsmuster',
        complete: 'Vollständige Beispiele'
      }
    },
    feedback: {
      prompt: 'Wie war diese Konfiguration?',
      placeholder: 'Was wäre besser gewesen?',
      submit: 'Feedback senden',
      thankYou: 'Danke für das Feedback!'
    },
    errors: {
      noConnector: 'Kein KI-Connector konfiguriert',
      noConnectorAction: 'In Einstellungen konfigurieren',
      timeout: 'KI hat zu lange gebraucht',
      timeoutSuggestion: 'Versuchen Sie, Ihre Beschreibung zu vereinfachen',
      parseError: 'KI-Antwort konnte nicht verstanden werden',
      parseErrorSuggestion: 'Bitte erneut versuchen oder manuell konfigurieren',
      validationError: 'Konfiguration enthält Fehler',
      tooManyRounds: 'Zu viele Klärungen erforderlich. Versuchen Sie, spezifischer zu sein.'
    },
    tooltips: {
      button: 'Beschreiben Sie, was diese Aktion tun soll, dann klicken Sie zum Auto-Konfigurieren',
      emptyDescription: 'Geben Sie oben eine Beschreibung ein, um die KI-Konfiguration zu nutzen',
      configureFirst: 'Fügen Sie zuerst eine Beschreibung hinzu'
    },
    validation: {
      invalidTrigger: 'Ungültiger Auslösertyp: {{type}}',
      missingField: 'Schritt {{step}}: {{field}} fehlt',
      undefinedVariable: 'Variable {{name}} vor Definition verwendet',
      potentialLoop: 'Diese Aktion kann eine Endlosschleife verursachen',
      httpWarning: 'Wird {{method}}-Anfragen an {{domain}} senden'
    },
    plurals: {
      steps: { one: '{{count}} Schritt', other: '{{count}} Schritte' },
      questions: { one: '{{count}} Frage', other: '{{count}} Fragen' },
      warnings: { one: '{{count}} Warnung', other: '{{count}} Warnungen' }
    }
  },

  // Japanese
  ja: {
    button: {
      configure: 'AIで設定',
      apply: '適用',
      cancel: 'キャンセル',
      tryAgain: '再試行',
      editManually: '手動で編集',
      useTemplate: 'テンプレートを使用'
    },
    status: {
      analyzing: '説明を分析中...',
      detectingTrigger: 'トリガーを検出中...',
      checkingConditions: '条件を確認中...',
      buildingSteps: 'アクションステップを構築中...',
      generatingConfig: '設定を生成中...',
      complete: '設定完了!',
      askingQuestions: '確認が必要です...'
    },
    preview: {
      title: 'AI設定プレビュー',
      trigger: 'トリガー',
      conditions: '条件',
      conditionsNone: '条件なし（常に実行）',
      steps: 'ステップ',
      warnings: '警告',
      suggestedTitle: '提案された名前',
      useThisName: 'これを使用',
      keepCurrent: '現在を維持'
    },
    questions: {
      title: '確認が必要',
      submitAnswers: '続行',
      useDefault: 'デフォルトを使用',
      skip: 'スキップ',
      round: '{{max}}中{{current}}ラウンド',
      followUp: 'フォローアップ質問'
    },
    templates: {
      title: 'テンプレート',
      search: 'テンプレートを検索...',
      noMatches: '一致するテンプレートがありません',
      categories: {
        recent: 'あなたのパターン',
        triggers: 'トリガーパターン',
        actions: 'アクションパターン',
        complete: '完全な例'
      }
    },
    feedback: {
      prompt: 'この設定はいかがでしたか？',
      placeholder: '何が良かったですか？',
      submit: 'フィードバックを送信',
      thankYou: 'フィードバックありがとうございます！'
    },
    errors: {
      noConnector: 'AIコネクタが設定されていません',
      noConnectorAction: '設定で構成',
      timeout: 'AIの応答に時間がかかりすぎました',
      timeoutSuggestion: '説明を簡略化してみてください',
      parseError: 'AI応答を理解できませんでした',
      parseErrorSuggestion: '再試行するか、手動で設定してください',
      validationError: '設定にエラーがあります',
      tooManyRounds: '確認が多すぎます。より具体的にしてください。'
    },
    tooltips: {
      button: 'このアクションで何をしたいか説明し、クリックして自動設定',
      emptyDescription: '上に説明を入力してAI設定を使用',
      configureFirst: '最初に説明を追加'
    },
    validation: {
      invalidTrigger: '無効なトリガータイプ: {{type}}',
      missingField: 'ステップ {{step}}: {{field}} がありません',
      undefinedVariable: '変数 {{name}} は定義前に使用されています',
      potentialLoop: 'このアクションは無限ループを引き起こす可能性があります',
      httpWarning: '{{domain}} に {{method}} リクエストを行います'
    },
    plurals: {
      steps: { one: '{{count}} ステップ', other: '{{count}} ステップ' },
      questions: { one: '{{count}} 質問', other: '{{count}} 質問' },
      warnings: { one: '{{count}} 警告', other: '{{count}} 警告' }
    }
  },

  // Chinese (Simplified)
  zh: {
    button: {
      configure: '使用AI配置',
      apply: '应用',
      cancel: '取消',
      tryAgain: '重试',
      editManually: '手动编辑',
      useTemplate: '使用模板'
    },
    status: {
      analyzing: '正在分析您的描述...',
      detectingTrigger: '正在检测触发器...',
      checkingConditions: '正在检查条件...',
      buildingSteps: '正在构建操作步骤...',
      generatingConfig: '正在生成配置...',
      complete: '配置完成！',
      askingQuestions: '需要澄清...'
    },
    preview: {
      title: 'AI配置预览',
      trigger: '触发器',
      conditions: '条件',
      conditionsNone: '无条件（始终运行）',
      steps: '步骤',
      warnings: '警告',
      suggestedTitle: '建议的名称',
      useThisName: '使用此名称',
      keepCurrent: '保持当前'
    },
    questions: {
      title: '需要澄清',
      submitAnswers: '继续',
      useDefault: '使用默认值',
      skip: '跳过',
      round: '第 {{current}} 轮，共 {{max}} 轮',
      followUp: '后续问题'
    },
    templates: {
      title: '模板',
      search: '搜索模板...',
      noMatches: '没有匹配的模板',
      categories: {
        recent: '您的模式',
        triggers: '触发器模式',
        actions: '操作模式',
        complete: '完整示例'
      }
    },
    feedback: {
      prompt: '这个配置怎么样？',
      placeholder: '什么会更好？',
      submit: '提交反馈',
      thankYou: '感谢您的反馈！'
    },
    errors: {
      noConnector: '未配置AI连接器',
      noConnectorAction: '在设置中配置',
      timeout: 'AI响应超时',
      timeoutSuggestion: '尝试简化您的描述',
      parseError: '无法理解AI响应',
      parseErrorSuggestion: '请重试或手动配置',
      validationError: '配置有错误',
      tooManyRounds: '需要太多澄清。请尝试更具体。'
    },
    tooltips: {
      button: '描述您希望此操作执行的内容，然后点击自动配置',
      emptyDescription: '在上方输入描述以使用AI配置',
      configureFirst: '首先添加描述'
    },
    validation: {
      invalidTrigger: '无效的触发器类型: {{type}}',
      missingField: '步骤 {{step}}: 缺少 {{field}}',
      undefinedVariable: '变量 {{name}} 在定义之前使用',
      potentialLoop: '此操作可能导致无限循环',
      httpWarning: '将向 {{domain}} 发送 {{method}} 请求'
    },
    plurals: {
      steps: { one: '{{count}} 个步骤', other: '{{count}} 个步骤' },
      questions: { one: '{{count}} 个问题', other: '{{count}} 个问题' },
      warnings: { one: '{{count}} 个警告', other: '{{count}} 个警告' }
    }
  }
}

// RTL languages
export const RTL_LANGUAGES: SupportedLanguage[] = []

// Helper: Get nested value from object
function getNestedValue(obj: unknown, path: string): string {
  return path.split('.').reduce((acc: unknown, part: string) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return path
  }, obj) as string
}

// Helper: Interpolate values into string
function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? key))
}

// Translation function factory
export function createTranslator(language: SupportedLanguage) {
  const strings = aiConfigStrings[language] || aiConfigStrings.en

  const t = (key: string, values?: Record<string, string | number>): string => {
    const template = getNestedValue(strings, key)
    return values ? interpolate(template, values) : template
  }

  const tPlural = (key: string, count: number): string => {
    const pluralStrings = getNestedValue(strings, key) as unknown as { one: string; other: string }
    if (typeof pluralStrings === 'object' && pluralStrings !== null) {
      const form = count === 1 ? 'one' : 'other'
      return interpolate(pluralStrings[form], { count })
    }
    return String(count)
  }

  const isRTL = RTL_LANGUAGES.includes(language)

  return { t, tPlural, isRTL, language }
}

// Default English translator
export const defaultTranslator = createTranslator('en')
