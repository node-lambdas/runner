# Node lambdas runner

Node.js runner for lambdas

## Environment

| name        | required | description                                       |
| ----------- | -------- | ------------------------------------------------- |
| PORT        | number   | HTTP port                                         |
| MAX_RESTART | number   | Default: 5                                        |
| WORKING_DIR | string   | Default: `/home/fn`                               |
| REPOSITORY  | string   | Run from a GH repository, e.g. `org/octocat:main` |
| SOURCE_URL  | string   | URL of a zip or tgz file to download and run      |
