import type { LocaleCode } from '../i18n/types';
import type { ReadingDirection, StripOrientation } from './pdfTools';

export type EmbedLang = 'html' | 'javascript' | 'php' | 'python' | 'ruby' | 'csharp';

export const EMBED_LANG_LABELS: Record<EmbedLang, string> = {
  html: 'HTML5',
  javascript: 'JavaScript / React',
  php: 'PHP',
  python: 'Python (Flask / Django)',
  ruby: 'Ruby on Rails',
  csharp: 'ASP.NET Core (C#)',
};

export function getLiveViewerEmbedSnippet(options: {
  lang: EmbedLang;
  embedUrl: string;
  title: string;
  direction: ReadingDirection;
  locale: LocaleCode;
  height: number;
}): string {
  const { lang, embedUrl, title, direction, height } = options;
  const safeTitle = title.replace(/"/g, '&quot;');

  switch (lang) {
    case 'html':
      return `<iframe
  src="${embedUrl}"
  title="${safeTitle}"
  width="100%"
  height="${height}"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>`;

    case 'javascript':
      return `export function PdfGalleryEmbed() {
  return (
    <iframe
      src="${embedUrl}"
      title="${safeTitle}"
      style={{ width: '100%', height: '${height}px', border: '1px solid #e5e5e0', borderRadius: '8px' }}
      loading="lazy"
      allowFullScreen
    />
  );
}`;

    case 'php':
      return `<?php
$embedUrl = ${JSON.stringify(embedUrl)};
$title = htmlspecialchars(${JSON.stringify(title)}, ENT_QUOTES, 'UTF-8');
?>
<iframe
  src="<?= htmlspecialchars($embedUrl, ENT_QUOTES, 'UTF-8') ?>"
  title="<?= $title ?>"
  width="100%"
  height="${height}"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>`;

    case 'python':
      return `{# Jinja2 / Django Template #}
{% set pdf_embed_url = "${embedUrl}" %}
<iframe
  src="{{ pdf_embed_url }}"
  title="${safeTitle}"
  dir="${direction}"
  width="100%"
  height="${height}"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>`;

    case 'ruby':
      return `<%# Rails ERB View %>
<%= tag.iframe(
  nil,
  src: "${embedUrl}",
  title: "${safeTitle}",
  width: "100%",
  height: ${height},
  style: "border: 1px solid #e5e5e0; border-radius: 8px;",
  loading: "lazy",
  allowfullscreen: true
) %>`;

    case 'csharp':
      return `@* ASP.NET Core Razor View *@
@{
    var embedUrl = "${embedUrl}";
    var title = "${safeTitle}";
}
<iframe
  src="@embedUrl"
  title="@title"
  width="100%"
  height="${height}"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
  allowfullscreen
></iframe>`;
  }
}

export function getConvertedFileEmbedSnippet(options: {
  lang: EmbedLang;
  filename: string;
  format: 'pdf' | 'jpg' | 'html' | 'zip';
  orientation: StripOrientation;
  direction: ReadingDirection;
  height: number;
}): string {
  const { lang, filename, format, orientation, direction, height } = options;
  const assetPath =
    format === 'zip' ? '/uploads/gallery-embed.html' : `/uploads/${filename}`;
  const isJpg = format === 'jpg';
  const scrollAxis = orientation === 'horizontal' ? 'overflow-x: auto; overflow-y: hidden;' : 'overflow-y: auto;';

  const htmlBlock = isJpg
    ? `<div style="${scrollAxis} direction: ${direction}; background: #efeeea; padding: 16px; border-radius: 8px;">
  <img
    src="${assetPath}"
    alt="Converted Strip"
    style="${orientation === 'horizontal' ? `height: ${height}px; width: auto; max-width: none;` : 'width: 100%; height: auto;'} display: block;"
    loading="lazy"
  />
</div>`
    : `<iframe
  src="${assetPath}"
  width="100%"
  height="${height}"
  style="border: 1px solid #e5e5e0; border-radius: 8px;"
  loading="lazy"
></iframe>`;

  switch (lang) {
    case 'html':
      return htmlBlock;

    case 'javascript':
      return isJpg
        ? `export function StripImageViewer() {
  return (
    <div style={{ overflowX: 'auto', direction: '${direction}', background: '#efeeea', padding: 16, borderRadius: 8 }}>
      <img
        src="${assetPath}"
        alt="Converted Strip"
        style={{ height: '${height}px', width: 'auto', maxWidth: 'none', display: 'block' }}
      />
    </div>
  );
}`
        : `export function StripFileEmbed() {
  return (
    <iframe
      src="${assetPath}"
      style={{ width: '100%', height: '${height}px', border: '1px solid #e5e5e0', borderRadius: '8px' }}
      loading="lazy"
    />
  );
}`;

    case 'php':
      return `<?php $assetUrl = ${JSON.stringify(assetPath)}; ?>\n${htmlBlock.replace(assetPath, '<?= htmlspecialchars($assetUrl, ENT_QUOTES, "UTF-8") ?>')}`;

    case 'python':
      return `{% set strip_asset = "${assetPath}" %}\n${htmlBlock.replace(assetPath, '{{ strip_asset }}')}`;

    case 'ruby':
      return `<% strip_asset = "${assetPath}" %>\n${htmlBlock.replace(assetPath, '<%= strip_asset %>')}`;

    case 'csharp':
      return `@{ var stripAsset = "${assetPath}"; }\n${htmlBlock.replace(assetPath, '@stripAsset')}`;
  }
}
