# Agent Creative Brief Design

## Goal

Make a DreamChord Agent request follow one explicit execution policy and keep story construction, material planning, and workbench import derived from the same structured creative brief.

## Current Problem

`PrismaAgentRunService` currently decides intent, provider fallback, material mode, local generation, patch preview, and persistence in one method. `localAssistant.ts` combines intent rules, screenplay parsing, patch construction, and material prompt generation. The result works, but a request that first creates prose and later requests material prompts can lose the original creative goal.

## Design

### Agent Policy

Create a pure `agentPolicy.ts` module with one input: prompt, chapter binding, selected draft state, configured provider, and requested material mode. It returns one of:

- `local-immediate`: deterministic greetings, time, capability, project facts, creative knowledge, and explicit material prompt requests;
- `local-import`: selected draft or user screenplay must be parsed locally so the approved patch exactly reflects the selected text;
- `creative-action`: a chapter-bound request that can propose a story patch;
- `conversation`: read-only project discussion, optionally backed by the configured model;
- `material-plan`: a creative request whose requested result is a material plan rather than a story mutation.

The policy never reads the database, calls a model, or creates a patch. It is testable as a pure routing contract.

### Creative Brief

Create a serializable `CreativeBrief` domain type in the Agent server module. It records:

- `source`: user text, selected draft, or Agent continuation;
- `scenes`: scene title/location plus narration, dialogue, and choices;
- `cast`: exact project character matches only;
- `materials`: exact reusable background/character/CG assets and missing material requests;
- `warnings`: ambiguity or unmatched material facts that require author attention.

The existing deterministic screenplay parser produces this brief first. Patch creation and material-prompt text consume the brief. No unmatched asset becomes an implicit default. A project-bound creative request with `materialMode: 'prompts'` keeps the original prompt and produces a material plan rather than replacing it with a generic request.

### Orchestration Boundary

`runService.ts` consumes the policy result. It remains responsible for loading snapshots, obtaining context, calling a provider, updating task state, persisting messages/memories, validating StoryPatch objects, and author-approved apply/undo. It delegates deterministic actions to the local assistant and no longer owns ad hoc regex decisions for material prompting.

The queue remains in-process for the local edition. Its interface stays isolated, so a future Cloudflare Queue/Workflow or Azure-backed implementation can replace it without changing policy, brief, approval, or patch behavior.

### User Experience

The current Agent UI remains unchanged in this iteration. When the material strategy is "generate prompts", the Agent response explicitly separates:

1. reusable assets found in the library;
2. missing assets with copyable prompts;
3. story content that remains unchanged until the author chooses a workbench-import action.

## Safety Rules

- The model and policy never directly write chapters; only a validated StoryPatch can reach the existing approval flow.
- Matching remains conservative and exact. Missing assets yield requirements/prompts, not arbitrary project material.
- Selected drafts always take precedence over recent transcript content.
- API keys remain transient request data and are not persisted in briefs, messages, or run metadata.

## Tests

- Policy tests prove each route, especially chapter-bound material requests and selected-draft imports.
- Creative-brief tests prove screenplay cards, exact material matches, missing material requests, and no fallback asset assignment.
- Existing Agent e2e tests continue to prove patch preview, application, undo, provider fallback, and no-Key operation.

## Non-Goals

- No migration to a cloud queue in this iteration.
- No new database table or breaking Agent API.
- No automatic image generation, arbitrary browser actions, filesystem access, or direct database writes by the model.
