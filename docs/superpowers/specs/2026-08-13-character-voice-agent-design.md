# DreamChord Character Voice and Production Agent Design

## Goal

Let an author attach authorized voice references to a project character, prepare reusable line-generation requests, and review generated voice candidates before they reach a playable shot. The workflow must remain useful without a speech provider or API key.

## Reference Decisions

- WebGAL validates the value of independent BGM, SFX, and sentence voice playback. DreamChord keeps its structured shot-card graph rather than adding a script language.
- Paper2Gal demonstrates that a character companion and transformed source content belong in one flow. DreamChord applies this to author-owned story characters, not study PDFs.
- Hermes-agent demonstrates provider abstraction, visible sessions, bounded toolsets, and approval modes. DreamChord retains its project-scoped tool allowlist and does not adopt arbitrary shell, browser, MCP, or file tools.

## Product Boundary

An MP3/WAV/OGG sample does not contain a reusable voice model by itself. Voice cloning requires an explicitly configured speech provider or a local model runtime, plus consent and quality controls. DreamChord will never claim local cloning solely because a sample was uploaded.

The first iteration therefore implements a provider-neutral voice-production contract:

1. A character voice profile stores style, rate, emotion defaults, approved sample asset IDs, and a consent flag.
2. The author can inspect sample duration/format and keep several takes; only `VOICE_SAMPLE` assets may become voice references.
3. A `VoiceLineRequest` identifies character, source text, target shot, desired delivery, and chosen provider.
4. Provider output is a proposed `VOICE` asset. The author previews it and explicitly binds it to the shot.
5. Without a configured provider, the Agent produces a voice script, delivery directions, and a missing-resource checklist; it does not fabricate audio.

## Data and Approval Flow

```text
authorized sample upload
  -> character voice profile
  -> author / Agent voice plan
  -> provider request (optional)
  -> proposed VOICE asset
  -> author preview + accept
  -> shot card audio.voice binding
  -> existing player voice channel
```

Voice samples are private to the asset owner. Any request must carry an affirmative voice-rights confirmation, be restricted to a character in the current project, and never expose the sample to an unrelated model/tool. A provider adapter receives only the selected text, delivery instructions, and explicitly approved sample URLs/bytes required by that provider.

## Agent Design

Add a read-only `plan_character_voice` tool. It can read a character profile, referenced samples, scene dialogue, and existing voice assets, then return an inspectable plan. `AgentPolicy` recognizes voice-planning language as a no-patch task. The local fallback returns structured directions for every relevant line and names missing samples/provider configuration.

The Agent does not generate a final asset, bind a voice, or alter a story patch. A future provider-backed `generate_voice_candidate` action must require a separate confirmation UI and preserve its provenance, provider, prompt, and source sample IDs.

## Scope of This Iteration

Implemented now: voice-sample classification, character voice-profile metadata, local/Agent voice planning, quality/consent guidance, editor-level linking design, tests and documentation.

Deferred deliberately: automatic cloning, direct third-party provider credentials, TTS cost billing, waveform editing, lip-sync, and cross-character voice transfer. These require a provider selection and an explicit consent/revocation design beyond this local-first release.
