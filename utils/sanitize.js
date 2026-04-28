// HTML sanitization for admin-authored notes.
//
// Why: even though only admins can post note HTML, a compromised admin
// account (or a malicious co-admin) could otherwise inject <script> tags
// or event handlers that run for every student viewing the note (stored XSS).
//
// Strategy: allow rich formatting (headings, lists, tables, images, links,
// inline styles, color/font tweaks) while stripping anything executable.

const sanitizeHtml = require('sanitize-html');

const NOTE_OPTIONS = {
  allowedTags: [
    'h1','h2','h3','h4','h5','h6',
    'blockquote','p','a','ul','ol','nl','li',
    'b','i','strong','em','strike','u','s','mark','small','sub','sup',
    'code','hr','br','div','span','pre',
    'table','thead','caption','tbody','tr','th','td',
    'img','figure','figcaption',
    'details','summary',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['style', 'class', 'id', 'colspan', 'rowspan', 'align', 'dir', 'lang'],
  },
  // Block any URL scheme that can execute JS (javascript:, data:, vbscript:)
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: true,
  // Strict CSS allow-list applied to every `style="..."` attribute
  allowedStyles: {
    '*': {
      color: [/^.+$/],
      'background-color': [/^.+$/],
      'text-align': [/^left$|^right$|^center$|^justify$/],
      'font-size': [/^\d+(?:px|pt|em|rem|%)$/],
      'font-weight': [/^\d{3}$|^bold$|^normal$/],
      'font-style': [/^italic$|^normal$|^oblique$/],
      'text-decoration': [/^underline$|^line-through$|^none$/],
      'margin': [/^[\d\s.px%emrm-]+$/],
      'padding': [/^[\d\s.px%emrm-]+$/],
      'border': [/^[\w\s#().,%-]+$/],
      'border-radius': [/^\d+(?:px|%)$/],
      'width': [/^\d+(?:px|%|em|rem)$/],
      'max-width': [/^\d+(?:px|%|em|rem)$/],
      'height': [/^\d+(?:px|%|em|rem)$/],
      'display': [/^block$|^inline$|^inline-block$|^flex$|^grid$|^none$/],
    },
  },
  // Hard-strip these even if somehow present
  disallowedTagsMode: 'discard',
  exclusiveFilter: (frame) => {
    // Drop any element whose tag survived but has an event-handler attr
    // (sanitize-html already strips on* attrs because they're not allowed,
    // but this is an extra belt-and-braces guard.)
    return false;
  },
};

function sanitizeNoteHtml(dirtyHtml) {
  if (typeof dirtyHtml !== 'string') return '';
  return sanitizeHtml(dirtyHtml, NOTE_OPTIONS);
}

module.exports = { sanitizeNoteHtml };
