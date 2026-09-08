# ADR 0001: Store annotation organization separately

**Status:** Accepted

**Decision:**

Game Note stores Topic definitions, Topic membership, and manual sidebar order in an optional `organization` section beside the unchanged Annotation records. This keeps organization independent from timestamped review content and lets projects created before Topics open without a schema-version increase; older apps may ignore or discard organization if they resave a newer project.

Each Annotation ID has exactly one placement: either a top-level `rootItems` entry or one Topic's `annotationIds`. `rootItems` can freely interleave Topics and unassigned Annotations. Corrupt references are recovered without deleting valid Annotation records; the repaired representation is persisted only on a later Save.
