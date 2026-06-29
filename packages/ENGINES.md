# Lokvis Engine Stub

This directory is a placeholder for future engine adapter packages (engine-image, engine-video, engine-pdf, engine-audio, engine-ai).

Engine adapters wrap WASM-based libraries (FFmpeg.wasm, Squoosh, pdf-lib, etc.) and register capability implementations to the Runtime.

See `packages/runtime/src/capability-registry.ts` and the technical architecture doc at `docs/whitepaper/04-技术架构设计.md` for details.
