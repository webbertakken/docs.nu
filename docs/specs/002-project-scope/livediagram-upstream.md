# livediagram upstream

livedocs began as a fork of [livediagram](https://github.com/livediagram-app/livediagram.app) and is now a **parallel
product**: its own name, its own domain, its own deployments and its own
[purpose](../001-project-vision/purpose.md). livediagram is its **upstream**: the project it came from, which keeps
moving on its own course.

## Picked by hand

livedocs does not track upstream. A change from livediagram enters livedocs only when it is **picked**: someone chooses
it, ports it, and it lands through a livedocs pull request like any other change.

- **There is no regular merge.** livedocs diverges freely wherever its purpose asks it to; nothing obliges it to stay
  close to livediagram.
- **A pick is judged against livedocs's specs**, not livediagram's. A pick that contradicts a livedocs spec changes the
  spec first, or is left out.
- **A pick names its source** in its pull request: the upstream pull request or commit it came from.
- **Nothing flows back automatically.** A livedocs change that would serve livediagram too is offered upstream as its
  own pull request, by choice.

## What is shared, and what is not

- **Shared at the start:** the codebase, the domain model (documents, tabs, tab kinds), the canvas tab kinds and the
  specs that describe them. Those specs stay true for livedocs until a livedocs change moves them.
- **Not shared:** the name, the domains, the deployments, their resources and secrets, the published packages and the
  command line's name. livedocs never deploys to, publishes as, or reaches livediagram's infrastructure.

## The git remote

The upstream remote is fetch-only in every livedocs checkout: its push URL is disabled, so nothing reaches livediagram
by accident.
