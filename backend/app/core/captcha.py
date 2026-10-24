"""
Adaptive Security Verification Engine
Provides hybrid challenge protection:
1. Adaptive Step-Up: Activates after consecutive failed attempts.
2. Cloudflare Turnstile integration (when site/secret keys are configured).
3. Local Zero-Tracker SVG Challenge fallback (stateless HMAC, 100% offline).
"""

import os
import time
import hmac
import hashlib
import secrets
import random
import json
import urllib.request
import urllib.parse
from typing import Tuple, Dict, Any, Optional

# Secret for HMAC signing (loaded from config or fallback)
_CAPTCHA_SECRET = os.getenv("CAPTCHA_SECRET", "zorvex-adaptive-security-hmac-key-2026").encode()
_FAILED_ATTEMPTS: Dict[str, Dict[str, Any]] = {}
_USED_CAPTCHA_IDS = set()

# Thresholds
FAILED_THRESHOLD = 2  # Step-up triggered after 2 consecutive failed attempts
ATTEMPT_WINDOW_SEC = 600  # 10 minute tracking window
CAPTCHA_TTL_SEC = 180  # Challenge valid for 3 minutes

CLOUDFLARE_TURNSTILE_SECRET = os.getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY", "").strip()


def get_client_identifier(request) -> str:
    """Derives a stable client identifier for rate tracking."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    elif request.client and request.client.host:
        client_ip = request.client.host
    else:
        client_ip = "127.0.0.1"
    return client_ip


def record_failed_attempt(identifier: str) -> int:
    """Records a failed authentication attempt and returns current count."""
    now = time.time()
    entry = _FAILED_ATTEMPTS.get(identifier)
    if not entry or (now - entry.get("timestamp", 0)) > ATTEMPT_WINDOW_SEC:
        _FAILED_ATTEMPTS[identifier] = {"count": 1, "timestamp": now}
        return 1
    else:
        entry["count"] += 1
        entry["timestamp"] = now
        return entry["count"]


def is_captcha_required(identifier: str) -> bool:
    """Checks if step-up verification is currently mandated for this client."""
    now = time.time()
    entry = _FAILED_ATTEMPTS.get(identifier)
    if not entry:
        return False
    if (now - entry.get("timestamp", 0)) > ATTEMPT_WINDOW_SEC:
        del _FAILED_ATTEMPTS[identifier]
        return False
    return entry.get("count", 0) >= FAILED_THRESHOLD


def reset_failed_attempts(identifier: str):
    """Resets failed attempt counters on successful login."""
    if identifier in _FAILED_ATTEMPTS:
        del _FAILED_ATTEMPTS[identifier]


def generate_local_challenge() -> Dict[str, Any]:
    """
    Generates a localized SVG challenge with stateless HMAC authentication.
    Returns: { captcha_id, challenge_svg, expires_in }
    """
    # 50% probability: Alphanumeric code or simple arithmetic equation
    is_math = random.choice([True, False])
    if is_math:
        op = random.choice(["+", "-"])
        if op == "+":
            a = random.randint(12, 58)
            b = random.randint(7, 34)
            answer = str(a + b)
            display_text = f"{a} + {b} = ?"
        else:
            a = random.randint(25, 75)
            b = random.randint(8, 24)
            if a < b:
                a, b = b, a
            answer = str(a - b)
            display_text = f"{a} - {b} = ?"
    else:
        # Clear alphanumeric excluding ambiguous characters (0, O, 1, I, l)
        charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
        answer = "".join(random.choices(charset, k=5))
        display_text = " ".join(answer)

    now = int(time.time())
    salt = secrets.token_hex(4)
    # Generate signature on normalized lowercase answer
    payload = f"{salt}:{answer.lower()}:{now}".encode()
    sig = hmac.new(_CAPTCHA_SECRET, payload, hashlib.sha256).hexdigest()[:16]
    captcha_id = f"{now}:{salt}:{sig}"

    # Render clean Clay-styled SVG
    width = 220
    height = 56
    
    # Generate 3-4 background decorative wavy splines
    splines = []
    colors = ["#49664D", "#2F4A33", "#749B78"]
    for i in range(3):
        y1 = random.randint(15, 45)
        y2 = random.randint(15, 45)
        y3 = random.randint(15, 45)
        color = colors[i % len(colors)]
        splines.append(
            f'<path d="M 0 {y1} Q 110 {y2} 220 {y3}" stroke="{color}" stroke-width="1.2" fill="none" opacity="0.35"/>'
        )

    # Render characters with slight rotation
    chars_svg = []
    total_chars = len(display_text)
    spacing = (width - 40) / max(total_chars, 1)
    for i, ch in enumerate(display_text):
        x = 24 + (i * spacing)
        y = 36 + random.randint(-2, 2)
        rot = random.randint(-8, 8) if ch != " " else 0
        char_color = "#292E28"
        chars_svg.append(
            f'<text x="{x}" y="{y}" transform="rotate({rot}, {x}, {y})" font-family="ui-monospace, monospace, sans-serif" font-size="20" font-weight="900" fill="{char_color}">{ch}</text>'
        )

    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
  <rect width="{width}" height="{height}" rx="12" fill="#EAEEDF" stroke="#D3DCBF" stroke-width="1.5"/>
  {''.join(splines)}
  {''.join(chars_svg)}
</svg>'''

    return {
        "captcha_id": captcha_id,
        "challenge_svg": svg_content,
        "challenge_type": "math" if is_math else "alphanumeric",
        "expires_in": CAPTCHA_TTL_SEC
    }


def verify_local_solution(captcha_id: str, solution: str) -> bool:
    """Verifies user solution against the stateless HMAC signature."""
    if not captcha_id or not solution:
        return False

    parts = captcha_id.split(":")
    if len(parts) != 3:
        return False

    ts_str, salt, sig = parts
    try:
        ts = int(ts_str)
    except ValueError:
        return False

    now = int(time.time())
    if now - ts > CAPTCHA_TTL_SEC:
        return False  # Expired

    if captcha_id in _USED_CAPTCHA_IDS:
        return False  # Replay prevention

    clean_ans = solution.strip().lower()
    payload = f"{salt}:{clean_ans}:{ts}".encode()
    expected_sig = hmac.new(_CAPTCHA_SECRET, payload, hashlib.sha256).hexdigest()[:16]

    if hmac.compare_digest(sig, expected_sig):
        _USED_CAPTCHA_IDS.add(captcha_id)
        if len(_USED_CAPTCHA_IDS) > 2000:
            _USED_CAPTCHA_IDS.clear()
        return True

    return False


def verify_turnstile_token(token: str, remote_ip: str) -> bool:
    """Verifies Cloudflare Turnstile token via Cloudflare API."""
    if not CLOUDFLARE_TURNSTILE_SECRET:
        # If no secret configured, Turnstile cannot be verified server-side
        return False

    try:
        data = urllib.parse.urlencode({
            "secret": CLOUDFLARE_TURNSTILE_SECRET,
            "response": token,
            "remoteip": remote_ip
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            result = json.loads(res.read().decode("utf-8"))
            return result.get("success", False)
    except Exception:
        return False
