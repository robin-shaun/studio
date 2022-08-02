#!/usr/bin/env bash

CONTAINER="studio-benchmark-generator:1"
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

cd ${SCRIPT_DIR}

echo "Building ${CONTAINER}"
docker build -t ${CONTAINER} .

echo "Running ${CONTAINER}"
docker run --rm -p 8888:8888 -v `pwd`:/notebooks ${CONTAINER}
