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

  ln -s $vagrant Vagrantfile
  vagrant up

  echo
  echo " ===> SUCCESS ${vagrant/Vagrantfile./} <==="
  echo

  vagrant destroy -f
  rm Vagrantfile
done
