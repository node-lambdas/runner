FROM ghcr.io/cloud-cli/node:latest
COPY --chown=node:node . /home/app
USER node
RUN mkdir /home/fn
ENV PORT=3000
ENV WORKING_DIR=/home/fn