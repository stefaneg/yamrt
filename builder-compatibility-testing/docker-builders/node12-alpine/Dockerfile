FROM node:12.6.0-alpine

RUN apk update && apk upgrade && \
    apk add --no-cache bash git

RUN addgroup -S ciuser && adduser -S ciuser -G ciuser

USER ciuser

