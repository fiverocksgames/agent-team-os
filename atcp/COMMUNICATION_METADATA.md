# Communication Metadata

## Purpose

ATCP messages need stable metadata for traceability across agents, vendors, sessions, transports, and long-running projects.

This standard generalizes proven AI-to-AI document metadata while separating human-readable records from machine transport envelopes.

## Machine envelope

ATCP JSON messages should use these semantic fields when applicable:

- `protocol`
- `message_type`
- `message_id`
- `conversation_id`
- `task_id`
- `from`
- `to`
- `created_at`
- `in_reply_to`
- `priority`
- `response_required`
- `due_at`
- `related`
- `tags`

Required fields for every message:

- `protocol`
- `message_type`
- `message_id`
- `task_id`
- `from`
- `to`
- `created_at`

`conversation_id` is strongly recommended for multi-message workflows.

## Human-readable rendering

When an ATCP exchange is rendered into Markdown for review or archival, a readable header may use:

```text
From: <role/team>
To: <role/team>
Subject: <title>
Message-Type: <ATCP message type or human document type>
Date: <timestamp/date>
Task-ID: <task identifier>
Conversation-ID: <conversation identifier>
Reference: <related issue/PR/document>
Priority: <priority>
Response-Required: Yes | No
Due: <optional deadline>
```

Human rendering is not the canonical machine payload when structured JSON is available.

## Identity rules

### message_id

Uniquely identifies one message. A materially new response receives a new ID.

### conversation_id

Groups messages in the same communication flow and remains stable across multiple roles and message types.

### task_id

Identifies the contracted unit of work. A conversation may discuss one task over multiple messages.

## Lifecycle distinction

Do not confuse communication lifecycle with project approval lifecycle.

For example, a `RESULT` message may report successful execution but does not by itself authorize merge or release. Authority remains defined by governance and the task contract.

## Minimality

Only add metadata fields with demonstrated value for traceability, routing, automation, safety, or continuity. ATCP should remain transport-neutral and readable by both machines and humans.
