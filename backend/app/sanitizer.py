"""Parser-based HTML and purpose-specific URL policy. No database writes here."""
import html
import re
from urllib.parse import urlsplit

import nh3

TAGS = set('p div span h1 h2 h3 h4 h5 h6 strong b em i u s strike br hr ul ol li blockquote pre code table thead tbody tfoot tr th td caption a img sub sup'.split())
STYLES = {'color', 'background-color', 'text-align', 'font-weight', 'font-style',
          'text-decoration', 'font-size', 'font-family', 'white-space', 'vertical-align'}
CLASSES = re.compile(r'^(?:ql-(?:align-(?:center|right|justify)|indent-[1-8]|direction-rtl|size-(?:small|large|huge)|font-(?:serif|monospace)|syntax|code-block(?:-container)?|ui))$')


def safe_url(value: str, *, media: bool = False) -> str:
    value = html.unescape(value).strip()
    if any(ord(char) < 32 or ord(char) == 127 for char in value) or '\\' in value:
        raise ValueError('URL 含不安全字符')
    parsed = urlsplit(value)
    allowed = {'http', 'https'} if media else {'http', 'https', 'mailto', 'tel'}
    if parsed.scheme and parsed.scheme.lower() not in allowed:
        raise ValueError('URL 协议不受支持')
    return value


def _attribute(tag: str, attr: str, value: str) -> str | None:
    if attr in {'href', 'src'}:
        try:
            return safe_url(value, media=attr == 'src')
        except ValueError:
            return None
    if attr == 'class':
        return ' '.join(c for c in value.split() if CLASSES.fullmatch(c)) or None
    if attr == 'data-list' and value not in {'ordered', 'bullet', 'checked', 'unchecked'}:
        return None
    return value


_cleaner = nh3.Cleaner(
    tags=TAGS,
    clean_content_tags={'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template'},
    attributes={'*': {'id', 'title', 'lang', 'dir', 'class', 'style'},
                'a': {'href', 'target', 'name'}, 'img': {'src', 'alt', 'width', 'height'},
                'td': {'colspan', 'rowspan'}, 'th': {'colspan', 'rowspan', 'scope'},
                'ol': {'start'}, 'li': {'data-list', 'value'}},
    attribute_filter=_attribute, filter_style_properties=STYLES,
    url_schemes={'http', 'https', 'mailto', 'tel'}, url_relative='pass_through',
    link_rel='noopener noreferrer',
)


def sanitize_html(value: str) -> str:
    return _cleaner.clean(value)
