#!/usr/bin/env bash

echo ${HOME}
cd prod-packages/yamrt
echo "Running npm --version"
npm --version
echo "Running npm install"
npm install
echo "NPM install complete, running tests"
npm run test
