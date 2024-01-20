FROM ghcr.io/cloud-cli/node:latest
COPY --chown=node:node . /home/app
ENV