#!/bin/bash

set -e

if [ -e Vagrantfile ]; then
  vagrant destroy -f
  rm Vagrantfile
fi

for vagrant in $(dir -w 1 | grep Vagrantfile); do
  echo
  echo " ===> ${vagrant/Vagrantfile./} <==="
  echo
  ln -sf $vagrant Vagrantfile
  vagrant up
  rm Vagrantfile
done
