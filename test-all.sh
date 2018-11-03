#!/bin/bash

set -e

if [ -e Vagrantfile ]; then
  yes | vagrant destroy
  rm Vagrantfile
fi

for vagrant in $(dir -w 1 | grep Vagrantfile); do
  ln -s $vagrant Vagrantfile
  vagrant up
done
