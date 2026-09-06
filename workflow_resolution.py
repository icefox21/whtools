"""Content-based routing for native browser JSON workflow imports."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

try:  # Package import in ComfyUI
    from .workflow_storage import parse_workflow_json, revision_for_file, staging_directory
except ImportError:  # Direct module import in the standalone unit tests
    from workflow_storage import parse_workflow_json, revision_for_file, staging_directory


@dataclass(frozen=True)
class NativeImportResolution:
    status: str
    path: Path | None = None
    revision: str | None = None
    candidates: tuple[Path, ...] = ()


def canonical_workflow_hash(content: str) -> str:
    """Hash workflow semantics, ignoring obsolete runtime-only session metadata."""
    workflow = parse_workflow_json(content)
    extra = workflow.get("extra")
    if isinstance(extra, dict):
        extra.pop("jdsc_session_id", None)
    canonical = json.dumps(
        workflow,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def resolve_native_import(default_root: str | Path, content: str) -> NativeImportResolution:
    """Find the one default workflow with semantically identical JSON content.

    The browser does not expose an absolute source path for drag-and-drop files.
    Content matching is therefore deliberately conservative: only one match binds
    the original default file; zero matches stay external, multiple matches require
    an explicit user choice.
    """
    root = Path(default_root).resolve()
    stage_root = staging_directory(root).resolve()
    target_hash = canonical_workflow_hash(content)
    matches: list[Path] = []

    if not root.is_dir():
        return NativeImportResolution(status="unmatched")

    for candidate in root.rglob("*.json"):
        candidate = candidate.resolve()
        if candidate.is_relative_to(stage_root):
            continue
        try:
            if canonical_workflow_hash(candidate.read_text(encoding="utf-8-sig")) == target_hash:
                matches.append(candidate)
        except (OSError, UnicodeDecodeError, ValueError, json.JSONDecodeError):
            # A malformed/unreadable file cannot safely be a match.
            continue

    if len(matches) == 1:
        path = matches[0]
        return NativeImportResolution(
            status="default_unique",
            path=path,
            revision=revision_for_file(path),
        )
    if len(matches) > 1:
        return NativeImportResolution(status="ambiguous", candidates=tuple(matches))
    return NativeImportResolution(status="unmatched")
