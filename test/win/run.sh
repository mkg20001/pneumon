#!/bin/bash

export PATH="/c/Program Files/nodejs:/c/vagrant/test/win:$PATH"

if ! which pkg > /dev/null; then
  npm i -g http-server pkg
fi

cd /c/vagrant
npm i
bash test/test.sh
