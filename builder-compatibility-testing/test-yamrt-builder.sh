#!/usr/bin/env bash

function testBuilder(){
  BUILDER=$1
  echo Testing using ${BUILDER}
  (cd builder-compatibility-testing/docker-builders/${BUILDER} && docker build . -t ${BUILDER})
  docker run --rm -v ~/.npmrc:/root/.npmrc -v $(pwd):/builddir -w /builddir ${BUILDER} ./builder-compatibility-testing/docker-builder-script.sh

}

# Uncomment builder you want to test
# testBuilder node12
# testBuilder node12-alpine
