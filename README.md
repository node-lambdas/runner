# Node lambdas runner

Node.js runner for lambdas

## Environment

| name        | type   | description                                       |
| ----------- | ------ | ------------------------------------------------- |
| PORT        | number | HTTP port                                         |
| WORKING_DIR | string | Default: `/home/fn`                               |
| REPOSITORY  | string | Run from a GH repository, e.g. `org/octocat:main` |
| SOURCE_URL  | string | URL of a zip or tgz file to download and run      |

## Usage

With docker, run `ghcr.io/node-lambdas/runner:latest` with either `SOURCE_URL` or `REPOSITORY` set.

Example:

```sh
# Using a function from GitHub source, e.g. node-lambdas/yaml
docker run --rm -it -e -p3000:3000 REPOSITORY=node-lambdas/yaml ghcr.io/node-lambdas/runner:latest

# Using an URL with a tar or zip file
docker run --rm -it -e -p3000:3000 SOURCE_URL=https://example.com/fn.zip ghcr.io/node-lambdas/runner:latest

# Using a function in a local folder
docker run --rm -it -e -p3000:3000 -v $PWD:/home/fn ghcr.io/node-lambdas/runner:latest
```
