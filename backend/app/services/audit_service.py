from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthUser
from app.models.audit_log import AuditLog


async def log_action(
    session: AsyncSession,
    *,
    actor: AuthUser | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    entity_label_snapshot: str | None = None,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
    reason: str | None = None,
    source: str = "web",
    status: str = "success",
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    encoded_before = jsonable_encoder(before_data) if before_data is not None else None
    encoded_after = jsonable_encoder(after_data) if after_data is not None else None
    encoded_metadata = jsonable_encoder(metadata or {})

    diff: dict[str, Any] = {}
    if encoded_before is not None and encoded_after is not None:
        for key, after_value in encoded_after.items():
            before_value = encoded_before.get(key)
            if before_value != after_value:
                diff[key] = {"before": before_value, "after": after_value}

    entry = AuditLog(
        occurred_at=datetime.now(timezone.utc),
        actor_user_id=actor.id if actor else None,
        actor_username=actor.username if actor else None,
        actor_roles=actor.roles if actor else [],
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label_snapshot=entity_label_snapshot,
        before_data=encoded_before,
        after_data=encoded_after,
        diff=diff or None,
        reason=reason,
        source=source,
        status=status,
        audit_metadata=encoded_metadata,
    )
    session.add(entry)
    await session.flush()
    return entry
