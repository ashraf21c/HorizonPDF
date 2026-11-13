export type LocaleCode = 'en' | 'ar' | 'ja' | (string & {});

export type TextDirection = 'ltr' | 'rtl';

export interface LocaleMeta {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  dir: TextDirection;
}

export interface ShortcutItem {
  keys: string;
  action: string;
}

export interface TranslationDictionary {
  brandName: string;
  nav: {
    viewer: string;
    converter: string;
    embed: string;
    guide: string;
  };
  actions: {
    uploadPdf: string;
    loadSample: string;
    shareAndEmbed: string;
    copyCode: string;
    copied: string;
    close: string;
    download: string;
    convertNow: string;
    openFullscreen: string;
  };
  toolbar: {
    readingDirection: string;
    ltrLabel: string;
    rtlLabel: string;
    languageLabel: string;
    modeViewer: string;
    modeConverter: string;
    pagesUnit: string;
    sampleBadge: string;
    hostedBadge: string;
    localBadge: string;
  };
  viewer: {
    dropTitle: string;
    dropSubtitle: string;
    prevPage: string;
    nextPage: string;
    zoomFit: string;
    gapLabel: string;
    stageLight: string;
    stageDark: string;
    loadingPdf: string;
    errorPdf: string;
    pagePrefix: string;
    scrollHintLtr: string;
    scrollHintRtl: string;
  };
  converter: {
    title: string;
    subtitle: string;
    formatLabel: string;
    formatPdf: string;
    formatPdfDesc: string;
    formatJpg: string;
    formatJpgDesc: string;
    formatHtml: string;
    formatHtmlDesc: string;
    formatZip: string;
    formatZipDesc: string;
    orientationLabel: string;
    orientationHorizontal: string;
    orientationVertical: string;
    directionLabel: string;
    gapLabel: string;
    scaleLabel: string;
    generating: string;
    readyTitle: string;
    dimensionsLabel: string;
    fileSizeLabel: string;
    previewLabel: string;
    emptyPreview: string;
    canvasLimitNote: string;
    bundledEmbedTitle: string;
    bundledEmbedSubtitle: string;
  };
  embed: {
    modalTitle: string;
    modalSubtitle: string;
    uploadingToHost: string;
    shareUrlLabel: string;
    embedUrlLabel: string;
    liveViewerTab: string;
    convertedFileTab: string;
    languageSelectLabel: string;
    heightLabel: string;
    previewTitle: string;
  };
  guide: {
    sectionTitle: string;
    sectionSubtitle: string;
    serverReqTitle: string;
    serverReqItems: string[];
    multiLangEmbedTitle: string;
    i18nTitle: string;
    i18nSteps: string[];
    readmeNote: string;
  };
  a11y: {
    skipToContent: string;
    mainNavLabel: string;
    galleryRegionLabel: string;
    pageJumpLabel: string;
    textViewToggle: string;
    canvasViewToggle: string;
    textScaleIncrease: string;
    textScaleDecrease: string;
    highContrastToggle: string;
    shortcutsButton: string;
    shortcutsTitle: string;
    shortcutsSubtitle: string;
    noExtractableText: string;
    announcedPage: string;
    announcedLoaded: string;
    announcedDirection: string;
    announcedConverted: string;
    announcedTextViewOn: string;
    announcedTextViewOff: string;
    announcedHighContrastOn: string;
    announcedHighContrastOff: string;
    shortcuts: ShortcutItem[];
  };
}

export interface LocaleBundle {
  meta: LocaleMeta;
  t: TranslationDictionary;
}
