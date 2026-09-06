"""Pure, testable storage helpers for whtools workflow JSON files."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


class InvalidWorkflowContent(ValueError):
    """The request body is not a JSON object usable as a workflow."""


class WorkflowAlreadyExists(FileExistsError):
    """A create-only save targeted an existing workflow file."""


class WorkflowRevisionConflict(RuntimeError):
    """The on-disk workflow changed after the caller loaded it."""


class StagePathViolation(ValueError):
    """A staging-only operation received a path outside the staging directory."""


@dataclass(frozen=True)
class StageResult:
    path: Path
    revision: str
    stage_id: str


def parse_workflow_json(content: str) -> dict[str, Any]:
    """Validate JSON text and require the top-level workflow object."""
    if not isinstance(content, str):
        raise InvalidWorkflowContent("工作流内容必须是 JSON 字符串")
    try:
        data = json.loads(content)
    except (TypeError, json.JSONDecodeError) as exc:
        raise InvalidWorkflowContent("工作流内容不是有效的 JSON") from exc
    if not isinstance(data, dict):
        raise InvalidWorkflowContent("工作流内容顶层必须是 JSON 对象")
    return data


def strip_legacy_session_from_content(content: str) -> str:
    """Remove the old persisted runtime session marker before disk storage."""
    workflow = parse_workflow_json(content)
    extra = workflow.get("extra")
    if not isinstance(extra, dict) or "jdsc_session_id" not in extra:
        return content
    del extra["jdsc_session_id"]
    return json.dumps(workflow, ensure_ascii=False, indent=2)


def revision_for_bytes(raw: bytes) -> str:
    """Return the stable SHA-256 revision token for exact file bytes."""
    return hashlib.sha256(raw).hexdigest()


def revision_for_file(path: str | os.PathLike[str]) -> str | None:
    """Return the file revision, or None when the target does not exist."""
    target = Path(path)
    if not target.exists():
        return None
    return revision_for_bytes(target.read_bytes())


def is_within_directory(path: str | os.PathLike[str], parent: str | os.PathLike[str]) -> bool:
    """Return whether a resolved path is inside (or equal to) a resolved parent."""
    try:
        resolved_path = Path(path).resolve()
        resolved_parent = Path(parent).resolve()
        return os.path.commonpath([str(resolved_path), str(resolved_parent)]) == str(resolved_parent)
    except (OSError, ValueError):
        return False


def sanitize_workflow_filename(display_name: str) -> str:
    """Return a safe workflow base name, without an extension or path components."""
    raw = Path(str(display_name or "")).name
    raw = re.sub(r"\.json$", "", raw, flags=re.IGNORECASE)
    raw = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "_", raw).strip(" ._")
    return (raw or "未命名工作流")[:100]


def staged_workflow_filename(display_name: str, source_type: str = "workflow_file") -> str:
    """Return the one stable JSON filename allocated for a staged import."""
    raw = Path(str(display_name or "")).name
    # Image workflows are serialized to JSON but keep the original image stem.
    if source_type == "image_drop":
        raw = Path(raw).stem
    return f"{sanitize_workflow_filename(raw)}.json"


def staging_directory(default_root: str | os.PathLike[str]) -> Path:
    return Path(default_root).resolve() / "__工作流+临时__"


def stage_workflow_content(
    default_root: str | os.PathLike[str],
    content: str,
    *,
    display_name: str,
    source_type: str = "workflow_file",
    stage_id: str | None = None,
    now: datetime | None = None,
) -> StageResult:
    """Atomically reuse the one controlled staging path for this imported name."""
    stage_id = (stage_id or uuid.uuid4().hex)[:32]
    target = staging_directory(default_root) / staged_workflow_filename(display_name, source_type)
    revision = atomic_write_workflow(target, content, overwrite=True)
    return StageResult(path=target, revision=revision, stage_id=stage_id)


def promote_staged_workflow(
    default_root: str | os.PathLike[str],
    stage_path: str | os.PathLike[str],
    target_name: str,
    *,
    expected_revision: str | None,
) -> StageResult:
    """Move a validated staging file to the default root without overwriting."""
    root = Path(default_root).resolve()
    source = Path(stage_path).resolve()
    stage_root = staging_directory(root)
    if not is_within_directory(source, stage_root) or source == stage_root:
        raise StagePathViolation("只能移动工作流+临时目录中的文件")
    if not source.exists():
        raise FileNotFoundError("临时工作流文件不存在")
    if expected_revision is None or revision_for_file(source) != expected_revision:
        raise WorkflowRevisionConflict("临时工作流已被其他窗口或程序修改")

    target = root / f"{sanitize_workflow_filename(target_name)}.json"
    if target.exists():
        raise WorkflowAlreadyExists("默认工作流目录中已存在同名文件")
    root.mkdir(parents=True, exist_ok=True)
    os.rename(source, target)
    return StageResult(path=target, revision=revision_for_file(target) or "", stage_id="")


def atomic_write_workflow(
    path: str | os.PathLike[str],
    content: str,
    *,
    overwrite: bool,
    expected_revision: str | None = None,
) -> str:
    """Validate and atomically replace a workflow file, returning its revision."""
    content = strip_legacy_session_from_content(content)

    target = Path(path)
    parent = target.parent
    parent.mkdir(parents=True, exist_ok=True)

    current_revision = revision_for_file(target)
    if expected_revision is not None and current_revision != expected_revision:
        raise WorkflowRevisionConflict("工作流已被其他窗口或程序修改")
    if current_revision is not None and not overwrite:
        raise WorkflowAlreadyExists("文件已存在")

    fd, temp_path = tempfile.mkstemp(
        prefix=f".{target.name}.", suffix=".tmp", dir=str(parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, target)
        return revision_for_file(target) or revision_for_bytes(content.encode("utf-8"))
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
