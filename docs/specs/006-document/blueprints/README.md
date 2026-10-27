# Document blueprints

Follow the references below only as needed; never upfront.

- ./stroke-points.md - when implementing or changing how a freehand stroke's points are packed, decoded, validated or migrated
- ./document-storage.md - when implementing or changing where a document's content lives: the room's schema, routing, the outbox and its drain, the content summary, shared tabs between rooms, purge and upkeep
- ./document-storage-move.md - when implementing or running the move of existing documents into their rooms: the class change, the move gate, the content hash, the sweep, the operator tool and the drop
- ./DEFAULTS.md - when a document blueprint applies a default the spec leaves open
- ./COMPLETENESS.md - when checking which completeness categories a document blueprint covers
