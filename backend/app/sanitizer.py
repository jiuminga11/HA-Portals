"""最小化 HTML 安全过滤，阻断已知 XSS 向量。"""

import re

_DANGEROUS_PATTERNS = [
    re.compile(r"<\s*script", re.IGNORECASE),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"\bon\w+\s*=", re.IGNORECASE),
]


def check_html_safe(html: str) -> tuple[bool, str]:
    """检查 HTML 是否安全。返回 (is_safe, reason)。"""
    for pattern in _DANGEROUS_PATTERNS:
        if pattern.search(html):
            return False, f"HTML 内容包含不安全代码: {pattern.pattern}"
    return True, ""
